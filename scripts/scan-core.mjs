// scan-core.mjs —— 扫描/取数/合并共享核心（scan.mjs 命令行 与 server.mjs 本地服务共用）
// v2：并行扫描 / 仓库分页 / CI 趋势 / API 配额 / 许可证链接增量复用 / schema 2
// v3：渲染与客户端应用拆至 render-dashboard.mjs + assets/dashboard-client.js，路径/配置/格式化拆至 shared.mjs
import { writeFileSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import { HERE, fmtSize, readLocalConfig, writeLocalConfig, ownerOnlyEnabled, defaultLocalRoots, maskLocalPath, unmaskLocalPath } from "./shared.mjs";
import { renderDashboard } from "./render-dashboard.mjs";
import { execFileP, pool, applyJq, directApi, setHttpsTransport, ghAsync } from "./github-fetch.mjs";

export { HERE, fmtSize, readLocalConfig, writeLocalConfig, ownerOnlyEnabled, defaultLocalRoots, maskLocalPath, unmaskLocalPath, renderDashboard };
export { execFileP, pool, applyJq, directApi, setHttpsTransport, ghAsync };
// 置 SCAN_WITH_TRAFFIC=1 时额外拉取每仓近 14 天流量（views/clones，各 +1 次 REST 调用，需 push 权限）
const WITH_TRAFFIC = process.env.SCAN_WITH_TRAFFIC === "1";

/* ---------------- 本地 Git 仓库扫描（读本机 .git，不联网、不依赖 gh） ---------------- */
const SKIP_DIRS = new Set([
  "node_modules", "venv", ".venv", "__pycache__", "site-packages", "dist", "build",
  "target", ".next", ".nuxt", ".gradle", ".m2", ".cargo", ".rustup", ".idea", ".vs",
  "$recycle.bin", "system volume information",
]);

/* 解析远程 URL → { host, owner, repo, isGitHub }；支持 https / git / ssh / scp 风格 */
export function parseRemoteUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  let m = s.match(/^(?:ssh:\/\/)?git@([^\/:]+)[:\/](.+?)(?:\.git)?\/?$/i);
  if (!m) m = s.match(/^(?:https?|git|ssh):\/\/(?:[^@\/]+@)?([^\/:]+(?::\d+)?)\/(.+?)(?:\.git)?\/?$/i);
  if (!m) return null;
  const host = m[1].toLowerCase().replace(/:\d+$/, "");
  const parts = m[2].split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { host, owner: parts[0], repo: parts[1], isGitHub: host === "github.com" || host.endsWith(".github.com") };
}

/* 递归找 .git：depth 为根目录下的最大层数；跳过隐藏目录与常见重目录；不跟进符号链接与仓库内部 */
export function findGitRepos(roots, depth = 4, maxRepos = 500) {
  const out = [];
  const seen = new Set();
  const norm = (p) => String(p).replace(/[\\/]+$/, "").toLowerCase();
  const push = (p) => {
    const k = norm(p);
    if (seen.has(k) || out.length >= maxRepos) return;
    seen.add(k);
    out.push(p);
  };
  const walk = (dir, d, maxD) => {
    if (out.length >= maxRepos) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.name.toLowerCase() === ".git")) { push(dir); return; }
    if (d >= maxD) return;
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink()) continue;
      const n = e.name;
      if (n.startsWith(".") || SKIP_DIRS.has(n.toLowerCase())) continue;
      walk(join(dir, n), d + 1, maxD);
    }
  };
  for (const root of roots ?? []) {
    const p = typeof root === "string" ? root : (root && root.path);
    if (!p || !existsSync(p)) continue;
    const dd = (typeof root === "object" && Number.isFinite(root.depth)) ? root.depth : depth;
    walk(p, 0, dd);
  }
  return out;
}

async function gitOne(repoPath, args, timeoutMs = 12000) {
  const { stdout } = await execFileP("git", ["-C", repoPath, ...args], { maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs, windowsHide: true });
  return stdout.trim();
}

