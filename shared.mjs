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
