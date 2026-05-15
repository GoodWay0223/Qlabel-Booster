/**
 * navigator.js
 * 键盘导航 + 聚焦高亮。
 * 跳转顺序：列内从上到下优先（先打完一列再切列）。
 */
(function (global) {
  'use strict';

  const { getColumns, getQuestionsInColumn, getAllQuestionGroups, getCurrentScore } =
    global.QLBSelectors;
  const { state } = global.QLBState;
  const { scoreOne } = global.QLBScorer;

  const FOCUS_CLASS = 'qlb-focused';
  const MISSING_TARGET_CLASS = 'qlb-missing-target';

  /** 清除旧聚焦 */
  function clearFocus() {
    document.querySelectorAll('.' + FOCUS_CLASS).forEach((el) => el.classList.remove(FOCUS_CLASS));
    document.querySelectorAll('.' + MISSING_TARGET_CLASS).forEach((el) => el.classList.remove(MISSING_TARGET_CLASS));
    // v1.9.34：同步清 data 锚点，避免多处残留让 resolveActiveFocus 取到错误节点
    document.querySelectorAll('[data-qlb-focus-ref]').forEach((el) => {
      try { el.removeAttribute('data-qlb-focus-ref'); } catch (e) {}
    });
    state.focusedGroup = null;
  }

  /**
   * 把目标元素滚动到视口的"安全可视区"，保证用户立即看见。
   *
   * v1.9.36：通过控制台诊断确认，qlabel 页面顶部"原视频/打分视频"行是
   *   `<div class="cr-container-col cr-container-col--24" style="position:fixed; top:12px; ...">`
   *   高约 473px，z-index=88。
   *   浏览器原生 scrollIntoView **不会**把 fixed 元素纳入计算（只会处理 sticky），
   *   所以无论 block:'start' / 'nearest' / 'center'，目标都可能落到 fixed 视频行下面被遮住。
   *
   *   解决：每次滚动前先动态测量"顶部 fixed 遮挡的下沿 Y"，
   *   把 SAFE_TOP_MARGIN 改成 `topOcclusion + 12px 缓冲`。
   *
   *   算法：
   *     1. 调 el.scrollIntoView({ block: 'start' }) 粗定位（外层滚动容器递归）
   *     2. 下一帧测真实 rect.top，与"动态安全顶 = topOcclusion + 12"比较
   *        若偏离 > 2px，用 scrollBy 补偿；window 没动则补偿最近滚动祖先
   *     3. 再下一帧做 smooth 平滑（视觉上渐进）
   */

  /** v1.9.36：动态测量顶部 fixed/sticky 遮挡（相对当前视口，不依赖任何写死的 class）
   *
   * 策略：
   *   1) 先按已知 class 直查 `.cr-container-col--24`（页面 header/视频行容器）
   *   2) 再扫所有 `position: fixed | sticky` 元素，取顶部 200px 内、宽度 > 视口 40% 的
   *   3) 取所有候选的最大 rect.bottom 作为遮挡下沿
   *   4) 兜底为 0（无遮挡）
   *
   * 缓存 80ms：避免一次跳转里重复算（一次 scrollIntoSafeView 会调 ≥ 2 次）
   */
  let _occCache = { at: 0, value: 0 };
  function getTopOcclusion() {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - _occCache.at < 80) return _occCache.value;
    let maxBottom = 0;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    try {
      // 1) 已知 class 优先
      document.querySelectorAll('.cr-container-col--24').forEach((el) => {
        const cs = window.getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
        const r = el.getBoundingClientRect();
        if (r.top < 200 && r.bottom > maxBottom && r.width > vw * 0.4) maxBottom = r.bottom;
      });
      // 2) 通用扫描所有 fixed/sticky 顶部宽元素
      //    限制 selector，避免扫到全局 fixed toast/弹窗等
      document.querySelectorAll('div, header, section, nav').forEach((el) => {
        // 跳过插件自己的 UI（toolbar/floating player/toast/modal）
        if (el.id === 'qlb-toolbar' || el.id === 'qlb-player' || el.id === 'qlb-toast' ||
            el.classList.contains('qlb-modal') || el.classList.contains('qlb-bar')) return;
        const cs = window.getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
        const r = el.getBoundingClientRect();
        // 必须贴近顶部、宽度足够大、确实可见
        if (r.top > 200 || r.bottom <= 0) return;
        if (r.width <= vw * 0.4) return;
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (parseFloat(cs.opacity || '1') < 0.05) return;
        if (r.bottom > maxBottom) maxBottom = r.bottom;
      });
    } catch (e) {}
    // clamp 到合理范围（0 ~ 视口 80%）
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (maxBottom < 0) maxBottom = 0;
    if (vh > 0 && maxBottom > vh * 0.8) maxBottom = vh * 0.8;
    _occCache = { at: now, value: maxBottom };
    return maxBottom;
  }

  /** v1.9.37：动态计算"安全顶" = 顶部遮挡下沿 + EXTRA_TOP_HEADROOM
   *
   *  EXTRA_TOP_HEADROOM = 64px（v1.9.38 调大）：
   *    - 12px 视频行底边到题目类别标题的呼吸空间
   *    - ~24px 类别标题文字本身的高度（"视频2-镜头剪辑..." 那一行）
   *    - ~28px 类别打分胶囊一行的高度（QLB 注的 .qlb-dim-bar/.qlb-col-bar）
   *  这样滚到位时，**类别标题 + 类别胶囊 + 题目本身**都能露出，方便用户对照打分。
   *
   *  历史：
   *    v1.9.36 = +12（题目刚好顶到视频下沿，类别标题被吃）
   *    v1.9.37 = +44（露出类别标题，但类别胶囊有时还在视频行下沿）
   *    v1.9.38 = +64（同时露出类别标题和类别胶囊）
   */
  const EXTRA_TOP_HEADROOM = 64;
  function getSafeTopMargin() {
    return getTopOcclusion() + EXTRA_TOP_HEADROOM;
  }

  /** v1.9.39：选择滚动锚点 —— 列首题用 .qlb-col-bar，使列顶整列打分胶囊也露出
   *
   *  规则：
   *    1. 找到 el 所属的"列容器"（先找 .qlb-col-bar 的父，否则用 .cr-container-col 等）
   *    2. 列容器中的所有题目里，el 是不是第 1 个？
   *       - 是 → 锚点 = 该列的 .qlb-col-bar（如果存在），让列顶胶囊一起进入视口
   *       - 否 → 锚点 = el（普通列内题）
   *    3. 任何异常 → 退化为 el
   */
  function pickScrollAnchor(el) {
    if (!el || !el.classList || !el.classList.contains('cr-radio-group')) return el;
    try {
      const cols = getColumns();
      // 找 el 所在列
      let col = null;
      for (const c of cols) {
        if (c.contains(el)) { col = c; break; }
      }
      if (!col) return el;
      // 列内是不是第一题？
      const qs = getQuestionsInColumn(col);
      if (qs.length === 0 || qs[0] !== el) return el;
      // 是首题 → 找列顶 .qlb-col-bar 作为锚点
      const colBar = col.querySelector(':scope > .qlb-col-bar');
      if (colBar) return colBar;
      return el;
    } catch (e) {
      return el;
    }
  }

  function scrollIntoSafeView(el) {
    if (!el) return;
    // v1.9.39：如果目标是"列内首题"（上方紧跟着 .qlb-col-bar 整列打分胶囊），
    //   把滚动锚点切到 .qlb-col-bar，这样列顶胶囊也能露出。
    //   - 跨列跳转（自动跳/手动跳到下一列首题）会触发
    //   - 列内中间题不会触发，保持原有简洁视图
    const anchor = pickScrollAnchor(el);
    const safeTop = getSafeTopMargin();
    // v1.9.36：若已完整落在安全可视区，跳过滚动 —— 避免连续打分时视口抖动
    // v1.9.37：短路阈值放宽 = 顶部遮挡下沿 + 8px。理由：
    //   - 我们想避免"连续打分时每打一题都把视口往上拉一截"的视觉抖动
    //   - 只要题目 top **没被 fixed 视频行遮挡**（即 top > topOcclusion+8），就保留当前位置
    //   - 真正越过遮挡线、或跨屏跳转，才会重新滚到 safeTop（含类别标题空间）
    // v1.9.39：短路时用 anchor 判定（保证列顶胶囊也在安全区内才不滚）
    try {
      const r0 = anchor.getBoundingClientRect();
      const vh0 = window.innerHeight || document.documentElement.clientHeight || 0;
      const occLine = getTopOcclusion() + 8;
      // 如果 anchor 比 el 大（含 col-bar），bottom 可能超过 vh - 60；
      // 此时只看 top 是否过遮挡线即可（anchor 的高度可能很高，整体放进视口不现实）
      const elRect = el.getBoundingClientRect();
      if (r0.top >= occLine && elRect.bottom <= vh0 - 60) return;
    } catch (e) {}
    try {
      // 第一步：原生 scrollIntoView 粗定位（instant 立即生效，不带动画，后面再做 smooth 微调）
      anchor.scrollIntoView({ block: 'start', inline: 'nearest' });
    } catch (e) {
      try { anchor.scrollIntoView(true); } catch (er) {}
    }

    // 第二步：下一帧微调，让 anchor.top ≈ safeTop（即把锚点对齐到 fixed 视频行下方）
    //   - 若是列内首题：anchor = .qlb-col-bar，对齐它 → 列顶胶囊 + 类别标题 + 题目都露出
    //   - 否则：anchor === el，行为同 v1.9.38
    if (typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => {
      try {
        const rect = anchor.getBoundingClientRect();
        const delta = rect.top - safeTop;
        if (Math.abs(delta) < 2) return;  // 已经很接近目标位置，不再动
        const beforeWindowY = window.pageYOffset || document.scrollingElement.scrollTop || 0;
        try {
          window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
        } catch (e) {
          try { window.scrollBy(0, delta); } catch (er) {}
        }
        // 再过一帧确认：如果 window 根本没动，就去找 anchor 的最近滚动祖先补
        requestAnimationFrame(() => {
          const afterWindowY = window.pageYOffset || document.scrollingElement.scrollTop || 0;
          if (Math.abs(afterWindowY - beforeWindowY) > 1) return; // window 滚动奏效了
          const sc = findScrollableAncestor(anchor);
          if (!sc || sc === document.documentElement || sc === document.body || sc === document.scrollingElement) return;
          const r2 = anchor.getBoundingClientRect();
          const delta2 = r2.top - safeTop;
          if (Math.abs(delta2) < 2) return;
          try {
            if (typeof sc.scrollBy === 'function') {
              sc.scrollBy({ top: delta2, left: 0, behavior: 'smooth' });
            } else {
              sc.scrollTop = sc.scrollTop + delta2;
            }
          } catch (e) {}
        });
      } catch (e) {}
    });
  }

  /** v1.9.36：判断元素是否已经落在视口"安全可视区"内 —— 用于快速跳过"近距离移动"的滚动
   *  安全可视区：top ≥ getSafeTopMargin()（避开顶部 fixed 视频行）且 bottom ≤ vh - 60（留底部空间）
   */
  function isFullyInSafeView(el) {
    if (!el) return false;
    try {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const safeTop = getSafeTopMargin();
      const safeBottom = vh - 60;
      return rect.top >= safeTop && rect.bottom <= safeBottom;
    } catch (e) {
      return false;
    }
  }

  /** 找最近的可滚动祖先（仅作为"原生 scrollIntoView 不够用时"的兜底使用） */
  function findScrollableAncestor(el) {
    let cur = el && el.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const cs = window.getComputedStyle(cur);
      const oy = cs.overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
          cur.scrollHeight > cur.clientHeight + 1) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return document.scrollingElement || document.documentElement || document.body;
  }

  /** 获取线性题目列表（按列内从上到下拼接） */
  function getLinearList() {
    const cols = getColumns();
    if (cols.length === 0) return getAllQuestionGroups();
    const list = [];
    for (const c of cols) {
      for (const q of getQuestionsInColumn(c)) list.push(q);
    }
    return list;
  }

  /** 获取 group 所在列索引 */
  function getColumnIndexOf(group) {
    const cols = getColumns();
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].contains(group)) return i;
    }
    return -1;
  }

  /** 清除旧聚焦 */
  /** 设置聚焦题目并滚动到可见位置
   *
   * v1.9.36 起：默认所有跳转都走 `scrollIntoSafeView`，避开顶部 fixed 视频行的遮挡
   *   - 之前 safeView 只在"定位未答题"时启用，导致小类别打分/列内打分自动跳下一题时，
   *     落在 fixed 视频行下面被遮住（用户看不见聚焦题）。
   *   - 现在统一安全视图，但加 `isFullyInSafeView()` 短路：
   *     若目标已经完整落在安全可视区内，则跳过滚动（保持当前视口稳定）。
   *
   * 选项：
   *   scroll                - 是否滚动（默认 true）
   *   safeView              - **已废弃但保留**：所有滚动现在都安全，参数被忽略
   *   markAsMissingTarget   - v1.9.29：把目标标记为"定位未答题目标"，用红色强脉冲
   *                           取代蓝色 qlb-focused（视觉最醒目，用户一眼就看到是哪一题）
   */
  function setFocus(group, { scroll = true, safeView = false, markAsMissingTarget = false } = {}) {
    if (!group) return;
    // v1.9.52：诊断日志
    if (window.__QLB_VERBOSE__) {
      try {
        const stack = (new Error()).stack || '';
        const where = stack.split('\n').slice(2, 4).join(' ← ');
        console.log('[QLB] setFocus', { scroll, safeView, markAsMissingTarget, batchActive: !!global.__QLB_BATCH_SCORING__, calledFrom: where });
      } catch (e) {}
    }
    clearFocus();
    if (markAsMissingTarget) {
      group.classList.add(MISSING_TARGET_CLASS);
      // v1.9.56：6 秒兜底自动清除红色脉冲
      // 之前漏掉这一步，导致用户即使答完题、红色脉冲也永久残留
      // scoreOne 已会主动清，这里只是网兜（用户路过没打分时也能淡出）
      clearTimeout(setFocus._missingTimer);
      setFocus._missingTimer = setTimeout(() => {
        try { group.classList.remove(MISSING_TARGET_CLASS); } catch (e) {}
      }, 6000);
    } else {
      group.classList.add(FOCUS_CLASS);
    }
    // v1.9.34：除了 class，再打一个 data 属性作为"跨 React 重渲染的稳定锚点"
    // React 协调通常会保留元素的 data-* 属性，我们用它在打分后重新查回真正活着的节点
    try { group.setAttribute('data-qlb-focus-ref', '1'); } catch (e) {}
    // 让题目容器真正可获得焦点（防止外部 video/按钮吞掉按键事件）
    if (!group.hasAttribute('tabindex')) group.setAttribute('tabindex', '-1');
    try { group.focus({ preventScroll: true }); } catch (e) {}
    state.focusedGroup = group;
    if (scroll) {
      // v1.9.36：统一走安全视图。scrollIntoSafeView 内部自带"已在安全区就跳过"的短路，
      // 因此连续打分（自动跳下一题）时不会抖动；跨屏跳转才会真滚到安全顶。
      scrollIntoSafeView(group);
    }
    // v1.6.9：通知同步滚动模块，以便把对应视频列滚到视频行中心
    try {
      if (global.QLBScrollSync && global.QLBScrollSync.syncByFocusedGroup) {
        global.QLBScrollSync.syncByFocusedGroup();
      }
    } catch (e) {}
  }

  /**
   * v1.9.34：解析当前"真正活着的聚焦题" —— 兼容 React 重渲染丢引用的情况。
   *
   * 优先级：
   *   1. state.focusedGroup 在 DOM 里 → 直接返回
   *   2. 按 data-qlb-focus-ref 属性查询，取第一个活着的节点
   *   3. 依旧找不到 → null（调用方自己决定怎么兜底）
   *
   * 另外：如果找到了新的 DOM 节点（不同于 state.focusedGroup），顺便把
   * state.focusedGroup 更新为活着的那个，以免每次 moveFocus 都要重新走这个流程。
   */
  function resolveActiveFocus() {
    const cur = state.focusedGroup;
    if (cur && document.contains(cur)) return cur;
    // 用 data 属性作为回锚（跨 React 重渲染保留的可能性高）
    const refs = Array.from(document.querySelectorAll('[data-qlb-focus-ref="1"]'));
    const live = refs.find((r) => document.contains(r));
    if (live) {
      state.focusedGroup = live;
      return live;
    }
    return null;
  }

  /**
   * 在线性题目列表里找到给定 group 的 index。
   * 如果引用直接匹配不到（例如 React 重建了节点），回退到用 rect.top 找"几何位置最接近"的题。
   */
  function findIndexInList(list, group) {
    if (!group) return -1;
    let idx = list.indexOf(group);
    if (idx !== -1) return idx;
    // 引用失效 → rect 兜底
    let rect = null;
    try { rect = group.getBoundingClientRect(); } catch (e) {}
    if (!rect || rect.height <= 0) return -1;
    let minDist = Infinity, nearest = -1;
    for (let i = 0; i < list.length; i++) {
      try {
        const r = list[i].getBoundingClientRect();
        const d = Math.abs(r.top - rect.top) + Math.abs((r.left || 0) - (rect.left || 0)) * 0.1;
        if (d < minDist) { minDist = d; nearest = i; }
      } catch (e) {}
    }
    return nearest;
  }

  /** 相对移动
   *  v1.9.34：先 resolve 出活着的 focusedGroup，再查 index；如引用失效走 rect 兜底。
   *  修复"打分后 React 重建节点，导致 moveFocus 跳过中间题目"的 bug。
   *
   *  v1.9.38：新增 `skipAnswered` 选项 —— 跳过"已打过分"的题目（含 `none`）
   *    使用场景：
   *      - 打分自动前进：用户希望"打完这题 → 跳到下一道还没打过的"，
   *        不要停在初始化就被预设为 `none` 的题、也不要停在自己刚改过的题
   *      - 手动 ↓/Tab：行为同上（跳到下一未答）
   *      - 手动 ↑/Shift+Tab：保持普通前进（用于回看），不开启 skipAnswered
   *    保护：若 skipAnswered=true 但**所有题都已答**，退化为普通 +delta 移动，
   *          这样用户起码不会"按 ↓ 没反应"。
   */
  function moveFocus(delta, opts = {}) {
    const { skipAnswered = false } = opts;
    // v1.9.52：诊断日志，打印调用栈，方便定位"开关关了仍然跳"的真实路径
    if (window.__QLB_VERBOSE__) {
      try {
        const stack = (new Error()).stack || '';
        console.log('[QLB] moveFocus called', { delta, skipAnswered, batchActive: !!global.__QLB_BATCH_SCORING__ });
        console.log('[QLB] stack:', stack.split('\n').slice(1, 6).join('\n'));
      } catch (e) {}
    }
    const list = getLinearList();
    if (list.length === 0) return;
    const cur = resolveActiveFocus();
    let idx = cur ? findIndexInList(list, cur) : -1;
    if (idx === -1) idx = 0;

    if (skipAnswered) {
      // 从 (idx + delta) 开始按 delta 方向逐题查找未答题，不绕回（防止从最后一道跳到第一道）
      const step = delta >= 0 ? 1 : -1;
      const N = list.length;
      let i = idx + step;
      let found = -1;
      while (i >= 0 && i < N) {
        if (getCurrentScore(list[i]) === null) { found = i; break; }
        i += step;
      }
      if (found !== -1) {
        setFocus(list[found]);
        return;
      }
      // 同方向找不到未答题：尝试**全局**找首个未答题（覆盖"前面跳过去了，但前面也还有未答"的情形）
      for (let j = 0; j < N; j++) {
        if (getCurrentScore(list[j]) === null) { found = j; break; }
      }
      if (found !== -1) {
        setFocus(list[found]);
        try {
          if (global.QLBMissing && global.QLBMissing.toast) {
            global.QLBMissing.toast('↩ 后面没有未答题了，已跳到首个未答题');
          }
        } catch (e) {}
        return;
      }
      // 全部已答 → 普通 +delta 退化（含绕回，便于用户继续浏览/检查）
      idx = (idx + delta + N) % N;
      setFocus(list[idx]);
      try {
        if (global.QLBMissing && global.QLBMissing.toast) {
          global.QLBMissing.toast('🎉 全部题目已答完');
        }
      } catch (e) {}
      return;
    }

    // 默认：普通 +delta 移动（绕回）
    idx = (idx + delta + list.length) % list.length;
    setFocus(list[idx]);
  }

  /** 切列（保持当前行号，尽量对齐）*/
  function switchColumn(delta) {
    const cols = getColumns();
    if (cols.length <= 1) return;
    const cur = state.focusedGroup;
    let colIdx = cur ? getColumnIndexOf(cur) : 0;
    if (colIdx === -1) colIdx = 0;
    const nextCol = (colIdx + delta + cols.length) % cols.length;
    const nextList = getQuestionsInColumn(cols[nextCol]);
    if (nextList.length === 0) return;
    // 尽量对齐当前行号
    let rowIdx = 0;
    if (cur) {
      const curList = getQuestionsInColumn(cols[colIdx]);
      rowIdx = Math.min(curList.indexOf(cur), nextList.length - 1);
      if (rowIdx < 0) rowIdx = 0;
    }
    setFocus(nextList[rowIdx]);
  }

  /** 跳转到首个未答题（优先打分 radio 组；若全部答完但仍有其它必填字段未填，降级跳到那里） */
  function focusFirstUnanswered() {
    const list = getLinearList();
    for (const g of list) {
      if (getCurrentScore(g) === null) {
        // v1.9.29：跨屏跳转用安全视图 + 红色强脉冲标记（代替蓝框）
        setFocus(g, { safeView: true, markAsMissingTarget: true });
        return g;
      }
    }
    // 所有打分题已答，但可能有其它必填字段（文本/下拉等）还没填
    try {
      const QLBMissing = global.QLBMissing;
      if (QLBMissing && QLBMissing.scanMissingDetailed) {
        const other = QLBMissing.scanMissingDetailed();
        if (other && other.length > 0) {
          QLBMissing.focusField(other[0].el);
          return other[0].el;
        }
      }
    } catch (e) {}
    return null;
  }

  /** 是否应忽略快捷键（真正的文本输入框聚焦时才忽略） */
  function shouldIgnore(e) {
    const t = e.target;
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (t.isContentEditable) return true;
    if (tag === 'input') {
      // 文本类 input 才忽略；radio/checkbox/button 等放行
      const typ = (t.type || 'text').toLowerCase();
      const TEXT_TYPES = ['text', 'search', 'email', 'url', 'password', 'number', 'tel'];
      if (TEXT_TYPES.includes(typ)) return true;
      return false;
    }
    return false;
  }

  /** 键盘处理 */
  function onKeyDown(e) {
    if (!state.prefs.enableShortcuts) {
      if (window.__QLB_KEY_DEBUG__) console.log('[QLB-KEY] 快捷键已禁用');
      return;
    }
    // 质检模式下，让 qa.js 接管快捷键；标注的 1/2/3/4 在那边没意义
    if (global.QLBMode && global.QLBMode.current === 'qa') {
      // 但仍允许若干"全局键"继续走下去
      const isResetCombo = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '0' || e.code === 'Digit0');
      const isPipCombo = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p' || e.code === 'KeyP');
      const isUndoCombo = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ');
      const isHelpKey = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === '?' || e.key === '/' || e.key === '、' || e.key === '\\');
      if (!isResetCombo && !isPipCombo && !isUndoCombo && !isHelpKey) return;
    }
    // 悬浮窗复位：⌘/Ctrl + Shift + 0 —— 即使焦点在输入框里也应响应（拖丢后的救急）
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '0' || e.code === 'Digit0')) {
      e.preventDefault();
      e.stopPropagation();
      if (global.QLBPlayer && global.QLBPlayer.resetPos) global.QLBPlayer.resetPos();
      return;
    }
    // 画中画开关：⌘/Ctrl + Shift + P
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p' || e.code === 'KeyP')) {
      e.preventDefault();
      e.stopPropagation();
      if (global.QLBPlayer && global.QLBPlayer.togglePip) {
        if (global.QLBPlayer.show && !document.getElementById('qlb-player')) global.QLBPlayer.show();
        global.QLBPlayer.togglePip();
      }
      return;
    }
    // v1.9.13：撤销 ⌘/Ctrl + Z —— 撤销最近一次批量打分（标注/质检通用）
    // 注意：在 input/textarea 里仍要让浏览器原生撤销生效（shouldIgnore 在前置判断）
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
      // 在输入框中按 Cmd+Z → 让浏览器处理原生撤销
      if (shouldIgnore(e)) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        let n = 0;
        if (global.QLBMode && global.QLBMode.current === 'qa' && global.QLBQA && global.QLBQA.undoLast) {
          n = global.QLBQA.undoLast();
        } else if (global.QLBScorer && global.QLBScorer.undoLast) {
          n = global.QLBScorer.undoLast();
        }
        if (global.QLBToolbar && global.QLBToolbar.updateProgress) global.QLBToolbar.updateProgress();
        if (global.QLBMissing && global.QLBMissing.toast) {
          global.QLBMissing.toast(n > 0 ? `↶ 已撤销 ${n} 处` : '↶ 没有可撤销的操作');
        }
      } catch (er) {}
      return;
    }
    // v1.9.13：帮助 ?/、键（不需要修饰键，输入框中不响应）
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        (e.key === '?' || e.key === '/' || e.key === '、' || e.key === '\\')) {
      if (shouldIgnore(e)) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        if (global.QLBToolbar && global.QLBToolbar.toggleHelp) global.QLBToolbar.toggleHelp();
      } catch (er) {}
      return;
    }
    // v1.9.70：textarea 内 Cmd/Ctrl+Enter → 跳到下一道未答题
    // 比 Tab 更像"完成本题"语义；不影响普通 Enter 换行
    if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.code === 'Enter')) {
      const tag = ((e.target && e.target.tagName) || '').toLowerCase();
      if (tag === 'textarea' || (e.target && e.target.isContentEditable)) {
        e.preventDefault();
        e.stopPropagation();
        try {
          // 让 textarea 失焦，再跳到下一未答题
          e.target.blur();
          moveFocus(1, { skipAnswered: true });
        } catch (er) {}
        return;
      }
    }
    if (shouldIgnore(e)) {
      if (window.__QLB_KEY_DEBUG__) console.log('[QLB-KEY] 忽略（目标是输入框）', e.target);
      return;
    }
    // 组合键（除 Shift+Tab）不处理
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const k = e.key;
    if (window.__QLB_KEY_DEBUG__) console.log('[QLB-KEY] 按下:', k);
    // v1.9.70：根据当前模板用不同的快捷键映射
    //  - label-aesthetic10：1-9 → 1-9 分；0 / ` / ~ → 10 分
    //  - label-old4 / unknown：1/2/3 → 0/0.5/1 分；` / ~ / 4 → none
    let scoreMap;
    const tpl = (global.QLBMode && global.QLBMode.template) || 'label-old4';
    if (tpl === 'label-aesthetic10') {
      scoreMap = {
        '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
        '6': '6', '7': '7', '8': '8', '9': '9',
        '0': '10', '`': '10', '~': '10'
      };
    } else {
      scoreMap = { '1': '0', '2': '0.5', '3': '1', '`': 'none', '~': 'none', '4': 'none' };
    }
    if (scoreMap[k] !== undefined) {
      // v1.9.34：先 resolve 一下当前活着的聚焦题，兼容 React 重渲染丢引用
      let active = resolveActiveFocus();
      if (!active) {
        // 未聚焦时：优先聚焦"首个未答题"（从断点继续），若全部答完则聚焦首题
        const list = getLinearList();
        if (list.length === 0) return;
        let target = null;
        for (const g of list) {
          if (getCurrentScore(g) === null) { target = g; break; }
        }
        if (!target) target = list[0];
        setFocus(target);
        active = state.focusedGroup;
      }
      if (active) {
        e.preventDefault();
        scoreOne(active, scoreMap[k]);
        // 打完自动跳到"下一道未答题"（v1.9.38）
        // - 跳过初始化就被预设为 none 的题、跳过用户已经打过的题
        // - 后面没未答题则全局找首个未答；都答完则普通 +1 + toast
        moveFocus(1, { skipAnswered: true });
      }
      return;
    }

    switch (k) {
      case 'Tab':
        e.preventDefault();
        // ↓→ 跳下一未答题；↑← 普通后退（便于回看已答题）
        moveFocus(e.shiftKey ? -1 : 1, e.shiftKey ? {} : { skipAnswered: true });
        break;
      case 'ArrowDown':
        e.preventDefault();
        // v1.9.38：与打分自动前进保持一致——跳到下一道未答题
        moveFocus(1, { skipAnswered: true });
        break;
      case 'ArrowUp':
        e.preventDefault();
        // ↑ 保持普通后退（用于回看刚答的题）
        moveFocus(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        switchColumn(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        switchColumn(-1);
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        if (global.QLBMissing) global.QLBMissing.focusNextMissing();
        break;
      case 'Escape':
        clearFocus();
        break;
      default:
        break;
    }
  }

  // 防重处理：同一事件对象只处理一次（window 和 document 都绑了，避免重复）
  const handledEvents = new WeakSet();
  function onKeyDown_safe(e) {
    if (handledEvents.has(e)) return;
    handledEvents.add(e);
    onKeyDown(e);
  }

  /**
   * v1.9.20：标注模式下，用户鼠标点击某题的打分项（label.tea-form-check）时，
   *          把插件的聚焦同步到该题 —— 之后按数字键会从这题继续向下打分，
   *          而不是回到之前的聚焦位置。
   *
   * v1.9.35 彻底重写，解决"点胶囊后焦点级联乱跳"的根本 bug：
   *
   * 问题根因（控制台诊断确认）：
   *   Tea UI 的 label.click() 会让浏览器**自动派发一次 input click 事件**，
   *   这个 input click 事件 **isTrusted === true**（浏览器原生 label→input 激活机制）！
   *   于是 scoreColumn / scoreDimension 里 49 次 label.click() 会产生 49 个
   *   "trusted input click"，每一个都会命中我们的 onPageClick → setFocus + moveFocus
   *   → 焦点级联跳 49 次，最终永远跳到错位置。
   *
   * 修复：
   *   1. 只接受 target 是 label/span/div 的 click（真实用户点击胶囊文字/圆圈时的 target）；
   *      **忽略 INPUT target**（label.click() 副产品）
   *   2. 同时移除"鼠标点分值 → 自动跳下一题"的 setTimeout 行为（v1.9.22 引入的，
   *      副作用多于收益）。用户点分值现在就是"单纯聚焦"，下次按数字键仍作用于该题。
   *      如果想要"跳下一题"，按数字键/Tab/↓ 即可。
   */
  function onPageClick(e) {
    // 仅标注模式生效（质检模式由 qa.js 自己的 onPageClick 处理）
    if (global.QLBMode && global.QLBMode.current === 'qa') return;
    // v1.9.25：脚本合成点击忽略
    if (!e.isTrusted) return;
    // v1.9.51：批量打分（整列/维度胶囊）期间产生的所有 trusted click 一律忽略
    //   原因：scoreMany 内 N 次 label.click() 会派发 N 个 trusted click 事件（target 可能是
    //   LABEL 或 INPUT），它们绕过单点守卫（tagName=INPUT），命中 isScoreClick → 触发自动前进
    //   → 即使用户关了"类别打分跳转"开关也偶尔跳。此处直接 bypass 整个 onPageClick。
    if (global.__QLB_BATCH_SCORING__) {
      if (window.__QLB_VERBOSE__) console.log('[QLB] onPageClick skip: batch scoring active');
      return;
    }
    // 兜底：刚结束批量打分 < 50ms 的 click 也视为 batch 余波
    const lastBatchAt = global.__QLB_LAST_BATCH_AT__ || 0;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (lastBatchAt > 0 && now - lastBatchAt < 50) {
      if (window.__QLB_VERBOSE__) console.log('[QLB] onPageClick skip: too close to last batch click', { dt: now - lastBatchAt });
      return;
    }

    const t = e.target;
    if (!t || !t.closest) return;
    // v1.9.35：忽略 INPUT target —— 这是 label.click() 导致浏览器自动派发的
    // input click 副产品（isTrusted=true 但并非用户直接点击 input）
    if (t.tagName === 'INPUT') return;
    // 跳过插件自己的 UI
    if (t.closest('#qlb-toolbar, #qlb-player, .qlb-col-bar, .qlb-dim-bar, .qlb-modal, .qlb-toast')) return;
    // 找到用户点击的打分题目容器
    const group = t.closest('.cr-radio-group');
    if (!group) return;
    // 必须是标注题（含分值 label），排除质检的"通过/不通过"组
    if (!group.querySelector('label.tea-form-check[name="0"]') &&
        !group.querySelector('label.tea-form-check[name="0.5"]') &&
        !group.querySelector('label.tea-form-check[name="1"]') &&
        !group.querySelector('label.tea-form-check[name="none"]')) return;

    // v1.9.46：检测是否点的是"分值 label"（要触发自动前进）vs 题目空白处（仅同步聚焦）
    //   - label.tea-form-check[name=0|0.5|1|none] → 用户真在打分
    //   - 其他位置（题目文字、行内空白等）→ 仅同步聚焦
    const scoreLabel = t.closest('label.tea-form-check[name]');
    const isScoreClick = !!(scoreLabel &&
      ['0', '0.5', '1', 'none'].includes(scoreLabel.getAttribute('name')) &&
      group.contains(scoreLabel));

    // 同步聚焦（不滚动，避免视口跳）
    if (state.focusedGroup !== group) {
      setFocus(group, { scroll: false });
    }

    // v1.9.46：鼠标点分值打分 → 也跳到下一道未答题（与键盘 1/2/3/4 行为统一）
    //   - 异步 80ms 后再检查：等 Tea UI 把 checked 状态切完
    //   - 仅当点击前后 score 真的发生变化时才前进（避免点同一已选项时也跳）
    //   - skipAnswered: true → 自动跳过已答题（含 none）
    //
    // v1.9.50：批量打分（整列/维度胶囊）期间，scorer.scoreMany 会设置 __QLB_BATCH_SCORING__ flag。
    //   原因：label.click() 派发的原生 click 事件 target 可能是 LABEL（绕过 tagName=INPUT 守卫），
    //   会被 isScoreClick 命中 → 让"类别打分自动跳转"开关失效。这里完全 bypass 自动前进。
    //
    // v1.9.51：双重防御
    //   - 进入 setTimeout 时：再次检查 flag（防御"80ms 内用户立刻又点维度胶囊"的极端时序）
    //   - 进入 setTimeout 时：检查"批量打分 ≤ 200ms 之内"（用 scoreMany 留下的时间戳）
    //   - 加 verbose 日志路径，方便排查
    if (isScoreClick && !global.__QLB_BATCH_SCORING__) {
      const prevScore = getCurrentScore(group);
      // 记录进入时刻，setTimeout 触发时再比对最近一次 batch 的时刻
      const clickStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      setTimeout(() => {
        try {
          // 再次防御：进入 timer 时若仍处于批量打分 / 距上次批量打分 < 250ms，跳过
          if (global.__QLB_BATCH_SCORING__) {
            if (window.__QLB_VERBOSE__) console.log('[QLB] onPageClick advance skip: batch still active');
            return;
          }
          const lastBatchAt = global.__QLB_LAST_BATCH_AT__ || 0;
          if (lastBatchAt > clickStartedAt - 50) {
            // 这次 click 极可能是 batch 派发的合成 click（不是用户真点）
            if (window.__QLB_VERBOSE__) console.log('[QLB] onPageClick advance skip: too close to last batch', { lastBatchAt, clickStartedAt });
            return;
          }
          const curScore = getCurrentScore(group);
          if (curScore === null) return;          // Tea UI 还没切完 → 放弃前进（保守）
          if (curScore === prevScore) return;     // 点的是已选项，无变化 → 不跳
          // 焦点已经在 group 上了，直接前进
          if (window.__QLB_VERBOSE__) console.log('[QLB] onPageClick advance: prev=' + prevScore + ' cur=' + curScore);
          moveFocus(1, { skipAnswered: true });
        } catch (er) {}
      }, 80);
    }
  }

  function init() {
    // 同时在 window 和 document 捕获阶段监听，覆盖率最高
    window.addEventListener('keydown', onKeyDown_safe, true);
    document.addEventListener('keydown', onKeyDown_safe, true);
    // v1.9.20：鼠标点击页面上任何一题的打分项 → 把聚焦同步到该题
    document.addEventListener('click', onPageClick, true);

    // 启动时自动聚焦首道未答题（无需鼠标点击）。质检模式由 qa.js 自己接管聚焦
    setTimeout(() => {
      if (global.QLBMode && global.QLBMode.current === 'qa') return;
      if (state.focusedGroup) return;
      const list = getLinearList();
      if (list.length === 0) return;
      let target = null;
      for (const g of list) {
        if (getCurrentScore(g) === null) { target = g; break; }
      }
      if (target) setFocus(target, { scroll: false });
    }, 600);
  }

  global.QLBNavigator = {
    init,
    setFocus,
    clearFocus,
    moveFocus,
    switchColumn,
    focusFirstUnanswered,
    getLinearList,
    scrollIntoSafeView,
    // v1.9.36：暴露顶部遮挡测量，供 qa.js / scroll-sync.js 等共享
    getTopOcclusion,
    getSafeTopMargin,
    isFullyInSafeView
  };
})(window);
