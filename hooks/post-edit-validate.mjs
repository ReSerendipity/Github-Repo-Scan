// hooks/post-edit-validate.mjs —— Agent 生命周期钩子：核心模块被编辑后立即跑冒烟测试
// 注册位置：.qoder/settings.json 的 hooks.PostToolUse（写/编辑类工具）。事件 JSON 由 stdin 传入。
// 退出码：0 放行；2 阻断并把失败摘要写入 stderr 回喂 agent（对应 AGENTS.md「编辑后即时验证」）。
// 命名约束：文件名不得匹配 node --test 的发现模式（*-test.mjs / *.test.mjs），否则会被测试执行。
// 设计约束：不相关编辑零开销退出；读不到/解析不了事件、找不到 node、stdin 是终端时一律 fail-open，
// 绝不把钩子变成 agent 的新故障源。策略函数全部导出，便于用 fixture JSON 做单元验证。
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HOOK_DIR, "..");

/* 与 AGENTS.md 同一份「核心模块」定义：改这些文件必须立刻验证
   server.mjs 于 2026-10-16 纳入：它是面板后端入口、含来源校验与扫描根白名单，
   且已有 tests/server-security.test.mjs 覆盖——过去只改它不会触发任何近端验证。 */
export const CORE_FILES = ["scan-core.mjs", "render-dashboard.mjs", "shared.mjs", "server.mjs"];
export const CORE_DIRS = ["assets", "tests"];

/* 主机的编辑类工具字段名不统一（file_path / path / notebook_path / edits[].path），全部兼容取路径 */
export function extractEditedPaths(payload) {
  const out = [];
  const push = (v) => { if (typeof v === "string" && v.trim()) out.push(v.trim()); };
  const input = (payload && (payload.tool_input ?? payload.toolInput ?? payload.input)) || {};
  const edits = Array.isArray(input.edits) ? input.edits : (Array.isArray(payload?.edits) ? payload.edits : []);
  push(input.file_path); push(input.filePath); push(input.path); push(input.notebook_path);
  for (const e of edits) { push(e?.path); push(e?.file_path); }
  if (!out.length && typeof payload?.file_path === "string") push(payload.file_path);
  return out;
}

/* 仓库内相对路径（统一 / 分隔）；仓库外或以 .. 开头返回 null，交由调用方跳过 */
export function toRepoRel(p, root = REPO_ROOT) {
  const abs = isAbsolute(p) ? resolve(p) : resolve(root, p);
  const rel = relative(root, abs).split(sep).join("/");
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return rel;
}

export function isCoreTarget(rel) {
  if (!rel) return false;
  if (CORE_FILES.includes(rel)) return true;
  return CORE_DIRS.some((d) => rel === d || rel.startsWith(d + "/"));
}

/* 返回本次事件中命中的核心模块相对路径（空数组 = 无需验证） */
export function matchedCoreTargets(payload, root = REPO_ROOT) {
  const targets = [];
  for (const p of extractEditedPaths(payload)) {
    const rel = toRepoRel(p, root);
    if (isCoreTarget(rel) && !targets.includes(rel)) targets.push(rel);
  }
  return targets;
}

const ANSI = /\u001b\[[0-9;]*m/g;
/* 从测试输出里挑可定位的失败行 + 计数摘要，压缩成给 agent 的短反馈（不回显原始日志） */
export function summarizeFailure(raw, maxLines = 20) {
  const text = String(raw || "").replace(ANSI, "");
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const keep = lines.filter((l) => /(^|\s)(✖|✗|not ok\b)|AssertionError|Error:|ℹ\s+(tests|pass|fail)\s|^\s*(Expected|Actual|desired|received)/i.test(l));
  const picked = (keep.length ? keep : lines.slice(-maxLines)).slice(0, maxLines);
  return picked.join("\n");
}

export function passCount(raw) {
  const m = String(raw || "").replace(ANSI, "").match(/ℹ\s+pass\s+(\d+)/);
  return m ? m[1] : null;
}

export function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8");
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function main(event) {
  const payload = event ?? readStdinJson();
  if (!payload) return 0;
  const targets = matchedCoreTargets(payload);
  if (!targets.length) return 0;

  const run = spawnSync(process.execPath, ["--test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, POST_EDIT_VALIDATE_NESTED: "1" },
  });
  if (run.error) {
    process.stderr.write(`[post-edit-validate] ! 无法执行 node --test（${run.error.message}），已放行；请手动运行该命令验证 ${targets.join(", ")}\n`);
    return 0;
  }
  const merged = `${run.stdout || ""}\n${run.stderr || ""}`;
  if (run.status === 0) {
    const n = passCount(merged);
    process.stdout.write(`[post-edit-validate] ✓ ${targets.join(", ")} 编辑后 node --test 通过${n ? `（${n} 项）` : ""}\n`);
    return 0;
  }
  process.stderr.write(
    `[post-edit-validate] ✗ 编辑了核心模块（${targets.join(", ")}）且 node --test 失败，已阻断。请按下方 文件:行 与断言差异修复后重新保存；不要带着失败继续交付。\n`
    + summarizeFailure(merged) + "\n"
  );
  return 2;
}

/* 仅作为钩子脚本直接执行时才读 stdin 并运行：被 import 进测试、或 stdin 是终端时都不阻塞 */
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  if (process.env.POST_EDIT_VALIDATE_NESTED === "1" || process.stdin.isTTY) process.exit(0);
  process.exit(main());
}
