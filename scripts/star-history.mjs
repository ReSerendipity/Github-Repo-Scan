// star-history.mjs —— D7 Star 历史与周增（从 scan-core.mjs 外提，债 #9 第三步前半）
//
// 边界（docs/module-boundaries.md）：
// - BM-1：本模块**不触网**、不调 `gh` / `git`，只读写项目根下的 `scan-data-history.json`；
// - 纯叶子模块：只依赖 node 内建 + `shared.mjs` 的 `HERE`（定位项目根），不 import scan-core。
//
// 口径：按自然日去重（同日多次扫描只留最后一次）；超过 HISTORY_MAX 条只保留最近若干条；
// 历史不足 6 天时 `starWeek` 一律置 null（不编造数据）。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HERE } from "./shared.mjs";

const HISTORY_FILE = join(HERE, "scan-data-history.json");
const HISTORY_MAX = 400; // 约 > 1 年（按天去重后）

export function loadStarHistory() {
  try {
    const h = JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
    return Array.isArray(h) ? h : [];
  } catch { return []; }
}

// 记录一次扫描快照（按自然日去重，仅远程全量扫描调用）
export function recordStarHistory(data) {
  const t = data.scannedAt || new Date().toISOString();
  const day = String(t).slice(0, 10);
  const repos = {};
  for (const r of data.rows || []) repos[r.name] = r.stars || 0;
  let hist = loadStarHistory();
  const idx = hist.findIndex((e) => String(e.t).slice(0, 10) === day);
  const entry = { t, repos };
  if (idx >= 0) hist[idx] = entry; else hist.push(entry);
  hist.sort((a, b) => new Date(a.t) - new Date(b.t));
  if (hist.length > HISTORY_MAX) hist = hist.slice(hist.length - HISTORY_MAX);
  writeFileSync(HISTORY_FILE, JSON.stringify(hist), "utf8");
  return hist;
}

// 计算每个仓库近 7 天 Star 增量，写入 r.starWeek 与 data.starWeekRef
// hist 可外部注入（便于测试），默认从本地历史文件读取；历史不足 6 天则全部置 null（不编造数据）
export function computeStarWeek(data, hist) {
  hist = hist || loadStarHistory();
  const now = new Date(data.scannedAt || Date.now()).getTime();
  const target = now - 7 * 86400000;
  let chosen = null;
  for (const e of hist) {
    const et = new Date(e.t).getTime();
    if (et <= target) {
      if (!chosen || et > new Date(chosen.t).getTime()) chosen = e;
    }
  }
  if (chosen && (now - new Date(chosen.t).getTime()) >= 6 * 86400000) {
    data.starWeekRef = chosen.t;
    for (const r of data.rows || []) {
      const prev = chosen.repos[r.name];
      r.starWeek = (typeof prev === "number") ? (r.stars || 0) - prev : null;
    }
  } else {
    data.starWeekRef = null;
    for (const r of data.rows || []) r.starWeek = null;
  }
  return data;
}
