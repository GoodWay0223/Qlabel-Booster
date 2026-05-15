/**
 * toolbar.js
 * 右下角浮动工具栏 + 进度 + 维度/列级快捷按钮注入 + 快捷键帮助弹窗。
 */
(function (global) {
  'use strict';

  const { getAllQuestionGroups, getColumns, getQuestionsInColumn, getDimensionsInColumn, getCurrentScore } =
    global.QLBSelectors;
  const { state, savePrefs } = global.QLBState;
  const { scoreAll, scoreColumn, scoreDimension, undoLast, countUnanswered } = global.QLBScorer;

  // v1.9.70：根据当前模板返回该模板下的合法分值数组
  // - label-old4：['0','0.5','1','none']
  // - label-aesthetic10：['1','2','3','4','5','6','7','8','9','10']
  function getScores() {
    if (global.QLBSelectors && global.QLBSelectors.getScoreValuesForCurrentTemplate) {
      return global.QLBSelectors.getScoreValuesForCurrentTemplate();
    }
    return ['0', '0.5', '1', 'none'];
  }
  // 旧 SCORES 常量保留为旧 4 档兜底引用（仅供少数地方静态使用）
  const SCORES = ['0', '0.5', '1', 'none'];
  const TOOLBAR_ID = 'qlb-toolbar';
  const HELP_ID = 'qlb-help-modal';
  const DRAFT_ID = 'qlb-draft-modal';

  let progressEl = null;

  function buildToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return;
    const wrap = document.createElement('div');
    wrap.id = TOOLBAR_ID;
    wrap.className = 'qlb-toolbar' + (state.prefs.toolbarCollapsed ? ' qlb-toolbar--collapsed' : '');
    const autoLoop = state.prefs.autoLoopVideos !== false;
    const syncScroll = state.prefs.syncScroll !== false;
    // v1.9.49：类别打分跳转默认关闭，所以判定改用 === true（不是 !== false）
    // v1.9.72：按模板读独立开关（美学专项默认关，老 4 档默认开）
    const advanceAfterDimension = global.QLBState.getAdvanceAfterDimension
      ? global.QLBState.getAdvanceAfterDimension()
      : (state.prefs.advanceAfterDimension === true);
    const isQa = global.QLBMode && global.QLBMode.current === 'qa';
    // v1.9.8：根据系统显示对应快捷键文案（mac → ⌘+⇧+P / win → Ctrl+Shift+P）
    const P = global.QLBPlatform || { combo: () => '⌘/Ctrl+Shift+P', isMac: false };
    const tipPip = `把悬浮窗视频放进浏览器画中画（可拖副屏 · ${P.combo('mod+shift+p')}）`;
    const tipReset = `悬浮窗 / 工具栏一键拉回右下角（${P.combo('mod+shift+0')}）`;
    wrap.innerHTML = `
      <div class="qlb-toolbar__head">
        <span class="qlb-toolbar__logo">
          <span class="qlb-toolbar__logo-text">⚡ QLabel Booster</span>
          <span class="qlb-mode-chip" data-mode-chip>${isQa ? '质检' : '标注'}</span>
        </span>
        <div class="qlb-toolbar__head-actions">
          <button class="qlb-icon-btn" data-action="draft" title="草稿：查看/恢复本地自动保存的答题" aria-label="草稿">📋</button>
          <button class="qlb-icon-btn" data-action="help" title="帮助（快捷键说明）" aria-label="帮助">?</button>
          <button class="qlb-icon-btn qlb-icon-btn--collapse" data-action="toggle-collapse" title="折叠/展开" aria-label="折叠/展开">
            <span class="qlb-collapse-ico"></span>
          </button>
        </div>
      </div>
      <div class="qlb-toolbar__body">
        <!-- 标注模式区 -->
        <div class="qlb-section qlb-mode-only-label">
          <div class="qlb-section__title">一键全选</div>
          <div class="qlb-row qlb-row--score-grid">
            ${(function () {
              const _scores = getScores();
              return _scores.map((s) => {
                const tip = ({
                  '0': '整页全部打 0 分（最差）',
                  '0.5': '整页全部打 0.5 分（中等）',
                  '1': '整页全部打 1 分（最佳）',
                  'none': '整页全部选 none（不适用）'
                })[s] || `全部 ${s} 分`;
                return `<button class="qlb-btn qlb-btn--score qlb-btn--s${String(s).replace('.', '')}" data-action="all" data-score="${s}" title="${tip}">${s}</button>`;
              }).join('');
            })()}
          </div>
        </div>
        <!-- 质检模式区 -->
        <div class="qlb-section qlb-mode-only-qa">
          <div class="qlb-section__title">一键全选</div>
          <div class="qlb-row">
            <button class="qlb-btn qlb-btn--qa-pass" data-action="qa-all-pass" title="整页所有「是否通过」全选『通过』">全部通过</button>
            <button class="qlb-btn qlb-btn--qa-fail" data-action="qa-all-fail" title="整页所有「是否通过」全选『不通过』">全部不通过</button>
          </div>
        </div>
        <div class="qlb-section">
          <div class="qlb-section__title">
            <span>进度</span>
            <span class="qlb-progress" id="qlb-progress">-/-</span>
          </div>
          <!-- v1.9.44：定位未答题 / 撤销 也升级为 icon 风格，与下方"回顶/回底"视觉对齐 -->
          <div class="qlb-grid qlb-grid--2">
            <button class="qlb-btn qlb-btn--icon" data-action="goto-first-unanswered" title="自动定位到第一个还没作答的题目（快捷键 N）">
              <span class="qlb-btn__ico qlb-btn__ico--emoji">🔍</span><span class="qlb-btn__lbl">定位未答题</span>
            </button>
            <button class="qlb-btn qlb-btn--icon" data-action="undo" title="撤销最近一次批量操作">
              <span class="qlb-btn__ico">↩</span><span class="qlb-btn__lbl">撤销</span>
            </button>
          </div>
          <!-- v1.9.40：一键到页面顶/底，方便快速跳转浏览，标注+质检通用 -->
          <!-- v1.9.43：图标换为 ⤒/⤓（Unicode "to top / to bottom"），语义贴切且视觉更轻 -->
          <div class="qlb-grid qlb-grid--2">
            <button class="qlb-btn qlb-btn--icon" data-action="scroll-top" title="一键滚动到页面最顶部（包括内层滚动容器）">
              <span class="qlb-btn__ico">⤒</span><span class="qlb-btn__lbl">回顶</span>
            </button>
            <button class="qlb-btn qlb-btn--icon" data-action="scroll-bottom" title="一键滚动到页面最底部（包括内层滚动容器）">
              <span class="qlb-btn__ico">⤓</span><span class="qlb-btn__lbl">回底</span>
            </button>
          </div>
          <!-- v1.9.48：维度胶囊打分后是否自动跳到下一道未答题 -->
          <!-- v1.9.49：默认关闭；文案"维度打分后自动跳转" -->
          <!-- v1.9.64：标注 + 质检模式共用此开关，质检模式下控制按 1（通过）后是否跳下一题 -->
          <div class="qlb-switch-row" style="margin-top: 6px;">
            <label class="qlb-switch" title="标注模式：点维度（一行题目）批量打分胶囊后是否跳下一未答&#10;质检模式：按 1（通过）/ 鼠标点'通过'后是否跳下一未答&#10;默认关闭，开启后焦点会自动前进">
              <input type="checkbox" id="qlb-advance-dim" ${advanceAfterDimension ? 'checked' : ''} />
              <span class="qlb-switch__slider"></span>
              <span class="qlb-switch__label">维度打分后自动跳转</span>
            </label>
          </div>
        </div>
        <div class="qlb-section">
          <div class="qlb-section__title"><span>视频</span></div>
          <div class="qlb-switch-row">
            <label class="qlb-switch" title="开启后所有视频自动循环播放">
              <input type="checkbox" id="qlb-autoloop" ${autoLoop ? 'checked' : ''} />
              <span class="qlb-switch__slider"></span>
              <span class="qlb-switch__label">播放循环</span>
            </label>
            <label class="qlb-switch" title="滚动视频行时，题目列表自动同步滚动到对应位置">
              <input type="checkbox" id="qlb-syncscroll" ${syncScroll ? 'checked' : ''} />
              <span class="qlb-switch__slider"></span>
              <span class="qlb-switch__label">同步滚动</span>
            </label>
          </div>
          <div class="qlb-grid qlb-grid--2">
            <button class="qlb-btn qlb-btn--icon" data-action="toggle-player" title="打开/关闭右下角的循环悬浮视频小窗">
              <span class="qlb-btn__ico">▶</span><span class="qlb-btn__lbl">悬浮窗</span>
            </button>
            <button class="qlb-btn qlb-btn--icon" data-action="pip" title="${tipPip}">
              <span class="qlb-btn__ico">⛶</span><span class="qlb-btn__lbl">画中画</span>
            </button>
            <button class="qlb-btn qlb-btn--icon" data-action="reset-player" title="${tipReset}">
              <span class="qlb-btn__ico">↺</span><span class="qlb-btn__lbl">复位</span>
            </button>
            <button class="qlb-btn qlb-btn--icon" data-action="refresh" title="重新扫描页面视频和题目">
              <span class="qlb-btn__ico">↻</span><span class="qlb-btn__lbl">重扫</span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    progressEl = wrap.querySelector('#qlb-progress');
    applyModeUI(global.QLBMode ? global.QLBMode.current : 'label');

    // 恢复上次拖拽位置
    applySavedToolbarPos(wrap);
    // 绑定拖拽
    bindToolbarDrag(wrap);

    // 循环开关
    const loopSwitch = wrap.querySelector('#qlb-autoloop');
    if (loopSwitch) {
      loopSwitch.addEventListener('change', () => {
        const v = !!loopSwitch.checked;
        savePrefs({ autoLoopVideos: v });
        if (global.QLBPlayer && global.QLBPlayer.setAutoLoop) {
          global.QLBPlayer.setAutoLoop(v);
        }
        global.QLBMissing && global.QLBMissing.toast(v ? '✅ 播放循环已开启' : '⏸ 播放循环已关闭');
      });
    }

    const syncSwitch = wrap.querySelector('#qlb-syncscroll');
    if (syncSwitch) {
      syncSwitch.addEventListener('change', () => {
        const v = !!syncSwitch.checked;
        if (global.QLBScrollSync && global.QLBScrollSync.setEnabled) {
          global.QLBScrollSync.setEnabled(v);
        } else {
          savePrefs({ syncScroll: v });
        }
        global.QLBMissing && global.QLBMissing.toast(v ? '🔗 视频/题目同步滚动已开启' : '🔓 同步滚动已关闭');
      });
    }

    // v1.9.48：维度胶囊打分后自动跳下一未答 开关
    // v1.9.72：按模板写入独立 key（美学专项 / 旧 4 档 各自记忆）
    const advDimSwitch = wrap.querySelector('#qlb-advance-dim');
    if (advDimSwitch) {
      advDimSwitch.addEventListener('change', () => {
        const v = !!advDimSwitch.checked;
        if (global.QLBState.setAdvanceAfterDimension) {
          global.QLBState.setAdvanceAfterDimension(v);
        } else {
          savePrefs({ advanceAfterDimension: v });
        }
        global.QLBMissing && global.QLBMissing.toast(v
          ? '✅ 维度打分后会自动跳到下一未答题'
          : '⏸ 维度打分后保持当前焦点');
      });
    }

    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.action;
      const isQa = global.QLBMode && global.QLBMode.current === 'qa';
      if (act === 'all') {
        scoreAll(btn.dataset.score);
        updateProgress();
      } else if (act === 'qa-all-pass') {
        const n = global.QLBQA && global.QLBQA.passAll && global.QLBQA.passAll();
        global.QLBMissing && global.QLBMissing.toast(n > 0 ? `✅ 已全选通过（${n} 处变更）` : '已无可变更项');
        updateProgress();
      } else if (act === 'qa-all-fail') {
        const n = global.QLBQA && global.QLBQA.failAll && global.QLBQA.failAll();
        global.QLBMissing && global.QLBMissing.toast(n > 0 ? `❌ 已全选不通过（${n} 处变更）` : '已无可变更项');
        updateProgress();
      } else if (act === 'undo') {
        let n = 0;
        if (isQa && global.QLBQA && global.QLBQA.undoLast) {
          n = global.QLBQA.undoLast();
        } else {
          n = undoLast();
        }
        global.QLBMissing.toast(n > 0 ? `已撤销 ${n} 处` : '没有可撤销操作');
        updateProgress();
      } else if (act === 'goto-first-unanswered') {
        let g = null;
        if (isQa && global.QLBQA && global.QLBQA.focusFirstUnanswered) {
          g = global.QLBQA.focusFirstUnanswered();
        } else {
          g = global.QLBNavigator.focusFirstUnanswered();
        }
        if (!g) global.QLBMissing.toast('🎉 所有题目已答完');
      } else if (act === 'toggle-player') {
        global.QLBPlayer.toggle();
      } else if (act === 'reset-player') {
        global.QLBPlayer.resetPos && global.QLBPlayer.resetPos();
      } else if (act === 'pip') {
        // 确保悬浮窗先开着，否则没有 videoEl 可进入 PiP
        if (!document.getElementById('qlb-player')) global.QLBPlayer.show();
        global.QLBPlayer.togglePip && global.QLBPlayer.togglePip();
      } else if (act === 'refresh') {
        if (isQa && global.QLBQA && global.QLBQA.refresh) {
          global.QLBQA.refresh();
        } else {
          injectColumnAndDimensionButtons();
        }
        global.QLBPlayer.refreshSources && global.QLBPlayer.refreshSources();
        updateProgress();
        global.QLBMissing.toast('已重新扫描');
      } else if (act === 'toggle-collapse') {
        const collapsed = !wrap.classList.contains('qlb-toolbar--collapsed');
        wrap.classList.toggle('qlb-toolbar--collapsed', collapsed);
        savePrefs({ toolbarCollapsed: collapsed });
      } else if (act === 'scroll-top') {
        // v1.9.40：一键到页面顶部 —— 同时滚 window 和所有内层 scrollable 容器
        scrollAllToEdge('top');
        global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('⇈ 已到顶部');
      } else if (act === 'scroll-bottom') {
        // v1.9.40：一键到页面底部
        scrollAllToEdge('bottom');
        global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('⇊ 已到底部');
      } else if (act === 'help') {
        toggleHelp();
      } else if (act === 'draft') {
        toggleDraftPanel();
      }
    });
  }

  /** 切换工具栏的「标注 / 质检」UI 显示 */
  function applyModeUI(mode) {
    const wrap = document.getElementById(TOOLBAR_ID);
    if (!wrap) return;
    wrap.classList.toggle('qlb-toolbar--qa', mode === 'qa');
    wrap.classList.toggle('qlb-toolbar--label', mode !== 'qa');
    const chip = wrap.querySelector('[data-mode-chip]');
    if (chip) {
      chip.textContent = mode === 'qa' ? '质检' : '标注';
      chip.classList.toggle('qlb-mode-chip--qa', mode === 'qa');
    }
  }

  // ========== 工具栏拖拽 ==========
  function applySavedToolbarPos(wrap) {
    const { toolbarX, toolbarY } = state.prefs;
    if (toolbarX === null || toolbarY === null || toolbarX === undefined || toolbarY === undefined) return;
    // 防止保存的位置超出当前视口（如换屏/缩放）
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = wrap.getBoundingClientRect();
    const w = rect.width || 240;
    const h = rect.height || 200;
    const x = Math.min(Math.max(0, toolbarX), Math.max(0, vw - w));
    const y = Math.min(Math.max(0, toolbarY), Math.max(0, vh - h));
    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  }

  function bindToolbarDrag(wrap) {
    const head = wrap.querySelector('.qlb-toolbar__head');
    if (!head) return;
    head.classList.add('qlb-toolbar__head--draggable');
    head.title = '按住拖动整个面板';

    let startX = 0, startY = 0, origX = 0, origY = 0;
    let dragging = false;
    let moved = false;

    const onMouseDown = (e) => {
      // 点到按钮不触发拖拽
      if (e.target.closest('button')) return;
      if (e.button !== 0) return; // 只左键
      dragging = true;
      moved = false;
      const rect = wrap.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      // 修复 v1.9.10：先把当前 rect 锁到 left/top，再清 right/bottom
      // 之前的顺序会让面板瞬间失去 right/bottom 锚点 + 还没设 left/top → 坍缩到左上角 (0,0) 看似"消失"
      wrap.style.left = rect.left + 'px';
      wrap.style.top = rect.top + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      wrap.classList.add('qlb-toolbar--dragging');
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      const vw = window.innerWidth, vh = window.innerHeight;
      const rect = wrap.getBoundingClientRect();
      let nx = origX + dx;
      let ny = origY + dy;
      // 保证不跑出视口
      nx = Math.max(0, Math.min(nx, vw - rect.width));
      ny = Math.max(0, Math.min(ny, vh - rect.height));
      wrap.style.left = nx + 'px';
      wrap.style.top = ny + 'px';
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove('qlb-toolbar--dragging');
      if (moved) {
        const r = wrap.getBoundingClientRect();
        savePrefs({ toolbarX: Math.round(r.left), toolbarY: Math.round(r.top) });
      } else {
        // v1.9.10：短按未拖动 → 还原到拖拽前的视觉位置
        // 如果之前没保存过自定义位置（toolbarX/Y === null）则回到 CSS 默认 right/bottom；
        // 如果之前保存过 → 重新应用保存的 left/top（再次保险）
        const { toolbarX, toolbarY } = state.prefs;
        if (toolbarX === null || toolbarY === null || toolbarX === undefined || toolbarY === undefined) {
          wrap.style.left = '';
          wrap.style.top = '';
          wrap.style.right = '';
          wrap.style.bottom = '';
        }
      }
    };

    head.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // ========== 草稿面板（v1.9.69） ==========
  function toggleDraftPanel() {
    const exist = document.getElementById(DRAFT_ID);
    if (exist) { exist.remove(); return; }

    const D = global.QLBDraft;
    if (!D) {
      global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('❌ 草稿模块未加载');
      return;
    }

    // 当前任务的草稿
    const cur = D.load();
    // 所有任务草稿
    const all = D.listAll();

    const fmtTime = (ts) => {
      const d = new Date(ts);
      const pad = (n) => (n < 10 ? '0' + n : n);
      return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const curHtml = cur
      ? `
        <div class="qlb-draft-card qlb-draft-card--current">
          <div class="qlb-draft-card__title">📍 当前任务的草稿</div>
          <div class="qlb-draft-card__meta">
            模式：<b>${cur.mode === 'qa' ? '质检' : '标注'}</b> · 已保存 <b>${cur.answers.length}</b> 题 · 更新于 <b>${fmtTime(cur.updatedAt)}</b>
          </div>
          <div class="qlb-draft-card__actions">
            <button class="qlb-btn qlb-btn--primary" data-act="restore-current">♻️ 一键恢复到当前页</button>
            <button class="qlb-btn" data-act="copy-current">📋 复制 JSON</button>
            <button class="qlb-btn qlb-btn--danger" data-act="clear-current">🗑 清除此草稿</button>
          </div>
        </div>`
      : `
        <div class="qlb-draft-card qlb-draft-card--empty">
          <div class="qlb-draft-card__title">📍 当前任务暂无草稿</div>
          <div class="qlb-draft-card__meta">打任何一分后会自动保存到本地。</div>
        </div>`;

    // 列出其它草稿（排除当前任务）
    const curKey = D.getStorageKey(D.getTaskKey());
    const others = all.filter((x) => x.key !== curKey);
    const othersHtml = others.length === 0
      ? '<div class="qlb-draft-empty">（没有其它任务的草稿）</div>'
      : `
        <table class="qlb-draft-table">
          <thead><tr><th>任务</th><th>模式</th><th>题数</th><th>时间</th><th></th></tr></thead>
          <tbody>
            ${others.map((o, i) => `
              <tr data-key="${o.key.replace(/"/g, '&quot;')}">
                <td class="qlb-draft-url" title="${(o.data.url || '').replace(/"/g, '&quot;')}">${(o.data.url || '').slice(-50)}</td>
                <td>${o.data.mode === 'qa' ? '质检' : '标注'}</td>
                <td>${o.data.answers ? o.data.answers.length : 0}</td>
                <td>${fmtTime(o.data.updatedAt)}</td>
                <td>
                  <button class="qlb-btn qlb-btn--sm" data-act="copy-other" data-idx="${i}">复制</button>
                  <button class="qlb-btn qlb-btn--sm qlb-btn--danger" data-act="clear-other" data-idx="${i}">删除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;

    const modal = document.createElement('div');
    modal.id = DRAFT_ID;
    modal.className = 'qlb-modal';
    modal.innerHTML = `
      <div class="qlb-modal__mask" data-act="close"></div>
      <div class="qlb-modal__panel qlb-modal__panel--wide">
        <div class="qlb-modal__head">
          <span>📋 草稿（本地自动保存）</span>
          <button class="qlb-icon-btn" data-act="close" title="关闭" aria-label="关闭">✕</button>
        </div>
        <div class="qlb-modal__body">
          <p class="qlb-draft-intro">
            每次打分自动存到本地（localStorage），刷新/关标签后可恢复。<b>不会上传任何数据</b>。
            草稿 <b>7 天</b> 自动清理。提交成功后建议手动点"清除此草稿"。
          </p>
          ${curHtml}
          <div class="qlb-draft-sep">— 其它任务的草稿 —</div>
          ${othersHtml}
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'close') { modal.remove(); return; }
      if (act === 'restore-current') {
        if (!confirm('将把草稿里的已打分重放到当前页面。已有分值的题目会跳过，不会被覆盖。继续？')) return;
        try {
          const r = D.restoreToPage(cur);
          if (r.error) {
            // v1.9.70：模板不匹配 / 草稿空 等错误
            global.QLBMissing && global.QLBMissing.toast &&
              global.QLBMissing.toast(`❌ ${r.error}`, 5000);
          } else {
            const reasonPart = r.reasonRestored ? ` · 文本 ${r.reasonRestored} 段` : '';
            global.QLBMissing && global.QLBMissing.toast &&
              global.QLBMissing.toast(`✅ 已恢复 ${r.restored} 题${reasonPart}（跳过 ${r.skipped}、未匹配 ${r.mismatched}）`, 4000);
          }
        } catch (err) {
          global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('❌ 恢复失败：' + err.message, 3000);
        }
        modal.remove();
      } else if (act === 'copy-current') {
        try {
          navigator.clipboard.writeText(JSON.stringify(cur, null, 2));
          global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('✅ 草稿 JSON 已复制到剪贴板');
        } catch (err) {
          global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('❌ 复制失败（可能需手动允许剪贴板权限）', 3000);
        }
      } else if (act === 'clear-current') {
        if (!confirm('确定清除当前任务的本地草稿？（不影响页面上已打的分）')) return;
        D.clear();
        modal.remove();
        global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('🗑 已清除当前任务草稿');
      } else if (act === 'copy-other') {
        const o = others[parseInt(btn.dataset.idx, 10)];
        if (o) {
          try {
            navigator.clipboard.writeText(JSON.stringify(o.data, null, 2));
            global.QLBMissing && global.QLBMissing.toast && global.QLBMissing.toast('✅ JSON 已复制');
          } catch (err) {}
        }
      } else if (act === 'clear-other') {
        const o = others[parseInt(btn.dataset.idx, 10)];
        if (o && confirm(`确定删除草稿 "${(o.data.url || '').slice(-40)}"？`)) {
          try { localStorage.removeItem(o.key); } catch (err) {}
          // 删除后刷新面板
          modal.remove();
          toggleDraftPanel();
        }
      }
    });
  }

  // ========== 快捷键帮助弹窗 ==========
  function toggleHelp() {
    const exist = document.getElementById(HELP_ID);
    if (exist) { exist.remove(); return; }
    const isQa = global.QLBMode && global.QLBMode.current === 'qa';
    // v1.9.76：根据当前模板生成对应的"打分"快捷键表
    const tpl = (global.QLBMode && global.QLBMode.template) || 'label-old4';
    const modeBadge = isQa
      ? '<span class="qlb-mode-chip qlb-mode-chip--qa" style="margin-left:8px">质检模式</span>'
      : (tpl === 'label-aesthetic10'
        ? '<span class="qlb-mode-chip" style="margin-left:8px">标注模式 · 美学专项 1-10</span>'
        : '<span class="qlb-mode-chip" style="margin-left:8px">标注模式 · 4 档评分</span>');

    let labelTable;
    if (tpl === 'label-aesthetic10') {
      // 美学专项 1-10 分制
      labelTable = `
      <table class="qlb-kbd-table">
        <tr><th colspan="2">打分（美学专项 1-10 分）</th></tr>
        <tr><td><kbd>1</kbd> ~ <kbd>9</kbd></td><td>分别打 <b>1 ~ 9</b> 分（红→绿渐变） → 自动跳下一项</td></tr>
        <tr><td><kbd>0</kbd> / <kbd>\`</kbd> / <kbd>~</kbd></td><td><b style="color:#15803d">10</b> 分（最高） → 自动跳下一项</td></tr>
        <tr><th colspan="2">评分原因（textarea）</th></tr>
        <tr><td>直接输入</td><td>每打字 50 字自动 toast「💾 已保存草稿」</td></tr>
        <tr><td>${(global.QLBPlatform && global.QLBPlatform.combHTML('mod+enter')) || '<kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd>'}</td><td>跳到下一道未答（不换行；普通 Enter 仍是换行）</td></tr>
        <tr><th colspan="2">导航</th></tr>
        <tr><td><kbd>↓</kbd> <kbd>Tab</kbd></td><td>下一项（评分 → 评分原因 → 下一维度评分 → … 列内 DOM 顺序）</td></tr>
        <tr><td><kbd>↑</kbd> <kbd>⇧Tab</kbd></td><td>上一项</td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>切换视频列</td></tr>
        <tr><td><kbd>N</kbd></td><td>定位未答题（循环）</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>取消聚焦</td></tr>
      </table>`;
    } else {
      // 旧 4 档评分模板
      labelTable = `
      <table class="qlb-kbd-table">
        <tr><th colspan="2">打分（4 档评分）</th></tr>
        <tr><td><kbd>1</kbd></td><td><b style="color:#ef4444">0</b> 分 → 自动跳下一题</td></tr>
        <tr><td><kbd>2</kbd></td><td><b style="color:#f59e0b">0.5</b> 分 → 自动跳下一题</td></tr>
        <tr><td><kbd>3</kbd></td><td><b style="color:#10b981">1</b> 分 → 自动跳下一题</td></tr>
        <tr><td><kbd>\`</kbd> / <kbd>~</kbd> / <kbd>4</kbd></td><td><b style="color:#6b7280">none</b>（不适用）→ 自动跳下一题</td></tr>
        <tr><th colspan="2">导航</th></tr>
        <tr><td><kbd>↓</kbd> <kbd>Tab</kbd></td><td>下一题（列内由上至下）</td></tr>
        <tr><td><kbd>↑</kbd> <kbd>⇧Tab</kbd></td><td>上一题</td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>切换视频列</td></tr>
        <tr><td><kbd>N</kbd></td><td>定位未答题（循环）</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>取消聚焦</td></tr>
      </table>`;
    }

    const qaTable = `
      <table class="qlb-kbd-table qlb-kbd-table--qa">
        <tr><th colspan="2">质检 · 通过/不通过（pass 模式）</th></tr>
        <tr><td><kbd>1</kbd></td><td><b style="color:#16a34a">通过</b> → 题目变绿 → 跳下一题</td></tr>
        <tr><td><kbd>2</kbd></td><td><b style="color:#dc2626">不通过</b> → 进入修正分填写</td></tr>
        <tr><th colspan="2">修正分 · 快捷子状态（蓝框）</th></tr>
        <tr><td><kbd>1</kbd>~<kbd>5</kbd></td><td>填 <b>0/0.25/0.5/0.75/1</b> → 跳下一项</td></tr>
        <tr><td><kbd>\`</kbd> 或 <kbd>~</kbd></td><td>填 <b>none</b> → 跳下一项</td></tr>
        <tr><td><kbd>Enter</kbd></td><td>切到<b style="color:#f97316">手动子状态</b>（自由输入 0~1 两位小数）</td></tr>
        <tr><th colspan="2">修正分 · 手动子状态（橙框）</th></tr>
        <tr><td>自由键入数字</td><td>0~1 之间两位小数，例：<code>0.14</code></td></tr>
        <tr><td><kbd>Enter</kbd></td><td>提交并跳下一项（回到快捷模式）</td></tr>
        <tr><td>鼠标点输入框</td><td>= 直接进入手动模式</td></tr>
        <tr><th colspan="2">通用</th></tr>
        <tr><td><kbd>Esc</kbd></td><td>退出 fix 回到 pass 模式</td></tr>
        <tr><td><kbd>↓</kbd> <kbd>Tab</kbd> / <kbd>↑</kbd> <kbd>⇧Tab</kbd></td><td>下一项 / 上一项</td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>切换视频列</td></tr>
        <tr><td colspan="2" class="qlb-kbd-tip" style="margin-top:4px">
          每个修正分输入框下方的 <b>0/0.25/0.5/0.75/1/none</b> 胶囊也可以鼠标点击。
        </td></tr>
      </table>`;

    const modal = document.createElement('div');
    modal.id = HELP_ID;
    modal.className = 'qlb-modal';
    modal.innerHTML = `
      <div class="qlb-modal__mask" data-action="close"></div>
      <div class="qlb-modal__panel">
        <div class="qlb-modal__head">
          <span>帮助 ${modeBadge}</span>
          <button class="qlb-icon-btn" data-action="close" title="关闭" aria-label="关闭">✕</button>
        </div>
        <div class="qlb-modal__body">
          <div class="qlb-help-grid">
            <!-- 左栏：当前模式的核心快捷键 -->
            <div class="qlb-help-col">
              ${isQa ? qaTable : labelTable}
            </div>
            <!-- 右栏：悬浮窗 + 系统检测（双模式通用） -->
            <div class="qlb-help-col">
              <table class="qlb-kbd-table">
                <tr><th colspan="2">悬浮窗 / 画中画（通用）</th></tr>
                <tr><td>${(global.QLBPlatform && global.QLBPlatform.combHTML('mod+shift+0')) || '<kbd>⌘/Ctrl</kbd>+<kbd>⇧</kbd>+<kbd>0</kbd>'}</td><td>悬浮窗 + 工具栏复位右下角</td></tr>
                <tr><td>${(global.QLBPlatform && global.QLBPlatform.combHTML('mod+shift+p')) || '<kbd>⌘/Ctrl</kbd>+<kbd>⇧</kbd>+<kbd>P</kbd>'}</td><td>画中画（可拖副屏）</td></tr>
                <tr><th colspan="2">通用</th></tr>
                <tr><td>${(global.QLBPlatform && global.QLBPlatform.combHTML('mod+z')) || '<kbd>⌘/Ctrl</kbd>+<kbd>Z</kbd>'}</td><td>撤销最近一次批量打分（输入框内仍是浏览器原生撤销）</td></tr>
                <tr><td><kbd>?</kbd> / <kbd>/</kbd> / <kbd>、</kbd></td><td>打开 / 关闭这个帮助面板</td></tr>
                <tr><td>${(global.QLBPlatform && global.QLBPlatform.combHTML('mod+shift+m')) || '<kbd>⌘/Ctrl</kbd>+<kbd>⇧</kbd>+<kbd>M</kbd>'}</td><td>定位未答题</td></tr>
                <tr><td colspan="2" class="qlb-kbd-tip" style="margin-top:4px">
                  ${isQa
                    ? '质检模式：每个分组左上角有 <b style="color:#a855f7">#N</b> 序号；列顶有「全部通过 / 全部不通过」一键操作；每个修正分输入框下方有 <b>0/0.25/0.5/0.75/1/none</b> 胶囊按钮可点击。'
                    : (tpl === 'label-aesthetic10'
                      ? '美学专项：1-9 直接打分（0/`/~ 都是 10 分）→ 自动跳下一项；评分原因 textarea 也算未答；本列全选后焦点会自动跳到该列的"整体评分原因"。'
                      : '4 档评分：1/2/3 直接打分（` / ~ / 4 都是 none）并跳下一题。提交时若有未答会自动拦截。')
                  }
                </td></tr>
              </table>
            </div>
          </div>
          <!-- 底部横贯的工作流与操作区 -->
          <div class="qlb-help-tips">
            <div class="qlb-kbd-tip">
              ${tpl === 'label-aesthetic10'
                ? '<b>工作流：</b>页面打开后自动聚焦视频1·整体评分 → 按 <kbd>1</kbd>~<kbd>9</kbd> 或 <kbd>0</kbd>/<kbd>`</kbd> 打分 → 焦点跳到「整体评分原因」 textarea，输入完按 ' + ((global.QLBPlatform && global.QLBPlatform.combHTML('mod+enter')) || '<kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd>') + ' → 跳到维度1评分 → … → 视频2 整体评分 → … 顺序<b>竖着走</b>。'
                : '<b>工作流：</b>打开页面自动聚焦首个未答题 → 按 <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 打分（<kbd>`</kbd>/<kbd>~</kbd>/<kbd>4</kbd> 都是 none）→ 自动跳下一题。顺序<b>竖着走</b>：视频1 打完 → 视频2 → …'}
            </div>
            <div class="qlb-kbd-tip">
              ${tpl === 'label-aesthetic10'
                ? '<b>批量：</b>工具栏「一键全选」整页同分（按钮颜色随分值红→绿渐变） · 每列顶「本列全选」打完会自动跳到该列「整体评分原因」 · 维度旁胶囊只影响该维度 · 「维度打分后自动跳转」开关美学版默认<b>关闭</b>（防打扰填理由）。'
                : '<b>批量：</b>工具栏「一键全选」整页同分 · 每列顶「本列全选」 · 维度标题胶囊按钮只影响该维度 · 「撤销」回退上次批量 · 提交时有未答会拦截高亮。'}
            </div>
            <div class="qlb-kbd-tip">
              <b>📋 草稿：</b>每次打分 / 输入评分原因都会自动存到本地（300ms 去抖；关标签前最后兜底写一次），刷新或视频加载失败后点工具栏 <b>📋</b> 一键恢复。<b>仅本地，不上传任何数据；7 天后自动清理。</b>
            </div>
            <div class="qlb-kbd-tip">
              <b>📚 文档：</b>
              评估标注标准细则 <a href="https://doc.weixin.qq.com/sheet/e3_AaAAXgafAHACNkxs6voK0RfmB7u01?scode=AJEAIQdfAAoj95bK6FAVYAmga9AP8&tab=cbn8jc" target="_blank" rel="noopener noreferrer" class="qlb-doc-link">点击访问</a>
              ·
              质检问题共识 <a href="https://doc.weixin.qq.com/sheet/e3_AaQAUQYCAM4CNuwOqle4dRzewl6YX?scode=AJEAIQdfAAotW5ZLtBAVYAmga9AP8&tab=BB08J2" target="_blank" rel="noopener noreferrer" class="qlb-doc-link">点击访问</a>
            </div>
          </div>
        </div>
        <div class="qlb-modal__foot">
          <span class="qlb-modal__author">⚡ QLabel Booster · by <a href="https://www.xjl.asia" target="_blank" rel="noopener noreferrer"><b>godwayxiong熊</b></a>（腾讯 · 云雀 · 实习生）</span>
          <span class="qlb-modal__feedback">反馈：<a href="mailto:825121444@qq.com">825121444@qq.com</a></span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target.dataset && e.target.dataset.action === 'close') modal.remove();
    });
    // Esc 关闭
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', onEsc, true);
      }
    };
    document.addEventListener('keydown', onEsc, true);
  }

  function updateProgress() {
    if (!progressEl) return;
    const isQa = global.QLBMode && global.QLBMode.current === 'qa';
    if (isQa && global.QLBQA && global.QLBQA.countProgress) {
      const { pass, fail, none, total } = global.QLBQA.countProgress();
      const done = total - none;
      progressEl.innerHTML = `<span style="color:#4ade80">${pass}</span>·<span style="color:#f87171">${fail}</span>/<span style="color:#9ca3af">${total}</span>`;
      progressEl.classList.toggle('qlb-progress--done', none === 0 && total > 0);
      progressEl.title = `通过 ${pass}，不通过 ${fail}，未答 ${none}（共 ${total}），完成 ${done}/${total}`;
      return;
    }
    const { unanswered, total } = countUnanswered();
    const done = total - unanswered;
    // v1.9.70：美学专项模板下，额外显示评分原因填写率
    // v1.9.75：把 textarea 限定在"评分列容器（getColumns）"内
    //   之前直接 querySelectorAll('textarea') 会把页面上任务说明等不相关 textarea 也算进来
    //   正确口径：每列 = 一个视频 = 一个"整体评分原因"
    let reasonInfo = '';
    let reasonTitle = '';
    if (global.QLBMode && global.QLBMode.template === 'label-aesthetic10') {
      try {
        const cols = (global.QLBSelectors && global.QLBSelectors.getColumns)
          ? global.QLBSelectors.getColumns()
          : [];
        const reasonTextareas = [];
        cols.forEach((c) => {
          c.querySelectorAll('textarea').forEach((t) => reasonTextareas.push(t));
        });
        const reasonTotal = reasonTextareas.length;
        let reasonDone = 0;
        reasonTextareas.forEach((t) => {
          if ((t.value || '').trim().length > 0) reasonDone++;
        });
        if (reasonTotal > 0) {
          reasonInfo = ` · 评分原因 ${reasonDone}/${reasonTotal}`;
          reasonTitle = `\n评分原因填写：${reasonDone} / 共 ${reasonTotal}`;
        }
      } catch (e) {}
    }
    // v1.9.75：评分/评分原因前缀更直观
    progressEl.textContent = `评分 ${done}/${total}${reasonInfo}`;
    progressEl.title = `已答评分 ${done} / 共 ${total}${reasonTitle}`;
    progressEl.classList.toggle('qlb-progress--done', unanswered === 0 && total > 0);
  }

  /** 给每列顶部注入"本列全选"
   *  v1.9.70：
   *  - 根据当前模板用 getScores() 动态生成胶囊
   *  - label-aesthetic10（10 个分值）分两排 5+5，避免一排太挤
   *  - 检测到当前 col-bar 的胶囊数量与当前模板不匹配 → 删旧的重画 */
  function injectColumnButtons() {
    // 质检模式由 qa.js 自己注入列顶按钮，这里不要插打分胶囊
    if (global.QLBMode && global.QLBMode.current === 'qa') return;
    const scores = getScores();
    const tpl = (global.QLBMode && global.QLBMode.template) || 'label-old4';
    const isWide = tpl === 'label-aesthetic10';
    const cols = getColumns();
    cols.forEach((col, idx) => {
      const existed = col.querySelector(':scope > .qlb-col-bar');
      if (existed) {
        // v1.9.70：检查胶囊数量是否对得上当前模板，对不上就重画
        const existedScoreCount = existed.querySelectorAll('.qlb-pill[data-score]').length;
        if (existedScoreCount === scores.length) return;
        existed.remove();
      }
      const bar = document.createElement('div');
      bar.className = 'qlb-col-bar' + (isWide ? ' qlb-col-bar--wide' : '');
      // 胶囊渲染：1-10 分两排（前 5 + 后 5），4 档保持单排
      const pillsHtml = scores
        .map(
          (s) =>
            `<button class="qlb-pill qlb-pill--s${String(s).replace('.', '')}" data-score="${s}">${s}</button>`
        )
        .join('');
      const pillsBlock = isWide
        ? `<span class="qlb-pill-row">${scores.slice(0, 5).map((s) => `<button class="qlb-pill qlb-pill--s${String(s).replace('.', '')}" data-score="${s}">${s}</button>`).join('')}</span>` +
          `<span class="qlb-pill-row">${scores.slice(5).map((s) => `<button class="qlb-pill qlb-pill--s${String(s).replace('.', '')}" data-score="${s}">${s}</button>`).join('')}</span>`
        : pillsHtml;
      bar.innerHTML = `
        <span class="qlb-col-bar__label">视频${idx + 1} 本列全选：</span>
        <span class="qlb-pill-stack">${pillsBlock}</span>
      `;
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        scoreColumn(col, b.dataset.score);
        updateProgress();
        // v1.9.72：美学专项模板下，"本列全选"后优先聚焦该列的"整体评分原因" textarea
        //  （让用户立刻填写理由；如果原因已填则跳到下一未答）
        try {
          const tpl = (global.QLBMode && global.QLBMode.template) || 'label-old4';
          const Nav = global.QLBNavigator;
          if (tpl === 'label-aesthetic10') {
            const ta = col.querySelector('textarea');
            if (ta && !(ta.value || '').trim()) {
              // 直接聚焦 textarea
              try {
                if (Nav && Nav.scrollIntoSafeView) Nav.scrollIntoSafeView(ta);
              } catch (er) {}
              try { ta.focus({ preventScroll: false }); } catch (er) {}
              return;
            }
          }
          // 原模板 / textarea 已填 → 跳到下一道未答题
          const curList = getQuestionsInColumn(col);
          const lastInCol = curList[curList.length - 1];
          if (lastInCol && Nav && Nav.setFocus && Nav.moveFocus) {
            Nav.setFocus(lastInCol, { scroll: false });
            Nav.moveFocus(1, { skipAnswered: true });
          }
        } catch (er) {}
      });
      col.insertBefore(bar, col.firstChild);
    });
  }

  /** 给每个维度标题旁注入快捷按钮
   *  v1.9.70：根据模板动态生成；新模板分两排 */
  function injectDimensionButtons() {
    if (global.QLBMode && global.QLBMode.current === 'qa') return;
    const scores = getScores();
    const tpl = (global.QLBMode && global.QLBMode.template) || 'label-old4';
    const isWide = tpl === 'label-aesthetic10';
    const cols = getColumns();
    for (const col of cols) {
      const dims = getDimensionsInColumn(col);
      for (const dim of dims) {
        if (!dim.titleEl) continue;
        const titleP = dim.titleEl.closest('p.cr-text--bold') || dim.titleEl;
        const existed = titleP.querySelector(':scope > .qlb-dim-bar');
        if (existed) {
          // v1.9.70：胶囊数量与当前模板对不上就重画
          const existedScoreCount = existed.querySelectorAll('.qlb-pill[data-score]').length;
          if (existedScoreCount === scores.length) continue;
          existed.remove();
        }
        const bar = document.createElement('span');
        bar.className = 'qlb-dim-bar' + (isWide ? ' qlb-dim-bar--wide' : '');
        const buildPills = (arr) =>
          arr.map((s) => `<button class="qlb-pill qlb-pill--s${String(s).replace('.', '')}" data-score="${s}">${s}</button>`).join('');
        bar.innerHTML = isWide
          ? `<span class="qlb-pill-row">${buildPills(scores.slice(0, 5))}</span>` +
            `<span class="qlb-pill-row">${buildPills(scores.slice(5))}</span>`
          : buildPills(scores);
        bar.addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          e.preventDefault();
          e.stopPropagation();
          scoreDimension(dim, b.dataset.score);
          updateProgress();
          // v1.9.72：按模板读独立开关
          const shouldAdv = global.QLBState.getAdvanceAfterDimension
            ? global.QLBState.getAdvanceAfterDimension()
            : (state.prefs.advanceAfterDimension === true);
          if (shouldAdv) {
            if (window.__QLB_VERBOSE__) console.log('[QLB] dim-bar click → advanceAfterDimension=true → moveFocus');
            try {
              const lastInDim = dim.groups && dim.groups[dim.groups.length - 1];
              const Nav = global.QLBNavigator;
              if (lastInDim && Nav && Nav.setFocus && Nav.moveFocus) {
                Nav.setFocus(lastInDim, { scroll: false });
                Nav.moveFocus(1, { skipAnswered: true });
              }
            } catch (er) {}
          } else {
            if (window.__QLB_VERBOSE__) console.log('[QLB] dim-bar click → advanceAfterDimension=false (按当前模板) → SKIP advance');
          }
        });
        titleP.appendChild(bar);
      }
    }
  }

  /** v1.9.32：按列从左到右、列内从上到下，把所有维度串成一条线性列表
   *  用于"维度全选后跳到下一维度"的查找 */
  function collectAllDimensionsLinear() {
    const result = [];
    const cols = getColumns();
    for (const col of cols) {
      const dims = getDimensionsInColumn(col);
      for (const d of dims) {
        if (d.groups && d.groups.length > 0) result.push(d);
      }
    }
    return result;
  }

  function injectColumnAndDimensionButtons() {
    injectColumnButtons();
    injectDimensionButtons();
  }

  /** 复位工具栏：拉回默认右下角 + 展开状态（供"复位"按钮/⌘+Shift+0 调用） */
  function resetPos() {
    const wrap = document.getElementById(TOOLBAR_ID);
    if (!wrap) return;
    // 清掉所有自由定位，恢复到 CSS 默认 right/bottom
    wrap.style.left = '';
    wrap.style.top = '';
    wrap.style.right = '';
    wrap.style.bottom = '';
    // 展开（如果之前是折叠的）
    if (wrap.classList.contains('qlb-toolbar--collapsed')) {
      wrap.classList.remove('qlb-toolbar--collapsed');
      savePrefs({ toolbarCollapsed: false });
    }
    savePrefs({ toolbarX: null, toolbarY: null });
  }

  /** 监听打分变化，实时刷新进度 */
  function observeProgress() {
    const ob = new MutationObserver(() => {
      updateProgress();
    });
    ob.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  /**
   * v1.9.40：一键滚动整个页面到顶/底
   *
   * qlabel 打分页有多层滚动容器：
   *   - window / document.scrollingElement —— 外层（iframe body）
   *   - 内层 .cr-container-col--18 / 其它 overflow:auto|scroll 容器
   *
   * 单纯 window.scrollTo 在某些任务页只动外层，内层视频列/题目区不动；
   * 因此这里递归找所有"内容比可视区高的"滚动祖先，统统滚到位。
   *
   * @param {'top'|'bottom'} edge
   */
  function scrollAllToEdge(edge) {
    const isBottom = edge === 'bottom';

    // 1) 外层：window / scrollingElement
    try {
      const target = isBottom
        ? (document.scrollingElement || document.documentElement).scrollHeight
        : 0;
      window.scrollTo({ top: target, left: 0, behavior: 'smooth' });
    } catch (e) {
      try {
        if (isBottom) window.scrollTo(0, document.documentElement.scrollHeight);
        else window.scrollTo(0, 0);
      } catch (er) {}
    }

    // 2) 内层：扫所有可滚动容器（overflow-y: auto | scroll | overlay 且 scrollHeight > clientHeight）
    //    跳过插件自己的 UI 容器
    try {
      const all = document.querySelectorAll('div, section, main, article');
      all.forEach((el) => {
        // 跳过工具栏 / 悬浮窗 / toast / modal
        if (el.id === 'qlb-toolbar' || el.id === 'qlb-player' || el.id === 'qlb-toast' ||
            (el.classList && (el.classList.contains('qlb-modal') || el.classList.contains('qlb-bar')))) return;
        const cs = window.getComputedStyle(el);
        const oy = cs.overflowY;
        if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return;
        if (el.scrollHeight <= el.clientHeight + 1) return;
        try {
          const target = isBottom ? el.scrollHeight : 0;
          if (typeof el.scrollTo === 'function') {
            el.scrollTo({ top: target, behavior: 'smooth' });
          } else {
            el.scrollTop = target;
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  function init() {
    buildToolbar();
    injectColumnAndDimensionButtons();
    updateProgress();
    observeProgress();
  }

  global.QLBToolbar = {
    init,
    updateProgress,
    injectColumnAndDimensionButtons,
    toggleHelp,
    resetPos,
    applyModeUI
  };
})(window);
