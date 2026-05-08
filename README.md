# ⚡ QLabel Booster

> 腾讯 QLabel / EvalVerse 视频打分提效工具
> 标注 + 质检双模式 · 一键批量打分 · 悬浮循环视频窗 · 键盘快捷键 · 未答题定位
> _by godwayxiong 熊 🐼 (实习生)_

[![Latest Release](https://img.shields.io/github/v/release/GoodWay0223/Qlabel-Booster?label=最新版本&color=3b82f6)](https://github.com/GoodWay0223/Qlabel-Booster/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🚀 一键安装（油猴版，推荐）

**只要 2 步**，全平台一致（Mac / Windows / Linux）：

### 第 1 步：安装 Tampermonkey 浏览器扩展

| 浏览器 | 安装链接 |
|---|---|
| Chrome / Edge / Brave / Arc | [Chrome 网上应用店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | [Firefox 附加组件](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| Safari | [Mac App Store](https://apps.apple.com/app/tampermonkey/id1482490089)（付费） |

### 第 2 步：点这个链接安装本脚本

👉 **[一键安装 QLabel Booster](https://github.com/GoodWay0223/Qlabel-Booster/releases/latest/download/qlabel-booster.user.js)**

Tampermonkey 会自动弹窗，点 **「安装」** 即可。

### ✅ 验证

打开 [https://qlabel.qq.com](https://qlabel.qq.com) 任意打分页 → 右下角出现深色工具栏 = 装好了。

> 💡 之后**作者每次发新版**，Tampermonkey 后台 24h 内自动检测并更新 —— **你什么都不用做**。

---

## 🧩 安装方式 2：浏览器插件（仅 Chromium 内核）

如果你不想装油猴，可以直接装 Chrome 扩展（功能完全一致）：

1. 去 [Releases 页面](https://github.com/GoodWay0223/Qlabel-Booster/releases/latest) 下载：
   - **macOS 用户** → `qlabel-booster-vX.X.X-macos.zip`（含一键安装脚本）
   - **Windows 用户** → `qlabel-booster-vX.X.X-windows.zip`
2. 按 zip 内的 `安装说明` 操作

> ⚠️ **macOS 用户特别注意**：插件版有时会因 macOS 隔离标记导致 Chrome 静默加载失败（装完没反应）。**强烈建议直接用油猴版**，零踩坑。

---

## 📋 功能概览

### 标注模式
- ⌨️ 键盘 `1/2/3/4` 快速打分（自动跳下一道未答题）
- 🎯 智能聚焦框：跳转后避开顶部 fixed 视频行，露出题目类别 + 打分胶囊
- 🔵 当前出声视频高亮（带呼吸动画）
- 📍 一键定位首道未答题
- ↩️ 撤销 + 一键回顶/回底
- 💪 整列/小类别批量打分胶囊（"自动跳转下一未答题"可开关）
- 🎬 悬浮循环视频小窗（可拖拽 + 画中画 + 副屏）

### 质检模式
- ⌨️ 键盘 `1/2` 通过/不通过
- 🛠 修正分输入：快捷键 `1~5` 填 0/0.25/0.5/0.75/1，`Enter` 切手动输入
- 🔢 题号序列编号
- 🔄 视频/题目联动同步滚动

### 通用
- ⌘/Ctrl+Shift+0 → 工具栏 + 悬浮窗复位
- ⌘/Ctrl+Shift+P → 画中画
- ⌘/Ctrl+Shift+M → 强制重扫未答题
- ⌘/Ctrl+Z → 撤销最近一次批量操作
- `?` → 打开快捷键帮助

---

## 🆘 装完没反应？

1. 确认地址栏 URL 是 `qlabel.qq.com` 或 `evalverse.qq.com`（同事可能走其他域名）
2. 刷新一次页面
3. 按 F12 → Console → 输入 `QLB.debug()` 把输出截图发给开发者
4. 如果 `QLB` 未定义 → 脚本根本没注入，确认 Tampermonkey 是开启状态

---

## 🐛 反馈 / 提需求

- 提 [Issue](https://github.com/GoodWay0223/Qlabel-Booster/issues)
- 邮箱：825121444@qq.com

---

## 🔧 开发者信息

### 仓库结构

```
.
├── qlabel-booster/                # 浏览器插件源码（MV3）
│   ├── src/                       # 13 个 JS 模块
│   ├── manifest.json              # 版本号在这（修改这里触发 release）
│   ├── CHANGELOG.md
│   └── build.sh                   # 打包插件 zip
├── qlabel-booster-userscript/     # 油猴脚本构建器
│   ├── header.user.js             # Tampermonkey meta 头
│   ├── build-userscript.sh        # 把 src/*.js 合成单文件 .user.js
│   └── shims/gm-shim.js           # GM API 兼容层
└── .github/workflows/release.yml  # GitHub Actions：push 后自动构建并发 Release
```

### 本地开发

```bash
# 改完代码后构建油猴脚本
cd qlabel-booster-userscript && ./build-userscript.sh

# 构建插件 zip
cd qlabel-booster && ./build.sh
```

### 发布新版

1. 改 `qlabel-booster/src/*.js` 修 bug / 加功能
2. 改 `qlabel-booster/manifest.json` 的 `version` 字段（`1.9.53` → `1.9.54`）
3. 在 `qlabel-booster/CHANGELOG.md` 顶部加一段 `## [1.9.54] - YYYY-MM-DD`
4. `git add -A && git commit -m "feat: xxx" && git push`
5. GitHub Actions 自动跑构建 + 发 Release，**用户的 Tampermonkey 24h 内自动收到更新**

---

## 📜 License

MIT © godwayxiong 熊
