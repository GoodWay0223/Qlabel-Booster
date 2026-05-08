/**
 * platform.js
 * 系统识别 + 快捷键符号本地化。
 *
 * 用途：让帮助弹窗 / tooltip / 提示文案在 mac 显示 ⌘ ⇧ ⌥，在 win/linux 显示 Ctrl Shift Alt。
 *
 * 检测优先级：
 *   1) navigator.userAgentData.platform（新 API，Chrome 90+）
 *   2) navigator.platform（兼容老 API）
 *   3) navigator.userAgent
 *
 * 用法：
 *   QLBPlatform.isMac          // true / false
 *   QLBPlatform.os             // 'mac' | 'win' | 'linux' | 'unknown'
 *   QLBPlatform.kbd('cmd')     // mac → '⌘' / win → 'Ctrl'
 *   QLBPlatform.kbd('shift')   // mac → '⇧' / win → 'Shift'
 *   QLBPlatform.kbd('alt')     // mac → '⌥' / win → 'Alt'
 *   QLBPlatform.combo('cmd+shift+p')  // mac → '⌘+⇧+P' / win → 'Ctrl+Shift+P'
 */
(function (global) {
  'use strict';

  function detectOS() {
    try {
      // 1) 新 API
      if (navigator.userAgentData && navigator.userAgentData.platform) {
        const p = navigator.userAgentData.platform.toLowerCase();
        if (p.includes('mac')) return 'mac';
        if (p.includes('win')) return 'win';
        if (p.includes('linux')) return 'linux';
      }
      // 2) 老 API
      const plat = (navigator.platform || '').toLowerCase();
      if (plat.includes('mac') || plat.includes('iphone') || plat.includes('ipad')) return 'mac';
      if (plat.includes('win')) return 'win';
      if (plat.includes('linux')) return 'linux';
      // 3) UA 兜底
      const ua = (navigator.userAgent || '').toLowerCase();
      if (ua.includes('mac os') || ua.includes('macintosh')) return 'mac';
      if (ua.includes('windows')) return 'win';
      if (ua.includes('linux')) return 'linux';
    } catch (e) {}
    return 'unknown';
  }

  const os = detectOS();
  const isMac = os === 'mac';
  const isWin = os === 'win';

  /** mac 与 win/linux 的按键符号映射 */
  const KEY_MAP = isMac
    ? {
        cmd: '⌘',
        ctrl: '⌃',
        shift: '⇧',
        alt: '⌥',
        opt: '⌥',
        enter: '↩',
        backspace: '⌫',
        delete: '⌦',
        tab: '⇥',
        esc: 'Esc',
        // mac 键盘上 cmd 是主修饰键
        mod: '⌘'
      }
    : {
        cmd: 'Ctrl',
        ctrl: 'Ctrl',
        shift: 'Shift',
        alt: 'Alt',
        opt: 'Alt',
        enter: 'Enter',
        backspace: 'Backspace',
        delete: 'Del',
        tab: 'Tab',
        esc: 'Esc',
        mod: 'Ctrl'
      };

  /** 把按键名（如 'cmd', 'shift'）转为对应系统的符号 */
  function kbd(name) {
    if (!name) return '';
    const k = String(name).toLowerCase().trim();
    return KEY_MAP[k] !== undefined ? KEY_MAP[k] : name;
  }

  /**
   * 把组合键描述（如 'cmd+shift+p'）转为该系统的人类可读字符串
   *   mac: '⌘+⇧+P'
   *   win: 'Ctrl+Shift+P'
   */
  function combo(desc) {
    if (!desc) return '';
    const parts = String(desc).split(/\s*\+\s*/);
    return parts
      .map((p) => {
        const lo = p.toLowerCase();
        if (KEY_MAP[lo] !== undefined) return KEY_MAP[lo];
        // 单字符键：保持大写
        if (p.length === 1) return p.toUpperCase();
        return p;
      })
      .join('+');
  }

  /**
   * 生成 HTML 形式的快捷键提示，每段都包在 <kbd> 标签里。
   * 用于帮助弹窗：combHTML('cmd+shift+p') → '<kbd>⌘</kbd>+<kbd>⇧</kbd>+<kbd>P</kbd>'
   */
  function combHTML(desc) {
    if (!desc) return '';
    const parts = String(desc).split(/\s*\+\s*/);
    return parts
      .map((p) => {
        const lo = p.toLowerCase();
        const sym = KEY_MAP[lo] !== undefined ? KEY_MAP[lo] : (p.length === 1 ? p.toUpperCase() : p);
        return `<kbd>${sym}</kbd>`;
      })
      .join('+');
  }

  global.QLBPlatform = {
    os,
    isMac,
    isWin,
    isLinux: os === 'linux',
    kbd,
    combo,
    combHTML
  };

  // v1.9.9：日志改为只在调试模式下输出，避免每个 frame（顶层 + 多个 iframe）都打日志
  if (window.__QLB_VERBOSE__ && typeof console !== 'undefined' && console.debug) {
    console.debug('[QLB:Platform] os =', os, isMac ? '(macOS)' : isWin ? '(Windows)' : '');
  }
})(window);
