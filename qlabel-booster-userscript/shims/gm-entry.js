/**
 * gm-entry.js
 *
 * Tampermonkey 脚本主体入口（IIFE 外层包装）。
 * 构建流程：
 *   header.user.js  (Tampermonkey 元数据头)
 *   + gm-entry-open.js  (IIFE 开始 + GM_addStyle 注入 CSS)
 *   + shims/gm-shim.js  (chrome API → GM API)
 *   + src/selectors.js  ... (13 个原插件模块按依赖顺序)
 *   + gm-entry-close.js (IIFE 结束)
 *   = dist/qlabel-booster.user.js
 */
