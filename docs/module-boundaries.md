# scan-core.mjs 模块边界约定（职责地图 · 依赖方向 · 影响面）

> 登记依据：`docs/tech-debt.md` 债项 #9「scan-core.mjs 职责集中」。本文件是 `scan-core.mjs` 内部的**唯一权威职责地图**：改动其中任何函数之前，先在第 3 节定位所属域、调用方与最小验证命令，再动手。
> 快照口径：2026-10-14，`scan-core.mjs` 共 1036 行 / 55 个顶层声明 / 10 个职责域。表中的行号仅供导航，**以函数名为准**（行号随版本漂移）。

## 1. 边界规则（违反即属架构变更，须先改本文件再写代码）

| 编号 | 约定 | 违例判据 |
|---|---|---|
| BM-1 | 依赖只允许**自上而下**（D5 编排 → D1 传输）。低层禁止回调高层，同域内允许，跨域禁止出现回边 | 第 3 节「内部调用方」列出现指向更高域的调用边 |
| BM-2 | **只有 D1 可以触网**（`gh` 子进程 / HTTPS 直连）；`git` 子进程只允许出现在 D2。D4/D6/D7/D9 等纯函数域不得引入 IO | 纯口径函数里出现 `execFileP` / `httpsJson` / `readFileSync` |
| BM-3 | 域内私有的常量与小函数不外泄；一旦需要被别的域引用，必须 `export` 并同步登记到第 2、3 节 | 新增 export 未进第 3 节表格 |
| BM-4 | 第 12 行的门面再导出（`HERE`/`fmtSize`/`readLocalConfig`/…/`renderDashboard`）**只允许转发 `shared.mjs` 与 `render-dashboard.mjs` 的既有符号**；禁止在 scan-core 里新写实现再顺手暴露，避免入口继续向单文件堆叠 | 门面行新增的符号在本文件内有函数体 |
| BM-5 | **展示与评分口径双份**（scan-core 的服务端副本 ↔ `assets/dashboard-client.js` 的浏览器副本）。改 `scoreOf`/`gradeOf`/`relTime`/`fullTime`/`esc` 必须两处同步并更新断言 | 只改一处的提交；`tests/core.test.mjs` 未同步 |
| BM-6 | 每个域的外部依赖（Node 内置模块、`gh`/`git` 可执行文件、环境变量开关）必须**显式 import / 显式读取**，禁止依赖运行环境里恰好存在的全局 | 出现未 import 的模块标识符；新增 `SCAN_*` 环境变量未进第 4 节 |

> BM-6 曾被实测违反：D1 的 `httpsJson` 用了未 `import` 的 `https`，而 `globalThis.https` 桩使测试全绿（债#10）。2026-10-15 已偿清：显式 `import https from "node:https"`；传输层经 `setHttpsTransport` 显式注入（桩不再遮蔽模块绑定）；`tests/direct-api.test.mjs` 末尾有静态守卫防回归。

## 2. 职责域清单

