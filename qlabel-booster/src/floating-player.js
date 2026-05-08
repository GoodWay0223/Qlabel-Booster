/**
 * floating-player.js
 * 双模式：
 *  A) 强制循环模式（默认）：给页面所有 <video> 设 loop=true，监听 ended 自动从头播，
 *     监听 pause 不做强制。不创建悬浮窗，配合浏览器自带画中画即可。
 *  B) 悬浮小窗模式：额外创建一个克隆窗（可拖拽/缩放/倍速），可通过工具栏按钮开关。
 */
(function (global) {
  'use strict';

  const { getAllVideos } = global.QLBSelectors;
  const { state, savePrefs } = global.QLBState;

  const WRAP_ID = 'qlb-player';
  let wrap = null;
  let videoEl = null;
  let currentIndex = 0;
  let sources = [];

  // ========== 模式 A：强制原生视频循环 ==========
  const patchedVideos = new WeakSet();

  function applyLoopAttr(v, enable) {
    try {
      v.loop = !!enable;
      if (enable) v.setAttribute('loop', '');
      else v.removeAttribute('loop');
    } catch (e) {}
  }

  // ========== 视频互斥静音：同一时间只有一个视频出声 ==========
  // 规则：
  //   1) 用户点任意视频的「播放键」 → 视为"我要听这个"，自动为其取消静音 + 静音其他所有
  //   2) 用户点任意视频的「取消静音」 → 该视频成为当前音源，其他自动静音
  //   3) 悬浮窗里的视频默认不静音（用户主动打开就是想听）
  //   4) 静音操作只针对 <video> 元素本身，不依赖页面 UI 状态，所以用户再点"播放"时会被我们重置为有声
  let activeAudioVideo = null;
  let muteGuardBusy = false; // 防止 volumechange 事件链递归

  /**
   * v1.9.41：把"当前音频聚焦的视频"在视觉上标出来 —— 给它的容器加 .qlb-audio-active
   *   - 用户能一眼看见现在哪个视频在出声
   *   - 容器优先用 .cr-container-col--8 / --6（页面布局列）；找不到则给 video 自身加
   *
   * v1.9.43：悬浮窗里的视频成为音源时，也要给它**对应的页面视频**加框（让用户知道
   *   悬浮窗在播哪一个）。映射靠 videoEl.src ↔ 页面 video.src 比对。
   */
  const AUDIO_ACTIVE_CLASS = 'qlb-audio-active';

  /** 找页面里 src 与目标 src 相同的 video（不在悬浮窗内） */
  function findPageVideoBySrc(targetSrc) {
    if (!targetSrc) return null;
    const player = document.getElementById('qlb-player');
    const all = document.querySelectorAll('video');
    for (const v of all) {
      if (player && player.contains(v)) continue;
      const url = v.currentSrc || v.src ||
                  (v.querySelector('source') && v.querySelector('source').src) || '';
      if (url && url === targetSrc) return v;
    }
    return null;
  }

  function getVideoFrameContainer(v) {
    if (!v) return null;
    // 找页面布局列容器（评分视频 = col--8，原视频 = col--6）
    return v.closest('.cr-container-col--8') ||
           v.closest('.cr-container-col--6') ||
           v.closest('.cr-container-col') ||
           v;
  }
  function refreshAudioActiveHighlight() {
    try {
      // 1) 清掉之前所有高亮（去重保险）
      document.querySelectorAll('.' + AUDIO_ACTIVE_CLASS).forEach((el) => {
        el.classList.remove(AUDIO_ACTIVE_CLASS);
      });
      const player = document.getElementById('qlb-player');
      // 2) 给当前 unmuted 的视频对应的"页面容器"加高亮
      document.querySelectorAll('video').forEach((v) => {
        if (v.muted) return;
        let pageVideo = v;
        // 如果 unmuted 的是悬浮窗里的 video → 反查页面里 src 相同的那个视频
        if (player && player.contains(v)) {
          const url = v.currentSrc || v.src || '';
          pageVideo = findPageVideoBySrc(url);
          if (!pageVideo) return; // 找不到对应（如参考图视频独立）→ 不加框
        }
        const box = getVideoFrameContainer(pageVideo);
        if (box) box.classList.add(AUDIO_ACTIVE_CLASS);
      });
    } catch (e) {}
  }

  function muteOthers(except) {
    if (muteGuardBusy) return;
    muteGuardBusy = true;
    try {
      document.querySelectorAll('video').forEach((v) => {
        if (v === except) return;
        // 悬浮窗内部的视频如果不是 except，也要静音；但 except === 悬浮窗时，要跳过
        if (!v.muted) {
          try { v.muted = true; } catch (e) {}
        }
      });
    } finally {
      muteGuardBusy = false;
    }
    activeAudioVideo = except;
    // v1.9.41：所有"切换当前音源"的路径都会走到这里 → 顺便刷新淡蓝色聚焦框
    refreshAudioActiveHighlight();
  }

  function makeActiveAudio(v) {
    // 将 v 设为"当前音源"：自己取消静音，其它全部静音
    muteGuardBusy = true;
    try {
      if (v.muted) {
        try { v.muted = false; } catch (e) {}
      }
    } finally {
      muteGuardBusy = false;
    }
    muteOthers(v);
  }

  function onVideoPlay(v) {
    // 用户按下播放键 = 明确表达"我要听这个视频"
    // 直接把它设为音源（哪怕之前被我们静音过，也会被恢复）
    makeActiveAudio(v);
  }

  function onVideoVolumeChange(v) {
    // 用户手动点了取消静音 → 它成为音源
    // （我们自己 mute 时 muteGuardBusy=true，所以不会走这里）
    if (!v.muted) {
      muteOthers(v);
    } else {
      // v1.9.41：用户手动静音了当前音源 → 没有视频在出声 → 刷新去掉所有高亮
      refreshAudioActiveHighlight();
    }
  }

  function forceLoopAllNativeVideos() {
    const enable = state.prefs.autoLoopVideos !== false; // 默认 true
    const vids = document.querySelectorAll('video');
    let foundNew = false;
    vids.forEach((v) => {
      applyLoopAttr(v, enable);
      if (patchedVideos.has(v)) return;
      patchedVideos.add(v);
      foundNew = true;

      // 循环：ended 再保险重播
      v.addEventListener('ended', () => {
        if (state.prefs.autoLoopVideos === false) return;
        try {
          v.currentTime = 0;
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } catch (e) {}
      });

      // 互斥发声
      v.addEventListener('play', () => onVideoPlay(v));
      v.addEventListener('volumechange', () => onVideoVolumeChange(v));
    });
    // v1.9.41：每发现新视频就刷新一次音频聚焦框
    //   - 初次进入页面：覆盖"页面默认 unmuted 的视频"
    //   - 切任务/新批次：新视频出现后立刻重新计算高亮
    if (foundNew) refreshAudioActiveHighlight();
  }

  /** 外部切换开关后立刻应用到所有现存视频 */
  function setAutoLoop(enable) {
    document.querySelectorAll('video').forEach((v) => applyLoopAttr(v, enable));
  }

  // v1.9.9：删除原 startLoopGuard()——它每 2s 跑一次 forceLoopAllNativeVideos，
  // 与 observeNewVideos() 的 MutationObserver 重复劳动。MO 已经能覆盖所有 video 新增。
  // v1.9.11：扩展 observeNewVideos，让它在悬浮窗打开时自动检测视频集合变化并 reload，
  // 解决"切题后悬浮窗仍显示上一题视频，必须手动关再开"的问题。
  function observeNewVideos() {
    let mo = null;
    let pending = false;
    /** 上一次成功 render 时的视频 URL 集合（仅在悬浮窗显示时维护） */
    let lastUrlSet = new Set();
    let reloadDebounce = null;

    /** 当前页面所有视频的 URL 集合（去掉空 src 与悬浮窗自身克隆） */
    function snapshotUrls() {
      const set = new Set();
      document.querySelectorAll('video').forEach((v) => {
        if (wrap && wrap.contains(v)) return;
        const url = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
        if (url) set.add(url);
      });
      return set;
    }

    /** 判断两个 URL Set 是否表示同一批视频 */
    function urlSetsEqual(a, b) {
      if (a.size !== b.size) return false;
      for (const u of a) if (!b.has(u)) return false;
      return true;
    }

    mo = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        forceLoopAllNativeVideos();
        // 仅在悬浮窗"已显示"时才尝试自动 reload
        if (!wrap || wrap.style.display === 'none' || wrap.style.display === '') return;
        const cur = snapshotUrls();
        // 第一次或 lastUrlSet 还没填充：用当前 sources 反推
        if (lastUrlSet.size === 0) {
          sources.forEach((v) => {
            const u = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
            if (u) lastUrlSet.add(u);
          });
        }
        if (cur.size === 0) return;
        if (urlSetsEqual(cur, lastUrlSet)) return;
        // 视频集合变化 → 防抖 250ms，等待新视频 src 全部就位再 reload
        if (reloadDebounce) clearTimeout(reloadDebounce);
        reloadDebounce = setTimeout(() => {
          reloadDebounce = null;
          // 再次确认（防止一瞬间的过渡态）
          const cur2 = snapshotUrls();
          if (cur2.size === 0) return;
          if (urlSetsEqual(cur2, lastUrlSet)) return;
          lastUrlSet = cur2;
          try { reload(); } catch (e) { /* ignore */ }
          try {
            global.QLBMissing && global.QLBMissing.toast &&
              global.QLBMissing.toast('🔄 检测到新视频，悬浮窗已自动更新');
          } catch (e) {}
        }, 250);
      });
    });
    mo.observe(document.body, { subtree: true, childList: true });
  }

  // ========== 模式 B：悬浮克隆窗 ==========
  function ensureWrap() {
    if (wrap && document.body.contains(wrap)) return wrap;
    // v1.9.8：根据系统显示对应快捷键文案
    const P = global.QLBPlatform || { combo: () => '⌘/Ctrl+Shift+P' };
    const tipPip = `画中画（可拖到副屏 · 快捷键 ${P.combo('mod+shift+p')}）`;
    const tipReset = `复位到右下角（快捷键 ${P.combo('mod+shift+0')}）`;
    wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    wrap.className = 'qlb-player';
    wrap.innerHTML = `
      <div class="qlb-player__header">
        <span class="qlb-player__title">悬浮循环</span>
        <div class="qlb-player__controls">
          <button data-action="prev" title="上一个视频">◀</button>
          <span class="qlb-player__idx">-</span>
          <button data-action="next" title="下一个视频">▶</button>
          <select class="qlb-player__rate" title="倍速">
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
          <button data-action="pip" title="${tipPip}">⛶</button>
          <button data-action="reset" title="${tipReset}" aria-label="复位">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2.5 8a5.5 5.5 0 1 0 1.61-3.89"/>
              <path d="M2 2v3.5h3.5"/>
            </svg>
          </button>
          <button data-action="close" title="关闭">✕</button>
        </div>
      </div>
      <div class="qlb-player__body"></div>
      <div class="qlb-player__resizer"></div>
    `;
    document.body.appendChild(wrap);

    const { playerX, playerY, playerW, playerH } = state.prefs;
    const vw = window.innerWidth, vh = window.innerHeight;
    // 尺寸也要做越界保护：如果上次记的尺寸超过当前视口（比如从大屏切到小屏），先压回去
    let w = playerW || 360;
    let h = playerH || 220;
    w = Math.min(w, Math.max(200, vw - 20));
    h = Math.min(h, Math.max(140, vh - 20));
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    if (playerX !== null && playerY !== null && playerX !== undefined && playerY !== undefined) {
      // 严格越界回收：保证整窗完整可见（避免跨屏/分辨率变化后完全消失）
      const maxX = Math.max(0, vw - w);
      const maxY = Math.max(0, vh - h);
      const x = Math.min(Math.max(0, playerX), maxX);
      const y = Math.min(Math.max(0, playerY), maxY);
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      // 如果纠正过位置/尺寸，持久化回存
      if (x !== playerX || y !== playerY || w !== playerW || h !== playerH) {
        savePrefs({
          playerX: Math.round(x),
          playerY: Math.round(y),
          playerW: Math.round(w),
          playerH: Math.round(h)
        });
      }
    } else {
      // v1.9.13：首次创建悬浮窗（没保存过位置）→ 算一个"工具栏正上方 + 24px 间距"的稳定位置
      // 之前是 CSS 默认 bottom:260px，但工具栏实际高度常 > 260px 导致重叠
      let toolbarH = 320;
      try {
        const tb = document.getElementById('qlb-toolbar');
        if (tb) {
          const r = tb.getBoundingClientRect();
          if (r.height > 0) toolbarH = r.height;
        }
      } catch (er) {}
      const x = Math.max(0, vw - w - 20);
      const y = Math.max(0, vh - h - toolbarH - 44);
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
    }

    bindDrag();
    bindResize();
    bindControls();
    return wrap;
  }

  /** 复位悬浮窗到默认右下角 + 默认尺寸；若因拖出视口丢失，会强制拉回。*/
  function resetPos() {
    // 确保 wrap 存在且在 DOM 里
    ensureWrap();
    const vw = window.innerWidth, vh = window.innerHeight;
    // v1.9.7：根据视口尺寸自适应。小屏缩小、大屏放大；保持 16:10 比例左右
    let w = 360, h = 220;
    if (vw < 1024) { w = 280; h = 175; }
    else if (vw < 1280) { w = 320; h = 200; }
    else if (vw >= 2560) { w = 420; h = 252; }
    // 进一步用 viewport 上限 cap 一下（防止极端情况溢出）
    w = Math.min(w, Math.round(vw * 0.6));
    h = Math.min(h, Math.round(vh * 0.45));
    const x = Math.max(0, vw - w - 20);
    // v1.9.10：动态测量右下角工具栏的实际高度，留出 24px 间距 + 安全 buffer，避免重叠
    let toolbarH = 320; // 默认值（工具栏完整展开高度的常见值）
    try {
      const tb = document.getElementById('qlb-toolbar');
      if (tb) {
        const r = tb.getBoundingClientRect();
        if (r.height > 0) toolbarH = r.height;
      }
    } catch (er) {}
    // 工具栏位于 bottom: 20px → 它的 top = vh - 20 - toolbarH
    // 悬浮窗 bottom 应 ≤ 工具栏 top - 24px gap
    // 即 y + h ≤ vh - 20 - toolbarH - 24 → y ≤ vh - h - toolbarH - 44
    const y = Math.max(0, vh - h - toolbarH - 44);
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
    wrap.style.display = 'flex';
    savePrefs({
      playerX: Math.round(x),
      playerY: Math.round(y),
      playerW: w,
      playerH: h,
      playerVisible: true
    });
    // 没有视频源时补一次渲染
    if (sources.length === 0) refreshSources();
    if (sources.length > 0 && !videoEl) renderCurrent();
    // 顺带把右下角主工具栏也复位（用户的常见诉求：一键恢复"初始布局"）
    try {
      if (global.QLBToolbar && global.QLBToolbar.resetPos) {
        global.QLBToolbar.resetPos();
      }
    } catch (e) {}
    global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('🔄 悬浮窗 & 工具栏已复位到右下角');
  }

  function bindDrag() {
    const header = wrap.querySelector('.qlb-player__header');
    let startX, startY, origX, origY, dragging = false;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      dragging = true;
      const rect = wrap.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; origX = rect.left; origY = rect.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = wrap.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      // 保证悬浮窗整体始终在视口内，防止被拖出浏览器/跨屏后找不回来
      const minX = 0;
      const maxX = Math.max(0, vw - rect.width);
      const minY = 0;
      const maxY = Math.max(0, vh - rect.height);
      const nx = Math.min(Math.max(minX, origX + (e.clientX - startX)), maxX);
      const ny = Math.min(Math.max(minY, origY + (e.clientY - startY)), maxY);
      wrap.style.left = nx + 'px';
      wrap.style.top = ny + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = wrap.getBoundingClientRect();
      savePrefs({ playerX: Math.round(r.left), playerY: Math.round(r.top) });
    });
  }

  function bindResize() {
    const rs = wrap.querySelector('.qlb-player__resizer');
    let startX, startY, origW, origH, resizing = false;
    rs.addEventListener('mousedown', (e) => {
      resizing = true;
      const rect = wrap.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; origW = rect.width; origH = rect.height;
      wrap.classList.add('qlb-player--resizing');
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      // 尺寸范围：宽 200~视口宽、高 140~视口高
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(vw - 20, Math.max(200, origW + (e.clientX - startX)));
      const h = Math.min(vh - 20, Math.max(140, origH + (e.clientY - startY)));
      wrap.style.width = w + 'px';
      wrap.style.height = h + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      wrap.classList.remove('qlb-player--resizing');
      const r = wrap.getBoundingClientRect();
      savePrefs({ playerW: Math.round(r.width), playerH: Math.round(r.height) });
    });
  }

  function bindControls() {
    wrap.addEventListener('click', (e) => {
      const act = e.target && e.target.dataset ? e.target.dataset.action : null;
      if (!act) return;
      if (act === 'prev') switchTo(currentIndex - 1);
      if (act === 'next') switchTo(currentIndex + 1);
      if (act === 'close') hide();
      if (act === 'reset') resetPos();
      if (act === 'pip') togglePip();
    });
    const rate = wrap.querySelector('.qlb-player__rate');
    rate.value = String(state.prefs.playerRate || 1);
    rate.addEventListener('change', () => {
      const v = parseFloat(rate.value);
      if (videoEl) videoEl.playbackRate = v;
      savePrefs({ playerRate: v });
    });
  }

  // ========== 画中画（原生 PiP） ==========
  // 说明：PiP 是浏览器原生能力，窗口独立于 Chrome 之外，可以自由缩放并拖到副屏。
  // - Chrome / Edge / Firefox 桌面版：document.pictureInPictureEnabled
  // - Safari 旧版：video.webkitSupportsPresentationMode + webkitSetPresentationMode('picture-in-picture')
  // 用户期望：只要切换下一个视频时仍保留 PiP 窗口（体验连贯）。
  let wantPip = false; // 用户是否"希望"保持 PiP 状态（用于切视频后自动续接）

  function pipSupported() {
    return !!(
      document.pictureInPictureEnabled ||
      (videoEl && typeof videoEl.webkitSupportsPresentationMode === 'function' &&
        videoEl.webkitSupportsPresentationMode('picture-in-picture'))
    );
  }

  function isInPip(v) {
    if (!v) return false;
    if (document.pictureInPictureElement === v) return true;
    // Safari
    if (v.webkitPresentationMode === 'picture-in-picture') return true;
    return false;
  }

  /** 等待视频 metadata 就绪（最多 timeout ms），避免 requestPictureInPicture 报 InvalidStateError */
  function waitMetadata(v, timeout = 1500) {
    return new Promise((resolve) => {
      if (!v) return resolve(false);
      // readyState >= 1 即 HAVE_METADATA，足够 PiP 用
      if (v.readyState >= 1) return resolve(true);
      let done = false;
      const finish = (ok) => { if (done) return; done = true; cleanup(); resolve(ok); };
      const onLoad = () => finish(true);
      const onError = () => finish(false);
      const cleanup = () => {
        v.removeEventListener('loadedmetadata', onLoad);
        v.removeEventListener('loadeddata', onLoad);
        v.removeEventListener('error', onError);
      };
      v.addEventListener('loadedmetadata', onLoad);
      v.addEventListener('loadeddata', onLoad);
      v.addEventListener('error', onError);
      setTimeout(() => finish(v.readyState >= 1), timeout);
    });
  }

  async function enterPip() {
    if (!videoEl) return;
    wantPip = true;
    try {
      // Safari 优先用它自己的 API
      if (
        typeof videoEl.webkitSupportsPresentationMode === 'function' &&
        videoEl.webkitSupportsPresentationMode('picture-in-picture') &&
        !document.pictureInPictureEnabled
      ) {
        videoEl.webkitSetPresentationMode('picture-in-picture');
      } else if (document.pictureInPictureEnabled) {
        // v1.9.21：先等 metadata 就绪，避免 Chrome 抛
        // "Metadata for the video element are not loaded yet"
        if (videoEl.readyState < 1) {
          await waitMetadata(videoEl, 1500);
        }
        // 必须由"用户手势"触发 play() 以确保 PiP 请求不被拒
        if (videoEl.paused) {
          try { await videoEl.play(); } catch (e) {}
        }
        await videoEl.requestPictureInPicture();
      } else {
        global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('⚠ 当前浏览器不支持画中画');
        wantPip = false;
        return;
      }
      updatePipBtnUI(true);
      global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('📺 已进入画中画，可拖到副屏');
    } catch (e) {
      wantPip = false;
      updatePipBtnUI(false);
      // 常见错误：NotAllowedError（用户手势缺失）、InvalidStateError（metadata 未就绪）
      console.warn('[QLB] 进入 PiP 失败：', e && (e.name + ': ' + e.message));
      const msg = e && e.name === 'InvalidStateError'
        ? '⚠ 视频还在加载中，稍等 1 秒再试'
        : '⚠ 进入画中画失败，请先点击一次悬浮窗内视频再试';
      global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast(msg);
    }
  }

  async function exitPip() {
    wantPip = false;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoEl && videoEl.webkitPresentationMode === 'picture-in-picture') {
        videoEl.webkitSetPresentationMode('inline');
      }
    } catch (e) {
      console.warn('[QLB] 退出 PiP 失败：', e);
    }
    updatePipBtnUI(false);
  }

  function togglePip() {
    if (!videoEl) {
      global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('ℹ 悬浮窗暂无视频，无法开启画中画');
      return;
    }
    if (isInPip(videoEl)) exitPip();
    else enterPip();
  }

  function updatePipBtnUI(on) {
    if (!wrap) return;
    const btn = wrap.querySelector('[data-action="pip"]');
    if (!btn) return;
    btn.classList.toggle('qlb-player__pip--on', !!on);
    btn.textContent = on ? '⛝' : '⛶';
    btn.title = on
      ? '退出画中画（当前已在 PiP，可拖到副屏）'
      : `画中画（可拖到副屏 · 快捷键 ${(global.QLBPlatform || { combo: () => '⌘/Ctrl+Shift+P' }).combo('mod+shift+p')}）`;
  }

  /** 为当前 videoEl 挂 PiP 生命周期事件（切视频后会被重新挂） */
  function bindVideoPipEvents(v) {
    if (!v) return;
    v.addEventListener('enterpictureinpicture', () => {
      wantPip = true;
      updatePipBtnUI(true);
    });
    v.addEventListener('leavepictureinpicture', () => {
      // 区分两种退出：
      //   1) 用户主动在 PiP 窗口按 X：wantPip 应归 false
      //   2) 切视频导致元素被替换：稍后在 renderCurrent 里会重新 enterPip
      // 这里不能立刻把 wantPip 置 false，因为切视频也会触发 leavepictureinpicture，
      // 我们用"延时观察"：如果 400ms 后 videoEl 依然没重新进入 PiP，说明是用户关的
      setTimeout(() => {
        if (!videoEl || !isInPip(videoEl)) {
          wantPip = false;
          updatePipBtnUI(false);
        }
      }, 400);
    });
    // Safari 旧版
    v.addEventListener('webkitpresentationmodechanged', () => {
      const on = v.webkitPresentationMode === 'picture-in-picture';
      if (on) wantPip = true;
      updatePipBtnUI(on);
    });
  }

  function refreshSources() {
    // 1) 只要页面上的真实视频，排除悬浮窗自己克隆的那个
    // 2) 必须有实际播放源（src / currentSrc / <source>）
    // 3) 去重（以 src 为键），防止页面里同一个视频被多次挂载
    const raw = getAllVideos().filter((v) => {
      if (wrap && wrap.contains(v)) return false; // 悬浮窗内部的不算
      const url = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
      return !!url;
    });

    const seen = new Set();
    sources = [];
    for (const v of raw) {
      const key = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src) || '';
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push(v);
    }

    // 识别哪个 video 是「参考图视频」
    // 基于实测 DOM 结构（质检 / 标注页共用 Tea 组件，结构一致）：
    //   - 原视频：祖先 .cr-container-col--6 的文字以「原视频」开头
    //   - 参考图视频：祖先 .cr-container-col--6 的文字以「Prompt」/「参考图」开头（不含"原视频"）
    //   - 评分视频：祖先链上有 .cr-container-col--18（视频行轨道）
    // v1.9.25：之前仅在质检模式识别参考图，导致标注模式下参考图视频被误编号为"视频5/5"。
    // 现在两种模式都走相同的识别逻辑：若标注页结构里没有 col--6 / 没有参考图关键字，
    // 所有 video 的 __qlbIsRef 自然保持 false，与旧行为等价，不会破坏无参考图的场景。
    sources.forEach((v) => {
      v.__qlbIsRef = false;
      // 沿祖先链向上找最近的 cr-container-col--6
      let p = v.parentElement;
      let depth = 0;
      while (p && p !== document.body && depth < 8) {
        if (p.classList && p.classList.contains('cr-container-col--6')) {
          const head = (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
          // 含 Prompt / 参考图 / 参考视频 等关键字，且不以"原视频"开头
          if (/^(?!原视频)/.test(head) && /Prompt|参考图|参考视频|提示词/i.test(head)) {
            v.__qlbIsRef = true;
          }
          break;
        }
        // 如果碰到 col--18（视频行）→ 它是评分视频，肯定不是 ref
        if (p.classList && p.classList.contains('cr-container-col--18')) break;
        p = p.parentElement;
        depth++;
      }
    });
    // v1.9.8：保证 sources[0] 永远是非参考图视频（即原视频0），且参考图视频统一排在末尾
    // 切换顺序：原视频0 → 视频1 → 视频2 → ... → 视频N → 参考图视频0 → 原视频0 → ...
    sources.sort((a, b) => {
      const ar = a.__qlbIsRef ? 1 : 0;
      const br = b.__qlbIsRef ? 1 : 0;
      // 仅按 ref 标记升序排（false 在前），ref 之间保持原 DOM 顺序（用稳定排序）
      return ar - br;
    });
    return sources;
  }

  function switchTo(idx) {
    refreshSources();
    if (sources.length === 0) return;
    currentIndex = (idx + sources.length) % sources.length;
    renderCurrent();
    savePrefs({ playerVideoIndex: currentIndex });
  }

  function renderCurrent() {
    const body = wrap.querySelector('.qlb-player__body');
    // 旧 video 如果正处于 PiP，需要先主动退出，避免"幽灵 PiP 窗口"残留
    const prevWasInPip = videoEl && isInPip(videoEl);
    if (prevWasInPip) {
      try {
        if (document.pictureInPictureElement === videoEl) {
          // 不 await，避免阻塞渲染；退出后会触发 leavepictureinpicture
          document.exitPictureInPicture().catch(() => {});
        } else if (videoEl.webkitPresentationMode === 'picture-in-picture') {
          videoEl.webkitSetPresentationMode('inline');
        }
      } catch (e) {}
    }

    body.innerHTML = '';
    const src = sources[currentIndex];
    if (!src) return;
    videoEl = document.createElement('video');
    videoEl.loop = true;
    videoEl.autoplay = true;
    videoEl.controls = true;
    videoEl.playsInline = true;
    videoEl.muted = false; // 悬浮窗默认有声：用户主动打开就是想听
    const url = src.currentSrc || src.src || (src.querySelector('source') && src.querySelector('source').src);
    if (url) videoEl.src = url;
    videoEl.playbackRate = state.prefs.playerRate || 1;
    body.appendChild(videoEl);

    // 悬浮窗成为当前音源 → 静音页面上其他所有视频
    muteOthers(videoEl);

    // 给悬浮窗内的 video 也挂互斥监听（保险：用户点它的静音键切到别的时也能联动）
    videoEl.addEventListener('play', () => onVideoPlay(videoEl));
    videoEl.addEventListener('volumechange', () => onVideoVolumeChange(videoEl));
    // PiP 生命周期
    bindVideoPipEvents(videoEl);

    // autoplay 带声可能被浏览器策略拒绝 → 失败则降级为静音播放
    const p = videoEl.play();
    if (p && p.catch) {
      p.catch(() => {
        try { videoEl.muted = true; videoEl.play().catch(() => {}); } catch (e) {}
      });
    }

    wrap.querySelector('.qlb-player__idx').textContent = formatIdxLabel(currentIndex, sources.length, src);

    // 若用户之前开着 PiP（切视频/reload 触发），新视频 loadedmetadata 后自动续接 PiP
    if ((prevWasInPip || wantPip) && pipSupported()) {
      const autoResume = () => {
        videoEl.removeEventListener('loadedmetadata', autoResume);
        // 微延时：让浏览器在新视频 ready 后再请求，避免 InvalidStateError
        setTimeout(() => {
          if (!wantPip) return;
          enterPip().catch && enterPip().catch(() => {});
        }, 80);
      };
      if (videoEl.readyState >= 1) autoResume();
      else videoEl.addEventListener('loadedmetadata', autoResume);
    }
  }

  /**
   * 悬浮窗编号显示规则（v1.9.25 起标注 / 质检统一）：
   *   无参考图视频：
   *     原视频0/N · 视频1/N · 视频2/N …   N = 评分视频数（普通视频总数 - 1）
   *   有参考图视频：
   *     原视频0/M · 视频1/M · ... · 视频K/M · 参考图视频0/M
   *     M = 普通视频总数（原视频 + 评分视频，不含参考图）
   */
  function formatIdxLabel(i, total, videoEl) {
    if (total <= 0) return '0/0';
    let normalTotal = 0;
    let hasRef = false;
    for (const s of sources) {
      if (s.__qlbIsRef) hasRef = true;
      else normalTotal++;
    }
    // 分母：有参考图时用"普通视频数"，否则维持旧行为（total - 1，即评分视频数）
    const denom = hasRef ? normalTotal : (total - 1);
    if (videoEl && videoEl.__qlbIsRef) {
      return `参考图视频0/${denom}`;
    }
    // 计算 videoEl 在"普通视频"中是第几个（0-based）
    let normalIdx = 0;
    for (let k = 0; k < i && k < sources.length; k++) {
      if (!sources[k].__qlbIsRef) normalIdx++;
    }
    const label = normalIdx === 0 ? '原视频0' : `视频${normalIdx}`;
    return `${label}/${denom}`;
  }

  function show() {
    ensureWrap();
    refreshSources();
    if (sources.length === 0) {
      const body = wrap.querySelector('.qlb-player__body');
      body.innerHTML = '<div class="qlb-player__empty">未找到视频元素</div>';
      wrap.querySelector('.qlb-player__idx').textContent = '-/0';
    } else {
      // v1.9.8：每次打开悬浮窗都从「原视频0」（sources[0]）开始
      // 切换循环顺序：原视频0 → 视频1 → 视频2 → ... → 视频N → 参考图视频0 → 原视频0 → ...
      currentIndex = 0;
      savePrefs({ playerVideoIndex: 0 });
      renderCurrent();
    }
    wrap.style.display = 'flex';
    savePrefs({ playerVisible: true });
  }

  function hide() {
    if (wrap) wrap.style.display = 'none';
    if (videoEl) {
      // 关悬浮窗时若正处于 PiP，一并退出；否则会留下没视频源的 PiP 窗口
      if (isInPip(videoEl)) {
        try {
          if (document.pictureInPictureElement === videoEl) {
            document.exitPictureInPicture().catch(() => {});
          } else if (videoEl.webkitPresentationMode === 'picture-in-picture') {
            videoEl.webkitSetPresentationMode('inline');
          }
        } catch (e) {}
      }
      try { videoEl.pause(); } catch (e) {}
      // v1.9.43：隐藏时静音悬浮窗 video，避免 refreshAudioActiveHighlight 误判它仍是音源
      try { videoEl.muted = true; } catch (e) {}
    }
    wantPip = false;
    updatePipBtnUI(false);
    savePrefs({ playerVisible: false });
    // v1.9.43：悬浮窗关闭 → 它若曾经是音源，对应页面视频的高亮要清掉
    refreshAudioActiveHighlight();
  }

  function toggle() {
    if (!wrap || wrap.style.display === 'none') show();
    else hide();
  }

  function init() {
    // 核心：直接给页面所有原生视频打上循环
    forceLoopAllNativeVideos();
    observeNewVideos();

    // 窗口尺寸变化时自动把悬浮窗约束回视口内（防止拖拽后缩小浏览器 / 切换屏幕导致丢失）
    window.addEventListener('resize', () => {
      if (!wrap || wrap.style.display === 'none') return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const rect = wrap.getBoundingClientRect();
      let x = rect.left, y = rect.top;
      let changed = false;
      if (rect.right > vw) { x = Math.max(0, vw - rect.width); changed = true; }
      if (rect.bottom > vh) { y = Math.max(0, vh - rect.height); changed = true; }
      if (rect.left < 0) { x = 0; changed = true; }
      if (rect.top < 0) { y = 0; changed = true; }
      if (changed) {
        wrap.style.left = x + 'px';
        wrap.style.top = y + 'px';
        wrap.style.right = 'auto';
        wrap.style.bottom = 'auto';
        savePrefs({ playerX: Math.round(x), playerY: Math.round(y) });
      }
    });

    // 悬浮窗默认不开（用户点工具栏按钮才出现）
    // 如需沿用上次偏好可取消下一行注释：
    // if (state.prefs.playerVisible) show();
  }

  /**
   * 外部（如提交后）调用：重新扫描视频列表并重新渲染当前视频。
   * - 如果悬浮窗是显示状态：切回第 0 个视频并播放
   * - 如果没显示：仅更新 sources 供下次 show 使用
   */
  function reload() {
    refreshSources();
    if (!wrap || wrap.style.display === 'none') return;
    const body = wrap.querySelector('.qlb-player__body');
    if (sources.length === 0) {
      body.innerHTML = '<div class="qlb-player__empty">未找到视频元素</div>';
      wrap.querySelector('.qlb-player__idx').textContent = '-/0';
      return;
    }
    currentIndex = 0; // 新一批视频 → 回到原视频(0)
    savePrefs({ playerVideoIndex: 0 });
    renderCurrent();
  }

  global.QLBPlayer = {
    init, show, hide, toggle, resetPos,
    refreshSources, forceLoopAllNativeVideos, setAutoLoop, reload,
    togglePip, enterPip, exitPip, pipSupported
  };
})(window);
