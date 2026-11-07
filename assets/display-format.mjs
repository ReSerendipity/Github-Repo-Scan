// display-format.mjs —— 展示 / 评分口径的唯一来源（债 #11：single source of truth）
//
// 两侧怎么用同一份文本：
//   服务端  scripts/scan-core.mjs 以 ESM 方式 import 本文件并原样 re-export（单测与 CLI 都走这里）；
//   浏览器  scripts/render-dashboard.mjs 读本文件、去掉行首 export 后作为独立脚本块注入，
//           先于 assets/dashboard-client.js 那个脚本块出现，五个函数因此成为页面全局，
//           客户端脚本直接调用即可（客户端不再持有同名副本）。
// 注意：本文件会被原样拼进页面脚本块，正文里不要出现脚本标签字面量，否则会截断页面解析。
//
// 约束：纯函数，不碰 DOM、不碰 Node 内置模块；除 Date.now / Intl 之外不读宿主状态。
// 改口径只改这里一处，两侧同时生效；tests/core.test.mjs 有结构性断言守住「客户端不得再长出副本」。

/* 通用工具 */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

/* 仓库健康评分(0-100):CI 40 + 新鲜度 30 + Issue 卫生 15 + 发布节奏 15,归档仓打七折 */
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