| 域 | 名称 | 成员（顶层声明） | 对外入口 | 允许依赖 |
|---|---|---|---|---|
| D1 | GitHub 取数传输 | `sleepSync` `gh` `ghToken` `canDirectFallback` `applyJq` `directApi` `httpsJson` `ghAsync` `pool` `execFileP` `sleep` | `ghAsync`（内部）、`directApi`/`applyJq`/`gh`（测试与兜底） | 仅 Node 内置 + `gh` 可执行文件 |
| D2 | 本地 Git 事实 | `SKIP_DIRS` `parseRemoteUrl` `findGitRepos` `gitOne` `gitInfoFor` `collectLocal` | `collectLocal` `gitInfoFor` `findGitRepos` `parseRemoteUrl` | D1 的 `pool`/`execFileP`、`shared.mjs` 的 `defaultLocalRoots` |
| D3 | CLI 三态检测 | `CLI_SKIP_DIRS` `CLI_MANIFESTS` `CLI_ENTRY_FILE` `CLI_SCRIPT_DIR` `manifestCliDetail` `classifyCli` `detectCliLocal` `detectCliRemote` | `detectCliLocal` `detectCliRemote` 及三个判定函数 | 仅 `node:fs`；不得触网、不得跑 `git` |
| D4 | 领域口径与展示原语 | `esc` `LANG_COLORS` `relTime` `fullTime` `ciStateOf` `scoreOf` `gradeOf` `repoUnchanged` | 全部 export（多数只被测试与客户端副本消费） | 纯函数，零依赖 |
| D5 | 远程采集编排 | `QUERY_PAGE` `WITH_TRAFFIC` `collectData` | `collectData` | D1→D2→D3→D4 全部（唯一允许「横向通吃」的域） |
| D6 | 本地↔远程匹配与合并 | `matchLocalToRemote` `applyLocalTotals` `mergeLocalSnapshot` | 三个均 export | D2 的 `parseRemoteUrl`、D3 的 `detectCliLocal`、D4 的口径；`shared.mjs` 的配置读取 |
| D7 | Star 历史与周增 | `HISTORY_FILE` `HISTORY_MAX` `loadStarHistory` `recordStarHistory` `computeStarWeek` | `computeStarWeek` `loadStarHistory` | 仅 `node:fs` + 历史文件 |
| D8 | 产物落盘与脱敏 | `maskSnapshotPaths` `writeOutputs` | `writeOutputs` | D7、D9、`shared.mjs` 的 `maskLocalPath`、`render-dashboard.mjs` |
| D9 | 审计日志 | `AUDIT_FILE` `AUDIT_MAX` `auditKeyWarned` `loadAuditRows` `appendAudit` | `appendAudit` `loadAuditRows` | 仅 `node:fs` + `node:crypto` |
| D10 | 控制台汇总 | `printSummary` | `printSummary`（仅 `scan.mjs`） | 只读 `data`，不得改数据 |

**外部消费者（谁在用这个单文件）**：`scan.mjs`（`collectData` `collectLocal` `mergeLocalSnapshot` `writeOutputs` `printSummary` + 门面符号）、`server.mjs`（同前四个，无 `printSummary`）、`modelscope.mjs`（仅门面 `HERE`/`readLocalConfig`）、`tests/core.test.mjs`（一次性 import 24 个符号，覆盖 D1–D9）、`tests/direct-api.test.mjs`（只测 D1 直连支路）。`render-dashboard.mjs` **不**反向依赖 scan-core（只 import `shared.mjs`），这条边必须保持。

## 3. 影响面反向索引（改这个函数 → 谁会受影响）

「内部调用方」= scan-core 内的直接上游；改任一声明，受影响的 = 它的全部内部调用方 + 外部消费者 + 它写出的产物。

### D1 传输

| 声明 | 内部调用方 | 外部消费者 | 改动波及的产物/路径 |
|---|---|---|---|
| `execFileP` (L13) | `ghAsync` `gitOne` `collectLocal` | — | 异步子进程底座：远程取数 + 本地 git 取数 + `git --version` 探测 |
| `sleep` (L14) | `ghAsync` | — | 重试退避节奏（与 `sleepSync` 并行存在，改一处要同步另一处） |
| `gh` (L23) | **无（死代码，见 §5）** | 无（测试也未引用） | 仅 export 表面；删除不影响运行 |
| `sleepSync` (L19) | `gh` | — | 与 `gh` 同生同灭 |
| `ghToken` (L42) | `canDirectFallback` `directApi` | — | 凭据来源；决定兜底通道是否可用 |
| `canDirectFallback` (L45) | `ghAsync` | — | 兜底触发条件（ENOENT / 未登录文案） |
| `applyJq` (L50) | `directApi` | `core.test` `direct-api.test` | 所有 `--jq` 型取数字段 |
| `httpsJson` (L93) | `directApi` | `direct-api.test`（桩化 `globalThis.https`） | 直连传输与 TLS 放宽策略 |
| `directApi` (L56) | `ghAsync` | `direct-api.test` | gh 不可用时的全部远程字段 |
| `ghAsync` (L118) | `collectData` | — | **远程全量数据**（列表/CI/许可/最近提交/流量/文件树） |
| `pool` (L147) | `collectLocal` `collectData` | — | 并发度与结果顺序：远程明细 + 本地状态两条路 |

