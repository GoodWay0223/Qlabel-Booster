#!/usr/bin/env bash
# ============================================================================
# QLabel Booster 一键安装脚本（macOS）v2
#
# 用法：
#   双击此文件（会自动在终端打开）
#
#   ⚠️ 首次双击若被 macOS 拦截提示"无法验证"：
#      → 右键此文件 → 选「打开」→ 弹窗里再点「打开」即可放行
#
# 它会做什么：
#   1. 把插件解压到 ~/Applications/qlabel-booster/（永久位置）
#   2. 自动扁平化多层嵌套的 zip 结构
#   3. **清除 macOS 隔离标记** —— 这是 90% "装完没反应" 的真因
#   4. 完整性自检（manifest.json / src / icons 齐全）
#   5. 自动打开 Chrome/Edge/Arc/Brave 的扩展页 + Finder 定位
#   6. 失败时打印自助排查提示
# ============================================================================
set -e

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

echo ""
echo "${BLUE}╭─────────────────────────────────────────────╮${NC}"
echo "${BLUE}│   QLabel Booster 一键安装助手 · macOS v2    │${NC}"
echo "${BLUE}│   by godwayxiong 熊 🐼                      │${NC}"
echo "${BLUE}╰─────────────────────────────────────────────╯${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 清掉脚本自身 + 同目录 zip 的隔离标记
xattr -cr "$SCRIPT_DIR" 2>/dev/null || true

# ====== 步骤 1：找 zip ======
echo "${YELLOW}[1/5]${NC} 查找安装包..."
ZIP_FILE=$(ls "$SCRIPT_DIR"/qlabel-booster-v*.zip 2>/dev/null | head -1)
if [ -z "$ZIP_FILE" ]; then
  ZIP_FILE=$(ls "$SCRIPT_DIR"/qlabel-booster*.zip 2>/dev/null | head -1)
fi

if [ -z "$ZIP_FILE" ]; then
  echo ""
  echo "${RED}❌ 没找到插件 zip 文件${NC}"
  echo ""
  echo "   请确认："
  echo "     1) 你把外层 zip 完全解压了（Finder 双击 .zip 会自动解压）"
  echo "     2) 解压出的文件夹里同时有："
  echo "        - 本脚本（一键安装.command）"
  echo "        - qlabel-booster-vX.X.X.zip"
  echo "     3) 双击的是解压后文件夹里的 .command，不是 zip 里嵌套的"
  echo ""
  echo "   当前目录：$SCRIPT_DIR"
  echo "   目录内容："
  ls "$SCRIPT_DIR" | sed 's/^/     /'
  echo ""
  echo "${YELLOW}   按任意键退出...${NC}"
  read -n 1
  exit 1
fi
echo "       ${GREEN}✓${NC} 找到：$(basename "$ZIP_FILE")"

# ====== 步骤 2：解压 ======
echo ""
echo "${YELLOW}[2/5]${NC} 解压到永久目录..."
INSTALL_DIR="$HOME/Applications/qlabel-booster"
echo "       目标：$INSTALL_DIR"

if [ -d "$INSTALL_DIR" ]; then
  echo "       ${BLUE}·${NC} 清理旧版本..."
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$HOME/Applications"
unzip -q -o "$ZIP_FILE" -d "$INSTALL_DIR"

