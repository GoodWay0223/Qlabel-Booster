/**
 * admin-switcher.js
 * v1.9.79：管理员后台快速切换浮动条
 *
 * 仅在 QLabel 后台**列表/管理页**显示，作业页（任务 iframe + 任务详情壳页）一律不显示。
 *
 * 显示规则：
 *   ✅ /merchant/...
 *   ✅ /teamspace/{id}/task...
 *   ✅ /workspace/assignment/progress?page=...   （列表页）
 *   ❌ /combinator/...                            （任务 iframe 本身）
 *   ❌ /workspace/assignment/progress/{n}/{n}/{n} （任务详情壳页，路径含数字段）
 *
 * 交互：
 *   - 拖动：鼠标按住任意按钮以外的空白处拖动；位置写入 chrome.storage.local
 *   - 贴边缩放：拖到屏幕边缘 < 32px 时自动 collapse 成图标条；点击展开
 *   - 切换：点链接走原生导航
 */
(function (global) {
  'use strict';

  const SWITCHER_ID = 'qlb-admin-switcher';
  const STORAGE_KEY_POS = 'adminSwitcherPos';        // {x, y}
  const STORAGE_KEY_COLLAPSED = 'adminSwitcherCollapsed';
  const STORAGE_KEY_SIDE = 'adminSwitcherSide';      // 'left' | 'right'，吸附在哪一侧

  /** 路径黑名单：任务 iframe 本身 */
  const TASK_IFRAME_RE = /^\/combinator\//i;
  /** 路径黑名单：作业壳页（含 /assignment/ 段一律不显示） */
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

  let saved = { pos: null, collapsed: false, side: 'left' };

  function loadState() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([STORAGE_KEY_POS, STORAGE_KEY_COLLAPSED, STORAGE_KEY_SIDE], (obj) => {
          saved.pos = obj && obj[STORAGE_KEY_POS] || null;
          saved.collapsed = !!(obj && obj[STORAGE_KEY_COLLAPSED]);
          saved.side = (obj && obj[STORAGE_KEY_SIDE]) === 'right' ? 'right' : 'left';
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

  function applyCollapsed(el) {
    el.classList.toggle('qlb-admin-switcher--collapsed', !!saved.collapsed);
    el.classList.toggle('qlb-admin-switcher--side-left', saved.side === 'left');
    el.classList.toggle('qlb-admin-switcher--side-right', saved.side === 'right');
  }

  /** 检测是否处于"屏幕边缘"，是则 collapse + 记录 side */
  function maybeAutoCollapseByEdge(el) {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const EDGE = 32;
    const nearLeft = r.left <= EDGE;
    const nearRight = vw - r.right <= EDGE;
    const wantCollapsed = nearLeft || nearRight;
    const wantSide = nearRight ? 'right' : 'left';
    let changed = false;
    if (wantCollapsed !== saved.collapsed) {
      saved.collapsed = wantCollapsed;
      saveState({ [STORAGE_KEY_COLLAPSED]: wantCollapsed });
      changed = true;
    }
    if (wantCollapsed && wantSide !== saved.side) {
      saved.side = wantSide;
      saveState({ [STORAGE_KEY_SIDE]: wantSide });
      changed = true;
    }
    if (changed) applyCollapsed(el);
  }

  /** 拖动行为绑定（mouse + touch） */
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
        // 贴边自动 collapse / 离边自动展开
        maybeAutoCollapseByEdge(el);
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
      '<span class="qlb-admin-switcher__handle" title="QLabel 切换 · 拖动可移动，贴边自动收起，点击展开">' +
        '<span class="qlb-admin-switcher__handle-icon">⚡</span>' +
        '<span class="qlb-admin-switcher__handle-arrow"></span>' +
      '</span>' +
      TARGETS.map((t) => {
        const active = t.key === zone ? ' qlb-admin-switcher__btn--active' : '';
        return `<a class="qlb-admin-switcher__btn${active}" href="${t.url}" title="${t.short}">${t.short}</a>`;
      }).join('');
    (document.body || document.documentElement).appendChild(wrap);
    applyPosition(wrap);
    applyCollapsed(wrap);
    bindDrag(wrap);
    // 折叠时点 handle 展开
    wrap.querySelector('.qlb-admin-switcher__handle').addEventListener('click', (e) => {
      if (!wrap.classList.contains('qlb-admin-switcher--collapsed')) return;
      saved.collapsed = false;
      saveState({ [STORAGE_KEY_COLLAPSED]: false });
      // 展开后从边缘往里"弹"一点，避免又立刻被边缘吸附
      try {
        const r = wrap.getBoundingClientRect();
        const vw = window.innerWidth;
        if (saved.side === 'right') {
          const newLeft = Math.max(40, vw - r.width - 40);
          wrap.style.left = newLeft + 'px';
        } else {
          wrap.style.left = '40px';
        }
        wrap.style.right = 'auto';
        const r2 = wrap.getBoundingClientRect();
        saved.pos = { x: r2.left, y: r2.top };
        saveState({ [STORAGE_KEY_POS]: saved.pos });
      } catch (er) {}
      applyCollapsed(wrap);
      e.preventDefault();
      e.stopPropagation();
    });
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
    // v1.9.80：永远启动监听（SPA 切路由时也能正确显示/隐藏）
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
