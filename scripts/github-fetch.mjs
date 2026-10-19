// github-fetch.mjs —— D1 GitHub 取数传输域（2026-10-15 自 scan-core.mjs 外提，v2.9 修复批次2，对应 tech-debt.md #9）
// 成员：execFileP / sleep / ghToken / canDirectFallback / applyJq / directApi / httpsJson(+setHttpsTransport) / ghAsync / pool
// 边界（module-boundaries.md BM-2）：本域是唯一可触网（HTTPS 直连 / gh 子进程）的域；
// 消费方：scan-core.mjs（D2/D5/D6/D8 调用点，经 re-export 兼容既有 import 站点）与 tests/direct-api.test.mjs。
// 死代码 gh/sleepSync 已随本次触碰 D1 的变更按 tech-debt.md #9 既定准则删除。

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import https from "node:https";

export const execFileP = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* ---------------- GH_TOKEN 直连兜底(兜底矩阵:gh CLI → token 直连) ---------------- */
function ghToken() {
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
}
function canDirectFallback(e, msg) {
  if (!ghToken()) return false;
  return e?.code === "ENOENT" || /command not found|not recognized|不是内部或外部命令|gh auth login|not logged/i.test(msg);
}
/* 极简 jq 子集:仅支持 .a.b.c 点路径(覆盖本工具全部 --jq 用法) */
export function applyJq(data, expr) {
  if (!/^\.[A-Za-z0-9_.]*$/.test(expr)) throw new Error("GH_TOKEN 兜底通道不支持该 --jq 表达式:" + expr);
  let v = data;
  for (const k of expr.slice(1).split(".")) { if (v == null) break; v = v[k]; }
  return v;
}
export async function directApi(args) {
  const headers = { "User-Agent": "github-repo-scan", Authorization: "Bearer " + ghToken(), Accept: "application/vnd.github+json" };
  if (args[0] !== "api") throw new Error("GH_TOKEN 兜底通道仅支持 api 调用");
  if (args[1] === "graphql") {
    const body = {};
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "-f" || args[i] === "-F") {
        const eq = String(args[i + 1] ?? "").indexOf("=");
        if (eq > 0) body[args[i + 1].slice(0, eq)] = args[i + 1].slice(eq + 1);
        i++;
      }
    }
    const r = await httpsJson("https://api.github.com/graphql", { method: "POST", headers, body: JSON.stringify(body) });
    if (r.status >= 300) throw new Error("GraphQL 直连响应异常(HTTP " + r.status + ")");
    try { return JSON.stringify(JSON.parse(r.text)); }
    catch (e) { throw new Error("GraphQL 直连响应异常(HTTP " + r.status + ")"); }
  }
  const restPath = String(args[1]).replace(/^\//, "");
  let jq = null;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--jq") { jq = args[i + 1]; i++; }
  }
  const r = await httpsJson("https://api.github.com/" + restPath, { headers });
  if (r.status >= 300) throw new Error("GitHub API HTTP " + r.status + "(GH_TOKEN 直连)");
  let data = null;
  try { data = JSON.parse(r.text); } catch (e) { data = r.text; }
  if (jq != null) {
    const v = applyJq(data, jq);
    return typeof v === "string" ? v : JSON.stringify(v);
  }
  return typeof data === "string" ? data : JSON.stringify(data);
}

/* 直连传输层:严格 TLS 优先;本机代理会拦截证书链(gh CLI 走系统信任库所以无感,Node 不认)。
   默认严格校验;仅当显式设置 SCAN_INSECURE_TLS=1（本机代理场景）时,才对 api.github.com 放宽校验重试一次。
   对应评估报告 R2 P2-4:把无条件降级改为显式开关,避免默认路径静默关闭证书校验。
   运行时读取环境变量（而非模块加载时冻结），保证开关在测试/运行中可动态生效。
   传输层可注入（tech-debt #10 偿清动作）：默认 node:https；测试经 setHttpsTransport 显式注入、
   用例结束恢复——globalThis 桩遮蔽模块绑定的复发条件就此失效。 */
let httpsOverride = null;
export function setHttpsTransport(mod) {
  httpsOverride = mod;
  return () => { httpsOverride = null; };
}
function httpsJson(url, { method = "GET", headers, body } = {}) {
  const transport = httpsOverride || https;
  return new Promise((resolve, reject) => {
    const attempt = (strict) => {
      const agent = new transport.Agent({ rejectUnauthorized: strict, keepAlive: false });
      const req = transport.request(url, { method, headers, agent, timeout: 25000 }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, text: data }));
      });
      req.on("error", (e) => {
        const msg = String((e && e.message) || e) + " " + String((e && e.cause && e.cause.message) || "");
        if (strict && process.env.SCAN_INSECURE_TLS === "1" && /UNABLE_TO_VERIFY|SELF_SIGNED|DEPTH_ZERO|CERT/i.test(msg)) {
          console.log("  ? TLS 证书校验失败（本机代理所致），已按 SCAN_INSECURE_TLS=1 放宽校验重试一次（仅限 api.github.com）");
          return attempt(false);
        }
        reject(e);
      });
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
      req.end(body || undefined);
    };
    attempt(true);
  });
}


export async function ghAsync(args, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { stdout } = await execFileP("gh", args, { maxBuffer: 64 * 1024 * 1024 });
      return stdout.trim();
    } catch (e) {
      const msg = String((e && e.message) || e);
      const transient = /HTTP 5\d\d|HTTP 429|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up/i.test(msg);
      if (attempt < retries && transient) {
        const waitMs = 2000 * (attempt + 1);
        console.log("  ↻ GitHub API 暂时不可用，" + Math.round(waitMs / 1000) + " 秒后重试（第 " + (attempt + 1) + "/" + retries + " 次）…");
        await sleep(waitMs);
        continue;
      }
      if (canDirectFallback(e, msg)) {
        try {
          const out = await directApi(args);
          console.log("  ? gh CLI 不可用，已用 GH_TOKEN 直连兜底通道完成本次调用");
          return out;
        } catch (e2) {
          console.log("  ? GH_TOKEN 直连兜底失败：" + e2.message);
        }
      }
      throw e;
    }
  }
}


/* 简易并发池：items 上按 limit 并发跑 fn，保持结果顺序 */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
