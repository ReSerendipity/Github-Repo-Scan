// 编辑后即时验证钩子（hooks/post-edit-validate.mjs）的策略单测
// 覆盖：核心模块命中判定、多种主机事件字段形态、仓库外/备份文件不触发、失败摘要与计数解析、
// 以及真实执行入口的 fail-open（畸形事件与非核心编辑必须零开销退出，不跑测试）。
// 风格沿用 tests/core.test.mjs：node:test + node:assert/strict，直接导入模块导出的纯函数。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  REPO_ROOT, CORE_FILES, matchedCoreTargets, isCoreTarget, toRepoRel,
  summarizeFailure, passCount,
} from "../hooks/post-edit-validate.mjs";

const HOOK = join(REPO_ROOT, "hooks", "post-edit-validate.mjs");

/* ---------------- 命中判定：只有核心模块编辑才触发验证 ---------------- */

test("post-edit 钩子：绝对路径编辑核心模块应命中", () => {
  for (const f of CORE_FILES) {
    const hit = matchedCoreTargets({ tool_name: "Edit", tool_input: { file_path: `${REPO_ROOT}/${f}` } });
    assert.deepEqual(hit, [f], `${f} 属于 AGENTS.md 定义的核心模块`);
  }
  assert.deepEqual(matchedCoreTargets({ tool_input: { file_path: `${REPO_ROOT}/assets/dashboard-client.js` } }), ["assets/dashboard-client.js"]);
  assert.deepEqual(matchedCoreTargets({ tool_input: { file_path: `${REPO_ROOT}/tests/core.test.mjs` } }), ["tests/core.test.mjs"]);
});

test("post-edit 钩子：兼容主机各异的字段形态", () => {
  assert.deepEqual(matchedCoreTargets({ tool_input: { path: "scan-core.mjs" } }), ["scan-core.mjs"], "相对路径同样应解析到仓库根");
  assert.deepEqual(matchedCoreTargets({ toolInput: { filePath: "shared.mjs" } }), ["shared.mjs"], "驼峰字段");
  assert.deepEqual(matchedCoreTargets({ tool_input: { edits: [{ path: "render-dashboard.mjs" }] } }), ["render-dashboard.mjs"], "批量 edits 形态");
  assert.deepEqual(matchedCoreTargets({ file_path: "scan-core.mjs" }), ["scan-core.mjs"], "顶层 file_path 兜底");
});

test("post-edit 钩子：非核心编辑、仓库外路径与备份文件都不触发", () => {
  assert.deepEqual(matchedCoreTargets({ tool_input: { file_path: `${REPO_ROOT}/README.md` } }), []);
  assert.deepEqual(matchedCoreTargets({ tool_input: { file_path: `${REPO_ROOT}/scan-data.json` } }), []);
  assert.deepEqual(matchedCoreTargets({ tool_input: { file_path: `${REPO_ROOT}/hooks/pre-push` } }), [], "钩子自身改动不应触发测试");
  assert.deepEqual(matchedCoreTargets({ tool_input: { file_path: `${REPO_ROOT}/scan-core.mjs.bak-20260929194141` } }), [], "备份文件不是核心模块");
  assert.deepEqual(matchedCoreTargets({ tool_input: { file_path: "C:\\Users\\someone\\other\\scan-core.mjs" } }), [], "仓库外同名文件不越界触发");
  assert.equal(toRepoRel("../outside/scan-core.mjs"), null);
  assert.equal(isCoreTarget("assets"), true, "目录本身也算核心区");
});

/* ---------------- 失败摘要：只回喂可定位信息，不倾倒原始日志 ---------------- */

test("post-edit 钩子：失败摘要保留失败行与计数并剥离 ANSI", () => {
  const sample = [
    "\u001b[31m✖ relTime：相对时间分档 (2.1ms)\u001b[39m",
    "  AssertionError [ERR_ASSERTION]: Expected values to be equal:",
    "    actual: '3 天前'",
    "ℹ tests 44",
    "ℹ pass 43",
    "ℹ fail 1",
  ].join("\n");
  const summary = summarizeFailure(sample);
  assert.match(summary, /✖ relTime：相对时间分档/);
  assert.match(summary, /AssertionError/);
  assert.match(summary, /ℹ fail 1/);
  assert.ok(!summary.includes("\u001b["), "不应把转义序列送进 agent 上下文");
  assert.equal(passCount(sample), "43");
  assert.equal(passCount("no counters here"), null);
});

/* ---------------- 真实执行入口：fail-open 与零开销退出 ---------------- */

test("post-edit 钩子：畸形或空事件按放行退出（fail-open）", () => {
  for (const input of ["", "   ", "{not-json", "null"]) {
    const r = spawnSync(process.execPath, [HOOK], { input, encoding: "utf8", cwd: REPO_ROOT });
    assert.equal(r.status, 0, `输入 ${JSON.stringify(input)} 应退出 0`);
    assert.equal(r.stdout, "");
  }
});

test("post-edit 钩子：非核心编辑立即退出，不运行 node --test", () => {
  const event = JSON.stringify({ tool_name: "Write", tool_input: { file_path: `${REPO_ROOT}/scan-config.json` } });
  const r = spawnSync(process.execPath, [HOOK], { input: event, encoding: "utf8", cwd: REPO_ROOT });
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, "", "未命中核心模块时必须零输出、零测试开销");
});

test("post-edit 钩子：脚本名不得匹配 node --test 的发现模式", () => {
  // 命中这些模式会被测试执行器直接跑起来，脚本随即阻塞在读 stdin（已在改名前踩过一次）
  const base = HOOK.split(/[\\/]/).pop();
  assert.doesNotMatch(base, /\.test\.mjs$/);
  assert.doesNotMatch(base, /[-_]test\.mjs$/);
  assert.doesNotMatch(base, /^test[-_]/);
  assert.equal(base, "post-edit-validate.mjs");
});
