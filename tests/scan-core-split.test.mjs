// 债 #9 拆分门禁：scan-core.mjs 的 D3 / D7 / D9 已外提，这份用例钉「外提是真外提」而不是把实现复制一份留在原处。
//
// 为什么需要这份用例（而不是靠 core.test.mjs 的既有 77 条）：
// - 既有用例全部从 `scripts/scan-core.mjs` 取符号，它们只能证明**门面**还工作，证明不了实现已经搬走；
// - 一次「复制而不是搬走」的重构，旧测试照样全绿，而职责集中一点没变 —— 那正是债 #9 要解决的问题；
// - 所以这里补三类判据：① 身份（scan-core 导出的必须是新模块里的**同一个函数对象**）；② 结构（scan-core 里不得再有这些定义、新模块不得反向 import scan-core、不得触网）；③ 行为抽样（真读文件树 / 真算周增 / 真写审计并复算 HMAC）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createHmac } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as core from "../scripts/scan-core.mjs";
import * as cliDetect from "../scripts/cli-detect.mjs";
import * as starHistory from "../scripts/star-history.mjs";
import * as auditLog from "../scripts/audit-log.mjs";

const HERE = new URL("..", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, HERE), "utf8");

const D3 = ["manifestCliDetail", "classifyCli", "detectCliLocal", "detectCliRemote"];
const D7 = ["loadStarHistory", "recordStarHistory", "computeStarWeek"];
const D9 = ["loadAuditRows", "appendAudit"];

/* ---------------- ① 身份：门面转发的是同一对象，不是同名副本 ---------------- */

test("D3/D7/D9 九个符号在 scan-core 上就是新模块的同一函数对象（不是复制一份）", () => {
  const pairs = [
    ...D3.map((n) => [n, cliDetect]),
    ...D7.map((n) => [n, starHistory]),
    ...D9.map((n) => [n, auditLog]),
  ];
  for (const [name, mod] of pairs) {
    assert.equal(typeof mod[name], "function", `${name} 必须由外提模块导出`);
    assert.equal(core[name], mod[name], `${name} 必须与 ${name} 所在模块是同一函数对象（复制实现会让这条断言红）`);
  }
});

test("外提模块导出的符号数固定，避免顺手把私有不变量漏成公共 API", () => {
  assert.deepEqual(Object.keys(cliDetect).sort(), [...D3, "CLI_MANIFESTS"].sort());
  assert.deepEqual(Object.keys(starHistory).sort(), [...D7].sort());
  assert.deepEqual(Object.keys(auditLog).sort(), [...D9].sort());
});

/* ---------------- ② 结构：定义不在 scan-core，模块不反向依赖、不触网 ---------------- */

test("scan-core.mjs 里不再留 D3/D7/D9 的任何本地定义（防「复制式拆分」）", () => {
  const src = read("scripts/scan-core.mjs");
  for (const name of [...D3, ...D7, ...D9]) {
    const re = new RegExp(`(^|\\n)\\s*(export\\s+)?function\\s+${name}\\b`);
    assert.ok(!re.test(src), `scan-core.mjs 仍定义 ${name}：实现没搬走`);
  }
  // 口径数据也不能在 scan-core 里留副本（CLI_MANIFESTS 只允许以 import 别名出现）
  assert.ok(!/const\s+CLI_MANIFESTS\b/.test(src), "scan-core.mjs 仍自带 CLI_MANIFESTS 副本，口径会分叉");
});

test("三个外提模块不得反向 import scan-core（防环）", () => {
  for (const rel of ["scripts/cli-detect.mjs", "scripts/star-history.mjs", "scripts/audit-log.mjs"]) {
    assert.ok(!read(rel).includes('from "./scan-core.mjs"'), `${rel} 反向依赖 scan-core，会形成环`);
  }
});

test("BM-1：三个外提模块不得触网或调 gh/git（它们都是纯本地域）", () => {
  const banned = [/node:https/, /node:http\b/, /execFile/, /spawnSync/, /\bghAsync\b/, /github-fetch/];
  for (const rel of ["scripts/cli-detect.mjs", "scripts/star-history.mjs", "scripts/audit-log.mjs"]) {
    const src = read(rel);
    for (const re of banned) assert.ok(!re.test(src), `${rel} 命中 ${re}：纯本地域引入了 IO/网络依赖`);
  }
});

