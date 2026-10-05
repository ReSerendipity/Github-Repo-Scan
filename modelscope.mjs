#!/usr/bin/env node
/**
 * 魔搭社区（ModelScope）魔粒余额取数模块
 *
 * 端点：GET https://modelscope.cn/openapi/v1/magicubes/balance
 * 认证优先级：
 *   1) 环境变量 MODELSCOPE_API_TOKEN（Bearer，稳定、推荐；在 modelscope.cn/my/access/token 申请）
 *   2) scan-config.json 的 modelscopeToken 字段（Bearer）
 *   3) 兜底：复用本机 modelscope CLI 登录态 ~/.modelscope/credentials/cookies
 *      （pickle 化的 RequestsCookieJar，调 python 解析出 modelscope.cn 的 Cookie 头）
 *
 * 用法：
 *   import { getMoli } from "./modelscope.mjs";   // 服务端
 *   node modelscope.mjs [--refresh]                // 命令行直接打印魔粒余额
 *
 * 返回形如：
 *   { ok:true, configured:true, source:"cookie"|"bearer",
 *     total_balance:177, available_balance:177, frozen_amount:0, updatedAt:"…" }
 *   { ok:false, configured:false, error:"未配置 ModelScope 凭据…" }   // 无任何凭据
 *   { ok:false, configured:true,  error:"…" }                         // 有凭据但请求失败
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { HERE, readLocalConfig } from "./scan-core.mjs";

const COOKIE_PATH = join(process.env.USERPROFILE || process.env.HOME || "", ".modelscope", "credentials", "cookies");
const BALANCE_URL = "https://modelscope.cn/openapi/v1/magicubes/balance";
const CACHE_PATH = join(HERE, "modelscope-moli.json");
const PY_CODE = [
  "import sys, pickle",
  "p = sys.argv[1]",
  "try:",
  "    jar = pickle.load(open(p, 'rb'))",
  "except Exception:",
  "    sys.exit(2)",
  "out = []",
  "for c in jar:",
  "    dom = getattr(c, 'domain', '') or ''",
  "    if dom.endswith('modelscope.cn'):",
  "        out.append(c.name + '=' + c.value)",
  "print('; '.join(out))",
].join("\n");

const PY_CANDIDATES = ["python", "python3", "py", "C:\\Python312\\python.exe"];

function findPython() {
  for (const cmd of PY_CANDIDATES) {
    // 必须能 import requests：pickle 里的 RequestsCookieJar 需要 requests.cookies 才能反序列化
    if (execFileSyncSafe(cmd, ["-c", "import requests, sys; sys.exit(0)"])) return cmd;
  }
  return null;
}

// 同步探测 python 是否可用（execFileSync 抛错即不可用）
function execFileSyncSafe(cmd, args) {
  try {
    execFileSync(cmd, args, { stdio: ["ignore", "ignore", "ignore"], timeout: 4000 });
    return true;
  } catch {
    return null;
  }
}

// 解析 pickle cookie 文件，返回 Cookie 头字符串（失败返回 null）
function cookieHeaderFromPickle() {
  if (!existsSync(COOKIE_PATH)) return null;
  const py = findPython();
  if (!py) return null;
  return new Promise((resolve) => {
    execFile(py, ["-c", PY_CODE, COOKIE_PATH], { timeout: 8000, maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err) return resolve(null);
        const s = (stdout || "").trim();
        resolve(s ? s : null);
      });
  });
}

// 解析凭据：Bearer 优先，session cookie 兜底
export async function resolveAuth() {
  const envTok = process.env.MODELSCOPE_API_TOKEN || process.env.MODELSCOPE_TOKEN;
  if (envTok && String(envTok).trim()) return { type: "bearer", token: String(envTok).trim() };
  let cfgTok = null;
  try { const cfg = readLocalConfig(); cfgTok = cfg && cfg.modelscopeToken; } catch { /* 无配置 */ }
  if (cfgTok && String(cfgTok).trim()) return { type: "bearer", token: String(cfgTok).trim() };
  const cookie = await cookieHeaderFromPickle();
  if (cookie) return { type: "cookie", cookie };
  return { type: "none" };
}

function loadCache() {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch { return null; }
}

function saveCache(obj) {
  try { writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2), "utf8"); } catch { /* 缓存失败不致命 */ }
}

// 真实请求魔粒余额接口（每次都打网络）
export async function fetchMoliBalance() {
  const auth = await resolveAuth();
  if (auth.type === "none") {
    return { ok: false, configured: false, error: "未配置 ModelScope 凭据：设置 MODELSCOPE_API_TOKEN 环境变数，或在 modelscope.cn/my/access/token 申请后写入 scan-config.json 的 modelscopeToken；也可先执行 modelscope login" };
  }
  const headers = { Accept: "application/json" };
  if (auth.type === "bearer") headers["Authorization"] = "Bearer " + auth.token;
  else if (auth.type === "cookie") headers["Cookie"] = auth.cookie;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(BALANCE_URL, { headers, signal: ctrl.signal });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json.success !== true) {
      const msg = (json && json.message) || ("HTTP " + resp.status);
      const hint = resp.status === 401
        ? "（凭据无效或已过期：刷新 MODELSCOPE_API_TOKEN，或重新 modelscope login 后再试）"
        : "";
      return { ok: false, configured: true, source: auth.type, error: msg + hint };
    }
    const d = json.data || {};
    const out = {
      ok: true,
      configured: true,
      source: auth.type,
      total_balance: d.total_balance == null ? null : Number(d.total_balance),
      available_balance: d.available_balance == null ? null : Number(d.available_balance),
      frozen_amount: d.frozen_amount == null ? null : Number(d.frozen_amount),
      updatedAt: new Date().toISOString(),
    };
    saveCache(out);
    return out;
  } catch (e) {
    return { ok: false, configured: true, source: auth.type, error: String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// 对外主入口：默认返回本地缓存（瞬开、不刷网络）；refresh=true 才真打接口
export async function getMoli(opts = {}) {
  const refresh = !!(opts && opts.refresh);
  if (!refresh) {
    const cached = loadCache();
    if (cached) return { ...cached, cached: true };
  }
  return fetchMoliBalance();
}

// 命令行直接运行：node modelscope.mjs [--refresh]
// 用 pathToFileURL 归一化 Windows 反斜杠路径，避免 import.meta.url 比较失败
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  getMoli({ refresh: process.argv.includes("--refresh") })
    .then((m) => {
      if (!m.ok) {
        console.error("✖ 魔粒获取失败：" + (m.error || "未知错误") + (m.configured === false ? "" : "（上次缓存不可用）"));
        process.exit(1);
      }
      const when = m.updatedAt ? new Date(m.updatedAt).toLocaleString("zh-CN", { hour12: false }) : "";
      console.log("✔ 魔搭社区魔粒（" + (m.source === "bearer" ? "API Token" : "本机登录态") + (m.cached ? "·缓存" : "") + "）");
      console.log("   可用：" + m.available_balance + "　总：" + m.total_balance + "　冻结：" + m.frozen_amount);
      console.log("   更新时间：" + when);
      process.exit(0);
    })
    .catch((e) => { console.error("✖ " + (e && e.message || e)); process.exit(1); });
}
