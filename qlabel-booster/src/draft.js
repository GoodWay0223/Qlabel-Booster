/**
 * draft.js —— 答题本地草稿保存与恢复
 *
 * 目标：用户刷新/关标签/视频加载失败后，答题数据不会丢。
 *
 * 触发：
 *   - 任何 label click（标注或质检）→ 300ms 去抖 → 全量快照写入 localStorage
 *   - beforeunload → 最后兜底同步写一次
 *   - 检测到 URL 切任务 / 点"提交"成功后 → 清掉对应草稿
 *
 * 存储：localStorage['QLB_DRAFT_{taskKey}']
 *   taskKey 从 URL 提取（/teamspace/X/assignment/Y），跨刷新稳定
 *
 * 恢复：纯手动（工具栏草稿按钮 → 弹窗 → 一键恢复）
 *   恢复时只填"当前题为空"的槽位，不覆盖用户新做的分
 *   匹配方式：`维度名 + 视频列索引` 作业务锚点，不依赖 DOM 索引
 */
(function (global) {
  'use strict';

  const DRAFT_PREFIX = 'QLB_DRAFT_';
  const RETENTION_DAYS = 7;
  const DEBOUNCE_MS = 300;

  /** 从当前 URL 提取任务唯一标识 */
  function getTaskKey() {
    const u = location.href;
    // 匹配 /teamspace/<x>/assignment/<y>
    const m = u.match(/\/teamspace\/(\d+)\/assignment\/(\d+)/);
    if (m) return `ts${m[1]}_as${m[2]}`;
    // 匹配 /combinator/iframe?token=... → 用 token 前 32 位
    const t = u.match(/[?&]token=([^&]{10,})/);
    if (t) return `cmb_${t[1].slice(0, 32)}`;
    // 兜底：整个 path（去 query）做 key
    try {
      return 'p_' + location.pathname.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
    } catch (e) { return 'unknown'; }
  }

  function getStorageKey(taskKey) {
    return DRAFT_PREFIX + (taskKey || getTaskKey());
  }

  // ============== 题目快照 ==============

  /** 为一道题生成稳定的业务标识：维度名 + 视频列索引 */
  function groupSignature(group, ratingCols) {
    let dim = '';
    try {
      if (global.QLBMode && global.QLBMode.current === 'qa' && global.QLBQA && global.QLBQA._getDimensionTitleEl) {
        const el = global.QLBQA._getDimensionTitleEl(group);
        if (el) dim = (el.textContent || '').trim();
      }
    } catch (e) {}
    // 标注模式 / qa 拿不到 → 用 col--16 里第一个 .cr-text--bold
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

  /** 收集当前页面所有已答题的分值快照 */
  function snapshot() {
    const mode = (global.QLBMode && global.QLBMode.current) || 'label';
    const data = {
      url: location.href,
      taskKey: getTaskKey(),
      mode,
      updatedAt: Date.now(),
      answers: []
    };

    // 用 col--10 作为视频列（两个模式通用）
    const ratingCols = Array.from(document.querySelectorAll('.cr-container-col--10'));

    if (mode === 'qa' && global.QLBQA) {
      // 质检模式：通过/不通过 + 修正分
      const groups = Array.from(document.querySelectorAll('.cr-radio-group'))
        .filter((g) => g.querySelector('label[name="通过"], label[name="不通过"]'));
      groups.forEach((g) => {
        const pass = global.QLBQA.getCurrentPass ? global.QLBQA.getCurrentPass(g) : null;
        // 修正分输入值（可能多个）
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
        // 未答且无修正分 → 不存
        if (!pass && !fix) return;
        const sig = groupSignature(g, ratingCols);
        data.answers.push({ ...sig, pass, fix });
      });
    } else {
      // 标注模式：0 / 0.5 / 1 / none
      const groups = (global.QLBSelectors && global.QLBSelectors.getAllQuestionGroups)
        ? global.QLBSelectors.getAllQuestionGroups()
        : [];
      groups.forEach((g) => {
        const score = global.QLBSelectors.getCurrentScore
          ? global.QLBSelectors.getCurrentScore(g)
          : null;
        if (score === null || score === undefined) return;
        const sig = groupSignature(g, ratingCols);
        data.answers.push({ ...sig, score });
      });
    }
    return data;
  }

  // ============== localStorage 读写 ==============

  function save() {
    try {
      const data = snapshot();
      if (data.answers.length === 0) {
        // 空的不写（避免把之前的草稿误覆盖成空）
        return;
      }
      localStorage.setItem(getStorageKey(data.taskKey), JSON.stringify(data));
    } catch (e) {
      // 可能是 QuotaExceededError，忽略
    }
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

  /** 列出所有 QLB_DRAFT_ 开头的草稿（用于草稿面板展示） */
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

  /** 清理超过 RETENTION_DAYS 天的旧草稿 */
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

  function installAutoSave() {
    // 任何 label / radio / input 的变化都触发快照
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1) return;
      if (t.closest('label.tea-form-check, label[name], input[type="radio"]')) {
        scheduleSave();
      }
    }, true);
    // 修正分输入 change / blur
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1) return;
      if (t.tagName === 'INPUT' && t.closest('.cr-radio-group, .cr-container-col--24')) {
        scheduleSave();
      }
    }, true);
    // beforeunload 兜底同步写一次（关闭标签页/刷新前最后一搏）
    window.addEventListener('beforeunload', () => {
      try {
        if (saveTimer) clearTimeout(saveTimer);
        save();
      } catch (e) {}
    });
    // 监听"提交成功"—— 简单策略：点击提交按钮后 2 秒，如果当前页 answers 为空 且 URL 没变 → 视为提交清页 → 清草稿
    // 保守策略：不自动清，由用户手动点"清除此草稿"。避免误清。
  }

  // ============== 恢复到页面 ==============

  /** 把草稿恢复到当前页面。不会覆盖已有分值。
   *  返回 { total, restored, skipped, mismatched } */
  function restoreToPage(draftData) {
    const d = draftData || load();
    if (!d || !d.answers || d.answers.length === 0) {
      return { total: 0, restored: 0, skipped: 0, mismatched: 0, error: '草稿为空' };
    }
    let restored = 0, skipped = 0, mismatched = 0;
    const total = d.answers.length;
    const ratingCols = Array.from(document.querySelectorAll('.cr-container-col--10'));

    // 先建索引：dim+videoIdx → group
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
        // 已有答案就跳过
        let cur = null;
        try { cur = global.QLBQA && global.QLBQA.getCurrentPass && global.QLBQA.getCurrentPass(g); } catch (e) {}
        if (cur) { skipped++; return; }
        // 点对应 label
        if (ans.pass) {
          const lbl = g.querySelector(`label[name="${ans.pass}"]`);
          if (lbl) { lbl.click(); restored++; }
          else mismatched++;
        }
        // 修正分
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
        if (cur !== null && cur !== undefined) { skipped++; return; }
        const lbl = global.QLBSelectors && global.QLBSelectors.getOptionByScore
          ? global.QLBSelectors.getOptionByScore(g, ans.score)
          : null;
        if (lbl) { lbl.click(); restored++; }
        else mismatched++;
      }
    });
    return { total, restored, skipped, mismatched };
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
