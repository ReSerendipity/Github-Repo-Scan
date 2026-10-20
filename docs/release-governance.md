# 发布 / 回滚 规范（Github-Repo-Scan 本地化）

> **来源与权威**：公共条款见 `ReSerendipity/.github` 的 `REPOSITORY_GUIDELINES.md` §10（发布 / 分发统一规范，2026-10-18 新增）。
> 本文件按同仓 `RELEASE_GOVERNANCE_TEMPLATE.md` 复制并本地化，只填本仓特有内容，**不重写、不抵触 §10 的公共条款**。
> 占位符已逐项替换为本仓真值；未确定项按模板要求写「待定（负责人 + 触发条件）」，不编造阈值。
> 生成日期：2026-10-18（阶段 D / 工单 D-02）。

---

## 0. 远端优先（根原则，不可改写）

发布链的构建、打包、扫描、上传、推送**全部在 GitHub Actions 远端完成**；本地只做三件事：改版本位、落 CHANGELOG、`git tag` + `git push`。本地不执行打包 / 镜像构建 / 发布上传。

本仓当前无自构建产物（见 §4），远端 `release.yml` 只承担「跑测试（`node --test`）→ 建 draft Release」两步；本地同样不做任何打包上传。

## 1. 版本号规范

- 遵循 **SemVer** `MAJOR.MINOR.PATCH`；预发布用 `-alpha.N` / `-beta.N` / `-rc.N`。
- **唯一权威版本位**：待定（负责人 + 触发条件：本仓尚无 `package.json` / `pyproject.toml` / `config.yaml` 等版本声明文件，首个 SemVer tag 发布时确定唯一权威版本位文件与字段）。
- 当前版本：待定（负责人 + 触发条件：现有 tag `v29-remediate-start` … `v29-p1-5` 为阶段 D 之前的流水线标记，**非 SemVer**，不视为发布版本；`release.yml` 的 `draft-release` 步骤已用正则 `^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$` 强制新 tag 必须 SemVer）。
- 必须同步的其它版本位：无（无版本声明文件，故无多点漂移问题；待引入权威版本位文件后再逐项列出并钉住）。
- 版本位漂移校验入口：待定（负责人 + 触发条件：本仓无 `tests/test_version_consistency.py` 类校验；引入版本位文件时同步补一个 `node --test` 用例，漂一处即判红）。
- 自动化方式：**手动 tag（人工）**——本仓未启用 release-please，无 `release-please.yml`；发布由人工本地 `git tag vX.Y.Z` → `git push origin vX.Y.Z` 触发远端 `release.yml`。

## 2. CHANGELOG 管理

- 遵循 **Keep a Changelog**：`Added / Changed / Fixed / Deprecated / Removed / Security`。
- 每次合并 `main` 在 `[Unreleased]` 追加；type 映射 `feat→Added`、`fix→Fixed`、`refactor→Changed`。
- 发版时 `[Unreleased]` → `[VERSION] - YYYY-MM-DD`。
- **现状（2026-10-18 更新）**：根级 `CHANGELOG.md` 已建立（Keep a Changelog）；`check-release-standard.sh` 不再据此判 FAIL。

## 3. 发布流程（远端）

1. 确认 `[Unreleased]` 条目完整（见 §2）。
2. 同步版本位（见 §1 清单；当前无版本位文件，跳过）。
3. 本地打 tag 并推送：`git tag v<X.Y.Z>` → `git push origin v<X.Y.Z>`（tag 必须过 §1 的 SemVer 正则）。
4. 远端凭 tag 触发 `.github/workflows/release.yml`：
   - 作业 `test`：`node --test`（Node 22）；
   - 作业 `draft-release`（`needs: test`）：校验 tag 格式 → `gh release create <tag> --draft --generate-notes --verify-tag`。
5. 远端建 **draft Release** 并挂资产 → 人工审核后在 GitHub 页面 `published`（本仓当前无自构资产需挂，见 §4）。
6. 盯到终态：`gh run list` / `gh pr checks` 确认绿；红了当场修或 revert 止损。

## 4. 分发产物与完整性

| 产物 | 构建位置 | 标签 / 命名 | 完整性手段 |
|---|---|---|---|
| 无自构建产物（源码运行 Node CLI，见下） | — | tag 即 SemVer `vX.Y.Z`；无 floating `latest` | 无自构资产；GitHub Release 页面自动展示 Source code zip / tar.gz 的 SHA256 |

- 本仓产物形态**：源码运行的 Node.js 工具（`.mjs` 脚本 + `dashboard.html` + 本地 `scripts/server.mjs`），用户 clone 后 `node scripts/server.mjs` 或双击 `启动面板.bat` 本地运行。**无 wheel / sdist / 容器镜像 / APK / 安装包**，无 `package.json`，无构建步骤。
- **release.yml 核对结论（2026-10-18，本工单）**：
  - **tag 驱动**：✓ 已对齐——`on: push: tags: "v*"`，无需修改。
  - **产物是否附 SHA256SUMS**：当前不附。判断依据：本仓 §10.3 范畴内无自构建分发包（既非 Python 包、也非容器镜像、也非桌面/移动安装包），§10.1「Release 资产须附 SHA256SUMS.txt」针对的是**自构建分发资产**；本仓 Release 唯一可下载物是 GitHub 自动生成的 Source code 压缩包，其 SHA256 由 GitHub 在 Release 页面直接展示，无需另附 `SHA256SUMS.txt`。**决定：不对 release.yml 做修改**（避免在无产物处凭空加 hash 步骤、避免重构）。**触发再评估的条件**：一旦本仓引入任何自构建分发包（如打包成单文件可执行 / 容器镜像 / npm 包），必须在 `release.yml` 远端构建步骤后补 `SHA256SUMS.txt` 生成与 `gh release upload`，并在本节登记产物行。
