/**
 * admin-switcher.js
 * v1.9.82：管理员后台快速切换浮动条（精简版）
 *
 * 仅在 QLabel 后台**列表/管理页**显示，作业页（任务 iframe + 含 /assignment/ 的壳页）一律不显示。
 *
 * 显示规则：
 *   ✅ /merchant/...
 *   ✅ /teamspace/{id}/task...
 *   ✅ /workspace/...（不含 /assignment/ 时）
 *   ❌ /combinator/...                  （任务 iframe）
 *   ❌ 路径含 /assignment/                （作业壳页：质检 / 标注 都涵盖）
 *
 * 交互：
 *   - 拖动：鼠标按住空白处拖动；位置写入 chrome.storage.local
 *   - 不再贴边吸附（v1.9.82 移除）
 *   - 切换：点链接走原生导航
 */
(function (global) {
  'use strict';

  const SWITCHER_ID = 'qlb-admin-switcher';
  const STORAGE_KEY_POS = 'adminSwitcherPos';        // {x, y}

  /** 路径黑名单：任务 iframe 本身 */
  const TASK_IFRAME_RE = /^\/combinator\//i;
  /** 路径黑名单：所有作业壳页（含 /assignment/ 段） */
  const ASSIGNMENT_RE = /\/assignment\//i;
  /** 显示白名单：后台管理路径 */
  const ADMIN_PATH_RE = /^\/(merchant|teamspace|workspace)(\/|$)/i;

  function shouldShow() {
    try {
      if (window !== window.top) return false;
      if (!/qlabel\.qq\.com$/i.test(location.hostname)) return false;
      const path = location.pathname || '';
      if (TASK_IFRAME_RE.test(path)) return false;
      if (ASSIGNMENT_RE.test(path)) return false;
      if (!ADMIN_PATH_RE.test(path)) return false;
      return true;
    } catch (e) { return false; }
  }

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
    { key: 'merchant',  short: '项目', url: 'https://qlabel.qq.com/merchant/ojb837u/task?page=1&size=20' },
    { key: 'teamspace', short: '团队', url: 'https://qlabel.qq.com/teamspace/453/task?page=1&size=20&taskType=1' },
    { key: 'workspace', short: '个人', url: 'https://qlabel.qq.com/workspace/assignment/progress?page=1&size=20' }
  ];

  let saved = { pos: null };

  function loadState() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([STORAGE_KEY_POS], (obj) => {
          saved.pos = obj && obj[STORAGE_KEY_POS] || null;
          resolve();
        });
      } catch (e) { resolve(); }
    });
  }
  function saveState(patch) {
    try { chrome.storage.local.set(patch); } catch (e) {}
  }

  /** 根据保存的 x/y 应用样式（带边界限制） */
  function applyPosition(el) {
    const pos = saved.pos;
    if (!pos) return; // 默认 CSS 左上角
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(vw - r.width, pos.x));
    const y = Math.max(0, Math.min(vh - r.height, pos.y));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  /** 拖动行为（鼠标 + 触屏） */
  function bindDrag(el) {
    let dragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    let moved = false;

    const onDown = (e) => {
      // 点击的是 <a> 链接 → 不拖（保留点击）
      if (e.target.closest('a')) return;
      dragging = true;
      moved = false;
      const pt = e.touches ? e.touches[0] : e;
      const r = el.getBoundingClientRect();
      startX = pt.clientX;
      startY = pt.clientY;
      origX = r.left;
      origY = r.top;
      el.classList.add('qlb-admin-switcher--dragging');
      e.preventDefault();
      e.stopPropagation();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - startX;
      const dy = pt.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(vw - r.width, origX + dx));
      const y = Math.max(0, Math.min(vh - r.height, origY + dy));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      e.preventDefault();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('qlb-admin-switcher--dragging');
      if (moved) {
        const r = el.getBoundingClientRect();
        saved.pos = { x: r.left, y: r.top };
        saveState({ [STORAGE_KEY_POS]: saved.pos });
      }
    };

    el.addEventListener('mousedown', onDown, true);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    el.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  function render() {
    if (document.getElementById(SWITCHER_ID)) return;
    const zone = currentZone();
    const wrap = document.createElement('div');
    wrap.id = SWITCHER_ID;
    wrap.className = 'qlb-admin-switcher';
    wrap.innerHTML =
      '<span class="qlb-admin-switcher__handle" title="QLabel · 拖动可移动">⚡</span>' +
      TARGETS.map((t) => {
        const active = t.key === zone ? ' qlb-admin-switcher__btn--active' : '';
        return `<a class="qlb-admin-switcher__btn${active}" href="${t.url}" title="${t.short}">${t.short}</a>`;
      }).join('');
    (document.body || document.documentElement).appendChild(wrap);
    applyPosition(wrap);
    bindDrag(wrap);
    window.addEventListener('resize', () => applyPosition(wrap));
  }

  function remove() {
    const el = document.getElementById(SWITCHER_ID);
    if (el) el.remove();
  }

  function refresh() {
    if (shouldShow()) render(); else remove();
  }

  async function init() {
    // 永远启动监听（SPA 切路由时也能正确显示/隐藏）
    await loadState();
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => init(), { once: true });
      return;
    }
    refresh();
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
