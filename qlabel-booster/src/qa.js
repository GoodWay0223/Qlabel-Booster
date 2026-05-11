/**
 * qa.js
 * 质检任务专用辅助：
 *   1) 给每个"是否通过"组 → 标题前加序号
 *   2) 快捷键 1=通过 / 2=不通过；选不通过后样式标红
 *   3) 一键全选通过（整页 / 本列）+ 撤销
 *   4) 选了"不通过"后，input 修正分一键填入（0/0.25/0.5/0.75/1/none）
 *   5) 鼠标全屏可横滑（不必滚到底部）
 *   6) 左侧 Prompt / 参考图视频区 sticky 跟随滚动
 *
 * DOM 锚点（由用户实测确认）：
 *   组容器：.cr-radio-group（与标注页同名！但内部 label name 是 "通过"/"不通过"）
 *   通过：label.tea-form-check[name="通过"]
 *   不通过：label.tea-form-check[name="不通过"]
 *   修正分输入框：紧邻该组的同父容器里 input.tea-input[placeholder*="修正值"]
 *   评分列：.cr-container-col--10（一个视频一列，含多个组）
 *   两条横滚轨道：.cr-container-col--18（视频行 / 题目行）—— 与标注页一致
 */
(function (global) {
  'use strict';

  const QA_PASS = '通过';
  const QA_FAIL = '不通过';
  const HL_PASS_CLASS = 'qlb-qa-pass';   // 选了通过 → 绿色淡背景
  const HL_FAIL_CLASS = 'qlb-qa-fail';   // 选了不通过 → 红色淡背景
  const HL_FOCUS_CLASS = 'qlb-qa-focus'; // 当前聚焦"通过/不通过"组 → 蓝色 outline
  const HL_FOCUS_FIX_CLASS = 'qlb-qa-focus-fix'; // 当前聚焦修正分输入（快捷子状态） → 蓝色 outline
  const HL_FIX_MANUAL_CLASS = 'qlb-qa-fix-manual'; // 修正分输入手动子状态 → 橙色 outline + 光标可输入
  const SEQ_CLASS = 'qlb-qa-seq';
  const COLBAR_CLASS = 'qlb-qa-col-bar';

  // 修正分快捷键 → 值映射（也用于胶囊条按钮）
  const FIX_VALUES = ['0', '0.25', '0.5', '0.75', '1', 'none'];
  const FIX_KEY_MAP = {
    '1': '0',
    '2': '0.25',
    '3': '0.5',
    '4': '0.75',
    '5': '1',
    '`': 'none',
    '~': 'none'
  };

  /** 当前质检模式专属状态 */
  const qaState = {
    focusedGroup: null,         // 当前 'pass' 模式聚焦的题目组
    focusedFixInput: null,      // 当前 'fix' 模式聚焦的修正分输入框
    focusMode: 'pass',          // 'pass' | 'fix'
    fixSub: 'shortcut',         // 'shortcut' | 'manual' —— fix 模式的子状态
    undoStack: [],
    booted: false
  };

  // ============== 选择器 ==============

  /** 整页所有 QA 题目组（含"通过/不通过"的 .cr-radio-group） */
  function getAllQaGroups(root = document) {
    return Array.from(root.querySelectorAll('.cr-radio-group'))
      .filter((g) => g.querySelector('label.tea-form-check[name="通过"], label.tea-form-check[name="不通过"]'));
  }

  /** 列容器（.cr-container-col--10），过滤含 QA 组的 */
  function getQaColumns(root = document) {
    return Array.from(root.querySelectorAll('.cr-container-col--10'))
      .filter((c) => c.querySelector('label.tea-form-check[name="通过"]'));
  }

  /** 某列内所有 QA 组 */
  function getQaGroupsInColumn(col) {
    if (!col) return [];
    return Array.from(col.querySelectorAll('.cr-radio-group'))
      .filter((g) => g.querySelector('label.tea-form-check[name="通过"]'));
  }

  /** 一组的当前选中：'通过' / '不通过' / null */
  function getCurrentPass(group) {
    if (!group) return null;
    const pass = group.querySelector('label.tea-form-check[name="通过"]');
    const fail = group.querySelector('label.tea-form-check[name="不通过"]');
    if (isChecked(pass)) return QA_PASS;
    if (isChecked(fail)) return QA_FAIL;
    return null;
  }
  function isChecked(label) {
    if (!label) return false;
    if (label.classList.contains('tea-form-check--checked')) return true;
    if (label.classList.contains('is-checked')) return true;
    if (label.getAttribute('aria-checked') === 'true') return true;
    const inp = label.querySelector('input');
    if (inp && (inp.checked || inp.hasAttribute('checked'))) return true;
    return false;
  }

  /** 一组对应的"修正分输入框"（同父级或邻近行内的 input.tea-input）。
   *  注意：质检页结构是「.cr-container-col--10 整列内 平铺多组 维度标题/radio/修正分」三个 col 一组：
   *    .cr-container-col--16 (维度名 + 平均分)
   *    .cr-container-col--8  (.cr-radio-group 通过/不通过)   ← group 在这里
   *    .cr-container-col--24 (多个 input.tea-input 修正分)
   *  所以"组对应的修正分"应当是 group 所在 col--8 的"下一个 sibling col--24"。
   *  不能简单地 closest('.cr-container-row')，因为那个 row 是整列共用的，会指向第一组的输入。 */
  function getFixInputsForGroup(group) {
    if (!group) return [];
    const col8 = group.closest('.cr-container-col--8');
    if (!col8) {
      // 退化处理
      const row = group.closest('.cr-container-row') || group.parentElement;
      if (!row) return [];
      return Array.from(row.querySelectorAll('input.tea-input[placeholder*="修正值"]'));
    }
    // 下一个 sibling col--24
    let next = col8.nextElementSibling;
    while (next) {
      if (next.classList && next.classList.contains('cr-container-col--24')) {
        return Array.from(next.querySelectorAll('input.tea-input[placeholder*="修正值"]'));
      }
      next = next.nextElementSibling;
    }
    return [];
  }

  function getFixInputForGroup(group) {
    const list = getFixInputsForGroup(group);
    return list[0] || null;
  }

  /** 一组对应的"维度标题"。同样用 col--8 的"上一个 sibling col--16" 内的 .cr-text--bold（非"平均分"那条） */
  function getDimensionTitleEl(group) {
    if (!group) return null;
    const col8 = group.closest('.cr-container-col--8');
    if (!col8) return null;
    let prev = col8.previousElementSibling;
    while (prev) {
      if (prev.classList && prev.classList.contains('cr-container-col--16')) {
        const ps = Array.from(prev.querySelectorAll('p.cr-text--bold'));
        for (const p of ps) {
          const t = (p.textContent || '').trim();
          if (!t) continue;
          if (/平均分/.test(t)) continue;
          if (/^视频\d+-/.test(t)) continue; // 列顶大标题
          return p;
        }
        return null;
      }
      prev = prev.previousElementSibling;
    }
    return null;
  }

  /** 一组的"题目最小完整单元"：col--16 (维度) + col--8 (radio) + col--24 (修正分) 的共同父级范围。
   *  返回一个数组，包含这三个 col 元素，用于添加聚焦/不通过高亮。 */
  function getGroupUnitParts(group) {
    if (!group) return [];
    const col8 = group.closest('.cr-container-col--8');
    if (!col8) return [group];
    const parts = [col8];
    let prev = col8.previousElementSibling;
    while (prev) {
      if (prev.classList && prev.classList.contains('cr-container-col--16')) {
        parts.unshift(prev);
        break;
      }
      prev = prev.previousElementSibling;
    }
    let next = col8.nextElementSibling;
    while (next) {
      if (next.classList && next.classList.contains('cr-container-col--24')) {
        parts.push(next);
        break;
      }
      next = next.nextElementSibling;
    }
    return parts;
  }

  // ============== 选/改：通过 / 不通过 ==============

  /** 触发 label 点击 + 处理 readonly Tea 控件（用 dispatchEvent 兜底） */
  function clickLabel(label) {
    if (!label) return false;
    try {
      label.click();
      // Tea 的 input 是 readonly 的，但点击 label 已能切换状态；保险再触发一次
      const inp = label.querySelector('input');
      if (inp && !inp.checked) {
        inp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      return true;
    } catch (e) { return false; }
  }

  /** 单组设置 通过/不通过；返回 {changed, prevPass} */
  function setPass(group, pass) {
    if (!group) return { changed: false, prevPass: null };
    const prev = getCurrentPass(group);
    if (prev === pass) return { changed: false, prevPass: prev };
    const target = group.querySelector(`label.tea-form-check[name="${pass}"]`);
    if (!target) return { changed: false, prevPass: prev };
    clickLabel(target);
    // v1.9.56：质检题打分成功后立刻清掉该题及其单元的红色脉冲（"已答完，不再算 missing"）
    // v1.9.57：扩展到同时清 missing-highlight（全员红框）和 missing-target（首题强脉冲）
    try {
      const RED = ['qlb-missing-target', 'qlb-missing-highlight'];
      const parts = getGroupUnitParts(group);
      parts.forEach((el) => RED.forEach((c) => el.classList.remove(c)));
      RED.forEach((c) => group.classList.remove(c));
    } catch (e) {}
    return { changed: true, prevPass: prev };
  }

  /** 批量设置 + 撤销栈 */
  function setPassMany(groups, pass, opLabel = '批量') {
    const snap = [];
    let changed = 0;
    for (const g of groups) {
      const r = setPass(g, pass);
      if (r.changed) {
        snap.push({ group: g, prevPass: r.prevPass });
        changed++;
      }
    }
    if (snap.length > 0) {
      qaState.undoStack.push({ label: opLabel, items: snap, ts: Date.now() });
      if (qaState.undoStack.length > 20) qaState.undoStack.shift();
    }
    refreshPassHighlights();
    return changed;
  }

  function passAll() {
    return setPassMany(getAllQaGroups(), QA_PASS, '全选 通过');
  }
  function failAll() {
    return setPassMany(getAllQaGroups(), QA_FAIL, '全选 不通过');
  }
  function passColumn(col) {
    return setPassMany(getQaGroupsInColumn(col), QA_PASS, '本列 通过');
  }
  function failColumn(col) {
    return setPassMany(getQaGroupsInColumn(col), QA_FAIL, '本列 不通过');
  }
  function undoLast() {
    const op = qaState.undoStack.pop();
    if (!op) return 0;
    let ok = 0;
    for (const item of op.items) {
      const { group, prevPass } = item;
      if (!prevPass) continue; // 之前未答，无法恢复"未答"态
      const target = group.querySelector(`label.tea-form-check[name="${prevPass}"]`);
      if (target) { clickLabel(target); ok++; }
    }
    refreshPassHighlights();
    return ok;
  }

  // ============== 修正分输入（Tea readonly input 友好写法） ==============

  /** 给 React/Tea 的 readonly input 写值：去掉 readonly → 用原生 setter → 派发 input/change 事件 */
  function setReactInputValue(input, val) {
    if (!input) return false;
    try {
      const wasReadonly = input.hasAttribute('readonly');
      if (wasReadonly) input.removeAttribute('readonly');
      const proto = Object.getPrototypeOf(input);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value') &&
        Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (setter) setter.call(input, String(val));
      else input.value = String(val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // 失焦让 Tea 触发 onBlur 校验（部分场景需要）
      try { input.blur(); } catch (e) {}
      if (wasReadonly) input.setAttribute('readonly', '');
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 给某组的修正分输入框写一个值 */
  function setFixValue(group, val) {
    const inp = getFixInputForGroup(group);
    if (!inp) return false;
    return setReactInputValue(inp, val);
  }

  // ============== 通过绿色 / 不通过红色 淡色背景 ==============

  function refreshPassHighlights() {
    document.querySelectorAll('.' + HL_PASS_CLASS).forEach((el) => el.classList.remove(HL_PASS_CLASS));
    document.querySelectorAll('.' + HL_FAIL_CLASS).forEach((el) => el.classList.remove(HL_FAIL_CLASS));
    getAllQaGroups().forEach((g) => {
      const v = getCurrentPass(g);
      if (v === QA_PASS) {
        getGroupUnitParts(g).forEach((el) => el.classList.add(HL_PASS_CLASS));
      } else if (v === QA_FAIL) {
        getGroupUnitParts(g).forEach((el) => el.classList.add(HL_FAIL_CLASS));
      }
    });
  }

  // ============== 序号注入 ==============

  let lastSeqInjectKey = '';
  function injectSequenceNumbers() {
    // 按"列 → 组顺序"打全局序号；保留 col 内 1..N 与全局 X 两个标签
    const cols = getQaColumns();
    let globalIdx = 0;
    cols.forEach((col, ci) => {
      const groups = getQaGroupsInColumn(col);
      groups.forEach((g, gi) => {
        globalIdx++;
        const titleEl = getDimensionTitleEl(g);
        if (!titleEl) return;
        let seq = titleEl.querySelector(':scope > .' + SEQ_CLASS);
        if (!seq) {
          seq = document.createElement('span');
          seq.className = SEQ_CLASS;
          titleEl.insertBefore(seq, titleEl.firstChild);
        }
        seq.textContent = `#${gi + 1} `;
        seq.title = `本列第 ${gi + 1} 题 / 全局第 ${globalIdx} 题`;
      });
    });
    lastSeqInjectKey = `${cols.length}-${globalIdx}`;
  }

  // ============== 列顶"本列全通过"按钮 + 进度 ==============

  function injectColumnBars() {
    const cols = getQaColumns();
    cols.forEach((col, idx) => {
      if (col.querySelector(':scope > .' + COLBAR_CLASS)) return;
      // 把标注模式可能误注入的 .qlb-col-bar（打分胶囊）移除，避免两套混杂
      col.querySelectorAll(':scope > .qlb-col-bar').forEach((el) => el.remove());

      const bar = document.createElement('div');
      bar.className = COLBAR_CLASS + ' qlb-col-bar';
      bar.innerHTML = `
        <span class="qlb-col-bar__label">视频${idx + 1} 本列：</span>
        <button class="qlb-pill qlb-qa-pill--pass" data-act="pass">全部通过</button>
        <button class="qlb-pill qlb-qa-pill--fail" data-act="fail">全部不通过</button>
        <span class="qlb-qa-col-stats" data-stats="1"></span>
      `;
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'pass') setPassMany(getQaGroupsInColumn(col), QA_PASS, `视频${idx + 1} 全通过`);
        else if (act === 'fail') setPassMany(getQaGroupsInColumn(col), QA_FAIL, `视频${idx + 1} 全不通过`);
      });
      col.insertBefore(bar, col.firstChild);
    });
    refreshColumnStats();
  }

  function refreshColumnStats() {
    const cols = getQaColumns();
    cols.forEach((col) => {
      const bar = col.querySelector(':scope > .' + COLBAR_CLASS);
      if (!bar) return;
      const stat = bar.querySelector('[data-stats]');
      if (!stat) return;
      const groups = getQaGroupsInColumn(col);
      let pass = 0, fail = 0, none = 0;
      groups.forEach((g) => {
        const v = getCurrentPass(g);
        if (v === QA_PASS) pass++;
        else if (v === QA_FAIL) fail++;
        else none++;
      });
      stat.innerHTML = `<span style="color:#16a34a">通过 ${pass}</span> · <span style="color:#dc2626">不通过 ${fail}</span> · <span style="color:#6b7280">未答 ${none}</span>`;
    });
  }

  // ============== 修正分胶囊按钮（常驻在每个修正分输入框旁） ==============

  const FIX_BAR_CLASS = 'qlb-qa-fix-bar';
  const INPUT_HOOKED = '__qlbFixHooked';

  /** 根据修正分 input 找到它所属的题目组（.cr-radio-group） */
  function findGroupForFixInput(input) {
    if (!input) return null;
    const col24 = input.closest('.cr-container-col--24');
    if (!col24) return null;
    let prev = col24.previousElementSibling;
    while (prev) {
      if (prev.classList && prev.classList.contains('cr-container-col--8')) {
        return prev.querySelector('.cr-radio-group');
      }
      prev = prev.previousElementSibling;
    }
    return null;
  }

  /** 给 input 挂上"鼠标点击 → 进入手动模式"的监听（幂等） */
  function hookFixInput(input) {
    if (!input || input[INPUT_HOOKED]) return;
    input[INPUT_HOOKED] = true;
    // 鼠标点击：进入手动模式
    input.addEventListener('mousedown', () => {
      const grp = findGroupForFixInput(input);
      if (grp) qaState.focusedGroup = grp;
      // 异步进入手动模式（让浏览器先把 mousedown 自然处理完，再去 focus + 改 readonly）
      setTimeout(() => setFixFocus(input, { manual: true, scroll: false }), 0);
    });
    // 当用户在 input 失焦后（点别处或 Tab 出去），如果还处于手动子状态 → 自动切回快捷
    input.addEventListener('blur', () => {
      if (qaState.focusedFixInput === input && qaState.fixSub === 'manual') {
        // 把 readonly 加回来，避免 Tea 状态错乱
        if (!input.hasAttribute('readonly')) input.setAttribute('readonly', '');
        const ctrl = input.closest('.cr-input') || input.parentElement;
        if (ctrl) ctrl.classList.remove(HL_FIX_MANUAL_CLASS);
        qaState.fixSub = 'shortcut';
      }
    });
  }

  /** 给一个修正分输入框注入"快捷打分胶囊条"。重复调用是幂等的。 */
  function injectFixBarFor(input) {
    if (!input) return;
    hookFixInput(input);
    // 找输入框的"helper"行（站点的 .cr-input__helper 或者直接在父 cr-input 内）
    const ctrl = input.closest('.cr-input') || input.parentElement;
    if (!ctrl) return;
    if (ctrl.querySelector(':scope > .' + FIX_BAR_CLASS)) return;
    const bar = document.createElement('div');
    bar.className = FIX_BAR_CLASS;
    bar.innerHTML = FIX_VALUES.map((v) => {
      // 与标注模式一致的色阶 class：v 中 . 替换为 _ 用作 class 后缀
      const cls = `qlb-qa-fix-pill--v${String(v).replace('.', '_')}`;
      return `<button class="qlb-qa-fix-pill ${cls}" data-v="${v}" title="一键填入 ${v}">${v}</button>`;
    }).join('');
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      setReactInputValue(input, b.dataset.v);
      // 短暂高亮
      b.classList.add('qlb-qa-fix-pill--just-clicked');
      setTimeout(() => b.classList.remove('qlb-qa-fix-pill--just-clicked'), 600);
      // 鼠标点胶囊 = 走快捷模式 + 自动跳下一项
      qaState.focusedFixInput = input;
      qaState.focusMode = 'fix';
      qaState.fixSub = 'shortcut';
      const grp = findGroupForFixInput(input);
      if (grp) qaState.focusedGroup = grp;
      setTimeout(() => moveFixFocus(1), 150);
    });
    ctrl.appendChild(bar);
  }

  /** 给页面所有修正分输入框补胶囊条（DOM 增量时调用） */
  function injectAllFixBars() {
    document.querySelectorAll('input.tea-input[placeholder*="修正值"]').forEach(injectFixBarFor);
  }

  /** 关掉所有胶囊条（teardown 用） */
  function removeAllFixBars() {
    document.querySelectorAll('.' + FIX_BAR_CLASS).forEach((el) => el.remove());
  }

  // ============== 聚焦 / 导航 ==============

  function getLinearList() {
    const cols = getQaColumns();
    if (cols.length === 0) return getAllQaGroups();
    const list = [];
    for (const c of cols) for (const g of getQaGroupsInColumn(c)) list.push(g);
    return list;
  }

  /** 清除所有"当前聚焦"高亮（pass + fix 两种） */
  function clearFocusHighlights() {
    document.querySelectorAll('.' + HL_FOCUS_CLASS).forEach((el) => el.classList.remove(HL_FOCUS_CLASS));
    document.querySelectorAll('.' + HL_FOCUS_FIX_CLASS).forEach((el) => el.classList.remove(HL_FOCUS_FIX_CLASS));
    // v1.9.29：顺带清掉定位未答题的红色强脉冲标记
    document.querySelectorAll('.qlb-missing-target').forEach((el) => el.classList.remove('qlb-missing-target'));
    // v1.9.34：清 data 锚点
    document.querySelectorAll('[data-qlb-focus-ref]').forEach((el) => {
      try { el.removeAttribute('data-qlb-focus-ref'); } catch (e) {}
    });
    document.querySelectorAll('.' + HL_FIX_MANUAL_CLASS).forEach((el) => el.classList.remove(HL_FIX_MANUAL_CLASS));
    // 上一次手动模式留下的可编辑 input 重新加回 readonly，避免 React 状态错乱
    document.querySelectorAll('input.tea-input[placeholder*="修正值"]').forEach((inp) => {
      if (!inp.hasAttribute('readonly')) inp.setAttribute('readonly', '');
    });
  }

  /**
   * 自适应滚动：把目标元素放到"视口安全区"内可见。
   * v1.9.26：优先复用 QLBNavigator.scrollIntoSafeView（那边实现更强，
   * 能探测多种 sticky 容器并应用更紧的缓冲偏移）。
   * 本地实现作为备用（QLBNavigator 未加载时兜底）。
   *
   * v1.9.36：本地兜底也升级为"动态测顶部 fixed/sticky 遮挡"
   *   旧版只查 `.cr-container-col--18`（内层视频列容器），
   *   但真正的 fixed 遮挡是 `.cr-container-col--24`（页面顶部视频行容器，z-index=88）。
   *   现在通用扫描所有 fixed/sticky 顶部宽元素，取最大 bottom 作为安全顶。
   */
  function scrollIntoSafeView(el) {
    if (!el) return;
    // 优先用通用版
    if (global.QLBNavigator && typeof global.QLBNavigator.scrollIntoSafeView === 'function') {
      global.QLBNavigator.scrollIntoSafeView(el);
      return;
    }
    // 备用：本地实现（与 QLBNavigator 的核心算法等价）
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    let topReserved = 0;
    try {
      // 扫所有 fixed/sticky 顶部宽元素，取最大 bottom
      document.querySelectorAll('div, header, section, nav').forEach((node) => {
        if (node.id === 'qlb-toolbar' || node.id === 'qlb-player' || node.id === 'qlb-toast' ||
            (node.classList && (node.classList.contains('qlb-modal') || node.classList.contains('qlb-bar')))) return;
        const cs = window.getComputedStyle(node);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
        const r = node.getBoundingClientRect();
        if (r.top > 200 || r.bottom <= 0) return;
        if (r.width <= vw * 0.4) return;
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (parseFloat(cs.opacity || '1') < 0.05) return;
        if (r.bottom > topReserved) topReserved = r.bottom;
      });
    } catch (e) {}
    const safeTop = Math.max(4, topReserved + 12);
    const safeBottom = vh - 60;
    if (rect.top >= safeTop && rect.bottom <= safeBottom) return;
    const targetTop = safeTop;
    const delta = rect.top - targetTop;
    try {
      window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
    } catch (e) {
      window.scrollBy(0, delta);
    }
  }

  /** 进入 'pass' 模式：聚焦某题的"通过/不通过"组
   *  v1.9.29：新增 opts.markAsMissingTarget —— 定位未答题场景，
   *  除 HL_FOCUS_CLASS 蓝色框外额外加 .qlb-missing-target 红色强脉冲（最醒目） */
  function setFocus(group, opts = {}) {
    if (!group) return;
    clearFocusHighlights();
    qaState.focusedGroup = group;
    qaState.focusedFixInput = null;
    qaState.focusMode = 'pass';
    // v1.9.34：data 锚点，跨 React 重渲染稳定定位
    try { group.setAttribute('data-qlb-focus-ref', '1'); } catch (e) {}
    const parts = getGroupUnitParts(group);
    if (opts.markAsMissingTarget) {
      parts.forEach((el) => el.classList.add('qlb-missing-target'));
      // v1.9.56：6 秒兜底自动清除红色脉冲
      clearTimeout(setFocus._missingTimer);
      setFocus._missingTimer = setTimeout(() => {
        parts.forEach((el) => {
          try { el.classList.remove('qlb-missing-target'); } catch (e) {}
        });
      }, 6000);
    } else {
      parts.forEach((el) => el.classList.add(HL_FOCUS_CLASS));
    }
    if (opts.scroll !== false) {
      // 用题目最右段（col--24，含修正分）作为整体 → 这样用户能看到"维度名+radio+修正分"完整一题
      // 但实际滚动锚点用 col--16（最左段，含维度名），让题目从最上方进入
      const radioCol = group.closest('.cr-container-col--8') || group;
      const dimCol = (() => {
        let p = radioCol && radioCol.previousElementSibling;
        while (p) {
          if (p.classList && p.classList.contains('cr-container-col--16')) return p;
          p = p.previousElementSibling;
        }
        return null;
      })();
      scrollIntoSafeView(dimCol || radioCol);
    }
    // 联动横向滚动
    try {
      if (global.QLBScrollSync && global.QLBScrollSync.syncByFocusedGroup) {
        global.QLBState && global.QLBState.state && (global.QLBState.state.focusedGroup = group);
        global.QLBScrollSync.syncByFocusedGroup();
      }
    } catch (e) {}
  }

  /**
   * 进入 'fix' 模式（快捷子状态）：聚焦某个修正分输入框
   * - 默认子状态：'shortcut' —— input 保持 readonly，不 focus，不闪光标，键盘 1~5/~ 走快捷打分
   * - 用户按 Enter 或鼠标点 input → 进入 'manual' 子状态（见 enterManualFix）
   *
   * opts.manual === true 时直接进入手动模式
   */
  function setFixFocus(input, opts = {}) {
    if (!input) return;
    clearFocusHighlights();
    qaState.focusedFixInput = input;
    qaState.focusMode = 'fix';
    qaState.fixSub = opts.manual ? 'manual' : 'shortcut';
    const ctrl = input.closest('.cr-input') || input.parentElement;
    if (ctrl) {
      ctrl.classList.add(HL_FOCUS_FIX_CLASS);
      if (qaState.fixSub === 'manual') ctrl.classList.add(HL_FIX_MANUAL_CLASS);
    }
    if (opts.scroll !== false) {
      scrollIntoSafeView(ctrl || input);
    }
    if (qaState.fixSub === 'manual') {
      // 手动模式：去 readonly + 浏览器原生 focus → 光标进入输入框
      try {
        input.removeAttribute('readonly');
        input.focus({ preventScroll: true });
        // 把光标放到末尾（方便用户继续键入或全选清空）
        const v = input.value || '';
        input.setSelectionRange(v.length, v.length);
      } catch (e) {}
    } else {
      // 快捷模式：保持 readonly，并主动 blur，避免上一次手动模式残留的焦点
      try {
        input.setAttribute('readonly', '');
        input.blur();
      } catch (e) {}
    }
  }

  /** 切换当前 fix 输入框为「手动模式」（用户按 Enter 或鼠标点击触发） */
  function enterManualFix() {
    const input = qaState.focusedFixInput;
    if (!input) return;
    qaState.fixSub = 'manual';
    const ctrl = input.closest('.cr-input') || input.parentElement;
    if (ctrl) ctrl.classList.add(HL_FIX_MANUAL_CLASS);
    try {
      input.removeAttribute('readonly');
      input.focus({ preventScroll: true });
      const v = input.value || '';
      input.setSelectionRange(v.length, v.length);
    } catch (e) {}
  }

  /** v1.9.62：质检模式是否在打"通过"后自动跳下一题
   *  受 toolbar 上的"维度打分后自动跳转"开关控制（与标注模式同一开关）。
   *  默认关闭：打完保持当前焦点，用户自己决定是否前进。 */
  function qaShouldAdvance() {
    try {
      return global.QLBState && global.QLBState.state &&
             global.QLBState.state.prefs &&
             global.QLBState.state.prefs.advanceAfterDimension === true;
    } catch (e) { return false; }
  }

  function moveFocus(delta) {
    const list = getLinearList();
    if (list.length === 0) return;
    // v1.9.34：若 qaState.focusedGroup 已脱离 DOM（React 重建），
    // 先用 data 锚点 / rect 兜底找到"现在活着的对应题"
    let cur = qaState.focusedGroup;
    if (cur && !document.contains(cur)) {
      const ref = document.querySelector('[data-qlb-focus-ref="1"]');
      cur = ref || null;
    }
    let idx = cur ? list.indexOf(cur) : -1;
    if (idx === -1 && qaState.focusedGroup) {
      // rect 兜底
      try {
        const r = qaState.focusedGroup.getBoundingClientRect();
        if (r.height > 0) {
          let minD = Infinity, near = -1;
          list.forEach((g, i) => {
            const gr = g.getBoundingClientRect();
            const d = Math.abs(gr.top - r.top) + Math.abs(gr.left - r.left) * 0.1;
            if (d < minD) { minD = d; near = i; }
          });
          idx = near;
        }
      } catch (e) {}
    }
    if (idx === -1) idx = 0;
    else idx = (idx + delta + list.length) % list.length;
    setFocus(list[idx]);
  }

  /** fix 模式下：在当前题目的修正分输入序列里前进 */
  function moveFixFocus(delta) {
    if (!qaState.focusedGroup) return;
    const inputs = getFixInputsForGroup(qaState.focusedGroup);
    if (inputs.length === 0) {
      // 当前题目没有修正分输入 → 直接跳下一题，回到 pass 模式
      moveFocus(1);
      return;
    }
    const cur = qaState.focusedFixInput;
    let idx = cur ? inputs.indexOf(cur) : -1;
    if (idx === -1) idx = 0;
    else idx += delta;
    if (idx >= inputs.length) {
      // 当前题目所有修正分都填完 → 跳下一题的 pass 模式
      moveFocus(1);
      return;
    }
    if (idx < 0) idx = 0;
    setFixFocus(inputs[idx]);
  }

  function switchColumn(delta) {
    const cols = getQaColumns();
    if (cols.length <= 1) return;
    const cur = qaState.focusedGroup;
    let colIdx = 0;
    if (cur) {
      for (let i = 0; i < cols.length; i++) if (cols[i].contains(cur)) { colIdx = i; break; }
    }
    const next = (colIdx + delta + cols.length) % cols.length;
    const nextList = getQaGroupsInColumn(cols[next]);
    if (nextList.length === 0) return;
    let row = 0;
    if (cur) {
      const curList = getQaGroupsInColumn(cols[colIdx]);
      row = Math.min(Math.max(0, curList.indexOf(cur)), nextList.length - 1);
    }
    setFocus(nextList[row]);
  }

  function focusFirstUnanswered() {
    const list = getLinearList();
    for (const g of list) if (getCurrentPass(g) === null) { setFocus(g); return g; }
    return null;
  }

  // ============== 键盘 ==============

  function shouldIgnore(e) {
    const t = e.target;
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (t.isContentEditable) return true;
    if (tag === 'input') {
      const typ = (t.type || 'text').toLowerCase();
      if (['text', 'search', 'email', 'url', 'password', 'number', 'tel'].includes(typ)) {
        // 修正分输入框：在 fix 模式下要劫持快捷键
        if (t.placeholder && /修正值/.test(t.placeholder)) return false;
        return true;
      }
      return false;
    }
    return false;
  }

  /** 把当前选中的修正分输入框填入指定值，并前进到下一项 */
  function fillCurrentFixAndAdvance(val) {
    const inp = qaState.focusedFixInput;
    if (!inp) return;
    setReactInputValue(inp, val);
    moveFixFocus(1);
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const k = e.key;

    // ============== fix 模式 ==============
    if (qaState.focusMode === 'fix' && qaState.focusedFixInput) {
      // 通用：Esc 退出 fix → 回 pass 模式（当前题）
      if (k === 'Escape') {
        e.preventDefault();
        if (qaState.focusedGroup) setFocus(qaState.focusedGroup);
        return;
      }
      // 通用：左右切列
      if (k === 'ArrowRight') { e.preventDefault(); switchColumn(1); return; }
      if (k === 'ArrowLeft') { e.preventDefault(); switchColumn(-1); return; }

      // ====== 手动子状态：让用户自由键入数字 ======
      if (qaState.fixSub === 'manual') {
        // Enter = 提交并跳下一项（自动回到快捷子状态）
        if (k === 'Enter') {
          e.preventDefault();
          // 把当前 input.value 用 React-friendly 方式提交一次（确保 onChange 被触发）
          try {
            const inp = qaState.focusedFixInput;
            const val = (inp.value || '').trim();
            if (val) setReactInputValue(inp, val);
          } catch (er) {}
          moveFixFocus(1);
          return;
        }
        // Tab / 方向键 = 跳下一项（不强制提交，让浏览器原生 blur 即可）
        if (k === 'Tab') { e.preventDefault(); moveFixFocus(e.shiftKey ? -1 : 1); return; }
        if (k === 'ArrowDown') { e.preventDefault(); moveFixFocus(1); return; }
        if (k === 'ArrowUp') { e.preventDefault(); moveFixFocus(-1); return; }
        // 其他所有键全部放行 → 用户能自由打 0.14 等数字
        return;
      }

      // ====== 快捷子状态：1/2/3/4/5/~ 直接打分 ======
      if (FIX_KEY_MAP[k] !== undefined) {
        e.preventDefault();
        fillCurrentFixAndAdvance(FIX_KEY_MAP[k]);
        return;
      }
      if (k === 'Tab') { e.preventDefault(); moveFixFocus(e.shiftKey ? -1 : 1); return; }
      if (k === 'ArrowDown') { e.preventDefault(); moveFixFocus(1); return; }
      if (k === 'ArrowUp') { e.preventDefault(); moveFixFocus(-1); return; }
      // Enter = 切换到手动模式，让用户手打具体数值
      if (k === 'Enter') {
        e.preventDefault();
        enterManualFix();
        return;
      }
      // 其他键放行
      return;
    }

    // 非 fix 模式下，输入框聚焦时不劫持
    if (shouldIgnore(e)) return;

    // pass 模式：1=通过 / 2=不通过
    if (k === '1' || k === '2') {
      if (!qaState.focusedGroup) {
        focusFirstUnanswered() || (getLinearList()[0] && setFocus(getLinearList()[0]));
      }
      const g = qaState.focusedGroup;
      if (!g) return;
      e.preventDefault();
      if (k === '1') {
        // 通过 → 题目变绿
        setPassMany([g], QA_PASS, '单题 通过');
        // v1.9.62：是否自动跳下一题受 advanceAfterDimension 开关控制（默认关闭）
        // 与标注模式一致：用户偏好"打完保持当前焦点"，避免视口跳动
        if (qaShouldAdvance()) moveFocus(1);
      } else {
        // 不通过 → 进入 fix 模式，聚焦该题第一个修正分
        setPassMany([g], QA_FAIL, '单题 不通过');
        const inputs = getFixInputsForGroup(g);
        if (inputs.length > 0) {
          setFixFocus(inputs[0]);
        } else {
          // 无修正分（理论上不会）→ 直接跳下一题
          moveFocus(1);
        }
      }
      return;
    }

    // pass 模式导航
    switch (k) {
      case 'Tab':
        e.preventDefault();
        moveFocus(e.shiftKey ? -1 : 1);
        break;
      case 'ArrowDown': e.preventDefault(); moveFocus(1); break;
      case 'ArrowUp': e.preventDefault(); moveFocus(-1); break;
      case 'ArrowRight': e.preventDefault(); switchColumn(1); break;
      case 'ArrowLeft': e.preventDefault(); switchColumn(-1); break;
      case 'Escape':
        qaState.focusedGroup = null;
        clearFocusHighlights();
        break;
    }
  }

  const handled = new WeakSet();
  function onKeyDownSafe(e) {
    if (handled.has(e)) return;
    handled.add(e);
    onKeyDown(e);
  }

  /**
   * 全局点击：用户用鼠标点了某题的"通过/不通过" → 把键盘聚焦同步到该题。
   * 这样后续按 1/2/3 等快捷键能从用户点击的位置继续。
   *
   * v1.9.22：与标注模式统一"鼠标点完分就跳下一题"的体验：
   *   - 点"通过" → 当前题染绿 → 聚焦移到下一题（紧接着按 1/2 给下一题打分）
   *   - 点"不通过" → 依旧进入 fix 模式，聚焦到第一个修正分输入（原有行为不变）
   *
   * 注意：插件自己的胶囊条点击和列顶批量按钮点击不要被这里再处理一次。
   */
  function onPageClick(e) {
    // v1.9.25：只响应真实鼠标点击，忽略脚本合成点击
    if (!e.isTrusted) return;
    const t = e.target;
    if (!t || !t.closest) return;
    // v1.9.35：忽略 INPUT target —— Tea UI 的 label.click() 会让浏览器自动派发一次
    // input click 事件（isTrusted=true 但并非用户直接点击 input），不能当成真实用户操作。
    if (t.tagName === 'INPUT') return;
    // 跳过插件自己的 UI（工具栏 / 胶囊条 / 列顶 bar）
    if (
      t.closest('#qlb-toolbar') ||
      t.closest('.qlb-qa-fix-bar') ||
      t.closest('.qlb-qa-col-bar') ||
      t.closest('.qlb-qa-fix-pop') ||
      t.closest('#qlb-player')
    ) return;
    // 找点击位置最近的"通过/不通过" label
    const label = t.closest('label.tea-form-check[name="通过"], label.tea-form-check[name="不通过"]');
    if (!label) return;
    // 它所属的题目组
    const group = label.closest('.cr-radio-group');
    if (!group) return;
    const isFail = label.getAttribute('name') === QA_FAIL;
    // 先聚焦到这道题（进 pass 模式，不滚动，用户刚点的位置已在视野内）
    setFocus(group, { scroll: false });
    // 等浏览器原生 click 把 Tea radio 的 checked 状态切完后再处理
    setTimeout(() => {
      refreshPassHighlights();
      refreshColumnStats();
      if (isFail) {
        // 不通过 → 进 fix 模式，聚焦第一个修正分输入（保持原体验）
        const inputs = getFixInputsForGroup(group);
        if (inputs.length > 0) setFixFocus(inputs[0], { scroll: true });
      } else {
        // 通过 → 与按键 1 行为一致：受 advanceAfterDimension 开关控制是否跳下一题
        if (qaShouldAdvance()) moveFocus(1);
      }
    }, 60);
  }

  // ============== 鼠标横滑：已抽到通用模块 wheel-pan.js，这里不再单独实现 ==============

  // ============== 左侧 Prompt / 参考图视频区 就地 sticky ==============
  // 思路：Prompt 列就在题目轨道（第 2 个 .cr-container-col--18）的 row 里第一个子节点（class='cr-container-col--18'）。
  // 直接给它设 position: sticky + top:12px + align-self:flex-start。
  // 同时把它沿祖先链上的 overflow:hidden 临时改掉（sticky 失效常见原因）。
  // 监控 DOM 变化时如果 React 重渲染丢了我们的 inline style，重新应用。

  let promptCol = null;

  function findPromptColSticky() {
    // 题目轨道 = 含 [name="通过"] 的那个外层 .cr-container-col--18
    const tracks = Array.from(document.querySelectorAll('.cr-container-col--18'))
      .filter((c) => c.querySelector('label.tea-form-check[name="通过"]'));
    if (tracks.length === 0) return null;
    const qTrack = tracks[0];
    // 第一行（横滚 row）的第一个子节点
    const row = qTrack.querySelector(':scope > .cr-container-row');
    if (!row) return null;
    const firstCol = row.firstElementChild;
    if (!firstCol) return null;
    // 必须含 Prompt / 参考图字样
    const txt = (firstCol.textContent || '').slice(0, 600);
    if (!/Prompt|参考图|参考视频|提示词/i.test(txt)) return null;
    return firstCol;
  }

  function applyPromptSticky() {
    const col = findPromptColSticky();
    if (!col) return false;
    promptCol = col;
    // sticky 三件套
    col.style.position = 'sticky';
    col.style.top = '12px';
    col.style.alignSelf = 'flex-start';
    col.style.zIndex = '5';
    col.classList.add('qlb-qa-sticky-prompt');
    // 给它的祖先链解除 overflow: hidden（sticky 失效常因）
    let p = col.parentElement;
    let depth = 0;
    while (p && p !== document.body && depth < 6) {
      const cs = window.getComputedStyle(p);
      if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
        if (!p.dataset.qlbStickyPatched) {
          p.dataset.qlbStickyPatched = '1';
          p.dataset.qlbOverflow = p.style.overflow || '';
          p.dataset.qlbOverflowY = p.style.overflowY || '';
          // 改为 visible 让 sticky 生效；但这条 col--18 自己需要保留 overflow-x 横滚
          if (p.classList.contains('cr-container-col--18')) {
            // 不改 cr-container-col--18 的 overflow（横滚要的）
          } else {
            p.style.overflowY = 'visible';
          }
        }
      }
      p = p.parentElement;
      depth++;
    }
    return true;
  }

  function removePromptSticky() {
    if (promptCol) {
      promptCol.style.position = '';
      promptCol.style.top = '';
      promptCol.style.alignSelf = '';
      promptCol.style.zIndex = '';
      promptCol.classList.remove('qlb-qa-sticky-prompt');
    }
    document.querySelectorAll('[data-qlb-sticky-patched]').forEach((el) => {
      el.style.overflow = el.dataset.qlbOverflow || '';
      el.style.overflowY = el.dataset.qlbOverflowY || '';
      delete el.dataset.qlbStickyPatched;
      delete el.dataset.qlbOverflow;
      delete el.dataset.qlbOverflowY;
    });
    promptCol = null;
  }

  // ============== 进度查询 ==============

  function countProgress() {
    const all = getAllQaGroups();
    let pass = 0, fail = 0, none = 0;
    all.forEach((g) => {
      const v = getCurrentPass(g);
      if (v === QA_PASS) pass++;
      else if (v === QA_FAIL) fail++;
      else none++;
    });
    return { pass, fail, none, total: all.length };
  }

  // ============== Boot / 拆 ==============

  let domObserver = null;
  let refreshTimer = null;
  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      injectSequenceNumbers();
      injectColumnBars();
      injectAllFixBars();
      refreshPassHighlights();
      refreshColumnStats();
      // promptCol 可能因 React 重渲染丢失 inline style → 重新应用
      if (!promptCol || !document.body.contains(promptCol) || promptCol.style.position !== 'sticky') {
        applyPromptSticky();
      }
    }, 250);
  }

  function init() {
    if (qaState.booted) return;
    qaState.booted = true;
    document.body.classList.add('qlb-mode-qa');
    // 移除可能由标注模块误注入的 UI（列顶打分胶囊）
    document.querySelectorAll('.qlb-col-bar:not(.' + COLBAR_CLASS + '), .qlb-dim-bar').forEach((el) => el.remove());

    injectSequenceNumbers();
    injectColumnBars();
    injectAllFixBars();
    refreshPassHighlights();
    refreshColumnStats();
    // 鼠标横滑由通用 QLBWheelPan 提供（content.js 在 fullBoot 时启动）
    applyPromptSticky();

    // 自动聚焦首个未答
    setTimeout(() => { if (!qaState.focusedGroup) focusFirstUnanswered(); }, 500);

    window.addEventListener('keydown', onKeyDownSafe, true);
    document.addEventListener('keydown', onKeyDownSafe, true);
    // 鼠标点击页面任意一题的"通过/不通过" → 把聚焦同步到该题
    document.addEventListener('click', onPageClick, true);

    // DOM 变化 → 重扫
    domObserver = new MutationObserver(() => scheduleRefresh());
    domObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }

  function teardown() {
    if (!qaState.booted) return;
    qaState.booted = false;
    document.body.classList.remove('qlb-mode-qa');
    document.querySelectorAll('.' + SEQ_CLASS).forEach((el) => el.remove());
    document.querySelectorAll('.' + COLBAR_CLASS).forEach((el) => el.remove());
    document.querySelectorAll('.' + HL_PASS_CLASS).forEach((el) => el.classList.remove(HL_PASS_CLASS));
    document.querySelectorAll('.' + HL_FAIL_CLASS).forEach((el) => el.classList.remove(HL_FAIL_CLASS));
    document.querySelectorAll('.' + HL_FOCUS_CLASS).forEach((el) => el.classList.remove(HL_FOCUS_CLASS));
    document.querySelectorAll('.' + HL_FOCUS_FIX_CLASS).forEach((el) => el.classList.remove(HL_FOCUS_FIX_CLASS));
    removeAllFixBars();
    removePromptSticky();
    window.removeEventListener('keydown', onKeyDownSafe, true);
    document.removeEventListener('keydown', onKeyDownSafe, true);
    document.removeEventListener('click', onPageClick, true);
    if (domObserver) { try { domObserver.disconnect(); } catch (e) {} domObserver = null; }
  }

  global.QLBQA = {
    init,
    teardown,
    // 对外 API（工具栏调用）
    passAll,
    failAll,
    passColumn,
    failColumn,
    undoLast,
    countProgress,
    focusFirstUnanswered,
    setFixValue,
    refresh: scheduleRefresh,
    /** 内部用：让 missing.js 在质检模式下可以聚焦 QA 题目组 */
    _setFocus: setFocus,
    debug() {
      const { pass, fail, none, total } = countProgress();
      console.group('%c[QLB:QA]', 'color:#a855f7;font-weight:bold');
      console.table({ total, pass, fail, none, columns: getQaColumns().length });
      console.log('linear list:', getLinearList());
      console.log('focused:', qaState.focusedGroup);
      console.groupEnd();
      return { total, pass, fail, none };
    }
  };
})(window);
