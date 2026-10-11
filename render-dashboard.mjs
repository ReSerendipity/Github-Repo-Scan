// render-dashboard.mjs —— 面板渲染模块（从 scan-core.mjs 拆出，NEXT 落地对应评估报告 P1-2）
// 客户端应用独立存于 assets/dashboard-client.js（纯浏览器 JS），渲染时读取后注入 <script>，
// 避免约 1175 行客户端代码内嵌在服务端模板字面量中（消除外层模板转义风险面）。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HERE } from "./shared.mjs";

const CLIENT_APP = readFileSync(join(HERE, "assets", "dashboard-client.js"), "utf8");
/* ---------------- 面板渲染（内嵌数据 + 筛选搜索 + 排序 + 主题 + 扫描 + 趋势 + 配额） ---------------- */
export function renderDashboard(data) {
  const jsonStr = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>GitHub 仓库总览</title>
<style>
  :root, :root[data-theme="dark"] {
    --bg:#0d1117; --panel:#161b22; --border:#30363d; --rowborder:#21262d;
    --text:#e6edf3; --text2:#c9d1d9; --muted:#8b949e; --accent:#58a6ff;
    --ok:#3fb950; --fail:#f85149; --warn:#d29922; --hover:#151b23;
    color-scheme: dark;
  }
  :root[data-theme="light"] {
    --bg:#ffffff; --panel:#f6f8fa; --border:#d0d7de; --rowborder:#d8dee4;
    --text:#1f2328; --text2:#424a53; --muted:#656d76; --accent:#0969da;
    --ok:#1a7f37; --fail:#cf222e; --warn:#9a6700; --hover:#f6f8fa;
    color-scheme: light;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { background: var(--bg); }
  body {
    background: var(--bg); color: var(--text2);
    font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 14px; line-height: 1.55; -webkit-font-smoothing: antialiased;
    zoom: 1.25; /* 默认按 125% 显示（等效浏览器缩放），字体更大、表格更贴合宽屏 */
  }
  .container { max-width: 1320px; margin: 0 auto; padding: 36px 28px 56px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: var(--muted); }
  .sub { display: block; font-size: 12px; color: var(--muted); margin-top: 2px; }
  a.sub { color: var(--muted); }
  a.sub:hover { color: var(--accent); }

  header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  header img { width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--border); }
  h1 { font-size: 22px; font-weight: 600; color: var(--text); letter-spacing: .01em; }
  .scan-meta { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
  .controls { margin-left: auto; display: flex; gap: 10px; align-items: center; }
  .btn {
    display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px;
    border: 1px solid var(--border); border-radius: 6px; background: var(--panel);
    color: var(--text2); cursor: pointer; font-size: 13px; font-family: inherit;
  }
  .btn:hover { border-color: var(--accent); color: var(--accent); }
  .btn.primary { border-color: rgba(63,185,80,.55); }
  .btn.primary:hover { border-color: var(--ok); color: var(--ok); }
  .btn.icon { padding: 7px 9px; }
  .btn.scanning { opacity: .6; cursor: progress; }
  .btn.scanning .ico { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hint { min-height: 20px; font-size: 12.5px; color: var(--muted); margin-top: 12px; }
  .hint.okc { color: var(--ok); }
  .hint.err { color: var(--fail); }

  .metrics { display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0 20px; }
  .metric { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px 20px; min-width: 118px; }
  .metric .v { font-size: 22px; font-weight: 600; color: var(--text); }
  .metric .vsub { font-size: 13px; font-weight: 400; color: var(--muted); }
  .metric .k { font-size: 12px; color: var(--muted); margin-top: 2px; }

  .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 0 0 14px; }
  .toolbar input[type="search"], .toolbar select {
    background: var(--panel); border: 1px solid var(--border); color: var(--text2);
    border-radius: 6px; padding: 6px 10px; font-size: 13px; font-family: inherit;
  }
  .toolbar input[type="search"] { min-width: 230px; }
  .toolbar input:focus, .toolbar select:focus { outline: none; border-color: var(--accent); }
  /* 魔搭社区魔粒余额条（与 GitHub 扫描解耦的独立小组件） */
  .moli-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0 0 14px; padding: 8px 14px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; color: var(--muted); }
  .moli-bar .moli-val { font-size: 18px; font-weight: 700; color: var(--text); }
  .moli-bar .moli-val small { font-size: 12px; font-weight: 400; color: var(--muted); margin-left: 4px; }
  .moli-bar .moli-sep { color: var(--border); margin: 0 2px; }
  .moli-bar .moli-tag { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
  .moli-bar .spacer { flex: 1; }
  .moli-bar button { font-size: 12px; padding: 4px 12px; cursor: pointer; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 6px; font-family: inherit; }
  .moli-bar button:hover { border-color: var(--accent); color: var(--accent); }
  .moli-bar.err { color: #d97757; }
  .moli-bar code { font-family: Consolas, "Cascadia Mono", monospace; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; }
  .chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); cursor: pointer; }
  .chk input { accent-color: var(--accent); }
  .views-box { display: inline-flex; gap: 6px; align-items: center; }
  .views-box select {
    background: var(--panel); border: 1px solid var(--border); color: var(--text2);
    border-radius: 6px; padding: 6px 10px; font-size: 13px; font-family: inherit; max-width: 190px;
  }
  .badge.info { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .badge.info .dot { background: var(--accent); }
  .badge.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); background: color-mix(in srgb, var(--warn) 8%, transparent); }
  .badge.warn .dot { background: var(--warn); }
  .modes { display: inline-flex; gap: 6px; }
  .modes .btn.on { border-color: var(--accent); color: var(--accent); }
  .local-box { border: 1px solid var(--border); border-radius: 8px; margin-top: 16px; background: var(--bg); overflow: hidden; }
  .local-box .panel-title { padding: 11px 14px; font-size: 12.5px; font-weight: 600; color: var(--text); background: var(--panel); border-bottom: 1px solid var(--border); }
  .local-scroll { overflow-x: auto; }
  .local-table { width: 100%; border-collapse: collapse; min-width: 860px; }
  .local-table tbody td { padding: 10px 14px; border-top: 1px solid var(--rowborder); vertical-align: top; }
  .local-table tbody tr:hover { background: var(--hover); }
  .local-table tbody tr:first-child td { border-top: none; }
  .path { font-family: Consolas, "Cascadia Mono", monospace; font-size: 12px; color: var(--muted); max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dirty { color: var(--warn); }
  .badge.local-ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 8%, transparent); }
  .badge.local-ok .dot { background: var(--ok); }
  .toolbar .spacer { flex: 1; }
  .toolbar .tscale { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .toolbar .tscale input[type="range"] { width: 110px; min-width: 110px; }
  .toolbar .tscale b { min-width: 42px; text-align: right; font-weight: 600; color: var(--text); font-size: 12px; }
  .local-open { color: var(--accent); }
  .local-open:hover { text-decoration: underline; }
  td.path a.local-open { color: var(--accent); }

  .scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); position: relative; }
  table { width: 100%; border-collapse: collapse; min-width: 1340px; }
  thead th {
    position: sticky; top: 0; background: var(--panel); color: var(--muted);
    font-size: 12px; font-weight: 600; letter-spacing: .05em; text-align: left;
    padding: 11px 14px; border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  th.sortable { cursor: pointer; user-select: none; }
  th.sortable:hover { color: var(--accent); }
  th.sortable.active { color: var(--text); }
  th .arr { margin-left: 3px; font-size: 10px; }
  tbody td { padding: 12px 14px; border-top: 1px solid var(--rowborder); vertical-align: top; }
  tbody tr:hover { background: var(--hover); }
  tbody tr:first-child td { border-top: none; }
  td.empty { text-align: center; color: var(--muted); padding: 40px 0; }
  td.repo { min-width: 260px; max-width: 380px; }
  .repo-name { font-weight: 600; font-size: 14.5px; }
  .desc {
    font-size: 12px; color: var(--muted); margin-top: 3px;
    max-width: 340px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .tag {
    display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px;
    font-size: 11px; border: 1px solid var(--border); color: var(--muted); vertical-align: 2px;
  }
  .tag.warn { color: var(--warn); border-color: var(--warn); }
  .branch-type { display: inline-block; margin-right: 5px; padding: 0 6px; border-radius: 999px; font-size: 11px; border: 1px solid var(--border); color: var(--muted); vertical-align: 1px; white-space: nowrap; }
  .branch-type.loc { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 8%, transparent); }
  .branch-type.rem { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
  /* 主表固定列宽布局：列宽由表头决定、表格总宽有界，长文字在单元格内省略（不再把表格撑爆/文字被边框切掉） */
  .main-table { table-layout: fixed; width: 100%; min-width: 1495px; }
  .main-table th { box-sizing: border-box; }
  .main-table tbody td { padding-left: 10px; padding-right: 10px; }
  .main-table th:nth-child(1) { width: 126px; }
  .main-table th:nth-child(2) { width: 58px; }
  .main-table th:nth-child(3) { width: 106px; }
  .main-table th:nth-child(4) { width: 58px; }
  .main-table th:nth-child(5) { width: 88px; }
  .main-table th:nth-child(6) { width: 96px; }
  .main-table th:nth-child(7) { width: 88px; }
  .main-table th:nth-child(8) { width: 56px; }
  .main-table th:nth-child(9) { width: 135px; }
  .main-table th:nth-child(10) { width: 218px; }
  .main-table th:nth-child(11) { width: 48px; }
  .main-table th:nth-child(12) { width: 48px; }
  .main-table th:nth-child(13) { width: 64px; }
  .main-table th:nth-child(14) { width: 56px; }
  .main-table th:nth-child(15) { width: 56px; }
  .main-table th:nth-child(16) { width: 78px; }
  .main-table th:nth-child(17) { width: 58px; }
  .main-table th:nth-child(18) { width: 58px; }
  /* 列宽拖拽手柄：拖动表头分隔线调整列宽（sticky 表头本身即定位上下文） */
  .main-table th .col-resizer { position: absolute; right: -3px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 6; }
  .main-table th .col-resizer:hover { background: rgba(127, 127, 127, .22); }
  /* 列拖拽重排：拖表头文字移动整列，竖线提示插入位置 */
  .main-table th.col-dragging { opacity: .45; box-shadow: 0 2px 12px rgba(0, 0, 0, .25); }
  #colGuide { position: absolute; top: 0; bottom: 0; width: 3px; background: var(--accent); pointer-events: none; z-index: 50; display: none; box-shadow: 0 0 6px rgba(0, 0, 0, .35); }
  .main-table td { overflow: hidden; }
  .main-table td.repo { overflow: hidden; }
  .main-table .repo-name { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  /* 单行短列：超出省略号截断，悬停看全值 */
  .main-table td.num, .main-table td.lang, .main-table td.vis, .main-table td.lic, .main-table td.score { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 分支列文字适配：长分支名单行省略 + 悬停查看全名（固定布局下生效，列宽来自表头） */
  td.branch-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge {
    display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px;
    border-radius: 999px; font-size: 12px; border: 1px solid var(--border);
    color: var(--muted); white-space: nowrap;
  }
  a.badge:hover { text-decoration: none; filter: brightness(1.15); }
  .badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; }
  .badge.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 8%, transparent); }
  .badge.ok .dot { background: var(--ok); }
  .badge.fail { color: var(--fail); border-color: color-mix(in srgb, var(--fail) 45%, transparent); background: color-mix(in srgb, var(--fail) 8%, transparent); }
  .badge.fail .dot { background: var(--fail); }
  .badge.running { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); background: color-mix(in srgb, var(--warn) 8%, transparent); }
  .badge.running .dot { background: var(--warn); }
  .trend { display: inline-flex; gap: 3px; margin-top: 5px; }
  .tdot { width: 7px; height: 7px; border-radius: 50%; background: var(--border); display: inline-block; }
  .tdot.ok { background: var(--ok); }
  .tdot.fail { background: var(--fail); }
  .tdot.run { background: var(--warn); }
  .pair { display: flex; flex-direction: column; gap: 3px; }
  .pair a { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); }
  .pair a:hover { color: var(--accent); text-decoration: none; }
  .lang { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .ldot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  td.num { white-space: nowrap; }
  .notice { font-size: 12.5px; color: var(--warn); margin: 0 0 14px; }
  footer { margin-top: 18px; font-size: 12px; color: var(--muted); line-height: 1.8; }
  footer code { font-family: Consolas, "Cascadia Mono", monospace; background: var(--panel); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; }
  #footExtra strong { color: var(--text2); font-weight: 600; }

  .scorebar { height: 4px; border-radius: 3px; background: var(--rowborder); margin-top: 6px; overflow: hidden; width: 76px; }
  .scorebar > i { display: block; height: 100%; border-radius: 3px; }
  .filetoggle { background: var(--panel); border: 1px solid var(--border); color: var(--text2); border-radius: 999px; padding: 2px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
  .filetoggle:hover { border-color: var(--accent); color: var(--accent); }
  .filelist { margin-top: 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); max-height: 168px; overflow-y: auto; padding: 6px 8px; }
  .filelist .fi { display: flex; align-items: center; gap: 7px; font-size: 12px; padding: 2px 0; font-family: Consolas, "Cascadia Mono", monospace; }
  .filelist .st { width: 18px; text-align: center; font-weight: 700; flex: none; }
  .filelist .st.add { color: var(--ok); }
  .filelist .st.mod { color: var(--warn); }
  .filelist .st.del { color: var(--fail); }
  .filelist .fn { color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .filelist .num { margin-left: auto; color: var(--muted); flex: none; font-size: 11px; }
  .sz { white-space: nowrap; }

  .alert-box { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
  .alert-box:empty { display: none; }
  .alert-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel); color: var(--text2); font-size: 13px; cursor: pointer; font-family: inherit; }
  .alert-chip:hover { border-color: var(--accent); color: var(--accent); }
  .alert-chip .n { font-weight: 700; color: var(--text1); }
  .alert-chip.fail { border-color: var(--fail); }
  .alert-chip.fail .n { color: var(--fail); }
  .alert-chip.warn { border-color: var(--warn); }
  .alert-chip.warn .n { color: var(--warn); }
  .alert-chip.ok { border-color: var(--ok); }
  .alert-chip.ok .n { color: var(--ok); }
  .alert-box .lbl { color: var(--muted); font-size: 13px; align-self: center; margin-right: 2px; }

  .lang-box { display: flex; flex-wrap: wrap; gap: 10px 18px; margin: 0 0 14px; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); }
  .lang-box:empty { display: none; }
  .lang-box .lbl { color: var(--muted); font-size: 13px; align-self: center; }
  .lang-row { display: flex; flex-direction: column; gap: 4px; min-width: 150px; }
  .lang-row .top { display: flex; justify-content: space-between; font-size: 13px; }
  .lang-row .nm { color: var(--text1); font-weight: 600; }
  .lang-row .ct { color: var(--text2); }
  .lang-row .bar { height: 6px; border-radius: 4px; background: var(--rowborder); overflow: hidden; }
  .lang-row .bar > i { display: block; height: 100%; border-radius: 4px; }
  .lang-row .rk { color: var(--accent); font-weight: 700; margin-right: 6px; }
  .lang-row a.nm { color: var(--text1); font-weight: 600; text-decoration: none; }
  .lang-row a.nm:hover { color: var(--accent); text-decoration: underline; }
  .rank-metric { background: var(--bg); border: 1px solid var(--border); color: var(--text2); border-radius: 999px; padding: 2px 10px; font-size: 12px; cursor: pointer; font-family: inherit; margin-left: 4px; }
  .rank-metric:hover { border-color: var(--accent); color: var(--accent); }
  .rank-metric.on { border-color: var(--accent); color: var(--accent); font-weight: 700; }

  /* 聚合视图可折叠 */
  .agg-wrap { border: 1px solid var(--border); border-radius: 12px; background: var(--panel); margin: 0 0 14px; overflow: hidden; }
  .agg-head { display: flex; align-items: center; }
  .agg-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 16px; background: transparent; border: none; cursor: pointer; font-family: inherit; color: var(--text1); font-size: 14px; font-weight: 600; }
  .agg-toggle:hover { color: var(--accent); }
  .agg-toggle .chev { display: inline-block; transition: transform .18s ease; font-size: 12px; }
  .agg-wrap.collapsed .chev { transform: rotate(-90deg); }
  .agg-body { padding: 0 16px 14px; }
  .agg-wrap.collapsed .agg-body { display: none; }
  .agg-wrap .alert-box, .agg-wrap .lang-box { border: none; background: transparent; padding: 0; margin: 0 0 12px; }
  .agg-wrap .metrics { margin-bottom: 12px; }

  /* Star 周增长趋势（红涨绿跌，遵循 A 股惯例；类名用 swtrend，避免与 CI 趋势点阵的 .trend 冲突） */
  .swtrend { font-weight: 700; font-size: 12px; white-space: nowrap; }
  .swtrend.up { color: var(--fail); }
  .swtrend.down { color: var(--ok); }
  .swtrend.flat { color: var(--muted); }