/* 读取单个本地仓库：远程 URL / 本地分支 + 远程跟踪分支 / HEAD / 脏状态 / 领先落后（基于本地缓存的 remote refs，不 fetch） */
export async function gitInfoFor(repoPath) {
  const info = {
    path: repoPath, name: repoPath.split(/[\\/]/).filter(Boolean).pop() ?? repoPath,
    remoteUrl: null, remotes: [], github: null, branch: null, upstream: null, head: null,
    localBranches: [], remoteBranches: [], lastCommitAt: null, dirty: false, dirtyCount: 0, ahead: null, behind: null,
    bare: false, error: null,
  };
  try {
    try { info.bare = (await gitOne(repoPath, ["rev-parse", "--is-bare-repository"])) === "true"; } catch { /* 按非 bare 处理 */ }
    try {
      const out = await gitOne(repoPath, ["remote", "-v"]);
      const seen = new Map();
      for (const line of out.split("\n")) {
        const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
        if (m && !seen.has(m[1])) seen.set(m[1], m[2]);
      }
      info.remotes = [...seen].map(([name, url]) => ({ name, url }));
      const pick = seen.get("origin") ?? [...seen.values()][0] ?? null;
      info.remoteUrl = pick;
      const p = parseRemoteUrl(pick);
      if (p) info.github = { owner: p.owner, repo: p.repo, host: p.host, isGitHub: p.isGitHub };
    } catch { /* 无远程也算正常仓库 */ }
    try { info.branch = (await gitOne(repoPath, ["branch", "--show-current"])) || null; } catch { /* ignore */ }
    if (!info.branch) {
      try {
        info.branch = (await gitOne(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"])) || null;
        if (info.branch === "HEAD") info.branch = "(detached)";
      } catch { /* ignore */ }
    }
    if (info.branch && !/^\(/.test(info.branch)) {
      try { info.upstream = (await gitOne(repoPath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])) || null; } catch { /* 当前分支无远程跟踪分支（未 push / 纯本地分支） */ }
    }
    // 全部分支名单：本地分支（refs/heads）+ 远程跟踪分支（refs/remotes），供面板悬停查看
    try { info.localBranches = (await gitOne(repoPath, ["for-each-ref", "--format=%(refname:short)", "refs/heads"])).split("\n").filter(Boolean); } catch { /* ignore */ }
    try { info.remoteBranches = (await gitOne(repoPath, ["for-each-ref", "--format=%(refname:short)", "refs/remotes"])).split("\n").filter(Boolean); } catch { /* ignore */ }
    try { info.head = (await gitOne(repoPath, ["rev-parse", "--short", "HEAD"])) || null; } catch { /* 空仓库无提交 */ }
    try { info.lastCommitAt = (await gitOne(repoPath, ["log", "-1", "--format=%cI"])) || null; } catch { /* ignore */ }
    if (!info.bare) {
      try {
        const st = await gitOne(repoPath, ["status", "--porcelain"]);
        const n = st ? st.split("\n").filter((l) => l.trim()).length : 0;
        info.dirtyCount = n;
        info.dirty = n > 0;
      } catch { /* ignore */ }
    }
    if (info.branch && !/^\(/.test(info.branch)) {
      const ub = "origin/" + info.branch;
      const cnt = async (spec) => {
        try { return parseInt(await gitOne(repoPath, ["rev-list", "--count", spec]), 10); } catch { return null; }
      };
      info.ahead = await cnt(ub + "..HEAD");
      info.behind = await cnt("HEAD.." + ub);
    }
  } catch (e) {
    info.error = String((e && e.message) || e).split("\n")[0];
  }
  return info;
}

/* 并发读取全部本地仓库信息 */
export async function collectLocal({ roots, depth = 4, maxRepos = 500 } = {}) {
  try { await execFileP("git", ["--version"], { timeout: 8000, windowsHide: true }); }
  catch { throw new Error("未检测到 git 命令：请安装 Git（https://git-scm.com）并确保在 PATH 中"); }
  const rs = (roots && roots.length ? roots : defaultLocalRoots()).filter(Boolean);
  const paths = findGitRepos(rs, depth, maxRepos);
  const rootsText = rs.map((x) => (typeof x === "string" ? x : (x && x.path) || "?")).join(" ; ");
  if (!paths.length) {
    throw new Error("在「" + rootsText + "」（深度 " + depth + "）下没有找到 Git 仓库：可用 --local-paths 或面板「本地目录…」调整范围");
  }
  console.log("? 本地扫描根目录：" + rootsText + "（深度 " + depth + "）→ 找到 " + paths.length + " 个 Git 仓库，并发读取状态…");
  const repos = await pool(paths, 6, gitInfoFor);
  return {
    scannedAt: new Date().toISOString(),
    roots: rs.map((x) => (typeof x === "string" ? x : x.path)),
    depth,
    count: repos.length,
    repos,
  };
}

/* 本地仓库与远程 rows 匹配：优先 owner/repo 精准，其次唯一同名兜底；写入 row.local 与 localScan.matched
   opts.ownerOnly=true → 只保留远程归属为当前账号（data.owner）的本地仓库，
   丢弃第三方克隆与无 GitHub 远程的仓库，避免扫描范围溢出到别人名下的仓库 */
export function matchLocalToRemote(data, localScan, opts = {}) {
  const rows = data.rows || [];
  for (const r of rows) r.local = null;
  const byFull = new Map();
  const byName = new Map();
  for (const r of rows) {
    const p = parseRemoteUrl(r.url);
    if (p && p.isGitHub) byFull.set((p.owner + "/" + p.repo).toLowerCase(), r);
    const k = String(r.name).toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  let matched = 0;
  const localOnly = [];
  for (const lr of localScan.repos || []) {
    lr.matched = false;
    lr.matchType = null;
    lr.matchedRepo = null;
    let row = null;
    if (lr.github && lr.github.isGitHub) {
      row = byFull.get((lr.github.owner + "/" + lr.github.repo).toLowerCase()) || null;
      if (row) lr.matchType = "owner/repo";
    }
    if (!row) {
      const cands = byName.get(String(lr.name).toLowerCase()) || [];
      if (cands.length === 1) { row = cands[0]; lr.matchType = "name"; }
      else if (cands.length > 1) lr.matchType = "ambiguous";
    }
    if (row) {
      lr.matched = true;
      lr.matchedRepo = row.name;
      const repoName = String(row.name).toLowerCase();
      const baseOf = (p) => String(p).split(/[\\/]/).pop().toLowerCase();
      const exact = baseOf(lr.path) === repoName;
      const prevExact = row.local && baseOf(row.local.path) === repoName;
      // 多本地克隆共享同一 remote 时，优先目录名与仓库名完全一致的克隆，
      // 避免被 -git/-new 等次级克隆覆盖，导致 CLI 检测落到错误目录（#fix 多克隆歧义）
      if (!row.local || (!prevExact && exact)) {
        row.local = {
          path: lr.path, branch: lr.branch, upstream: lr.upstream, head: lr.head,
          dirty: !!lr.dirty, dirtyCount: lr.dirtyCount || 0,
          ahead: lr.ahead, behind: lr.behind,
          lastCommitAt: lr.lastCommitAt, remoteUrl: lr.remoteUrl,
          localBranches: lr.localBranches || [], remoteBranches: lr.remoteBranches || [],
        };
        row.cli = detectCliLocal(lr.path); // 本地有克隆 → 本地检测覆盖远程结果（更新鲜）
      }
      matched++;
    } else {
      localOnly.push(lr);
    }
  }
  // 「只保留本账号仓库」（scan-config.json 的 localOwnerOnly）：丢弃远程归属不是当前账号的
  // 本地仓库（含第三方克隆与无 GitHub 远程的纯本地仓），使本地对照与「本地独有」不再溢出。
  if (opts.ownerOnly && data.owner) {
    const want = String(data.owner).toLowerCase();
    const all = localScan.repos || [];
    const kept = all.filter((lr) =>
      lr.github && lr.github.isGitHub && String(lr.github.owner || "").toLowerCase() === want);
    if (kept.length !== all.length) {
      localScan.repos = kept;
      localScan.count = kept.length;
      localScan.filteredOut = all.length - kept.length;
      matched = kept.filter((x) => x.matched).length;
      localOnly.length = 0;
      for (const lr of kept) if (!lr.matched) localOnly.push(lr);
    }
  }
  localScan.matched = matched;
  localScan.localOnlyCount = localOnly.length;
  return { matched, localOnly };
}

/* 汇总本地对照指标（无本地扫描时置 null，面板据此隐藏） */
export function applyLocalTotals(data) {
  const t = data.totals || (data.totals = {});
  const ls = data.localScan;
  if (!ls) {
    t.localTotal = t.localMatched = t.localMissing = t.localOnly = t.localDirty = t.localDiverged = null;
    return;
  }
  const rows = data.rows || [];
  const repos = ls.repos || [];
  t.localTotal = ls.count ?? repos.length;
  t.localMatched = ls.matched ?? 0;
  t.localMissing = rows.filter((r) => !r.local).length;
  t.localOnly = ls.localOnlyCount ?? 0;
  t.localDirty = repos.filter((x) => x.dirty).length;
  t.localDiverged = repos.filter((x) => (x.ahead || 0) > 0 || (x.behind || 0) > 0).length;
}

/* 仅本地扫描：并入现有快照（没有则生成远程部分为空的骨架） */
export function mergeLocalSnapshot(localScan) {
  let data = null;
  try { data = JSON.parse(readFileSync(join(HERE, "scan-data.json"), "utf8")); } catch { /* 无快照 */ }
  if (!data || !Array.isArray(data.rows)) {
    data = {
      schema: 3, owner: null, avatarUrl: "", scannedAt: null, truncated: false, rate: null,
      totals: { repos: 0, totalRepos: 0, stars: 0, forks: 0, openIssues: 0, openPRs: 0, releases: 0, ciDone: 0, ciOk: 0 },
      rows: [],
    };
  }
  matchLocalToRemote(data, localScan, { ownerOnly: ownerOnlyEnabled(readLocalConfig()) });
  data.localScan = localScan;
  data.schema = 3;
  applyLocalTotals(data);
  return data;
}

/* ---------------- 通用工具 ---------------- */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Rust: "#dea584",
  C: "#555555", "C++": "#f34b7d", "C#": "#178600", Java: "#b07219", Kotlin: "#A97BFF",
  Swift: "#F05138", Go: "#00ADD8", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c",
  Vue: "#41b883", Dart: "#00B4AB", PowerShell: "#012456", Batchfile: "#C1F12E",
  Lua: "#000080", MDX: "#fcb32c", Dockerfile: "#384d54", "Jupyter Notebook": "#DA5B0B",
};

/* ---------------- CLI 检测 ----------------
 * 三态口径：CLI = 有正式命令行入口（manifest bin/entry_points 或 cli 命名入口文件）；
 * 脚本集 = scripts|tools|bin|cmd 目录承载命令行脚本但无统一入口；无 = 检测不到交互面。
 * 本地有克隆的仓优先本地检测（更新鲜），远程-only 仓走文件树 + 清单（pushedAt 未变复用快照）。
 * gradlew / vitepress build 之类构建工具链不算仓库自有 CLI。 */
const CLI_SKIP_DIRS = new Set(["node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build",
  "target", ".gradle", ".idea", ".vscode", "site", ".vitepress", "output", "outputs", "vendor",
  "third_party", "coverage", "test-results", "playwright-report", "_archive", "backups", "logs", "data"]);
const CLI_MANIFESTS = ["package.json", "pyproject.toml", "setup.py", "setup.cfg", "Cargo.toml"];
const CLI_ENTRY_FILE = /(^|\/)(cli|__main__|entrypoint|entry_point|console)\.(py|js|ts|mjs|cjs|go)$/i;
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

export function relTime(iso) {
  if (!iso) return "—";
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days < 1 / 24) return Math.max(1, Math.round(days * 24 * 60)) + " 分钟前";
  if (days < 1) return Math.round(days * 24) + " 小时前";
  if (days < 30) return Math.round(days) + " 天前";
  if (days < 365) return Math.round(days / 30) + " 个月前";
  return (days / 365).toFixed(1) + " 年前";
}

export function fullTime(iso) {
  return iso ? new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "—";
}

export function ciStateOf(run) {
  if (!run) return { label: "无 CI 记录", cls: "none" };
  if (run.status !== "completed") return { label: "运行中", cls: "running" };
  switch (run.conclusion) {
    case "success": return { label: "通过", cls: "ok" };
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required": return { label: "失败", cls: "fail" };
    case "cancelled": return { label: "已取消", cls: "none" };
    case "skipped":
    case "neutral": return { label: "跳过", cls: "none" };
    default: return { label: "未知", cls: "none" };
  }
}

/* ---------------- 仓库健康评分(0-100):CI 40 + 新鲜度 30 + Issue 卫生 15 + 发布节奏 15,归档仓打七折 ---------------- */
export function scoreOf(r) {
  if (!r) return 0;
  let ci;
  if (r.ci && r.ci.cls === "ok") {
    const t = r.ci.trend || [];
    const done = t.filter((x) => ["success", "failure", "timed_out", "startup_failure", "action_required"].includes(x.c));
    const okr = done.filter((x) => x.c === "success").length;
    const ratio = done.length ? okr / done.length : 1;
    ci = 25 + Math.round(15 * ratio);
  } else if (r.ci && r.ci.cls === "running") ci = 20;
  else if (r.ci && r.ci.cls === "none") ci = 15;
  else ci = 0;
  const days = r.pushedAt ? (Date.now() - new Date(r.pushedAt).getTime()) / 86400000 : Infinity;
  const fresh = days <= 7 ? 30 : days <= 30 ? 24 : days <= 90 ? 16 : days <= 365 ? 8 : 2;
  const n = r.openIssues == null ? 0 : r.openIssues;
  const hyg = n === 0 ? 15 : n <= 2 ? 12 : n <= 9 ? 8 : n <= 29 ? 4 : 0;
  const relDays = r.latestRelease && r.latestRelease.publishedAt
    ? (Date.now() - new Date(r.latestRelease.publishedAt).getTime()) / 86400000 : null;
  const rel = relDays == null ? (r.releases > 0 ? 5 : 3) : relDays <= 90 ? 15 : relDays <= 365 ? 9 : 5;
  let total = ci + fresh + hyg + rel;
  if (r.isArchived) total = Math.round(total * 0.7);
  return Math.max(0, Math.min(100, total));
}

export function gradeOf(score) {
  if (score >= 85) return { g: "A", cls: "ok" };
  if (score >= 70) return { g: "B", cls: "info" };
  if (score >= 50) return { g: "C", cls: "warn" };
  return { g: "D", cls: "fail" };
}

const QUERY_PAGE = /* GraphQL */ `
  query($owner: String!, $cursor: String) {
    user(login: $owner) {
      login
      avatarUrl(size: 96)
      repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          description
          url
          visibility
          isArchived
          isFork
          createdAt
          pushedAt
          stargazerCount
          forkCount
          diskUsage
          primaryLanguage { name }
          licenseInfo { spdxId name }
          defaultBranchRef { name }
          issues(states: OPEN, first: 1) { totalCount }
          pullRequests(states: OPEN, first: 1) { totalCount }
          refs(refPrefix: "refs/heads/", first: 100) { totalCount nodes { name } }
          releases(first: 1) { totalCount }
          latestRelease { tagName name publishedAt url }
        }
      }
    }
  }`;

/* ---------------- 数据采集（分页 + 并行 + 增量） ---------------- */
// 变更探测：判断某仓库相对上次快照是否「无变化」（listing 级字段全等，且 CI 不在运行中）
// next 为本次 GraphQL 列表项归一化后的摘要；prevRow 为上次快照的行对象
export function repoUnchanged(prevRow, next) {
  if (!prevRow) return false;
  return prevRow.pushedAt === next.pushedAt
    && prevRow.stars === next.stars
    && prevRow.forks === next.forks
    && prevRow.openIssues === next.openIssues
    && prevRow.openPRs === next.openPRs
    && prevRow.branches === next.branches
    && (prevRow.branchNames || []).join("\n") === (next.branchNames || []).join("\n") // 分支名单变化（新增/改名/删除）视为有变更
    && prevRow.releases === next.releases
    && prevRow.isArchived === next.isArchived
  && prevRow.visibility === next.visibility
  && !!prevRow.cli // 旧快照缺 CLI 检测结果 → 视为有变更，深扫一次后随 pushedAt 缓存
  && (!prevRow.ci || prevRow.ci.cls !== "running"); // CI 运行中的仓库需重查（可能刚出结果）
}

export async function collectData(ownerArg, opts = {}) {
  const scanStart = Date.now();
  const owner = ownerArg || (await ghAsync(["api", "user", "--jq", ".login"]));
  console.log("▸ 账号：" + owner);

  // 1. GraphQL 分页拉仓库（每页 100，最多 5 页 = 500 个）
  let login = null;
  let avatarUrl = "";
  let totalCount = 0;
  const repos = [];
  let cursor = null;
  let pagesFetched = 0;
  for (let page = 0; page < 5; page++) {
    const ghArgs = ["api", "graphql", "-f", "query=" + QUERY_PAGE, "-F", "owner=" + owner];
    if (cursor) ghArgs.push("-F", "cursor=" + cursor);
    const res = JSON.parse(await ghAsync(ghArgs));
    if (res.errors?.length) throw new Error("GraphQL 错误：" + res.errors.map((e) => e.message).join("; "));
    const user = res.data?.user;
    if (!user) throw new Error("找不到账号 " + owner + "（本工具面向个人账号，组织账号需改用 organization 查询）");
    login = user.login;
    avatarUrl = user.avatarUrl;
    totalCount = user.repositories.totalCount;
    repos.push(...(user.repositories.nodes ?? []));
    pagesFetched++;
    if (!user.repositories.pageInfo.hasNextPage) { cursor = null; break; }
    cursor = user.repositories.pageInfo.endCursor;
  }
  const truncated = !!cursor;
  console.log("▸ 拉到 " + repos.length + " 个仓库（账号名下 " + totalCount + " 个，GraphQL " + pagesFetched + " 页" + (truncated ? "，超过 500 个已截断" : "") + "）");

  // 2. 上一次快照（用于许可证链接增量复用：pushedAt 未变 → LICENSE 文件未变）
  let prev = null;
  try { prev = JSON.parse(readFileSync(join(HERE, "scan-data.json"), "utf8")); } catch { /* 无快照则全量 */ }
  const prevByName = new Map(((prev && prev.rows) || []).map((r) => [r.name, r]));

  // 3. 先探测变更，再决定是否深度拉取：
  //    与上次快照逐仓比对 listing 级字段（pushedAt / star / fork / issue / PR / 分支 / 发布 / 可见性 / 归档 / CI 是否在跑）；
  //    完全没变的仓库直接复用上次快照的明细（许可证链接 / CI 趋势 / 最近提交 / 流量），不发任何额外请求。
  //    → 无变更时几乎零请求（秒级返回）；有变更时只深挖变更仓库，其余复用。
  const forceFull = !!opts.full;
  let reused = 0, deepScanned = 0;
  console.log(forceFull ? "▸ 强制全量：并行拉取每仓明细（并发 8）…" : "▸ 变更探测后并行拉取明细（并发 8，仅变更仓库走网络）…");
  const rows = await pool(repos, 8, async (r) => {
    const p = prevByName.get(r.name);
    const next = {
      pushedAt: r.pushedAt,
      stars: r.stargazerCount,
      forks: r.forkCount,
      openIssues: r.issues?.totalCount ?? 0,
      openPRs: r.pullRequests?.totalCount ?? 0,
      branches: r.refs?.totalCount ?? 0,
      branchNames: (r.refs?.nodes || []).map((n) => n.name),
      releases: r.releases?.totalCount ?? 0,
      isArchived: !!r.isArchived,
      visibility: r.visibility,
    };
    const listingUnchanged = !forceFull && repoUnchanged(p, next);
    if (listingUnchanged) {
      reused++;
      const lic0 = r.licenseInfo;
      return {
        ...p,
        url: r.url,
        description: r.description ?? "",
        visibility: r.visibility,
        isArchived: !!r.isArchived,
        isFork: !!r.isFork,
        createdAt: r.createdAt,
        pushedAt: r.pushedAt,
        stars: r.stargazerCount,
        forks: r.forkCount,
        size: r.diskUsage ?? 0,
        openIssues: r.issues?.totalCount ?? 0,
        openPRs: r.pullRequests?.totalCount ?? 0,
        branches: r.refs?.totalCount ?? 0,
        branchNames: (r.refs?.nodes || []).map((n) => n.name),
        defaultBranch: r.defaultBranchRef?.name ?? "—",
        license: lic0 ? (lic0.spdxId && lic0.spdxId !== "NOASSERTION" ? lic0.spdxId : lic0.name) : null,
        licenseUrl: lic0 ? (p.licenseUrl ?? null) : null,
        releases: r.releases?.totalCount ?? 0,
        latestRelease: r.latestRelease
          ? { tag: r.latestRelease.tagName, name: r.latestRelease.name, publishedAt: r.latestRelease.publishedAt, url: r.latestRelease.url }
          : null,
        language: r.primaryLanguage?.name ?? null,
        langColor: LANG_COLORS[r.primaryLanguage?.name ?? ""] ?? "#8b949e",
      };
    }
    deepScanned++;
    let licenseUrl = null;
    if (r.licenseInfo) {
      if (p && p.pushedAt === r.pushedAt && p.licenseUrl) {
        licenseUrl = p.licenseUrl; // 增量复用
      } else {
        try {
          licenseUrl = await ghAsync(["api", "repos/" + owner + "/" + r.name + "/license", "--jq", ".html_url"]);
        } catch { /* 根目录没有标准 LICENSE 文件，忽略 */ }
      }
    }

    let runs = [];
    try {
      runs = JSON.parse(await ghAsync(["api", "repos/" + owner + "/" + r.name + "/actions/runs?per_page=5"])).workflow_runs ?? [];
    } catch { /* Actions API 不可用时按无记录处理 */ }
    const run = runs[0] ?? null;
    const trend = runs.slice().reverse().map((x) => ({ s: x.status, c: x.conclusion, at: x.created_at })); // 旧 → 新

    let traffic = null;
    if (WITH_TRAFFIC) {
      try {
        const v = JSON.parse(await ghAsync(["api", "repos/" + owner + "/" + r.name + "/traffic/views"]));
        const c = JSON.parse(await ghAsync(["api", "repos/" + owner + "/" + r.name + "/traffic/clones"]));
        const sum = (arr, k) => (arr || []).reduce((a, x) => a + (x[k] || 0), 0);
        traffic = { views: sum(v.views, "count"), viewUniques: sum(v.views, "uniques"),
                    clones: sum(c.clones, "count"), cloneUniques: sum(c.clones, "uniques") };
      } catch { /* 无权限或无数据时留空 */ }
    }

    // 最近一次提交的变更文件（用于「最近变更」列；每个仓库 +1 次 REST 调用）
    let lastCommit = null;
    try {
      const c = JSON.parse(await ghAsync(["api", "repos/" + owner + "/" + r.name + "/commits?per_page=1"]));
      const cm = Array.isArray(c) ? c[0] : null;
      if (cm && cm.sha) {
        const files = (cm.files || []).slice(0, 12).map((f) => ({ name: f.filename, status: f.status, add: f.additions || 0, del: f.deletions || 0 }));
        lastCommit = {
          sha: cm.sha,
          message: (cm.commit?.message || "").split("\n")[0].slice(0, 120),
          at: cm.commit?.author?.date || cm.commit?.committer?.date || null,
          url: cm.html_url || null,
          files,
          fileCount: (cm.files || []).length,
        };
      }
    } catch { /* 无提交或接口不可用时留空 */ }

    // CLI 检测（远程-only 仓的唯一来源；有本地克隆的仓稍后被 matchLocalToRemote 用本地检测覆盖）：
    // 拉一次文件树 + 最多 2 份根目录清单；pushedAt 未变的仓库走复用路径不进这里。
    let cli = null;
    try {
      const tree = JSON.parse(await ghAsync(["api", "repos/" + owner + "/" + r.name + "/git/trees/" + (r.defaultBranchRef?.name || "HEAD") + "?recursive=1"]));
      const paths = (tree.tree || []).map((x) => x.path);
      const manifests = {};
      for (const mf of CLI_MANIFESTS) {
        if (!paths.includes(mf) || Object.keys(manifests).length >= 2) continue;
        try { manifests[mf] = await ghAsync(["api", "repos/" + owner + "/" + r.name + "/contents/" + mf, "-H", "Accept: application/vnd.github.raw"]); } catch { /* 拉不到就跳过 */ }
      }
      cli = detectCliRemote(paths, manifests);
    } catch { /* 文件树不可用时 CLI 列留空 */ }

    const state = ciStateOf(run);
    const lic = r.licenseInfo;
    return {
      name: r.name,
      url: r.url,
      description: r.description ?? "",
      visibility: r.visibility,
      isArchived: !!r.isArchived,
      isFork: !!r.isFork,
      createdAt: r.createdAt,
      pushedAt: r.pushedAt,
      stars: r.stargazerCount,
      forks: r.forkCount,
      size: r.diskUsage ?? 0,
      openIssues: r.issues?.totalCount ?? 0,
      openPRs: r.pullRequests?.totalCount ?? 0,
      branches: r.refs?.totalCount ?? 0,
      branchNames: (r.refs?.nodes || []).map((n) => n.name),
      defaultBranch: r.defaultBranchRef?.name ?? "—",
      license: lic ? (lic.spdxId && lic.spdxId !== "NOASSERTION" ? lic.spdxId : lic.name) : null,
      licenseUrl,
      releases: r.releases?.totalCount ?? 0,
      latestRelease: r.latestRelease
        ? { tag: r.latestRelease.tagName, name: r.latestRelease.name, publishedAt: r.latestRelease.publishedAt, url: r.latestRelease.url }
        : null,
      ci: {
        state: state.label,
        cls: state.cls,
        workflow: run?.name ?? null,
        ref: run?.head_branch ?? null,
        ranAt: run?.created_at ?? null,
        url: run?.html_url ?? null,
        trend,
      },
      language: r.primaryLanguage?.name ?? null,
      langColor: LANG_COLORS[r.primaryLanguage?.name ?? ""] ?? "#8b949e",
      traffic,
      lastCommit,
      cli,
    };
  });

  // 4. API 配额（rate_limit 接口本身不消耗配额）
  let rate = null;
  try {
    rate = JSON.parse(await ghAsync(["api", "rate_limit", "--jq", ".resources.core"]));
  } catch { /* 拿不到就隐藏展示 */ }

  const totals = {
    repos: rows.length,
    totalRepos: totalCount,
    stars: rows.reduce((a, r) => a + r.stars, 0),
    forks: rows.reduce((a, r) => a + r.forks, 0),
    openIssues: rows.reduce((a, r) => a + r.openIssues, 0),
    openPRs: rows.reduce((a, r) => a + r.openPRs, 0),
    releases: rows.reduce((a, r) => a + r.releases, 0),
    ciDone: rows.filter((x) => ["ok", "fail"].includes(x.ci.cls)).length,
    ciOk: rows.filter((x) => x.ci.cls === "ok").length,
    sizeTotal: rows.reduce((a, r) => a + (r.size || 0), 0),
  };

  const scanInfo = {
    mode: forceFull ? "full" : (deepScanned === 0 ? "reuse" : "incremental"),
    total: rows.length,
    deepScanned,
    reused,
    full: forceFull,
    durationMs: Date.now() - scanStart,
  };
  console.log("▸ 扫描结果：" + (scanInfo.mode === "reuse" ? "无变更，完全复用快照（0 次深度请求）"
    : (scanInfo.mode === "full" ? "强制全量" : "增量") + " · 深度扫描 " + deepScanned + " 个 · 复用 " + reused + " 个")
    + " · 用时 " + (scanInfo.durationMs / 1000).toFixed(1) + "s");
  const data = { schema: 3, owner: login, avatarUrl, scannedAt: new Date().toISOString(), truncated, rate, totals, rows, scanInfo };
  for (const r of data.rows) r.local = null;
  if (opts.local !== false) {
    try {
      const cfg = readLocalConfig();
      const depth = Number.isFinite(opts.depth) ? opts.depth : (Number.isFinite(cfg.localScanDepth) ? cfg.localScanDepth : 4);
      const localScan = await collectLocal({ roots: opts.roots, depth });
      matchLocalToRemote(data, localScan, { ownerOnly: ownerOnlyEnabled(cfg) });
      data.localScan = localScan;
    } catch (e) {
      console.log("▸ 本地对照跳过：" + ((e && e.message) ?? e));
      data.localScan = null;
    }
  } else {
    data.localScan = null;
  }
  applyLocalTotals(data);
  return data;
}

/* ---------------- 产物输出 ---------------- */
// Star 周增长趋势：本地扫描快照历史（按自然日去重，仅远程全量扫描写入）
const HISTORY_FILE = join(HERE, "scan-data-history.json");
const HISTORY_MAX = 400; // 约 > 1 年（按天去重后）

export function loadStarHistory() {
  try {
    const h = JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
    return Array.isArray(h) ? h : [];
  } catch { return []; }
}

// 记录一次扫描快照（按自然日去重，仅远程全量扫描调用）
export function recordStarHistory(data) {
  const t = data.scannedAt || new Date().toISOString();
  const day = String(t).slice(0, 10);
  const repos = {};
  for (const r of data.rows || []) repos[r.name] = r.stars || 0;
  let hist = loadStarHistory();
  const idx = hist.findIndex((e) => String(e.t).slice(0, 10) === day);
  const entry = { t, repos };
  if (idx >= 0) hist[idx] = entry; else hist.push(entry);
  hist.sort((a, b) => new Date(a.t) - new Date(b.t));
  if (hist.length > HISTORY_MAX) hist = hist.slice(hist.length - HISTORY_MAX);
  writeFileSync(HISTORY_FILE, JSON.stringify(hist), "utf8");
  return hist;
}

// 计算每个仓库近 7 天 Star 增量，写入 r.starWeek 与 data.starWeekRef
// hist 可外部注入（便于测试），默认从本地历史文件读取；历史不足 6 天则全部置 null（不编造数据）
export function computeStarWeek(data, hist) {
  hist = hist || loadStarHistory();
  const now = new Date(data.scannedAt || Date.now()).getTime();
  const target = now - 7 * 86400000;
  let chosen = null;
  for (const e of hist) {
    const et = new Date(e.t).getTime();
    if (et <= target) {
      if (!chosen || et > new Date(chosen.t).getTime()) chosen = e;
    }
  }
  if (chosen && (now - new Date(chosen.t).getTime()) >= 6 * 86400000) {
    data.starWeekRef = chosen.t;
    for (const r of data.rows || []) {
      const prev = chosen.repos[r.name];
      r.starWeek = (typeof prev === "number") ? (r.stars || 0) - prev : null;
    }
  } else {
    data.starWeekRef = null;
    for (const r of data.rows || []) r.starWeek = null;
  }
  return data;
}

export function writeOutputs(data, withHistory = false, source = null) {
  if (withHistory) {
    try { recordStarHistory(data); } catch { /* 历史写入失败不影响主产物 */ }
    try { computeStarWeek(data); } catch { /* 同上 */ }
  }
  // 快照脱敏（R2 P1-3）：深拷贝后对 local.path 相对化为 ~/… 再入库；
  // 内存中的 data 保留真实路径，供 console 汇总与 /api/scan 返回使用。
  const out = JSON.parse(JSON.stringify(data));
  maskSnapshotPaths(out);
  writeFileSync(join(HERE, "scan-data.json"), JSON.stringify(out, null, 2), "utf8");
  writeFileSync(join(HERE, "dashboard.html"), renderDashboard(out), "utf8");
  // 审计留痕（R2 P2-8）：扫描完成事件写入 scan-audit.jsonl（不入库），设 SCAN_AUDIT_KEY 时逐行 HMAC 防篡改
  try {
    const si = data.scanInfo || {};
    appendAudit({
      ts: new Date().toISOString(),
      event: "scan_completed",
      owner: data.owner || null,
      mode: si.mode || null,
      source: source || null,
      repos: (data.totals && data.totals.repos) ?? null,
      durationMs: si.durationMs ?? null,
    });
  } catch { /* 审计写入失败不影响主产物 */ }
}

/* ---------------- 审计日志（R2 P2-8）：结构化 JSONL，不入库 ----------------
 * 行格式：{ ts, event, owner, mode, source, repos, durationMs, hmac? }
 * 防篡改：设 SCAN_AUDIT_KEY 环境变量时逐行附 HMAC-SHA256（对 hmac 之前的行体签名）；
 * 未设置时 hmac 为 null（明文模式，首次写入提示）。轮转：超过 AUDIT_MAX 行保留最近 AUDIT_MAX 行。
 * filePath 可注入便于测试，默认写入项目目录 scan-audit.jsonl（.gitignore 已排除）。 */
const AUDIT_FILE = join(HERE, "scan-audit.jsonl");
const AUDIT_MAX = 2000;

export function loadAuditRows(filePath = AUDIT_FILE) {
  try {
    const text = readFileSync(filePath, "utf8");
    const rows = text.split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return rows;
  } catch { return []; }
}

let auditKeyWarned = false;
export function appendAudit(entry, filePath = AUDIT_FILE) {
  try {
    const line = JSON.stringify(entry);
    let hmac = null;
    const key = process.env.SCAN_AUDIT_KEY;
    if (key) hmac = createHmac("sha256", key).update(line).digest("hex");
    else if (!auditKeyWarned) {
      auditKeyWarned = true;
      console.log("? 审计日志为明文模式（未设 SCAN_AUDIT_KEY）：设置该环境变量可启用逐行 HMAC 防篡改");
    }
    const row = { ...entry, hmac };
    const rows = loadAuditRows(filePath);
    rows.push(row);
    const kept = rows.slice(-AUDIT_MAX);
    writeFileSync(filePath, kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : ""), "utf8");
    return row;
  } catch { return null; }
}

/* 快照入库前脱敏：localScan.repos[].path、localScan.roots 与 rows[].local.path 相对化为 ~/…（非主目录路径原样保留） */
function maskSnapshotPaths(data) {
  if (!data) return;
  const ls = data.localScan;
  if (ls) {
    if (Array.isArray(ls.repos)) {
      for (const r of ls.repos) if (r && r.path) r.path = maskLocalPath(r.path);
    }
    if (Array.isArray(ls.roots)) {
      for (let i = 0; i < ls.roots.length; i++) ls.roots[i] = maskLocalPath(ls.roots[i]);
    }
  }
  if (Array.isArray(data.rows)) {
    for (const r of data.rows) {
      if (r && r.local && r.local.path) r.local.path = maskLocalPath(r.local.path);
    }
  }
}

export function printSummary(data) {
  const t = data.totals;
  console.log("✔ 扫描完成：" + t.repos + " 个仓库 · ★ " + t.stars + " · Fork " + t.forks + " · 开放 Issue " + t.openIssues + "（另有 PR " + t.openPRs + "） · 发布 " + t.releases + " · CI 通过 " + t.ciOk + "/" + t.ciDone);
  if (data.scanInfo) {
    const si = data.scanInfo;
    console.log("▸ 本次扫描：" + (si.mode === "reuse" ? "无变更·复用快照（0 次深度请求）" : (si.mode === "full" ? "强制全量" : "增量") + " · 深度 " + si.deepScanned + " 个 · 复用 " + si.reused + " 个") + " · " + (si.durationMs / 1000).toFixed(1) + "s");
  }
  for (const r of data.rows) {
    console.log("   " + r.name.padEnd(24) + " CI:" + r.ci.state.padEnd(6) + " 许可:" + (r.license ?? "未声明").padEnd(12) + " Release:" + (r.latestRelease ? r.latestRelease.tag : "—").padEnd(14) + " 分支:" + r.defaultBranch + "/" + r.branches + "  ★" + r.stars);
  }
  if (data.localScan) {
    const ls = data.localScan;
    console.log("▸ 本地对照：本机 " + ls.count + " 个 Git 仓库 · 对上 " + ls.matched + " · 本地独有 " + ls.localOnlyCount + " · 远程有本地缺 " + (t.localMissing ?? 0)
      + (ls.filteredOut ? "（另有 " + ls.filteredOut + " 个非本账号仓库已按 localOwnerOnly 忽略）" : ""));
    const missing = data.rows.filter((r) => !r.local).map((r) => r.name);
    if (missing.length) console.log("  ⚠ 远程有但本地没扫到：" + missing.join(", "));
    for (const lr of ls.repos) {
      const st = [lr.dirty ? "未提交" + (lr.dirtyCount || 0) : "", (lr.ahead || 0) > 0 ? "↑" + lr.ahead : "", (lr.behind || 0) > 0 ? "↓" + lr.behind : ""].filter(Boolean).join(" ") || "干净";
      const br = (lr.branch ? "本地:" + lr.branch : "—") + (lr.upstream ? " 远程:" + lr.upstream : "");
      console.log("   " + (lr.matched ? "✔ " : "＋") + lr.name.padEnd(24) + " " + br.padEnd(30) + " " + st.padEnd(14) + " " + lr.path);
    }
  }
  if (data.rate) console.log("▸ GitHub API 余量：" + data.rate.remaining + "/" + data.rate.limit);
  console.log("▸ 面板：" + join(HERE, "dashboard.html"));
  console.log("▸ 快照：" + join(HERE, "scan-data.json") + "（schema " + (data.schema ?? 1) + "）");
}
