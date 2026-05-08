/**
 * mode.js
 * 识别当前页面是「标注」还是「质检」任务。
 *
 * 判定优先级（从最稳到最弱）：
 *   A. iframe DOM 特征（最准）：
 *      - 含 label.tea-form-check[name="通过"] / [name="不通过"] → 质检
 *      - 含 label.tea-form-check[name="0"] 等数字分值 → 标注
 *   B. 顶层 frame 标题文字：含「质检」→ qa；含「标注」→ label
 *   C. URL 关键词兜底（保留扩展性）
 *
 * 暴露：
 *   QLBMode.detect()  → 'qa' | 'label' | 'unknown'
 *   QLBMode.is(name)  → boolean
 *   QLBMode.onChange(cb) → 模式变化通知（页面切任务时）
 *   QLBMode.current   → 当前缓存值
 */
(function (global) {
  'use strict';

  let _current = 'unknown';
  const listeners = new Set();

  /** 在当前 document 里检测特征 */
  function detectInDoc(doc) {
    // 1) 质检特征：是否通过/不通过 radio
    const passLabel = doc.querySelector('label.tea-form-check[name="通过"]');
    const failLabel = doc.querySelector('label.tea-form-check[name="不通过"]');
    if (passLabel || failLabel) return 'qa';

    // 2) 标注特征：数字分值 radio
    const scoreLabel = doc.querySelector(
      'label.tea-form-check[name="0"], label.tea-form-check[name="0.5"], label.tea-form-check[name="1"], label.tea-form-check[name="none"]'
    );
    if (scoreLabel) return 'label';

    return null;
  }

  /** 试着从顶层 window（如果可访问）拿任务标题 */
  function detectFromTopTitle() {
    try {
      const w = window.top;
      if (!w) return null;
      // 顶层文档可能跨域，try/catch 包住
      const txt = ((w.document && w.document.body && w.document.body.innerText) || '').slice(0, 4000);
      if (!txt) return null;
      // 寻找类似「分组X-...-质检-MMDD」/「...-标注-MMDD」
      if (/[-—]\s*质检\s*[-—]/.test(txt) || /质检任务/.test(txt)) return 'qa';
      if (/[-—]\s*标注\s*[-—]/.test(txt) || /标注任务/.test(txt)) return 'label';
    } catch (e) { /* 跨域 */ }
    return null;
  }

  /** 综合判定，写入缓存并触发回调 */
  function detect() {
    let mode = detectInDoc(document);
    if (!mode) mode = detectFromTopTitle();
    if (!mode) mode = 'unknown';
    if (mode !== _current) {
      const old = _current;
      _current = mode;
      listeners.forEach((fn) => {
        try { fn(mode, old); } catch (e) {}
      });
    }
    return _current;
  }

  function is(name) {
    return _current === name;
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.add(cb);
    return () => listeners.delete(cb);
  }

  global.QLBMode = {
    detect,
    is,
    onChange,
    get current() { return _current; }
  };
})(window);
