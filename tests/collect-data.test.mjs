// collectData / ghAsync 编排与降级链桩测（对应 Flash 修复 测试P1-3，2026-10-15）
// 手段：PATH 隔离使 gh 子进程必然 ENOENT → ghAsync 走 GH_TOKEN 直连兜底（canDirectFallback 决策被守护）；
//       传输层经 setHttpsTransport 显式注入（debt#10 修复后的正式接口），按 URL 分发脚本化响应。
// 全离线：不触网、不依赖真实凭据、不读真实 gh 登录态；仓库取数不落盘（collectData 只返回内存 data）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectData, ghAsync, setHttpsTransport } from "../scripts/scan-core.mjs";

const REAL_PATH = process.env.PATH;
const REAL_TOKEN = process.env.GH_TOKEN;
const REAL_GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REAL_TLS = process.env.SCAN_INSECURE_TLS;

/* 保存现场并在用例后恢复：PATH 隔离 + 凭据 + 传输层注入三件套 */
function isolate(t) {
  const sandbox = mkdtempSync(join(tmpdir(), "ghrs-isolate-"));
  process.env.PATH = sandbox; // 空目录：gh / git 均不可执行 → execFile ENOENT
  delete process.env.SCAN_INSECURE_TLS;
  t.after(() => {
    process.env.PATH = REAL_PATH;
    if (REAL_TOKEN === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = REAL_TOKEN;
    if (REAL_GITHUB_TOKEN === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = REAL_GITHUB_TOKEN;
    if (REAL_TLS === undefined) delete process.env.SCAN_INSECURE_TLS; else process.env.SCAN_INSECURE_TLS = REAL_TLS;
    rmSync(sandbox, { recursive: true, force: true });
  });
  return sandbox;
}

function setToken(v) {
  process.env.GH_TOKEN = v;
  delete process.env.GITHUB_TOKEN;
}

/* 按调用顺序分发响应的最小传输桩（形状与 node:https 一致：Agent + request） */
function scriptHttps(t, handlers) {
  const state = { requests: [] };
  const restore = setHttpsTransport({
    Agent: function () {},
    request: function (url, options, cb) {
      state.requests.push({ url, options });
      const hit = handlers.find((h) => h.match(url)) || { status: 404, text: "{}" };
      const resHandlers = {};
      const res = { statusCode: hit.status, on: (ev, fn) => { resHandlers[ev] = fn; } };
      setImmediate(() => {
        cb(res);
        setImmediate(() => {
          if (resHandlers.data && hit.text != null) resHandlers.data(Buffer.from(hit.text));
          if (resHandlers.end) resHandlers.end();
        });
      });
      return { on: () => {}, end: () => {}, destroy: () => {} };
    },
  });
  t.after(restore);
  return state;
}

const ISO = (days) => new Date(Date.now() - days * 86400000).toISOString();
const REPO_NODE = {
  name: "demo-collect", description: "编排桩测样本仓", url: "https://github.com/octo/demo-collect",
  visibility: "PUBLIC", isArchived: false, isFork: false,
  createdAt: ISO(400), pushedAt: ISO(1), stargazerCount: 3, forkCount: 1, diskUsage: 128,
  primaryLanguage: { name: "TypeScript" }, licenseInfo: null, defaultBranchRef: { name: "main" },
  issues: { totalCount: 2 }, pullRequests: { totalCount: 1 }, refs: { totalCount: 1, nodes: [{ name: "main" }] },
  releases: { totalCount: 0 }, latestRelease: null,
};

/* ---------------- ghAsync 降级决策链 ---------------- */

test("ghAsync：gh 不可用（ENOENT）且设 GH_TOKEN → 自动走直连兜底并返回结果", async (t) => {
  isolate(t);
  setToken("test-token");
  scriptHttps(t, [
    { match: (u) => u === "https://api.github.com/user", status: 200, text: JSON.stringify({ login: "octo" }) },
  ]);
  const out = await ghAsync(["api", "user", "--jq", ".login"]);
  assert.equal(out, "octo", "兜底通道应完成本次取数（gh ENOENT → directApi）");
});

test("ghAsync：gh 不可用且无任何 token → 不兜底，直接抛出原始错误", async (t) => {
  isolate(t);
  delete process.env.GH_TOKEN;
  delete process.env.GITHUB_TOKEN;
  scriptHttps(t, []); // 不应被调用；若被调用会因缺桩步骤失败，从而暴露兜底误触发
  await assert.rejects(() => ghAsync(["api", "user"]), /ENOENT/);
});

/* ---------------- collectData 全编排（分页 → 深扫 → 汇总契约） ---------------- */

test("collectData：单页单仓全量编排的字段契约与 scanInfo 统计", async (t) => {
  isolate(t);
  setToken("test-token");
  const state = scriptHttps(t, [
    { match: (u) => u === "https://api.github.com/user", status: 200, text: JSON.stringify({ login: "octo" }) },
    { match: (u) => u.includes("/graphql"), status: 200, text: JSON.stringify({
        data: { user: { login: "octo", avatarUrl: "", repositories: {
          totalCount: 1, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [REPO_NODE] } } } }) },
    { match: (u) => u.includes("/actions/runs"), status: 200, text: JSON.stringify({ workflow_runs: [] }) },
    { match: (u) => u.includes("/commits"), status: 200, text: JSON.stringify([]) },
    { match: (u) => u.includes("/git/trees"), status: 200, text: JSON.stringify({ tree: [] }) },
    { match: (u) => u.includes("/rate_limit"), status: 200, text: JSON.stringify({ resources: { core: { limit: 5000, remaining: 4999, reset: 1789999999 } } }) },
  ]);
  const data = await collectData("octo", { local: false });

  assert.equal(data.schema, 3);
  assert.equal(data.owner, "octo");
  assert.equal(data.truncated, false);
  assert.equal(data.totals.repos, 1);
  assert.equal(data.totals.stars, 3);
  assert.equal(data.totals.openIssues, 2);
  const row = data.rows[0];
  assert.equal(row.name, "demo-collect");
  assert.equal(row.pushedAt, REPO_NODE.pushedAt);
  assert.equal(row.license, null, "licenseInfo 为 null → 不再请求 license 接口");
  assert.equal(row.ci.state, "无 CI 记录", "workflow_runs 为空 → 无 CI 记录");
  assert.equal(row.ci.cls, "none");
  assert.equal(row.cli.state, "无", "文件树为空 → CLI 三态判定为「无」");
  assert.equal(data.scanInfo.mode, "incremental");
  assert.equal(data.scanInfo.deepScanned, 1);
  assert.equal(data.scanInfo.reused, 0);
  assert.equal(data.localScan, null, "opts.local=false → 不做本地对照");
  assert.equal(data.rate.remaining, 4999);
  // 编排内请求次数守卫：显式传 owner 时跳过 /user 探测（collectData 内 ownerArg || ...），实际序 = graphql + actions + commits + trees + rate_limit = 5；不得有 license/contents 等多余请求
  assert.equal(state.requests.length, 5, "实际请求序（显式 owner 跳过 /user 探测）：" + state.requests.map((r) => r.url).join(", "));
});
