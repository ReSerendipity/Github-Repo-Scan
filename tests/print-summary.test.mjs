// printSummary 的 CLI 可读性回归：健康分/等级必须出现在每个仓库行。
import assert from "node:assert/strict";
import test from "node:test";
import { printSummary } from "../scripts/scan-core.mjs";

function capture(fn) {
  const lines = [];
  const old = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try { fn(); } finally { console.log = old; }
  return lines.join("\n");
}

const data = {
  totals: { repos: 1, stars: 3, forks: 0, openIssues: 0, openPRs: 0, releases: 0, ciOk: 1, ciDone: 1 },
  rows: [{
    name: "demo", stars: 3, forks: 0, openIssues: 0, openPRs: 0, license: "MIT",
    defaultBranch: "main", branches: 2, ci: { state: "success", cls: "ok", trend: [] },
    pushedAt: new Date().toISOString(), latestRelease: null, releases: 0, isArchived: false,
  }],
};

test("printSummary 每行带健康分与等级", () => {
  const out = capture(() => printSummary(data));
  const row = out.split("\n").find((line) => line.includes("demo"));
  assert.ok(row, "应输出仓库行");
  assert.match(row, /健康:\d+\((A|B|C|D)\)/, "仓库行应包含 健康:<score>(<grade>)");
  assert.match(row, /健康:88\(A\)/, "刚推送、成功 CI、无 Release 的仓库应为 88(A)");
  assert.match(out, /健康分布：A 1 · B 0 · C 0 · D 0/, "摘要应输出等级分布");
});
