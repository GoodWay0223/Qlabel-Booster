/**
 * draft.js —— 答题本地草稿保存与恢复
 *
 * v1.9.70 升级：
 *   - 维度名提取改为优先读 group 内 .cr-label > span（兼容美学专项 / 1-10 模板）
 *     旧 col--16 路径作为 fallback
 *   - 评分原因 textarea 也加入草稿（每题对应的、最近的 textarea 都存）
 *   - 写入 templateVersion 字段，恢复时模板不匹配 → 拒绝
 *   - 文本输入每 50 字 toast 一次"💾 已自动保存草稿"
 *
 * 触发：
 *   - 任何 label click（标注或质检）→ 300ms 去抖 → 全量快照写入 localStorage
 *   - textarea input 事件 → 同上去抖保存
 *   - beforeunload → 最后兜底同步写一次
 *
 * 存储：localStorage['QLB_DRAFT_{taskKey}']
 *   taskKey 从 URL 提取（/teamspace/X/assignment/Y），跨刷新稳定
 *
 * 恢复：纯手动（工具栏草稿按钮 → 弹窗 → 一键恢复）
 *   恢复时只填"当前题为空"的槽位，不覆盖用户新做的分
 *   匹配方式：`维度名 + 视频列索引` 作业务锚点，不依赖 DOM 索引
 *   模板不匹配（草稿为旧 4 档，当前页是 1-10）→ 拒绝并提示
 */
