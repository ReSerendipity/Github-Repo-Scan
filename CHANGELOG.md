# Changelog

本项目所有值得注意的变更都记录在本文件。

本文件格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本 SemVer](https://semver.org/lang/zh-CN/)：
`MAJOR.MINOR.PATCH`，预发布用 `-alpha.N` / `-beta.N` / `-rc.N`。此口径与
`ReSerendipity/.github` 治理规范 §10.2 及本仓 `docs/release-governance.md`
（§1 版本号规范 / §2 CHANGELOG 管理）一致。

**当前状态（2026-10-18 于默认分支 `main` 实测）**：本仓**尚无任何 Git tag 或 GitHub
Release** —— `gh api repos/ReSerendipity/Github-Repo-Scan/tags` 与
`repos/ReSerendipity/Github-Repo-Scan/releases` 均返回空数组，`git ls-remote --tags`
亦无输出。因此本文件当前**只有 `[Unreleased]` 一节，不含任何已发布版本段**。
按治理规范「发版时 `[Unreleased]` → `[VERSION] - YYYY-MM-DD`」，待首个 SemVer 发布
（本地 `git tag vX.Y.Z` → `git push origin vX.Y.Z` 触发 `.github/workflows/release.yml`）
时，再把本节迁移为对应的版本段。

## [Unreleased]

### Added
- 新增 Tests workflow `.github/workflows/test.yml`：`push` / PR 到 `main` 时自动运行 `node --test`（PR #2）。
- 新增 `docs/release-governance.md`：本地化 `.github` 治理规范 §10「发布 / 分发统一规范」（工单 D-02，PR #3）。
- 新增模块边界约定文档，并登记 `scan-core.mjs` 职责集中债。
- `scan.mjs` 新增 `--help` 输出与未知 `--` 参数拒绝。

### Changed
- 重构传输层：把 D1 传输域外提为 `github-fetch.mjs`，删除死代码 `gh` / `sleepSync`；直连传输层改由 `setHttpsTransport` 显式注入，并补 `node:https` 显式 import。
- 补充测试：`collectData` 全编排契约与 `ghAsync` 降级链桩测；服务端 / 客户端双份口径对拍断言落地，`esc` 补 D4 export；CI 开启实验性覆盖率输出取基线。
- 文档：README 补齐本地门禁的可复现安装与 agent 层注册模板；标题别称统一为 `Github-Repo-Scan`；`readme.md` 更名为 `README.md` 并修正远程 URL 大小写；文件清单补 `tests/direct-api.test.mjs`；对内文档区 `DOCS/` 统一小写 `docs/`、内部版取消跟踪。
- 维护：`AGENTS.md` 改为仅本地保留、取消远程跟踪；`.gitignore` 忽略 `.qoder/`；`.mailmap` 归一个人邮箱显示；`docs/tech-debt.md` 登记 DCO 签名缺口例外并就地标注「评审快照已被取代」。
- 刷新扫描快照与面板。

### Fixed
- 为 `.js` 声明 `eol=lf`，修复干净检出下冒烟门必红（Better Harness: local-gates-not-reproducible）。
- 把 `server.mjs` 纳入编辑后核心模块门禁覆盖，修复服务端入口未受门禁保护。

[Unreleased]: https://github.com/ReSerendipity/Github-Repo-Scan/commits/main
