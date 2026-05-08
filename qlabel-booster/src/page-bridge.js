/**
 * page-bridge.js
 *
 * 运行在 Page / Main World（manifest 里 "world": "MAIN"），目的是让用户在 DevTools
 * 默认 context 下也能直接调用 window.QLB.xxx()，无需切到 isolated content script context。
 *
 * v1.9.18：
 *   之前 content.js 用 createElement('script') + script.textContent 注入桥接代码，
 *   被站点 CSP（'self' 'wasm-unsafe-eval' 'inline-speculation-rules'，无 'unsafe-inline'）
 *   阻断 → 报 "Executing inline script violates CSP directive"。
 *   改用 manifest 声明的 world: "MAIN" content script 注入，CSP 不限制此机制。
 *
 * 通信协议（与 content.js 中的 isolated 监听器一致）：
 *   page → isolated: { __qlb_bridge__: true, dir: 'req', id, method, args }
 *   isolated → page: { __qlb_bridge__: true, dir: 'res', id, result | error }
 */
(function () {
  'use strict';
  if (window.QLB && window.QLB.__bridged) return;

  const pending = new Map();
  let seq = 0;

  function call(method, args) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      window.postMessage({ __qlb_bridge__: true, dir: 'req', id, method, args: args || [] }, '*');
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('QLB bridge timeout (5s)'));
        }
      }, 5000);
    });
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || d.__qlb_bridge__ !== true || d.dir !== 'res') return;
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if (d.error) p.reject(new Error(d.error));
    else p.resolve(d.result);
  });

  window.QLB = {
    __bridged: true,
    _call: call,
    debug: () => call('debug'),
    frames: () => call('frames'),
    rescan: () => call('rescan'),
    focusFirst: () => call('focusFirst'),
    scoreAll: (s) => call('scoreAll', [s]),
    scrollSync: () => call('scrollSync'),
    scrollSyncHighlight: () => call('scrollSyncHighlight'),
    whyUnanswered: () => call('whyUnanswered'),
    scanMissing: () => call('scanMissing'),
    debugProgress: () => call('debugProgress')
  };

  // 只在 top frame 打提示，避免每个 iframe 都刷一行
  if (window.top === window.self) {
    console.log(
      '%c[QLB] 页面主世界桥已就绪，可直接调用 QLB.debug() / QLB.debugProgress() 等',
      'color:#10b981;font-weight:bold'
    );
  }
})();