### D2 本地 Git 事实

| 声明 | 内部调用方 | 外部消费者 | 改动波及 |
|---|---|---|---|
| `SKIP_DIRS` (L161) | `findGitRepos` | — | 本地仓库发现范围 |
| `parseRemoteUrl` (L168) | `gitInfoFor` `matchLocalToRemote` | `core.test` | 远程 URL 解析 → 匹配主键 `owner/repo` |
| `findGitRepos` (L182) | `collectLocal` | `core.test` | `localScan.repos` 成员集合 |
| `gitOne` (L214) | `gitInfoFor` | — | 所有本地 git 事实的取数与超时 |
| `gitInfoFor` (L220) | `collectLocal` | `core.test` | `localScan.repos[]` 字段形状（分支/脏/ahead-behind） |
| `collectLocal` (L280) | `collectData` | `scan.mjs` `server.mjs` `core.test` | 本地对照整块 + 失败降级文案 |

### D3 CLI 三态检测

| 声明 | 内部调用方 | 外部消费者 | 改动波及 |
|---|---|---|---|
| `CLI_SKIP_DIRS` (L430) | `detectCliLocal` | — | 本地目录遍历剪枝 |
| `CLI_MANIFESTS` (L433) | `detectCliLocal` `collectData` | — | 清单白名单（远程拉取上限也受它影响） |
| `CLI_ENTRY_FILE` (L434) | `detectCliLocal` `detectCliRemote` | — | 「CLI」态判定分子 |
| `CLI_SCRIPT_DIR` (L435) | `detectCliRemote` | — | 「脚本集」态判定 |
| `manifestCliDetail` (L437) | `detectCliLocal` `detectCliRemote` | `core.test` | 两种来源共用的清单解释 |
| `classifyCli` (L460) | `detectCliLocal` `detectCliRemote` | `core.test` | 三态口径本身 |
| `detectCliLocal` (L466) | `matchLocalToRemote` | `core.test` | 有克隆仓库的 `row.cli`（覆盖远程结果） |
| `detectCliRemote` (L503) | `collectData` | `core.test` | 远程-only 仓库的 `row.cli` |

### D4 领域口径与展示原语

| 声明 | 内部调用方 | 外部消费者 | 改动波及 |
|---|---|---|---|
| `esc` (L413) | **无（死代码，见 §5）** | 无 | 面板实际用客户端副本 |
| `LANG_COLORS` (L417) | `collectData` | — | `row.langColor` 入快照 |
| `relTime` (L519) | 无 | `core.test`（面板用 `dashboard-client.js` 副本） | BM-5 双份口径 |
| `fullTime` (L529) | 无 | 同上 | 同上 |
| `ciStateOf` (L533) | `collectData` | `core.test` | `row.ci.state/cls` + `totals.ciOk/ciDone` |
| `scoreOf` (L550) | 无 | `core.test`（面板用客户端副本） | BM-5：健康分口径，改动须双份同步 |
| `gradeOf` (L574) | 无 | 同上 | 同上 |
| `repoUnchanged` (L617) | `collectData` | `core.test` | 增量复用判定：漏判 → 多打网络请求；误判 → 快照陈旧 |

### D5 远程采集编排

