/**
 * state.js
 * 全局状态与用户偏好。
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    enableShortcuts: true,
    playerVisible: true,
    playerX: null,
    playerY: null,
    playerW: 360,
    playerH: 220,
    playerRate: 1,
    playerVideoIndex: 0,
    highlightFocus: true,
    toolbarCollapsed: false,
    autoLoopVideos: true,
    toolbarX: null,
    toolbarY: null,
    // v1.9.23：同步滚动默认开启（之前是 false，很多新用户不知道这个功能存在）
    syncScroll: true,
    wheelPan: true,
    // v1.9.48：维度（类别）胶囊打分后是否自动跳到下一未答题。默认 false（用户偏好不打扰）
    advanceAfterDimension: false
  };

  // v1.9.23：一次性迁移键 —— 用于把"v1.9.22 及之前用户本地已存的 syncScroll=false"
  // 翻回默认开启。只执行一次，之后用户仍可在工具栏里自由关闭，不会被反复覆盖。
  const MIGRATION_KEY = '__qlb_migration_v1923_syncScroll';

  const state = {
    prefs: { ...DEFAULTS },
    // 当前聚焦题目引用
    focusedGroup: null,
    // 撤销栈：[{group, prevScore}]
    undoStack: [],
    // 初始化标记
    initialized: false
  };

  async function loadPrefs() {
    try {
      const keys = Object.keys(DEFAULTS).concat([MIGRATION_KEY]);
      const obj = await chrome.storage.local.get(keys);
      state.prefs = { ...DEFAULTS, ...obj };

      // v1.9.23：一次性迁移 —— 老用户之前被默认关闭过同步滚动，把它翻回开启。
      // 迁移标记落盘后就不会再触发，用户后续自由关闭不会被覆盖。
      if (!obj[MIGRATION_KEY]) {
        if (state.prefs.syncScroll === false) {
          state.prefs.syncScroll = true;
          try { chrome.storage.local.set({ syncScroll: true }); } catch (e) {}
        }
        try { chrome.storage.local.set({ [MIGRATION_KEY]: 1 }); } catch (e) {}
      }
    } catch (e) {
      state.prefs = { ...DEFAULTS };
    }
    return state.prefs;
  }

  function savePrefs(patch) {
    Object.assign(state.prefs, patch);
    try {
      chrome.storage.local.set(patch);
    } catch (e) {
      /* noop */
    }
  }

  /**
   * v1.9.9：监听跨上下文（popup ↔ content script）的存储变化，让用户在 popup 改完
   * 开关后立即生效，无需刷新页面。
   *
   * 注意：savePrefs 调用 chrome.storage.local.set 也会触发本监听 → state.prefs 重复赋值
   * 一次（无害，值相同）；且我们要避免回调里再去 savePrefs 形成死循环。
   */
  const listeners = [];
  function onPrefsChange(cb) {
    if (typeof cb === 'function') listeners.push(cb);
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = {};
      let touched = false;
      for (const k of Object.keys(changes)) {
        if (k in DEFAULTS) {
          patch[k] = changes[k].newValue;
          state.prefs[k] = changes[k].newValue;
          touched = true;
        }
      }
      if (!touched) return;
      listeners.forEach((cb) => {
        try { cb(patch); } catch (e) { /* ignore */ }
      });
    });
  } catch (e) {
    /* 某些受限环境不支持 onChanged */
  }

  global.QLBState = { state, DEFAULTS, loadPrefs, savePrefs, onPrefsChange };
})(window);
