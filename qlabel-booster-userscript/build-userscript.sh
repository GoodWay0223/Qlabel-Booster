#!/usr/bin/env bash
# ============================================================================
# QLabel Booster - 油猴脚本（Tampermonkey）构建器
#
# 用法：
#   ./build-userscript.sh
#
# 工作原理：
#   1. 读取 ../qlabel-booster/src/*.js 与 styles.css
#   2. 按依赖顺序把 13 个 JS 合并成单文件
#   3. 把 styles.css 转为 GM_addStyle('...') 调用
#   4. 加上 Tampermonkey 头部元数据 + GM API shim
#   5. 输出到 dist/qlabel-booster.user.js
#
# 输出：
#   dist/qlabel-booster.user.js          ← 分发给同事的单文件脚本
# ============================================================================
set -e

cd "$(dirname "$0")"

# 原插件目录
PLUGIN_DIR="../qlabel-booster"
SRC_DIR="$PLUGIN_DIR/src"

if [ ! -d "$SRC_DIR" ]; then
  echo "❌ 找不到原插件源码目录：$PLUGIN_DIR/src"
  echo "   请确认 qlabel-booster 和 qlabel-booster-userscript 在同一个父目录下"
  exit 1
fi

# 从 manifest.json 读版本号（保持与插件版一致）
VERSION=$(grep '"version"' "$PLUGIN_DIR/manifest.json" | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
if [ -z "$VERSION" ]; then
  echo "❌ 无法从 $PLUGIN_DIR/manifest.json 读取版本号"
  exit 1
fi

# 加油猴自己的编号后缀，便于区分（不然用户混淆这是插件版还是油猴版）
USERSCRIPT_VERSION="${VERSION}"

echo "╭─────────────────────────────────────────────────╮"
echo "│  QLabel Booster · 油猴脚本构建                   │"
echo "│  版本: v${USERSCRIPT_VERSION}"
echo "╰─────────────────────────────────────────────────╯"

OUT_FILE="dist/qlabel-booster.user.js"
mkdir -p dist

# ========================================================================
# 1. Tampermonkey 元数据头部
# ========================================================================
echo "📝 [1/6] 写入 Tampermonkey 头部（含 data URL 图标）..."
# 生成 icon data URL（把 icon48.png 内嵌成 base64，避免依赖外网）
ICON_PNG="$PLUGIN_DIR/icons/icon48.png"
if [ -f "$ICON_PNG" ]; then
  ICON_DATA_URL="data:image/png;base64,$(base64 < "$ICON_PNG" | tr -d '\n')"
else
  ICON_DATA_URL=""  # 兜底：无图标
fi
# 替换 __VERSION__ 和 __ICON_DATA_URL__ 占位符
# 注意：data URL 里可能含有 / 和特殊字符，不能用 sed 的 s/// 分隔符（会冲突），
# 改用 | 作为分隔符，同时 sed 输入方式改为从 stdin 接管以避免长行问题。
awk -v ver="$USERSCRIPT_VERSION" -v icon="$ICON_DATA_URL" '
{
  gsub(/__VERSION__/, ver);
  gsub(/__ICON_DATA_URL__/, icon);
  print;
}' header.user.js > "$OUT_FILE"

# ========================================================================
# 2. IIFE 包装头 + CSS 注入
# ========================================================================
echo "🎨 [2/6] 注入 styles.css..."
{
  echo ""
  echo "(function () {"
  echo "  'use strict';"
  echo ""
  echo "  // 油猴脚本默认在沙箱运行，把 window 指向 page world 的真 window"
  echo "  // 这样所有 \`window.QLBToolbar = ...\` 之类的全局声明能被用户在 DevTools 控制台看到"
  echo "  const window = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : globalThis.window;"
  echo "  const document = window.document;"
  echo ""
  echo "  // ==== CSS 样式注入 ===="
  echo "  if (typeof GM_addStyle === 'function') {"
  echo "    GM_addStyle(\`"
  # 把 CSS 里的 \` 和 \$ 转义，避免破坏 template literal
  sed 's/\\/\\\\/g; s/`/\\`/g; s/\$/\\$/g' "$SRC_DIR/styles.css"
  echo "    \`);"
  echo "  }"
  echo ""
} >> "$OUT_FILE"

# ========================================================================
# 3. 注入 GM API shim（让 chrome.* 调用能工作）
# ========================================================================
echo "🔧 [3/6] 注入 GM API shim..."
{
  echo "  // ==== GM API shim（chrome.storage / chrome.runtime 兼容）===="
  cat shims/gm-shim.js
  echo ""
} >> "$OUT_FILE"

# ========================================================================
# 4. 按依赖顺序合并 13 个 JS
# ========================================================================
echo "🧩 [4/6] 合并 13 个模块..."
# 依赖顺序必须与 manifest.json 的 content_scripts.js 一致
MODULES=(
  "selectors.js"
  "state.js"
  "platform.js"
  "mode.js"
  "scorer.js"
  "navigator.js"
  "missing.js"
  "floating-player.js"
  "scroll-sync.js"
  "wheel-pan.js"
  "qa.js"
  "toolbar.js"
  "content.js"
)

for mod in "${MODULES[@]}"; do
  if [ ! -f "$SRC_DIR/$mod" ]; then
    echo "    ⚠️  缺失：$SRC_DIR/$mod"
    continue
  fi
  {
    echo ""
    echo "  // ======================================================================"
    echo "  // == src/$mod"
    echo "  // ======================================================================"
    cat "$SRC_DIR/$mod"
    echo ""
  } >> "$OUT_FILE"
done

# ========================================================================
# 5. page-bridge.js 在油猴版里是多余的！
# ========================================================================
# 原插件里 page-bridge.js 是为了解决 MV3 isolated world 隔离问题：
# 把 window.QLB 暴露到 page world，让 DevTools 默认 console 能访问。
#
# 油猴脚本通过 `const window = unsafeWindow` 已经直接在 page world 写 window.QLB，
# DevTools 默认 console 天生就能访问，不需要 postMessage 桥。
# → 所以这里 skip page-bridge.js。
echo "⏭️  [5/6] 跳过 page-bridge.js（油猴版直接运行在 page world，不需要桥）"

# ========================================================================
# 6. 追加油猴特有功能：GM 菜单命令（替代 popup 的"启用快捷键"开关）
#    注意：脚本会同时在顶层 frame 和 iframe 里各运行一次，如果两边都 registerMenuCommand，
#    Tampermonkey 会把两边的同名菜单合并为一条，但点击时会触发 2 次 handler → 弹 2 次 alert
#    所以必须包在 `if (window === window.top)` 里，只在顶层 frame 注册一次。
# ========================================================================
echo "🎛  [6/6] 注册 GM 菜单命令（只在 top frame 执行一次）..."
{
  echo ""
  echo "  // ======================================================================"
  echo "  // == 油猴特有：通过 GM_registerMenuCommand 提供设置（替代原插件 popup）"
  echo "  // v1.9.30：只在顶层 frame 注册一次，防止 iframe 重复注册导致菜单弹 2 次"
  echo "  // ======================================================================"
  echo "  try {"
  echo "    var __qlbIsTopFrame = false;"
  echo "    try { __qlbIsTopFrame = (window === window.top); } catch (e) { __qlbIsTopFrame = false; }"
  echo "  } catch (e) {}"
  echo "  if (typeof GM_registerMenuCommand === 'function' && __qlbIsTopFrame) {"
  echo "    try {"
  echo "      // 启用/禁用快捷键"
  echo "      GM_registerMenuCommand('⌨️ 快捷键：' + ((typeof GM_getValue !== 'undefined' && GM_getValue('enableShortcuts', true)) ? '已启用（点击关闭）' : '已关闭（点击启用）'), () => {"
  echo "        const cur = GM_getValue('enableShortcuts', true);"
  echo "        GM_setValue('enableShortcuts', !cur);"
  echo "        alert('已' + (!cur ? '启用' : '关闭') + '键盘快捷键。刷新页面（或等 1 秒）立即生效。');"
  echo "      });"
  echo "      // 重置所有设置"
  echo "      GM_registerMenuCommand('♻️ 重置所有 QLabel Booster 设置', () => {"
  echo "        if (!confirm('确定要重置所有设置吗？工具栏位置、悬浮窗尺寸、首选项等都会还原。')) return;"
  echo "        const keys = (typeof GM_listValues === 'function') ? GM_listValues() : [];"
  echo "        keys.forEach(k => { try { GM_deleteValue(k); } catch (e) {} });"
  echo "        alert('✅ 已重置。请刷新页面。');"
  echo "      });"
  echo "      // 关于/版本"
  echo "      GM_registerMenuCommand('ℹ️ 关于：QLabel Booster v' + (GM_info.script.version || '?') + ' by godwayxiong熊 🐼', () => {"
  echo "        alert('QLabel Booster（油猴版）\\n版本：v' + (GM_info.script.version || '?') + '\\n作者：godwayxiong熊（实习生）\\n反馈：825121444@qq.com');"
  echo "      });"
  echo "    } catch (e) { /* ignore */ }"
  echo "  }"
} >> "$OUT_FILE"

# ========================================================================
# 7. IIFE 关闭
# ========================================================================
{
  echo ""
  echo "})();"
  echo ""
  echo "// ==== 构建信息 ===="
  echo "// 构建时间：$(date '+%Y-%m-%d %H:%M:%S')"
  echo "// 源代码：qlabel-booster/src/*.js (${#MODULES[@]} 个模块)"
} >> "$OUT_FILE"

# ========================================================================
# 完成
# ========================================================================
SIZE=$(du -h "$OUT_FILE" | cut -f1)
LINES=$(wc -l < "$OUT_FILE" | tr -d ' ')
echo ""
echo "╭─────────────────────────────────────────────────╮"
echo "│  ✅ 构建完成！                                   │"
echo "╰─────────────────────────────────────────────────╯"
echo ""
echo "  📄 输出：${OUT_FILE}"
echo "  📊 体积：${SIZE}  (${LINES} 行)"
echo ""
echo "  📤 分发方式（二选一）："
echo "    A. 把 ${OUT_FILE} 文件发给对方"
echo "       → 对方 Tampermonkey 主页 → 「实用工具」→ 「从文件导入」"
echo ""
echo "    B. 内网放一个 Git 仓库 raw URL（永远最新）"
echo "       → 对方打开那个 URL，Tampermonkey 自动弹窗询问是否安装"
echo ""
