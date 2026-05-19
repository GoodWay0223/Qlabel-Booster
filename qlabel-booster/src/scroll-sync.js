/**
 * scroll-sync.js
 * 视频行与题目列的横向联动。
 *
 * ========== v1.7.0 精准架构（基于实际 DOM 诊断） ==========
 * qlabel 评估页结构：
 *   combinator-content
 *   └─ cr-container-multiple
 *      ├─ .cr-container-col--18 (overflow-x:scroll) 🟥 视频横滚容器
 *      │   └─ .cr-container-row
 *      │       ├─ .cr-container-col--6  [原视频 video]
 *      │       ├─ .cr-container-col--8  [视频1 video]
 *      │       ├─ .cr-container-col--8  [视频2 video]
 *      │       ├─ .cr-container-col--8  [视频3 video]
 *      │       ├─ .cr-container-col--8  [视频4 video]
 *      │       ├─ .cr-container-col--8  [视频5 video]
 *      │       └─ .cr-container-col--8  [视频6 video]
 *      │
 *      └─ .cr-container-col--18 (overflow-x:scroll) 🟦 题目横滚容器
 *          └─ .cr-container-row
 *              ├─ .cr-container-col--18 [左侧 prompt（包含题目时会被 getColumns 误捕获）]
 *              ├─ .cr-container-col--10 [视频1 题目组]
 *              ├─ .cr-container-col--10 [视频2 题目组]
 *              ├─ .cr-container-col--10 [视频3 题目组]
 *              ├─ .cr-container-col--10 [视频4 题目组]
 *              ├─ .cr-container-col--10 [视频5 题目组]
 *              └─ .cr-container-col--10 [视频6 题目组]
 *
 * 索引映射：视频 [1..6] ↔ 题目列 [.cr-container-col--10 × 6]
 *   注意：原视频（索引 0）和 prompt 列都是"第一个锚点"，不做 1:1 映射；
 *   我们只对 N=6 的评分视频与题目列做真正的联动。
 */
