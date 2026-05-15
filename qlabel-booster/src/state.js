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
    // v1.9.48：维度（类别）胶囊打分后是否自动跳到下一未答题
    // v1.9.49：曾默认 false，因当时跳转会同时滚视口打扰用户
    // v1.9.67：默认改为 true。理由：v1.9.65 已经把"焦点移动"和"视口滚动"解耦，
    //         关闭开关时焦点不动但视口也不滚（最不打扰），开启时焦点 + 视口都跟随
    //         默认开启更符合"打完一题继续打下一题"的连续工作流
    advanceAfterDimension: true,
    // v1.9.72：美学专项（1-10）模板下的独立开关，默认关闭
    // 新模板每题之间有 textarea 评分原因，需要用户写理由，自动跳转会打扰填写节奏
    advanceAfterDimensionAesthetic10: false
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

  /** v1.9.72：根据当前模板，读"维度打分后自动跳转"的开关
   *  - label-aesthetic10 → 用 advanceAfterDimensionAesthetic10（默认 false）
   *  - 其它模板 → 用 advanceAfterDimension（默认 true）
   */
  function getAdvanceAfterDimension() {
    try {
      const tpl = (global.QLBMode && global.QLBMode.template) || 'label-old4';
      if (tpl === 'label-aesthetic10') {
        return state.prefs.advanceAfterDimensionAesthetic10 === true;
      }
      return state.prefs.advanceAfterDimension === true;
    } catch (e) {
      return state.prefs.advanceAfterDimension === true;
    }
  }

  /** v1.9.72：根据当前模板写开关 */
  function setAdvanceAfterDimension(v) {
    try {
      const tpl = (global.QLBMode && global.QLBMode.template) || 'label-old4';
      if (tpl === 'label-aesthetic10') {
        return savePrefs({ advanceAfterDimensionAesthetic10: !!v });
      }
      return savePrefs({ advanceAfterDimension: !!v });
    } catch (e) {}
  }

  global.QLBState = { state, DEFAULTS, loadPrefs, savePrefs, onPrefsChange, getAdvanceAfterDimension, setAdvanceAfterDimension };
})(window);
