/**
 * selectors.js
 * 所有 DOM 选择器集中管理，站点改版只需改这里。
 * 全部函数均容错降级，找不到返回空数组/null。
 */
(function (global) {
  'use strict';

  const SCORE_VALUES = ['0', '0.5', '1', 'none'];

  const SEL = {
    // 题目容器（打分题，唯一关键锚点）
    questionGroup: '.cr-radio-group',
    // 题目文字容器
    questionLabel: '.cr-label',
    questionLabelText: '.cr-label span',
    // 选项 label：name 属性即分值
    optionLabel: 'label.tea-form-check',
    // 列容器（一个视频一列）
    column: '.cr-container-col--10',
    columnFallback: '.cr-container-col',
    // 维度标题行
    dimensionRow: '.cr-container-row',
    dimensionTitle: 'p.cr-text--bold span, p.cr-text--bold',
    // 提交按钮的可能写法（降级列表）
    submitButton: [
      'button.cr-submit',
      'button.tea-btn--primary',
      '.cr-task-header button[type="submit"]',
      'button[data-action="submit"]'
    ],
    // 视频
    video: 'video'
  };

  /**
   * 获取整页所有题目容器
   * v1.9.17：严格按"标注题"特征过滤——必须含 [name="0"|"0.5"|"1"|"none"] 之一的选项 label
   * 防止把质检页的"通过/不通过" radio 组（也是 .cr-radio-group）误算进进度
   * 也防止把视口外/隐藏的脏 DOM 计入
   */
  function getAllQuestionGroups(root = document) {
    const all = Array.from(root.querySelectorAll(SEL.questionGroup));
    return all.filter((g) => {
      // 必须含至少一个分值 label（标注题特征）
      for (const v of SCORE_VALUES) {
        if (g.querySelector(`label.tea-form-check[name="${CSS.escape(v)}"]`)) return true;
      }
      return false;
    });
  }

  /** 获取一题的选项 label */
  function getOptionLabels(group) {
    if (!group) return [];
    return Array.from(group.querySelectorAll(SEL.optionLabel));
  }

  /** 获取一题指定分值的 label */
  function getOptionByScore(group, score) {
    if (!group) return null;
    // 优先 [name="x"]
    let el = group.querySelector(`${SEL.optionLabel}[name="${CSS.escape(String(score))}"]`);
    if (el) return el;
    // 降级：遍历
    for (const l of getOptionLabels(group)) {
      const n = l.getAttribute('name');
      if (n === String(score)) return l;
    }
    return null;
  }

  /** 判断题目当前选中的分值（未答返回 null） */
  function getCurrentScore(group) {
    if (!group) return null;
    const labels = getOptionLabels(group);
    for (const l of labels) {
      // 多重容错
      const input = l.querySelector('input');
      const cls = l.className || '';
      if (
        l.classList.contains('tea-form-check--checked') ||
        l.classList.contains('is-checked') ||
        l.classList.contains('checked') ||
        /(^|\s)(is-active|tea-form-check--active)(\s|$)/.test(cls) ||
        l.getAttribute('aria-checked') === 'true' ||
        l.querySelector('input:checked') ||
        l.querySelector('input[checked]') ||
        (input && (input.checked || input.defaultChecked || input.hasAttribute('checked')))
      ) {
        return l.getAttribute('name');
      }
    }
    return null;
  }

  /**
   * 通用"可回答字段"扫描：覆盖打分题之外的其它题型。
   * 返回 [{ el, type, isAnswered, kind }]
   *   - el: 触发定位时滚动/高亮的目标元素（题目容器或控件本体）
   *   - type: 'radio-group' | 'checkbox-group' | 'select' | 'text' | 'textarea' | 'rating' | 'switch'
   *   - isAnswered: boolean
   *   - kind: 'required' 或 'optional'（根据 required / aria-required / 星号标记推断）
   * 主要用于在"系统提示必答未填写"时兜底定位。
   */
  function getAllAnswerableFields(root = document) {
    const fields = [];
    const seen = new Set();

    // 1) 打分 radio 组（已有逻辑，统一包装）
    getAllQuestionGroups(root).forEach((g) => {
      seen.add(g);
      fields.push({
        el: g,
        type: 'radio-group',
        isAnswered: getCurrentScore(g) !== null,
        kind: looksRequired(g) ? 'required' : 'optional'
      });
    });

    // 2) 其它 radio 组（非 cr-radio-group 的 tea-form-check-group）
    root.querySelectorAll('.tea-form-check-group, [role="radiogroup"]').forEach((grp) => {
      if (seen.has(grp) || [...seen].some((x) => x.contains(grp) || grp.contains(x))) return;
      seen.add(grp);
      const answered = !!grp.querySelector(
        'input:checked, [aria-checked="true"], .tea-form-check--checked, .is-checked'
      );
      fields.push({
        el: grp,
        type: 'radio-group',
        isAnswered: answered,
        kind: looksRequired(grp) ? 'required' : 'optional'
      });
    });

    // 3) textarea
    root.querySelectorAll('textarea').forEach((t) => {
      if (t.closest('[data-qlb-ignore]')) return;
      const v = (t.value || '').trim();
      fields.push({
        el: t,
        type: 'textarea',
        isAnswered: v.length > 0,
        kind: looksRequired(t) ? 'required' : 'optional'
      });
    });

    // 4) 单行文本（排除 radio/checkbox/hidden/button 等）
    root.querySelectorAll('input').forEach((i) => {
      const typ = (i.type || 'text').toLowerCase();
      if (!['text', 'search', 'email', 'url', 'tel', 'number'].includes(typ)) return;
      if (i.readOnly || i.disabled) return;
      if (i.closest('[data-qlb-ignore]')) return;
      const v = (i.value || '').trim();
      fields.push({
        el: i,
        type: 'text',
        isAnswered: v.length > 0,
        kind: looksRequired(i) ? 'required' : 'optional'
      });
    });

    // 5) 原生 select
    root.querySelectorAll('select').forEach((s) => {
      if (s.disabled) return;
      const v = (s.value || '').trim();
      const answered = v.length > 0 && v !== '0' && v !== '-1';
      fields.push({
        el: s,
        type: 'select',
        isAnswered: answered,
        kind: looksRequired(s) ? 'required' : 'optional'
      });
    });

    // 6) Tea 自定义下拉选择（按文案占位判定）
    root.querySelectorAll('.tea-select, .tea-form-ctrl [class*="select"]').forEach((s) => {
      if (seen.has(s)) return;
      // 避免与原生 select 重复：若内部就是 select 就跳过
      if (s.querySelector('select')) return;
      // 判定"有选中值"：有 .tea-select__text 且非空/非占位
      const txtEl = s.querySelector('.tea-select__text, [class*="select__text"], [class*="selection"]');
      const placeholderEl = s.querySelector('[class*="placeholder"]');
      const answered = !!(txtEl && (txtEl.textContent || '').trim() && !(placeholderEl && placeholderEl.offsetParent !== null));
      // 只对明显标记为必填的才纳入（降低误报）
      if (!looksRequired(s)) return;
      fields.push({ el: s, type: 'select', isAnswered: answered, kind: 'required' });
    });

    // 7) checkbox-group（多选必填题）：只统计明显的 group
    root.querySelectorAll('.tea-form-check-group[data-type="checkbox"], [role="group"][aria-required="true"]').forEach((grp) => {
      if (seen.has(grp)) return;
      const answered = !!grp.querySelector('input[type="checkbox"]:checked, .tea-form-check--checked');
      fields.push({
        el: grp,
        type: 'checkbox-group',
        isAnswered: answered,
        kind: 'required'
      });
    });

    return fields;
  }

  /** 粗略判断一个控件/题目是否"必答/必填" */
  function looksRequired(el) {
    if (!el) return false;
    if (el.hasAttribute && el.hasAttribute('required')) return true;
    if (el.getAttribute && el.getAttribute('aria-required') === 'true') return true;
    // 查找最近的 form-ctrl 上是否带 required / 红星
    const ctrl = el.closest && el.closest('.tea-form-ctrl, .cr-container-row, .cr-radio-group, .tea-form-item');
    if (ctrl) {
      if (ctrl.querySelector('.tea-form-ctrl__required, .is-required, [class*="required"]')) return true;
      const star = ctrl.querySelector('.cr-text--danger, .tea-text-danger');
      if (star && /[*＊]/.test(star.textContent || '')) return true;
    }
    // 打分题默认必填
    if (el.classList && el.classList.contains('cr-radio-group')) return true;
    return false;
  }

  /** 获取所有列（视频列） */
  function getColumns(root = document) {
    let cols = Array.from(root.querySelectorAll(SEL.column));
    if (cols.length === 0) cols = Array.from(root.querySelectorAll(SEL.columnFallback));
    // 只保留含题目的列
    return cols.filter((c) => c.querySelector(SEL.questionGroup));
  }

  /**
   * 获取某列内所有题目（v1.9.17：同 getAllQuestionGroups，仅取真正的标注题）
   */
  function getQuestionsInColumn(col) {
    if (!col) return [];
    const all = Array.from(col.querySelectorAll(SEL.questionGroup));
    return all.filter((g) => {
      for (const v of SCORE_VALUES) {
        if (g.querySelector(`label.tea-form-check[name="${CSS.escape(v)}"]`)) return true;
      }
      return false;
    });
  }

  /** 获取某列内所有维度行（含标题与其下题目） */
  function getDimensionsInColumn(col) {
    if (!col) return [];
    const rows = Array.from(col.children);
    const groups = [];
    let current = null;
    for (const row of rows) {
      const titleEl = row.querySelector ? row.querySelector(SEL.dimensionTitle) : null;
      const isTitleRow =
        row.matches &&
        row.matches(SEL.dimensionRow) &&
        titleEl &&
        titleEl.closest('p.cr-text--bold');
      if (isTitleRow) {
        if (current) groups.push(current);
        current = { titleEl, title: (titleEl.textContent || '').trim(), rows: [], groups: [] };
      } else if (current) {
        current.rows.push(row);
        const qs = row.querySelectorAll ? row.querySelectorAll(SEL.questionGroup) : [];
        qs.forEach((q) => current.groups.push(q));
      }
    }
    if (current) groups.push(current);
    return groups.filter((g) => g.groups.length > 0);
  }

  /** 查找提交按钮（降级遍历） */
  function findSubmitButtons(root = document) {
    const set = new Set();
    for (const sel of SEL.submitButton) {
      root.querySelectorAll(sel).forEach((b) => set.add(b));
    }
    // 兜底：按文案匹配
    if (set.size === 0) {
      root.querySelectorAll('button').forEach((b) => {
        const t = (b.textContent || '').trim();
        if (t === '提交' || t === '确认提交' || t === '保存并提交') set.add(b);
      });
    }
    return Array.from(set);
  }

  /** 获取所有视频元素 */
  function getAllVideos(root = document) {
    return Array.from(root.querySelectorAll(SEL.video));
  }

  global.QLBSelectors = {
    SEL,
    SCORE_VALUES,
    getAllQuestionGroups,
    getOptionLabels,
    getOptionByScore,
    getCurrentScore,
    getColumns,
    getQuestionsInColumn,
    getDimensionsInColumn,
    findSubmitButtons,
    getAllVideos,
    getAllAnswerableFields,
    looksRequired
  };
})(window);