# 扁平化嵌套
if [ ! -f "$INSTALL_DIR/manifest.json" ]; then
  INNER=$(find "$INSTALL_DIR" -maxdepth 3 -name "manifest.json" -print -quit 2>/dev/null)
  if [ -n "$INNER" ]; then
    INNER_DIR=$(dirname "$INNER")
    echo "       ${BLUE}·${NC} 扁平化目录结构..."
    if command -v rsync >/dev/null 2>&1; then
      rsync -a "$INNER_DIR/" "$INSTALL_DIR/" 2>/dev/null || true
    else
      mv "$INNER_DIR"/* "$INSTALL_DIR"/ 2>/dev/null || true
      mv "$INNER_DIR"/.* "$INSTALL_DIR"/ 2>/dev/null || true
    fi
    if [ "$INNER_DIR" != "$INSTALL_DIR" ]; then
      rm -rf "$INNER_DIR" 2>/dev/null || true
    fi
  fi
fi

if [ ! -f "$INSTALL_DIR/manifest.json" ]; then
  echo "${RED}❌ 解压后找不到 manifest.json${NC}"
  echo "   zip 可能损坏，请重新获取。"
  read -n 1
  exit 1
fi
echo "       ${GREEN}✓${NC} 解压完成"

# ====== 步骤 3：清除隔离标记（关键！）======
echo ""
echo "${YELLOW}[3/5]${NC} 清除 macOS 隔离标记（这是 Chrome 静默加载失败的常见原因）..."
xattr -cr "$INSTALL_DIR" 2>/dev/null || true
find "$INSTALL_DIR" -type f -exec xattr -d com.apple.quarantine {} \; 2>/dev/null || true
find "$INSTALL_DIR" -type d -exec xattr -d com.apple.quarantine {} \; 2>/dev/null || true

REMAINING=$(xattr -r "$INSTALL_DIR" 2>/dev/null | grep -c "com.apple.quarantine" 2>/dev/null || echo "0")
REMAINING=$(echo "$REMAINING" | tr -d '[:space:]')
if [ "$REMAINING" = "0" ]; then
  echo "       ${GREEN}✓${NC} 隔离标记已完全清除"
else
  echo "       ${YELLOW}⚠${NC} 仍有 $REMAINING 个文件有隔离标记"
  echo "         如果装完用不了，手动执行：xattr -cr '$INSTALL_DIR'"
fi

# ====== 步骤 4：自检 ======
echo ""
echo "${YELLOW}[4/5]${NC} 完整性自检..."
MISSING=""
REQUIRED=("manifest.json" "src/content.js" "src/navigator.js" "src/selectors.js" "icons/icon48.png")
for f in "${REQUIRED[@]}"; do
  if [ ! -e "$INSTALL_DIR/$f" ]; then
    MISSING="$MISSING $f"
  fi
done

if [ -n "$MISSING" ]; then
  echo "${RED}❌ 缺少关键文件：$MISSING${NC}"
  read -n 1
  exit 1
fi

VERSION=$(grep '"version"' "$INSTALL_DIR/manifest.json" | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
echo "       ${GREEN}✓${NC} 文件完整  ·  版本号：v${VERSION}"

# ====== 步骤 5：打开浏览器 + Finder ======
echo ""
echo "${YELLOW}[5/5]${NC} 打开 Finder + 浏览器扩展页..."
open "$INSTALL_DIR"

BROWSER_OPENED=""
for BROWSER in "Google Chrome" "Microsoft Edge" "Arc" "Brave Browser" "Chromium"; do
  if [ -d "/Applications/$BROWSER.app" ]; then
    case "$BROWSER" in
      "Google Chrome")     URL="chrome://extensions/" ;;
      "Microsoft Edge")    URL="edge://extensions/" ;;
      "Arc")               URL="arc://extensions/" ;;
      "Brave Browser")     URL="brave://extensions/" ;;
      "Chromium")          URL="chrome://extensions/" ;;
    esac
    sleep 1
    open -a "$BROWSER" "$URL" 2>/dev/null && { BROWSER_OPENED="$BROWSER"; break; }
  fi
done

if [ -z "$BROWSER_OPENED" ]; then
  echo "       ${YELLOW}⚠${NC} 没找到 Chrome/Edge/Arc/Brave，需手动打开："
  echo "         Chrome → chrome://extensions/"
  echo "         Edge   → edge://extensions/"
else
  echo "       ${GREEN}✓${NC} 已打开 $BROWSER_OPENED 扩展页"
fi

echo ""
echo "${GREEN}╭─────────────────────────────────────────────╮${NC}"
echo "${GREEN}│  ✅ 解压完成！请在浏览器按 3 步装好：        │${NC}"
echo "${GREEN}╰─────────────────────────────────────────────╯${NC}"
echo ""
echo "  ${BLUE}1.${NC}  扩展页右上角 → 打开「${YELLOW}开发者模式${NC}」开关"
echo ""
echo "  ${BLUE}2.${NC}  点「${YELLOW}加载已解压的扩展程序${NC}」按钮"
echo ""
echo "  ${BLUE}3.${NC}  选择这个目录（Finder 已帮你打开）："
echo "        ${YELLOW}$INSTALL_DIR${NC}"
echo ""
echo "${GREEN}  验证成功：${NC}访问 qlabel.qq.com 右下角出现深色工具栏"
echo ""
echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${YELLOW}装完没反应？${NC}"
echo "  1) 扩展卡片上的开关是否为${GREEN}绿色开启${NC}"
echo "  2) 刷新 QLabel 页面一次"
echo "  3) 按 F12 在控制台输入 ${BLUE}QLB.debug()${NC} 把输出发给开发者"
echo ""
echo "  反馈：${BLUE}825121444@qq.com${NC}"
echo ""
echo "${YELLOW}（按任意键关闭）${NC}"
read -n 1 -s
