#!/usr/bin/env node
/**
 * 命令行入口
 *   node scripts/scan.mjs [owner]                远程扫描 + 本地对照（默认）
 *   node scripts/scan.mjs --local-only           仅扫描本机 Git 仓库（不访问 GitHub），并入现有快照
 *   node scripts/scan.mjs --remote-only          仅远程扫描，跳过本地对照
 *   node scripts/scan.mjs --local-paths "a;b"    覆盖本地扫描根目录（分号分隔）
 *   node scripts/scan.mjs --depth 5              覆盖本地扫描深度
 *   node scripts/scan.mjs --render-only          不扫描，按现有快照重渲染面板（改样式/默认主题后用）
 *   node scripts/scan.mjs --help                 只看用法：不扫描、不联网、不改写任何产物
 * 未知 -- 参数一律报错退出，绝不静默落到全量扫描分支。
 * 页面内一键刷新请用：node scripts/server.mjs（或双击 启动面板.bat）
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { collectData, collectLocal, mergeLocalSnapshot, writeOutputs, printSummary, renderDashboard, HERE, readLocalConfig } from "./scan-core.mjs";
import { resolveCliArgs, CLI_USAGE } from "./shared.mjs";

const cli = resolveCliArgs(process.argv.slice(2), readLocalConfig());
if (cli.action === "help") {
  console.log(CLI_USAGE);
  process.exit(0);
}
if (cli.action === "unknown") {
  console.error("✖ 未知参数：" + cli.unknown.join(" "));
  console.error(CLI_USAGE);
  process.exit(2);
}
const { mode, owner: ownerArg, localPaths, depth, remoteOnly } = cli;

try {
  if (mode === "render") {
    const data = JSON.parse(readFileSync(join(HERE, "scan-data.json"), "utf8"));
    writeFileSync(join(HERE, "dashboard.html"), renderDashboard(data), "utf8");
    console.log("✔ 已按现有快照重新渲染 dashboard.html（未重新扫描）");
  } else if (mode === "local") {
    const localScan = await collectLocal({ roots: localPaths, depth });
    const data = mergeLocalSnapshot(localScan);
    writeOutputs(data, false, "cli-local");
    printSummary(data);
  } else {
    const data = await collectData(ownerArg, { local: !remoteOnly, roots: localPaths, depth });
    writeOutputs(data, true, "cli");
    printSummary(data);
  }
} catch (err) {
  console.error("✖ 执行失败：" + (err?.message ?? err));
  console.error("  请确认：1) 远程扫描需要 gh CLI 已登录（gh auth login）或设 GH_TOKEN；2) 本地扫描需要 git 在 PATH 中；3) Node 版本 ≥ 18。");
  process.exit(1);
}
