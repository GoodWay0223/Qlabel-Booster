# QLabel Booster 油猴版安装指南

> 油猴脚本版 — 兼容所有 Chromium 内核浏览器 + Firefox + Safari
> Built by godwayxiong 熊 🐼

---

## 为什么用油猴版而不是浏览器插件版？

| 对比项 | 浏览器插件（zip 版）| 油猴脚本版 ⭐ |
|---|---|---|
| 能否被公司 Chrome 企业策略拦截 | ❌ 常被拦 | ✅ 基本不受影响（只要 Tampermonkey 本身装上） |
| 安装流程 | 解压 + 开发者模式 + 加载目录 + 清隔离标记 | **点一下就装** |
| macOS 隔离标记问题 | 有 | 无（纯文本脚本） |
| 跨浏览器 | 只 Chrome 系 | Chrome / Edge / Firefox / Safari 全支持 |
| 跨系统 | Windows / macOS / Linux | 同左 |
| 升级方式 | 手动替换文件 | Tampermonkey 自动检查更新 |

---

## 第一次使用

### 步骤 1：装 Tampermonkey（油猴管理器）

根据你的浏览器选：

| 浏览器 | 安装地址 |
|---|---|
| **Chrome / Edge / Brave / Arc** | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| **Firefox** | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/) |
| **Safari** | [Userscripts for Safari（Mac App Store）](https://apps.apple.com/cn/app/userscripts/id1463298887)（免费） |

点「添加/获取」即可。这一步不受企业策略影响，因为这些都是 Chrome Web Store / 系统商店的正规扩展。

---

### ⚠️ 步骤 2：打开 Chrome "允许用户脚本"开关（**必做 · 最容易漏**）

> **Chrome 自 M120 起新增的安全策略**：所有用户脚本管理器（Tampermonkey / Violentmonkey / ScriptCat 等）都**必须**在扩展页面手动开启"允许用户脚本"开关，否则脚本装上也不会执行。
>
> 安装完脚本后，如果 Tampermonkey 面板里脚本卡片灰色显示「**此脚本还未被执行**」，或者页面顶部有蓝色条提示「**请启用开发者模式以允许用户脚本注入**」，99% 就是这一步没做。

操作（Chrome / Edge / Brave / Arc 等 Chromium 浏览器通用）：

1. 地址栏打开 `chrome://extensions/`（Edge 是 `edge://extensions/`）
2. 找到 **Tampermonkey · 篡改猴** 这张卡片
3. 点「**详情**」进入扩展管理页
4. 滚动到下面，把「**允许用户脚本 / Allow User Scripts**」开关**打开**
5. 回到 QLabel 页面刷新

💡 **注意**：Chrome 从某个版本起开关名字叫「允许用户脚本」，Edge / 旧版 Chrome 可能需要先打开页面最右上角的「**开发者模式**」总开关才会显示它。如果你按上面步骤找不到这个选项，就先开"开发者模式"再回来找。

---

### 步骤 3：装 QLabel Booster 脚本

**方式 A：打开 `.user.js` 文件（推荐）**

1. 下载 `qlabel-booster.user.js` 文件（你的作者会发给你）
2. 把该文件**拖到浏览器地址栏**，或者**双击打开**
3. Tampermonkey 会自动弹出安装页面
4. 点「**安装**」

**方式 B：从 Tampermonkey 主页手动导入**

1. 点击浏览器工具栏的 **Tampermonkey 图标**
2. 选「**管理面板**」
3. 顶部菜单点「**实用工具**」
4. 找到「**从文件导入**」，选择 `qlabel-booster.user.js`

**方式 C：内网 URL 安装（如果作者提供了 URL）**

1. 直接在浏览器地址栏访问那个 URL
2. Tampermonkey 会自动识别并弹出安装确认

### 步骤 4：验证

1. 打开 QLabel 任务页 `https://qlabel.qq.com/...`
2. 右下角出现**深色工具栏** → ✅ 成功
3. 按 `?` 键打开快捷键帮助面板

如果步骤 4 没看到工具栏 → 回到**步骤 2**再核对一遍"允许用户脚本"开关状态，这是 90% 的失败原因。

---

## 使用

和浏览器插件版**完全一样**，所有功能、快捷键、UI 100% 一致。

### 常用快捷键

| 键 | 功能 |
|---|---|
| `1` / `2` / `3` | 标注模式打分 0 / 0.5 / 1 |
| `` ` `` / `~` / `4` | 打分 none |
| `Tab` / `↓` | 下一题 |
| `N` | 跳转到未答题 |
| `⌘/Ctrl+Shift+0` | 悬浮窗 + 工具栏复位 |
| `⌘/Ctrl+Shift+P` | 画中画 |
| `⌘/Ctrl+Z` | 撤销最近一次批量打分 |
| `?` / `/` / `、` | 打开/关闭帮助面板 |

完整快捷键见页面内的「帮助」按钮或按 `?`。

---

## 油猴特有功能

点击浏览器工具栏的 **Tampermonkey 图标** → 能看到以下菜单（只在 QLabel 页面显示）：

- **⌨️ 快捷键：已启用（点击关闭）** — 临时禁用所有快捷键
- **♻️ 重置所有 QLabel Booster 设置** — 工具栏位置、悬浮窗尺寸、偏好清零
- **ℹ️ 关于：QLabel Booster vX.X.X** — 版本/作者/反馈

---

## 升级

### 自动升级（推荐）

如果作者把脚本放在内网 URL，Tampermonkey 每天会**自动检查更新**，有新版弹通知。你只需要点「安装更新」。

### 手动升级

下载新的 `qlabel-booster.user.js`，拖到浏览器里，Tampermonkey 会识别为"已有脚本"并提示**覆盖安装**。点「安装」即可。

**所有设置会保留**（位置、尺寸、偏好等）。

---

## 卸载

Tampermonkey 图标 → 管理面板 → 找到 **QLabel Booster** → 右侧的**删除图标**。

---

## 常见问题

### Q：装完刷新 QLabel 页面没反应？

A：按这个顺序排查（从高频到低频）：

1. **🔥 最常见**：Chrome 的「**允许用户脚本**」开关没开 → 回到安装指南 **步骤 2**。症状：Tampermonkey 面板里脚本卡片右侧能看到"此脚本还未被执行"的灰色提示。
2. Tampermonkey 本身有没有启用（浏览器工具栏图标是彩色而不是灰色）
3. 管理面板里 QLabel Booster 卡片右侧开关是"**启用**"状态（绿色）
4. 浏览器地址必须是 `qlabel.qq.com` 开头，不是别的域名

### Q：Tampermonkey 装不上？

A：说明你的浏览器也被禁止安装 Web Store 扩展了（极罕见的企业 Chrome 配置）。这种情况换一个浏览器（Edge / Firefox），或者用无痕模式。

### Q：能同时装浏览器插件版和油猴版吗？

A：**不建议**，两者会同时在同一页面创建工具栏，互相打架。选一个用即可。

### Q：安全吗？会不会偷数据？

A：
- 代码完全开源，可以自己打开 `qlabel-booster.user.js` 看每一行在做什么
- 脚本只在 `qlabel.qq.com` 域名下生效（`@match` 指定），别的网站不会运行
- 所有设置只存在本地 Tampermonkey 的存储里，不联网上传
- 无任何 `XMLHttpRequest` / `fetch` 对外请求

---

## 问题反馈

📧 作者：godwayxiong 熊 🐼 · 825121444@qq.com
