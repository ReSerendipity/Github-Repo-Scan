# ADR-0002 · GitHub 取数双通道：gh CLI 优先 + GH_TOKEN 直连兜底

- 状态：已接受（2026-10-11 登记；决策随 `feat: 本地对照…` 系列提交落地，NEXT 落地补充成文）
- 背景：扫描需要带凭据的 GitHub API 通道；本机 gh CLI 登录态存于系统 keyring（token 不落盘），但无 gh/未登录环境需可用的降级路径。
- 决策：取数优先复用本机 gh CLI（`gh()` 同步封装 + `ghAsync()` 异步封装，均带 5xx/429/网络抖动重试）；gh 缺失或未登录时自动切 `GH_TOKEN`/`GITHUB_TOKEN` 环境变量直连兜底通道（`directApi`，REST+GraphQL）。
- 备选方案：
  - A. 仅依赖 gh CLI——否决：无 gh 环境（CI/裸机）不可用。
  - B. 仅 token 直连——否决：token 需自行管理落盘，失去 keyring 不落盘优势。
- 理由：双通道按环境自动择优，零配置优先；token 走环境变量不落盘，符合仓库密钥防泄露门禁（gitleaks + .gitignore 敏感信息段）。
- 影响：双通道需各自维护（已由 `direct-api.test.mjs` 以桩化 https 覆盖重试/降级分支）；版本基线：gh 未锁定版本（登记于 docs/tech-debt.md）。
- 相关：`README.md`「依赖说明」；评估报告 P1-1 取数通道决策记录。传输实现已于 2026-10-15 外提至 `scripts/github-fetch.mjs`（经 `scan-core.mjs` re-export）。
