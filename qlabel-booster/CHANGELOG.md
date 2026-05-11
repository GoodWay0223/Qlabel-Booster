# QLabel Booster 更新日志

遵循 [语义化版本 SemVer](https://semver.org/lang/zh-CN/) 规范：`MAJOR.MINOR.PATCH`

> 📦 [v1.9.7 之前的历史变更见 CHANGELOG-archive.md](./CHANGELOG-archive.md)
> 本文件只保留**最近若干版本**的简明记录，避免文件过长影响 AI 编辑器上下文。

---

## [1.9.66] - 2026-05-11

### 改进
- **悬浮视频窗支持 8 方向缩放**（之前只能拖右下角）：
  - 4 个边（上 / 下 / 左 / 右）：拖动可调节单个方向尺寸
  - 4 个角（左上 / 右上 / 左下 / 右下）：拖动可同时调节两个方向尺寸
  - 每个方向都有对应鼠标光标提示（↕ ↔ ↖↘ ↗↙）
  - 右下角保留斜线视觉指示
  - 拖左 / 上侧时左上角位置同步移动（标准窗口缩放行为）
  - 自动约束：尺寸不小于 200×140，位置不超出视口

---

## [1.9.65] - 2026-05-11

### 改进
- **质检模式"维度打分后自动跳转"开关行为更精细**：
  - 关闭时（默认）：按 `1`（通过）后**焦点仍移到下一题**（方便用快捷键继续打分），但**视口不滚动**（画面不跳，方便对照阅读）
  - 开启时：恢复"焦点+视口"一起跳的完整老行为
- 解耦了"焦点移动"和"视口滚动"两件事，让关闭开关时既能保留连续打分的快捷键体验，又不打扰用户的视觉聚焦节奏

---

## [1.9.64] - 2026-05-11

### 改进
- **改名**：UI 上"类别"统一改为"**维度**"，更准确反映标注页术语
  - 开关文字：`类别打分后自动跳转` → `维度打分后自动跳转`
  - 提示文案 / tooltip 同步更新
- **质检模式接入此开关**（之前仅标注模式）：
  - 默认关闭：质检按 `1`（通过）/ 鼠标点"通过"后**保持当前焦点**
  - 开关开启：恢复"通过后自动跳到下一道未答"行为
  - 按 `2`（不通过）/ 鼠标点"不通过"行为**不受影响**——继续进入 fix 模式（修正分输入），保持核心工作流

### 内部
- 之前发布过的 v1.9.62/63 已被回退；本版本基于 v1.9.61 干净基础重建

---

## [1.9.61] - 2026-05-11

### 修复
- **真正修好质检模式工具栏不出现的问题**（之前 v1.9.59/60 都没修对）：
  - 真因：`hasQuestions()` 用的 `getAllQuestionGroups()` 是**严格"标注题"过滤器**——只认含数字分值（0/0.5/1/none）的题目，会**故意**把质检页"通过/不通过"题排除掉
  - 后果：质检页 `hasQuestions()` 永远返回 false → `fullBoot()` 永不启动 → 工具栏永远不出 → 即使用户手动调 `QLBToolbar.init()` 工具栏也能立刻出来（佐证模块本身没问题）
  - 修复：`hasQuestions()` 改成宽松判断——标注题或质检题（含 `label[name="通过/不通过"]`）任一存在都算有题

### 表现
- 质检页 `qlabel.qq.com/teamspace/.../assignment/...?filterType=5` 工具栏正常出现
- 标注页继续正常工作，没有副作用

---

## [1.9.60] - 2026-05-11

### 修复
- **回退 v1.9.59 的过严守卫，恢复工具栏在子 iframe 的初始化**：
  - v1.9.59 加的"mode 是 unknown 就不 fullBoot"守卫在子 iframe 场景误伤：
    - QLabel 把题目装在 `combinator/iframe?token=...` 子 iframe 里
    - 子 iframe 跨域读不到 top window 的标题文本 → `detectFromTopTitle` fallback 失效 → 返回 unknown
    - 守卫拦下了 fullBoot → 工具栏永远不出
  - 改回更稳的策略：**有题目就装工具栏**，mode 暂时识别不出就按 `label` 兜底，tick 内每秒会重 detect 自动纠正

### 表现
- `qlabel.qq.com/teamspace/.../assignment/...?filterType=5` 等带 combinator iframe 的页面恢复正常
- 工具栏出现 + 快捷键可用 + 提交后红框定位都正常

---

## [1.9.59] - 2026-05-11

### 修复
- **修复"工具栏不显示、模式 unknown"导致整个插件不工作**：
  - 现象：v1.9.58 在某些 QLabel 页面（特别是 `qlabel.qq.com/combinator/iframe?token=...` 这类嵌入式 URL）打开后，工具栏消失，所有功能失效
  - 真因 1：`mode.js` 的检测 selector 过严，要求 `label.tea-form-check[name="通过"]`；QLabel 后端调整 DOM 后某些页面这个 class 已不存在，导致 `detect()` 返回 `unknown`
  - 真因 2：`content.js` 的 `fullBoot()` 拿到 `unknown` 仍然把 `fullBooted` 锁死，导致后续 tick 永远无法重试
  - 修复 1：mode 检测放宽，去掉 `.tea-form-check` class 限定，只用 `[name="通过/不通过/0/0.5/1/none"]` 属性匹配（更稳）
  - 修复 2：fullBoot 在 mode 仍 unknown 时直接返回，下次 tick 再试，直到 DOM 完全渲染

### 表现
- 在 `qlabel.qq.com/combinator/iframe?...` 等以前打不开工具栏的 URL 上正常出工具栏
- 标注 / 质检模式自动识别更稳，不再因为 DOM 渐进渲染错过初始化时机

---

## [1.9.58] - 2026-05-09

### 修复
- **真正修好"打分后未答题红框不消失"**：
  - 真因：用户用鼠标直接点 `0/0.5/1/none` label 时浏览器原生处理，**根本不走插件的 `scoreOne`**，所以 v1.9.56/57 在 scoreOne 里加的清除代码没机会跑
  - 改方案：在 `missing.js` 新增**全局 click 监听**（捕获阶段），命中打分 label 后用 rAF 检查关联题目的 score —— 已答则清掉它及父链上的所有红框 class
  - 标注模式 + 质检模式都覆盖（兼容 `getCurrentScore` 与 `QLBQA.getCurrentPass`）

### 表现
- 系统提示后所有未答题红框亮起 → 用鼠标/键盘任何方式给某题打分 → 那题红框立即消失
- 不打分时，红框仍保持脉冲让你看清还剩哪些没答

---

## [1.9.57] - 2026-05-09

### 修复
- **定位未答题：现在所有未答题都会同时红框标出来**（之前只有第一题强脉冲）：
  - 第一题：红色强脉冲（最醒目，告诉你聚焦在哪）
  - 其余未答题：红色淡脉冲（让你一眼看清还剩哪些没答）
  - **手动给某道题打分 → 那道题红框立刻消失**，方便逐个清场
- 修复 v1.9.56 的遗漏：之前打分只清了"强脉冲"那一类 class，"普通红框"那一类没清，导致全员红框打完分仍残留

---

## [1.9.56] - 2026-05-09

### 修复
- **修复"定位未答题"红色脉冲在打完分后不消失的问题**：
  - 之前点完 `0/0.5/1/none` 给那道题打分后，红色 outline + 红色脉冲背景一直残留
  - 现在打分成功的瞬间立刻清除（标注模式 + 质检模式都修了）
  - 顺带加 6 秒兜底定时器，即使用户没打分、路过看一眼，红色脉冲也会自动淡出

---

## [1.9.55] - 2026-05-09

### 改进
- **标注模式下点提交，若有必答未填，自动定位到第一道未答题**：
  - 之前虽然有 `installSystemToastWatcher` 监听系统提示，但只覆盖了 Tea UI；标注页用的是 Ant Design，没识别到所以不工作。
  - 本版本新增对 `.ant-notification-notice` / `.ant-message-notice` / `.ant-form-item-explain-error` 等 Ant 系列容器的识别。
  - 新增**跨 frame 监听**：插件 content_script 跑在 iframe 里、但 ant-notification 渲染在 top window，现在两边都装监听器（同源时），不会再漏。

### 表现
- 在标注模式点「提交」→ 出现「必答未填写」黄色提示 → 插件自动滚动并红色高亮第一道未答题（带 toast"📍 系统提示必答未填，已定位..."）

---

## [1.9.54] - 2026-05-08

### 改名
- 油猴脚本中文名：`QLabel Booster · 视频打分提效` → **`QLabel Booster · 标注质检提效`**
- 描述同步调整为"标注质检提效工具"，更准确反映双模式定位

> 安装/更新本版本后，油猴管理面板里看到的脚本名会刷新。

---

## [1.9.53] - 2026-05-08

### 🔥 终于找到真因：浏览器原生 label→input 激活机制的副作用

**用户深度诊断揭示**：v1.9.51/52 的 onPageClick 守卫已经把所有 trusted click 完美挡掉，但用户仍报告"跳转"。装上深度探针后日志显示：
- ❌ 没有任何 `setFocus` / `moveFocus` 被调用
- ❌ 没有 DOM 节点重建
- ❌ 没有脚本主动 `scrollTo`
- ✅ 但 `window.scrollY` 在每次点维度胶囊后逐步累积下移（1 → 250 → 382 → ... → 3290）

**真因**：批量打分时 `label.click()` × N 次，浏览器原生的 label→input 激活机制会：
1. 把对应 input 设为 `document.activeElement`
2. 自动 `scrollIntoView` 让该 input 进入视口

每次维度打分激活该维度最后一题的 input → 视口被推到那里。多次累积 → 视口被推到最后一题位置 → 视觉上"焦点跳了"，但其实焦点框压根没动。

**修复**（`scorer.js`）：

1. **`scoreOne` 内**：每次 `label.click()` 后立刻把 `activeElement` 拉回原元素 (`focus({preventScroll: true})`)，让浏览器看到 activeElement 没变化就不触发自动滚动
2. **`scoreMany` 兜底**：批量开始前保存 `scrollX/Y`，rAF 后如果视口偏移 > 5px 强制无动画拉回原位（覆盖某些浏览器 click 处理过程中短暂的异步滚动）

副作用：零。批量打分前后视口位置严格一致。键盘单题打分 `scoreOne` 也加了 activeElement 恢复，但视口本来就不会大幅偏移（单 input 自动滚动通常已经在视口内），不影响体验。

---

## [1.9.52] - 2026-05-08

### 🔍 诊断版：定位"开关关了仍跳"的真实路径

v1.9.51 日志显示 `onPageClick` 已经把所有 14 个批量 trusted click 都成功 bypass 了，但用户仍报告焦点跳。这意味着"跳"不是从 onPageClick 走的，而是从别的路径。

本版本加诊断日志，定位真实调用源：

- `navigator.moveFocus` 入口打印调用栈（前 5 层）
- `navigator.setFocus` 入口打印调用栈
- `toolbar.js` 维度胶囊 handler 内打印 `state.prefs.advanceAfterDimension` 实际值 + 走的分支

用法：
```javascript
window.__QLB_VERBOSE__ = true
```
然后再点维度胶囊触发问题，把控制台所有 `[QLB]` 开头的日志发回。

---

## [1.9.51] - 2026-05-08

### 🐛 彻底修复 "类别打分跳转开关关闭后仍偶尔跳"

**用户反馈**：v1.9.50 加了批量 flag 守卫后仍有概率自动跳。

**深挖 + 三道防线修复**：

#### 防线 1：onPageClick 函数最早处直接 bypass（v1.9.51 主修复）

之前 v1.9.50 把 `__QLB_BATCH_SCORING__` 的检查放在 `if (isScoreClick)` 内部，逻辑分散；现在直接放到 `onPageClick` 函数最开始，**批量打分期间整个函数体 bypass**（包括 setFocus / 同步聚焦逻辑），干净彻底。

#### 防线 2：时间戳兜底（覆盖批量结束瞬间）

新增 `__QLB_LAST_BATCH_AT__` 时间戳，scoreMany 内每次 `scoreOne` 后都更新它。
onPageClick 进入时若发现"距最近一次 batch click < 50ms"也 bypass —— 防御浏览器异步派发 trusted click 的情况。

#### 防线 3：setTimeout 内部再次校验

v1.9.46 的 80ms 延迟前进逻辑，进入 timer 时再次检查 flag + 时间戳，防御"setTimeout 队列里 timer 触发时 batch 又开始"的极端时序。

#### 防线 4：scoreMany flag 释放间隔加长

`requestAnimationFrame×2 + setTimeout(120ms)` → `requestAnimationFrame×2 + setTimeout(250ms)` —— 确保 v1.9.46 的 80ms timer 完成时 flag 仍在。

### 调试

打开 `window.__QLB_VERBOSE__ = true` 可以在 Console 看到每次 bypass 的原因日志。

---

## [1.9.50] - 2026-05-08

### 🐛 修复："类别打分跳转"开关关闭后仍偶尔自动跳

**用户反馈**：v1.9.49 把"类别打分后自动跳转"开关默认关掉后，**仍有概率偶尔触发自动跳**。

**根因**：v1.9.46 给鼠标点单题胶囊加了"自动前进"逻辑，过滤靠两道守卫：
1. `e.isTrusted === false` 拦截脚本合成 LABEL click ✓
2. `target.tagName === 'INPUT'` 拦截浏览器自动派发的 INPUT click ✓

但 `scoreDimension` / `scoreColumn` 调 `label.click()` 时，浏览器除了派发原生 INPUT click，
**某些 Chromium 版本/状态下还会派发一个原生 LABEL click**（`isTrusted=true` 且 `target=LABEL`）—— 完美绕过两层守卫，命中 v1.9.46 的 `isScoreClick = true` → 自动前进，无视用户开关。

**修复**：批量打分期间用全局 flag `__QLB_BATCH_SCORING__` mute 掉自动前进。

- `scorer.js#scoreMany` 进入时 `flag++`；`finally + 2 帧 + 120ms` 后 `flag--`（确保所有合成 click 冒泡完）
- `navigator.js#onPageClick` 中 `isScoreClick` 自动前进逻辑加 `&& !__QLB_BATCH_SCORING__` 短路

副作用：完全没有。键盘 1/2/3/4、鼠标点单题胶囊都不会经过 `scoreMany`，行为不变。

---

## [1.9.49] - 2026-05-08

### "类别打分后自动跳转"开关：默认关闭 + 文案精简

- 文案：「小类别打分后自动跳下一未答」→「类别打分后自动跳转」
- 默认值：`true` → `false`
- 判定方式从 `!== false` 改为 `=== true`（兼容默认 false）

---

## [1.9.48] - 2026-05-08

### 维度胶囊打分自动跳转 → 改为可开关（默认开启）

**用户反馈**：v1.9.47 完全取消了维度胶囊的自动跳转，但实际偏好因任务/工作流而异 —— 改成可开关更合理。

**改动**：
- 新偏好 `advanceAfterDimension`（默认 `true`，恢复 v1.9.46 的自动跳转行为）
- 工具栏"进度"区底部新增开关：**「小类别打分后自动跳下一未答」**
  - 仅标注模式显示（`qlb-mode-only-label`，质检模式没有维度胶囊）
  - 开关状态持久化到 chrome.storage / GM_setValue（油猴版自动跨标签同步）
  - 切换时 toast 即时反馈

**代码位置**：`state.js#DEFAULTS` + `toolbar.js#injectDimensionButtons`（读 prefs）+ `toolbar.js#buildToolbar`（UI + 事件绑定）

---

## [1.9.47] - 2026-05-08

### 维度（小类别）胶囊打分后不再自动跳转

**用户反馈**：小类别批量打分后立刻把焦点跳走，破坏了当前位置；想保留焦点自己继续确认/微调。

**改动**（`toolbar.js#injectDimensionButtons`）：取消"打完维度跳到下一未答题"的逻辑。点维度胶囊现在只做两件事：批量打分 + 更新进度；焦点不动。

**保留**：
- 整列胶囊打完仍跳下一未答题（语义是"这一列我都搞定了，去下一列继续"）
- 键盘 1/2/3/4 单题打分仍跳下一未答题
- 鼠标点单题胶囊仍跳下一未答题（v1.9.46）

### 当前行为速查

| 入口 | 自动跳到下一未答 |
|---|---|
| 键盘 `1/2/3/4` | ✅ |
| 鼠标点单题胶囊 | ✅ |
| 整列胶囊批量 | ✅ |
| **维度胶囊批量** | ❌（v1.9.47 取消） |
| 工具栏全选 | ❌ |

---

## [1.9.46] - 2026-05-08

### ✨ 鼠标点分值胶囊打分 → 也自动跳到下一道未答题

**用户反馈**：键盘 1/2/3/4 打分会自动跳下一未答题，但鼠标点 0/0.5/1/none 胶囊打完仍停在原题，需要手动按 ↓ 才能继续。

**改动**（`navigator.js#onPageClick`）：

- 检测点击 target 是否落在 `label.tea-form-check[name="0|0.5|1|none"]` 上
- 是 → 80ms 后比对 `getCurrentScore` 前后值：
  - 真发生了变化 → `moveFocus(1, { skipAnswered: true })`
  - 没变化（点的是已选项）→ 不跳
- 否（点空白/题目文字）→ 仅同步聚焦，不前进（保留之前 v1.9.35 的行为）

**安全性**：v1.9.35 修复的"49 题级联跳焦"bug 不会复发：
- 脚本合成 `label.click()` 派发的 LABEL click `isTrusted=false` → 被第一个守卫挡掉
- 浏览器自动派发的 INPUT click → 被 `tagName === 'INPUT'` 挡掉
- 只有用户真实鼠标点 LABEL（isTrusted=true 且 tagName ≠ INPUT）会进入新逻辑

### 现在所有"打分自动前进"路径完全统一

| 触发方式 | 自动跳到下一未答题？ |
|---|---|
| 键盘 `1/2/3/4` 打分 | ✅ |
| **鼠标点分值胶囊** | ✅ (本次新增) |
| 维度胶囊批量打分 | ✅ |
| 整列胶囊批量打分 | ✅ |
| 工具栏"全部 0/0.5/1/none" | 不前进（一键全选语义） |

---

## [1.9.45] - 2026-05-08

### 撤销图标 ↶ → ↩

`↶` 字形小且不够直观，换成 `↩`（U+21A9 leftwards arrow with hook）—— 这是软件 UI 里最经典的"撤销/返回"语义符号，字形清晰且几乎所有字体都有。

---

## [1.9.44] - 2026-05-08

### "定位未答题 / 撤销"按钮升级为图标版

- **定位未答题 → 🔍 放大镜**：emoji 高识别度，一眼认出"搜索/定位"语义
- **撤销 → ↶ 反向弧形箭头**：与"重扫" `↻` 是一对，视觉一致性强
- 两个按钮一并升级为 `qlb-btn--icon` + `qlb-grid--2` 布局，与下方"回顶/回底/悬浮窗/画中画/复位/重扫"网格视觉对齐
- emoji 图标加 `qlb-btn__ico--emoji` 子类：font-size 略小（12 vs 14）+ `font-variant-emoji: text` 强制单色（Chrome 117+ 支持，老浏览器回落彩色仍可读）

---

## [1.9.43] - 2026-05-08

### ✨ 三件优化

#### 1. 悬浮窗音源 → 同步给页面对应视频加框

**之前**（v1.9.41）：悬浮窗里的视频成为音源时，框消失（脚本主动跳过悬浮窗内 video）。
**现在**：悬浮窗 video 成为音源时，**反查页面里 src 相同的那个视频**，给它的列容器加框 → 用户能看到"悬浮窗在循环播放第几个视频"。
- 实现（`floating-player.js#findPageVideoBySrc`）：用 `currentSrc/src` 比对页面所有非悬浮窗 video
- 悬浮窗切上一个/下一个视频 → 自动重新映射高亮
- 悬浮窗关闭：`hide()` 时主动 `videoEl.muted=true` + 刷新高亮 → 框立即消失

#### 2. 聚焦框加呼吸效果（节制，不耗资源）

`@keyframes qlb-audio-breath` 让 `.qlb-audio-active` 的 box-shadow 透明度在 2.6s 周期内缓慢变化。
- **只动 box-shadow，不动 transform/scale** → GPU 复合层即可，不触发 layout/paint 整页
- 节奏舒缓（2.6s），不抢戏不影响打分
- 自动尊重系统 `prefers-reduced-motion: reduce`：用户开了"减少动画"→ 自动降级为静态发光

#### 3. 换回顶/回底图标 ⇈⇊ → ⤒⤓

`⇈/⇊` 双箭头堆叠视觉重；改用 Unicode `⤒` (U+2912 "to top") / `⤓` (U+2913 "to bottom") —— **专门表示"到顶/到底"的语义符号**，简洁贴切。

---

## [1.9.42] - 2026-05-08

### 🐛 修复：维度胶囊 / 整列胶囊打完后，跳到的位置有时是已答题

**问题**：标注模式下点小类别（维度）胶囊或整列打分胶囊后，焦点会机械地跳到"下一维度第一题" / "下一列第一题"，**不管那题是不是已答**。

如果系统初始化时把那题预设为 `none`，或用户之前已经改过它，就会停在已答题上 —— 与 v1.9.38 起"按数字键自动跳过已答题"的逻辑不一致。

**修复**（`toolbar.js`）：

两处胶囊点击 handler 改为：
1. 先把焦点设到刚打完那一组的**最后一题**（`scroll: false`，不滚动）
2. 再调 `QLBNavigator.moveFocus(1, { skipAnswered: true })`

这样：
- 维度胶囊 → 跳到"下一道未答题"（可能在同维度后段、下一维度，或更后面）
- 整列胶囊 → 跳到"下一道未答题"（可能跨列）
- 全部已答 → 自动 toast "🎉 全部题目已答完"（继承自 navigator）

**统一性**：现在所有"打分自动前进"路径都用同一个 `moveFocus(1, { skipAnswered })` 入口：
- 键盘 1/2/3/4 单题打分 ✓
- 维度胶囊打分 ✓ (本次修复)
- 整列胶囊打分 ✓ (本次修复)
- 工具栏"全部 0/0.5/1/none"按钮 → 一键全选，无前进语义（无需修改）

---

## [1.9.41] - 2026-05-08

### ✨ 当前音频视频高亮：淡蓝色聚焦框

**背景**：QLB 的"互斥发声"机制保证同一时刻只有一个视频在出声（用户点谁、谁就成为音源）。但用户视觉上**不容易发现**到底哪个视频在出声，特别是 6 个评分视频排成一排时容易混淆。

**改动**：
- `floating-player.js#refreshAudioActiveHighlight()`：每当音频聚焦切换时，给当前 `muted=false` 的视频容器（`.cr-container-col--8` / `--6`）加 `.qlb-audio-active` class
- 触发点（覆盖所有路径）：
  - `muteOthers()` —— 用户点播放/取消静音/悬浮窗打开后必经
  - `onVideoVolumeChange(v)` —— 用户手动静音了当前音源 → 清空所有高亮
  - `forceLoopAllNativeVideos()` —— 发现新视频时（首次进入/切任务）刷新一次
- 悬浮窗内部的 `<video>` 不加框（它本身已经在角落显眼位置）
- 标注 + 质检模式都生效（机制和模式无关）

**视觉**（`styles.css`）：
- 淡蓝 `#60a5fa` 3px outline + 柔和 12px 外辉光
- 用 `outline` 而非 `border`，避免相邻列突然位移
- 提权到 `[class].qlb-audio-active` 防止站点 padding/border 覆盖

---

## [1.9.40] - 2026-05-08

### ✨ 工具栏新增"一键回顶/回底" + 修复"复位"图标视觉

**新功能**（标注 + 质检通用）：
- 工具栏"进度"区下方新增两个按钮：
  - **⇈ 回顶**：一键滚到页面最顶部
  - **⇊ 回底**：一键滚到页面最底部
- 实现细节（`toolbar.js#scrollAllToEdge`）：
  - 同时滚 `window` / `document.scrollingElement`（外层 iframe body）
  - 递归扫描所有 `overflow-y: auto/scroll/overlay` 且 `scrollHeight > clientHeight` 的内层容器，一并滚到位
  - 跳过插件自己的 UI（toolbar/floating-player/toast/modal/bar）
  - 用 `behavior: 'smooth'` 平滑滚动

**视觉修复**：
- 标注模式下"复位"按钮的图标从 `⟲` (U+27F2) 改为 `↺` (U+21BA)
- 原因：`⟲` 字形偏小，和同行的 `▶ ⛶ ↻` 视觉大小不一致，显得格格不入
- `↺` 与同行其他图标字形大小一致

---

## [1.9.39] - 2026-05-08

### 跨列跳转：滚动锚点切到 `.qlb-col-bar`，让"整列打分胶囊"也露出

**用户反馈**：整列打分后跳到下一列首题、或手动打完一列最后一题跳到下一列首题，希望**再多滚一点**让列顶整列打分胶囊（"视频X 本列全选：0 0.5 1 none"那一行）也露出来。

**改动**（`navigator.js`）：

新增 `pickScrollAnchor(el)`：
- 如果 `el` 是某列的**第一题**，把滚动锚点切到该列的 `.qlb-col-bar`
- 否则锚点就是 `el`

`scrollIntoSafeView(el)` 内部所有定位/微调改用 `anchor`，让 `anchor.top ≈ safeTop`。
- 列内中间题：anchor === el，体验同 v1.9.38
- 列首题（跨列跳转）：anchor = `.qlb-col-bar` → 列顶胶囊 + 类别标题 + 题目都进入视口

短路判定也用 anchor：anchor.top 没被遮挡 + el.bottom 在视口内 → 跳过滚动。

---

## [1.9.38] - 2026-05-08

### ✨ 打分自动前进 → 跳到下一道**未答**题（跳过已答题，含 `none`）

**用户反馈**：
1. 跳转停留位置希望**再上移一点**，把题目类别名称 + 类别打分胶囊也露出来
2. 打分自动跳下一题，应该**跳过已经打过分的题**（包括页面初始化时已被预设为 `none` 的题），只聚焦真正还没作答的题

**改动**（`navigator.js`）：

1. **`moveFocus(delta, opts)` 新增 `skipAnswered` 选项**
   - `skipAnswered=true` 时，按 delta 方向逐题查找 `getCurrentScore(g) === null` 的题
   - 同方向找不到 → 退化为**全局**找首个未答题（防止"前面也还有未答但被跳过去了"）
   - 全部已答 → 退化为普通 +delta 移动 + toast "🎉 全部题目已答完"
   - `getCurrentScore` 返回 `'0' | '0.5' | '1' | 'none'` 之一，所以 `none` 也算已答 ✓
2. **键位映射调整**：
   - `1/2/3/4/`/~` 打分自动前进 → `moveFocus(1, { skipAnswered: true })`
   - `↓` / `Tab` → `moveFocus(1, { skipAnswered: true })`（跳到下一未答）
   - `↑` / `Shift+Tab` → `moveFocus(-1)` 普通后退（保留回看已答题的能力）
3. **`EXTRA_TOP_HEADROOM` 从 44 调到 64**：滚到位时同时露出"类别标题 + 类别打分胶囊（.qlb-dim-bar） + 题目本身"

### 行为对比

| 场景 | 旧版 | v1.9.38 |
|---|---|---|
| 题目 5 已是 `none`（系统预设）<br>用户在题 4 按 `1` 打分 | 焦点跳到题 5（已答），用户得再按一次 ↓ | 焦点直接跳到题 6（首个未答） |
| 用户想回看刚打过的题 | 按 ↑ 退一题 | 同（行为不变） |
| 全部题答完，按数字键 | 焦点继续向下走（绕回） | 焦点继续走 + 提示"🎉 全部题目已答完" |

---

## [1.9.37] - 2026-05-08

### 微调：跳转停留位置再上移 ~32px，让"题目类别标题"也露出

v1.9.36 修好了"聚焦题被视频行遮挡"，但用户反馈：题目刚好顶到视频行下沿，**题目上方那一行类别标题**（如"视频2-镜头剪辑/镜头切换与剪辑逻辑/镜头间叙事连续性"）还在视频行底下看不到，希望再多滚一点。

**改动**（`navigator.js`）：

- 新增 `EXTRA_TOP_HEADROOM = 44`（之前是写死的 +12）：
  - 12px 视频行底边到类别标题的呼吸空间
  - ~24px 类别标题文字高度
  - 8px 标题到第一题胶囊的空气
- `getSafeTopMargin() = getTopOcclusion() + EXTRA_TOP_HEADROOM`
- "已在安全区就跳过"短路阈值改为 `topOcclusion + 8`（即只要题目 top 没被视频行遮就不再动），避免因 safeTop 变大而"连续打分每题都把视口往上拉一截"的抖动

效果：滚到位时，**类别标题 + 打分胶囊都能完整露出**。

---

## [1.9.36] - 2026-05-08

### 🔥 修复"聚焦题被顶部视频行遮挡"的根因

**用户反馈**：标注模式下，单题打分聚焦框 OK，但**小类别整列打分**和**定位未答题**跳转后，聚焦的题目被顶部"视频1/2/3"那行挡住，看不见红框/蓝框定位的是哪一题。

**控制台诊断真相**（用户协助跑诊断脚本）：

```
2) 顶部 sticky/fixed 候选元素：
  cls="cr-container-col cr-container-col--24"
  position: fixed   top: 12   bottom: 485.4   height: 473.4   z-index: 88
