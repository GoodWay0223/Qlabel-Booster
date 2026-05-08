# QLabel Booster

腾讯 **QLabel / EvalVerse** 视频质量评估效率增强 Chrome 扩展。

支持 **标注** 与 **质检** 两种任务模式（自动识别），针对 `qlabel.qq.com` 的视频评估场景把重复劳动降到 10% 以下：1 原视频 + 多评分视频 × 几十个维度的批量打分、键盘快捷键、悬浮循环视频窗、未答题拦截、修正分胶囊填值等。

---

## ✨ 核心功能

### 🟦 标注模式
| 能力 | 说明 |
| --- | --- |
| 🎯 **一键批量打分** | 工具栏「全选 0 / 0.5 / 1 / none」覆盖整页所有题目 |
| 📦 **分组批量打分** | 每个维度旁注入 `[0][0.5][1][none]` 胶囊；每列视频顶部「本列全选」 |
| ⏪ **撤销栈** | 一键撤销最近一次批量，恢复到操作前的打分 |
| ⌨️ **键盘快捷键** | `1/2/3` 打分 0/0.5/1，`` ` `` / `~` / `4` 打分 none |
| ⚠️ **未答题拦截** | 点「提交」时若有未答会拦截 + 高亮 + 自动定位 |

### 🟪 质检模式（自动识别"是否通过/不通过"页面）
| 能力 | 说明 |
| --- | --- |
| ✅ **通过/不通过** | `1=通过` 题目变绿跳下题；`2=不通过` 题目变红 + 跳到第一个修正分 |
| 🔢 **分组序号** | 每题注入 `#1 #2 #3...`（每列重新计数） |
| 🟢 **批量通过** | 工具栏「全部通过」/「全部不通过」+ 列顶分批操作 + 三色统计 |
| 🎨 **修正分胶囊** | 每个修正分输入下方 `[0][0.25][0.5][0.75][1][none]`，红→黄→绿色阶 |
| 🔵🟠 **快捷/手动双状态** | 蓝框=快捷模式按 `1~5/`/~`填值；橙框=手动模式自由打 0.14 + Enter 提交 |
| 📌 **Prompt sticky** | 左侧 Prompt 列纵向滚动时保持视口顶部 |

### 通用能力（两种模式共享）
| 能力 | 说明 |
| --- | --- |
| 🎬 **悬浮循环视频窗** | 拖拽/缩放/倍速 0.5~2x；自动循环；多视频切换；首位永远是「原视频0」 |
| 🪟 **画中画 PiP** | 一键进入浏览器原生 PiP，可拖到副屏 |
| 🔄 **横向同步滚动** | 视频行 / 题目行比例 1:1 联动，鼠标拖滚动条 / 触摸板都跟手 |
| 🖱 **鼠标横向滑动** | 在视频/题目区滚轮 → 自动转横滚 |
| 🪛 **按系统适配** | 自动识别 macOS / Windows，帮助里的快捷键符号自动切换为 ⌘ ⇧ 或 Ctrl Shift |
| 📐 **多分辨率适配** | 13" 笔记本 / 27" 外接屏 / 4K 屏 / Retina 自动切换尺寸与字号 |

---

## 📦 安装（开发者模式）

1. 打开 Chrome → 地址栏输入 `chrome://extensions/`
2. 右上角开启「**开发者模式**」
3. 点左上「**加载已解压的扩展程序**」
4. 选中本仓库根目录 `qlabel-booster/`
5. 打开 `https://qlabel.qq.com/workspace/...` 任务页面即自动生效

> 兼容性：Chrome / Edge / Brave / Arc / Opera 等所有 Chromium 内核浏览器，macOS 与 Windows 均可。Safari 需要 Xcode 转换 + 签名上架，暂不支持。

---

## 🎮 快捷键速查

### 标注模式
| 按键 | 作用 |
| --- | --- |
| `1` / `2` / `3` | 当前题打分为 `0` / `0.5` / `1` |
| `` ` `` / `~` / `4` | 当前题打分为 `none` |
| `Tab` / `↓` | 下一题（列内优先） |
| `Shift+Tab` / `↑` | 上一题 |
| `←` / `→` | 切换当前操作列 |
| `N` | 跳转到下一道未答题（循环） |
| `Esc` | 取消当前聚焦 |

### 质检模式
| 状态 | 按键 | 作用 |
| --- | --- | --- |
| pass（蓝框） | `1` | 通过 → 题目变绿 → 跳下题 |
| pass（蓝框） | `2` | 不通过 → 跳到本题第一个修正分（橙框） |
| fix-shortcut | `1`~`5` | 修正分填 `0` / `0.25` / `0.5` / `0.75` / `1` |
| fix-shortcut | `` ` `` 或 `~` | 修正分填 `none` |
| fix-shortcut | `Enter` | 切到手动输入模式（橙框，自由打 0~1 两位小数） |
| fix-manual | `Enter` | 提交手动输入并跳下一项 |
| 通用 | `Esc` | 退出 fix 回到 pass 模式 |
| 通用 | `Tab` / `↓` / `Shift+Tab` / `↑` | 上下题切换 |
| 通用 | `←` / `→` | 切换视频列 |

