# 文档索引（Github-Repo-Scan）

> 最后核对日期：2026-11-10
> 本文件为仓内文档入口索引，列出所有 tracked 文档路径、用途、状态。

## 现行文档

| 路径 | 用途 | 状态 |
|---|---|---|
| [`README.md`](../README.md) | 对外项目说明（中英双语） | 现行 |
| [`CHANGELOG.md`](../CHANGELOG.md) | 变更记录（Keep a Changelog） | 现行 |
| [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) | 社区行为准则 | 现行 |
| [`SECURITY.md`](../SECURITY.md) | 安全响应流程 | 现行 |
| [`AGENTS.md`](../AGENTS.md) | 本地 AI agent 契约（不入库） | 本地 |
| `docs/agent-contract.md` | Agent 契约 v2（tracked 副本） | 现行 |
| `docs/module-boundaries.md` | scan-core.mjs 模块边界约定 | 现行 |
| `docs/tech-debt.md` | 技术债登记表 | 现行 |
| `docs/release-governance.md` | 发布 / 回滚规范（本地化） | 现行 |
| `docs/adr/0001-render-architecture.md` | ADR：渲染架构决策 | 现行 |
| `docs/adr/0002-github-fetch-dual-channel.md` | ADR：GitHub 取数双通道 | 现行 |
| `docs/adr/0003-snapshot-committing.md` | ADR：快照入库策略 | 现行 |

## 本地文档（不入库）

| 路径 | 用途 | 状态 |
|---|---|---|
| `local/README.internal.md` | 对内项目说明（维护者专用） | 本地 |
| `local/agents/GOTCHAS.md` | 坑点台账 | 本地 |
| `local/agents/REVISION_LOG.md` | 自进化修订记录 | 本地 |

## 归档文档

无归档文档。

## 状态口径

- **现行**：当前实现依据，可直接引用
- **本地**：仅本机保留，不入库（`AGENTS.md` / `local/`）
- **历史**：保留链条上游，不作为实现依据
- **废弃**：已被取代，仅留档
