/**
 * missing.js
 * 未答题定位器 + 提交拦截 + 系统"必答未填写"被动监听。
 *
 * v1.6.3 关键改动：
 *   - scanMissing 不再只看 .cr-radio-group，同时包含：
 *     其它 radio 组、textarea、必填文本输入框、select、tea-select 等。
 *   - 新增 installSystemToastWatcher：当页面出现"必答/必填/请填写/请选择/未填"等系统提示时，
 *     自动重扫并跳转到首个未填项；若插件仍识别不到，退而使用"页面红框/表单错误节点"作为定位目标。
 */
(function (global) {
  'use strict';

  const {
    getAllQuestionGroups,
    getCurrentScore,
    findSubmitButtons,
    getColumns,
    getAllAnswerableFields,
    looksRequired
  } = global.QLBSelectors;
  const { state } = global.QLBState;

  const HL_CLASS = 'qlb-missing-highlight';
  const BAR_ID = 'qlb-intercept-bar';
  // 匹配系统未填写提示的关键词（尽量宽松；中英混合）
  // v1.9.12：扩容更多说法，覆盖质检页常见提示文案
  const REQUIRED_MSG_RE = /(必答|必填|必选|未填|未答|未作答|请填写|请选择|请回答|请完成|不能为空|校验失败|还有.*未|this field is required|required)/i;

  /**
   * 扫描所有未答题（含打分 radio 组 + 其它必填字段）。
   * 返回「统一形状」的数组： [{ el, type, isAnswered, kind }]
   * 但保持向后兼容：旧代码中 missing 数组元素可直接当作"题目容器 DOM"用时，
   * 我们仍返回 DOM 元素（便于 `.classList.add` 这类旧用法）。
   * 因此我们提供两个入口：
   *   scanMissing()            → 旧签名：[HTMLElement]
   *   scanMissingDetailed()    → 新签名：[{el, type, kind}]
   */
  function scanMissing() {
    return scanMissingDetailed().map((f) => f.el);
  }

  function scanMissingDetailed() {
    // 质检模式：用 QA 自己的语义（既没选通过也没选不通过即未答）
    if (global.QLBMode && global.QLBMode.current === 'qa' && global.QLBQA) {
      try {
        const all = Array.from(document.querySelectorAll('.cr-radio-group'))
          .filter((g) => g.querySelector('label.tea-form-check[name="通过"], label.tea-form-check[name="不通过"]'));
        return all
          .filter((g) => {
            const pass = g.querySelector('label.tea-form-check[name="通过"]');
            const fail = g.querySelector('label.tea-form-check[name="不通过"]');
            const isAnswered =
              (pass && (pass.classList.contains('tea-form-check--checked') || pass.classList.contains('is-checked') || pass.querySelector('input:checked'))) ||
              (fail && (fail.classList.contains('tea-form-check--checked') || fail.classList.contains('is-checked') || fail.querySelector('input:checked')));
            return !isAnswered;
          })
          .map((g) => ({ el: g, type: 'qa-pass-fail', isAnswered: false, kind: 'required' }));
      } catch (e) {
        // 出错时降级到下面的通用逻辑
      }
    }
    // 标注模式：以通用字段扫描为主；对打分题保持"必答"
    let fields;
    try {
      fields = getAllAnswerableFields();
    } catch (e) {
      fields = [];
    }
    // 兜底：若通用扫描异常，降级到打分题
    if (!fields || fields.length === 0) {
      fields = getAllQuestionGroups().map((g) => ({
        el: g,
        type: 'radio-group',
        isAnswered: getCurrentScore(g) !== null,
        kind: 'required'
      }));
    }
    // 只关心「必填 且 未答」
    return fields.filter((f) => f.kind === 'required' && !f.isAnswered);
  }

  /** 按列分组统计（兼容新老字段） */
  function groupByColumn(missing) {
    const cols = getColumns();
    const stats = cols.map(() => 0);
    const colGroups = cols.map(() => []);
    for (const m of missing) {
      const g = m.nodeType ? m : m.el;
      for (let i = 0; i < cols.length; i++) {
        if (cols[i].contains(g)) {
          stats[i]++;
          colGroups[i].push(g);
          break;
        }
      }
    }
    return { stats, colGroups };
  }

  /** 高亮所有未答题 */
  function highlightAll(missing) {
    clearHighlight();
    for (const m of missing) {
      const g = m && m.nodeType ? m : (m && m.el);
      if (!g) continue;
      // 对非 .cr-radio-group 的字段，高亮其最近的题目容器，以便用户看清
      const target = g.closest('.cr-radio-group, .tea-form-ctrl, .cr-container-row, .tea-form-item') || g;
      target.classList.add(HL_CLASS);
    }
  }

  /** 清除高亮 */
  function clearHighlight() {
    document.querySelectorAll('.' + HL_CLASS).forEach((el) => el.classList.remove(HL_CLASS));
  }

  /** 把某字段/元素聚焦 + 滚动到视口
   *
   * v1.9.29：用红色强脉冲取代蓝框
   *   - 打分题 → QLBNavigator.setFocus 传 markAsMissingTarget:true → 红色强脉冲
   *   - 质检题 → QLBQA._setFocus 传 markAsMissingTarget:true → 红色强脉冲
   *   - 非打分字段 → 给元素加 qlb-missing-target，短时 3 秒后自动消失
   */
  function focusField(el) {
    if (!el) return;
    const group = el.closest && el.closest('.cr-radio-group');
    // 质检模式
    if (group && global.QLBMode && global.QLBMode.current === 'qa' && global.QLBQA && global.QLBQA._setFocus) {
      global.QLBQA._setFocus(group, { markAsMissingTarget: true });
      return;
    }
    // 标注模式
    if (group && global.QLBNavigator) {
      global.QLBNavigator.setFocus(group, { safeView: true, markAsMissingTarget: true });
      return;
    }
    // 非打分字段（textarea / input / 下拉）
    if (global.QLBNavigator && typeof global.QLBNavigator.scrollIntoSafeView === 'function') {
      global.QLBNavigator.scrollIntoSafeView(el);
    } else {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        el.scrollIntoView();
      }
    }
    try {
      el.focus({ preventScroll: true });
    } catch (e) {}
    el.classList.add('qlb-missing-target');
    clearTimeout(focusField._timer);
    focusField._timer = setTimeout(() => {
      try { el.classList.remove('qlb-missing-target'); } catch (e) {}
    }, 3000);
  }

  /** N 键：定位到下一未答题（循环） */
  function focusNextMissing() {
    const missing = scanMissing();
    if (missing.length === 0) {
      toast('🎉 所有题目已答完');
      return;
    }
    highlightAll(missing);
    // 相对当前聚焦题找下一个
    const cur = state.focusedGroup;
    let idx = 0;
    if (cur) {
      const curIdx = missing.indexOf(cur);
      idx = curIdx === -1 ? 0 : (curIdx + 1) % missing.length;
    }
    focusField(missing[idx]);
  }

  /** 短暂提示 */
  function toast(msg, ms = 1800) {
    let t = document.getElementById('qlb-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'qlb-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('qlb-toast--show');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => t.classList.remove('qlb-toast--show'), ms);
  }

  /** 弹出拦截提示条 */
  function showInterceptBar(missing, onConfirmSubmit) {
    hideInterceptBar();
    const { stats } = groupByColumn(missing);
    const total = missing.length;
    const dist = stats
      .map((n, i) => (n > 0 ? `视频${i + 1} ${n} 题` : null))
      .filter(Boolean)
      .join('，');

    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.className = 'qlb-bar';
    bar.innerHTML = `
      <div class="qlb-bar__icon">⚠</div>
      <div class="qlb-bar__text">
        还有 <b>${total}</b> 道题未答${dist ? `（${dist}）` : ''}
      </div>
      <div class="qlb-bar__actions">
        <button class="qlb-btn qlb-btn--primary" data-action="locate">定位第一题</button>
        <button class="qlb-btn qlb-btn--danger" data-action="submit">仍然提交</button>
        <button class="qlb-btn" data-action="cancel">取消</button>
      </div>
    `;
    document.body.appendChild(bar);

    bar.addEventListener('click', (e) => {
      const act = e.target && e.target.dataset ? e.target.dataset.action : null;
      if (!act) return;
      if (act === 'locate') {
        const list = scanMissing();
        highlightAll(list);
        if (list[0]) focusField(list[0]);
        hideInterceptBar();
      } else if (act === 'submit') {
        hideInterceptBar();
        clearHighlight();
        if (typeof onConfirmSubmit === 'function') onConfirmSubmit();
      } else if (act === 'cancel') {
        hideInterceptBar();
      }
    });
  }

  function hideInterceptBar() {
    const b = document.getElementById(BAR_ID);
    if (b) b.remove();
  }

  /** 标记 + 记忆：防止再次拦截造成死循环 */
  let bypassNext = false;

  /** ============================================================
   *  被动监听：系统级"必答未填写"提示
   *  ============================================================
   *  - 监听全局 DOM 新增节点
   *  - 命中 .tea-message / .tea-notification / role="alert" / form 报错节点
   *  - 文案含 REQUIRED_MSG_RE 时，自动执行"跳到首个未答"
   *  - 插件自己识别不到？降级：把 .tea-form-ctrl--error / 含 .tea-form-ctrl__message--error 的节点当未答
   */
  let lastToastFireAt = 0;
  function installSystemToastWatcher() {
    const handler = () => {
      // 节流 500ms，避免同一条消息重复触发
      const now = Date.now();
      if (now - lastToastFireAt < 500) return;

      const hits = scanSystemRequiredMessages();
      if (hits.length === 0) return;
      lastToastFireAt = now;

      // 1) 先按插件自己的识别找
      let list = scanMissing();

      // 2) 若识别不到（系统说有必答但插件查不到）→ 回退到页面上的 "error" 字段
      if (list.length === 0) {
        list = scanErrorFieldsFromDom();
      }

      if (list.length === 0) {
        // 插件实在找不到：至少把系统弹窗本身滚入视口，并提示用户手动查看
        try { hits[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        const c = (window.QLBPlatform && window.QLBPlatform.combo('mod+shift+m')) || '⌘/Ctrl+Shift+M';
        toast(`⚠ 系统提示有必答未填，但插件没识别到，已滚动到提示处；可按 ${c} 重试`);
        return;
      }

      highlightAll(list);
      focusField(list[0]);
      toast(`📍 系统提示必答未填，已定位到第 1 / ${list.length} 道未答题`);
    };

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          // 快速预判：节点本身或其子节点含必答类关键词
          const txt = (n.textContent || '').trim();
          if (!txt) continue;
          if (!REQUIRED_MSG_RE.test(txt)) continue;
          // 找到一个候选，马上调度一次完整检查
          setTimeout(handler, 50);
          return;
        }
      }
    });
    mo.observe(document.body || document.documentElement, { subtree: true, childList: true });

    // v1.9.55：同源 top frame 也装一份观察器
    // 标注页/质检页的 ant-notification 弹窗渲染在 top window，但插件 content_script 跑在 iframe，
    // 不装跨 frame 监听就永远看不到。
    try {
      if (window !== window.top && window.top.document) {
        const topDoc = window.top.document;
        const TopMO = window.top.MutationObserver || window.MutationObserver;
        const topMo = new TopMO((mutations) => {
          for (const m of mutations) {
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue;
              const txt = (n.textContent || '').trim();
              if (!txt) continue;
              if (!REQUIRED_MSG_RE.test(txt)) continue;
              setTimeout(handler, 50);
              return;
            }
          }
        });
        topMo.observe(topDoc.body || topDoc.documentElement, { subtree: true, childList: true });
      }
    } catch (e) {
      // 跨域 top frame，无法监听，忽略
    }

    // 兜底：从提交按钮点击之后起 5 秒内也定时扫一下
    // （部分 Toast 插入后立即移除，MutationObserver 可能漏掉）
    // v1.9.12：质检页可能用不同的"提交/保存"按钮；放宽 button 匹配条件
    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!btn) return;
        const txt = (btn.textContent || '').trim();
        const submitBtns = findSubmitButtons();
        const looksLikeSubmit =
          submitBtns.includes(btn) ||
          /^(提交|确认提交|保存并提交|完成|确定提交)$/.test(txt);
        if (!looksLikeSubmit) return;
        let rounds = 0;
        const poll = setInterval(() => {
          rounds++;
          if (scanSystemRequiredMessages().length > 0) {
            handler();
            clearInterval(poll);
            return;
          }
          if (rounds > 17) clearInterval(poll); // 约 5 秒
        }, 300);
      },
      true
    );
  }

  /** 从 DOM 中扫描"系统级必答提示节点"
   *
   *  v1.9.55：
   *  - 新增 ant-design 系列容器（.ant-notification-notice / .ant-message-notice / .ant-form-item-explain-error 等）
   *  - 新增跨 frame 扫描：若插件跑在 iframe 里、提示却出现在 top window，
   *    我们尝试同源访问 top.document 一并扫描
   */
  function scanSystemRequiredMessages() {
    const set = new Set();
    const sels = [
      // Tea UI（之前已支持）
      '.tea-message', '.tea-message__main', '.tea-message-list',
      '.tea-notification', '.tea-notification__content',
      '.tea-toast', '.tea-toast__content',
      '.tea-form-ctrl__message--error',
      '.tea-form-control__status-text', '.tea-form-control__status-text--error',
      '.cr-form__error',
      // Ant Design（v1.9.55 新增）—— QLabel 标注页"必答未填写"用的就是这套
      '.ant-notification-notice',
      '.ant-notification-notice-content',
      '.ant-notification-notice-message',
      '.ant-notification-notice-description',
      '.ant-message-notice',
      '.ant-message-notice-content',
      '.ant-form-item-explain-error',
      '.ant-form-item-has-error',
      // 通用
      '[role="alert"]',
      '[role="status"]',
      '[class*="error-message"]',
      '[class*="form-error"]',
      '[class*="-message-error"]',
      '[class*="error-tip"]',
      '[class*="error-text"]'
    ];

    // 收集要扫描的 documents（本 frame + 同源 top frame）
    const docs = [document];
    try {
      if (window !== window.top && window.top.document && !docs.includes(window.top.document)) {
        docs.push(window.top.document);
      }
    } catch (e) {
      // 跨域 top，忽略
    }

    docs.forEach((doc) => {
      sels.forEach((s) => {
        try {
          doc.querySelectorAll(s).forEach((n) => {
            if (!n.isConnected) return;
            const win = (doc.defaultView || window);
            const style = win.getComputedStyle(n);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            if (parseFloat(style.opacity || '1') < 0.05) return;
            const txt = (n.textContent || '').trim();
            if (txt && REQUIRED_MSG_RE.test(txt)) set.add(n);
          });
        } catch (e) {}
      });
    });
    return Array.from(set);
  }

  /** 扫描所有带 error 样式的字段（作为插件"识别不到"的降级定位目标） */
  function scanErrorFieldsFromDom() {
    const list = [];
    document
      .querySelectorAll(
        '.tea-form-ctrl--error, .tea-form-ctrl.is-error, .has-error, .is-invalid, [aria-invalid="true"]'
      )
      .forEach((n) => {
        if (!n.isConnected) return;
        list.push(n);
      });
    return list;
  }

  /** 调试：为什么"跳到首个未答"说已答完，但系统又说有必答？ */
  function whyUnanswered() {
    const all = getAllAnswerableFields();
    const required = all.filter((f) => f.kind === 'required');
    const missing = required.filter((f) => !f.isAnswered);
    const radioOnly = getAllQuestionGroups().filter((g) => getCurrentScore(g) === null);
    const errFields = scanErrorFieldsFromDom();
    const sysMsgs = scanSystemRequiredMessages().map((n) => (n.textContent || '').trim().slice(0, 120));
    /* eslint-disable no-console */
    console.group('%c[QLB] 未答识别诊断', 'color:#ef4444;font-weight:bold');
    console.log('全部可识别字段：', all);
    console.log('其中必填：', required);
    console.log('其中必填且未答（插件认为的 missing）：', missing);
    console.log('仅打分题（老逻辑）未答：', radioOnly);
    console.log('页面 error 节点（系统红框）：', errFields);
    console.log('系统未填写提示文案：', sysMsgs);
    console.groupEnd();
    return { all, required, missing, radioOnly, errFields, sysMsgs };
  }

  /**
   * 提交后等新题目加载：
   * 记录当前所有视频的 URL 集合，起一个 MutationObserver + 轮询 8 秒。
   * 一旦发现"视频集合"整体变化（新增了不在旧集合里的 URL）→ 触发悬浮窗 reload。
   */
  function scheduleReloadOnNewVideos() {
    const QLBPlayer = global.QLBPlayer;
    if (!QLBPlayer || !QLBPlayer.reload) return;

    const snapshotUrls = () => {
      const set = new Set();
      document.querySelectorAll('video').forEach((v) => {
        const url = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
        if (url) set.add(url);
      });
      return set;
    };

    const oldSet = snapshotUrls();
    let fired = false;
    const fire = (reason) => {
      if (fired) return;
      fired = true;
      cleanup();
      try { QLBPlayer.reload(); } catch (e) {}
      try { QLBPlayer.forceLoopAllNativeVideos && QLBPlayer.forceLoopAllNativeVideos(); } catch (e) {}
      toast('🔄 已加载新题目视频');
      try { global.QLBToolbar && global.QLBToolbar.injectColumnAndDimensionButtons && global.QLBToolbar.injectColumnAndDimensionButtons(); } catch (e) {}
      try { global.QLBToolbar && global.QLBToolbar.updateProgress && global.QLBToolbar.updateProgress(); } catch (e) {}
    };

    const check = () => {
      const cur = snapshotUrls();
      if (cur.size === 0) return false;
      for (const u of cur) {
        if (!oldSet.has(u)) {
          fire('new-url');
          return true;
        }
      }
      return false;
    };

    const mo = new MutationObserver(() => { check(); });
    mo.observe(document.body, { subtree: true, childList: true });
    const tick = setInterval(check, 500);
    const timer = setTimeout(() => {
      cleanup();
    }, 8000);
    function cleanup() {
      try { mo.disconnect(); } catch (e) {}
      clearInterval(tick);
      clearTimeout(timer);
    }
  }

  /** 给提交按钮装拦截（捕获阶段） */
  function installSubmitInterceptor() {
    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!btn) return;
        const submitBtns = findSubmitButtons();
        if (!submitBtns.includes(btn)) return;

        if (bypassNext) {
          scheduleReloadOnNewVideos();
          return;
        }

        const missing = scanMissing();
        if (missing.length === 0) {
          // 插件认为全部答完 → 放行，顺便等新题
          // 注：如果服务端仍提示必答未填，installSystemToastWatcher 会兜底定位
          scheduleReloadOnNewVideos();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
        highlightAll(missing);
        showInterceptBar(missing, () => {
          bypassNext = true;
          try {
            btn.click();
            scheduleReloadOnNewVideos();
          } finally {
            setTimeout(() => {
              bypassNext = false;
            }, 1500);
          }
        });
      },
      true
    );
  }

  /** ⌘/Ctrl+Shift+M：强制重扫并定位首个必答未填 */
  function installManualShortcut() {
    document.addEventListener(
      'keydown',
      (e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
          e.preventDefault();
          e.stopPropagation();
          let list = scanMissing();
          if (list.length === 0) list = scanErrorFieldsFromDom();
          if (list.length === 0) {
            toast('🎉 暂未识别到未答/错误字段（可打开控制台 QLB.whyUnanswered() 诊断）');
            return;
          }
          highlightAll(list);
          focusField(list[0]);
          toast(`📍 已定位到第 1 / ${list.length} 道未答题`);
        }
      },
      true
    );
  }

  function init() {
    installSubmitInterceptor();
    installSystemToastWatcher();
    installManualShortcut();
  }

  global.QLBMissing = {
    init,
    scanMissing,
    scanMissingDetailed,
    scanErrorFieldsFromDom,
    focusNextMissing,
    focusField,
    highlightAll,
    clearHighlight,
    whyUnanswered,
    toast
  };
})(window);