3) 视频底边最大 bottom: 383
```

页面顶部"原视频/打分视频"行容器是 **`position: fixed; top: 12px; height: 473px`**，浏览器原生 `scrollIntoView` **不会感知 fixed 元素**（只懂 sticky）。所以无论我们用 `block:'start'` 还是 `block:'nearest'`，目标都会落到 fixed 视频行底下。

**之前的代码假设**：
- `SAFE_TOP_MARGIN = 12`（写死，不知道真实遮挡有 ~485px）
- `setFocus` 默认走 `block:'nearest'`，仅"定位未答题"才走 `safeView` —— 所以小类别打分自动跳下一题时根本没用到 safeView，撞遮挡更严重
- `qa.js` 兜底逻辑只检测 `.cr-container-col--18`（rect.bottom=442），错过了真正 fixed 的 `.cr-container-col--24`（rect.bottom=485）

**修复**（`navigator.js` + `qa.js`）：

1. **新增 `getTopOcclusion()` 动态测量顶部遮挡**：
   - 优先查 `.cr-container-col--24`
   - 通用扫描所有 `position: fixed | sticky` 顶部宽元素（top<200px、宽度>视口40%、可见），取最大 rect.bottom
   - 80ms 缓存，避免一次跳转重复算
   - 跳过插件自己的 toolbar/floating-player/toast/modal/bar
2. **`SAFE_TOP_MARGIN` 改为动态** = `topOcclusion + 12`（即让目标落在 fixed 视频行**下方** 12px）
3. **`setFocus` 默认走 `scrollIntoSafeView`**，不再区分"小类别打分用 nearest / 定位未答用 safeView" —— 之前两套逻辑是 bug 根源
4. **`scrollIntoSafeView` 内部自带"已在安全视图就跳过"短路**，连续打分自动跳下一题时不会抖动视口
5. **`qa.js` 本地兜底也用通用扫描**，不再只盯 `.cr-container-col--18`
6. 暴露 `QLBNavigator.getTopOcclusion / getSafeTopMargin / isFullyInSafeView`，未来其它模块可共享

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

---

## [1.9.35] - 2026-05-07

### 🔥 一次性解决"打分 / 批量胶囊后焦点乱跳"的根因

**控制台诊断揭示真相**（感谢用户协助跑 `MutationObserver` 追踪）：

用户点列顶胶囊 → `scoreColumn` 对该列 49 题循环 `label.click()` → Console 里看到：

```
[CLICK isTrusted=true]  target=BUTTON.qlb-pill--s05    ← 用户的真点击
[CLICK isTrusted=false] target=LABEL.tea-form-check 0.5 idx=51  ← scoreColumn 合成 label click（被 v1.9.25 isTrusted 守卫挡掉 ✓）
[CLICK isTrusted=true]  target=INPUT.tea-radio 0.5     idx=51  ← ❗ 浏览器自动派发的 input click，isTrusted=true！
[CLICK isTrusted=false] target=LABEL ... 0.5 idx=52
[CLICK isTrusted=true]  target=INPUT ... 0.5 idx=52
... (重复 49 次)
```

**根因**：HTML5 标准行为 —— `label.click()` 会让浏览器**自动激活关联的 input**，并派发一次 `input click` 事件，这个事件 `isTrusted === true`（浏览器原生派发，不是脚本合成）。

我们 v1.9.25 加的 `if (!e.isTrusted) return;` 守卫只挡了 `label` 层的合成事件，**没挡住浏览器自动派发的 input 层事件**。每个 input click 都命中 `onPageClick` → `setFocus(group)` + 60ms 后 `moveFocus(1)` → 49 次级联 → 焦点彻底错乱。

同时 v1.9.22 的"鼠标点分值自动跳下一题"行为带来的麻烦也多于收益（用户多次抱怨跳题），一并移除。

**修复**（`navigator.js` + `qa.js`#onPageClick）：

1. **忽略 `INPUT` target**：`if (t.tagName === 'INPUT') return;` —— 这一行就彻底挡住 label→input 的连锁
2. **移除"点分值自动跳下一题"逻辑**：v1.9.22 引入的 `setTimeout(() => moveFocus(1), 60)` 整段删除。现在鼠标点 radio 就是"单纯同步聚焦"，不前进；用户想跳下一题就按数字键/Tab/↓
3. **质检模式 `qa.js#onPageClick` 同步加 INPUT 过滤**，防止未来可能的批量合成点击问题

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 标注模式，先按 `1/2/3` 打到中间某题（焦点停在 idx=N）
2. **点列顶"本列全选 0.5" 胶囊**：整列染色，焦点跳到 **v1.9.32 指定的"下一列第一题"**（而不是 N+49 级联乱跳）
3. **点某题"0.5"圆圈**：该题变绿 + 蓝框停在**这题不动**（不再自动跳下一题）
4. **按数字键 1/2/3 连续打分**：每打一题精确跳下一题，不再跳过中间题
5. **点维度胶囊**：该维度染色，焦点跳到"下一维度第一题"