| 声明 | 内部调用方 | 外部消费者 | 改动波及 |
|---|---|---|---|
| `QUERY_PAGE` (L581) | `collectData` | — | GraphQL 字段 → `rows[]` 可用字段上限 |
| `WITH_TRAFFIC` (L16) | `collectData` | — | 流量取数分支（额外配额消耗） |
| `collectData` (L633) | 无（编排终点） | `scan.mjs` `server.mjs` | `data` 整体契约：`schema/totals/rows/localScan/scanInfo` → `scan-data.json` + `dashboard.html` |

### D6 本地↔远程匹配与合并

| 声明 | 内部调用方 | 外部消费者 | 改动波及 |
|---|---|---|---|
| `matchLocalToRemote` (L303) | `mergeLocalSnapshot` `collectData` | `core.test` | `row.local`/`row.cli` + `localScan.matched/localOnlyCount/filteredOut` + `localOnly` 列表 |
| `applyLocalTotals` (L377) | `mergeLocalSnapshot` `collectData` | `core.test` | `totals.local*` 六个指标（面板隐藏/展示开关） |
| `mergeLocalSnapshot` (L395) | 无 | `scan.mjs` `server.mjs` | 仅本地扫描路径的整份 `data` |

### D7–D9 产物、历史、审计

| 声明 | 内部调用方 | 外部消费者 | 改动波及 |
|---|---|---|---|
| `HISTORY_FILE` (L876) | `loadStarHistory` `recordStarHistory` | — | `scan-data-history.json` 读写路径 | 
| `HISTORY_MAX` (L877) | `recordStarHistory` | — | 历史保留窗口（约 > 1 年） |
| `loadStarHistory` (L879) | `recordStarHistory` `computeStarWeek` | — | 历史读取容错 |
| `recordStarHistory` (L887) | `writeOutputs` | — | 当日条目去重与排序 |
| `computeStarWeek` (L904) | `writeOutputs` | `core.test` | `row.starWeek` + `data.starWeekRef` |
| `maskSnapshotPaths` (L992) | `writeOutputs` | — | 入库快照的本地路径脱敏（隐私边界） |
| `AUDIT_FILE` (L959) | `loadAuditRows` `appendAudit` | — | `scan-audit.jsonl` 读写路径 |
| `AUDIT_MAX` (L960) | `appendAudit` | — | 审计行轮转上限 |
| `auditKeyWarned` (L971) | `appendAudit` | — | 明文模式提示只播一次 |
| `loadAuditRows` (L962) | `appendAudit` | `core.test` | 审计行解析 |
| `appendAudit` (L972) | `writeOutputs` | `core.test` | 审计留痕与逐行签名 |
| `writeOutputs` (L928) | 无（落盘终点） | `scan.mjs` `server.mjs` | **四个产物**：`scan-data.json` / `dashboard.html` / `scan-data-history.json` / `scan-audit.jsonl` |
| `printSummary` (L1010) | 无 | `scan.mjs` | 仅控制台输出 |

### 高影响枢纽（改这些＝改全局）

1. `collectData` —— 依赖 12 个内部成员，横跨 D1–D4；它的返回结构就是 `scan-data.json` 的契约。
2. `ghAsync` / `directApi` / `httpsJson` —— 任何远程字段的唯一出口。
3. `matchLocalToRemote` —— 同时改 `rows[].local`、`rows[].cli`、`localScan.*` 三组字段。
4. `pool` —— 并发度与结果顺序，远程明细 + 本地状态共享。
5. `writeOutputs` —— 四个落盘产物的唯一入口。

## 4. 环境与数据依赖登记（BM-6 的显式清单）

| 域 | Node 内置 | 外部可执行文件 | 环境变量（运行时读取，非加载冻结） |
|---|---|---|---|
| D1 | `node:child_process` `node:util` `node:https`（已显式 import，债#10 已偿清） | `gh` | `GH_TOKEN` / `GITHUB_TOKEN`、`SCAN_INSECURE_TLS` |
| D2 | `node:child_process` `node:fs` `node:path` | `git`（须在 PATH） | — |
| D3 | `node:fs` `node:path` | — | — |
| D5 | `node:fs` | `gh` | `SCAN_WITH_TRAFFIC` |
| D6 | `node:fs` | — | 经 `shared.mjs` 读 `scan-config.json`（`localOwnerOnly`/`localScanDepth`） |
| D7/D8 | `node:fs` `node:path` | — | — |
| D9 | `node:fs` `node:crypto` | — | `SCAN_AUDIT_KEY` |

