# QLabel Booster 更新日志（历史归档）

> 本文件归档 v1.9.7 之前的所有版本变更记录。
> 最新版本请看 [CHANGELOG.md](./CHANGELOG.md)。

遵循 [语义化版本 SemVer](https://semver.org/lang/zh-CN/) 规范：`MAJOR.MINOR.PATCH`

---

## [1.9.12] - 2026-05-06

### 📌 三处文案 / 行为统一

#### 1. manifest description 重写

```
腾讯 QLabel / EvalVerse视频打分提效插件，标注+质检双模式：
一键批量打分、悬浮循环视频窗、键盘快捷键、未答题定位等功能。
Built by 实习生godwayxiong熊🐼。
```

#### 2. 文案统一为「跳转到未答题」

之前各处用语不统一：
- 工具栏按钮：「跳到首个未答」
- 帮助弹窗：「下一道未答题」/「强制定位首个未答 / 错误字段」
- popup 速查：「跳到下一未答题」/「强制定位未答题」
- toast 提示：「已定位到第 X / N 题」

本版全部改为统一术语「**跳转到未答题**」。涉及：
- `toolbar.js` — 工具栏按钮文案 + 帮助弹窗 N 键说明 + ⌘+⇧+M 说明
- `popup/popup.html` — 标注模式 N 键说明 + 通用 ⌘+⇧+M 说明
- `missing.js` — toast 「已跳转到第 X / N 道未答题」

#### 3. 质检模式下系统"必答未填写"提示自动跳转修复

之前质检模式下点提交，如果系统弹「必答未填写」类提示，**插件没自动跳到那道未答题**。

排查：`missing.js` 内的 `installSystemToastWatcher` 早就有这个能力（v1.6.x 起），但识别条件偏窄：

| 项 | 改动 |
|---|---|
| 关键词正则 `REQUIRED_MSG_RE` | 扩容：新增 `必选 / 未答 / 请完成 / 不能为空 / 校验失败 / 还有.*未` |
| 提示容器选择器 | 扩容：新增 `.tea-toast / .tea-message__main / .tea-form-control__status-text--error / [role="status"] / [class*="error-tip"] / [class*="error-text"]` 等 |
| 提交按钮匹配 | 文案兜底匹配从「提交/确认提交/保存并提交」扩展到「完成 / 确定提交」 |
| 兜底轮询时长 | 3s → **5s**（部分 Toast 插入即消失，多给点时间） |
| 可见性判定 | 增加 `opacity < 0.05` 视为不可见，避免捕获已淡出的旧 toast |

底层流程（已经在的能力，文档化一下）：
1. 用户点提交 → 系统校验失败 → 弹出 `.tea-message` / `.tea-toast` 等含「必答」字样的元素
2. `installSystemToastWatcher` 的 MutationObserver 命中 → 调用 `scanMissing()`
3. `scanMissingDetailed()` 在 **质检模式下** 用「通过/不通过未选 = 未答」语义找到未答题
4. `focusField()` 检测到 `QLBMode.current === 'qa'` → 调用 `QLBQA._setFocus(group)` 蓝框聚焦
5. toast 提示：「📍 系统提示必答未填，已跳转到第 1 / N 道未答题」

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 在质检页故意留几题不答 → 点提交 → 系统弹"必答未填写"提示 → 应自动跳到第一道未答题（蓝框）+ 弹 toast
3. 工具栏「跳转到未答题」按钮、帮助弹窗 N 键说明、popup 速查 都已统一为新文案
4. 扩展图标 → popup 顶部版本号 v1.9.12；manifest description 已按要求更新

### 🆘 如果质检模式仍无法自动跳转

请在质检页提交触发"必答未填写"提示后，**立刻**在控制台跑：

```js
console.log({
  toasts: Array.from(document.querySelectorAll('.tea-message, .tea-notification, .tea-toast, [role="alert"], [role="status"]'))
    .map(n => ({ cls: n.className, txt: (n.textContent||'').slice(0,80) })),
  hits: window.QLBMissing.scanMissingDetailed?.().length
});
```

把输出贴给我，我立刻按真实容器加选择器。

---



### 🐛 三处体验修复

#### 1. 恢复 manifest description 的作者信息

v1.9.9 精简 description 时把"实习生 godwayxiong熊🐼"也一并删掉了，本版恢复，并按用户期望开头加上「标注+质检双模式」标签：

```
标注+质检双模式 · 腾讯 QLabel / EvalVerse 视频打分效率增强插件：
一键批量打分 · 键盘快捷键 · 悬浮循环视频窗 · 未答题定位。
Built by 实习生godwayxiong熊🐼。
```

#### 2. 悬浮窗倍速 select hover 反馈缺失

之前 `.qlb-player__rate` 没有 hover/focus 样式，鼠标移上去无反应，与左右切换/PiP/复位/关闭按钮的视觉不一致。

新增：
- **hover**：背景从 5% 白提升到 18% 白 + 边框从 15% 白提升到 28% 白
- **focus**（点击展开）：边框换成蓝紫 `rgba(99,102,241,0.6)` + 2px 蓝紫光晕，与其他按钮的 active 反馈风格一致
- 加 `cursor: pointer` 和 0.12s 过渡动画

#### 3. 切题后悬浮窗自动重扫（关键体验修复）

**之前**：用户答完一题后页面切到下一题，新视频 src 已经加载，但悬浮窗仍显示上一题的视频，必须**手动关闭悬浮窗再重开**才能看到新视频。

**之前的机制为什么不工作**：之前的"自动 reload"逻辑写在 `missing.js#scheduleReloadOnNewVideos`，它只在用户**点提交按钮时**才启动。如果切题不通过点提交（SPA 直接前进、或用户切到其他题再回来），就完全不触发。

**修复**：把"检测视频集合变化 → 自动 reload"的能力**内嵌到 `floating-player.js#observeNewVideos()`**，作为悬浮窗自身的常驻能力：

```js
new MutationObserver(() => requestAnimationFrame(() => {
  if (!悬浮窗显示中) return;
  const cur = snapshotUrls();
  if (cur 与上次相同) return;
  // 防抖 250ms 等新视频 src 全部就位再 reload
  setTimeout(() => {
    reload();           // 内部会 refreshSources + render 第 0 个 = 原视频0
    toast('🔄 检测到新视频，悬浮窗已自动更新');
  }, 250);
}));
```

行为细节：
- 仅在悬浮窗"已显示"时才主动 reload，避免后台无意义触发
- 250ms 防抖 + "再次确认" 双保险，防止 React 渲染过渡态触发误更新
- reload 后悬浮窗自动跳到「原视频0」（与 v1.9.8 「首次打开默认原视频0」逻辑一致）
- 同时保留 `missing.js#scheduleReloadOnNewVideos`（提交按钮触发的旧路径），两条机制叠加更稳

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 打开任务页 + 打开悬浮窗 → 答完一题进入下一题 → 应弹出 toast「🔄 检测到新视频，悬浮窗已自动更新」+ 悬浮窗自动切换到新题的「原视频0」
3. 鼠标移到悬浮窗倍速 select → 背景变亮、边框变粗
4. 点扩展图标看 popup 顶部版本号 → v1.9.11；manifest description 含「实习生 godwayxiong熊🐼」

---



### 🐛 工具栏短按消失修复 + 复位位置上移 + 字体升级

#### 1. 修复工具栏短按消失（严重 bug）

**现象**：用户在工具栏 header 上短按一次（点了但没拖动），右下角面板有时直接看不到了，必须刷新页面才能恢复。

**根因**：`mousedown` 处理函数里立即把 `wrap.style.right = 'auto'; bottom = 'auto'`，但**没有立刻设 `left/top`**。如果用户没移动鼠标 → `mousemove` 不会触发 → 此时面板的 left/top/right/bottom **全是 auto** → 浏览器把它定位回 `(0, 0)` 左上角，被页面其他元素遮住，看起来就"消失"了。

**修复**（双保险）：
- `mousedown` 里**先**用当前 rect 锁定 `left/top`，**再**清 `right/bottom`（顺序对了就不会坍缩）
- `mouseup` 里如果没移动（`moved === false`）→ 还原到拖拽前的视觉位置：
  - 之前没保存过自定义位置 → 清空所有 inline style，让 CSS 默认 `right:20px; bottom:20px` 接管
  - 之前保存过 → applySavedToolbarPos 重新生效

#### 2. 复位时悬浮窗位置上移（避免与工具栏重叠）

之前 `floating-player.js` 的 `resetPos()` 写死 `y = vh - h - 260`（给工具栏留 260px）。但工具栏完整展开高度常超过 260px，悬浮窗底部会和工具栏顶部重叠。

**修复**：动态测量工具栏实际高度：
```js
const tb = document.getElementById('qlb-toolbar');
const toolbarH = tb ? tb.getBoundingClientRect().height : 320;
// 留 24px gap + 20px 工具栏自身 bottom 距离视口的距离
const y = Math.max(0, vh - h - toolbarH - 44);
```

无论用户折叠/展开工具栏、双模式切换导致工具栏高度变化，都能精确避开重叠。

#### 3. 字体栈升级

之前用的是 `-apple-system, "Helvetica Neue", sans-serif`：
- macOS 上 → SF Pro（OK）
- Windows 上 → 大多数机器没装 Helvetica Neue，**回退到默认 sans-serif（Arial 或老版微软雅黑），中文渲染较平庸**
- Linux 上 → 全靠默认，更差

**改进**：现代系统字体栈，覆盖 mac / win / linux，**不引入任何外部字体**（无网络加载、无权限要求）：

```css
--qlb-font-sans:
  -apple-system, BlinkMacSystemFont,                    /* macOS / iOS：SF Pro */
  "Segoe UI Variable Display", "Segoe UI",              /* Windows 11/10 */
  "Helvetica Neue", Helvetica, Arial,                   /* 兜底 */
  "PingFang SC", "Hiragino Sans GB",                    /* mac 中文：苹方 / 冬青黑体 */
  "Microsoft YaHei UI", "Microsoft YaHei",              /* Win 中文：微软雅黑 UI（更新版本）*/
  "Source Han Sans SC", "Noto Sans CJK SC",             /* Linux / 跨平台 */
  sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji";
--qlb-font-mono:
  "SF Mono", "JetBrains Mono", "Fira Code", "Cascadia Code",
  Menlo, Consolas, "Roboto Mono", "Ubuntu Mono", monospace;
```

并启用全局字体平滑：
```css
-webkit-font-smoothing: antialiased;          /* mac WebKit 渲染 */
-moz-osx-font-smoothing: grayscale;            /* Firefox on mac */
text-rendering: optimizeLegibility;            /* 启用连字 / 字距 */
font-feature-settings: "cv11", "ss01", "ss03"; /* SF Pro 的可读性变体 */
```

popup.css 也做了同样升级，并适配新增的 `.sub-tip` 与 `.kbd-mod` 样式（v1.9.9 popup.html 重写时新增的）。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. **工具栏拖拽 bug**：在工具栏 header 短按一次（不要拖动）→ 面板应**保持原位**，不再消失；连按 10 次也不会出问题
3. **悬浮窗复位**：按 `⌘/Ctrl+Shift+0` 或点工具栏「复位」→ 悬浮窗应稳稳停在工具栏正上方，与工具栏之间有 24px 间距，不重叠
4. **字体**：
   - macOS：所有插件 UI 应该是清晰的 SF Pro，中文是苹方
   - Windows：应该是 Segoe UI / Segoe UI Variable + 微软雅黑 UI（比之前的 Arial + 老版雅黑明显更现代）
   - 中英文混排时基线对齐更好

---



### 🧹 代码质量大扫除（基于静态审查报告）

#### 1. 文档/UI/代码三方一致性修复（高严重度）

之前 `popup.html` 和 `README.md` 都写着「`4` → none」，但实际代码里 `4` 早就废弃了，改用 `` ` `` / `~`。新人看了文档照着按 `4` 永远没反应。

- **`popup/popup.html`**：彻底重写
  - 删除 2 个死开关（`playerVisible` / `highlightFocus`，content script 从来没读过它们）
  - 快捷键速查从「6 行」扩展为「**标注模式 / 质检模式 / 通用** 三段」，与代码完全对齐
  - `4 → none` 改为 `` ` 或 ~ → none ``
- **`README.md`**：完全重写
  - 补全「质检模式」的所有功能介绍
  - 目录结构从 9 个文件补到当前 13 个 src 文件，每个文件加一行职责说明
  - 加模块依赖图 + 控制台调试入口示例
- **`manifest.json`**：description 精简 + 修术语
- **删除 `DEBUG.md`**：写着的版本是 1.0.0（实际 1.9.x），完全过时；CHANGELOG 已经覆盖所有调试要点

#### 2. popup 与 content 不再脱节

- `state.js` 新增 `chrome.storage.onChanged` 监听器
- 用户在 popup 点开关 → content script 端 `state.prefs` 立刻同步 → 下一次按键就生效
- 之前必须刷新页面才能让 popup 改动生效

#### 3. 死代码清理

| 位置 | 类型 | 处理 |
|---|---|---|
| `floating-player.js` `startLoopGuard()` + `loopGuardTimer` | setInterval 与 MO 重复劳动 | **删除**，MO 节流改 rAF |
| `scroll-sync.js` `onFocusedColumnChanged()` | 全项目无引用 | **删除** |
| `scroll-sync.js` setInterval | 永驻 + 频率过高 | 保存 id 可清理 + 频率 2s → 5s |
| `selectors.js` `SEL.errorToast` 数组 | 全项目无引用 | **删除** |
| `popup/popup.js` `playerVisible/highlightFocus` 默认值 | 配套删除 | **删除** |

#### 4. 日志噪声清理

- `src/content.js` 的 `log()` 改为只在 `window.__QLB_VERBOSE__ = true` 时输出
- `src/platform.js` 顶层 `console.debug` 同样改为受控（之前每个 frame 都打一行 `[QLB:Platform] os = mac`）
- 默认情况下控制台干净，只在排查问题时手动开启 `window.__QLB_VERBOSE__ = true`

#### 5. CSS 主题色变量化（基础设施）

`styles.css` 顶部新增 `:root` 主题变量：

```css
:root {
  --qlb-color-pass: #16a34a;
  --qlb-color-fail: #dc2626;
  --qlb-color-focus: #3b82f6;
  --qlb-color-focus-fix: #f97316;
  --qlb-color-mode-label: #93c5fd;
  --qlb-color-mode-qa: #d8b4fe;
  /* ... */
}
```

后续新增 UI 一律用这些变量，将来如果要做"暗色模式 / 浅色模式 / 自定义主题"时可以一处改色全局生效。

> 注：现有硬编码颜色暂不替换，避免大面积视觉回归；将随后续迭代逐步迁移。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. **popup 联动**：点扩展图标 → 关闭「启用键盘快捷键」→ 不刷新页面 → 按 `1` 应**不再**打分（之前必须刷新）
3. **新版 README + popup 文案**：所有 `4 → none` 字样已替换为 `` ` `` / `~`
4. **控制台干净**：默认刷新页面后 console 不再有 `[QLB:TOP] ...` 日志（要看就 `window.__QLB_VERBOSE__ = true` 然后再刷新）
5. **悬浮窗循环**仍按 v1.9.8 顺序：原视频0 → 视频1~N → 参考图视频0

### 🔭 后续大重构（已识别但暂未做）

为避免一次改动太多引入回归，下面这些留到下版做：
- **MutationObserver 中心化**：当前 7 个 MO 各自订阅 body subtree，部分还监听 attributes，React 重渲染密集时 CPU 较高。下版抽 `QLBObservers.onDomChange()` 中心模块，单 MO + rIdleCallback 调度
- **跨 frame 键转发去重**：`content.js` 给 forwarded event 加了 `__qlbForwarded` 标记，但 `navigator.js` 没消费 → 当前依赖 `handledEvents WeakSet` 救场，理论上仍有少量重复
- **CSS 颜色全面迁移到变量**：本版只建立基础设施，未替换全部硬编码

---



### 🎯 悬浮窗顺序修正 + macOS / Windows 快捷键自适应

#### 1. 悬浮窗循环顺序

之前因为 sources 排序受 DOM 出现顺序影响，参考图视频可能落在中间，导致首次打开悬浮窗时不一定是「原视频0」。本版改为 **强制三段排序**：

```
原视频0 → 视频1 → 视频2 → ... → 视频N → 参考图视频0 → 原视频0 → ...
```

具体做法：
- `refreshSources()` 末尾用稳定排序，把 `__qlbIsRef === true` 的视频统一推到末尾
- `show()` 每次打开悬浮窗都强制 `currentIndex = 0`（即原视频0），不再受历史 prefs.playerVideoIndex 影响
- 这样无论你之前停在哪个视频，**重新打开悬浮窗永远从原视频0 开始**

#### 2. 快捷键文案按系统自适应（mac / win / linux）

新增 `src/platform.js` 模块，识别用户系统并提供对应的按键符号。检测优先级：
1. `navigator.userAgentData.platform`（新 API，Chrome 90+）
2. `navigator.platform`（兼容老 API）
3. `navigator.userAgent`（兜底）

| 系统 | mod | shift | alt | enter |
|---|---|---|---|---|
| **macOS** | ⌘ | ⇧ | ⌥ | ↩ |
| **Windows / Linux** | Ctrl | Shift | Alt | Enter |

帮助弹窗 + 工具栏按钮 tooltip + missing 模块 toast 全部使用 `QLBPlatform.combo()` / `combHTML()` 自动渲染：

| 位置 | mac 显示 | win 显示 |
|---|---|---|
| 帮助 - 复位 | `⌘+⇧+0` | `Ctrl+Shift+0` |
| 帮助 - 画中画 | `⌘+⇧+P` | `Ctrl+Shift+P` |
| 帮助 - 未答检测 | `⌘+⇧+M` | `Ctrl+Shift+M` |
| 工具栏画中画按钮 tooltip | `⌘+⇧+P` | `Ctrl+Shift+P` |
| 工具栏复位按钮 tooltip | `⌘+⇧+0` | `Ctrl+Shift+0` |
| 悬浮窗 PiP / 复位按钮 tooltip | 同上 | 同上 |

注意：实际键盘监听代码里始终用 `e.metaKey || e.ctrlKey`，所以 mac 按 ⌘ / win 按 Ctrl 都能触发，**功能本身是跨平台一致的**，本次只改动了 UI 文案。

#### 3. 调试入口

控制台可查 `QLBPlatform.os` 看检测结果（mac / win / linux / unknown）。

### 📋 验证

1. `chrome://extensions/` → 刷新插件
2. 悬浮窗打开 → 应显示 **原视频0/N**（无论之前停在哪都从这里开始）
3. 按 ▶ 一圈：原视频0 → 视频1 → 视频2 → ... → 视频N → **参考图视频0** → 回原视频0
4. mac 用户打开帮助：所有快捷键显示 `⌘+⇧+P` 这种 mac 风格
5. win 用户打开帮助：所有快捷键显示 `Ctrl+Shift+P` 这种 win 风格

### 💡 后续开发

`QLBPlatform` 是一个通用工具，**今后所有新增功能涉及快捷键展示的，都应通过它而不是硬编码**：

```js
// 推荐写法
const tip = `按 ${QLBPlatform.combo('mod+shift+x')} 可以...`;
// 帮助表格
<td>${QLBPlatform.combHTML('mod+shift+x')}</td>
```

---



### 📐 屏幕分辨率 / 像素密度自适应

之前所有尺寸都按 `1920×1080 + 96 DPI` 写死，在小屏（13" 笔记本 / 缩放窗口）会撑出视口，在 4K 屏上又显得很小。本版加了 5 套断点：

| 屏宽 | 工具栏 | 悬浮窗 | 备注 |
|---|---|---|---|
| `< 1024px`（移动 / 半屏） | 220px / 字 12px | 280×175 | 工具栏边距收紧到 12px |
| `< 1280px`（13" 笔记本） | 232px / 字 12.5px | 320×200 | 按钮 padding 收 1px |
| `1280 ~ 2560px`（默认） | 256px / 字 13px | 360×220 | 与 v1.9.6 一致 |
| `>= 2560px`（4K） | 288px / 字 14px | 420×252 | 适当放大避免显得渺小 |
| 横屏窄高 `< 600px` | max-height 全部用 vh | 上限 50vh | 帮助弹窗 96vh、工具栏可滚 |

**HiDPI / Retina 屏**（dppx ≥ 1.5）：
- 启用 `-webkit-font-smoothing: antialiased` 让字体渲染更精细
- 1px 实色边框改为 6~8% 半透明白，在高密度屏上不再显粗

**视口溢出防护**：
- `.qlb-toolbar` 加了 `max-width: min(92vw, 320px)` + `max-height: calc(100vh - 40px)` + `overflow-y: auto`，浏览器再小都能完整显示并可内部滚动
- `.qlb-player` 加了 `max-width: min(90vw, 720px)` + `max-height: min(60vh, 480px)`，再小再大都不溢出
- `floating-player.js` 的 `resetPos()` 也按视口宽度选择尺寸

**用户偏好支持**：
- `@media (prefers-reduced-motion: reduce)` —— 系统启用"减少动效"时，关闭所有 transition / animation（无障碍 + 节能场景）

### 📋 验证

1. `chrome://extensions/` 刷新插件
2. 把浏览器窗口缩小到 1024px 宽以下 → 工具栏 / 悬浮窗会自动变小，仍完整显示
3. 4K 屏用户：所有 UI 自动放大，文字按钮不再显得渺小
4. macOS 系统设置里开"减少动效" → 工具栏切换、按钮 hover 等动画自动关闭

---



### 🐛 同步滚动重写：改"比例同步"，告别拖滚动条时的跳列与文字截断

#### 问题
- 鼠标拖动横滚条时，**视频1 左侧文字** / **视频6 右侧文字**显示不全，需要再额外手动滚一次才能看清
- 鼠标拖动总感觉视频和题目"对不齐"，有"咔哒一下"的跳列感
- 但触摸板横向滑动却很顺畅 —— 体验明显不一致

#### 根因
v1.7.0 起的同步策略是「找最近列 → 把另一侧的对应列居中」：
1. 触摸板横滑每帧 deltaX 极小，scroll 事件高频触发，"最近列"判定平滑递进 → 看似顺畅
2. **鼠标拖滚动条**一次跨多个单位，scrollLeft 突变 → 最近列突变 → 另一侧"咔哒一下"强制居中到新列
3. **首尾两列居中无意义**：视频1 居中会让其左侧文字溢出视口；视频6 居中会让滚动条无法到底，从而**截掉视频6 右侧文字**

#### 修复：改为「scrollLeft 比例 1:1 同步」
- 用源轨道的 `scrollLeft / maxScrollLeft` 比例直接乘到目标轨道的 `maxScrollLeft`
- 用户拖动滚动条到任意位置，目标轨道按相同比例同步跟随，**完全 1:1 跟手**
- 首尾两端可完整可见（视频1 左侧、视频6 右侧文字不再被截）
- 不再"咔哒跳列"，触摸板和鼠标拖动行为完全一致

#### 程序回写防回弹
新增 `writingBack` 计数器：当本侧用 mirrorScroll 写回 dst 的 scrollLeft 时，dst 的 scroll 事件会跳过本次（避免 dst 又把它认为是用户操作再反向同步源轨道，导致死循环抖动）。

#### 键盘切列保留"居中"行为
按 ←/→ 切列、按 N 跳到首个未答题等场景仍然需要"咔哒卡到目标列中央"的视觉效果（这是用户期望的）。`syncByFocusedGroup` 仍走 `centerInTrack` 居中路径，并通过 writingBack 标记防止反向回弹。

#### 删除 wheel 兜底
v1.7.x 时为补救"列居中跳变"的迟滞，加了一个 wheel 兜底事件做"下一帧再对齐"。比例同步模式下 scroll 事件本身就足够实时，wheel 兜底反而引入额外帧延迟，已删除。

### 📋 验证
1. `chrome://extensions/` → 刷新 QLabel Booster
2. 6 个视频时，**鼠标拖动视频行 / 题目行的横滚条**：另一侧应**逐像素跟随**，没有"咔哒"跳列
3. 拖到最左 → 视频1 + 视频1 题目栏左侧文字完整显示
4. 拖到最右 → 视频6 + 视频6 题目栏右侧文字完整显示
5. 触摸板横滑 / Shift+滚轮 → 行为与拖滚动条一致
6. 按 → 键切列 → 仍保留"咔哒卡到下一列居中"的视觉（这是预期行为）

---



### 🎯 修复参考图视频识别 + 标注质检快捷键对齐

#### 1. 参考图视频识别（基于实测 DOM 重写）

之前的策略一直没识别成功。从用户控制台诊断信息看清了真实结构：
- 真实视频共 **12 个 `<video>` 元素**（含克隆/替身），其中 6 个有 src 进入悬浮窗
- **原视频**：祖先链上有 `cr-container-col--6`，文字以「原视频」开头
- **评分视频 × 4**：祖先链上有 `cr-container-col--18`（视频行轨道），含「评分视频」字样
- **参考图视频**：祖先链上有 `cr-container-col--6`，文字以「Prompt」开头（**根本不在 col--18 内**！）

新识别逻辑（`refreshSources` 内）：
- 沿 video 祖先链向上查找最近的 `cr-container-col--6`
- 该层文字以「Prompt / 参考图 / 参考视频 / 提示词」字样开头（且不以"原视频"开头）→ 标记 `__qlbIsRef = true`
- 中途碰到 `col--18` → 是评分视频，停止（不染 ref）

预期效果：6 个视频时悬浮窗循环显示
```
原视频0/5 → 视频1/5 → 视频2/5 → 视频3/5 → 视频4/5 → 参考图视频0/5
```

#### 2. 标注模式 none 快捷键改为 \` / ~（与质检对齐）

- 标注模式之前是 `1=0 / 2=0.5 / 3=1 / 4=none`
- **改为 `1=0 / 2=0.5 / 3=1 / `=none / ~=none`**，与质检模式一致
- 帮助弹窗已同步更新
- `4` 键现在不再是快捷键（释放出来给将来扩展）

### 📋 验证

1. `chrome://extensions/` → 刷新插件
2. 质检页打开悬浮窗按 ▶：
   - 第 1 个 = 原视频0/5（视频行最左）
   - 第 2~5 个 = 视频1/5 ~ 视频4/5（4 个评分视频）
   - **第 6 个 = 参考图视频0/5**（来自 prompt 区域）
3. 标注模式：聚焦某题按 `` ` `` 应填入 none，按 `4` 不再有反应

---



### 🎨 修正分胶囊条配色（参考标注模式）

之前 6 档胶囊都是白底灰字，看不出语义。现在按"差→好"色阶配色，与标注模式胶囊一致：

| 分值 | 颜色 | 备注 |
|---|---|---|
| **0** | 浅红 / 深红字 | 与标注模式 `0` 一致 |
| **0.25** | 浅橙 / 深橙字 | 中间档渐变 |
| **0.5** | 浅黄 / 棕字 | 与标注模式 `0.5` 一致 |
| **0.75** | 浅黄绿 / 深绿字 | 中间档渐变 |
| **1** | 浅绿 / 深绿字 | 与标注模式 `1` 一致 |
| **none** | 浅灰 / 深灰字 | 与标注模式 `none` 一致 |

hover 时统一上浮 + 阴影 + brightness(0.95)，不再用紫色覆盖。点击后仍保留绿色 flash 表示"已填入"。

### 📋 验证
1. `chrome://extensions/` 刷新
2. 质检页：每个修正分输入框下方的 6 个胶囊呈现红→橙→黄→黄绿→绿→灰渐变色

---



### 🎯 修正分填写：拆分"快捷子状态" + "手动子状态"

#### 问题
v1.9.0 之后选"不通过"会进入 fix 模式，光标自动进入修正分输入框（闪烁）。但用户**鼠标点击输入框是想手动输入** `0.14` 这种数字，按 `1/2/3` 又被快捷键劫持成快捷打分 → 冲突。

#### 解决：fix 模式拆为两个子状态

**🔵 快捷子状态（默认进入，蓝框）**
- 进入条件：按 `2 不通过` 自动进入 / 按快捷键填完跳到下一项
- input 保持 `readonly`，**不闪光标**，不抢用户的输入焦点
- 键盘 `1/2/3/4/5` = 0/0.25/0.5/0.75/1，`` ` `` / `~` = none，填完自动跳下一项
- `Enter` = 切换到**手动子状态**（如果当前快捷值不够用，要手打 0.14 等）

**🟠 手动子状态（橙框）**
- 进入条件：
  - 在快捷子状态下按 `Enter`
  - 鼠标点击输入框
- input 去 `readonly` + 浏览器原生 focus + 光标闪烁，光标自动放末尾
- 输入框右上角浮出橙色提示「✍ 自由输入 · Enter 确认」
- 键盘**完全放行**：1/2/3 不再当快捷键，用户能自由打 `0.14` 等任意数值
- `Enter` = 把当前 input 值用 React-friendly setter 提交，**自动回到下一项的快捷模式**
- `Tab/↓` = 跳下一项（不强制提交），`Esc` = 退出 fix 回 pass 模式

#### 视觉对比
| 子状态 | outline | 输入框 | 特别提示 |
|---|---|---|---|
| 快捷 | 蓝色 | readonly · 不闪光标 | （无） |
| 手动 | **橙色** | 可编辑 · 光标闪烁 | 右上角橙色 chip「✍ 自由输入 · Enter 确认」 |

#### 行为细节
- 用户在手动模式按 Enter → 提交 + 跳下一项 → **新项默认是快捷模式**（蓝框），可继续按 1/2/3
- 用户在手动模式按 Tab/↓ → 跳下一项（不提交，保留输入框现有值）
- 用户在手动模式 blur（点别处）→ input 自动加回 readonly，子状态恢复为 'shortcut'
- 切换聚焦项（moveFixFocus）时，旧 input 的 readonly 自动恢复，避免 React 状态错乱

### 📋 验证

1. `chrome://extensions/` → 刷新插件
2. 质检页：选某题"不通过" → 第一个修正分被**蓝框**框住（不闪光标）
3. 直接按 `3` → 填 0.5 → 跳下一项（仍蓝框）
4. 在新项上按 `Enter` → 输入框变**橙框**，光标进入，右上角浮出"✍ 自由输入 · Enter 确认"
5. 键入 `0.14` → 按 `Enter` → 提交 + 跳下一项 + 回到蓝框（继续可按 1/2/3）
6. 鼠标直接点某个修正分输入框 → 立刻进入手动模式（橙框 + 光标）
7. 在手动模式按 `1` 应该输入数字 1 而不是被劫持

---



### 🎨 复位按钮换 SVG 图标 + 修复参考图视频识别

#### 1. 悬浮窗复位按钮换为 SVG 图标
- 之前用 Unicode 字符 `⟲`，在 macOS 各种字体下渲染大小不稳定，永远比 `◀ ▶ ⛶` 小一档
- 改为内联 SVG：14×14 矢量"逆时针箭头"图标，用 `stroke="currentColor"` 自动跟随按钮颜色
- 优势：尺寸完全可控、不依赖字体、视觉与其他按钮严格对齐

#### 2. 修复"参考图视频"识别失败 → 显示成"视频5/5"
- v1.8.5 / 1.9.x 用"祖先链向上找含 Prompt 字样的 col--18"判断，但实际 DOM 结构里参考视频的祖先链可能先碰到 col--6/--8 等中间层导致判断错失
- 改为更精确的策略：
  - 找题目轨道（含 `[name="通过"]` 的 col--18） + 视频行（含 video 但不含通过 radio 的 col--18）
  - **video 在题目轨道里、且不在视频行里 → 一定是参考图视频**
- 编号显示：`参考图视频0/N`，N = 普通视频总数（原视频 + 评分视频，不含参考视频）
- 4 评分 + 1 原视频 + 1 参考视频 时显示：
  ```
  原视频0/5 → 视频1/5 → 视频2/5 → 视频3/5 → 视频4/5 → 参考图视频0/5
  ```

### 📋 验证
1. `chrome://extensions/` → 刷新插件
2. 悬浮窗 header 的复位按钮应是 **清晰的圆角箭头 SVG**，与左右箭头、PiP、关闭按钮视觉大小完全一致
3. 质检页打开悬浮窗按 ▶ 切换：第 6 个视频应显示 **参考图视频0/5**（而不是 视频5/5）

---



### 🐛 两处微调

#### 1. 不通过题加回淡红色背景
- v1.9.0 完全去掉了红色，但用户希望仍能从颜色上一眼分辨"通过/不通过"
- 加回 `.qlb-qa-fail` 样式：**淡红色背景（rgba(220,38,38,0.07)）+ 左红条**，比之前 v1.8.x 的红色更柔和
- 整体配色：通过=绿、不通过=红、当前聚焦=蓝、未答=无色

#### 2. 自适应聚焦滚动
- v1.9.0 用 `scrollIntoView({block:'center'})` 把元素居中到视口正中，但视口正中常被**视频行**覆盖 → 用户看不到当前聚焦项
- 重写为 `scrollIntoSafeView()`：
  - **动态测量视频行的底部位置**作为安全区上边界（而不是死设定 padding）
  - 安全区 = `[视频行底部 + 8px, 视口底部 - 60px]`
  - 元素已在安全区里 → **不滚动**（避免抖动）
  - 元素超出安全区 → 滚到安全区上边界 + 12px 缓冲
- 这样无论用户的视频行是 200px 还是 350px 高，无论页面是 13" 还是 27" 显示器，聚焦项都能稳定出现在视频行下方第一时间可见的位置

### 📋 验证
1. `chrome://extensions/` → 刷新插件
2. 质检页：
   - 选不通过的题应显示**淡红色背景 + 红条**
   - 按 1/2 切换题目时，当前聚焦的题目应稳定出现在**视频行下方**清晰可见，不会被视频遮住
   - 当前题已经在视野中时按 ↓/↑ 不会触发不必要的小幅滚动

---



### 🎯 质检模式交互重写：标注式逐题导航

按用户反馈彻底重写质检的键盘 + 视觉交互模型，**完全参照标注模式的"一题一题往下走"**风格。

#### 1. 删除所有红色不通过染色
- 删除 `.qlb-qa-fail` CSS 与 `refreshFailHighlights()` 函数
- 不通过现在**不再染色**，避免视觉干扰

#### 2. 通过 → 题目变绿
- 新增 `.qlb-qa-pass` 样式：淡绿色背景 + 左侧绿条
- `refreshPassHighlights()` 只染"通过"的题，让用户一眼看到自己已经检查过哪些 + 哪些没通过

#### 3. 双模式键盘交互（pass / fix）
- **pass 模式**（聚焦"通过/不通过"组）：当前题被蓝色 outline 框住
  - <kbd>1</kbd> = 通过 → 题目变绿 → 自动跳下一题（保持 pass 模式）
  - <kbd>2</kbd> = 不通过 → 自动进入 **fix 模式**，焦点转移到本题第一个修正分输入
- **fix 模式**（聚焦修正分输入）：当前输入框被蓝色 outline 框住
  - <kbd>1</kbd> = 0、<kbd>2</kbd> = 0.25、<kbd>3</kbd> = 0.5、<kbd>4</kbd> = 0.75、<kbd>5</kbd> = 1
  - <kbd>\`</kbd> 或 <kbd>~</kbd> = none
  - <kbd>Enter</kbd> = 用户手打数字（如 0.67）后回车，跳下一项
  - 填完一项 → 自动跳本题下一个修正分；本题修正分都填完 → 回到 pass 模式 + 跳下一题
  - <kbd>Esc</kbd> = 退出 fix 模式回到 pass 模式
- **导航键**两种模式通用：<kbd>Tab</kbd> / <kbd>↓</kbd>、<kbd>⇧Tab</kbd> / <kbd>↑</kbd>、<kbd>←</kbd> <kbd>→</kbd>

#### 4. 鼠标点击胶囊条也走 fix 流程
- 点击修正分输入框旁的 `[0][0.25][0.5][0.75][1][none]` 胶囊，**会自动跳到下一项**
- 连续点几个就能像键盘一样一路填到本题尾，体验和键盘一致

#### 5. 修复悬浮窗 ⟲ 复位按钮图标偏小
- `⟲` 字符在 macOS 字体里偏小，从 14px → **17px** + `font-weight: 600`
- `⛶` 画中画也微调到 15px，整体视觉对齐

#### 6. 帮助弹窗重写
- 把质检快捷键拆成 `pass 模式` / `fix 模式` 两段，清晰对应实际状态
- 加底部 tip 提示鼠标点胶囊也能用

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 质检页测试完整流程：
   - 第 1 题被蓝色 outline 框住 → 按 `1` → 变绿 + 跳第 2 题（仍蓝框）
   - 第 2 题按 `2` → 焦点跳到本题"修正分1"输入框（蓝框）
   - 按 `3` → 修正分1 填入 0.5 → 自动跳到"修正分2"
   - 按 `5` → 修正分2 填入 1 → 跳"修正分3"
   - 按 `~` → 修正分3 填入 none → 本题修正分填完 → 自动回到 pass 模式 + 跳第 3 题
3. 整页**没有红色覆盖**，只有"通过"题目是淡绿色 + 当前聚焦的蓝色框
4. 悬浮窗 header 的 ⟲ 复位按钮图标视觉大小与 ◀ ▶ ⛶ ✕ 对齐

---



### 🐛 修复质检页悬浮窗的视频编号

- **问题**：v1.8.2 把"参考图视频"强制置顶为 sources[0]，导致悬浮窗里显示成 "参考视频0/5"，但用户实际期望：
  - 第一位永远是页面视频行最左边那个 = **原视频0**
  - "参考图视频"是另一个独立的视频（在 prompt 列里），应该用**专属标签**显示，不参与常规视频编号
- **修法**：
  - `refreshSources` 不再交换 sources 顺序，按 DOM 中视频出现的自然顺序排列
  - 每个 video 元素打上 `__qlbIsRef` 标记，识别它是不是 prompt 列里的参考图视频
  - `formatIdxLabel` 重写：
    - `__qlbIsRef === true` → 显示「参考图视频/N」（N = 普通视频总数 - 1）
    - 否则按"普通视频"序列编号：第 0 个 → 原视频0，第 K 个 → 视频K
    - 分母只算普通视频，参考图视频不占用编号位
- **效果**：质检页 5 个评分视频 + 1 个参考视频时，悬浮窗循环顺序为：
  ```
  原视频0/5 → 视频1/5 → 视频2/5 → 视频3/5 → 视频4/5 → 参考图视频/5 → 原视频0/5 → ...
  ```

### 📋 验证
1. `chrome://extensions/` → 刷新插件
2. 在质检页打开悬浮窗，按 ◀ ▶ 切换：
   - 第一个应显示 **原视频0/N**（页面顶部视频行最左边那个）
   - 中间几个依次 **视频1/N、视频2/N...**
   - 最后那个（来自左侧 Prompt 区的）显示 **参考图视频/N**

---



### 🧹 质检模式重大化简：删紫框 + 删浮层 + 改常驻胶囊条

#### 1. 删除紫色聚焦框
- 之前 `.qlb-qa-focused` 加紫色 outline + 浅紫色背景到题目组本体上，bug 多（DOM 嵌套使紫色蔓延整列）
- 改：键盘聚焦逻辑保留（用于 1/2 快捷键定位当前题），但**完全不再画聚焦框**
- 删除 `HL_FOCUS_CLASS` 常量、`.qlb-qa-focused` CSS、`setFocus` 里的 outline 设置

#### 2. 删除修正分快填浮层
- 之前选"不通过"会弹出一个浮层，要再按数字键才能填值，多一步交互
- 改：完全移除 `showFixPopover / hideFixPopover / applyFix / fixPopoverEl` 相关代码与样式（约 60 行）
- 选"不通过"后改为：**滚动到该题修正分输入框，让胶囊条进入视口**

#### 3. 新增"常驻分数胶囊条"（参考标注模式的维度按钮设计）
- **每个修正分输入框下方注入一个胶囊条**：`[0] [0.25] [0.5] [0.75] [1] [none]`
- 鼠标点击直接填入对应值（绕过 Tea readonly input 用 React-friendly setter）
- 点击后胶囊有绿色高亮闪烁动画 0.4s，明确反馈
- 不需要先选"不通过"也能用 —— 你愿意手动改任何一题的分都可以
- 标注页的逻辑参考：每个维度标题旁的 `[0][0.5][1][none]` 胶囊一直常驻

#### 4. 修复下半部分答题区上下滚轮失效（**关键修复**）
- 上一版的 `wheel-pan` 命中规则是"最近的可滚动祖先正好是 col--18 且只能横滚"。问题：评估区下半部分（题目区）整体被 col--18 包裹，所以**用户在题目区滚轮时**最近的可滚祖先就是 col--18，纵滚被吃掉
- **正确规则**：滚动事件优先给文档自身的纵向滚动；只有当**文档已经滚到顶 / 底**且鼠标精确落在 col--18 横滚轨道上时，才把多余的 deltaY 转横滚
- 实现：新增 `docCanScrollY(deltaY)` 检查 `document.scrollingElement` 还能不能往这个方向滚，能就直接 return 不劫持

#### 5. 帮助弹窗内容更新
- 质检模式快捷键表去掉 `3=唤起浮层` 和 6 行修正分快填快捷键
- 改为简洁的 5 行：通过 / 不通过 / 上下题 / 左右切列 + 1 行 tip 提示"胶囊按钮直接点"

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 质检页验证：
   - **鼠标 / 触摸板上下滚动**应能正常滚整个页面，包括下半部分答题区
   - 横滚条 / Shift+滚轮在视频行 / 题目轨道仍然能横滚
   - 整页**不再有任何紫色框**（除了序号 `#N` chip 和工具栏 chip）
   - 每个修正分输入框下方有 6 个紫色胶囊按钮 `[0][0.25][0.5][0.75][1][none]`，鼠标点击即填入对应值
   - 选"不通过"后，页面自动滚到该题的修正分位置（不再弹浮层）

---



### 🐛 基于用户截图的精准修复（DOM 结构理解修正）

**关键认知**：之前我误解了质检页的 DOM 结构。真实结构是**整列共用一个 `.cr-container-row`**，里面平铺 N 组「`col--16`(维度名)+`col--8`(radio 通过/不通过)+`col--24`(修正分输入)」三联结构。所以：
- `.cr-radio-group.closest('.cr-container-row')` **不是** 单个题目，而是**整列**
- 之前所有依赖 closest('.cr-container-row') 的逻辑都误把"整列"当成"单题"处理 → 序号错乱、整列染色

#### 1. 鼠标上下滚轮失效（**严重**）
- v1.8.1 的 wheel-pan 命中条件过松：只要祖先链上有横滚 `.cr-container-col--18` 就劫持纵滚
- → 实际上整页所有题目都在 col--18 内 → **所有纵向滚动被吞掉**
- 改：用 `findNearestScrollable` 只判断**最近**的可滚动祖先；当且仅当它正好是 `.cr-container-col--18` **且只能横滚不能纵滚**时才转向；其它一律放行

#### 2. 序号从 #9 开始
- 原因同上：`getDimensionTitleEl` 用 `closest('.cr-container-row')` 拿到的是整列 row，每次都返回**第一个题目的维度标题**，导致 9 次循环都覆盖同一个 DOM 节点的 textContent
- 改：用**直接 sibling** 查找 —— `getDimensionTitleEl` 找题目所在 `col--8` 的"上一个 col--16"，每个题目精确对应自己的维度标题。序号现在每列从 #1 重新开始，正确对应 9 道题

#### 3. 修正分输入框定位错误
- 同样问题：旧版 `getFixInputForGroup` 在整列 row 里 querySelector，永远返回第一个输入框
- 改：找题目所在 `col--8` 的"下一个 col--24"，里面才是该题专属的修正分输入

#### 4. 高亮范围太小，看不见修正分
- 用户选"不通过"用快捷键打分时，看不到下方的修正分输入是哪个
- 改：新增 `getGroupUnitParts(group)` 返回该题的「col--16 + col--8 + col--24」三段；高亮和聚焦都同时给这三段加类，用户能看到"维度名 + radio + 修正分输入"完整一组都被高亮
- 滚动目标也从 group 改为 col--24（确保修正分输入框始终可见）

#### 5. 整页紫色覆盖
- 真凶：`.qlb-qa-sticky-prompt` 的 `background: rgba(168, 85, 247, 0.04)` —— v1.8.2 留下来的样式
- 改：去掉所有装饰性背景，sticky 类纯粹作为 hook 不影响视觉

#### 6. Prompt / 参考视频不固定
- 重新分析：Prompt 列其实就在题目轨道横滚 row 的第一个子节点 `.cr-container-col--18`，可以直接对它设 `position: sticky`
- 改：放弃浮动镜像卡片方案，**改为就地 sticky** —— 直接在原 col 上设 inline style:
  - `position: sticky; top: 12px; align-self: flex-start; z-index: 5`
  - 沿祖先链解除 `overflow: hidden` 限制（sticky 失效的常见原因）
  - DOM 重渲染时若 inline style 丢失自动重新应用
- 视觉上 prompt 完全保留在原位置，不再有任何浮窗或紫色装饰，纵向滚动时它会自动钉在视口顶部

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 质检页：
   - 鼠标上下滚轮 / 触摸板上下滑 → **应该能正常上下滚页面**
   - 鼠标在视频行 / 题目轨道横向滚动条**那一条**上滚轮 → 才转横滚
   - 每列序号应从 `#1` 到 `#9`，不再出现 `#9` 起步
   - 选某题"不通过" → 维度名 + radio + 修正分输入 三段同时变红，整列其它题不受影响
   - 按 1/2/3 后聚焦也是三段同时高亮，且修正分输入会进入视口
   - 向下滚动时 Prompt 列自动停留在视口顶部
   - 全页不再有任何整列紫色覆盖
3. 控制台诊断：`QLB.qa()` 应能输出正确的 total / pass / fail / none

### 🆘 如果仍有问题，请提供

```js
// 在质检页 iframe 控制台跑
console.log({
  cols: document.querySelectorAll('.cr-container-col--10').length,
  groups: document.querySelectorAll('.cr-radio-group').length,
  qaGroups: Array.from(document.querySelectorAll('.cr-radio-group')).filter(g => g.querySelector('label[name="通过"]')).length,
  promptCol: document.querySelector('.qlb-qa-sticky-prompt')?.outerHTML?.slice(0, 300),
  promptStyle: document.querySelector('.qlb-qa-sticky-prompt')?.style.position,
  // 第一题的维度标题
  firstSeq: document.querySelector('.qlb-qa-seq')?.textContent,
  // wheel-pan 是否启用
  wheelPan: window.QLBWheelPan?.isEnabled()
});
```

---



### 🐛 6 个体验问题集中修复

#### 1. 悬浮窗 header 按钮大小不匹配
- 之前 `⟲ 复位` 字符明显比其他按钮（◀ ▶ ⛶ ✕）小一档，整体不齐
- 改：所有按钮统一 **24×24 正方形 + flex 居中**，字号 13px；其中 `⟲` `⛶` 这类几何符号字形偏小，单独提到 14px 以视觉对齐
- `✕ 关闭` 按钮 hover 时显示红色背景，更明确"危险操作"
- 倍速选择框高度同步为 24px，与按钮一行对齐

#### 2. 工具栏按钮 hover 缺少 tooltip
- 之前部分按钮（一键全选 0/0.5/1/none、跳到首个未答、撤销）没 `title`，鼠标悬停没提示
- 现在所有按钮都有完整中文 tooltip，描述按钮作用 + 关联快捷键

#### 3. 模式 chip "质" 字被截
- 之前 `.qlb-toolbar__logo` 整体设了 `overflow: hidden + text-overflow: ellipsis`，"质检"/"标注" chip 作为 inline 子节点被一起截断
- 改：把主文字（"⚡ QLabel Booster"）拆到独立的 `.qlb-toolbar__logo-text` 单独应用省略号，chip 外层加 `flex-shrink: 0` 永远完整显示

#### 4. 质检模式整页紫色覆盖 + 蓝色线条框包裹（**严重 bug**）
- 根因：v1.8.0 的 `.qlb-qa-fail` / `.qlb-qa-focused` 用 `closest('.cr-container-row')` 作为高亮目标，但 `.cr-container-row` 在评估页 DOM 里**层层嵌套**，最外层 row 容纳了**整页 6 列题目**！选中一题不通过 → 给最外层 row 加红色 → 整屏变红
- 改：高亮目标改为 `.cr-radio-group` 题目组本体（最小粒度），不再往上找 row
- 同时把红色高亮从 `linear-gradient` 大色块改为 `inset 3px box-shadow + 浅色背景`，视觉更克制

#### 5. 左侧 Prompt + 参考图视频区无法 sticky
- 根因：`position: sticky` 在 flex 横滚容器（`.cr-container-col--18` 是 flexbox 子项）内**完全失效**
- 改：放弃 sticky 方案，改为**克隆浮动镜像卡片**（`#qlb-qa-prompt-pin`）：
  - 自动识别题目轨道里含「Prompt / 参考图」字样的列
  - 把 prompt 文本 + 参考视频克隆到一个 fixed 浮动卡片（左上角，宽 360px）
  - 用 `IntersectionObserver` 监听原列：在视口可见 → 卡片自动隐藏；离开视口 → 卡片自动显示
  - 卡片内嵌的视频可独立播放（默认静音 + 循环）
  - 用户也可以点 ✕ 主动关闭该卡片

#### 6. 质检页悬浮窗视频编号
- 之前所有视频都被命名为"原视频0"，但质检页里**第一位应该是「参考视频」**（不是"原视频"）
- 改：
  - `formatIdxLabel` 根据 `QLBMode.current` 返回 `参考视频0` 或 `原视频0`
  - `refreshSources` 在质检模式下把"参考视频"自动置顶（识别条件：位于含 Prompt 字样的 `cr-container-col--18` 列内的视频）→ 用户在悬浮窗里第一个看到的就是参考视频

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 质检页观察：
   - 工具栏右上角"质检"chip 完整显示，不再被截
   - 选某题"不通过"后，仅该题区域变红，其它题目不受影响
   - 滚动页面到看不到 Prompt 区时，左上角自动浮出"📌 Prompt & 参考视频"卡片
   - 悬浮窗第一个视频显示为"参考视频0/N"
3. 标注页观察：
   - 工具栏 chip 显示"标注"，正常完整
   - 鼠标悬停一键全选 0/0.5/1/none 等按钮 → 显示对应中文提示
   - 悬浮窗 header 按钮均整齐对齐，⟲ 复位不再视觉偏小

---



### 🤝 标注/质检 共享通用能力 + 修复 1.8.0 边界 bug

用户反馈："质检任务的滚动逻辑、悬浮窗这些功能完全可以参考标注任务，因为很多功能是类似的。"
本版重新审视了**哪些功能应当全局共享、哪些必须模式互斥**，做了如下整理：

### 🆕 抽出通用模块 `src/wheel-pan.js`

- 之前「鼠标纵向滚轮 → 横向滚动」只在质检模式生效，本版抽成独立模块，**两种模式都启用**。
- 触发条件保持保守：仅当 `|deltaY| > |deltaX|` 且事件目标祖先链上有真正横向溢出的 `.cr-container-col--18` 时才劫持，避免误吞纵向滚动。
- 偏好开关 `state.prefs.wheelPan`（默认 true）。

### 🐛 修复 `missing.js` 在质检模式下的误报

- 之前 `scanMissingDetailed()` 用"打分题语义"扫描未答，质检页所有题目都会被误判为"未答"（因为它们的 radio name 不是 "0/0.5/1/none"）→ **提交时几乎必然弹拦截条**。
- 现在：`QLBMode.current === 'qa'` 时改用"通过/不通过 任一选中即已答"语义。
- `focusField()` 在质检模式下走 `QLBQA._setFocus()`，紫色聚焦框对齐 QA 行高亮风格。

### 🐛 修复 `navigator.js` 启动时的画面跳动

- v1.8.0 漏改了一处：`navigator.init` 末尾会自动聚焦"首道未答打分题"，质检模式下因为 `getCurrentScore` 永远返回 null，**会把第一个质检题强行聚焦**，画面瞬间往上跳。
- 现在：质检模式下该自动聚焦由 qa.js 自己处理，navigator 不再干预。

### 🐛 修复 `scroll-sync.js` 题目轨道在质检页的边界场景

- 当 `.cr-container-col--10` 在质检页里没有 `.cr-radio-group` 子节点（理论上不会，但站点可能微调结构）时，原过滤会把质检列误判为非题目列。
- 现在过滤条件加 `[name="通过"]` 兜底锚点。

### 📊 共享能力总览（标注 ✅ vs 质检 ✅）

| 功能 | 标注 | 质检 | 实现位置 |
|---|:---:|:---:|---|
| 视频悬浮窗 | ✅ | ✅ | floating-player.js（与模式无关） |
| 画中画 PiP | ✅ | ✅ | 同上 |
| 视频自动循环 + 互斥静音 | ✅ | ✅ | 同上 |
| 视频/题目同步滚动 | ✅ | ✅ | scroll-sync.js |
| 鼠标纵滚转横滚 | ✅ | ✅ | **wheel-pan.js（本版新增）** |
| 工具栏拖拽 / 复位 / 折叠 | ✅ | ✅ | toolbar.js |
| 提交拦截 + 未答定位 | ✅ | ✅ | missing.js（已模式分流） |
| 跨 frame 键盘转发 | ✅ | ✅ | content.js |

### 📊 模式互斥能力（必须分开）

| 功能 | 标注 | 质检 | 说明 |
|---|:---:|:---:|---|
| 1/2/3/4 打分快捷键 | ✅ | – | 标注独有 |
| 1=通过 / 2=不通过 / 3=修正分浮层 | – | ✅ | 质检独有 |
| 列顶 "全选 0/0.5/1/none" 胶囊 | ✅ | – | 标注独有 |
| 列顶 "全部通过 / 不通过" + 三色统计 | – | ✅ | 质检独有 |
| 维度标题旁胶囊 | ✅ | – | 标注独有 |
| 题目序号 #N | – | ✅ | 质检独有 |
| 不通过整行红色高亮 | – | ✅ | 质检独有 |
| 左侧 Prompt sticky | – | ✅ | 质检独有（标注页 Prompt 区结构不同，未启用） |

### 📋 验证

1. `chrome://extensions/` → 刷新插件
2. **标注页**测试：鼠标在视频/题目区滚动 → 应自动横滚（macOS 触摸板用户最受益）
3. **质检页**测试：
   - 提交时（如果有未答）应正确拦截，不再把所有题目都误判
   - 页面加载时不再有"画面突然往上跳"的现象
   - 同步滚动、悬浮窗、PiP、画中画等所有视频相关能力都可用

---



### 🎯 新增「质检模式」（Quality Audit）—— 全新功能区，与标注模式无缝切换

**背景**：之前插件所有逻辑都是为"标注任务"（选 0/0.5/1/none 打分）设计的，但用户在做"质检任务"（选 通过/不通过 + 修正分）时，插件依然把质检页当标注页处理，列顶冒出"全选 0/0.5/1/none"等无意义按钮，键盘 1/2/3/4 也没用。

### 🆕 模式自动识别（`src/mode.js`）

通过**iframe 内 DOM 特征**精准判定：
- 含 `label.tea-form-check[name="通过"]` 或 `[name="不通过"]` → **质检模式（QA）**
- 含 `label.tea-form-check[name="0/0.5/1/none"]` → **标注模式（Label）**
- URL 是 `combinator/iframe?token=...` 时通过 DOM 特征仍可稳定识别（不依赖外层标题，避免跨域获取失败）

工具栏右上角 logo 旁会显示当前模式 chip：蓝色「标注」 / 紫色「质检」。

### 🆕 质检专用模块（`src/qa.js`）

涵盖用户提的 5 个核心需求：

1. **分组标题前加序号**：每个含"是否通过"的题目组前面加 `#1 #2 #3 ...` 紫色序号 chip，鼠标悬停显示「本列第 X 题 / 全局第 Y 题」。
2. **快捷键 1=通过 / 2=不通过 / 3=唤起修正分浮层**；选「不通过」后整行红色背景 + 红色左边框高亮，并**自动弹出修正分快填浮层**。
3. **一键全选**：
   - 工具栏顶部「全部通过」/「全部不通过」 → 整页所有"是否通过"
   - 每列顶部「视频X 全部通过」/「全部不通过」 → 仅本列
   - 列顶实时显示三色统计：<span style="color:#16a34a">通过 N</span> · <span style="color:#dc2626">不通过 N</span> · 未答 N
   - 「撤销」按钮可回退最近一次批量
4. **修正分快填浮层**：
   - 在选「不通过」后自动弹出，或在题目上按 `3` 手动唤起
   - 一键填入 `0 / 0.25 / 0.5 / 0.75 / 1 / none`，告别手打
   - 浮层打开时键盘 `0/1/2/3/4` 对应填值，`N` 填 none，`Esc` 关闭
   - 处理了 Tea Design 的 `readonly` input：用原生 `setter + dispatchEvent` 触发 React onChange，确保表单状态真的更新
5. **鼠标随处可横向滑动**：
   - 不再需要把鼠标挪到滚动条才能横滑
   - 在"视频行 / 题目行"任何位置滚动鼠标滚轮 → 自动转为横向滚动
   - 已有横向意图（触摸板横滑 / `Shift+滚轮`）时不干预，让浏览器原生处理
6. **左侧 Prompt / 参考图视频区 sticky**：
   - 左侧"Prompt + 参考图/视频"列加 `position: sticky; top: 12px`
   - 用户向下滚动看后续题目时，Prompt 与参考图始终钉在屏幕顶部，**不再丢失上下文**
   - 容器内部独立滚动（max-height: calc(100vh - 24px)），prompt 内容多也不阻挡视线

### 🧩 标注/质检互斥逻辑（重要）

之前的隐藏 bug：质检页因为 `.cr-radio-group` 同名，被标注模块误注入"视频X 本列全选 0/0.5/1/none"胶囊条。本次修复：
- `navigator.js`：质检模式下放弃 1/2/3/4 等快捷键，让 qa.js 接管（仅保留 ⌘/Ctrl+Shift+0/P 这种全局键）
- `toolbar.js`：`injectColumnButtons` / `injectDimensionButtons` 在质检模式下直接 return
- `qa.js init` 时主动清理已存在的标注模式残留 UI（`.qlb-col-bar`, `.qlb-dim-bar`）
- `content.js` 新增 `switchMode()`：SPA 切任务（标注↔质检）时自动 teardown + reinit，无需刷新页面

### 🎨 UI 改动

- 工具栏一键全选区在两种模式下分别显示**4 个数字按钮**（标注）或**通过/不通过 2 个按钮**（质检）
- 进度显示：标注模式 `已完成/总数`；质检模式 `通过·不通过/总数` 三色显示
- 帮助弹窗根据当前模式显示对应快捷键表（左栏切换内容，右栏通用悬浮窗/PiP/未答检测）

### 🛠 调试入口

控制台新增：
```js
QLB.qa()          // 质检模式专用诊断（题目数、通过/不通过/未答统计、列数）
QLB.debug()       // 已加 mode 字段，能看出当前是哪个模式
```

### 📋 验证步骤

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 打开质检任务页（如 `square/2/453/57703`），右下角工具栏 logo 旁应显示紫色「质检」chip
3. 每个"是否通过"行前应有 `#1 #2 #3...` 紫色序号
4. 按 `1` → 当前题选「通过」+ 跳下一题；按 `2` → 选「不通过」+ 整行变红 + 自动弹出修正分浮层
5. 浮层里点 `0.5` 或按数字键 `2` → 修正分输入框被填入 `0.5`
6. 列顶点「全部通过」 → 本列所有题快速通过；点工具栏「全部通过」 → 整页快速通过
7. 切换到标注任务页 → 自动 teardown 质检模块，标注模式 UI 恢复，无残留

---



### 🎨 右下角工具栏「视频」区 UI 重排 & 复位联动

**痛点**：
1. 之前点「复位」只拉回悬浮窗，**主工具栏（如果被拖到屏幕其它位置）不会跟着回来**，体验割裂。
2. 视频区两个开关（自动循环 / 同步滚动）各占一行，后面紧跟 4 个按钮（悬浮窗 / 画中画 / 复位 / 重扫）因 `flex-wrap` 在 240px 宽面板里被挤成 **2+2 换行**，视觉很散乱、点击目标大小不一。

### 🆕 改动
- **「复位」一键双复位**：点击工具栏「复位」按钮（或快捷键 <kbd>⌘/Ctrl</kbd>+<kbd>⇧</kbd>+<kbd>0</kbd>）除了把悬浮窗拉回右下角外，**同时把主工具栏也拉回右下角、展开折叠状态**。对应：
  - 新增 `QLBToolbar.resetPos()`：清空 `toolbarX/toolbarY` 偏好，工具栏回到 CSS 默认 `right:20px; bottom:20px`，并强制展开。
  - `QLBPlayer.resetPos()` 末尾调用上面的函数；Toast 文案同步为 "🔄 悬浮窗 & 工具栏已复位到右下角"。
- **视频区布局重做**：
  - 两个开关 **并排一行**（flex `space-between` + 浅色 chip 卡片包裹），视觉成组不再跳。
  - 4 个按钮改为 **2×2 网格**（`display:grid; grid-template-columns:1fr 1fr`），每个按钮等宽等高，再也不会被 flex-wrap 抖到奇怪位置。
  - 每个按钮带 **图标 + 文字**（▶ 悬浮窗 / ⛶ 画中画 / ⟲ 复位 / ↻ 重扫），图标 hover 时放大 12% + 变白，交互反馈更清晰。

### 📋 验证
1. `chrome://extensions/` → 刷新 QLabel Booster
2. 把右下角主工具栏拖到屏幕左上角 → 点工具栏「复位」按钮 → **工具栏应瞬间弹回右下角**，悬浮窗同步复位
3. 视频区观察：两个开关在同一行、4 个按钮 2×2 均匀铺满，视觉整齐

---



### 🎯 同步滚动真正可用（基于实际 DOM 诊断的精准重写）

**感谢用户提供的控制台诊断数据**，终于看清了评估页的真实结构：

```
combinator-content
├─ 🟥 .cr-container-col--18 (overflow-x: scroll)   ← 视频横滚容器
│   └─ .cr-container-row
│       ├─ col--6  原视频
│       └─ col--8 × 6  视频1~6
│
└─ 🟠 .cr-container-col--18 (overflow-x: scroll)   ← 题目横滚容器
    └─ .cr-container-row
        ├─ col--18  左侧 prompt 区
        └─ col--10 × 6  题目列1~6
```

上一版识别失败的原因：
- `findHScroller` 沿视频祖先链往上走，查到 `.txp_videos_container` / `.cr-vsplayer__container` 这类没溢出的中间层就停了，**没走到真正溢出的 `.cr-container-col--18`**
- 把 7 个视频和 7 个题目列都当成"一一对应"，但索引 0 一边是原视频、一边是 prompt 列，根本对不上
- 以为"题目侧没横滚条"（你最初的印象），其实 `.cr-container-col--18` 本身就是 `overflow-x: scroll`（只是 UI 上没显示系统滚动条，设计上藏了）

### 🆕 新实现
- **直接用 class 精准定位两条轨道**：视频轨道 = `.cr-container-col--18:has(video)`，题目轨道 = `.cr-container-col--18:has(.cr-radio-group)`
- **只对 6 个评分视频 ↔ 6 个题目列做 1:1 映射**（跳过原视频和 prompt 列）
- **`centerInTrack()` 用直写 `scrollLeft` 取代 `scrollIntoView`**：避免 scrollIntoView 意外带动外层纵向滚动
- **三向触发**：
  1. 视频轨道 `scroll` → 对齐题目列
  2. 题目轨道 `scroll` → 对齐视频
  3. 方向键 `←→` / Tab 切题 → 聚焦新题目列时把对应视频居中 + 题目列也居中
- **反射保护**：`syncBusy` + 420ms 冷却 + `lastAlignedIdx` 节流，避免循环

### 🧩 架构隔离修复
- 修改 `content.js`，把 `QLB.*` 接口通过 `postMessage` 桥**暴露到页面主世界**，现在用户在 DevTools 默认 context 下直接 `QLB.scrollSync()` 就能用（不再需要手动切 Isolated World）
- 同时 `QLB.scrollSync()` 会自动代理到"含题目的 iframe"

### 📋 验证
1. `chrome://extensions/` → 刷新 QLabel Booster
2. `Cmd+Shift+R` 硬刷新评估页
3. 工具栏「视频」区打开「同步滚动」
4. 拖上方视频行的横滚条 → 下方题目列会自动滚到对应视频的题目
5. 反之，在下方题目区横滑 → 上方视频跟着居中
6. 按方向键 `→` 切下一列题目 → 视频行也会平移把对应视频居中

---

## [1.6.9] - 2026-04-30

### 🐛 同步滚动彻底重写（抛弃 scrollLeft 镜像）

**根因**：之前版本假设"视频行"和"题目行"都各有一个可横滚的 track，用 `scrollLeft` 互相镜像。实际上 qlabel 评估页的设计是：
- 视频行（上方）有**独立**的横向滚动条
- 题目列（下方）**完全没做**横向滚动条（只能靠方向键 / 触摸板横滑切列）
- 两侧**不存在共通的 scrollLeft** 可以互相同步 → 所以以前的实现从根本上就不工作

**新方案：锚点对齐（Index Anchoring）**
- N 个视频 ↔ N 个题目列，天然按顺序一一对应（0↔0, 1↔1, …）
- **不再镜像 scrollLeft**，改为用 `scrollIntoView({inline:'center'})` 把目标元素滚到视口水平居中
- 这样不依赖"两侧都有 scroll 容器"，完美适配你描述的"题目侧没有滚动条"的现实结构

**双向联动**：
- **视频 → 题目**：监听视频行滚动容器的 `scroll` 事件 → 算出视频轨道中心对齐的是第几个视频 → 把对应题目列 `scrollIntoView(inline:'center')`
- **题目 → 视频**：
  - 方向键 `← →` / `Tab` 切列时，`navigator.setFocus` 调用 `QLBScrollSync.syncByFocusedGroup()` → 把对应视频滚到视频行中心
  - 触摸板在题目区横滑：监听 `wheel` 事件（仅横向意图），等浏览器原生滚完两帧后，重新算中心列并对齐视频

**反射循环保护**：`syncBusy` 标志位 + 400ms 冷却窗口，避免"A 触发 B，B 回来又触发 A"无限递归。

### ⚙️ 调试入口（建议你验证时跑一次）
```js
QLB.scrollSync()            // 打印：视频数量 / 题目列数量 / 视频横滚容器 / 当前视频与题目索引是否一致
QLB.scrollSyncHighlight()   // 视频行滚动容器描红框，6 个题目列交替蓝/青绿描边
```
如果 `currentVideoIndex` 和 `currentQuestionIndex` 显示的是同一个数字，说明现在两边是对齐的 ✅。
如果 `videoScrollContainer` 显示 `null` 或 `clientWidth === scrollWidth`，说明视频行的横滚轨道没被识别 —— 请把输出发给我，我再针对 DOM 结构精修。

### 📋 验证步骤
1. `chrome://extensions/` → 刷新 QLabel Booster
2. 刷新评估页
3. 右下角工具栏「视频」区打开「**同步滚动**」开关
4. 拖动视频行下方的横滚条 → 下方题目列应随之水平滚动到对应视频的题目
5. 按方向键 `→` 切到下一列题目 → 上方视频应自动横滚把对应视频居中

---

## [1.6.8] - 2026-04-30

### 🔍 帮助弹窗可读性提升
上一版为了塞下所有快捷键，把字号压得太小，"看着很累"。本版重新放大：

| 位置 | 旧字号 | 新字号 |
|---|---|---|
| 弹窗宽度 | 620px | **720px**（`max-width: min(94vw, 780px)`）|
| 标题 | 15px | **17px** |
| 正文 | 13px | **14.5px** |
| 分类小标题 | 11px + 全大写 | **13px + 中英文不强制大写** |
| 表格右列 | 13px | **13.5px** |
| kbd 按键标记 | 10.5px | **12px** |
| tip 提示段 | 11.5px | **13px** |
| 页脚 | 11px | **12.5px** |

同时间距放宽：
- body `padding`: `4/18/10` → `8/20/14`
- 表格列宽: 第一列 160 → **180px**
- tip 内边距: 6/10 → **10/12**
- 双栏 `gap`: 18 → **24px**
- 小屏退化阈值: 560 → 640px

### 📝 细节
- 分类 header 去掉 `text-transform: uppercase`，中文显示更自然（「悬浮窗 / 画中画」不再被强制大写样式扰动）
- 页脚文字颜色从 `#9ca3af` 加深到 `#6b7280`，作者信息更清晰

---

## [1.6.7] - 2026-04-30

### 🎨 工具栏 UI 细节打磨
- **图标统一规格**：右下角悬浮栏 header 的两个按钮（帮助 / 折叠）统一为 **26×26 正方形**，同字号、同圆角、同 hover 反馈，彻底告别"⌨️ emoji 比 _ 字符大/低一档"的对不齐感。
- **折叠按钮状态化**：
  - 展开时显示 `–`（横线）→ 表达"点击后折叠"
  - 折叠后 CSS 动画加上一竖变成 `+` → 表达"点击后展开"
  - 用纯 CSS `::before / ::after` 绘制，告别依赖字体/emoji 的尺寸漂移
- **帮助按钮图标**：`⌨️` → `?`（纯字符，字号稳定；tooltip 仍保留"帮助（快捷键说明）"）
- **logo 对齐**：从 `align-items: baseline` 改为 `center`，⚡ emoji 与文字垂直居中，不再下坠
- **head-actions 分组**：帮助+折叠按钮包进同一个 flex 容器，间距用 `gap: 4px` 精准控制

### 📝 文案
- 弹窗标题「⌨️ 快捷键帮助」→ 直接叫 **「帮助」**
- 工具栏帮助按钮 `title` 也同步为「帮助（快捷键说明）」

---

## [1.6.6] - 2026-04-30

### 🎨 帮助弹窗布局大改（一屏看全）
- **彻底消除横向滚动条**：
  - `.qlb-modal__body` 显式 `overflow-x: hidden`
  - `.qlb-kbd-table` 改为 `table-layout: fixed` + 右列 `word-break: break-word`，长快捷键名（如 `⌘/Ctrl+Shift+P`）不再撑宽表格
  - `<kbd>` 间距/内边距压缩，允许换行
- **双栏并排布局**：
  - 打分 + 导航 放左栏；悬浮窗/画中画 + 未答检测 放右栏；工作流和批量操作作为底部横贯提示条
  - 配合弹窗宽度从 540 → 620px（`max-width: min(94vw, 680px)`），大屏一屏全可见
  - 小屏（≤ 560px 宽）自动退化为单栏
- **纵向压缩**：表格字号与行高统一下调 0.5~1px，`.qlb-kbd-tip` padding 收紧，13" 笔记本（~800px 高）通常一屏可完整显示，无需滚动
- **页脚响应式**：`flex-wrap: wrap` + 间距变量，避免作者/邮箱在窄屏撑出横向滚动

### 📝 文案瘦身
- 合并重复段落；去掉版本标签（如「v1.6.2+」"v1.6.3"），保持简洁
- 组合快捷键从 `Shift+Tab` 统一为更紧凑的 `⇧Tab` / `⇧`

---

## [1.6.5] - 2026-04-30

### 🐛 紧急修复（体验回归）
- **纵向滚动被吞**：上一版本的 wheel 联动过于激进 —— 在视频/题目区内的**任何** wheel 都被劫持，导致**鼠标纵向滚轮 / 触摸板纵向滑动 → 页面滚不动**，必须手动拖右侧滚动条。
  - 新原则：**"横向意图"才劫持**。只有满足以下条件之一才启用联动，否则一律放行给浏览器原生：
    1. 用户按住 <kbd>Shift</kbd> + 滚轮（明确表达"我要横滚"）
    2. 触摸板横滑（`|deltaX| > |deltaY|`）
  - 同时要求"主响应侧真的有横向溢出"才会劫持；不再拿"页面本身多 1-2px 溢出"作为兜底，避免窄屏误伤。
- **题目横滑不带动视频**：
  - 老版 `scroll` 事件只挂在探测到的 track 节点上，但用户滑动实际发生在其**祖先的滚动容器**或 `window` 上，导致事件根本触发不到。
  - 现改为：同时挂载到 `videoTrack / questionTrack / 各自父链里第一个真正可滚容器 / window（仅在文档级横向溢出时）`，覆盖所有可能的滚动源。
- **默认不开联动**：`syncScroll` 默认值从 `true` 改为 `false`。新用户安装后横向联动默认关闭；如需启用，可在右下角工具栏「视频」区打开「同步滚动」开关。*老用户不会受影响*，因为偏好已存储；若想恢复默认，在控制台执行 `chrome.storage.local.remove('syncScroll')`。

### 🐛 帮助弹窗小屏显示不全
- 给 `.qlb-modal__panel` 加 `max-height: 90vh`；`.qlb-modal__body` 加 `overflow-y: auto` + 自定义细滚动条
- 头部与页脚 `flex-shrink: 0`，保证小屏上**关闭按钮 / 作者 / 反馈邮箱始终可见**
- 快捷键表行高从 `3px` 收紧到 `2px`，同屏能容纳更多条目
- 笔记本 13" 屏（~800px 高）下也能完整浏览所有快捷键

### ⚙️ 调试建议
如果你仍觉得联动异常，打开控制台运行：
```
QLB.scrollSync()            // 打印两条轨道 + 文档级溢出信息
QLB.scrollSyncHighlight()   // 在页面上红/蓝描边标出两条轨道
```
如果 `videoTrack` / `questionTrack` 其中有一个显示 `overflow: 0`，说明该侧没有横向溢出 —— wheel 联动不会作用于这一侧，这是正确行为。

---

## [1.6.4] - 2026-04-29

### 🚀 新增
- **画中画（Picture-in-Picture）支持**：悬浮窗现在可以一键进入浏览器原生 PiP 窗口，**彻底解决"拖到副屏"的需求**。
  - 悬浮窗标题栏新增 <kbd>⛶</kbd> 按钮
  - 右下角工具栏「视频」区新增「**画中画**」按钮
  - 快捷键 <kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
  - PiP 窗口是**操作系统级独立窗口**，不再受浏览器边界限制，可自由缩放、拖到任何显示器
  - 监听 `enterpictureinpicture / leavepictureinpicture` 自动同步按钮状态
  - **切换视频时 PiP 无缝继承**：按 `◀ ▶` 切到下一个视频，PiP 窗口会自动接力播放新视频（不需要重新开 PiP）
  - 关闭悬浮窗 / `hide()` 时自动退出 PiP，避免"幽灵 PiP 窗口"残留
- **Safari 兼容**：旧版 Safari 使用 `webkitSetPresentationMode('picture-in-picture')` API

### 💡 为什么画中画比"拖 DOM 悬浮窗到副屏"更好
悬浮窗本质是注入到页面里的 `<div>`，**只能在浏览器窗口内浮动**，无法跨出操作系统窗口边界。
而 PiP 是浏览器专门为视频提供的独立窗口 API，Chrome / Edge / Firefox / Safari 均支持，开启后即可拖到任意屏幕。

---

## [1.6.3] - 2026-04-29

### 🚀 新增
- **未答识别大幅增强**：以前只识别打分题（`.cr-radio-group`），现在还能识别：
  - 其它 `radio` 组（`.tea-form-check-group` / `role="radiogroup"`）
  - `textarea`、文本输入框（必填且空）
  - `select` / `.tea-select`（必填且未选）
  - 支持多种 checked 状态（`aria-checked="true"`、`tea-form-check--active` 等），解决「系统说必答未填，但插件说已答完」的问题。
- **系统「必答未填写」自动捕获**：点击提交后，若页面出现任何含 *必答/必填/未填/请填写/请选择/未作答/required* 字样的 Toast / Alert / 表单错误：
  - 插件自动重扫并**立即跳转**到首个未答题，同时红框高亮
  - 如果插件仍识别不到（页面结构非常规）→ **降级**扫描页面上的 `.has-error / .tea-form-ctrl--error / [aria-invalid="true"]` 字段并定位
  - 依然无果则滚动到系统提示本身，并 Toast 告诉你"插件识别不到，请按 <kbd>⌘+Shift+M</kbd> 重试"
- **快捷键 <kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>**：手动强制重扫 + 跳到首个未答/报错字段（**救急快捷键**）。
- **控制台诊断 `QLB.whyUnanswered()`**：打印识别差异（全部字段 / 必填字段 / 插件认为的 missing / 页面错误节点 / 系统提示文案），方便定位"为何插件漏判"。

### 🐛 修复
- **「跳到首个未答」误报"已答完"**：当题目含文本输入 / 下拉选择等非打分控件时，以前只看打分 radio 组 → 误判为全部答完。现在会兜底检查所有必填字段。
- `focusFirstUnanswered` 新增降级逻辑：打分题全答完时，若仍有其它必填字段未填，会自动跳过去。

### ⚙️ 调试入口（控制台）
```
QLB.whyUnanswered()       // 详细诊断
QLB.scanMissing()         // 列出插件认为的未答字段（含类型）
QLBMissing.scanErrorFieldsFromDom()  // 页面上所有红框错误字段
```

---

## [1.6.2] - 2026-04-29

### 🚀 新增
- **悬浮窗复位**：一键把悬浮窗拉回右下角并默认尺寸，解决「拖到浏览器外 / 副屏后找不回来」的问题。
  - 悬浮窗 header 新增 `⟲` 按钮
  - 工具栏「视频」区新增「**复位**」按钮
  - 快捷键 <kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd>（即使焦点在输入框也响应）
- **窗口尺寸变化自救**：切换屏幕 / 缩小浏览器后，悬浮窗若超出视口会自动约束回可见区域。

### 🐛 修复
- **滚动联动彻底重做（wheel 引擎）**：
  - 以前只监听 `scroll` 事件 → macOS 触摸板横滑 / 页面级横向溢出完全覆盖不到。
  - 现在：只要滚轮事件发生在视频行或题目行之内（无论横滑还是纵滚），一律劫持并合成为横向滚动量，
    同时应用到视频轨道与题目轨道 —— 所以**鼠标纵向滚轮 = 横向翻页**，触摸板横滑也能联动。
  - 对"视频区不溢出"场景自动降级为 `scrollIntoView(inline:'center')` 居中当前列视频。
  - 支持文档级横向滚动（`<html>` 是滚动源的情况，以前会漏掉）。
- **悬浮窗跨屏拖丢**：拖拽时把悬浮窗严格约束在视口内（原来允许"只剩 40px 可见"，鼠标跨屏后 mouseup 常常丢失 → 窗口永远丢失）。
- 读取偏好时对尺寸也做越界保护（从大屏切到小屏后，上次记录的 `playerW/playerH` 超过新视口也能自动压回来）。

## [1.6.1] - 2026-04-29

### 🐛 修复
- 横向联动滚动在 macOS（触摸板横滑、滚动条默认隐藏）下无效的问题：
  - 轨道探测放宽为"祖先 `overflow-x` 非 `visible` 即可候选"，不再强依赖 `scrollWidth > clientWidth`；
  - 视频区没有横向溢出时，降级为"题目轨道滚动 → 对应列视频 `scrollIntoView` 居中"的单向联动；
  - 新增 `window.QLB.scrollSync()` 调试入口，打印两条轨道的尺寸/overflow 状态，方便定位。

## [1.6.0] - 2026-04-29

### 🚀 新增
- **视频/题目横向联动滚动**：当页面视频较多需要横向滚动时，题目列表会自动同步滚到对应位置，确保"上方看到哪几个视频，下方就显示哪几列题目"。
- 工具栏「视频」区域新增「**同步滚动**」开关（默认开启），随时可关。
- 运行时自动探测两条横向轨道的最近可滚动祖先，兼容页面 DOM 变化。

## [1.5.0] - 2026-04-28

### 🚀 新增
- **提交后自动重扫视频**：点击"提交"后（无论是否有未答题），自动监听 DOM 变化，检测到新一批视频 URL 时自动刷新悬浮窗并切回第 0 个（原视频），无需手动点"重扫"。
- `QLBPlayer.reload()` 对外 API，用于强制重载视频源。

## [1.4.0] - 2026-04-28

### ✨ 改进
- **悬浮窗尺寸调整**：右下角 resizer 把手从 14×14 放大到 22×22，加 `z-index` 浮在 video controls 之上，加纹样 + hover 高亮；拖动中整窗有蓝色描边。
- 尺寸范围放宽：最小 200×140，最大铺满视口。

## [1.3.1] - 2026-04-28

### 🐛 修复
- 悬浮窗视频列表不再包含自身克隆的 `<video>`；按 URL 去重，解决"4 个视频却显示 5 个、视频4/视频5 重复"的问题。

## [1.3.0] - 2026-04-28

### 🐛 修复
- **视频互斥静音 bug**：之前在页面自带播放器切换视频后，回放已被静音的旧视频时声音无法恢复；现在改为"点播放键即视为要听"，自动取消它的静音并独占音源。
- 悬浮窗默认有声（之前默认静音）；autoplay 被拦截时自动降级为静音播放。

## [1.2.2] - 2026-04-28

### ✨ 改进
- 打分后滚动行为：`scrollIntoView` 从 `block: 'center'` 改为 `block: 'nearest'`，保留上一题可见。
- 快捷键帮助弹窗加宽到 540px，避免右侧文本被挤压。

## [1.2.1] - 2026-04-28

### ✨ 改进
- 右下角工具栏去掉 `by godwayxiong熊` 署名，界面更简洁。
- 快捷键帮助弹窗底部新增 **反馈邮箱：825121444@qq.com**（可点击唤起邮件）。
- 帮助弹窗去掉滚动条，一次性铺展所有快捷键说明。

## [1.2.0] - 2026-04-28

### 🚀 新增
- **悬浮窗编号规则**：第一个视频显示为 `原视频0`，其后依次 `视频1` / `视频2` / …，与标注系统打分区 `视频N 本列全选` 完全对齐。
- 编号分母为"模型数量"（`sources.length - 1`），完全动态。

## [1.1.1] - 2026-04-28

### ✨ 改进
- `manifest.json` 描述文案从 `Built with ❤️ by…` 改为 `Built by 实习生godwayxiong熊🐼。`。

## [1.1.0] - 2026-04-28

### 🚀 新增
- **视频互斥静音**：多视频循环时，播放/取消静音其中一个 → 自动静音其他。
- **工具栏可拖动**：按住右下角面板标题栏可自由拖动；位置持久化。

## [1.0.0] - 2026-04-27

### 🚀 首次发布
- 一键批量打分（0 / 0.5 / 1 / none，支持全页 / 单列 / 单维度 3 种粒度）。
- 键盘快捷键：`1/2/3/4` 打分并自动跳下一题，`↑↓←→/Tab/N/Esc` 导航。
- 悬浮循环视频窗（克隆播放 + 倍速切换）+ 页面原生视频强制循环。
- 未答题定位与提交拦截；首个未答题自动聚焦。
- 右下角工具栏 + 列/维度级快捷按钮注入 + 进度显示。
