/**
 * wheel-pan.js
 * 通用「鼠标纵向滚轮 → 横向滚动」转换 + 触摸板横滑接管。
 *
 * v1.9.16：扩展为同时处理两类输入
 *   1. 鼠标纵向滚轮：deltaY 转 scrollLeft（仅当文档不能再纵滚时）
 *   2. 触摸板横向滑动：deltaX 直接转 scrollLeft，主动 preventDefault
 *      → 解决"刚进页面触摸板横滑失效，必须先点一下才能滚"的 bug
 *      → 屏蔽"横滑到最左触发浏览器返回上一页"的误触
 *
 * v1.9.22：标注模式下"左滑到底还会误触返回上一页"的补丁
 *   原先只有在"恰好位于横滚轨道"时才 preventDefault，而横滚轨道滚到最左端时
 *   浏览器仍可能识别为 history navigation。改为：
 *     - 只要 horizontal 意图明显（|deltaX| > |deltaY|）且事件发生在 qlabel 页面内
 *       （非 iframe chrome、非插件自身 UI）→ 全局 preventDefault，屏蔽后退手势
 *     - 如果命中横滚轨道 → 额外把 deltaX 应用到 scrollLeft（保留横滚体验）
 *     - 如果未命中轨道 → 只屏蔽后退，不改变页面（用户也看不见移动）
 *
 *   评估区横滚轨道的 DOM 特征：
 *     .cr-container-col--18                       ← 自身 overflow-x: scroll
 *       └─ .cr-container-row                      ← 内部宽度 > 父级宽度（横向溢出）
 */
(function (global) {
  'use strict';

  const { state } = global.QLBState || { state: { prefs: {} } };
  let bound = false;

  /** 找到 e.target 祖先链上**最近**的横滚 .cr-container-col--18。返回 null 即不命中。 */
  function findHorizontalTrack(target) {
    let el = target;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.nodeType === 1 && el.classList && el.classList.contains('cr-container-col--18')) {
        const cs = window.getComputedStyle(el);
        if (/auto|scroll|overlay/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) {
          return el;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  /** 文档（含 iframe body）当前是否还能向 deltaY 方向纵向滚动？ */
  function docCanScrollY(deltaY) {
    const se = document.scrollingElement || document.documentElement || document.body;
    if (!se) return false;
    if (deltaY > 0) {
      return se.scrollTop + se.clientHeight < se.scrollHeight - 1;
    } else if (deltaY < 0) {
      return se.scrollTop > 0;
    }
    return false;
  }

  function onWheel(e) {
    if (!isEnabled()) return;
    if (e.shiftKey) return; // Shift+滚轮：浏览器原生横滚
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);

    // v1.9.22：横向意图明显 → 无条件屏蔽浏览器 history navigation（左滑返回上一页）
    // 不管鼠标是否正好落在横滚轨道上，只要是 qlabel 页面内的横滑都吃掉。
    // 跳过插件自身 UI（工具栏拖动、悬浮窗等），让它们保留原生行为。
    if (absX > absY && absX > 0) {
      const t = e.target;
      const inOwnUi = t && t.closest && t.closest('#qlb-toolbar, #qlb-player, .qlb-modal, .qlb-toast');
      if (inOwnUi) return;
      const track = findHorizontalTrack(t);
      if (track) {
        // 命中横滚轨道 → 横滚；到头后 preventDefault 依然执行，防止触发后退手势
        track.scrollLeft += e.deltaX;
      }
      // 不管有没有轨道，都屏蔽默认的 history-nav 手势
      e.preventDefault();
      return;
    }

    // 鼠标纵向滚轮 → 横向滚动（原 v1.7.x 逻辑）
    const track = findHorizontalTrack(e.target);
    if (!track) return;
    if (docCanScrollY(e.deltaY)) return; // 文档还能纵滚 → 不劫持
    track.scrollLeft += e.deltaY;
    e.preventDefault();
  }

  function isEnabled() {
    return state && state.prefs && state.prefs.wheelPan !== false;
  }

  function setEnabled(on) {
    if (!state || !state.prefs) return;
    state.prefs.wheelPan = !!on;
    try {
      if (global.QLBState && global.QLBState.savePrefs) {
        global.QLBState.savePrefs({ wheelPan: !!on });
      }
    } catch (e) {}
  }

  function init() {
    if (bound) return;
    // capture: true → 在浏览器内置的 history-navigation 手势识别之前拿到事件
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    bound = true;
  }

  function teardown() {
    if (!bound) return;
    try { window.removeEventListener('wheel', onWheel, { capture: true }); } catch (e) {}
    bound = false;
  }

  global.QLBWheelPan = { init, teardown, isEnabled, setEnabled };
})(window);
