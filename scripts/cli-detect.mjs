// cli-detect.mjs —— D3 CLI 三态检测（从 scan-core.mjs 外提，债 #9 第二步）
//
// 边界（docs/module-boundaries.md）：
// - BM-1：本模块**不触网**、不调 `gh` / `git`，只读本地文件树；
// - 纯叶子模块：不 import scan-core（避免环），scan-core 单向 import 后原样 re-export；
//   外部消费者（scan.mjs / server.mjs / tests）继续从 scan-core 取符号，不要直接 import 本模块（保持 25 个符号的入口不变）。
//
// 三态口径：CLI = 有正式命令行入口（manifest bin/entry_points 或 cli 命名入口文件）；
// 脚本集 = scripts|tools|bin|cmd 目录承载命令行脚本但无统一入口；无 = 检测不到交互面。
// 本地有克隆的仓优先本地检测（更新鲜），远程-only 仓走文件树 + 清单（pushedAt 未变复用快照）。
// gradlew / vitepress build 之类构建工具链不算仓库自有 CLI。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLI_SKIP_DIRS = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build",
  "target", ".gradle", ".idea", ".vscode", "site", ".vitepress", "output", "outputs", "vendor",
  "third_party", "coverage", "test-results", "playwright-report", "_archive", "backups", "logs", "data"]);
const CLI_MANIFESTS = ["package.json", "pyproject.toml", "setup.py", "setup.cfg", "Cargo.toml"];
// 根目录清单名单也是 D3 的口径数据：scan-core 的 collectData 要按它决定"拉哪几份 contents"，
// 所以这里 export（口径只留一份），但**不作为门面符号**再导出给外部消费者。
export { CLI_MANIFESTS };const CLI_ENTRY_FILE = /(^|\/)(cli|__main__|entrypoint|entry_point|console)\.(py|js|ts|mjs|cjs|go)$/i;
const CLI_SCRIPT_DIR = /^(scripts|tools|bin|cmd)\/[^/]+$/.source;

export function manifestCliDetail(name, text) {
  try {
    if (name === "package.json") {
      const bin = JSON.parse(text).bin;
      if (!bin) return null;
      return typeof bin === "string" ? "package.json bin" : "package.json bin: " + Object.keys(bin).slice(0, 3).join(", ");
    }
    if (name === "pyproject.toml") {
      const m = text.match(/\[project\.scripts\]([^\[]*)/);
      if (m && m[1].trim()) {
        const keys = m[1].split("\n").map((l) => l.split("=")[0].trim()).filter(Boolean).slice(0, 3).join(", ");
        return "pyproject scripts: " + keys;
      }
      const m2 = text.match(/\[tool\.poetry\.scripts\]([^\[]*)/);
      return m2 && m2[1].trim() ? "poetry scripts" : null;
    }
    if (name === "setup.py") return /console_scripts|entry_points\s*=/.test(text) ? "setup.py entry_points" : null;
    if (name === "setup.cfg") return /console_scripts/.test(text) ? "setup.cfg console_scripts" : null;
    if (name === "Cargo.toml") return /\[\[bin\]\]/.test(text) ? "Cargo [[bin]]" : null;
  } catch { /* 解析失败按未命中处理 */ }
  return null;
}

export function classifyCli({ hasEntry, entryDetail, hasScriptDir }) {
  if (hasEntry) return { state: "CLI", detail: entryDetail || null };
  if (hasScriptDir) return { state: "脚本集", detail: null };
  return { state: "无", detail: null };
}

export function detectCliLocal(dir) {
  let hasEntry = false, entryDetail = null, hasScriptDir = false;
  let rootNames = [];
  try { rootNames = readdirSync(dir); } catch { return { state: "无", detail: null, src: "local" }; }
  for (const mf of CLI_MANIFESTS) {
    if (!rootNames.includes(mf)) continue;
    let text = "";
    try { text = readFileSync(join(dir, mf), "utf8"); } catch { continue; }
    const d = manifestCliDetail(mf, text);
    if (d) { hasEntry = true; entryDetail = d; }
  }
  const walk = (rel, depth) => {
    let items = [];
    try { items = readdirSync(join(dir, rel)); } catch { return; }
    for (const it of items) {
      if (it.startsWith(".")) continue;
      const r = rel ? rel + "/" + it : it;
      let st = null;
      try { st = statSync(join(dir, r)); } catch { continue; }
      if (st.isDirectory()) {
        if (CLI_SKIP_DIRS.has(it)) continue;
        if (it === "scripts" || it === "tools" || it === "bin" || it === "cmd") {
          hasScriptDir = true;
          if (depth < 2) walk(r, depth + 1); // 进入脚本目录查找 cli 命名入口（如 scripts/ops.py / agent_cli.py），命中则升级为 CLI
        }
        if (depth < 2) walk(r, depth + 1);
      } else if (CLI_ENTRY_FILE.test(r)) {
        if (!hasEntry) entryDetail = "入口文件: " + r;
        hasEntry = true;
      }
    }
  };
  walk("", 0);
  const c = classifyCli({ hasEntry, entryDetail, hasScriptDir });
  return { state: c.state, detail: c.detail, src: "local" };
}

export function detectCliRemote(paths, manifests) {
  let hasEntry = false, entryDetail = null;
  for (const p of paths || []) {
    if (CLI_ENTRY_FILE.test(p)) { entryDetail = "入口文件: " + p; hasEntry = true; break; }
  }
  if (!hasEntry) {
    for (const mf of Object.keys(manifests || {})) {
      const d = manifestCliDetail(mf, manifests[mf]);
      if (d) { entryDetail = d; hasEntry = true; break; }
    }
  }
  const hasScriptDir = !hasEntry && (paths || []).some((p) => new RegExp(CLI_SCRIPT_DIR).test(p));
  const c = classifyCli({ hasEntry, entryDetail, hasScriptDir });
  return { state: c.state, detail: c.detail, src: "remote" };
}
