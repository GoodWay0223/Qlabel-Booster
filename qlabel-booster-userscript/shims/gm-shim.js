/**
 * gm-shim.js
 *
 * Tampermonkey 环境下模拟 Chrome 扩展 API，让原插件代码零改动运行。
 *
 * 需要兼容的 API：
 *   - chrome.runtime.getManifest()    → 返回 { version: ..., name: ... }
 *   - chrome.storage.local.get/set    → GM_getValue / GM_setValue
 *   - chrome.storage.onChanged        → GM_addValueChangeListener
 *
 * 所有代码在 Tampermonkey 脚本顶部 IIFE 里跑，这里把 `chrome` 对象挂到 window，
 * 让后续 content script 代码能直接使用 chrome.xxx 而不报 ReferenceError。
 */
(function installGMShim() {
  'use strict';

  // Tampermonkey 提供的 GM_info 包含脚本 meta 信息
  const scriptVersion = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '0.0.0';
  const scriptName = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.name) || 'QLabel Booster';

  // 如果已经有真实的 chrome（插件环境）则不 shim，避免干扰
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    return;
  }

  const shim = {
    runtime: {
      getManifest() {
        return { version: scriptVersion, name: scriptName };
      },
      // 兼容可能的调用，无任何副作用
      sendMessage: () => {},
      onMessage: { addListener: () => {}, removeListener: () => {} }
    },

    storage: {
      local: {
        /**
         * get(keysOrCb, cb?)
         * - chrome.storage.local.get(['a','b'], (obj) => ...)
         * - chrome.storage.local.get('a', (obj) => ...)
         * - chrome.storage.local.get(null, (obj) => ...)         ← 拿全部
         * - chrome.storage.local.get({ a: 默认值 }, (obj) => ...) ← 带默认
         */
        get(keysOrCb, cb) {
          // 形式 1: get(cb)
          if (typeof keysOrCb === 'function' && cb === undefined) {
            cb = keysOrCb;
            keysOrCb = null;
          }
          const result = {};
          try {
            let keys;
            if (keysOrCb === null || keysOrCb === undefined) {
              // 取全部：GM_listValues 返回当前脚本的所有 key
              keys = (typeof GM_listValues === 'function') ? GM_listValues() : [];
              keys.forEach(k => {
                result[k] = GM_getValue(k);
              });
            } else if (typeof keysOrCb === 'string') {
              result[keysOrCb] = GM_getValue(keysOrCb);
            } else if (Array.isArray(keysOrCb)) {
              keysOrCb.forEach(k => {
                const v = GM_getValue(k);
                if (v !== undefined) result[k] = v;
              });
            } else if (typeof keysOrCb === 'object') {
              // 带默认值的对象形式
              Object.keys(keysOrCb).forEach(k => {
                const v = GM_getValue(k, keysOrCb[k]);
                result[k] = v;
              });
            }
          } catch (e) {
            /* ignore */
          }
          if (typeof cb === 'function') {
            // 保持异步语义（chrome.storage 是异步回调）
            Promise.resolve().then(() => cb(result));
          }
          // chrome MV3 里 get 也返回 Promise（如果没有 cb）
          return Promise.resolve(result);
        },

        /**
         * set(obj, cb?)
         */
        set(obj, cb) {
          try {
            Object.keys(obj).forEach(k => {
              GM_setValue(k, obj[k]);
            });
          } catch (e) {
            /* ignore */
          }
          if (typeof cb === 'function') {
            Promise.resolve().then(() => cb());
          }
          return Promise.resolve();
        },

        /**
         * remove(keys, cb?)
         */
        remove(keys, cb) {
          try {
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(k => {
              if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
            });
          } catch (e) {
            /* ignore */
          }
          if (typeof cb === 'function') {
            Promise.resolve().then(() => cb());
          }
          return Promise.resolve();
        }
      }
    },

    /**
     * storage.onChanged 的监听器分发：
     * 用 GM_addValueChangeListener 给每个 DEFAULTS key 注册，统一转成 chrome 风格事件。
     */
    _changeListeners: [],
    _changeRegistered: new Set()
  };

  shim.storage.onChanged = {
    addListener(fn) {
      shim._changeListeners.push(fn);
    },
    removeListener(fn) {
      const i = shim._changeListeners.indexOf(fn);
      if (i >= 0) shim._changeListeners.splice(i, 1);
    }
  };

  /**
   * 外部（state.js）会用已知 key 列表调用 chrome.storage.onChanged.addListener。
   * 我们需要给每个 key 注册 GM_addValueChangeListener，然后把事件聚合到 chrome 风格。
   *
   * 但 state.js 的监听时机比这里晚，所以我们做惰性注册：
   * 当第一次 addListener 触发时，遍历当前所有 key 注册 GM 监听器。
   *
   * 注意：GM_addValueChangeListener 只会触发"本脚本内写入"引起的变化（或其他标签页）。
   */
  function registerGMListeners() {
    if (typeof GM_addValueChangeListener !== 'function') return;
    try {
      const keys = (typeof GM_listValues === 'function') ? GM_listValues() : [];
      keys.forEach(k => {
        if (shim._changeRegistered.has(k)) return;
        shim._changeRegistered.add(k);
        GM_addValueChangeListener(k, (name, oldVal, newVal, remote) => {
          const change = { [name]: { oldValue: oldVal, newValue: newVal } };
          shim._changeListeners.forEach(fn => {
            try { fn(change, 'local'); } catch (e) {}
          });
        });
      });
    } catch (e) {}
  }

  // 延迟注册：等 state.js 先写入过一些 key 之后再绑监听
  setTimeout(registerGMListeners, 100);
  setTimeout(registerGMListeners, 1000);
  setTimeout(registerGMListeners, 3000);

  // 挂到 window（和真实 chrome 一样的访问方式）
  try {
    window.chrome = shim;
  } catch (e) {
    // 某些网页把 chrome 对象 freeze 了；退而求其次只挂我们需要的子对象
    try { Object.defineProperty(window, 'chrome', { value: shim, writable: true, configurable: true }); } catch (er) {}
  }
})();