## 5. 快照期已知的边界违例与死代码（已登记技术债）

| 项 | 事实 | 债项 |
|---|---|---|
| D1 `httpsJson` 依赖未声明的全局 `https` | **已偿清（2026-10-15）**：显式 `import https from "node:https"`；传输层经 `setHttpsTransport` 显式注入；`tests/direct-api.test.mjs` 尾部静态守卫防 import 缺失回归 | 已闭合（原 `docs/tech-debt.md` #10） |
| D1 `gh`、D4 `esc` 零调用方 | 全仓（含两个测试文件）无任何调用点 | #9 |
| D4 `relTime`/`fullTime`/`scoreOf`/`gradeOf` 双份实现 | 面板实际执行 `assets/dashboard-client.js` 的副本；`tests/core.test.mjs` 断言的是 scan-core 的副本 → 测试护的不是发布路径 | #11 |

## 6. 改动自检流程（每次动 scan-core.mjs 都走一遍）

1. **定位**：在第 2 节找到函数所属域；在第 3 节读出它的「内部调用方 + 外部消费者」。
2. **判方向**：新增的调用边是否符合 BM-1（只向下）与 BM-2（IO 只在 D1/D2）；不符就先改本文件与 `docs/adr/`。
3. **查双份**：动 D4 口径 → 同步 `assets/dashboard-client.js`（BM-5）。
4. **最小验证**（按域，全部为本地无网命令）：
   - 语法：`node --check scan-core.mjs`
   - D1 直连支路：`node --test tests/direct-api.test.mjs`（2026-10-15 起桩经 `setHttpsTransport` 显式注入——测试文件本身即文件形态实调 `directApi`，且尾部 BM-6 静态守卫防 import 缺失回归；注入桩遮蔽模块绑定的旧失效模式已消除）。
   - D2/D3/D4/D6/D7/D8/D9：`node --test tests/core.test.mjs`
   - 收口：`node --test` 全绿（`hooks/pre-push` 与 `hooks/post-edit-validate.mjs` 的 `CORE_FILES` 定义与此一致）
   - 端到端（会重写 `scan-data.json` / `dashboard.html`，按 `docs/adr/0003-snapshot-committing.md` 分批提交）：`node scan.mjs --local-only`
5. **回填**：新增/删除 export、换域、加环境开关 → 同步更新第 2–4 节表格。

### 示例：要改 `parseRemoteUrl`，影响面是什么

第 3 节直接给出：内部调用方 `gitInfoFor`、`matchLocalToRemote` → 沿链上溯 `collectLocal` → `collectData` / `mergeLocalSnapshot` → `scan.mjs`、`server.mjs`；外部还有 `core.test`。所以受影响的函数集合 = {`gitInfoFor`, `matchLocalToRemote`, `collectLocal`, `mergeLocalSnapshot`, `collectData`}，受影响的数据字段 = `localScan.repos[].github`（本地侧）与 `rows[].url` 匹配主键（远程侧），最终落到 `scan-data.json` 的 `localScan.matched` 与面板「本地对照」列。验证：`node --test tests/core.test.mjs`。

### 刷新这张表（避免手改漂移）

地图可机械再生：按顶层 `function`/`const` 声明切块 → 剥离注释 → 用 `\b名称\b` 在「其他块」中匹配引用 → 人工剔除字符串/注释造成的假边（本次快照里 `ghAsync → gh`、`canDirectFallback → gh` 就是文案误匹配，已剔除）。