---

## [1.9.34] - 2026-05-07

### 🐛 标注/质检模式打分后跳过中间题目

**现象**：标注模式下按 `1/2/3` 打分，打完一题**应跳下一题**，但偶发会**跳过 1~N 道题**，直接跳到更下方的题目（比如从"多镜头视频生成符合 prompt"直接跳到"场景设定具有时序一致性"，漏掉中间 1~2 道）。

**根因**：
- 插件在 `state.focusedGroup` 里存的是"当前聚焦题的 DOM 引用"
- qlabel 站点是 React 应用，`label.click()` 打分后**会触发 React 重渲染**，部分场景下**重建了 `.cr-radio-group` DOM 节点**（旧节点被移除，新节点插入同位置）
- 旧 `state.focusedGroup` 引用失效（已脱离 DOM）
- `moveFocus(1)` 里 `list.indexOf(state.focusedGroup) === -1` → `idx` 被重置为 0 → `idx + 1 = 1` → 聚焦**列表第 2 项**（而不是正确的"下一题"）
- 结果就是从"当前题"一下跳到"列表里的第 2 题"（通常越过了若干题）

**修复**：
- `navigator.js#setFocus` 给聚焦题打一个 `data-qlb-focus-ref="1"` 属性（跨 React 重渲染保留）
- 新增 `resolveActiveFocus()`：
  1. 如果 `state.focusedGroup` 还在 DOM 里 → 直接返回
  2. 否则通过 `[data-qlb-focus-ref="1"]` 查回真正活着的节点
  3. 再兜底用 `getBoundingClientRect()` 空间位置找线性列表里最近的题