- 容器镜像：不适用（本仓不发镜像，无 `docker/build-push-action`，无 `ghcr.io` 推送）。
- Trivy 扫描：不适用（无镜像；workflows 中无 Trivy 步骤、无 `exit-code: 0` 报告模式）。
- SBOM / provenance：不适用（无镜像链）。
- **不使用 GPG 分离签名**（2026-10-18 裁决）；本仓从未存在 `gpg-signed-release.yml`（§10.6 已列 Github-Repo-Scan 在该文件「从来没有」的 3 仓之列）。

## 5. 回滚

- **判定**（满足任一即触发）：待定（负责人 + 触发条件：本仓为个人本地工具，无生产服务 / 外部用户流量 / SLO，回滚阈值待首个正式对外版本发布后由维护者定义）。
- **执行**：`git revert <bad-commit>`（保历史、可再 forward）；配置回滚不适用（无远端部署 / 无服务配置）；不可变产物按上一版 tag 重推（本仓无自构产物，故无此动作）。
- **破坏性动作**：重指向 / 删除 tag、移动任何远端 ref → **须仓库所有者单独授权**（§10.2 红线：`release.yml` 由 `push: tags` 触发，移动已发布 tag 会当场重跑发布链）。
- **回滚后验证**：`node --test` 全绿（覆盖 `tests/` 下 6 个测试文件：collect-data / core / direct-api / post-edit-validate / scan-cli-args / server-security）。

## 6. SLA / 错误预算

- 目标可用性：待定（负责人 + 触发条件：本仓为本地运行工具，不对外提供常驻服务，无月度可用性承诺；待未来若提供远端部署版本时再定目标值与错误预算）。

## 7. 发布前检查清单

- [ ] 版本位全部同步（见 §1 清单；当前无版本位文件，N/A）
- [ ] CHANGELOG `[Unreleased]` 已改版本 + 日期（见 §2）
- [ ] `node --test` 通过（CI `test.yml` / `release.yml` 均跑此项；Node 22）
- [ ] lint / format 全绿：本仓无独立 ESLint / Prettier 配置；pre-commit 仅 gitleaks 密钥扫描（`gitleaks.toml`），本地激活命令见 README「本地门禁」表
- [ ] 镜像类仓：Trivy 阻断通过，豁免已在 `.trivyignore.yaml` 登记理由 + expiration（不适用，无镜像）
- [ ] 镜像类仓：`provenance: true` + `sbom: true` 已开（不适用，无镜像链）
- [ ] **本地未产出任何发布交付物**（全部远端构建；本仓当前连远端构建产物都没有，更满足）

---

## 差异点采集清单（本仓实际取值）

| 占位符 | 采集来源 | 本仓取值 |
|---|---|---|
| 版本位文件与字段 | 仓内版本声明 | 待定（负责人 + 触发条件）：无 `package.json` / `pyproject.toml` / `config.yaml` 版本字段 |
| 其它需同步版本位 | `grep -rn` 版本串 | 无（仓内 `vX.Y.Z` 串仅出现在 `scan-data.json` 对其它仓库的扫描快照中，非本仓版本） |
| 版本一致性校验入口 | `<repo>/tests/**` | 待定（负责人 + 触发条件）：无版本位校验用例 |
| 自动化方式 | `.github/workflows/` | 手动 tag（人工）；无 release-please |
| 发布 workflow 文件名 | `.github/workflows/` | `.github/workflows/release.yml` |
| 产物形态与标签规则 | 构建 workflow | 无自构建产物；tag 即 SemVer `vX.Y.Z`（release.yml 强制正则） |
| 完整性手段 | Release 资产清单 | 无自构资产；GitHub 页面自动展示 Source code 压缩包 SHA256；未来引入自构产物时补 `SHA256SUMS.txt` |
| 回滚判定阈值 | 运行手册 / 监控 | 待定（负责人 + 触发条件） |
| 回滚后验证命令 | `tests/smoke` 等 | `node --test`（6 个测试文件全绿） |
| 技术栈 | 静态清单 | Node.js ≥18（CI Node 22），纯 ES Modules（`.mjs`），零 npm 依赖，本地 127.0.0.1 HTTP 服务 |
| 部署目标 | `deploy/` / Pages workflow | 无远端部署；本地面板（127.0.0.1），不发布 Pages / ghcr / 服务器 |

## 现状与欠账（本工单记录）

- **`CHANGELOG.md` 原缺 → 已由本单建立**（Keep a Changelog）；`check-release-standard.sh` 不再据此判 FAIL。
- **缺权威版本位文件**：本仓从未有过 SemVer 版本声明，首个正式发布前需确定版本位文件（建议随首次发版一并落地）。
- **release.yml 已对齐项**：tag 驱动 ✓；无 `value=latest` ✓；无 Trivy `exit-code: 0` ✓；无 `docker/build-push-action` ✓；无 `gpg-signed-release.yml` ✓。

## 禁止事项

- 不得重写 §10 的公共条款（远端优先、tag 驱动、版本位一致、不可变标签、扫描阻断、无 GPG）。
- 不得引入 `latest` 作发布基线；不得保留或新建 GPG 签名流程。
- 不得留空占位符，不得编造阈值。