test("行数棘轮：scan-core.mjs ≤ 700 行（D3/D7/D9 外提后 689，回填即红）", () => {
  const lines = read("scripts/scan-core.mjs").split("\n").length - 1;
  assert.ok(lines <= 700, `scan-core.mjs 现 ${lines} 行，超过 700 行棘轮——是否又把实现搬回来了？`);
});

/* ---------------- ③ 行为抽样：真读盘 / 真算 / 真写 ---------------- */

test("detectCliLocal 三态判定（真文件树，不桩）", () => {
  const root = mkdtempSync(join(tmpdir(), "grs-cli-"));
  try {
    // CLI：根 package.json 带 bin
    const a = join(root, "a");
    mkdirSync(a);
    writeFileSync(join(a, "package.json"), JSON.stringify({ name: "a", bin: { a: "cli.js" } }), "utf8");
    const ra = cliDetect.detectCliLocal(a);
    assert.equal(ra.state, "CLI");
    assert.equal(ra.src, "local");

    // 脚本集：只有 scripts/ 目录，无入口命名文件
    const b = join(root, "b");
    mkdirSync(join(b, "scripts"), { recursive: true });
    writeFileSync(join(b, "scripts", "helper.py"), "print(1)\n", "utf8");
    const rb = cliDetect.detectCliLocal(b);
    assert.equal(rb.state, "脚本集");

    // 无：空目录
    const c = join(root, "c");
    mkdirSync(c);
    assert.equal(cliDetect.detectCliLocal(c).state, "无");

    // 入口文件优先：scripts/cli.py 命中入口命名，从「脚本集」升级为 CLI
    const d = join(root, "d");
    mkdirSync(join(d, "scripts"), { recursive: true });
    writeFileSync(join(d, "scripts", "cli.py"), "print(1)\n", "utf8");
    const rd = cliDetect.detectCliLocal(d);
    assert.equal(rd.state, "CLI");
    assert.match(String(rd.detail), /入口文件: scripts\/cli\.py/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("computeStarWeek：有 7 天前基线才算差值，历史不足 6 天一律 null（不编造）", () => {
  const now = "2026-11-08T00:00:00.000Z";
  const rows = [{ name: "repo-a", stars: 120 }, { name: "repo-b", stars: 7 }];

  const withBase = starHistory.computeStarWeek(
    { scannedAt: now, rows: rows.map((r) => ({ ...r })) },
    [{ t: "2026-11-01T00:00:00.000Z", repos: { "repo-a": 100 } }],
  );
  assert.equal(withBase.starWeekRef, "2026-11-01T00:00:00.000Z");
  assert.equal(withBase.rows[0].starWeek, 20);
  assert.equal(withBase.rows[1].starWeek, null, "基线里没有的仓不得给出 0 或编造值");

  const tooShallow = starHistory.computeStarWeek(
    { scannedAt: now, rows: rows.map((r) => ({ ...r })) },
    [{ t: "2026-11-05T00:00:00.000Z", repos: { "repo-a": 100 } }],
  );
  assert.equal(tooShallow.starWeekRef, null, "不足 6 天的基线不算周增");
  assert.deepEqual(tooShallow.rows.map((r) => r.starWeek), [null, null]);
});

test("appendAudit / loadAuditRows：设了 SCAN_AUDIT_KEY 就能逐行复算 HMAC，未设则为 null", () => {
  const dir = mkdtempSync(join(tmpdir(), "grs-audit-"));
  const file = join(dir, "audit.jsonl");
  try {
    const prev = process.env.SCAN_AUDIT_KEY;
    process.env.SCAN_AUDIT_KEY = "test-key";
    const entry = { ts: "t1", event: "scan_completed", repos: 3 };
    const row = auditLog.appendAudit(entry, file);
    assert.equal(row.hmac, createHmac("sha256", "test-key").update(JSON.stringify(entry)).digest("hex"), "HMAC 必须覆盖 hmac 之前的行体");

    const rows = auditLog.loadAuditRows(file);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].event, "scan_completed");

    delete process.env.SCAN_AUDIT_KEY;
    const plain = auditLog.appendAudit({ ts: "t2", event: "scan_completed" }, file);
    assert.equal(plain.hmac, null, "未设密钥时不得伪装成已签名");
    assert.equal(auditLog.loadAuditRows(file).length, 2, "明文行同样要落盘（不是静默丢弃）");

    if (prev === undefined) delete process.env.SCAN_AUDIT_KEY; else process.env.SCAN_AUDIT_KEY = prev;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