### 通用快捷键（两种模式都可用）
| 按键 | 作用 |
| --- | --- |
| `⌘`+`⇧`+`0` 或 `Ctrl`+`Shift`+`0` | 悬浮窗 + 工具栏复位右下角 |
| `⌘`+`⇧`+`P` 或 `Ctrl`+`Shift`+`P` | 画中画（可拖副屏） |
| `⌘`+`⇧`+`M` 或 `Ctrl`+`Shift`+`M` | 强制定位首个未答 / 错误字段 |

> 在输入框中按键不会触发以上字符快捷键（`⌘+⇧+...` 这类全局组合键除外）。可在扩展 popup 中关闭全局快捷键。

---

## 🎨 图标

如果加载后扩展图标显示不出，请放置以下三个文件：

```
icons/icon16.png   (16x16)
icons/icon48.png   (48x48)
icons/icon128.png  (128x128)
```

---

## 🏗 目录结构

```
qlabel-booster/
├── manifest.json                # MV3 配置，注册 13 个 content scripts + popup
├── README.md
├── CHANGELOG.md                 # 全部历史变更记录
├── icons/                       # 16/48/128 PNG（自行放置）
├── src/
│   ├── selectors.js             # 所有 DOM 选择器，容错集中在此
│   ├── state.js                 # 全局偏好 + chrome.storage 同步
│   ├── platform.js              # 系统识别（mac/win）+ 快捷键符号本地化
│   ├── mode.js                  # 标注 / 质检模式自动识别
│   ├── scorer.js                # 标注模式打分引擎 + 撤销栈
│   ├── navigator.js             # 标注模式键盘导航 + 聚焦
│   ├── missing.js               # 未答题扫描 + 提交拦截
│   ├── floating-player.js       # 悬浮循环视频小窗 + PiP
│   ├── scroll-sync.js           # 视频↔题目横向比例同步滚动
│   ├── wheel-pan.js             # 鼠标纵滚转横滚
│   ├── qa.js                    # 质检模式所有逻辑（双模式 pass/fix）
│   ├── toolbar.js               # 右下角工具栏 + 帮助弹窗 + 双模式 UI
│   ├── content.js               # 入口：模式分发 / 跨 frame 键转发
│   └── styles.css               # 所有注入 UI 样式（qlb- 前缀）
└── popup/
    ├── popup.html               # 设置面板（开关 + 快捷键速查）
    ├── popup.css
    └── popup.js                 # chrome.storage.local 双向同步
```

模块依赖图（content.js 加载顺序见 manifest）：

```
selectors → state → platform
                 ↓
mode → scorer / navigator / missing
     → floating-player → scroll-sync → wheel-pan
     → qa → toolbar → content
```

---

## 🔧 站点适配与容错

QLabel 前端使用腾讯 Tea Design（`tea-*`）+ 项目自定义（`cr-*`）。模式识别基于 DOM 特征：

- **标注模式**：`label.tea-form-check[name="0|0.5|1|none"]`
- **质检模式**：`label.tea-form-check[name="通过|不通过"]`

若站点改版，主要修改：
- `src/selectors.js`（标注题目结构）
- `src/qa.js` 中的 `getQaGroups / getFixInputsForGroup / getDimensionTitleEl`（质检结构）
- `src/scroll-sync.js` 中的 `detectTracks`（横滚轨道）

控制台调试入口：

```js
QLB.debug()             // 查看当前模式 / 题目数 / 选择器命中情况
QLB.qa()                // 质检模式专用：通过/不通过/未答统计
QLBPlatform.os          // 当前系统 'mac' / 'win' / 'linux'
QLBScrollSync.debug()   // 横向同步状态
QLBScrollSync.highlight() // 题目轨道 / 视频轨道可视化高亮
QLB.whyUnanswered()     // 为什么这道题被判定未答
```

---

## 🛡 权限最小化

- `host_permissions`: 仅 `*://*.qlabel.qq.com/*`
- `permissions`: 仅 `storage`
- 不上传任何数据、不发起任何网络请求、不修改任务数据本身（仅模拟点击）

---

## 📜 License

仅供内部效率工具用途，与腾讯 QLabel 平台无任何隶属关系。

— 由 godwayxiong熊 (实习生) 开发与维护，反馈：[825121444@qq.com](mailto:825121444@qq.com)