(function (global) {
  'use strict';

  const DRAFT_PREFIX = 'QLB_DRAFT_';
  const RETENTION_DAYS = 7;
  const DEBOUNCE_MS = 300;
  const TOAST_EVERY_N_CHARS = 50; // 文本每 50 字 toast 一次

  /** 从当前 URL 提取任务唯一标识 */
  function getTaskKey() {
    const u = location.href;
    const m = u.match(/\/teamspace\/(\d+)\/assignment\/(\d+)/);
    if (m) return `ts${m[1]}_as${m[2]}`;
    const t = u.match(/[?&]token=([^&]{10,})/);
    if (t) return `cmb_${t[1].slice(0, 32)}`;
    try {
      return 'p_' + location.pathname.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
    } catch (e) { return 'unknown'; }
  }

  function getStorageKey(taskKey) {
    return DRAFT_PREFIX + (taskKey || getTaskKey());
  }

  // ============== 题目快照 ==============

  /** 为一道题生成稳定的业务标识：维度名 + 视频列索引
   *
   *  维度名提取顺序（v1.9.70）：
   *  1. group 内 .cr-label > span（新美学模板的位置）
   *  2. QLBQA._getDimensionTitleEl（质检模式）
   *  3. col--16 里 p.cr-text--bold（旧标注模板）
   */
  function groupSignature(group, ratingCols) {
    let dim = '';

    // v1.9.70：优先读 group 内 .cr-label > span（美学专项的维度名在这里）
    try {
      const labelEl = group.querySelector ? group.querySelector('.cr-label') : null;
      if (labelEl) {
        const spans = labelEl.querySelectorAll('span');
        for (const s of spans) {
          const t = (s.textContent || '').trim();
          if (t) { dim = t; break; }
        }
        if (!dim) {
          const t = (labelEl.textContent || '').trim();
          if (t) dim = t;
        }
      }
    } catch (e) {}

    // 质检模式专属
    if (!dim) {
      try {
        if (global.QLBMode && global.QLBMode.current === 'qa' && global.QLBQA && global.QLBQA._getDimensionTitleEl) {
          const el = global.QLBQA._getDimensionTitleEl(group);
          if (el) dim = (el.textContent || '').trim();
        }
      } catch (e) {}
    }

    // 旧 col--16 路径
    if (!dim) {
      try {
        const col8 = group.closest('.cr-container-col--8') || group.closest('.cr-container-col--10');
        if (col8) {
          let prev = col8.previousElementSibling;
          while (prev) {
            if (prev.classList && prev.classList.contains('cr-container-col--16')) {
              const ps = Array.from(prev.querySelectorAll('p.cr-text--bold, p'));
              for (const p of ps) {
                const t = (p.textContent || '').trim();
                if (!t) continue;
                if (/平均分/.test(t)) continue;
                if (/^视频\d+-/.test(t)) continue;
                dim = t;
                break;
              }
              break;
            }
            prev = prev.previousElementSibling;
          }
        }
      } catch (e) {}
    }

    // 视频列索引
    let videoIdx = -1;
    try {
      for (let i = 0; i < ratingCols.length; i++) {
        if (ratingCols[i].contains(group)) { videoIdx = i; break; }
      }
    } catch (e) {}
    return { dim: dim || '', videoIdx };
  }

  /** 找到与某题"对应"的评分原因 textarea
   *
   *  策略：题在哪个 col--10 里 → 这个 col 内的所有 textarea 中，挑一个与本题最近的（向下走最近的）
   *  美学专项：每题下方就是一个 textarea，所以我们对每个 group 找它**之后**最近的 textarea
   */
  function findReasonTextareaForGroup(group) {
    if (!group) return null;
    try {
      // 优先：在 group 容器**之后**找最近的 textarea（同一行或下一行）
      // 用 col--8 / col--24 / 同 row 边界限制范围
      const col10 = group.closest('.cr-container-col--10') || group.closest('[class*="cr-container-col"]');
      if (!col10) return null;
      // 收集 col10 里所有的 textarea
      const textareas = Array.from(col10.querySelectorAll('textarea'));
      if (textareas.length === 0) return null;
      // 用 DOM 顺序：找 group 之后第一个 textarea
      const all = Array.from(col10.querySelectorAll('*'));
      const groupIdx = all.indexOf(group);
      for (const t of textareas) {
        const ti = all.indexOf(t);
        if (ti > groupIdx) return t;
      }
      // 都在前面（少见），用最后一个
      return textareas[textareas.length - 1];
    } catch (e) { return null; }
  }

  /** 收集当前页面所有已答题的快照 */
  function snapshot() {
    const mode = (global.QLBMode && global.QLBMode.current) || 'label';
    const template = (global.QLBMode && global.QLBMode.template) || 'unknown';
    const data = {
      url: location.href,
      taskKey: getTaskKey(),
      mode,
      templateVersion: template, // v1.9.70：恢复时校验
      updatedAt: Date.now(),
      answers: []
    };

    const ratingCols = Array.from(document.querySelectorAll('.cr-container-col--10'));

    if (mode === 'qa' && global.QLBQA) {
      const groups = Array.from(document.querySelectorAll('.cr-radio-group'))
        .filter((g) => g.querySelector('label[name="通过"], label[name="不通过"]'));
      groups.forEach((g) => {
        const pass = global.QLBQA.getCurrentPass ? global.QLBQA.getCurrentPass(g) : null;
        let fix = null;
        try {
          if (global.QLBQA._getFixInputsForGroup) {
            const inputs = global.QLBQA._getFixInputsForGroup(g);
            if (inputs && inputs.length > 0) {
              fix = inputs.map((i) => i.value || '').filter(Boolean).join('|');
              if (!fix) fix = null;
            }
          }
        } catch (e) {}
        if (!pass && !fix) return;
        const sig = groupSignature(g, ratingCols);
        data.answers.push({ ...sig, pass, fix });
      });
    } else {
      // 标注模式（含旧 4 档 和 美学 1-10）
      const groups = (global.QLBSelectors && global.QLBSelectors.getAllQuestionGroups)
        ? global.QLBSelectors.getAllQuestionGroups()
        : [];
      groups.forEach((g) => {
        const score = global.QLBSelectors.getCurrentScore
          ? global.QLBSelectors.getCurrentScore(g)
          : null;
        // v1.9.70：评分原因 textarea
        const reasonEl = findReasonTextareaForGroup(g);
        const reason = reasonEl ? (reasonEl.value || '').trim() : '';
        // 评分和原因任一不为空就存
        if ((score === null || score === undefined) && !reason) return;
        const sig = groupSignature(g, ratingCols);
        const entry = { ...sig };
        if (score !== null && score !== undefined) entry.score = score;
        if (reason) entry.reason = reason;
        data.answers.push(entry);
      });
    }
    return data;
  }

  // ============== localStorage 读写 ==============

  function save() {
    try {
      const data = snapshot();
      if (data.answers.length === 0) return; // 空的不写
      localStorage.setItem(getStorageKey(data.taskKey), JSON.stringify(data));
    } catch (e) {}
  }

  function load(taskKey) {
    try {
      const raw = localStorage.getItem(getStorageKey(taskKey));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function clear(taskKey) {
    try { localStorage.removeItem(getStorageKey(taskKey)); } catch (e) {}
  }

  function listAll() {
    const list = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k));
          if (v) list.push({ key: k, data: v });
        } catch (e) {}
      }
    } catch (e) {}
    return list.sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));
  }

  function cleanupOldDrafts() {
    const threshold = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
    listAll().forEach(({ key, data }) => {
      if ((data.updatedAt || 0) < threshold) {
        try { localStorage.removeItem(key); } catch (e) {}
      }
    });
  }

  // ============== 去抖保存 ==============

  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      save();
    }, DEBOUNCE_MS);
  }

  // 文本累计字数 toast：每打 50 字提示一次"已保存草稿"
  let lastToastCharCount = 0;
  function maybeToastTextProgress() {
    try {
      let total = 0;
      document.querySelectorAll('textarea').forEach((t) => {
        total += (t.value || '').length;
      });
      if (total - lastToastCharCount >= TOAST_EVERY_N_CHARS) {
        lastToastCharCount = total - (total % TOAST_EVERY_N_CHARS); // 对齐到 50 整数
        // 顺便取下当前快照里有多少题
        let answeredCount = 0;
        try {
          const snap = snapshot();
          answeredCount = snap.answers.length;
        } catch (e) {}
        if (global.QLBMissing && global.QLBMissing.toast) {
          global.QLBMissing.toast(`💾 已自动保存草稿（${answeredCount} 题 · ${total} 字）`, 1200);
        }
      }
    } catch (e) {}
  }

  function installAutoSave() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1) return;
      if (t.closest('label[name], label.tea-form-check, input[type="radio"]')) {
        scheduleSave();
      }
    }, true);

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1) return;
      if (t.tagName === 'INPUT' && t.closest('.cr-radio-group, .cr-container-col--24')) {
        scheduleSave();
      }
    }, true);

    // v1.9.70：textarea input 也触发去抖保存（评分原因等文本字段）
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1) return;
      if (t.tagName === 'TEXTAREA') {
        scheduleSave();
        maybeToastTextProgress();
      }
    }, true);

    // beforeunload 兜底
    window.addEventListener('beforeunload', () => {
      try {
        if (saveTimer) clearTimeout(saveTimer);
        save();
      } catch (e) {}
    });
  }

  // ============== 恢复到页面 ==============

  /** 把草稿恢复到当前页面。
   *  v1.9.70：检测 templateVersion 不匹配 → 拒绝。
   *  返回 { total, restored, skipped, mismatched, error? } */
  function restoreToPage(draftData) {
    const d = draftData || load();
    if (!d || !d.answers || d.answers.length === 0) {
      return { total: 0, restored: 0, skipped: 0, mismatched: 0, error: '草稿为空' };
    }

    // v1.9.70：模板版本校验
    const curTpl = (global.QLBMode && global.QLBMode.template) || 'unknown';
    const draftTpl = d.templateVersion || 'unknown';
    if (draftTpl !== 'unknown' && curTpl !== 'unknown' && draftTpl !== curTpl) {
      return {
        total: d.answers.length,
        restored: 0,
        skipped: 0,
        mismatched: 0,
        error: `模板不匹配：草稿是 ${draftTpl}，当前页是 ${curTpl}。无法跨模板恢复。`
      };
    }

    let restored = 0, skipped = 0, mismatched = 0, reasonRestored = 0;
    const total = d.answers.length;
    const ratingCols = Array.from(document.querySelectorAll('.cr-container-col--10'));

    // 建索引：dim+videoIdx → group
    const idx = new Map();
    const groups = Array.from(document.querySelectorAll('.cr-radio-group'));
    groups.forEach((g) => {
      const sig = groupSignature(g, ratingCols);
      if (!sig.dim) return;
      idx.set(`${sig.dim}|${sig.videoIdx}`, g);
    });

    d.answers.forEach((ans) => {
      const key = `${ans.dim}|${ans.videoIdx}`;
      const g = idx.get(key);
      if (!g) { mismatched++; return; }

      if (d.mode === 'qa') {
        let cur = null;
        try { cur = global.QLBQA && global.QLBQA.getCurrentPass && global.QLBQA.getCurrentPass(g); } catch (e) {}
        if (cur) { skipped++; return; }
        if (ans.pass) {
          const lbl = g.querySelector(`label[name="${ans.pass}"]`);
          if (lbl) { lbl.click(); restored++; }
          else mismatched++;
        }
        if (ans.fix) {
          try {
            const inputs = global.QLBQA && global.QLBQA._getFixInputsForGroup
              ? global.QLBQA._getFixInputsForGroup(g)
              : [];
            const values = ans.fix.split('|');
            values.forEach((v, i) => {
              const inp = inputs[i];
              if (inp && !inp.value && v && global.QLBQA._setReactInputValue) {
                global.QLBQA._setReactInputValue(inp, v);
              }
            });
          } catch (e) {}
        }
      } else {
        // 标注模式
        let cur = null;
        try { cur = global.QLBSelectors && global.QLBSelectors.getCurrentScore && global.QLBSelectors.getCurrentScore(g); } catch (e) {}
        // 评分恢复
        if (ans.score !== undefined && ans.score !== null) {
          if (cur !== null && cur !== undefined) { skipped++; }
          else {
            const lbl = global.QLBSelectors && global.QLBSelectors.getOptionByScore
              ? global.QLBSelectors.getOptionByScore(g, ans.score)
              : null;
            if (lbl) { lbl.click(); restored++; }
            else mismatched++;
          }
        }
        // 评分原因 textarea 恢复（v1.9.70）
        if (ans.reason) {
          const ta = findReasonTextareaForGroup(g);
          if (ta && !(ta.value || '').trim()) {
            try {
              setReactTextareaValue(ta, ans.reason);
              reasonRestored++;
            } catch (e) {}
          }
        }
      }
    });
    return { total, restored, skipped, mismatched, reasonRestored };
  }

  /** v1.9.70：给 React 受控组件设 textarea 值 */
  function setReactTextareaValue(el, val) {
    if (!el) return false;
    try {
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value') &&
                     Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (setter) setter.call(el, val); else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }

  // ============== 入口 ==============

  function init() {
    cleanupOldDrafts();
    installAutoSave();
  }

  global.QLBDraft = {
    init,
    save,
    load,
    clear,
    listAll,
    snapshot,
    restoreToPage,
    getTaskKey,
    getStorageKey
  };
})(window);
