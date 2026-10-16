// scan.mjs 命令行参数闸（shared.mjs 的 resolveCliArgs）单测
// 覆盖：--help/-h 只给用法、未知 -- 参数一律拒绝、有效参数的 mode/owner/localPaths/depth 解析与默认值，
// 以及一条静态守卫：help/unknown 两条路径必须排在任何 collectData 之前
// —— 否则「用法探测」又会变成一次真实远程扫描并重写入库快照（finding: scan-entry-silent-full-scan）。
// 风格沿用 tests/core.test.mjs：node:test + node:assert/strict，直接导入纯函数，不 spawn 扫描入口。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCliArgs, CLI_FLAGS, CLI_USAGE, HERE } from "../shared.mjs";

/* ---------------- help：只打印用法，绝不进入扫描分支 ---------------- */

test("scan CLI：--help 与 -h 返回 help（即使与其他开关混写）", () => {
  assert.deepEqual(resolveCliArgs(["--help"]), { action: "help" });
  assert.deepEqual(resolveCliArgs(["-h"]), { action: "help" });
  assert.deepEqual(resolveCliArgs(["--remote-only", "--help"]), { action: "help" }, "help 必须优先于其它开关");
  assert.deepEqual(resolveCliArgs(["--local", "--help"]), { action: "help" }, "help 优先于未知参数报错");
});

test("scan CLI：用法文本覆盖全部已知开关且不含占位", () => {
  for (const flag of CLI_FLAGS) assert.match(CLI_USAGE, new RegExp(flag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")));
  assert.match(CLI_USAGE, /--help/);
});

/* ---------------- unknown：写错的开关必须报错而不是静默全扫 ---------------- */

test("scan CLI：未知 -- 参数被拒绝并原样列出", () => {
  assert.deepEqual(resolveCliArgs(["--local"]), { action: "unknown", unknown: ["--local"] }, "--local 是常见误写");
  assert.deepEqual(resolveCliArgs(["--help-me"]), { action: "unknown", unknown: ["--help-me"] });
  assert.deepEqual(resolveCliArgs(["--render-only", "--depp", "5"]), { action: "unknown", unknown: ["--depp"] });
});

test("scan CLI：单横线短参除 -h 外不作未知处理（保留 owner 语义）", () => {
  const r = resolveCliArgs(["-x"]);
  assert.equal(r.action, "run", "非 -- 前缀的 token 交由 owner 解析，不当作开关错误");
  assert.equal(r.owner, "-x");
});

/* ---------------- run：保持改造前的解析语义 ---------------- */

test("scan CLI：无参数 = 远程+本地全量扫描", () => {
  const r = resolveCliArgs([]);
  assert.equal(r.action, "run");
  assert.equal(r.mode, "scan");
  assert.equal(r.remoteOnly, false);
  assert.equal(r.owner, undefined);
  assert.equal(r.localPaths, undefined);
  assert.equal(r.depth, 4, "默认深度 4");
});

test("scan CLI：三个互斥开关各自决定 mode", () => {
  assert.equal(resolveCliArgs(["--render-only"]).mode, "render");
  assert.equal(resolveCliArgs(["--local-only"]).mode, "local");
  const remote = resolveCliArgs(["--remote-only"]);
  assert.equal(remote.mode, "scan");
  assert.equal(remote.remoteOnly, true);
  assert.equal(resolveCliArgs(["--render-only", "--local-only"]).mode, "render", "render 优先级与改造前一致");
});

test("scan CLI：owner、--local-paths 取值与 --depth 取值", () => {
  assert.equal(resolveCliArgs(["octocat"]).owner, "octocat");
  const withPaths = resolveCliArgs(["--local-paths", "a；b ; c", "octocat"]);
  assert.deepEqual(withPaths.localPaths, ["a", "b", "c"], "分号支持中英文，逐项 trim");
  assert.equal(withPaths.owner, "octocat", "开关取值位不能被误认成 owner");
  assert.deepEqual(resolveCliArgs(["--local-paths"]).localPaths, [], "缺取值时为空数组而非 undefined");
  assert.equal(resolveCliArgs(["--depth", "6"]).depth, 6);
  assert.equal(resolveCliArgs([], { localScanDepth: 3 }).depth, 3, "本地配置深度作为回退");
  assert.equal(resolveCliArgs([], { localScanDepth: "x" }).depth, 4, "非法配置回退默认 4");
});

/* ---------------- 静态守卫：入口不得在 help/unknown 之前触发扫描 ---------------- */

test("scan CLI：scan.mjs 把 help/unknown 处理排在任何 collectData 之前", () => {
  const src = readFileSync(join(HERE, "scan.mjs"), "utf8");
  const help = src.indexOf('cli.action === "help"');
  const unknown = src.indexOf('cli.action === "unknown"');
  const scan = src.indexOf("collectData(");
  assert.ok(help >= 0 && unknown >= 0, "入口必须显式处理 help 与 unknown");
  assert.ok(scan >= 0, "守卫以 collectData 出现为前提，否则本用例失去意义");
  assert.ok(help < scan, "help 分支必须先于扫描动作返回");
  assert.ok(unknown < scan, "unknown 分支必须先于扫描动作返回");
  assert.match(src, /from "\.\/shared\.mjs"/, "参数解析必须来自 shared.mjs 的纯函数以便离线覆盖");
});
