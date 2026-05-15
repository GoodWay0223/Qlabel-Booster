/**
 * mode.js
 * 识别当前页面是「标注」还是「质检」任务，以及具体的模板版本。
 *
 * v1.9.70 重构：引入 template 概念
 *   ┌─ mode（业务大类）          ─┬─ 'label' / 'qa' / 'unknown'
 *   └─ template（具体模板版本）   ─┴─ 'label-old4'        （0/0.5/1/none 4 档评分）
 *                                   'label-aesthetic10'   （美学专项 1-10 分）
 *                                   'qa-old'              （旧通过/不通过 + 修正分）
 *                                   'unknown'
 *
 * 判定优先级：
 *   1. 含 [name="通过"]/[name="不通过"] → qa-old
 *   2. 含 [name="2"] 到 [name="10"] 任一 → label-aesthetic10
 *   3. 含 [name="0.5"] 或 [name="none"] → label-old4
 *   4. 仅 [name="1"] 没有 2-10 → 也算 label-old4（兼容只剩 1 分场景）
 *   5. 都没有 → unknown
 *
 * 暴露：
 *   QLBMode.detect()       → 同时刷新 mode 和 template
 *   QLBMode.current        → 'label' / 'qa' / 'unknown'
 *   QLBMode.template       → 'label-old4' / 'label-aesthetic10' / 'qa-old' / 'unknown'
 *   QLBMode.is(name)       → 检查 mode === name
 *   QLBMode.isTemplate(t)  → 检查 template === t
 *   QLBMode.onChange(cb)   → mode 变化通知（template 也变会一并触发）
 */
(function (global) {
  'use strict';

  let _current = 'unknown';
  let _template = 'unknown';
  const listeners = new Set();

  /** 在当前 document 里检测模板，返回 template 字符串 */
  function detectTemplateInDoc(doc) {
    // 1) 质检
    if (
      doc.querySelector('label[name="通过"]') ||
      doc.querySelector('label[name="不通过"]')
    ) return 'qa-old';

    // 2) 美学专项 1-10：判断有没有 2 ~ 10 任一
    for (let i = 2; i <= 10; i++) {
      if (doc.querySelector(`label[name="${i}"]`)) return 'label-aesthetic10';
    }

    // 3) 旧 4 档标注：有 0 / 0.5 / none / 1 任一
    if (
      doc.querySelector('label[name="0"]') ||
      doc.querySelector('label[name="0.5"]') ||
      doc.querySelector('label[name="none"]') ||
      doc.querySelector('label[name="1"]')
    ) return 'label-old4';

    // 4) v1.9.80：纯文本反馈型任务（简版：多视频 + textarea，无评分 radio）
    //    特征：评分列 ≥ 2 + 视频 ≥ 2 + textarea ≥ 1
    try {
      const cols = doc.querySelectorAll('.cr-container-col--10').length;
      const videos = doc.querySelectorAll('video').length;
      const textareas = doc.querySelectorAll('textarea').length;
      if (cols >= 2 && videos >= 2 && textareas >= 1) return 'label-textonly';
    } catch (e) {}

    return 'unknown';
  }

  /** template → mode 的映射 */
  function templateToMode(tpl) {
    if (tpl === 'qa-old') return 'qa';
    if (tpl === 'label-old4' || tpl === 'label-aesthetic10' || tpl === 'label-textonly') return 'label';
    return 'unknown';
  }

  /** 试着从顶层 window（如果可访问）拿任务标题做兜底 */
  function detectFromTopTitle() {
    try {
      const w = window.top;
      if (!w) return null;
      const txt = ((w.document && w.document.body && w.document.body.innerText) || '').slice(0, 4000);
      if (!txt) return null;
      if (/[-—]\s*质检\s*[-—]/.test(txt) || /质检任务/.test(txt)) return 'qa';
      if (/[-—]\s*标注\s*[-—]/.test(txt) || /标注任务/.test(txt) || /美学专项/.test(txt)) return 'label';
    } catch (e) { /* 跨域 */ }
    return null;
  }

  /** 综合判定，写入缓存并触发回调 */
  function detect() {
    const tpl = detectTemplateInDoc(document);
    let mode = templateToMode(tpl);
    if (mode === 'unknown') {
      // DOM 还没渲染完，试用顶层标题兜底（仅区分 mode，template 暂留 unknown）
      const fb = detectFromTopTitle();
      if (fb) mode = fb;
    }
    const changed = (mode !== _current) || (tpl !== _template);
    const old = _current;
    _current = mode;
    _template = tpl;
    if (changed) {
      listeners.forEach((fn) => {
        try { fn(mode, old, tpl); } catch (e) {}
      });
    }
    return _current;
  }

  function is(name) {
    return _current === name;
  }

  function isTemplate(t) {
    return _template === t;
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.add(cb);
    return () => listeners.delete(cb);
  }

  global.QLBMode = {
    detect,
    is,
    isTemplate,
    onChange,
    get current() { return _current; },
    get template() { return _template; }
  };
})(window);
