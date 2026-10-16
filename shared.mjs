// shared.mjs —— 路径 / 本地配置 / 格式化共享基础（scan-core.mjs 与 render-dashboard.mjs 共用）
// NEXT 落地拆分（对应评估报告 P1-2）：将 HERE、本地扫描配置读写与大小格式化从 scan-core.mjs 抽出，
// 供取数核心与渲染模块共同引用，消除复制。
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));

// 仓库大小格式化（GitHub API 返回的单位为 KB）
export function fmtSize(kb) {
  if (!kb) return "—";
  if (kb < 1024) return kb + " KB";
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + " MB";
  return (mb / 1024).toFixed(2) + " GB";
}

/* ---------------- 本地扫描配置（scan-config.json；含本机路径，不入库） ---------------- */
export function readLocalConfig() {
  try { return JSON.parse(readFileSync(join(HERE, "scan-config.json"), "utf8")) ?? {}; } catch { return {}; }
}
export function writeLocalConfig(cfg) {
  writeFileSync(join(HERE, "scan-config.json"), JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
/* localOwnerOnly：默认 true —— 本地对照只保留当前 gh 登录账号名下的仓库；
   只有显式写成 false 才关闭（面板「只扫本账户」开关会写这个字段） */
export function ownerOnlyEnabled(cfg) {
  return (cfg && cfg.localOwnerOnly) !== false;
}
/* 默认扫描范围：用户主目录只看 1 层（覆盖 C:\Users\me\<repo> 式克隆）+ 桌面/文档/下载看完整深度 */
export function defaultLocalRoots() {
  const cfg = readLocalConfig();
  if (Array.isArray(cfg.localScanRoots) && cfg.localScanRoots.length) return cfg.localScanRoots;
  const home = homedir();
  const roots = [{ path: home, depth: 1 }];
  for (const name of ["Desktop", "Documents", "Downloads"]) {
    const p = join(home, name);
    if (existsSync(p)) roots.push(p);
  }
  return roots;
}

/* ---------------- 本地路径脱敏（快照入库前相对化，避免本机绝对路径进入公开仓库） ----------------
 * maskLocalPath：C:\Users\me\Repo → ~/Repo（仅当路径位于用户主目录下；其余路径原样保留）
 * unmaskLocalPath：~/Repo → C:\Users\me\Repo（服务端 /api/open 展开用）
 * 往返保证：unmask(mask(p)) === p（对主目录下路径成立）；非主目录路径不受影响。
 * 对应评估报告 R2 P1-3：scan-data.json / dashboard.html 快照内 local.path 均经此脱敏后再入库。 */
export function maskLocalPath(p) {
  if (!p) return p;
  const s = String(p);
  const home = homedir();
  const norm = (x) => x.replace(/[\\/]+$/, "").toLowerCase();
  const h = norm(home);
  const n = norm(s);
  if (n === h) return "~";
  if (n.startsWith(h + "\\") || n.startsWith(h + "/")) {
    return "~/" + s.slice(home.length).replace(/^[\\/]+/, "").replace(/\\/g, "/");
  }
  return s;
}

export function unmaskLocalPath(p) {
  if (!p) return p;
  const s = String(p);
  if (s === "~") return homedir();
  if (s.startsWith("~/") || s.startsWith("~\\")) return join(homedir(), s.slice(2));
  return s;
}

/* ---------------- 命令行参数解析（scan.mjs 入口专用，纯函数便于离线单测） ----------------
 * 为什么在这里而不是 scan.mjs 里：入口脚本被 import 即执行扫描，测试无法安全加载它。
 * 过去未知 `--` 参数被静默忽略并落入「远程+本地全量扫描」默认分支，于是 `--help` 这类
 * 用法探测会触发真实 GitHub 扫描并重写入库快照（scan-data.json / dashboard.html / …）。
 * 因此 help 与未知参数两条路径必须在任何扫描动作之前返回。 */
export const CLI_FLAGS = ["--render-only", "--local-only", "--remote-only", "--local-paths", "--depth"];

export const CLI_USAGE = [
  "用法：node scan.mjs [选项] [owner]",
  "  （无选项）             远程扫描 + 本地对照",
  "  --local-only           仅扫描本机 Git 仓库（不访问 GitHub），并入现有快照",
  "  --remote-only          仅远程扫描，跳过本地对照",
  "  --local-paths \"a;b\"    覆盖本地扫描根目录（分号分隔）",
  "  --depth N              覆盖本地扫描深度",
  "  --render-only          不扫描，按现有快照重渲染面板",
  "  --help, -h             显示本用法（不触发扫描）",
].join("\n");

/* 返回 { action: "help" } | { action: "unknown", unknown } | { action: "run", mode, owner, localPaths, depth, remoteOnly } */
export function resolveCliArgs(argv, cfg = {}) {
  const args = Array.isArray(argv) ? argv : [];
  if (args.includes("--help") || args.includes("-h")) return { action: "help" };
  const unknown = args.filter((a) => typeof a === "string" && a.startsWith("--") && !CLI_FLAGS.includes(a));
  if (unknown.length) return { action: "unknown", unknown };

  const renderOnly = args.includes("--render-only");
  const localOnly = args.includes("--local-only");
  const remoteOnly = args.includes("--remote-only");
  const pathsIdx = args.indexOf("--local-paths");
  const depthIdx = args.indexOf("--depth");
  const depth = depthIdx >= 0
    ? Number(args[depthIdx + 1])
    : (Number.isFinite(cfg.localScanDepth) ? cfg.localScanDepth : 4);
  const localPaths = pathsIdx >= 0
    ? String(args[pathsIdx + 1] ?? "").split(/[;；]/).map((s) => s.trim()).filter(Boolean)
    : undefined;
  const owner = args.find((a, i) =>
    !a.startsWith("--") &&
    (pathsIdx < 0 || i !== pathsIdx + 1) &&
    (depthIdx < 0 || i !== depthIdx + 1));

  return {
    action: "run",
    mode: renderOnly ? "render" : localOnly ? "local" : "scan",
    owner,
    localPaths,
    depth,
    remoteOnly,
  };
}

