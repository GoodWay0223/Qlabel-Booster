/**
 * QLabel Booster 诊断脚本 v3（page world 正确版）
 *
 * ⚠️ 重要背景（MV3 Isolated World 设计）：
 *   Chrome 扩展 MV3 的 content script 运行在 **Isolated World**，里面的
 *   window.QLBSelectors / QLBState / QLBToolbar 等**在页面主世界（page world）
 *   的控制台永远是 undefined**。这是设计如此，不是 bug。
 *
 *   因此，判断"插件到底装没装好"唯一可靠的方法是：
 *   1. DOM 里有没有 #qlb-toolbar（任何 world 共享）
 *   2. page-bridge.js 桥接对象 window.QLB 是否存在（插件主动暴露的）
 *   3. 扩展 CSS styles.css 有没有注入到页面（通过 getComputedStyle 或 stylesheet 列表看）
 *
 * 用法：
 *   1. 打开 QLabel 页面（任务评估页）
 *   2. F12 → Console
 *   3. 看到"请勿粘贴代码"警告 → 输入"允许粘贴"回车
 *   4. 全选下面代码粘贴到控制台 → 回车
 *   5. 结果会自动复制到剪贴板，⌘+V 发给开发者
 */
(async function () {
  const out = [];
  const p = (s) => out.push(s);

  p('==== QLabel Booster 诊断 v3 (' + new Date().toISOString() + ') ====');
  p('');

  // --- 1. 环境 ---
  p('## 1. 环境');
  p('  URL: ' + location.href);
  p('  Host: ' + location.host);
  p('  Frame: ' + (window.top === window.self ? 'TOP' : 'IFRAME'));
  p('  Ready: ' + document.readyState);
  p('  UA: ' + (navigator.userAgent.match(/Chrome\/[\d.]+/) || ['?'])[0]);
  p('');

  // --- 2. 页面主世界可见的插件指标 ---
  // 这是 page world 唯一能看到的插件信号
  p('## 2. page world 可见的插件指标');
  p('  window.QLB 存在: ' + !!window.QLB);
  p('  window.QLB.__bridged: ' + !!(window.QLB && window.QLB.__bridged));
  if (window.QLB && typeof window.QLB.debug === 'function') {
    try {
      const info = await window.QLB.debug();
      p('  QLB.debug() 返回: ' + JSON.stringify(info));
    } catch (e) {
      p('  QLB.debug() 失败: ' + e.message);
    }
  }
  p('');

  // --- 3. DOM 里的插件 UI（共享，最权威）---
  p('## 3. DOM 里的插件 UI【最权威】');
  const toolbar = document.getElementById('qlb-toolbar');
  const player = document.getElementById('qlb-player');
  p('  #qlb-toolbar: ' + !!toolbar);
  p('  #qlb-player: ' + !!player);
  if (toolbar) {
    const r = toolbar.getBoundingClientRect();
    const cs = window.getComputedStyle(toolbar);
    p('  toolbar 位置: left=' + Math.round(r.left) + ' top=' + Math.round(r.top) +
      ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height));
    p('  toolbar 样式: display=' + cs.display + ' visibility=' + cs.visibility +
      ' opacity=' + cs.opacity);
    p('  toolbar 在视口内: ' + (r.left < window.innerWidth && r.top < window.innerHeight &&
      r.right > 0 && r.bottom > 0 && r.width > 0));
  }
  p('');

  // --- 4. 扩展 CSS 是否注入 ---
  p('## 4. 扩展 CSS 注入检测');
  const links = Array.from(document.styleSheets).filter(s => {
    try { return /chrome-extension:\/\//.test(s.href || ''); } catch (e) { return false; }
  });
  p('  chrome-extension CSS 数量: ' + links.length);
  links.slice(0, 5).forEach(s => p('    ' + s.href));
  // 通过 getComputedStyle 侧面验证（即使 CSS 链接读不到也能判断规则是否生效）
  const testDiv = document.createElement('div');
  testDiv.className = 'qlb-toolbar';
  testDiv.style.position = 'absolute';
  testDiv.style.top = '-10000px';
  document.body.appendChild(testDiv);
  const computed = window.getComputedStyle(testDiv);
  const hasQlbStyles = computed.position === 'fixed'; // .qlb-toolbar 的 CSS 规则是 position:fixed
  p('  .qlb-toolbar CSS 规则生效: ' + hasQlbStyles);
  testDiv.remove();
  p('');

  // --- 5. 题目/视频数量 ---
  p('## 5. 页面元素扫描');
  p('  .cr-radio-group: ' + document.querySelectorAll('.cr-radio-group').length);
  p('  label[name="0"] (标注): ' + document.querySelectorAll('label.tea-form-check[name="0"]').length);
  p('  label[name="通过"] (质检): ' + document.querySelectorAll('label.tea-form-check[name="通过"]').length);
  p('  video: ' + document.querySelectorAll('video').length);
  p('  iframe: ' + document.querySelectorAll('iframe').length);
  p('');

  // --- 6. 遍历子 iframe ---
  const iframes = document.querySelectorAll('iframe');
  if (iframes.length > 0) {
    p('## 6. 子 iframe 诊断');
    for (let i = 0; i < iframes.length; i++) {
      const f = iframes[i];
      p('  iframe[' + i + ']:');
      p('    src: ' + (f.src || '(empty)'));
      try {
        const w = f.contentWindow;
        if (!w) { p('    contentWindow: null'); continue; }
        let crossOrigin = false;
        try { void w.location.href; } catch (e) { crossOrigin = true; }
        if (crossOrigin) { p('    跨域'); continue; }
        const doc = w.document;
        p('    url: ' + w.location.href);
        p('    #qlb-toolbar: ' + !!doc.getElementById('qlb-toolbar'));
        p('    window.QLB: ' + !!w.QLB);
        p('    window.QLB.__bridged: ' + !!(w.QLB && w.QLB.__bridged));
        p('    .cr-radio-group: ' + doc.querySelectorAll('.cr-radio-group').length);
        p('    video: ' + doc.querySelectorAll('video').length);
      } catch (e) {
        p('    访问失败: ' + e.message);
      }
    }
    p('');
  }

  // --- 7. 自动判断 ---
  p('## 7. 自动判断');
  const hints = [];
  // 在 iframe 里，自己没 toolbar（TOP 没 toolbar 是正常的，不必报）
  // 需要判断到底是"当前 frame 没 toolbar"还是"整个页面都没 toolbar"
  let anyFrameHasToolbar = !!toolbar;
  for (const f of iframes) {
    try {
      if (f.contentDocument && f.contentDocument.getElementById('qlb-toolbar')) {
        anyFrameHasToolbar = true;
        break;
      }
    } catch (e) { /* 跨域 */ }
  }

  if (!anyFrameHasToolbar) {
    // 真正的"插件未生效"
    if (!window.QLB) {
      hints.push('❌ 插件**完全没注入**（page-bridge + content script 都没跑）');
      hints.push('   → 可能原因 1：manifest 的 matches 没覆盖当前 URL');
      hints.push('   → 可能原因 2：扩展卡片上有错误（去 chrome://extensions 看）');
    } else if (window.QLB.__bridged) {
      hints.push('⚠️ page-bridge 加载成功，但 isolated content script 没跑');
      hints.push('   → 最可能原因：macOS 隔离标记阻断了 src/ 下的 JS 文件');
      hints.push('   → 解决：Terminal 跑 `xattr -cr <插件解压目录>`，然后扩展卡片点「重新加载」');
      hints.push('   → 或者：用 macOS 一键安装包（含自动清理脚本）');
    } else {
      hints.push('⚠️ window.QLB 存在但不完整');
    }
  } else {
    hints.push('✅ 插件已正确注入（DOM 里检测到 #qlb-toolbar）');
    if (toolbar) {
      const r = toolbar.getBoundingClientRect();
      if (r.left < -10 || r.top < -10 || r.left > window.innerWidth || r.top > window.innerHeight || r.width === 0) {
        hints.push('⚠️ 但工具栏位置在视口外 → 按 ⌘+Shift+0 复位');
      }
    }
  }
  hints.forEach(h => p('  ' + h));
  p('');
  p('==== 诊断结束 ====');

  const text = out.join('\n');
  console.log(text);

  try {
    await navigator.clipboard.writeText(text);
    console.log('%c✅ 诊断报告已复制到剪贴板，⌘+V 发给开发者即可',
      'color:#10b981;font-weight:bold;font-size:14px');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-10000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); console.log('%c✅ 已通过降级方案复制', 'color:#10b981;font-weight:bold'); }
    catch (err) { console.warn('❌ 自动复制失败，请手动选中上面日志复制'); }
    ta.remove();
  }
})();
