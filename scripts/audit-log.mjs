// audit-log.mjs —— D9 审计日志（从 scan-core.mjs 外提，债 #9 第三步后半）
//
// 边界（docs/module-boundaries.md）：
// - BM-1：本模块**不触网**、不调 `gh` / `git`；只碰 node:fs + node:crypto；
// - 纯叶子模块：只依赖 node 内建 + `shared.mjs` 的 `HERE`，不 import scan-core。
//
// 口径（R2 P2-8）：结构化 JSONL，不入库（`.gitignore` 已排除 scan-audit.jsonl）。
// 行格式：{ ts, event, owner, mode, source, repos, durationMs, hmac? }
// 防篡改：设 SCAN_AUDIT_KEY 时逐行附 HMAC-SHA256（对 hmac 之前的行体签名）；
// 未设时 hmac 为 null（明文模式，首次写入提示一次）。轮转：超过 AUDIT_MAX 行只保留最近 AUDIT_MAX 行。
// filePath 可注入便于测试，默认写项目根 scan-audit.jsonl。
import { readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import { HERE } from "./shared.mjs";

const AUDIT_FILE = join(HERE, "scan-audit.jsonl");
const AUDIT_MAX = 2000;

export function loadAuditRows(filePath = AUDIT_FILE) {
  try {
    const text = readFileSync(filePath, "utf8");
    const rows = text.split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return rows;
  } catch { return []; }
}

let auditKeyWarned = false;
export function appendAudit(entry, filePath = AUDIT_FILE) {
  try {
    const line = JSON.stringify(entry);
    let hmac = null;
    const key = process.env.SCAN_AUDIT_KEY;
    if (key) hmac = createHmac("sha256", key).update(line).digest("hex");
    else if (!auditKeyWarned) {
      auditKeyWarned = true;
      console.log("? 审计日志为明文模式（未设 SCAN_AUDIT_KEY）：设置该环境变量可启用逐行 HMAC 防篡改");
    }
    const row = { ...entry, hmac };
    const rows = loadAuditRows(filePath);
    rows.push(row);
    const kept = rows.slice(-AUDIT_MAX);
    writeFileSync(filePath, kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : ""), "utf8");
    return row;
  } catch { return null; }
}
