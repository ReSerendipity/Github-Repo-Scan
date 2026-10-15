// 无凭据直连兜底通道（directApi + httpsJson）的决策与重试聚焦测试
// 通过 setHttpsTransport 显式注入桩化传输层（债#10 偿清后 globalThis 桩遮蔽不再生效），覆盖状态码判定、TLS 严格→放宽的分支选择、
// 恰好一次重试与一次放弃，并断言传输调用次数与最终结论；不触网、不依赖真实凭据。
// 风格沿用 tests/core.test.mjs：node:test + node:assert/strict，直连导入 scan-core 的导出。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { directApi, applyJq, setHttpsTransport } from "../scan-core.mjs";

const REAL_TOKEN = process.env.GH_TOKEN;
const REAL_TLS = process.env.SCAN_INSECURE_TLS;

// 桩化传输层：按 scripts 顺序驱动每次 https.request 的结果，
// 记录 Agent 的 rejectUnauthorized（严格/放宽）与每次请求的 url/options。
function stubHttps(t, scripts, opts = {}) {
  process.env.GH_TOKEN = "test-token";
  if (opts.insecureTls) process.env.SCAN_INSECURE_TLS = "1";
  else delete process.env.SCAN_INSECURE_TLS;
  const state = { agents: [], requests: [] };
  const restoreTransport = setHttpsTransport({
    Agent: function (opts) {
      state.agents.push(opts && opts.rejectUnauthorized);
    },
    request: function (url, options, cb) {
      state.requests.push({ url, options });
      const step = scripts[state.requests.length - 1];
      const handlers = {};
      const req = {
        on: (ev, fn) => { handlers[ev] = fn; return req; },
        end: () => {
          setImmediate(() => {
            if (!step) { handlers.error(new Error("缺少桩化响应步骤")); return; }
            if (step.kind === "error") { handlers.error(new Error(step.message)); return; }
            const resHandlers = {};
            const res = { statusCode: step.status, on: (ev, fn) => { resHandlers[ev] = fn; } };
            cb(res);
            setImmediate(() => {
              if (resHandlers.data && step.text != null) resHandlers.data(Buffer.from(step.text));
              if (resHandlers.end) resHandlers.end();
            });
          });
        },
        destroy: () => {},
      };
      return req;
    },
  });
  t.after(() => {
    restoreTransport();
    if (REAL_TOKEN === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = REAL_TOKEN;
    if (REAL_TLS === undefined) delete process.env.SCAN_INSECURE_TLS;
    else process.env.SCAN_INSECURE_TLS = REAL_TLS;
  });
  return state;
}

/* ---------------- 状态码判定与来源决策 ---------------- */

test("directApi：REST 命中 <300 时按 --jq 取字段（严格 TLS，仅一次调用）", async (t) => {
  const s = stubHttps(t, [{ status: 200, text: JSON.stringify({ login: "octo" }) }]);
  const out = await directApi(["api", "user", "--jq", ".login"]);
  assert.equal(out, "octo", "jq 命中字符串应原样返回");
  assert.equal(s.requests.length, 1, "成功响应不应触发任何重试");
  assert.deepEqual(s.agents, [true], "默认应以严格 TLS 建立连接");
  assert.equal(s.requests[0].url, "https://api.github.com/user", "REST 应指向 api.github.com 下的路径");
  assert.equal(s.requests[0].options.headers.Authorization, "Bearer test-token", "应带上令牌头");
});

test("directApi：REST 无 --jq 时返回整体 JSON 字符串", async (t) => {
  const s = stubHttps(t, [{ status: 200, text: JSON.stringify({ workflow_runs: [1, 2, 3] }) }]);
  const out = await directApi(["api", "repos/me/x/actions/runs?per_page=5"]);
  assert.deepEqual(JSON.parse(out), { workflow_runs: [1, 2, 3] });
  assert.equal(s.requests.length, 1);
});

test("directApi：REST 返回 >=300 立即放弃并抛出带状态码错误（不重试）", async (t) => {
  const s = stubHttps(t, [{ status: 404, text: "{}" }]);
  await assert.rejects(
    () => directApi(["api", "repos/me/x/license", "--jq", ".html_url"]),
    /GitHub API HTTP 404\(GH_TOKEN 直连\)/,
  );
  assert.equal(s.requests.length, 1, "失败响应应一次即弃，直连通道不按状态码重试");
  assert.deepEqual(s.agents, [true], "状态码失败不应放宽 TLS");
});

/* ---------------- TLS 严格→放宽的分支选择与重试次数 ---------------- */

test("directApi：设 SCAN_INSECURE_TLS=1 时严格 TLS 遇证书类错误才放宽校验重试一次", async (t) => {
  const s = stubHttps(t, [
    { kind: "error", message: "unable to verify the first certificate" },
    { status: 200, text: JSON.stringify({ login: "octo" }) },
  ], { insecureTls: true });
  const out = await directApi(["api", "user", "--jq", ".login"]);
  assert.equal(out, "octo", "放宽校验后应拿到最终结果");
  assert.equal(s.requests.length, 2, "证书错误应触发恰好一次重试");
  assert.deepEqual(s.agents, [true, false], "先严格、后放宽（rejectUnauthorized: true → false）");
});

test("directApi：放宽校验后仍失败则放弃，不再无限重试（显式开关下）", async (t) => {
  const s = stubHttps(t, [
    { kind: "error", message: "self signed certificate" },
    { kind: "error", message: "self signed certificate" },
  ], { insecureTls: true });
  await assert.rejects(() => directApi(["api", "user"]), /self signed certificate/);
  assert.equal(s.requests.length, 2, "放宽只重试一次，第二次失败即放弃");
  assert.deepEqual(s.agents, [true, false]);
});

test("directApi：未设 SCAN_INSECURE_TLS 时证书类错误直接放弃，不放宽 TLS（R2 P2-4 默认严格）", async (t) => {
  const s = stubHttps(t, [{ kind: "error", message: "unable to verify the first certificate" }]);
  await assert.rejects(() => directApi(["api", "user"]), /unable to verify the first certificate/);
  assert.equal(s.requests.length, 1, "默认严格模式不应触发证书放宽重试");
  assert.deepEqual(s.agents, [true], "仅构造严格校验的 Agent");
});

test("directApi：非证书类网络错误直接放弃，不放宽 TLS", async (t) => {
  const s = stubHttps(t, [{ kind: "error", message: "socket hang up" }]);
  await assert.rejects(() => directApi(["api", "user"]), /socket hang up/);
  assert.equal(s.requests.length, 1, "非证书错误不应触发放宽重试");
  assert.deepEqual(s.agents, [true], "仅构造严格校验的 Agent");
});

/* ---------------- GraphQL 直连分支 ---------------- */

test("directApi：GraphQL 走 POST 并回传解析后的 JSON", async (t) => {
  const s = stubHttps(t, [{ status: 200, text: JSON.stringify({ data: { user: { login: "octo" } } }) }]);
  const out = await directApi(["api", "graphql", "-f", "query=query", "-F", "owner=octo"]);
  assert.deepEqual(JSON.parse(out), { data: { user: { login: "octo" } } });
  assert.equal(s.requests[0].url, "https://api.github.com/graphql");
  assert.equal(s.requests[0].options.method, "POST");
});

test("directApi：GraphQL 状态码 >=300 抛出专用错误", async (t) => {
  const s = stubHttps(t, [{ status: 500, text: "{}" }]);
  await assert.rejects(() => directApi(["api", "graphql", "-f", "query=q"]), /GraphQL 直连响应异常\(HTTP 500\)/);
  assert.equal(s.requests.length, 1, "GraphQL 失败响应同样一次即弃");
});

test("directApi：GraphQL 返回 200 但响应体非 JSON 也按异常处理", async (t) => {
  stubHttps(t, [{ status: 200, text: "not-json" }]);
  await assert.rejects(() => directApi(["api", "graphql", "-f", "query=q"]), /GraphQL 直连响应异常\(HTTP 200\)/);
});

/* ---------------- 无需传输层的兜底边界 ---------------- */

test("directApi：仅支持 api 子命令，非 api 直接抛错（不触碰传输层）", async () => {
  await assert.rejects(() => directApi(["auth", "status"]), /GH_TOKEN 兜底通道仅支持 api 调用/);
});

test("applyJq：非点路径表达式抛错（补齐既有基础用例的边界）", () => {
  assert.equal(applyJq({ a: { b: 1 } }, ".a.b"), 1);
  assert.throws(() => applyJq({}, ".a | .b"), /兜底通道不支持该 --jq 表达式/);
  assert.throws(() => applyJq({}, "length"), /兜底通道不支持该 --jq 表达式/);
});

/* ---------------- BM-6 静态守卫（债#10 防回归，2026-10-15） ---------------- */

test("BM-6 守卫：scan-core.mjs 必须显式 import node:https（防再次依赖全局恰好存在的 https）", async () => {
  const src = await readFile(new URL("../scan-core.mjs", import.meta.url), "utf8");
  assert.match(src, /import\s+https\s+from\s+["']node:https["']/,
    "缺 import 时文件形态实调 directApi 将抛 ReferenceError: https is not defined（tech-debt #10）");
});