</style>
</head>
<body>
<div class="container">
  <header>
    <img id="avatar" alt="" style="display:none">
    <div>
      <h1 id="title">GitHub 仓库总览</h1>
      <div class="scan-meta" id="scanMeta">正在载入数据…</div>
    </div>
    <div class="controls">
      <button id="scanBtn" class="btn primary" type="button" title="先探测仓库有无变更，只对变更仓库深度扫描（无变更秒级返回）；按住 Shift 点击 = 强制全量扫描。需本地服务已启动：node server.mjs"><span class="ico"></span><span class="lbl">重新扫描</span></button>
      <button id="scanLocalBtn" class="btn" type="button" title="只扫描本机 Git 仓库并对照/列出（不访问 GitHub，需本地服务）"><span class="ico2"></span><span class="lbl">仅扫本地</span></button>
      <button id="csvBtn" class="btn" type="button" title="导出当前筛选/排序结果为 CSV（Excel 可直接打开，带 UTF-8 BOM）">导出 CSV</button>
      <button id="cloneBtn" class="btn" type="button" title="复制当前可见仓库的 git clone 命令到剪贴板">复制 clone</button>
      <button id="themeBtn" class="btn icon" type="button" title="切换明暗主题" aria-label="切换明暗主题"></button>
    </div>
  </header>
  <div class="moli-bar" id="moliBar" title="魔搭社区（ModelScope）魔粒余额，来自 /openapi/v1/magicubes/balance">
    <span class="moli-tag">魔搭魔粒</span>
    <span id="moliBody">载入中…</span>
    <span class="spacer"></span>
    <button id="moliRefresh" type="button" title="重新拉取魔粒余额（走 ModelScope 接口）">刷新</button>
  </div>
  <div class="hint" id="scanHint"></div>

  <div class="agg-wrap" id="aggWrap">
    <div class="agg-head">
      <button class="agg-toggle" id="aggToggle" type="button" aria-expanded="true" title="折叠/展开聚合视图（偏好记入浏览器本地）">
        <span class="chev" id="aggChev">▾</span>
        <span>聚合视图（点击折叠/展开）</span>
      </button>
    </div>
    <div class="agg-body" id="aggBody">
      <div class="metrics" id="metrics"></div>
      <div class="alert-box" id="alertBox"></div>
      <div class="lang-box" id="langBox"></div>
      <div class="lang-box" id="rankBox"></div>
      <div class="lang-box" id="archivedBox"></div>
    </div>
  </div>

  <div class="toolbar">
    <input id="q" type="search" placeholder="搜索仓库名 / 描述…">
    <select id="fLang" title="按语言筛选"><option value="">全部语言</option></select>
    <select id="fStatus" title="按状态筛选">
      <option value="">全部状态</option>
      <option value="ok">CI 通过</option>
      <option value="fail">CI 失败</option>
      <option value="running">CI 运行中</option>
      <option value="none">无 CI 记录</option>
      <option value="pub">仅公开仓库</option>
      <option value="priv">仅私有仓库</option>
      <option value="hasIssue">有开放 Issue</option>
      <option value="noLic">未声明许可证</option>
      <option value="lowScore">仅低健康分(&lt;50)</option>
      <option value="noLocal">本地缺失</option>
      <option value="dirtyLocal">本地有未提交改动</option>
      <option value="aheadLocal">本地与远程不一致</option>
      <option value="archived">仅归档仓库</option>
    </select>
    <span class="modes" id="modeBox" style="display:none">
      <button id="modeBoth" class="btn on" type="button" title="远程扫描结果 + 每仓本地对照状态">远程+本地对照</button>
      <button id="modeLocal" class="btn" type="button" title="只看本机 Git 仓库（含远程账号名下没有的）">仅本地仓库</button>
    </span>
    <button id="cfgBtn" class="btn" type="button" title="设置本地扫描根目录（分号分隔），保存到 scan-config.json，下次扫描生效">本地目录…</button>
    <label class="chk"><input type="checkbox" id="fNoFork">隐藏 fork</label>
    <label class="chk"><input type="checkbox" id="fNoArchived">隐藏归档</label>
    <label class="chk"><input type="checkbox" id="fAutoScanStart" title="开启后，启动面板会先自动扫描（约 20–40 秒）再打开页面；可在 scan-config.json 设 stale/always/off">启动前扫描</label>
    <label class="chk"><input type="checkbox" id="fOwnerOnly" checked title="开启后本地对照只保留当前 gh 登录账号名下的仓库；关闭后本机所有 Git 仓库（含第三方克隆）都会算进本地对照与「本地独有」">只扫本账户</label>
    <span class="spacer"></span>
    <span class="views-box">
      <select id="fView" title="自定义视图 = 当前搜索/筛选/排序的命名快照"><option value="">视图:手动状态</option></select>
      <button id="viewSave" class="btn" type="button" title="把当前筛选与排序保存为命名视图">＋存视图</button>
      <button id="viewDel" class="btn" type="button" title="删除当前选中的视图">删</button>
    </span>
    <label class="chk">自动刷新
      <select id="auto" title="定时自动重新扫描（消耗 GitHub API 配额）">
        <option value="0">关闭</option>
        <option value="10">每 10 分钟</option>
        <option value="30">每 30 分钟</option>
        <option value="60">每 60 分钟</option>
      </select>
    </label>
    <label class="tscale" title="整体缩放主表：调小减少横向滚动、调大更清晰（叠加在页面 125% 上，自动记住）">
      <span>表格大小</span>
      <input type="range" id="tableScale" min="60" max="160" step="5" value="100">
      <b id="tableScaleVal">100%</b>
    </label>
  </div>

  <div class="notice" id="truncNotice" style="display:none"></div>

  <div class="scroll" id="mainScroll">
    <table class="main-table">
      <thead>
        <tr>
          <th class="sortable" data-key="name" title="点击按仓库名排序">仓库<span class="arr" data-arr="name"></span></th>
          <th class="sortable" data-key="visibility" title="点击按可见性排序（私有优先）">可见性<span class="arr" data-arr="visibility"></span></th>
          <th class="sortable" data-key="local" title="点击按本地状态排序（降序 = 本地异常优先）">本地<span class="arr" data-arr="local"></span></th>
          <th class="sortable" data-key="score" title="健康分 = CI 40 + 新鲜度 30 + Issue 卫生 15 + 发布节奏 15(归档仓打七折)">健康<span class="arr" data-arr="score"></span></th>
          <th class="sortable" data-key="ci" title="点击按 CI 状态排序（降序 = 问题优先）">CI/CD 状态<span class="arr" data-arr="ci"></span></th>
          <th class="sortable" data-key="license" title="点击按许可证排序">许可证<span class="arr" data-arr="license"></span></th>
          <th class="sortable" data-key="cli" title="点击按 CLI 形态排序（CLI / 脚本集 / 无；本地克隆仓按本地检测，悬停看依据）">CLI<span class="arr" data-arr="cli"></span></th>
          <th class="sortable" data-key="release" title="点击按最新发布时间排序">最新 Release<span class="arr" data-arr="release"></span></th>
          <th class="sortable" data-key="issues" title="点击按开放 Issue 数排序">Issue<span class="arr" data-arr="issues"></span></th>
          <th class="sortable" data-key="branches" title="点击按分支数排序（GitHub 远程分支）">远程分支<span class="arr" data-arr="branches"></span></th>
          <th class="sortable" data-key="localBranch" title="点击按本地分支排序（本机检出的本地分支 + 其远程跟踪分支；本地缺失沉底）">本地分支<span class="arr" data-arr="localBranch"></span></th>
          <th class="sortable" data-key="stars" title="点击按 Star 数排序">Star<span class="arr" data-arr="stars"></span></th>
          <th class="sortable" data-key="forks" title="点击按 Fork 数排序">Fork<span class="arr" data-arr="forks"></span></th>
          <th class="sortable" data-key="language" title="点击按语言排序">语言<span class="arr" data-arr="language"></span></th>
          <th class="sortable" data-key="size" title="点击按仓库大小排序（GitHub 返回的磁盘占用，单位 KB）">大小<span class="arr" data-arr="size"></span></th>
          <th class="sortable" data-key="traffic" title="点击按近 14 天浏览量排序(设 SCAN_WITH_TRAFFIC=1 开启采集)">流量<span class="arr" data-arr="traffic"></span></th>
          <th class="sortable" data-key="files" title="点击按最近一次提交变更文件数排序（点「N 文件」展开详情）">最近变更<span class="arr" data-arr="files"></span></th>
          <th class="sortable" data-key="pushedAt" title="点击按最近推送排序">最近推送<span class="arr" data-arr="pushedAt"></span></th>
          <th class="sortable" data-key="createdAt" title="点击按创建时间排序">创建时间<span class="arr" data-arr="createdAt"></span></th>
        </tr>
      </thead>
      <tbody id="tbody"><tr><td class="empty" colspan="17">正在载入…</td></tr></tbody>
    </table>
  </div>

  <div class="local-box" id="localOnlyBox" style="display:none"></div>

  <footer>
    <div id="footExtra"></div>
    数据为扫描时快照：页面内点「重新扫描」可原地更新（需启动本地服务 <code>node server.mjs</code>），或命令行 <code>node scan.mjs</code>（<code>--render-only</code> 仅重渲染）·
    排序：点击表头，再点一次切换升降序（选择会记住）· 健康分：CI 40 + 新鲜度 30 + Issue 卫生 15 + 发布节奏 15 · 视图：「＋存视图」保存当前筛选与排序 · 主题：右上角切换（默认浅色）·
    CI 取最近一次 Actions 运行（任意分支/标签）· Issue 数不含 PR（PR 单列）· 远程分支数为 GitHub 上全部分支（不含 tag）·
    表格内每个单元格都链接到对应的 GitHub 页面 · 本地对照列：本机有对应 Git 仓库时显示本地/远程分支（本地 = 当前检出分支，远程 = 其远程跟踪分支）与工作区状态（干净 / 未提交 n / ↑领先 ↓落后，基于本地缓存的远程 refs，不自动 fetch），扫描范围用「本地目录…」或 <code>scan-config.json</code> 调整 · 「仅本地仓库」模式在下方列出全部本机仓库（含远程账号名下没有的「本地独有」仓库）· <strong>可见性</strong>列可点表头按公开/私有排序，筛选下拉含「仅公开 / 仅私有」· <strong>大小</strong>列为 GitHub 磁盘占用（KB/MB/GB）· <strong>最近变更</strong>列点「N 文件」展开最近一次提交的文件清单（A 增 / M 改 / D 删，带 +− 行数）· 工具栏「隐藏归档」「启动前扫描」「只扫本账户」可记忆式开关 · 右上角「导出 CSV」导出当前视图（UTF-8，Excel 可直接打开）· 「仅低健康分(&lt;50)」可快速定位问题仓库。
  </footer>
</div>

<script>
window.__SCAN_DATA__ = ${jsonStr};
</script>
<script>${CLIENT_APP}</script>
</body>
</html>
`;
}