- `moveFocus` 和键盘打分分支（`onKeyDown` 的 scoreMap 分支）都先调 `resolveActiveFocus()`
- `clearFocus` 同步清理 data 属性，避免残留
- `qa.js` 质检模式的 `setFocus` / `moveFocus` / `clearFocusHighlights` 同款改造

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 标注模式连续打分多题（从"多镜头视频生成符合 prompt"开始按 `1/2/3`）
2. **期望**：蓝框**严格按 DOM 顺序**逐题推进，不跳过任何一题
3. 多个维度交界处（如"多镜头生成" → "镜头内容" → 下一个维度"时序一致性"）同样不跳
4. 质检模式相同体验
5. 用"定位未答题 / N 键"也不会因旧引用漂移而跳错位置

---

## [1.9.33] - 2026-05-07

### 🎯 聚焦 + 定位两处彻底修复（基于用户控制台实测数据）

用户在 iframe 控制台跑诊断脚本后暴露两个真相，本版针对性修复：

**1. 定位未答题位置永远偏下（根本原因找到了）**

诊断发现 qlabel 打分页 iframe 内部 **有两层滚动容器叠加**：
- `document.scrollingElement`（iframe body）—— 外层滚（scrollTop=949）
- `.cr-container-col--18`（视频行 + 答题列的共同父）—— `overflow-y: scroll`，内层滚

之前所有版本的算法只处理其中一层（v1.9.29 处理外层 window，v1.9.31 找到内层但忽略了外层），**永远有一层没对齐**。

**修复**（`navigator.js#scrollIntoSafeView`）：
- **彻底放弃手算**，改用**浏览器原生 `el.scrollIntoView({ block: 'start' })`**。浏览器会自动递归处理所有滚动祖先。
- 再用 `requestAnimationFrame` 等一帧后测 rect.top，按差值做 `scrollBy` 微调到 `SAFE_TOP_MARGIN = 12`。
- 最后一层兜底：如果 window.scrollBy 没让 rect 动（说明内层容器在滚），就找 `findScrollableAncestor` 再对内层容器 `scrollBy` 补偿。

**2. 数字键打分后蓝色聚焦框看不见**

诊断输出：`currentFocusedEl: cr-radio-group qlb-focused`，class **确实加上了**，但用户看不到视觉效果 —— 说明 CSS outline 被站点样式覆盖。

**修复**（`styles.css`）：
- **提升选择器权重**：`.qlb-focused[class]` / `[class].qlb-focused`（属性选择器使权重从 `(0,0,1,0)` 升到 `(0,0,2,0)`），压过站点任何 `div.xxx.yyy` 级的规则。
- **多重视觉冗余**：同时加 `outline` + `box-shadow`（内外两圈）+ `background-color`，任一个被站点盖住，另外两个仍有效果。`.qlb-missing-highlight` 和 `.qlb-missing-target` 同样处理。

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 打开打分页，按 `?` 确认工具栏工作
2. 按 `1/2/3` 打分 → **蓝框**应明显可见（outline + 内外 box-shadow 双层）
3. 点「🎯 定位未答题」→ 目标题应**紧贴视口上方 12px**
4. 滚到页面最下方，再点定位 → 目标仍能被拉到视口上方
5. 目标题是**红色强脉冲**（第一眼就看到是哪题）
6. 进度过程中任意点胶囊批量打分，焦点跳转正常（v1.9.32 已修）

---

## [1.9.32] - 2026-05-07

### 🎯 标注模式胶囊批量打分后自动聚焦"下一个目标"

**背景**：v1.9.25 把"合成点击不触发 onPageClick"修好后，胶囊批量打分的副作用是**焦点完全不动**。用户反馈希望：

- 点**列顶"本列全选"胶囊** → 一整列搞定 → 焦点自动跳到**下一列第一题**
- 点**维度标题旁的胶囊** → 当前维度搞定 → 焦点自动跳到**下一个维度的第一题**（跨列也走）

**实现**：在 `toolbar.js` 的两个胶囊 `click` handler 里追加主动聚焦：

1. **列顶胶囊**（`injectColumnButtons`）：
   - 从 `getColumns()` 里找当前列索引 `curIdx`
   - 下一列 = `cols[curIdx + 1]` → 取 `getQuestionsInColumn(nextCol)[0]` 作为目标
   - 调 `QLBNavigator.setFocus(target, { safeView: true })` 聚焦 + 滚动（用 v1.9.31 的新滚动算法，目标紧贴视口上方 12px）
   - 已是最后一列 → toast "已到最后一列"

2. **维度胶囊**（`injectDimensionButtons`）：
   - 新增 `collectAllDimensionsLinear()`：按列从左到右 + 列内从上到下把所有维度串成线性列表
   - 按 `titleEl` 匹配当前维度索引
   - 下一维度 = `allDims[dimIdx + 1]` → 取 `nextDim.groups[0]`
   - 同样用 `setFocus(..., { safeView: true })`
   - 已是最后一个维度 → toast "已到最后一个维度"

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 标注打分页，先打到中间某题
2. 点**视频 2 的"本列全选 1"** → 整列变 1 分 → 蓝框应跳到**视频 3 第一题**
3. 在视频 N（最后一列）点"本列全选 0" → 整列打分 → toast 提示"已到最后一列"，焦点不变
4. 点某维度旁的"本列全选 0.5" → 该维度全部 0.5 → 蓝框跳到**下一个维度的第一题**（可能在同列下方，也可能在下一列）
5. 最后一个维度的胶囊 → toast "已到最后一个维度"
6. 连续点多个胶囊，焦点每次都准确跳到下一个目标

---

## [1.9.31] - 2026-05-07

### 📍 "定位未答题"的滚动策略重写

**根因复盘**：

之前 v1.9.24 ~ v1.9.29 的所有 `scrollIntoSafeView` 版本都基于**错误假设**——以为视频行 `.cr-container-col--18` 是 sticky，要"把目标题放在视频行底部下方"。实际 qlabel 打分页的结构是：**视频行和答题列在同一个纵向滚动容器里**，视频是普通流内元素。把目标题对齐到"视频行底部"等于把它推到屏幕中下方，反而会被视频画面覆盖。