(function (global) {
  'use strict';

  const { getAllVideos } = global.QLBSelectors;
  const { state, savePrefs } = global.QLBState;

  /** 视频横滚容器（.cr-container-col--18 包 video） */
  let videoTrack = null;
  /** 题目横滚容器（.cr-container-col--18 包 .cr-radio-group） */
  let questionTrack = null;
  /** 评分视频数组（排除原视频） */
  let ratingVideos = [];
  /** 评分题目列数组（排除 prompt 列） */
  let ratingCols = [];

  let lastAlignedIdx = -1;
  /** 程序回写滚正在进行中 → 暂停反向监听，避免回弹。键名是 'video' / 'question'。 */
  const writingBack = { video: 0, question: 0 };
  let videoScrollHandler = null;
  let questionScrollHandler = null;
  let rafPending = false;
  /** v1.9.15：是否已经做过"初始复位到题目1"。仅每个 detectTracks 周期做一次，避免反复拉回 */
  let initialResetDone = false;

  // ============== 探测两条轨道 ==============

  function detectTracks() {
    // 找所有 .cr-container-col--18 中带 overflow-x 可滚的
    const cols18 = document.querySelectorAll('.cr-container-col--18');
    let vTrack = null, qTrack = null;
    cols18.forEach((c) => {
      const s = window.getComputedStyle(c);
      if (!/auto|scroll|overlay/.test(s.overflowX)) return;
      if (c.querySelector('video')) vTrack = c;
      // 题目轨道：标注模式有 .cr-radio-group 含 [name="0"]；质检模式 .cr-radio-group 含 [name="通过"]
      // 两种特征都覆盖，避免把"左侧 prompt + 评分 col--18"误认为是题目轨道
      else if (c.querySelector('.cr-radio-group')) qTrack = c;
    });

    videoTrack = vTrack;
    questionTrack = qTrack;

    // 评分视频：过滤掉 .cr-container-col--6（原视频），只要 --8 里的
    if (videoTrack) {
      ratingVideos = Array.from(videoTrack.querySelectorAll('.cr-container-col--8 video'))
        .filter((v) => {
          const player = document.getElementById('qlb-player');
          if (player && player.contains(v)) return false;
          return v.src || v.currentSrc || v.querySelector('source');
        });
    } else {
      ratingVideos = [];
    }

    // 评分题目列：过滤掉 --18（prompt 列），只要 --10 且其中含真正打分/质检题
    if (questionTrack) {
      ratingCols = Array.from(questionTrack.querySelectorAll('.cr-container-col--10'))
        .filter((c) =>
          c.querySelector('.cr-radio-group') ||
          c.querySelector('label.tea-form-check[name="通过"]')
        );
    } else {
      ratingCols = [];
    }

    if (videoTrack && ratingVideos.length > 0) {
      bindVideoScroll();
    }
    if (questionTrack && ratingCols.length > 0) {
      bindQuestionScroll();
    }
    const ok = !!(videoTrack && questionTrack && ratingVideos.length > 0 && ratingCols.length > 0);
    // v1.9.15：首次探测成功 → 主动把两条轨道滚到最左（让"题目1"左侧文字完整可见）
    // 修复"刚进入界面，下方答题列表第 1 列左边的文字显示不全，需要手动滚一下"的 bug
    // 原因：浏览器在加载阶段可能因某些焦点元素（autofocus / video poster / React 的 scrollIntoView）
    //      把横向 scrollable 容器推到非 0 位置，第 1 列左侧就被截掉了。
    if (ok && !initialResetDone) {
      initialResetDone = true;
      resetTracksToStart();
    }
    return ok;
  }

  /**
   * v1.9.15：把两条横向轨道复位到最左（scrollLeft = 0）。
   * 用 writingBack 标记防止 mirrorScroll 反向回弹。
   * 仅在"首次探测成功"时调用一次（initialResetDone 控制），避免用户已经手动滚到中间后被拉回。
   */
  function resetTracksToStart() {
    // 等两帧再执行：让 React 完成首次渲染，避免我们写完 0 后浏览器又把它推到非 0
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        if (videoTrack && videoTrack.scrollLeft !== 0) {
          writingBack.video++;
          videoTrack.scrollLeft = 0;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (writingBack.video > 0) writingBack.video--;
          }));
        }
        if (questionTrack && questionTrack.scrollLeft !== 0) {
          writingBack.question++;
          questionTrack.scrollLeft = 0;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (writingBack.question > 0) writingBack.question--;
          }));
        }
      } catch (e) { /* ignore */ }
    }));
  }

  // ============== 索引计算 ==============

  /** 基于 track 容器的"视口中心"，找 elements 里谁最近 */
  function indexNearestInTrack(elements, track) {
    if (!elements.length || !track) return -1;
    const rect = track.getBoundingClientRect();
    const refX = rect.left + rect.width / 2;
    let best = -1, min = Infinity;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cx = r.left + r.width / 2;
      const d = Math.abs(cx - refX);
      if (d < min) { min = d; best = i; }
    }
    return best;
  }

  function currentVideoIndex() {
    return indexNearestInTrack(ratingVideos, videoTrack);
  }
  function currentQuestionIndex() {
    return indexNearestInTrack(ratingCols, questionTrack);
  }

  // ============== 对齐执行 ==============

  /**
   * 列居中：仅用于"键盘切列"等需要把目标列卡到视口中央的场景。
   * 用户拖滚动条 / 触摸板横滑时不会用此函数。
   */
  function centerInTrack(track, target, dstKey) {
    if (!track || !target) return;
    const trackRect = track.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const trackCenterX = trackRect.left + trackRect.width / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const delta = targetCenterX - trackCenterX;
    if (Math.abs(delta) < 2) return;
    const newLeft = Math.max(0, Math.min(track.scrollWidth - track.clientWidth, track.scrollLeft + delta));
    if (dstKey) writingBack[dstKey]++;
    try {
      track.scrollTo({ left: newLeft, behavior: 'smooth' });
    } catch (e) {
      track.scrollLeft = newLeft;
    }
    if (dstKey) {
      // smooth 滚动会持续触发 scroll 事件，给一段缓冲再清标记
      setTimeout(() => { if (writingBack[dstKey] > 0) writingBack[dstKey]--; }, 380);
    }
  }

  function alignQuestionToIndex(idx) {
    if (idx < 0 || idx >= ratingCols.length) return;
    centerInTrack(questionTrack, ratingCols[idx], 'question');
  }
  function alignVideoToIndex(idx) {
    if (idx < 0 || idx >= ratingVideos.length) return;
    const col = ratingVideos[idx].closest('.cr-container-col--8') || ratingVideos[idx];
    centerInTrack(videoTrack, col, 'video');
  }

  /**
   * 比例镜像滚动（核心新策略）：把源轨道的 scrollLeft / maxScrollLeft 比例 1:1 同步到目标轨道。
   *
   * 为什么不用"列居中跳变"：
   *   - 用户拖动横滚条时 scrollLeft 一次跨多个单位，"最近列"判定会突变 → 题目栏咔哒一下跳到第 N 列居中
   *   - 居中对齐对首尾列没意义：视频1（首列）居中会让其左侧文字溢出视口、视频6（尾列）居中会让滚动条无法到底
   *   - 触摸板看似 OK，是因为它每帧 deltaX 很小，恰好和"最近列"判定吻合
   *
   * 比例同步的优势：
   *   - scroll 事件无论多频/多稀，目标侧都按同样比例跟随，跟手感与触摸板一致
   *   - 首尾两端可完整可见，不会被"强制居中"截掉
   *
   * @param srcTrack 源（用户当前在滚动的轨道）
   * @param dstTrack 目标（被动跟随的轨道）
   * @param dstKey   写回标记 key（'video' / 'question'），防止反向回弹
   */
  function mirrorScroll(srcTrack, dstTrack, dstKey) {
    if (!srcTrack || !dstTrack) return;
    const srcMax = srcTrack.scrollWidth - srcTrack.clientWidth;
    const dstMax = dstTrack.scrollWidth - dstTrack.clientWidth;
    if (srcMax <= 0 || dstMax <= 0) return;
    const ratio = Math.max(0, Math.min(1, srcTrack.scrollLeft / srcMax));
    const targetLeft = Math.round(ratio * dstMax);
    if (Math.abs(dstTrack.scrollLeft - targetLeft) < 1) return;
    // 标记"接下来这次 scroll 事件是程序回写"，避免反向监听再触发
    writingBack[dstKey]++;
    dstTrack.scrollLeft = targetLeft; // 直接赋值（非 smooth），与源轨道同帧跟随，最跟手
    // 两帧后清除标记（浏览器会在本帧或下一帧分发 scroll 事件）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (writingBack[dstKey] > 0) writingBack[dstKey]--;
      });
    });
  }

  // ============== 事件处理 ==============

  function onVideoScroll() {
    if (state.prefs.syncScroll === false) return;
    if (writingBack.video > 0) return; // 程序回写引发的 scroll → 跳过
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      mirrorScroll(videoTrack, questionTrack, 'question');
      const vIdx = currentVideoIndex();
      if (vIdx >= 0) lastAlignedIdx = vIdx;
    });
  }

  function onQuestionScroll() {
    if (state.prefs.syncScroll === false) return;
    if (writingBack.question > 0) return;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      mirrorScroll(questionTrack, videoTrack, 'video');
      const qIdx = currentQuestionIndex();
      if (qIdx >= 0) lastAlignedIdx = qIdx;
    });
  }

  /** 用户用方向键聚焦新题 → 把对应视频居中（这种场景需要"咔哒一下"卡到列中央）
   *
   *  v1.9.67：抑制不必要的横向回弹。
   *    场景：用户已手动横滑到合适位置（视频列和题目列对齐），此时点 通过/不通过 触发自动聚焦，
   *         旧逻辑会再"咔哒一下"把列卡到正中央 → 用户原本满意的位置被打乱。
   *    新策略：焦点题对应的视频列**已完全可见**（在视频轨道视口内）→ 视为合理对齐 → 不动横滚。
   *           只有视频列被部分截断或完全不可见时才主动对齐。
   *
   *  v1.9.86：新增 force 选项 —— "定位未答题"场景下需要强制把对应列拉回视口居中。
   *    之前用户手动横滑走、再点定位未答题，会因为 lastAlignedIdx === i 短路而不滚，导致只标红框不跳列。
   */
  function syncByFocusedGroup(opts = {}) {
    if (state.prefs.syncScroll === false) return;
    const force = !!opts.force;
    const g = state.focusedGroup;
    if (!g) return;
    for (let i = 0; i < ratingCols.length; i++) {
      if (ratingCols[i].contains(g)) {
        // force 模式跳过"已对齐过"和"已完全可见"两个短路，直接对齐
        if (!force && i === lastAlignedIdx) return;
        // v1.9.67：检查"对应视频列"是否已经在视频轨道视口内完全可见
        // 是 → 用户已手动对齐，保持现状不打扰
        if (!force && ratingVideos[i] && videoTrack) {
          try {
            const videoCol = ratingVideos[i].closest('.cr-container-col--8') || ratingVideos[i];
            const trackRect = videoTrack.getBoundingClientRect();
            const colRect = videoCol.getBoundingClientRect();
            // 完全在视口内：左右边都在 trackRect 范围内（留 4px 容差）
            const fullyVisible =
              colRect.left >= trackRect.left - 4 &&
              colRect.right <= trackRect.right + 4;
            if (fullyVisible) {
              // 视为合理对齐，仅更新 lastAlignedIdx 但不滚动
              lastAlignedIdx = i;
              return;
            }
          } catch (e) { /* fallback：继续走原对齐逻辑 */ }
        }
        lastAlignedIdx = i;
        alignVideoToIndex(i);
        alignQuestionToIndex(i);
        return;
      }
    }
  }

  // v1.9.9：删除 onFocusedColumnChanged 死函数（全项目无引用）
  // 之前为兼容老调用签名保留，现在 navigator.js / qa.js 都直接用 syncByFocusedGroup

  // 注：v1.9.6 起不再需要 wheel 兜底
  //   - 浏览器原生横滑 / 拖动滚动条 → 触发 scroll 事件 → mirrorScroll 自动按比例同步
  //   - wheel 兜底过去存在的意义是"列居中跳变"模式下，scroll 事件的列索引判定来不及
  //   - 现在改成纯比例同步，scroll 事件本身就足够实时，wheel 兜底已无用且会引入额外帧延迟

  // ============== 绑定/解绑 ==============

  function bindVideoScroll() {
    if (videoScrollHandler) return;
    videoScrollHandler = onVideoScroll;
    videoTrack.addEventListener('scroll', videoScrollHandler, { passive: true });
  }
  function bindQuestionScroll() {
    if (questionScrollHandler) return;
    questionScrollHandler = onQuestionScroll;
    questionTrack.addEventListener('scroll', questionScrollHandler, { passive: true });
  }
  function unbind() {
    try { videoTrack && videoScrollHandler && videoTrack.removeEventListener('scroll', videoScrollHandler); } catch (e) {}
    try { questionTrack && questionScrollHandler && questionTrack.removeEventListener('scroll', questionScrollHandler); } catch (e) {}
    videoScrollHandler = questionScrollHandler = null;
    // v1.9.15：解绑表示 DOM 已被切换（切任务 / 切模式），下次重探时重新做一次"复位到题目1"
    initialResetDone = false;
  }

  // ============== 对外 API ==============

  function setEnabled(on) {
    savePrefs({ syncScroll: !!on });
    if (on) detectTracks();
  }
  function isEnabled() { return state.prefs.syncScroll !== false; }

  function summarize(el) {
    if (!el) return null;
    if (el === document.documentElement) return { tag: 'HTML' };
    if (el === document.body) return { tag: 'BODY' };
    return {
      tag: el.tagName,
      cls: String(el.className || '').slice(0, 80),
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      overflow: el.scrollWidth - el.clientWidth,
      scrollLeft: el.scrollLeft
    };
  }

  function debug() {
    detectTracks();
    const info = {
      enabled: isEnabled(),
      videoTrack: summarize(videoTrack),
      questionTrack: summarize(questionTrack),
      ratingVideoCount: ratingVideos.length,
      ratingColCount: ratingCols.length,
      currentVideoIndex: currentVideoIndex(),
      currentQuestionIndex: currentQuestionIndex()
    };
    /* eslint-disable no-console */
    console.group('%c[QLB:ScrollSync v1.7.0]', 'color:#3b82f6;font-weight:bold');
    console.table({
      enabled: info.enabled,
      '视频(6)': info.ratingVideoCount,
      '题目列(6)': info.ratingColCount,
      '当前视频idx': info.currentVideoIndex,
      '当前题目idx': info.currentQuestionIndex,
      'index一致': info.currentVideoIndex === info.currentQuestionIndex
    });
    console.log('videoTrack:', videoTrack, info.videoTrack);
    console.log('questionTrack:', questionTrack, info.questionTrack);
    console.log('ratingVideos:', ratingVideos);
    console.log('ratingCols:', ratingCols);
    console.groupEnd();
    return info;
  }

  let hlOn = false;
  function highlight() {
    hlOn = !hlOn;
    const apply = (el, color) => {
      if (!el) return;
      if (hlOn) {
        el.dataset.qlbHlPrev = el.style.outline || '';
        el.style.outline = `3px solid ${color}`;
        el.style.outlineOffset = '-3px';
      } else {
        el.style.outline = el.dataset.qlbHlPrev || '';
        delete el.dataset.qlbHlPrev;
      }
    };
    apply(videoTrack, '#ef4444');
    apply(questionTrack, '#f59e0b');
    ratingVideos.forEach((v, i) => apply(v.closest('.cr-container-col--8') || v, i % 2 ? '#3b82f6' : '#06b6d4'));
    ratingCols.forEach((c, i) => apply(c, i % 2 ? '#3b82f6' : '#06b6d4'));
    console.log(hlOn
      ? '[QLB:ScrollSync] 🔴 视频横滚容器 / 🟠 题目横滚容器 / 🔵🟢 对应视频列与题目列'
      : '[QLB:ScrollSync] 已清除高亮');
    return hlOn;
  }

  let detectIntervalId = null;
  let initMo = null;
  function init() {
    detectTracks();
    // DOM 变化（切题后重加载）→ 重探
    if (initMo) { try { initMo.disconnect(); } catch (e) {} initMo = null; }
    initMo = new MutationObserver(() => {
      const lost =
        !videoTrack || !document.body.contains(videoTrack) ||
        !questionTrack || !document.body.contains(questionTrack) ||
        ratingVideos.length === 0 || ratingCols.length === 0;
      if (lost) {
        unbind();
        detectTracks();
      }
    });
    initMo.observe(document.body, { subtree: true, childList: true });
    // 兜底：每 5s 重探一次（v1.9.9：从 2s 拉长到 5s，MO 已经覆盖大部分场景）
    if (detectIntervalId) clearInterval(detectIntervalId);
    detectIntervalId = setInterval(() => {
      if (!videoTrack || !questionTrack) detectTracks();
    }, 5000);
  }

  global.QLBScrollSync = {
    init,
    setEnabled,
    isEnabled,
    detectTracks,
    debug,
    highlight,
    syncByFocusedGroup
  };
})(window);
