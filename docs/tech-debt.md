# Github-Repo-Scan 技术债登记表（tech-debt）

> 依据评估报告 P1-3「技术债隐形化」建立：让债可见、可排期、可偿还。
> 优先级沿用报告口径：P0=立即阻断 / P1=近期待还 / P2=可缓但须登记。状态：待偿清 / 修复中 / 已偿清 / 需人工决策。

| # | 债项 | 证据（可指认） | 影响 | 偿还成本 | 优先级 | 处置准则 | 状态 |
|---|---|---|---|---|---|---|---|
| 1 | 根目录残留核心备份文件 ×2 | `scan-core.mjs.bak-20260924113023`（113KB）、`scan-core.mjs.bak-20260929194141`（133KB），靠 `*.bak-*` gitignore 兜底 | 源码根目录混杂备份；无轮换/恢复策略，易误提交、占用目录 | 低（移动或删除） | P2 | 本落地全部完成后 ≥1 个月（回滚窗口过后）清理，或按用户备份习惯移入备份目录；删除前确认无回滚需求 | 待偿清 |
| 2 | AI 评审工具产物入库 | `.qoder/better-harness/2026-09-23/085241-github-repo-scan/`（canvas.json / findings.json / report.canvas.tsx，被 git 跟踪，含本机路径引用 `~/.qoder/plugins/...`） | 工具产物与产品代码混库；含机器相关路径，易误导协作者 | 低（git rm 后可回溯） | P2 | 是否移出版本库由仓库 owner 决策（属删除跟踪文件，需人工确认）；移出后历史仍可回溯 | 需人工决策 |
| 3 | fmtSize 双份实现 | 服务端 `shared.mjs` 导出 `fmtSize`；客户端 `assets/dashboard-client.js` 内另有 `function fmtSize` 副本（line ~1488） | 改口径需两处同步，属复制粘贴式小债；当前行为一致 | 低 | P2 | 保持现状（客户端不可 import 服务端模块），若口径变更须双处同步并更新 `tests/core.test.mjs` 断言 | 待偿清 |
| 4 | Node 版本基线不一致 | readme「前置：Node 18+」vs `.github/workflows/release.yml` `node-version: 22` | 本地运行与 CI 验证版本漂移风险 | 极低（文档声明） | P2 | 已统一声明：Node ≥18 运行、CI 以 22 验证（readme「依赖说明」段） | 已偿清 |
| 5 | 生成物快照入库产生大 diff | `scan-data.json` 单次扫描 ±3112 行、`dashboard.html`、`all_repos_report.txt`、`scan_run*.txt` 均被跟踪 | 提交噪声、评审负担；与代码变更耦合 | 中（迁移成本） | P2 | 策略已定：保留回溯价值、接受大 diff、快照与代码分批提交（见 `docs/adr/0003-snapshot-committing.md`） | 已偿清（策略落地） |
| 6 | 文档声明与实际文件漂移（历史遗留，已修复） | `AGENTS.md` 曾引用不存在的 `CHANGELOG.md` | AI/协作者按声明找不到文档 | 极低 | P2 | 已随 P1-1 修正：改为指向 `docs/adr/` 与 `docs/tech-debt.md` | 已偿清 |
| 7 | 外部 CLI（gh/git/python）版本未锁定 | `scan-core.mjs` / `modelscope.mjs` 直接调用 PATH 上的 gh/git/python，无最低版本约束（ADR-0002 声明「gh 未锁定版本」登记于本表，2026-10-11 补登） | 行为随本机工具版本漂移，升级破坏难追溯 | 低（文档声明最低版本） | P2 | 下轮评估时定义 gh/git/python 最低版本并写入 readme「依赖说明」；当前保持现状 | 待偿清 |
| 8 | CI actions 曾用浮动 tag 引用 | 原 `gitleaks.yml`/`release.yml` 用 `actions/checkout@v4` 等 tag | tag 可被上游改写，供应链风险 | 低（一次替换） | P2 | 已固定为 tag 抓取时的 commit SHA（2026-10-11，见三个 workflow 内注释） | 已偿清 |
| 9 | scan-core.mjs 职责集中，无内部模块边界 | 该文件 1036 行 / 52 个顶层声明承载 10 个职责域（D1 取数传输 … D10 控制台汇总，逐域清单见 `docs/module-boundaries.md` 第 2 节）；`collectData` 单函数依赖 12 个内部成员；`scan.mjs`/`server.mjs`/`tests/core.test.mjs` 合计从这一份文件 import 24 个符号；已沉积零调用方死代码 `gh`(L23)、`esc`(L413) | 改动影响面无法判定（改一个函数不知会牵动哪些产物），是 #10 那类「隐式依赖测试测不出」问题的温床；新协作者/agent 定位成本高 | 中（按域外提 4–6 个模块 + 迁入口；边界约定已零成本落地） | P1 | 边界先行：`docs/module-boundaries.md`（BM-1~BM-6 依赖方向约定 + 第 3 节影响面反向索引 + 第 6 节按域最小验证命令）已建立并在 `AGENTS.md` 挂钩；物理拆分按耦合度从低到高推进（D1 传输 → D3 CLI 检测 → D7/D9 历史与审计），每外提一域同步刷新该文件第 2–4 节；死代码 `gh`/`esc` 随首个触碰 D1/D4 的变更顺手删除 | 修复中（边界已成文，代码未拆分） |
| 10 | 直连兜底通道依赖未声明的全局 `https` | `scan-core.mjs` L93–L97 `httpsJson` 调用 `https.Agent`/`https.request`，但文件头 L4–L8 的 import 中没有 `node:https`；以 `.mjs` 文件形态实调 `directApi` 抛 `ReferenceError: https is not defined`（`node -e` 里 `globalThis.https` 恰好存在，故交互式试跑看不出来）；`tests/direct-api.test.mjs` L20 注入 `globalThis.https` 桩，`node --test` 因此全绿 | `AGENTS.md` 承诺的兜底路径（gh 未安装/未登录 + `GH_TOKEN`）在生产实际失效，远程扫描只剩一行「GH_TOKEN 直连兜底失败」；测试与 CI 均无法发现 | 极低（补 1 行 `import https from "node:https"`；另加一条不依赖桩的真实形态冒烟） | P1 | 补 import 为第一动作；随后把 `httpsJson` 的传输层改为可注入参数，或增加「以文件形态实调 `directApi`」的回归，消除「桩掩盖未声明依赖」这一复发条件。本轮授权仅覆盖文档登记，代码尚未改动 | 待偿清（需代码变更授权） |
| 11 | 展示/评分口径 scan-core 与客户端双份实现 | `scan-core.mjs` 的 `scoreOf`(L550)/`gradeOf`(L574)/`relTime`(L519)/`fullTime`(L529)/`esc`(L413) 在 scan-core 内部零调用，只被 `tests/core.test.mjs` 引用；发布面板实际执行的是 `assets/dashboard-client.js` L31–L81 的同名副本 | 与债项 #3 同型但代价更高：单测守护服务端副本，浏览器跑客户端副本，健康分/时间口径漂移不会让门禁变红 | 低（加对拍断言）→ 中（#9 拆分时收敛为单一来源） | P2 | 短期在 `tests/core.test.mjs` 增加「两份实现同输入同输出」的对拍（沿用现有 `vm.Script` 注入客户端源码的做法）；中期由 `docs/module-boundaries.md` BM-5 约束「改一处必改两处」；#9 外提时把 D4 口径独立成模块供两侧共用 | 待偿清 |

---

**偿清节奏**：本表随评估/落地周期刷新；新识别的债项须在「影响/成本/优先级」三列补齐后登记，禁止只列标题。
**边界类债项的配套文档**：#9/#10/#11 的职责划分、依赖方向与「改 X 影响谁」的反向索引统一维护在 `docs/module-boundaries.md`，偿清每一步后同步刷新其第 2–5 节。