**新策略**：

不再探测"顶部遮挡区"，直接把**目标顶到滚动容器视口的最上方 + 12px margin**，让目标成为视觉焦点。视频行如果在目标上方会自然滚出视口，两者不会再打架。

```
SAFE_TOP_MARGIN     = 12   // 目标元素距容器视口顶部留 12px
SAFE_IDLE_TOLERANCE = 40   // 目标已在容差范围内（顶部 ±40px）→ 不滚，避免抖动
```

保留了 v1.9.29 的**真实滚动容器探测**（`findScrollableAncestor`），确保在 iframe 中间 `overflow:auto` 容器里也能正确滚动。

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 全新打开打分页，点工具栏「🎯 定位未答题」
2. **期望**：目标题的顶部出现在**视口正上方约 12px 处**（不再被视频画面覆盖）
3. 视频行如果原本在目标上方，会自然滚出视口上方（完全看不见）
4. 按 `N` 继续跳下一题 → 同样效果
5. 若目标已经在视口很靠上的位置（容差 40px 内）→ 不滚动，避免抖动

---

## [1.9.30] - 2026-05-07

### 🐒 油猴版两处修复（插件版无变化）

**1. GM 菜单项点击后 alert 弹 2 次**

- **现象**：点 Tampermonkey 图标 → 菜单里的"⌨️ 快捷键 / ♻️ 重置 / ℹ️ 关于"任意一项 → alert 弹 2 次（第二次确认后又弹一次）
- **根因**：qlabel 打分页是"外层 page + iframe"结构，油猴脚本默认在两个 frame 都注入。之前的构建脚本在**每个 frame 都注册了一次** `GM_registerMenuCommand`。Tampermonkey UI 上把同名菜单合并为一条，但点击会**同时触发两个 frame 的 handler** → 弹两次。
- **修复**：`build-userscript.sh` 把 `GM_registerMenuCommand` 调用包在 `if (window === window.top)` 里，只在顶层 frame 注册一次。

**2. 油猴管理面板里脚本图标显示为灰色默认图**

- **现象**：Tampermonkey 管理面板的 QLabel Booster 卡片**没有图标**，显示默认灰色图案。
- **根因**：header 里 `@icon https://qlabel.qq.com/favicon.ico`，qlabel 企业域名通常需要登录态 / CORS 限制 → Tampermonkey 加载失败 → 显示默认图标。
- **修复**：
  - `header.user.js` 中 `@icon` 改为占位符 `__ICON_DATA_URL__`
  - `build-userscript.sh` 构建时读取 `qlabel-booster/icons/icon48.png`，生成 base64 `data:image/png;base64,...` URL 替换占位符
  - 图标完全内嵌，零网络请求，任何环境下都能显示

### 📋 验证

1. 装新版 `dist/qlabel-booster.user.js`（v1.9.30）
2. **图标**：Tampermonkey 管理面板 → QLabel Booster 卡片左侧应显示**彩色熊猫图标**（与插件版一致）
3. **菜单**：点 Tampermonkey 浏览器图标 → 选"⌨️ 快捷键..." → alert 只弹 **1 次**
4. 其它两个菜单项（重置 / 关于）同样只弹 1 次

### 📝 注：Tampermonkey 图标右上角的红色数字

红色数字 `2` 表示当前页面有 2 个 frame 在运行脚本（外层 page + iframe），这是**正常现象**不是错误。"此脚本还未被执行" 这条文字提示是 Tampermonkey 对外层 top frame 的判定（因为工具栏 UI 其实是在 iframe 里起作用），不影响实际功能。

---

## [1.9.29] - 2026-05-07

### 📍 "定位未答题" 两处根治

**Bug 1：定位位置仍然偏下**

- **根因**：原 `scrollIntoSafeView` 只用 `window.scrollBy`，但 qlabel 打分页的真实滚动容器**不是 iframe window**，而是中间某个 `.cr-*` 的 `overflow:auto` 祖先。对 window 滚动无效，导致目标在视觉上根本没被拉到期望位置。
- **修复**：
  - 新增 `findScrollableAncestor(el)`：沿祖先链向上找真实滚动容器（`overflow-y: auto/scroll/overlay` 且 `scrollHeight > clientHeight`）
  - 根据 scroller 类型走不同滚动 API：
    - Window/scrollingElement → `window.scrollBy`（保留原路径）
    - 中间容器 → 直接 `scroller.scrollTo({ top: newTop })`，必定生效
  - 顶部保留缓冲由 `topReserved + 4 + 6 = +10px` 降到 **`topReserved + 2px`**，让目标**紧贴顶部占用区下沿**
  - 已在安全区的判定放宽到 80px 误差（原只要在视口内就不滚，导致"偏下的第一题"不会被提到更上面）

**Bug 2：目标高亮仍是蓝框 + 浅蓝背景，用户希望的是红框 + 淡红背景**

- **根因**：v1.9.27 的 `.qlb-focused.qlb-missing-highlight` 复合选择器依赖目标同时具备两个 class，实际部分路径下目标只有蓝色 `qlb-focused`，红色规则没命中。
- **修复**：
  - 引入独立 class **`.qlb-missing-target`**（红色 3px 实线外框 + `rgba(255,77,79,0.14)` 淡红背景 + 强脉冲 1s + 加 box-shadow 红光）。**不依赖复合选择器**，无论页面站点样式如何都能稳定显示。
  - `navigator.js#setFocus` 新增 `markAsMissingTarget` 选项，启用时**改为加 `.qlb-missing-target`**（不再加蓝色 `.qlb-focused`）
  - `qa.js#setFocus` 同步支持该选项（给 `getGroupUnitParts` 返回的 3 个 col 都加红色）
  - `missing.js#focusField` 两条路径都传 `markAsMissingTarget:true`
  - `clearFocus` / `clearFocusHighlights` 同步清理 `.qlb-missing-target`
  - 非打分字段也用 `qlb-missing-target`，3 秒后自动消失（与打分题视觉统一）

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 全新打开标注打分页，点工具栏「🎯 定位未答题」
2. **期望**：
   - 目标题**紧贴顶部视频行下沿**（不需要再上滑找）
   - 目标题显示**醒目红色外框 + 淡红色背景 + 强脉冲动画**（不再是蓝色）
3. 继续按 `N` → 红色强脉冲跳到下一道未答题；旧目标恢复普通红色脉冲（`qlb-missing-highlight`）
4. 打分后 `moveFocus` 自动跳下一题 → 新题用蓝色 `qlb-focused`（日常键盘导航体验不变）
5. 质检模式相同操作 → 目标题 radio + 修正分 + 维度名整条红色强脉冲

---

## [1.9.28] - 2026-05-07

### 📚 帮助面板新增两条文档外链

在工具栏「?」帮助面板底部 tip 区新增一行 **📚 文档**，包含两条常用资料链接（按钮"点击访问"蓝色下划线，点击在新标签页打开）：

- **评估标注标准细则**：https://doc.weixin.qq.com/sheet/e3_AaAAXgafAHACNkxs6voK0RfmB7u01
- **质检问题共识**：https://doc.weixin.qq.com/sheet/e3_AaQAUQYCAM4CNuwOqle4dRzewl6YX

实现：
- `toolbar.js` 在 `qlb-help-tips` 区追加新 tip 行，两个链接均使用 `target="_blank" rel="noopener noreferrer"` 安全外链
- `styles.css` 新增 `.qlb-doc-link` 样式（`#2563eb` 蓝色 + 下划线 + hover 加深 + 保持 visited 状态一致）
- 不区分模式，标注/质检任一界面都能访问这两条文档

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 打开任一打分页，按 `?` 打开帮助面板
2. 面板底部 tip 区应看到 **📚 文档：评估标注标准细则 点击访问 · 质检问题共识 点击访问**
3. 分别点击两个"点击访问" → 新标签页打开对应腾讯文档
4. 关闭弹窗（再按 `?` / 点 ✕ / 点遮罩）→ 弹窗正常消失

---

## [1.9.27] - 2026-05-07

### 🎯 "定位未答题"：改名 + 目标题用醒目红色脉冲标记

基于用户反馈反转 v1.9.26 的视觉方向：用户在这个场景下就希望**显著的红色高亮**能一眼定位到未答题，蓝色聚焦框反而不如红色直观。

**1. 文案统一改名：跳转到未答题 → 定位未答题**

- 工具栏按钮（`toolbar.js`）
- 键盘帮助表（工具栏 `?` 面板 + popup 弹窗）
- 未答定位触发后的 Toast 提示："已定位到第 1 / N 道未答题"
- 语义更贴合实际效果：**原地标红定位**而非"跳页"

**2. 目标未答题视觉：红色脉冲胜出**

- **回滚 v1.9.26** 在 `missing.js#focusField` 里给目标"剥离红色高亮"的逻辑。现在目标题保留 `qlb-missing-highlight`，底层 `setFocus` 照旧维护 `state.focusedGroup`（键盘打分无影响）。
- `styles.css` 反转优先级规则：当某元素**同时有** `.qlb-focused`（蓝）和 `.qlb-missing-highlight`（红）时，用更高权重的复合选择器让**红色胜出**，并加粗 outline（2px → 3px）、提升脉冲振幅（6px → 10px）、加快节奏（1.4s → 1s），让"定位目标"视觉上最醒目。
- 删除 v1.9.26 新增的 `.qlb-field-focus`（蓝色非打分字段聚焦），非打分必填字段恢复使用红色脉冲 `qlb-missing-highlight`，和 radio 组风格统一。
- 效果：
  - 点「定位未答题」 → 目标题 **强红色脉冲**（最醒目），其它未答题 **常规红色脉冲**（次级提示）
  - 再按 `N` → 强红色切到新目标上，旧目标恢复普通红色脉冲
  - 键盘 `1/2/3` 打完一题 → 进入正常 Tab/打分流程，蓝色聚焦框用于日常导航

### 📋 验证

1. 打开 QLabel 打分页 → 工具栏的按钮应显示 **"定位未答题"**
2. 点击该按钮 → 目标题出现 **加粗加快节奏的红色脉冲**，非常显眼
3. 按 `N` → 强红色脉冲切到下一道未答题上
4. 进行正常的 `1/2/3` 打分 → 节奏不变，打到某题时该题的聚焦框是蓝色
5. 工具栏 `?` 面板 / 浏览器插件 popup 的快捷键表格里，对应行均显示 **"定位未答题"**
6. 质检模式相同操作同样有红色强化脉冲

---

## [1.9.26] - 2026-05-07

### 📍 "跳转到未答题"再优化两处（位置偏下 + 蓝色聚焦框被红色脉冲盖住）

