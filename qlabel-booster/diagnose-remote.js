/**
 * QLabel Booster · 远程诊断脚本
 *
 * 用法：让同事在打分页按 F12 打开控制台 → Console 标签 → 粘贴本文件**完整内容** → 回车
 *      把输出的整个表格/日志截图（或文字粘贴）发回来。
 *
 * 这个脚本不修改页面任何东西，纯只读诊断。
 */
(function diagnoseQLBRemote() {
  /* eslint-disable no-console */
  const lines = [];
  const push = (k, v) => lines.push({ '检查项': k, '结果': v });

  // —— 0. 浏览器/环境基础信息 ——
  push('UserAgent', navigator.userAgent);
  push('当前 URL', location.href);
  push('当前 host', location.host);
  push('是否顶层 frame', window.top === window.self ? 'TOP' : 'IFRAME');
  push('iframe 数量（同源可访问）', document.querySelectorAll('iframe').length);
  push('视口尺寸', window.innerWidth + ' x ' + window.innerHeight);
  push('页面缩放（devicePixelRatio）', window.devicePixelRatio);

  // —— 1. 油猴 / 插件是否注入 ——
  push('--- 1. QLB 脚本是否注入 ---', '');
  push('typeof QLB', typeof window.QLB);
  push('typeof QLBToolbar', typeof window.QLBToolbar);
  push('typeof QLBNavigator', typeof window.QLBNavigator);
  push('typeof QLBSelectors', typeof window.QLBSelectors);
  push('typeof chrome', typeof window.chrome);
  push('typeof GM_info', typeof window.GM_info);
  push('typeof unsafeWindow', typeof window.unsafeWindow);
  if (typeof window.GM_info !== 'undefined') {
    try {
      push('GM 脚本名', window.GM_info.script && window.GM_info.script.name);
      push('GM 脚本版本', window.GM_info.script && window.GM_info.script.version);
      push('GM_info.scriptHandler', window.GM_info.scriptHandler);
      push('GM_info.version (handler)', window.GM_info.version);
    } catch (e) {}
  }
  push('插件 chrome.runtime?.id', (window.chrome && window.chrome.runtime && window.chrome.runtime.id) || '(无)');

  // —— 2. 是否启动完成 ——
  push('--- 2. QLB 启动状态 ---', '');
  push('window.__QLB_BOOTED__', !!window.__QLB_BOOTED__);
  push('右下角工具栏 #qlb-toolbar', document.getElementById('qlb-toolbar') ? '✅ 已注入' : '❌ 未注入');
  push('悬浮播放器 #qlb-player', document.getElementById('qlb-player') ? '✅ 已注入' : '⚠ 未注入（不一定是问题）');

  // —— 3. 题目识别 ——
  push('--- 3. 页面题目识别 ---', '');
  push('.cr-radio-group 数量', document.querySelectorAll('.cr-radio-group').length);
  push('label.tea-form-check 数量', document.querySelectorAll('label.tea-form-check').length);
  push('label[name="0"] 数量', document.querySelectorAll('label.tea-form-check[name="0"]').length);
  push('label[name="0.5"] 数量', document.querySelectorAll('label.tea-form-check[name="0.5"]').length);
  push('label[name="1"] 数量', document.querySelectorAll('label.tea-form-check[name="1"]').length);
  push('label[name="none"] 数量', document.querySelectorAll('label.tea-form-check[name="none"]').length);
  push('label[name="通过"] 数量（质检）', document.querySelectorAll('label.tea-form-check[name="通过"]').length);
  push('.cr-container-col--10 列容器', document.querySelectorAll('.cr-container-col--10').length);
  push('.cr-container-col 任意列', document.querySelectorAll('.cr-container-col').length);
  push('视频 <video> 数量', document.querySelectorAll('video').length);

  // 题目数判定（QLB 内部口径）
  let qlbQuestions = '(QLB 未注入)';
  try {
    if (window.QLBSelectors && window.QLBSelectors.getAllQuestionGroups) {
      qlbQuestions = window.QLBSelectors.getAllQuestionGroups().length;
    }
  } catch (e) {
    qlbQuestions = 'ERR: ' + e.message;
  }
  push('QLB 识别的题目数', qlbQuestions);

  // —— 4. iframe 情况 ——
  push('--- 4. iframe 情况 ---', '');
  document.querySelectorAll('iframe').forEach((f, i) => {
    let info;
    try {
      const w = f.contentWindow;
      const same = !!(w && w.document);
      const hasQLB = !!(w && w.QLB);
      const hasToolbar = same && !!w.document.getElementById('qlb-toolbar');
      const qs = same ? w.document.querySelectorAll('.cr-radio-group').length : '?';
      info = `host=${f.src ? new URL(f.src, location.href).host : '(同源 srcdoc)'}, 同源=${same}, hasQLB=${hasQLB}, hasToolbar=${hasToolbar}, .cr-radio-group=${qs}`;
    } catch (e) {
      info = '(跨域无法访问) src=' + (f.src || '(空)');
    }
    push('iframe #' + i, info);
  });

  // —— 5. 错误日志（最近 30 条） ——
  // 这个我们只能提示用户去 Console 顶部下拉里筛 Errors

  // —— 输出 ——
  console.group('%c[QLB-REMOTE-DIAG] 诊断结果（请把整个表格 + 下面的两条 console 截图发给开发者）',
    'background:#3b82f6;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  console.table(lines);

  // 如果 QLB 已注入，再跑一遍它自带的 debug 信息
  if (typeof window.QLB !== 'undefined' && window.QLB.debug) {
    console.log('%c→ window.QLB.debug() 输出：', 'color:#10b981;font-weight:bold');
    try { console.log(window.QLB.debug()); } catch (e) { console.error('QLB.debug() 出错：', e); }
  }
  if (typeof window.QLB !== 'undefined' && window.QLB.frames) {
    console.log('%c→ window.QLB.frames() 输出：', 'color:#10b981;font-weight:bold');
    try { window.QLB.frames(); } catch (e) { console.error('QLB.frames() 出错：', e); }
  }

  console.log('%c⚠ 请同时打开 Console 顶部 "Errors" 过滤，把所有红色错误也截图发回',
    'color:#ef4444;font-weight:bold');
  console.groupEnd();
})();
