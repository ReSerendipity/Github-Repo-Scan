# Github-Repo-Scan 技术债登记表（tech-debt）

> 依据评估报告 P1-3「技术债隐形化」建立：让债可见、可排期、可偿还。
> 优先级沿用报告口径：P0=立即阻断 / P1=近期待还 / P2=可缓但须登记。状态：待偿清 / 修复中 / 已偿清 / 需人工决策。

| # | 债项 | 证据（可指认） | 影响 | 偿还成本 | 优先级 | 处置准则 | 状态 |
|---|---|---|---|---|---|---|---|
| 1 | 根目录残留核心备份文件 ×2 | `scan-core.mjs.bak-20260924113023`（113KB）、`scan-core.mjs.bak-20260929194141`（133KB），靠 `*.bak-*` gitignore 兜底 | 源码根目录混杂备份；无轮换/恢复策略，易误提交、占用目录 | 低（移动或删除） | P2 | 本落地全部完成后 ≥1 个月（回滚窗口过后）清理，或按用户备份习惯移入备份目录；删除前确认无回滚需求 | 待偿清 |
| 2 | AI 评审工具产物入库 | `.qoder/better-harness/2026-09-23/085241-github-repo-scan/`（canvas.json / findings.json / report.canvas.tsx，被 git 跟踪，含本机路径引用 `~/.qoder/plugins/...`） | 工具产物与产品代码混库；含机器相关路径，易误导协作者 | 低（git rm 后可回溯） | P2 | 是否移出版本库由仓库 owner 决策（属删除跟踪文件，需人工确认）；移出后历史仍可回溯 | 需人工决策 |
| 3 | fmtSize 双份实现 | 服务端 `shared.mjs` 导出 `fmtSize`；客户端 `assets/dashboard-client.js` 内另有 `function fmtSize` 副本（line ~1488） | 改口径需两处同步，属复制粘贴式小债；当前行为一致 | 低 | P2 | 保持现状（客户端不可 import 服务端模块），若口径变更须双处同步并更新 `tests/core.test.mjs` 断言 | 待偿清 |
| 4 | Node 版本基线不一致 | readme「前置：Node 18+」vs `.github/workflows/release.yml` `node-version: 22` | 本地运行与 CI 验证版本漂移风险 | 极低（文档声明） | P2 | 统一声明：Node ≥18 运行、CI 以 22 验证（P2-1 任务落地即偿清） | 修复中 |
| 5 | 生成物快照入库产生大 diff | `scan-data.json` 单次扫描 ±3112 行、`dashboard.html`、`all_repos_report.txt`、`scan_run*.txt` 均被跟踪 | 提交噪声、评审负担；与代码变更耦合 | 中（迁移成本） | P2 | 策略已定：保留回溯价值、接受大 diff、快照与代码分批提交（见 `DOCS/adr/0003-snapshot-committing.md`） | 已偿清（策略落地） |
| 6 | 文档声明与实际文件漂移（历史遗留，已修复） | `AGENTS.md` 曾引用不存在的 `CHANGELOG.md` | AI/协作者按声明找不到文档 | 极低 | P2 | 已随 P1-1 修正：改为指向 `DOCS/adr/` 与 `DOCS/tech-debt.md` | 已偿清 |

---

**偿清节奏**：本表随评估/落地周期刷新；新识别的债项须在「影响/成本/优先级」三列补齐后登记，禁止只列标题。
