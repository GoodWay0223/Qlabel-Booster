/**
 * admin-switcher.js
 * v1.9.78：管理员后台快速切换浮动按钮
 *
 * 仅在 QLabel 后台管理界面（merchant/teamspace/workspace 等）顶层 frame 显示，
 * 任务页（combinator/iframe）不显示，作业人员看不到。
 *
 * 三个目标：
 *   - 项目管理中心：/merchant/ojb837u/task
 *   - 团队工作空间：/teamspace/453/task
 *   - 个人工作台：  /workspace/assignment/progress
 */
(function (global) {
  'use strict';

  const SWITCHER_ID = 'qlb-admin-switcher';

  /** 路径白名单：只在这些后台路径显示 */
  const ADMIN_PATH_RE = /\/(merchant|teamspace|workspace)(\/|$)/i;

  /** 路径黑名单：任务页绝不显示 */
  const TASK_PATH_RE = /\/combinator\//i;

  function shouldShow() {
    try {
      // 必须是顶层 frame（任务页 iframe 是嵌在 combinator 顶层下的，所以顶层路径会是 combinator → 黑名单）
      if (window !== window.top) return false;
      const path = location.pathname || '';
      if (TASK_PATH_RE.test(path)) return false;
      if (!ADMIN_PATH_RE.test(path)) return false;
      // 还需排除 host
      if (!/qlabel\.qq\.com$/i.test(location.hostname)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  /** 当前位于哪个区？返回 'merchant' / 'teamspace' / 'workspace' / null */
  function currentZone() {
    try {
      const path = location.pathname || '';
      if (/^\/merchant\//i.test(path)) return 'merchant';
      if (/^\/teamspace\//i.test(path)) return 'teamspace';
      if (/^\/workspace\//i.test(path)) return 'workspace';
    } catch (e) {}
    return null;
  }

  const TARGETS = [
    {
      key: 'merchant',
      label: '项目管理中心',
      url: 'https://qlabel.qq.com/merchant/ojb837u/task?page=1&size=20',
      icon: '🏢'
    },
    {
      key: 'teamspace',
      label: '团队工作空间',
      url: 'https://qlabel.qq.com/teamspace/453/task?page=1&size=20&taskType=1',
      icon: '👥'
    },
    {
      key: 'workspace',
      label: '个人工作台',
      url: 'https://qlabel.qq.com/workspace/assignment/progress?page=1&size=20',
      icon: '👤'
    }
  ];

  function render() {
    if (document.getElementById(SWITCHER_ID)) return;
    const zone = currentZone();
    const wrap = document.createElement('div');
    wrap.id = SWITCHER_ID;
    wrap.className = 'qlb-admin-switcher';
    wrap.innerHTML =
      '<span class="qlb-admin-switcher__title" title="QLabel Booster · 管理员快速切换">⚡ 切换</span>' +
      TARGETS.map((t) => {
        const active = t.key === zone ? ' qlb-admin-switcher__btn--active' : '';
        return `<a class="qlb-admin-switcher__btn${active}" href="${t.url}" title="${t.label}">${t.icon} ${t.label}</a>`;
      }).join('');
    (document.body || document.documentElement).appendChild(wrap);
  }

  function remove() {
    const el = document.getElementById(SWITCHER_ID);
    if (el) el.remove();
  }

  function refresh() {
    if (shouldShow()) render(); else remove();
  }

  function init() {
    if (!shouldShow()) return;
    // body 可能还没就绪
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', refresh, { once: true });
      return;
    }
    refresh();
    // SPA 路由切换：监听 URL 变化
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        refresh();
      }
    }, 500);
  }

  global.QLBAdminSwitcher = { init, refresh };
})(window);
