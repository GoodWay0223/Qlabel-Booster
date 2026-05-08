# QLabel Booster 油猴脚本版

> 与 `../qlabel-booster/`（浏览器插件版）**共享**同一份业务代码。
> 本目录**不包含**业务逻辑源代码，只含构建脚本 + 兼容层 + 分发文件。

## 目录结构

```
qlabel-booster-userscript/
├── build-userscript.sh       ← 构建脚本：把插件版源码打包成 .user.js
├── header.user.js            ← Tampermonkey 元数据头部（@name / @match / @grant 等）
├── shims/
│   ├── gm-shim.js            ← chrome.storage / chrome.runtime → GM_* API 的兼容层
│   └── gm-entry.js           ← 入口注释（辅助说明）
├── dist/
│   └── qlabel-booster.user.js ← 构建产物（分发这个文件）
├── INSTALL-userscript.md     ← 给最终用户的安装指南
└── README.md                 ← 本文件
```

## 工作流

### 日常开发（仍然在插件版目录）

```bash
cd ../qlabel-booster
# 修改 src/*.js 或 styles.css
# 改完升 manifest.json 的 version
# 改完补 CHANGELOG.md
```

### 发油猴版

```bash
cd ../qlabel-booster-userscript
./build-userscript.sh
# 生成 dist/qlabel-booster.user.js（油猴脚本）
```

**版本号**自动从 `../qlabel-booster/manifest.json` 里读，两个版本永远同步。

## 核心兼容逻辑

### 1. chrome.storage → GM_setValue/GM_getValue

`shims/gm-shim.js` 里把 `chrome.storage.local.get/set/remove/onChanged` 完整模拟。业务代码里的
```js
chrome.storage.local.set({ toolbarX: 10 })
```
在油猴环境下等价于
```js
GM_setValue('toolbarX', 10)
```

### 2. 所有 window.xxx 挂到 unsafeWindow

Tampermonkey 默认在沙箱里运行，`window.QLBToolbar = ...` 默认只挂沙箱 window，DevTools console 看不到。
我们在 IIFE 顶部加了：

```js
const window = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : globalThis.window;
const document = window.document;
```

这样所有业务代码里的 `window` / `document` 都指向页面的真 window，DevTools 默认 console 能直接调 `QLB.debug()`。

### 3. page-bridge.js 在油猴环境下跳过

原插件用 manifest.world: "MAIN" 注入 page-bridge.js 到 page world，解决 MV3 isolated world 隔离问题。
油猴版本身已经在 page world，不需要桥。构建脚本里这段已 skip。

### 4. popup 功能迁移到 GM 菜单命令

原插件 popup 只有一个 `enableShortcuts` 开关，迁移为 Tampermonkey 菜单命令（点油猴图标时可见）。

## 构建产物说明

`dist/qlabel-booster.user.js` 的内部结构：

```
1. Tampermonkey 元数据头 (header.user.js 内容 + 注入的 @version)
2. IIFE 包装开头
3. const window = unsafeWindow 覆盖
4. GM_addStyle(``) 注入 src/styles.css
5. shims/gm-shim.js（chrome API 兼容）
6. src/selectors.js
7. src/state.js
8. src/platform.js
9. src/mode.js
10. src/scorer.js
11. src/navigator.js
12. src/missing.js
13. src/floating-player.js
14. src/scroll-sync.js
15. src/wheel-pan.js
16. src/qa.js
17. src/toolbar.js
18. src/content.js
19. GM_registerMenuCommand 注册菜单
20. IIFE 结束
```

## 已知兼容性

| 浏览器 | 油猴管理器 | 支持 |
|---|---|---|
| Chrome / Edge / Brave / Arc | Tampermonkey | ✅ 完全支持 |
| Firefox | Tampermonkey / Violentmonkey | ✅ 完全支持 |
| Safari 14+ | Userscripts | ✅ 基本支持（需测试 PiP） |

## 分发方式

### 方式 A：单文件分发
```
把 dist/qlabel-booster.user.js 发给同事 → 拖到浏览器 → 自动安装
```

### 方式 B：内网 URL 分发（推荐）
```
把 dist/qlabel-booster.user.js 放到内网 Git 仓库的 raw 链接
→ 对方打开 URL，Tampermonkey 弹窗询问是否安装
→ 每次改版重新构建推送，对方 Tampermonkey 自动检查更新
```

## 问题反馈

📧 godwayxiong 熊 · 825121444@qq.com
