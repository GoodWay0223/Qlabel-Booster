#!/usr/bin/env bash
# ============================================================================
# QLabel Booster 发布打包脚本
#
# 用法：
#   ./build.sh
#
# 输出：
#   dist/qlabel-booster-v{version}.zip             —— 插件本体
#   dist/qlabel-booster-v{version}-macos.zip       —— 含一键安装脚本的 macOS 分发包
#   dist/qlabel-booster-v{version}-windows.zip     —— 含 INSTALL.md 的 Windows 分发包
# ============================================================================
set -e

cd "$(dirname "$0")"

VERSION=$(grep '"version"' manifest.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
if [ -z "$VERSION" ]; then
  echo "❌ 无法从 manifest.json 读取版本号"
  exit 1
fi

OUT_DIR="dist"
BASE_NAME="qlabel-booster-v${VERSION}"
INNER_ZIP="${OUT_DIR}/${BASE_NAME}.zip"
MAC_BUNDLE="${OUT_DIR}/${BASE_NAME}-macos.zip"
WIN_BUNDLE="${OUT_DIR}/${BASE_NAME}-windows.zip"

mkdir -p "$OUT_DIR"
rm -f "$INNER_ZIP" "$MAC_BUNDLE" "$WIN_BUNDLE"

# ========================================================================
# 1. 打包插件本体 zip（只含纯插件代码，给 Chrome 加载用）
# ========================================================================
echo "📦 [1/3] 打包插件本体..."
zip -r "$INNER_ZIP" . \
  -x "build.sh" \
  -x "install-macos.command" \
  -x "diagnose*.js" \
  -x "dist/*" \
  -x "CHANGELOG-archive.md" \
  -x "icons/icon-source.png" \
  -x "icons/README.txt" \
  -x "*.DS_Store" \
  -x "*.log" \
  -x ".git/*" \
  -x ".gitignore" \
  -x "node_modules/*" \
  -x "*/.*" \
  > /dev/null
INNER_SIZE=$(du -h "$INNER_ZIP" | cut -f1)
echo "    ✅ ${INNER_ZIP}  (${INNER_SIZE})"

# ========================================================================
# 2. 打包 macOS 分发包（含一键安装脚本）
# ========================================================================
echo "📦 [2/3] 打包 macOS 一键安装包..."
TMP_DIR=$(mktemp -d)
MAC_DIR="${TMP_DIR}/qlabel-booster-v${VERSION}-macos"
mkdir -p "$MAC_DIR"
cp "$INNER_ZIP" "$MAC_DIR/"
cp install-macos.command "$MAC_DIR/一键安装.command"
cp INSTALL.md "$MAC_DIR/" 2>/dev/null || true
cp "README-macOS-首先看这里.txt" "$MAC_DIR/" 2>/dev/null || true
chmod +x "$MAC_DIR/一键安装.command"
(cd "$TMP_DIR" && zip -r "${OLDPWD}/${MAC_BUNDLE}" "qlabel-booster-v${VERSION}-macos" > /dev/null)
rm -rf "$TMP_DIR"
MAC_SIZE=$(du -h "$MAC_BUNDLE" | cut -f1)
echo "    ✅ ${MAC_BUNDLE}  (${MAC_SIZE})"

# ========================================================================
# 3. 打包 Windows 分发包（含 INSTALL.md 说明）
# ========================================================================
echo "📦 [3/3] 打包 Windows 分发包..."
TMP_DIR=$(mktemp -d)
WIN_DIR="${TMP_DIR}/qlabel-booster-v${VERSION}-windows"
mkdir -p "$WIN_DIR"
cp "$INNER_ZIP" "$WIN_DIR/"
cp INSTALL.md "$WIN_DIR/安装说明.md" 2>/dev/null || true
(cd "$TMP_DIR" && zip -r "${OLDPWD}/${WIN_BUNDLE}" "qlabel-booster-v${VERSION}-windows" > /dev/null)
rm -rf "$TMP_DIR"
WIN_SIZE=$(du -h "$WIN_BUNDLE" | cut -f1)
echo "    ✅ ${WIN_BUNDLE}  (${WIN_SIZE})"

echo ""
echo "╭─────────────────────────────────────────────────╮"
echo "│  ✅ 打包完成！                                   │"
echo "╰─────────────────────────────────────────────────╯"
echo ""
echo "📤 分享建议："
echo ""
echo "  给 macOS 用户 → ${MAC_BUNDLE}"
echo "    (对方解压后双击「一键安装.command」即可，自动处理隔离标记)"
echo ""
echo "  给 Windows 用户 → ${WIN_BUNDLE}"
echo "    (对方按"安装说明.md" 3 步手动装)"
echo ""
echo "  只要插件本身 → ${INNER_ZIP}"
echo ""