延续 v1.9.24 的改进，进一步贴合用户"我能立刻看到是哪一题"的直觉。

**1. 定位目标题偏下**

- **现象**：点击「跳转到未答题」后，目标题滚到了屏幕偏中下方，而不是我们期望的"视频行正下方 / 视口靠上"的位置，用户仍需眼睛向下搜索一下。
- **根因**：`scrollIntoSafeView` 原算法里 `safeTop = topReserved + 8`，再加 `targetTop = safeTop + 12` → 相对于"顶部遮挡底"偏移了 **20px**，偏移过大；再加上老算法**只识别"含 video 的 col--18"**，漏掉了标注页另一种顶部 sticky 场景（题目行/自定义 fixed header 等），有时探测失败反而走到更离谱的位置。
- **修复**：
  - 扩展顶部遮挡探测 → 不再只看视频行，而是**遍历所有候选 sticky 容器**（视频 col--18 / 质检 Prompt sticky / `position:fixed` 元素），取所有"跨过视口顶端"的元素 bottom 的**最大值**作为真正的遮挡底。
  - 缓冲总偏移由 **20px → 10px**（`safeTop = topReserved + 4`，`targetTop = safeTop + 6`），让目标题更贴近遮挡底部下沿，视觉上接近"被拉到视口正常偏上的位置"。
  - `qa.js#scrollIntoSafeView` 改为优先调用 `QLBNavigator.scrollIntoSafeView`，两份实现统一到一处。

**2. 蓝色聚焦框被红色未答脉冲盖住**

- **现象**：执行"跳转到未答题"后，目标题身上同时有 `qlb-missing-highlight`（红色脉冲外框）和 `qlb-focused`（蓝色聚焦外框），因 CSS cascade 规则，**红色 outline 覆盖了蓝色**，用户看到的"当前锁定题"仍是红色脉冲，缺乏"就是这一题"的明确感。
- **修复**：
  - `missing.js#focusField` 在 setFocus/子模块接管前，**主动从目标元素身上移除 `qlb-missing-highlight`**（保留其它未答题的红框，形成"当前蓝色/其余红色待处理"的清晰层级）。
  - `styles.css` 增加双保险：`.qlb-focused.qlb-missing-highlight`（即便两个类残留在同一元素）用更高权重选择器强制蓝色 outline 胜出，并加短脉冲动画突出焦点。
  - 非打分字段（文本 / textarea / 下拉）不再给自身加老的红色 `qlb-missing-highlight` 作"临时定位框"，改为新的 `qlb-field-focus`（蓝色脉冲 2 次后自动消失），与打分题的聚焦视觉保持一致。

### 📋 验证

1. 打开标注打分页，滚到页面最底部
2. 点工具栏「🎯 跳转到未答题」
3. **期望**：
   - 目标题出现在顶部遮挡区**正下方偏上**位置（不是屏幕中下方）
   - 目标题外框是**醒目蓝色**（旁边其它未答题仍是红色脉冲）
4. 按 `N` 继续跳下一道未答题 → 蓝色会"跳"到新的目标上，旧目标恢复红色脉冲
5. 质检模式相同操作，体验一致
6. 打非打分的必填字段场景（例如某些备注文本）时，目标字段也有蓝色脉冲（之前是红色）

---

## [1.9.25] - 2026-05-07

### 🐛 两处修复

**1. 鼠标点击批量打分胶囊后焦点被"莫名跳到下一题"的误触**

- **现象**（标注模式）：页面上还没打完所有分，点击列顶 / 维度旁的胶囊批量打分按钮（例如"本列全选 1"）后，插件蓝框聚焦会自动跳到下一题或下一行，即便用户并没有打完前面的题。
- **根因**：v1.9.22 引入了 `onPageClick`（手动点选分值 label 后自动跳下一题），但没区分"真实鼠标点击"与"脚本合成点击"。胶囊批量打分内部通过 `label.click()` 派发多次合成点击去勾选每道题的 radio，这些合成事件冒泡到 document 同样命中 `onPageClick`，最后一道被合成点击的题就被当成"用户手动点选"，触发 `moveFocus(1)`。
- **修复**：`navigator.js#onPageClick` 与 `qa.js#onPageClick` 都加上 `if (!e.isTrusted) return;`，只响应**真实鼠标点击**（`isTrusted === true`），脚本合成的 `label.click()` 不会再被误判。
- **影响面**：
  - 胶囊列批量打分 / 列顶通过不通过批量 / 工具栏"全部一键 0/0.5/1/none"类操作，点击后焦点保持在用户原位置不动（符合期望：用户想在批量打分后继续补漏，而不是被插件抢走焦点）。
  - 手动用鼠标点击单题 radio 依旧会聚焦该题并前进一步（v1.9.22 的预期行为不受影响）。

**2. 标注模式下悬浮窗参考图视频被误编号为"视频N/N"**

- **现象**：标注模式悬浮窗循环到参考图视频时，序号被显示成例如"视频5/5"，而正确应为"参考图视频0/5"（与质检模式体验一致）。
- **根因**：`floating-player.js#refreshSources` 里 `__qlbIsRef` 的识别逻辑被 `if (QLBMode === 'qa')` 包住，标注模式下所有视频被无差别标记为 `__qlbIsRef = false`，参考图视频也就被当作普通评分视频参与编号。
- **修复**：把参考图识别逻辑从 QA 专属改为**两模式通用**。识别锚点仍是"祖先链上的 `.cr-container-col--6` 容器文字以 Prompt/参考图/参考视频/提示词 开头且不以『原视频』开头"。若标注页结构里没有 `col--6` 或没有参考图关键字，所有 video 的 `__qlbIsRef` 保持 false，与旧行为等价（不破坏无参考图的场景）。
- `formatIdxLabel` 同步把 `isQa && hasRef` 简化为 `hasRef`，让带参考图的标注页也使用"分母 = 普通视频总数"的正确算法。

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

**修复 1**：
1. 打开标注打分页
2. 先按 `1/2/3` 打到中间某题（焦点停在该题）
3. 点击**右上方没打分的列**的"本列全选 1"胶囊按钮
4. **期望**：整列染色，**焦点仍停在原位置**（之前会自动跳下一题）
5. 点击单个 radio label（手动点选） → 依旧会聚焦该题并跳下一题（v1.9.22 体验保留）
6. 质检模式重复类似操作："视频X 全部通过"点击后焦点也不乱跳

**修复 2**：
1. 标注模式下打开悬浮窗，按右箭头循环切换视频
2. 切到参考图视频时 → **期望显示**"参考图视频0/N"，而非"视频X/N"
3. 若页面没有参考图视频（只有原视频 + 评分视频） → 编号与旧版本完全一致，无任何变化

---

## [1.9.24] - 2026-05-07

### 📍 "跳转到未答题"后题目被视频行挡住看不见的修复

**现象**：标注模式下点击工具栏「跳转到未答题」或按 `N`（质检模式也可能），插件蓝框已经聚焦到对应题目，但页面视觉上还看不到那题 —— 需要再手动滚动一下才能看到。

**根因**：`navigator.js#setFocus` 使用的是 `scrollIntoView({block:'nearest'})`，`'nearest'` 语义是"元素整体落在视口里就不滚，否则滚到刚好可见"。但 qlabel 页面顶部被 sticky 的视频行占着大半，元素虽然技术上在视口里但**视觉上被盖住**了，所以看不见。质检模式早就做了 `scrollIntoSafeView`（把元素放到视频行下方安全区），体验就好；标注模式没做。

**修复**：

1. **`navigator.js`**：抽取 `scrollIntoSafeView(el)`（与 qa.js 同款），动态探测顶部视频行底部，把目标元素滚到"安全区"内可见，避开视频行遮挡。
2. `setFocus(group, opts)` 新增 `safeView` 选项；`focusFirstUnanswered()` 默认带 `safeView:true`（跨屏跳转场景）；常规连续打分的 `moveFocus` / `Tab` / `↑↓` 依旧用 `'nearest'`，避免抖动。
3. **`missing.js#focusField`**：跳未答题时，标注模式调用 `setFocus(group, { safeView:true })`；非打分字段（textarea / 下拉等）也改用 `scrollIntoSafeView` 替代老的 `block:'center'`。
4. **质检模式**：`qa.js#_setFocus` 原本就使用 `scrollIntoSafeView`，本次无需改。
5. `scrollIntoSafeView` 作为工具函数通过 `QLBNavigator.scrollIntoSafeView` 对外暴露，供 `missing.js` 复用，避免两份实现漂移。

**油猴版同步**：重新构建 `dist/qlabel-booster.user.js`。

### 📋 验证

1. 打开 QLabel 打分页，滚到页面最底部
2. 点击工具栏「🎯 跳转到未答题」按钮
3. **期望**：题目容器立刻出现在视频行**下方**可见区域，蓝框清晰可见，无需再手动滚
4. 按 `N` 继续跳下一道未答题，同样效果
5. 质检模式同样操作，体验一致
6. 常规连续打分（`1/2/3` + `Tab` + `↑↓`）节奏不变，不会出现额外滚动抖动

---

## [1.9.23] - 2026-05-07

### 🔄 同步滚动默认开启（含老用户一次性迁移）

- **默认值翻转**：`state.js#DEFAULTS.syncScroll` 由 `false` 改为 `true`。
  - **新用户**：装完即默认启用同步滚动（键盘聚焦题目 ↔ 视频行 ↔ 题目横滚轨道三联动）。
  - 功能本身很多人不知道存在，默认打开能让新上手的人直接感知到"聚焦一题，对应视频自动滚到中间"的体验。
- **老用户迁移**：`loadPrefs()` 里加一次性迁移——
  - 首次检测到 `__qlb_migration_v1923_syncScroll` 标记未落盘时，把本地已存的 `syncScroll=false` 翻回 `true`，并写入迁移标记。
  - 此后用户想关就关（工具栏里点开关即可），不会被反复覆盖。
  - 迁移对浏览器插件版与油猴版都生效（油猴版的 GM 存储也走同样逻辑）。
- **油猴版同步**：`qlabel-booster-userscript/dist/qlabel-booster.user.js` 重建。

### 📋 验证

**新用户视角**：
1. 全新安装（或 `chrome://extensions/` 删扩展 → 重装）
2. 打开 QLabel 打分页 → 右下角工具栏「视频」区 → 「同步滚动」开关 → 应为**绿色/已开启**
3. 按 `↓` / 数字键打分 → 左侧视频列 / 题目行应跟随聚焦自动滚动

