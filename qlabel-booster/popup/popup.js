/* popup.js —— 设置面板 */
(function () {
  'use strict';

  // v1.9.9：popup 只保留有真实代码消费的开关。
  // 之前的 playerVisible / highlightFocus 在 content script 里没有被读取过，是死配置 —— 已删除。
  const DEFAULTS = {
    enableShortcuts: true
  };
  const KEYS = Object.keys(DEFAULTS);

  function load() {
    chrome.storage.local.get(KEYS, (obj) => {
      const v = { ...DEFAULTS, ...obj };
      for (const k of KEYS) {
        const el = document.getElementById(k);
        if (el) el.checked = !!v[k];
      }
    });
  }

  function bind() {
    for (const k of KEYS) {
      const el = document.getElementById(k);
      if (!el) continue;
      el.addEventListener('change', () => {
        chrome.storage.local.set({ [k]: el.checked });
      });
    }
  }

  function applyVersion() {
    try {
      const v = chrome.runtime.getManifest().version;
      const txt = 'v' + v;
      const top = document.getElementById('verTop');
      const bottom = document.getElementById('verBottom');
      if (top) top.textContent = txt;
      if (bottom) bottom.textContent = txt;
    } catch (e) {
      // ignore
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyVersion();
    load();
    bind();
  });
})();

