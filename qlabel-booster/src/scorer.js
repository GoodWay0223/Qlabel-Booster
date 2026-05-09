/**
 * scorer.js
 * 打分引擎：点击某题的指定分值 label，支持批量 + 撤销栈。
 */
(function (global) {
  'use strict';

  const { getAllQuestionGroups, getOptionByScore, getCurrentScore, getColumns, getQuestionsInColumn, getDimensionsInColumn } =
    global.QLBSelectors;
  const { state } = global.QLBState;

  /** 给单题打分（若已是该分值则跳过）。返回 {changed, prevScore}
   *
   *  v1.9.53：批量打分时**每次 label.click() 会让浏览器把对应 input 设为 activeElement
   *  并自动 scrollIntoView 进视口** —— 这是浏览器原生的 label→input 激活机制副作用。
   *  对小题没问题，但批量打分时几十次激活会让视口被推到最后一题位置（看起来像焦点跳了）。
   *
   *  解决：每次 click 后立刻把 activeElement 拉回原元素（`focus({preventScroll:true})`），
   *  让浏览器看到 activeElement 没变化就不会触发自动滚动。
   *  视口的兜底拉回放在 scoreMany 末尾做一次（不在 scoreOne 里循环 rAF）。
   */
  function scoreOne(group, score) {
    if (!group) return { changed: false, prevScore: null };
    const prev = getCurrentScore(group);
    if (prev === String(score)) return { changed: false, prevScore: prev };
    const label = getOptionByScore(group, score);
    if (!label) return { changed: false, prevScore: prev };

    // v1.9.53：保存当前活动焦点，click 后立刻恢复 → 防止 input 留为活动焦点
    const savedActive = document.activeElement;

    label.click();

    // 恢复 activeElement —— 防止浏览器把刚激活的 input 当焦点目标自动滚动
    try {
      if (savedActive && savedActive !== document.body && document.contains(savedActive) &&
          typeof savedActive.focus === 'function') {
        savedActive.focus({ preventScroll: true });
      } else if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        // 兜底：如果当前活动焦点变成了 input → blur 掉它
        try { document.activeElement.blur(); } catch (e) {}
      }
    } catch (e) {}

    // v1.9.56：打分成功后立刻清掉这道题（及附近容器）的"定位未答题"红色脉冲，
    //         避免用户答完题后红框/红色脉冲一直残留。
    // v1.9.57：扩展到同时清 .qlb-missing-highlight（全员红框）和 .qlb-missing-target（首题强脉冲）
    try {
      const RED = ['qlb-missing-target', 'qlb-missing-highlight'];
      RED.forEach((c) => group.classList.remove(c));
      const wrap = group.closest('.tea-form-ctrl, .cr-container-row, .tea-form-item, .cr-container-col--8');
      if (wrap) RED.forEach((c) => wrap.classList.remove(c));
      // 题目所属"unit parts"（col--16/8/24）也一起清
      const col8 = group.closest('.cr-container-col--8');
      if (col8) {
        let p = col8.previousElementSibling;
        if (p && p.classList && p.classList.contains('cr-container-col--16')) RED.forEach((c) => p.classList.remove(c));
        let n = col8.nextElementSibling;
        if (n && n.classList && n.classList.contains('cr-container-col--24')) RED.forEach((c) => n.classList.remove(c));
      }
    } catch (e) {}

    return { changed: true, prevScore: prev };
  }

  /** 批量打分：传入题目数组与分值。记录撤销栈（一条"批量"事件）。
   *
   *  v1.9.50：批量期间设置全局 flag `__QLB_BATCH_SCORING__` —— 让 navigator.onPageClick 里
   *  v1.9.46 加的"鼠标点单题胶囊自动前进"逻辑在此期间完全 bypass。
   *
   *  v1.9.53：批量打分前后保存/恢复**视口 scrollTop**（兜底）。
   *  原因：即使 scoreOne 已经在每次 click 后把 activeElement 拉回了原元素，
   *  某些浏览器仍可能在 click 处理过程中短暂滚动一次视口（异步 scrollIntoView）。
   *  rAF 后做一次性拉回，覆盖所有 N 次 click 的累积偏移。
   */
  function scoreMany(groups, score, opLabel = '批量打分') {
    const snapshot = [];
    let changed = 0;
    // 设置批量打分 flag —— navigator.onPageClick 看到它就跳过自动前进
    try { global.__QLB_BATCH_SCORING__ = (global.__QLB_BATCH_SCORING__ || 0) + 1; } catch (e) {}
    // 记录视口位置 —— 批量结束后兜底拉回
    const savedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const savedScrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    try {
      for (const g of groups) {
        const r = scoreOne(g, score);
        if (r.changed) {
          snapshot.push({ group: g, prevScore: r.prevScore });
          changed++;
        }
        // v1.9.51：每次 click 后更新时间戳，让 navigator.onPageClick 能识别"刚刚发生过 batch click"
        try {
          global.__QLB_LAST_BATCH_AT__ = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        } catch (e) {}
      }
    } finally {
      // 等浏览器把所有合成 label.click 引发的 native click 冒泡都跑完，再放开
      const release = () => {
        try {
          if (typeof global.__QLB_BATCH_SCORING__ === 'number' && global.__QLB_BATCH_SCORING__ > 0) {
            global.__QLB_BATCH_SCORING__--;
          }
        } catch (e) {}
      };
      // v1.9.51：加长释放间隔 = rAF×2 + 250ms（覆盖 setTimeout 80ms + Tea UI 异步 checked 同步）
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(release, 250)));
      } else {
        setTimeout(release, 350);
      }
      // v1.9.53：rAF 后兜底拉回视口位置（覆盖 N 次 click 累积的滚动偏移）
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          try {
            const curY = window.pageYOffset || document.documentElement.scrollTop || 0;
            if (Math.abs(curY - savedScrollY) > 5) {
              if (document.scrollingElement) {
                document.scrollingElement.scrollTop = savedScrollY;
                document.scrollingElement.scrollLeft = savedScrollX;
              } else {
                window.scrollTo(savedScrollX, savedScrollY);
              }
            }
          } catch (e) {}
        });
      }
    }
    if (snapshot.length > 0) {
      state.undoStack.push({ label: opLabel, items: snapshot, ts: Date.now() });
      // 最多保留 20 步
      if (state.undoStack.length > 20) state.undoStack.shift();
    }
    return changed;
  }

  /** 全部题目批量 */
  function scoreAll(score) {
    const groups = getAllQuestionGroups();
    return scoreMany(groups, score, `全选 ${score}`);
  }

  /** 某列批量 */
  function scoreColumn(col, score) {
    const groups = getQuestionsInColumn(col);
    return scoreMany(groups, score, `本列 ${score}`);
  }

  /** 某维度批量 */
  function scoreDimension(dim, score) {
    return scoreMany(dim.groups, score, `${dim.title} ${score}`);
  }

  /** 撤销上一次批量 */
  function undoLast() {
    const op = state.undoStack.pop();
    if (!op) return 0;
    let ok = 0;
    for (const item of op.items) {
      const { group, prevScore } = item;
      if (prevScore === null) {
        // 之前未答，无法真正"清除"（qlabel 单选组一旦选上通常无法取消）。
        // 尝试点击当前选中的 label（切换）或忽略。
        continue;
      }
      const label = global.QLBSelectors.getOptionByScore(group, prevScore);
      if (label) {
        label.click();
        ok++;
      }
    }
    return ok;
  }

  /** 未打分数量 */
  function countUnanswered() {
    const all = getAllQuestionGroups();
    let n = 0;
    for (const g of all) {
      if (getCurrentScore(g) === null) n++;
    }
    return { unanswered: n, total: all.length };
  }

  /**
   * 进度诊断 —— 返回每道题的归类情况，用于排查"进度数字看起来不对"的问题。
   *
   * 注意：默认就有"已选 none"的题目会被算作已答（这是正常的，none 也是合法答案）。
   * 仅当你怀疑"明明没题也显示 N 已答"或"题数比实际渲染的多"时使用本工具。
   *
   * 用法：
   *   - 任意 frame 控制台：window.QLBScorer.debugProgress()
   *   - DevTools 默认 (top) frame：await QLB.debugProgress()
   *
   * 返回值（可结构化克隆，跨 frame 安全）：
   *   { total, answeredCount, unansweredCount,
   *     answered: [...30], unanswered: [...30] }
   */
  function debugProgress() {
    const all = getAllQuestionGroups();
    const answered = [];
    const unanswered = [];
    all.forEach((g, i) => {
      const score = getCurrentScore(g);
      const labels = Array.from(g.querySelectorAll('label.tea-form-check'));
      const names = labels.map((l) => l.getAttribute('name')).join(',');
      const checkedClass = labels.filter((l) =>
        /tea-form-check--checked|is-checked|checked|is-active/.test(l.className)
      ).map((l) => l.getAttribute('name'));
      let visible = false;
      try {
        const r = g.getBoundingClientRect();
        visible = r.width > 0 && r.height > 0;
      } catch (e) {}
      const inIframe = (() => { try { return window.top !== window.self; } catch (e) { return null; } })();
      const item = { idx: i, score, options: names, checkedClass, visible, inIframe };
      (score === null ? unanswered : answered).push(item);
    });
    /* eslint-disable no-console */
    try {
      console.log(
        `[QLB:Progress] 总题数 ${all.length}  已答 ${answered.length}  未答 ${unanswered.length}` +
        (answered.length > 0 ? `（含默认已选 none 的题）` : '')
      );
    } catch (e) {}
    /* eslint-enable no-console */
    return {
      total: all.length,
      answeredCount: answered.length,
      unansweredCount: unanswered.length,
      answered: answered.slice(0, 30),
      unanswered: unanswered.slice(0, 30)
    };
  }

  global.QLBScorer = {
    scoreOne,
    scoreMany,
    scoreAll,
    scoreColumn,
    scoreDimension,
    undoLast,
    countUnanswered,
    debugProgress
  };
})(window);