**老用户视角（之前把同步滚动关过的人）**：
1. 更新插件到 1.9.23 → 刷新页面
2. 「同步滚动」开关应变为**已开启**（一次性迁移生效）
3. 再手动关掉 → 刷新 → 保持关闭状态（迁移不会再次触发）

---

## [1.9.22] - 2026-05-07

### 🧭 标注模式：触摸板"左滑返回上一页"彻底屏蔽 + 点击打分后自动跳下一题

本版两处交互一致性修复，标注模式的体验向质检模式对齐。

**1. 左滑极限时浏览器返回上一页的误触（标注/质检通用）**

- **现象**：标注模式下用触摸板横向滑动到最左极限时，偶尔会误触发浏览器"返回上一级页面"手势。质检模式相对不易复现，是因为质检页左侧有 Prompt sticky 列一直托住，横滚轨道不容易到真正的"最左极限"。
- **根因**：`wheel-pan.js` 原先只在"鼠标位置正好位于横滚轨道（`.cr-container-col--18`）"时才 `preventDefault`。但：① 轨道已滚到最左端时，浏览器仍会识别 `deltaX < 0` 为 history-nav 手势；② 用户手指离开轨道后继续横滑（例如滑到页面边缘空白区），就没人拦下默认行为。
- **修复**：
  - `wheel-pan.js` 改为：只要**横向意图明显**（`|deltaX| > |deltaY|`）且事件目标不在插件自身 UI 里 → **无条件 `preventDefault`** 屏蔽浏览器 history-nav，命中轨道时额外执行横滚。
  - `styles.css` 补一层 `html, body { overscroll-behavior-x: contain }` 作为 CSS 兜底，确保在 passive wheel / 第三方 iframe 等边角场景浏览器也不会返回。

**2. 鼠标点选分值后，按快捷键应从"下一题"继续**

- **现象**：标注模式下手动用鼠标点选了题 A 的某个分值，接着按数字键 → 插件仍然把快捷键作用在题 A 上（不是下一题）。期望与质检一致：点完 A 就应该跳到 B。
- **修复**：`navigator.js#onPageClick` 细化行为——
  - 用户点击的是**分值 label**（`0/0.5/1/none`）→ 视为"这一题已用鼠标完成"，把聚焦**前进一步**到下一题。
  - 用户点击的是分组内的其他空白区域（标题、容器等）→ 仅把聚焦同步到该题（原 v1.9.20 行为，方便"先定位再键盘打分"）。
- 质检模式 `qa.js#onPageClick` 同步升级：点击"通过"后也 `moveFocus(1)` 跳下一题（之前只同步聚焦），"不通过"仍按原逻辑进 fix 模式聚焦修正分输入。

**3. 油猴版同步**

`qlabel-booster-userscript/` 重新构建 → `dist/qlabel-booster.user.js` 含上述两处修复。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. **触摸板** / 鼠标横向滑到标注页最左端 → 不再触发"返回上一页"
3. 用鼠标点击第 2 题的某个分值（如 `0.5`）→ 题 2 染色后**蓝框应立刻跳到第 3 题**
4. 再按 `1` → 应给第 3 题打 0 分，然后跳到第 4 题
5. 质检页点击"通过" → 蓝框应立刻跳到下一题；点击"不通过" → 仍进入修正分输入框（无变化）
6. 油猴版：`dist/qlabel-booster.user.js` 覆盖安装后同样表现

---

## [1.9.21] - 2026-05-07

### 🐛 修复 PiP 报错：`InvalidStateError: Metadata for the video element are not loaded yet`

**现象**：悬浮窗刚切换视频/刚打开时按画中画按钮，控制台报 `InvalidStateError: Failed to execute 'requestPictureInPicture' on 'HTMLVideoElement': Metadata for the video element are not loaded yet`，然后画中画进不去。

**根因**：`renderCurrent()` 创建新 video 后立即设置了 `src`，但视频 metadata 是异步加载的（`readyState < 1`）。此时用户快速按 PiP 按钮，Chrome 会因 video 还没 `HAVE_METADATA` 而拒绝进入 PiP。

**修复**：`enterPip()` 里增加 `waitMetadata()` 等待：
- 如果 `readyState >= 1` → 立刻进入 PiP（常态，不引入延迟）
- 如果未就绪 → 监听 `loadedmetadata` / `loadeddata` 事件，最多等 1.5s
- `InvalidStateError` 专门 toast 提示"视频还在加载中，稍等 1 秒再试"，而不是通用"请先点击一次视频"

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 切换新一题 → 悬浮窗自动 reload 新视频 → 立刻按画中画按钮 → 应能正常进入 PiP（不再报 InvalidStateError）

---

## [1.9.20] - 2026-05-07

### 🎯 标注模式：鼠标点击打分后，聚焦同步到该题

**现象**：标注模式下用鼠标点击某题打分（比如想手改前面某个题的分值），然后再按数字键继续打分时，插件的蓝框聚焦**仍然停留在之前按数字键打到的位置** → 按 `1/2/3` 会错误地给那个旧位置打分。

**修复**：在 `navigator.js#init()` 里加 `onPageClick`，用户鼠标点击任意一题的打分 label（`.cr-radio-group` 内的 `label.tea-form-check`）时，把插件的 `state.focusedGroup` 同步到该题：
- 后续按数字键 `1/2/3/~/\`/4` → 从这题继续打分
- `moveFocus(1)` 跳下一题也从这题开始
- 只在标注模式生效（质检模式 qa.js 里早就有同样机制）
- 跳过插件自身 UI 点击（工具栏 / 胶囊条 / 帮助弹窗等）
- 点击时不触发滚动（`scroll: false`），避免打断用户视线

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 标注页按 `1/2/3` 连续打几题 → 蓝框应到达第 N 题
3. 用鼠标点击**第 2 题**的某个分值 → 蓝框应立刻跳回第 2 题
4. 再按 `3` → 应给第 2 题打 1 分，然后跳到第 3 题，而不是跳回之前按键到的位置继续

---

## [1.9.19] - 2026-05-06

### 📝 文案澄清：进度数字的 tooltip 说明"已答含默认 none"

不是 bug —— 部分任务页默认就有大量题目预选了 `none`（不适用），所以一进入界面就显示 "100/196 已答" 是**正确的进度计数**（因为 none 也是合法答案）。

为避免日后再被误解：
- 工具栏进度数字 hover 显示 `已答 X / 共 N（含默认已选 none 的题）`
- `debugProgress()` 输出文案精简，强调"含默认已选 none 的题"

v1.9.17 的"加严过滤（只取含 0/0.5/1/none 的 group）"和 v1.9.18 的"CSP/page-bridge 修复"都保留，这两个改动是对的。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 鼠标悬停工具栏进度数字 → tooltip 显示"含默认已选 none 的题"

---

## [1.9.18] - 2026-05-06

### 🛡️ 修复 CSP 错误 + 让 `QLB.debugProgress()` 在 top frame 能用

#### 现象
控制台报：
```
Executing inline script violates the following Content Security Policy directive
'script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' ...'.
exposeQLBToPageWorld @ content.js:351
```
然后 `window.QLB.debugProgress()` → `Cannot read properties of undefined`

#### 根因
之前 `content.js` 用 `document.createElement('script') + script.textContent = ...` 注入桥接代码到页面主世界，让 DevTools 默认 console 能直接调用 `QLB.xxx()`。但站点 CSP 不允许 `unsafe-inline`，**inline 脚本被全部阻断** → page world 没有 `window.QLB` → 调用方法报 undefined。

#### 修复

**1. 改用 manifest world: "MAIN" content script**

新增 `src/page-bridge.js`，在 `manifest.json` 中以 `"world": "MAIN"` 声明：
```json
{
  "matches": [...],
  "js": ["src/page-bridge.js"],
  "world": "MAIN"
}
```
这种机制由 Chrome 内部直接注入到 page world，**不走 inline script，CSP 完全放行**。

`content.js` 删除 `exposeQLBToPageWorld()` 函数，只保留 isolated 端的 `message` 监听响应。

**2. `QLB.debugProgress()` 加入桥接**

在 isolated `window.QLB` 和 `callInBestFrame` 的方法分发表里都加入 `debugProgress` → 自动定位到含题目的子 iframe 调用 `QLBScorer.debugProgress()`。

**3. `debugProgress` 返回值改为可结构化克隆**

之前返回 `{ group: <DOM 节点> }` 跨 frame 时被替换为字符串摘要。现在返回纯数据：
```
{ total, answeredCount, unansweredCount,
  answered: [{ idx, score, options, checkedClass, visible, inIframe, tag, parentTag }, ...30],
  unanswered: [...30] }
```
console.table 在 isolated 端打印；page world 也可直接 `await QLB.debugProgress()` 拿数据。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 控制台不再有 CSP `Executing inline script violates` 错误
3. 在 **DevTools 默认 frame（top）**控制台直接跑：
   ```js
   await QLB.debugProgress()
   ```
   → 看到 `{ total, answeredCount, unansweredCount, answered, unanswered }` 输出，把它发我

---

## [1.9.17] - 2026-05-06

### 🐛 修复标注模式进度计数错误（"刚进页面就 100/196"）+ 加诊断 API

#### 现象
用户打开新任务，应该是 0/N（N≈48），但工具栏显示「100/196」之类的奇怪数字。

#### 根因（最可能）
`getAllQuestionGroups()` 之前用的是 `document.querySelectorAll('.cr-radio-group')`：
- 但 `.cr-radio-group` 这个类名**质检页的"通过/不通过"组也在用**
- 如果页面 DOM 里同时存在标注 + 质检（任务流是"先标注、再质检"，或多 tab 的某种缓存），所有 radio 组都被算进总数
- 而质检的"通过/不通过"被选中后 `getCurrentScore` 会返回字符串"通过"（不是 null），**误判为已答**

#### 修复
**1. `getAllQuestionGroups` / `getQuestionsInColumn` 加严**

只保留**含 `[name="0"|"0.5"|"1"|"none"]` 选项 label 的 radio 组**，过滤掉质检 radio 和其他脏 DOM：

```js
return all.filter((g) => {
  for (const v of ['0', '0.5', '1', 'none']) {
    if (g.querySelector(`label.tea-form-check[name="${v}"]`)) return true;
  }
  return false;
});
```

质检模式不受影响（qa.js 不调用这两个函数，质检进度走 `QLBQA.countProgress`）。

**2. 新增 `QLBScorer.debugProgress()` 诊断 API**

控制台跑一行就能看到题目识别明细（前 10 条已答 / 前 10 条未答 + 各题的选项 name 和已选中态）：

```js
window.QLBScorer.debugProgress()
```

