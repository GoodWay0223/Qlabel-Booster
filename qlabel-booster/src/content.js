/**
 * content.js
 * 多 frame 智能启动：
 *   - 顶层 frame（无题目，外壳页）：只做最小初始化（视频循环 + 调试钩子），不出工具栏
 *   - iframe（有题目）：完整启动工具栏 + 键盘 + 拦截
 *   - 顶层把按键事件兜底转发给所有 iframe（防止焦点在外层时按键丢失）
 */
(function () {
  'use strict';

  const isTop = window.top === window.self;
  const tag = isTop ? 'TOP' : 'IFRAME';
  // v1.9.9：日志改为受控输出。设置 window.__QLB_VERBOSE__ = true 可打开
  const log = (...args) => {
    if (!window.__QLB_VERBOSE__) return;
    console.log(`%c[QLB:${tag}]`, 'color:#3b82f6;font-weight:bold', ...args);
  };
  const warn = (...args) => console.warn(`[QLB:${tag}]`, ...args);

  const { getAllQuestionGroups } = window.QLBSelectors;
  const { loadPrefs } = window.QLBState;

  let bootTimer = null;
  let lastHref = location.href;
  let earlyBooted = false;
  let fullBooted = false;
  /** 当前已启动的模式：'label' | 'qa' | null */
  let activeMode = null;

  function hasQuestions() {
    // v1.9.61：之前只看 getAllQuestionGroups（仅标注题），导致质检模式 iframe
    // 因为题目都是"通过/不通过"被过滤，hasQuestions=false → fullBoot 永不启动 → 工具栏永远不出
    // 现在：标注题（数字分值）或 质检题（通过/不通过）任一存在都算"有题"
    if (getAllQuestionGroups().length > 0) return true;
    // 质检题特征
    return !!(
      document.querySelector('label[name="通过"]') ||
      document.querySelector('label[name="不通过"]')
    );
  }

  /** 切换模式：teardown 旧模式 → init 新模式 */
  function switchMode(newMode) {
    if (activeMode === newMode) return;
    log(`模式切换：${activeMode || '无'} → ${newMode}`);
    // teardown 旧
    if (activeMode === 'qa') {
      try { window.QLBQA && window.QLBQA.teardown && window.QLBQA.teardown(); } catch (e) { warn('QA teardown 失败', e); }
    } else if (activeMode === 'label') {
      // 标注模式无显式 teardown：用户的标注流之前一直常驻，这里仅清理可能残留的 UI 标记
      document.body.classList.remove('qlb-mode-label');
    }
    // init 新
    if (newMode === 'qa') {
      try { window.QLBQA && window.QLBQA.init && window.QLBQA.init(); } catch (e) { warn('QA init 失败', e); }
    } else if (newMode === 'label') {
      document.body.classList.add('qlb-mode-label');
      // 标注模块的 init 已在 fullBoot 里完成；这里仅打开它的 UI 可见性即可
    }
    activeMode = newMode;
    // 通知 toolbar 刷新模式相关的按钮
    try { window.QLBToolbar && window.QLBToolbar.applyModeUI && window.QLBToolbar.applyModeUI(newMode); } catch (e) {}
  }

  async function earlyBoot() {
    if (earlyBooted) return;
    await loadPrefs();
    // 视频循环：所有 frame 都启用
    try {
      window.QLBPlayer.init();
    } catch (e) { warn('Player init 失败', e); }
    earlyBooted = true;
    log(`早期初始化完成（视频 ${document.querySelectorAll('video').length}）`);
  }

  function fullBoot() {
    if (fullBooted) return;
    // v1.9.61：用宽松版 hasQuestions（标注题 + 质检题）替代旧的只算标注题的 getAllQuestionGroups
    if (!hasQuestions()) return;
    const n = getAllQuestionGroups().length || document.querySelectorAll('label[name="通过"]').length;

    // v1.9.60：回退 v1.9.59 的过严守卫
    // v1.9.59 在 mode === 'unknown' 时直接 return，导致："iframe 里有题但 mode 检测因
    // 跨域读不到 top.body 文本而返回 unknown" 这种正常情况下工具栏永远装不上。
    // 现在策略：题目数 ≥ 1 就装工具栏，mode 检测不出来就先按 label 兜底，
    // 后续 tick 里 detect() 会自动纠正模式。
    let detectedMode = window.QLBMode ? window.QLBMode.detect() : 'label';
    if (detectedMode === 'unknown') {
      // 兜底为标注模式（数量更多，且首次启动 UI 体验更佳）
      // tick 内每秒会重 detect，识别成功后 switchMode 会切到正确模式
      detectedMode = 'label';
    }

    // 工具栏：只在题目所在的 frame 里出现
    try {
      window.QLBToolbar.init();
    } catch (e) { warn('Toolbar init 失败', e); }
    try {
      window.QLBNavigator.init();
    } catch (e) { warn('Navigator init 失败', e); }
    try {
      window.QLBMissing.init();
    } catch (e) { warn('Missing init 失败', e); }
    try {
      window.QLBScrollSync && window.QLBScrollSync.init();
    } catch (e) { warn('ScrollSync init 失败', e); }
    try {
      window.QLBWheelPan && window.QLBWheelPan.init();
    } catch (e) { warn('WheelPan init 失败', e); }
    // v1.9.69：草稿自动保存 —— 不依赖 QLabel 后端，每次打分本地持久化，
    //          用户刷新/关标签/视频加载失败后可恢复
    try {
      window.QLBDraft && window.QLBDraft.init();
    } catch (e) { warn('Draft init 失败', e); }

    fullBooted = true;
    window.__QLB_BOOTED__ = true;

    // 根据当前页面模式启动对应专属模块
    switchMode(detectedMode);

    log(`完整初始化完成（题目 ${n}），模式：${detectedMode}，快捷键已启用 ✅`);
  }

  function tick() {
    earlyBoot();
    if (!fullBooted && hasQuestions()) {
      fullBoot();
    } else if (fullBooted) {
      try {
        // 模式可能在 SPA 切任务后变化（标注 ↔ 质检）
        if (window.QLBMode) {
          const m = window.QLBMode.detect();
          if (m !== 'unknown' && m !== activeMode) switchMode(m);
        }
        // 仅在标注模式下注入打分胶囊和更新进度
        if (activeMode === 'label') {
          window.QLBToolbar.injectColumnAndDimensionButtons();
          window.QLBToolbar.updateProgress();
        } else if (activeMode === 'qa') {
          window.QLBQA && window.QLBQA.refresh && window.QLBQA.refresh();
          window.QLBToolbar && window.QLBToolbar.updateProgress && window.QLBToolbar.updateProgress();
        }
        window.QLBPlayer.forceLoopAllNativeVideos();
        window.QLBScrollSync && window.QLBScrollSync.detectTracks();
      } catch (e) {}
    }
  }

  function observeDom() {
    const ob = new MutationObserver(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        fullBooted = false;
        window.__QLB_BOOTED__ = false;
      }
      if (bootTimer) return;
      bootTimer = setTimeout(() => {
        bootTimer = null;
        tick();
      }, 200);
    });
    ob.observe(document.documentElement, { subtree: true, childList: true });
  }

  // ========== 跨 frame 键盘事件兜底 ==========
  // 顶层把按键转发给所有 iframe，iframe 收到 postMessage 转成合成 KeyboardEvent
  function setupCrossFrameKey() {
    if (isTop) {
      // 顶层：监听键盘，转发到 iframe
      document.addEventListener(
        'keydown',
        (e) => {
          // 不转发输入框里的按键
          const t = e.target;
          if (t) {
            const tn = (t.tagName || '').toLowerCase();
            if (tn === 'input' || tn === 'textarea' || tn === 'select' || t.isContentEditable) return;
          }
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const keys = ['1', '2', '3', '4', 'n', 'N', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'];
          if (!keys.includes(e.key)) return;
          // 广播到所有 iframe
          document.querySelectorAll('iframe').forEach((f) => {
            try {
              f.contentWindow &&
                f.contentWindow.postMessage(
                  { __qlb__: true, type: 'key', key: e.key, shiftKey: e.shiftKey },
                  '*'
                );
            } catch (err) {}
          });
        },
        true
      );
      log('顶层键盘转发已就绪');
    } else {
      // iframe：监听 postMessage，模拟按键
      window.addEventListener('message', (ev) => {
        const d = ev.data;
        if (!d || d.__qlb__ !== true || d.type !== 'key') return;
        // 直接复用 navigator 的处理逻辑：合成一个 KeyboardEvent 派发到 document
        try {
          const fake = new KeyboardEvent('keydown', {
            key: d.key,
            shiftKey: !!d.shiftKey,
            bubbles: true,
            cancelable: true
          });
          // 标记一下，避免被自己 navigator 又转发出去（只做接收）
          fake.__qlbForwarded = true;
          document.dispatchEvent(fake);
        } catch (e) {}
      });
    }
  }

  function start() {
    log('内容脚本加载，URL:', location.href);
    // v1.9.78：管理员后台快速切换浮动条（独立于 hasQuestions，最早期启动）
    try { window.QLBAdminSwitcher && window.QLBAdminSwitcher.init(); } catch (e) {}
    tick();
    observeDom();
    setupCrossFrameKey();
    setTimeout(tick, 3000);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // 控制台调试入口
  window.QLB = {
    isTop,
    debug() {
      return {
        frame: isTop ? 'TOP' : 'IFRAME',
        url: location.href,
        earlyBooted,
        fullBooted,
        mode: window.QLBMode ? window.QLBMode.current : 'unknown',
        questions: getAllQuestionGroups().length,
        videos: document.querySelectorAll('video').length,
        hasToolbar: !!document.getElementById('qlb-toolbar'),
        selectors: {
          '.cr-radio-group': document.querySelectorAll('.cr-radio-group').length,
          '.tea-form-check-group': document.querySelectorAll('.tea-form-check-group').length,
          'label.tea-form-check': document.querySelectorAll('label.tea-form-check').length,
          'label[name="通过"]': document.querySelectorAll('label.tea-form-check[name="通过"]').length,
          '.cr-container-col--10': document.querySelectorAll('.cr-container-col--10').length,
          '.cr-container-col': document.querySelectorAll('.cr-container-col').length,
          'iframe': document.querySelectorAll('iframe').length
        }
      };
    },
    rescan: tick,
    focusFirst: () => {
      if (window.QLBMode && window.QLBMode.current === 'qa' && window.QLBQA) return window.QLBQA.focusFirstUnanswered();
      return window.QLBNavigator.focusFirstUnanswered();
    },
    scoreAll: (s) => window.QLBScorer.scoreAll(s),
    qa: () => window.QLBQA && window.QLBQA.debug && window.QLBQA.debug(),
    scrollSync: () => callInBestFrame('scrollSync'),
    scrollSyncHighlight: () => callInBestFrame('scrollSyncHighlight'),
    whyUnanswered: () => callInBestFrame('whyUnanswered'),
    scanMissing: () => callInBestFrame('scanMissing'),
    /** v1.9.17：进度计数诊断 */
    debugProgress: () => callInBestFrame('debugProgress'),
    /** 列出所有 frame 的 QLB 状态（在 TOP 跑有意义） */
    frames() {
      const rows = [{
        frame: 'TOP',
        url: location.href,
        hasQLB: !!window.QLB,
        questions: window.QLB ? window.QLB.debug().questions : 0,
        videos: window.QLB ? window.QLB.debug().videos : 0
      }];
      document.querySelectorAll('iframe').forEach((f, i) => {
        let hasQLB = '(跨域无法访问)', q = '?', v = '?', url = f.src || '(about:blank)';
        try {
          hasQLB = !!f.contentWindow.QLB;
          if (hasQLB && f.contentWindow.QLB.debug) {
            const d = f.contentWindow.QLB.debug();
            q = d.questions; v = d.videos;
          }
        } catch (e) {}
        rows.push({ frame: 'IFRAME#' + i, url, hasQLB, questions: q, videos: v });
      });
      console.table(rows);
      return rows;
    }
  };

  /**
   * 让 TOP 里跑 QLB.scrollSync() 也能自动代理到"真正有题目的 iframe"。
   * 这样用户不用再手动切换控制台的 frame context。
   */
  function callInBestFrame(method) {
    // 当前 frame 有题目就直接用自己
    if (getAllQuestionGroups().length > 0 && window.QLBScrollSync) {
      const fn = {
        scrollSync: () => window.QLBScrollSync.debug(),
        scrollSyncHighlight: () => window.QLBScrollSync.highlight(),
        whyUnanswered: () => window.QLBMissing && window.QLBMissing.whyUnanswered(),
        scanMissing: () => window.QLBMissing && window.QLBMissing.scanMissingDetailed(),
        debugProgress: () => window.QLBScorer && window.QLBScorer.debugProgress && window.QLBScorer.debugProgress()
      }[method];
      return fn ? fn() : undefined;
    }
    // 否则在 iframe 中寻找一个有题目的并调用它的 QLB.<method>
    const frames = document.querySelectorAll('iframe');
    for (const f of frames) {
      try {
        const w = f.contentWindow;
        if (w && w.QLB && w.QLB.debug) {
          const info = w.QLB.debug();
          if (info.questions > 0 || info.videos > 0) {
            console.log(`%c[QLB] 自动代理到 iframe：${f.src || '(about:blank)'}`, 'color:#10b981');
            if (typeof w.QLB[method] === 'function') {
              return w.QLB[method]();
            }
          }
        }
      } catch (e) { /* 跨域 */ }
    }
    console.warn('[QLB] 没找到含题目的 iframe。请直接在右侧控制台顶部下拉框选到评估页 iframe 后再试。\n或先跑 QLB.frames() 查看所有 frame。');
  }

  // ========== 把 QLB 桥接到页面主世界（Page / Main World） ==========
  // v1.9.18：之前用 createElement('script') + textContent 注入桥接代码，被站点 CSP 阻断
  //          (Executing inline script violates CSP directive 'script-src ...')。
  // 现在改用 manifest 声明的第二个 content script src/page-bridge.js（with "world": "MAIN"），
  // 不依赖 inline 脚本注入，CSP 完全放行。
  // 本文件只保留"页面世界 → isolated"的消息响应监听。

  // 响应页面世界的调用请求
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.__qlb_bridge__ !== true || d.dir !== 'req') return;
    const { id, method, args } = d;
    Promise.resolve().then(() => {
      const fn = window.QLB && window.QLB[method];
      if (typeof fn !== 'function') throw new Error('unknown method: ' + method);
      return fn.apply(window.QLB, args || []);
    }).then((result) => {
      // 结果要是 structured-clonable 的。DOM 节点、循环引用直接丢 → 转成摘要
      let safeResult;
      try {
        safeResult = JSON.parse(JSON.stringify(result, (k, v) => {
          if (v && typeof v === 'object' && v.nodeType) {
            return `<${v.tagName || 'NODE'}${v.id ? '#' + v.id : ''}${v.className ? '.' + String(v.className).replace(/\s+/g, '.') : ''}>`;
          }
          return v;
        }));
      } catch (e) {
        safeResult = String(result);
      }
      window.postMessage({ __qlb_bridge__: true, dir: 'res', id, result: safeResult }, '*');
    }).catch((err) => {
      window.postMessage({ __qlb_bridge__: true, dir: 'res', id, error: String(err && err.message || err) }, '*');
    });
  });

  // v1.9.18：桥接代码已迁移到 src/page-bridge.js (manifest world: "MAIN")，无需 inline 注入
})();
