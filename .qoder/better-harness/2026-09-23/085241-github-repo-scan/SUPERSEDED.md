# 本目录内容已被取代（SUPERSEDED）

本目录是 **2026-09-23** 那次 Better Harness 评审的产物快照，对应仓库当时的树。它随仓库分发，
但**其中的多条结论已被后续落地的工作推翻**。请勿把本目录当作本仓当前的门禁清单或能力现状。

## 已被反驳的具体断言

| 本目录 `findings.json` 的断言 | 当前仓库事实（可自查） |
| --- | --- |
| 「仓库内未见持续集成配置、git 钩子或统一脚本清单」 | `.github/workflows/` 下有 `test.yml`（push/PR 跑 `node --test`）、`gitleaks.yml`、`codeql.yml`、`release.yml`；钩子在 `hooks/pre-push` 与 `hooks/post-edit-validate.mjs`；密钥规则另有 `gitleaks.toml` 与 `.pre-commit-config.yaml`。自查：`git ls-files .github hooks .pre-commit-config.yaml gitleaks.toml` |
| 「`directApi`、`ghAsync`、`collectData` 等没有被导入或断言，重试/退避/来源决策完全没有测试」 | `tests/direct-api.test.mjs` 覆盖 `directApi` 的 REST/GraphQL、TLS 放宽与放弃边界、`ghAsync` 降级链；`tests/collect-data.test.mjs` 覆盖 `collectData` 全编排契约（离线传输桩）。自查：`node --test` |
| 「已有的冒烟测试没有被任何自动触发点连接」 | 同一个 `node --test` 已接三处：编辑后 `hooks/post-edit-validate.mjs`、落地前 `hooks/pre-push`、CI `.github/workflows/test.yml` 与 `release.yml`。安装与自查命令见 `README.md`「本地门禁」 |

## 仍然成立的部分

本目录其余条目（如快照入库策略、双份实现同步）不在此更正范围内；判断当前状态请以仓库实际内容为准。

## 本目录为什么会出现在版本库里

`.qoder/` 整体被 `.gitignore` 忽略，这三份产物是早于该约定入库的遗留。该事项登记在
`docs/tech-debt.md` 债#2；是否把本目录移出版本库由仓库 owner 决策（属删除已跟踪文件，需人工确认）。
最近一次评审产物位于 `.qoder/better-harness-runs/`（同样不入库）。