输出格式（伪代码）：
```
[QLB:Progress 诊断] 总题数 X  已答 Y  未答 Z
已答题（前 10 条）：(idx, score, options, checkedClass, visible, inIframe)
未答题（前 10 条）：...
```

如果"已答"里还有 `visible: false` 的脏题，发我截图，我再针对性加过滤条件。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 重开标注任务页 → 工具栏「进度」应显示 0/N（N≈48），不再是 100/196
3. 控制台跑 `window.QLBScorer.debugProgress()` → 总题数应等于实际页面渲染的标注题数

> ⚠️ **注意**：诊断 API 必须在**子 iframe** 控制台跑（DevTools 顶部 frame 选择器切到 `combinator` 或带视频的那个 iframe），top frame 没有 `window.QLBScorer`。

---

## [1.9.16] - 2026-05-06

### 🐛 触摸板横滑首次失效 + 屏蔽"左滑返回上一页"误触

#### 现象
1. 刚进入新任务页面时，**触摸板横向滑动失效**，必须先用鼠标点击页面或拖动横滚条才能恢复
2. 触摸板**往左滑很容易触发浏览器返回上一页**的导航手势（macOS 双指左滑）

#### 根因
- `wheel-pan.js` 之前对 `absX > absY`（触摸板横滑）直接 `return` 让浏览器原生处理
- 浏览器在 iframe 内的横滚轨道（`.cr-container-col--18`）滚到 `scrollLeft=0` 后，溢出的横向滑动会被识别为 **history navigation 手势** → 返回上一页
- 而且首次加载时焦点不在子 iframe，浏览器可能把横滑路由给 history 而不是 iframe 内的 scroll 容器 → "失效"

#### 修复
**1. `wheel-pan.js` 主动接管触摸板横滑**

之前 `absX > absY` → `return` 让浏览器处理；现在 → **插件直接把 `deltaX` 应用到 `track.scrollLeft` 并 `preventDefault`**，浏览器再也拿不到这个事件 → 不会触发导航手势：

```js
if (absX > absY) {
  const track = findHorizontalTrack(e.target);
  if (!track) return;          // 不在评估区不劫持
  track.scrollLeft += e.deltaX;
  e.preventDefault();
  return;
}
```

监听器从 `capture: false` 改为 `capture: true`，**比浏览器内置导航手势识别更早拿到事件**。

**2. CSS `overscroll-behavior-x: contain` 双保险**

```css
.cr-container-col--18 {
  overscroll-behavior-x: contain !important;
}
```

横向滚动到边缘时浏览器**完全不接管**为导航手势，即使插件被禁用也保留这道屏障。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 重开任务页**不点任何地方**，直接用触摸板双指水平滑动 → 视频和题目应**立刻一起横滚**
3. 横滑到最左 → 不再触发浏览器"返回上一页"
4. 标注页 + 质检页都验证

---

## [1.9.15] - 2026-05-06

### 🐛 修复"刚进入界面，题目1 左侧文字显示不全"的 bug

**现象**：标注模式下首次打开任务页，下方答题列表中**视频1 这一列左侧的文字被截掉**，需要用户手动往左滚一下才能看全。

**根因**：浏览器在加载阶段可能因某些焦点元素（autofocus / video poster / React 组件 mount 时的 scrollIntoView）把横向 scrollable 容器（`.cr-container-col--18`）推到非 0 位置 → 第 1 列左侧就被截掉了。

**修复**：在 `scroll-sync.js#detectTracks()` 首次探测成功时，主动把视频轨道与题目轨道的 `scrollLeft` 复位到 0：
- 用 `writingBack` 标记包裹，防止 `mirrorScroll` 反向回弹
- 等两帧再执行（让 React 完成首次渲染，避免我们写完 0 后又被推到非 0）
- 仅"首次探测"时执行（`initialResetDone` 控制），用户已手动滚到中间后**不会被强行拉回**
- SPA 切任务 / 切模式时 `unbind()` 会重置标记，下个任务也能享受这个修复

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 重新打开标注任务页 → 下方答题列表第 1 列（视频1）的左侧文字应**完整可见**，不需要手动滚
3. 提交一题进入下一任务 → 同样完整可见

---

## [1.9.14] - 2026-05-06

### ⌨️ 标注模式 `4` 键也可作为 none

之前 `4` 键空缺，本版补上：标注模式下 **`` ` ``、`~`、`4`** 三个键都可以打 `none`，方便手指就近敲数字键，无需切到反引号位置。

- `src/navigator.js`：`scoreMap` 新增 `'4': 'none'`
- 帮助弹窗：标注模式表格 none 行改为 `` ` `` / `~` / `4`，工作流提示同步说明
- popup 速查 / README：同步更新

> 跨 frame 转发列表 `content.js:keys` 之前就已包含 `4`，无需改动。

### 📋 验证

1. `chrome://extensions/` → 刷新 QLabel Booster
2. 标注页聚焦任意题 → 按 `4` → 应选中 `none` 并跳下一题
3. 帮助弹窗 / popup 速查 都已显示 `` ` `` / `~` / `4` 三键并列

---

## [1.9.13] - 2026-05-06

### ⌨️ 新增 ⌘/Ctrl+Z 撤销 + ?/、键打开帮助 + 悬浮窗默认位置上移

- **⌘/Ctrl+Z**：撤销最近一次批量打分（标注/质检通用）。在输入框内仍是浏览器原生撤销
- **? / / / 、 / \\ 键**：打开/关闭帮助面板（不在输入框时生效）
- **悬浮窗默认位置上移**：CSS 默认 `bottom: 260px` 改为 `ensureWrap` 时动态测量工具栏高度 + 24px gap，避免重叠
- **悬浮窗位置/尺寸记忆**：v1.0 起就已实现，本版完善"无保存值时的初始位置"
- **CHANGELOG 归档**：v1.9.7 之前移到 [CHANGELOG-archive.md](./CHANGELOG-archive.md)

### 关于撤销快捷键的冲突说明
- 浏览器原生 `⌘+Z` 在 `<input>/<textarea>` 内是"撤销输入"，插件不抢这个键
- 焦点在题目区域 → 触发插件的撤销批量
- `⌘+Shift+Z`（重做）插件未占用，浏览器/系统原生行为不变

### 📋 验证

1. `chrome://extensions/` 刷新插件
2. 标注页：打分一题 → 按 `⌘/Ctrl+Z` → 应弹 toast「↶ 已撤销 N 处」
3. 任意页面按 `?` → 帮助面板打开，再按一次关闭
4. 首次安装/清缓存 → 悬浮窗默认位置在工具栏正上方有 24px gap
5. 拖动 + 缩放悬浮窗 → 关页面后重开 → 记住上次位置和尺寸

---

## [1.9.12] - 2026-05-06

### 📌 文案统一 + 质检模式自动跳转修复

- **manifest description 重写**：含作者署名「Built by 实习生godwayxiong熊🐼」
- **文案统一为「跳转到未答题」**：工具栏按钮 / 帮助弹窗 / popup / toast 全部统一
- **质检模式系统提示自动跳转**：扩容 `REQUIRED_MSG_RE`（新增 `必选 / 未答 / 请完成 / 不能为空` 等）+ 扩容提示容器选择器（`.tea-toast / [role="status"]` 等）+ 提交按钮文案兜底（「完成 / 确定提交」）+ 兜底轮询 3s → 5s

---

## [1.9.11] - 2026-05-06

### 🐛 倍速 hover + 切题自动重扫 + 恢复作者信息

- 悬浮窗倍速 select 加 hover/focus 反馈
- **切题后悬浮窗自动重扫新视频**：把"检测视频集合变化 → 自动 reload"从 missing.js（仅提交触发）搬到 floating-player.js（悬浮窗常驻，250ms 防抖 + 双确认）
- 恢复 manifest description 中被 v1.9.9 误删的作者信息

---

## [1.9.10] - 2026-05-06

### 🐛 拖拽消失 + 复位位置 + 字体升级

- **修复工具栏短按消失**：mousedown 先锁定 left/top 再清 right/bottom（之前顺序导致 4 个定位属性全 auto 坍缩到左上角）
- **复位悬浮窗位置上移**：动态测量工具栏高度 + 24px gap
- **字体栈升级**：CSS 变量 `--qlb-font-sans` 覆盖 mac (SF Pro + 苹方) / win (Segoe UI Variable + 微软雅黑 UI) / linux (Source Han Sans / Noto)，启用字体平滑

---

## [1.9.9] - 2026-05-06

### 🧹 代码质量大扫除

- **修文档错别**：popup / README / manifest 的 `4 → none` 全部改为 `` ` `` / `~`
- **popup 与 content 联动**：state.js 加 `chrome.storage.onChanged` 监听 → popup 改完立刻生效
- **删死代码**：`startLoopGuard` setInterval、`onFocusedColumnChanged`、`SEL.errorToast`、`playerVisible/highlightFocus` 死开关
- **日志噪声清理**：content.js / platform.js 改为 `window.__QLB_VERBOSE__` 受控
- **CSS 主题色变量基础设施**：styles.css 顶部 `:root --qlb-color-*` 变量
- **删除 DEBUG.md**：写着 v1.0.0 严重过时
- **README 重写**：补质检模式 + 13 个 src 文件目录树 + 模块依赖图

---

## [1.9.8] - 2026-05-06

### 🎯 悬浮窗顺序 + macOS/Windows 快捷键自适应

- **悬浮窗循环顺序固定**：原视频0 → 视频1~N → 参考图视频0 → 循环；首次打开永远是「原视频0」
- **新增 src/platform.js**：识别系统 (mac/win/linux)，提供 `combo()` / `combHTML()` API
- **帮助文案按系统切换**：mac 显示 `⌘+⇧+P`，win 显示 `Ctrl+Shift+P`
- 工具栏 tooltip / 悬浮窗 PiP+复位 / missing toast 全部用 platform.js 渲染
- 功能层不变：始终用 `e.metaKey || e.ctrlKey`，跨平台兼容

---

## [1.9.7] - 2026-05-06

### 📐 屏幕分辨率 / 像素密度自适应

- 5 套断点适配：< 1024px / < 1280px / 默认 / >= 2560px / 横屏窄高
- HiDPI / Retina 屏字体抗锯齿 + 边框细化
- `prefers-reduced-motion` 支持
- `floating-player.js#resetPos` 也按视口宽度选尺寸

---

## 历史版本

更早的版本（v1.0.0 ~ v1.9.6，共 30+ 个版本，含质检模式诞生 / 同步滚动重写 / 双模式互斥架构 / 修正分胶囊 / Prompt sticky / 等多个里程碑功能）请查看 [CHANGELOG-archive.md](./CHANGELOG-archive.md)。
