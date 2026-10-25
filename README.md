# Github-Repo-Scan

> 把一个 GitHub 账号名下所有仓库拉成一张本地总览表：CI 状态、许可证、Release、Issue、分支、Star/Fork、健康分、可选 14 天流量，每个单元格都带 GitHub 跳转链接。
>
> A local dashboard that pulls every repository under a GitHub account into one clickable table: CI status, license, releases, issues, branches, stars/forks, a health score, and optional 14-day traffic — with a GitHub link on every cell.

[![CI Tests](https://github.com/ReSerendipity/Github-Repo-Scan/actions/workflows/test.yml/badge.svg)](https://github.com/ReSerendipity/Github-Repo-Scan/actions/workflows/test.yml)
[![License Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/Node-%E2%89%A5%2018-339932?logo=node.js&logoColor=white)](https://nodejs.org/)
[![JavaScript ESM](https://img.shields.io/badge/JavaScript-ES%20Modules-f7df1e?logo=javascript&logoColor=black)](#快速开始)
[![Last commit](https://img.shields.io/github/last-commit/ReSerendipity/Github-Repo-Scan)](https://github.com/ReSerendipity/Github-Repo-Scan/commits/main)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#贡献--contributing)
[![Governance](https://img.shields.io/badge/governance-ReSerendipity%2F.github-blue.svg)](https://github.com/ReSerendipity/.github/tree/main/governance)

[中文](#中文) | [English](#english)

---

## 中文

### 项目简介

Github-Repo-Scan 是一个零运行时依赖的 Node 脚本集：它通过 **gh CLI**（或 `GH_TOKEN`/`GITHUB_TOKEN` 直连）调用 GitHub GraphQL + REST，把账号名下全部仓库的健康状况聚合成一个**单文件 `dashboard.html`**（数据内嵌、双击即开），并提供一个只监听 `127.0.0.1` 的本地服务做"页面上一键重新扫描"。

它不部署任何服务、不需要数据库、不写 token 到磁盘；扫描结果快照（`dashboard.html` / `scan-data.json`）按约定随主分支入库，方便回溯。

### 核心特性

- **一张表看全账号**：CI 通过/失败/运行中、SPDX 许可证、最新 Release、开放 Issue 与 PR、远程/本地分支、Star/Fork、主语言、仓库大小、最近推送——单元格全部可点直达 GitHub。
- **健康分 0–100**：CI 40 + 新鲜度 30 + Issue 卫生 15 + 发布节奏 15，分 A/B/C/D 档，归档仓自动七折。
- **增量扫描**：先比对 listing 字段，未变更的仓库直接复用上次快照、不发额外请求；无变更时秒级返回。按住 **Shift** 点"重新扫描"可强制全量。
- **本地 Git 对照**：遍历本机目录找对应仓库，标注本地有/缺失、本地分支与远程跟踪分支、干净/未提交/领先/落后；支持 `--local-only` 只扫本机。
- **聚合与钻取**：顶部指标卡 + "CI 失败 / 低健康分 / 未声明许可证 / 无 CI 记录 / 本地缺失"等 chip，点一下即过滤表格；语言分布、Star 排行 Top5、归档分区一键折叠。
- **纯浏览器交互**：排序、筛选、搜索、明暗主题、命名视图、CSV 导出全部离线可用，偏好存在 localStorage。

### 界面展示

**默认总览**——聚合指标卡、问题 chip、语言分布与 Star 排行：

![默认总览](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-1.png)

**搜索与筛选**——按仓库名/描述搜索，工具栏含语言、状态下拉与命名视图：

![搜索与筛选](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-2.png)

**明暗主题**——GitHub 亮/暗两套配色，切换记忆在浏览器本地：

![明暗主题](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-3.png)

**钻取问题仓**——点"CI 失败"chip 过滤出失败仓库，含最近 5 次 Actions 运行的趋势点阵与失败工作流名：

![CI 失败钻取](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-4.png)

### 快速开始

前置条件：

- **Node.js ≥ 18**（CI 在 Node 22 上验证，无需 `npm install`，项目零运行时依赖）。
- 扫描功能需要一个 GitHub 凭据：已登录的 **gh CLI**（`gh auth login`），或环境变量 `GH_TOKEN` / `GITHUB_TOKEN`。纯前端交互（排序/筛选/主题）不需要任何凭据。

```bash
# 1. 克隆
git clone https://github.com/ReSerendipity/Github-Repo-Scan.git
cd Github-Repo-Scan

# 2. 启动本地面板（默认端口 8787，自动打开浏览器）
node scripts/server.mjs

# 3. 最小验证：浏览器打开
#    http://127.0.0.1:8787/dashboard.html
#    看到指标卡与仓库表格即成功；页面右上角"重新扫描"会用 gh 拉最新数据。
```

Windows 用户可直接双击 `启动面板.bat`。常用命令：

| 目的 | 命令 |
|---|---|
| 启动交互面板 | `node scripts/server.mjs`（`--port 9000` 换端口，`--no-open` 不自动开浏览器，`--scan-on-start=off` 启动不自动扫描） |
| 扫远程账号 + 本地对照 | `node scripts/scan.mjs`（默认扫当前 gh 登录账号；`node scripts/scan.mjs someUser` 扫指定账号） |
| 只扫本机 Git 仓库 | `node scripts/scan.mjs --local-only` |
| 只重渲染、不联网 | `node scripts/scan.mjs --render-only` |
| 跑测试 | `node --test` |

### 系统要求与兼容性

- Node.js ≥ 18（CI 在 Node 22 验证）；纯 ESM（`.mjs`），无第三方运行时依赖。
- 凭据通道：优先复用本机 `gh CLI` 登录态（token 存系统 keyring）；检测不到 gh 时自动走 `GH_TOKEN`/`GITHUB_TOKEN` 直连 REST + GraphQL。
- 面向**个人账号**（查询走 `user(login:)`），组织账号暂不支持。
- 本地服务仅监听 `127.0.0.1`，带跨站来源校验；macOS / Linux / Windows 均可运行，`.bat` 为 Windows 一键启动。

### 使用示例

```bash
# 换端口启动，且启动时不自动扫描（直接用仓库自带快照）
node scripts/server.mjs --port 9000 --scan-on-start=off

# 扫描另一个公开账号并重新生成 dashboard.html
node scripts/scan.mjs torvalds

# 只扫本机仓库，不访问 GitHub
node scripts/scan.mjs --local-only

# 改完样式后按现有快照重渲染面板
node scripts/scan.mjs --render-only
```

### 常见问题

- **端口被占用？** 用 `node scripts/server.mjs --port 9000` 指定其他端口。
- **提示未登录 gh？** 运行 `gh auth login`；或 `export GH_TOKEN=...`（一个有 `repo` 范围的 Personal Access Token）后重试。token 只走环境变量，不落盘。
- **扫描很慢？** 默认增量扫描，未变更仓库复用快照、秒级返回；首次全量或按 **Shift** 强制全量时，全账号约 5–15 秒（并发 8）。
- **不想扫本地目录？** 加 `--remote-only`；或在面板里切"仅远程"。本地对照默认只保留当前 gh 登录账号名下的仓库。
- **直接双击 `dashboard.html` 打不开数据？** 数据已内嵌在 HTML 里应能直接看；若需要"页面上一键重新扫描"，请通过 `node scripts/server.mjs` 启动，因为该按钮需要本地后端代理 gh 调用。

### 文档与治理

- 架构决策记录：[`docs/adr/0001`](docs/adr/0001-render-architecture.md) · [`0002`](docs/adr/0002-github-fetch-dual-channel.md) · [`0003`](docs/adr/0003-snapshot-committing.md)
- [模块边界](docs/module-boundaries.md) · [技术债](docs/tech-debt.md) · [发布与回滚治理](docs/release-governance.md) · [AI Agent 契约](docs/agent-contract.md)
- 变更记录见 [CHANGELOG.md](CHANGELOG.md)。
- 治理规范：[ReSerendipity/.github/governance](https://github.com/ReSerendipity/.github/tree/main/governance)。

### 贡献

欢迎 Issue 与 PR。提交前请本地跑一遍 `node --test`，并按需激活 `hooks/pre-push` 推送前门闸；提交信息建议带签名（`git commit -s`）。安全问题请按仓库治理与 SECURITY 流程私下反馈，勿直接开公开 issue 暴露凭据。

### 许可证

基于 [Apache-2.0](LICENSE) 协议开源。

---

## English

### Overview

Github-Repo-Scan is a zero-runtime-dependency Node script set. It uses the **gh CLI** (or a `GH_TOKEN`/`GITHUB_TOKEN` direct channel) to call the GitHub GraphQL + REST APIs and aggregate every repository under an account into a **single self-contained `dashboard.html`** (data embedded, opens by double-click). A tiny local server bound to `127.0.0.1` powers a "re-scan from the page" button.

It deploys nothing, uses no database, and never writes a token to disk. Scan snapshots (`dashboard.html` / `scan-data.json`) are committed to `main` by convention for traceability.

### Features

- **One table for the whole account**: CI pass/fail/running, SPDX license, latest release, open issues & PRs, remote/local branches, stars/forks, primary language, repo size, last push — every cell links to GitHub.
- **0–100 health score**: CI 40 + freshness 30 + issue hygiene 15 + release cadence 15, graded A/B/C/D; archived repos are discounted to 70%.
- **Incremental scans**: listing-level diff first; unchanged repos reuse the previous snapshot with zero extra requests — near-instant when nothing changed. Hold **Shift** while clicking "重新扫描" for a forced full scan.
- **Local Git cross-check**: walks local directories to match repos, flagging present/missing, local vs. remote-tracking branches, clean/dirty/ahead/behind; `--local-only` scans only local repos.
- **Aggregate drill-down**: top metric cards + chips for "CI failing / low health / no license / no CI record / local missing" filter the table in one click; language distribution, Star Top-5 and the archived section collapse as needed.
- **Pure browser UX**: sorting, filtering, search, light/dark theme, named views and CSV export all work offline; preferences persist in localStorage.

### Screenshots

**Default overview** — aggregate metric cards, issue chips, language distribution and Star ranking:

![Default overview](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-1.png)

**Search & filter** — search by repo name/description, with language/status dropdowns and named views:

![Search and filter](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-2.png)

**Light/dark theme** — GitHub-style light and dark palettes, remembered in the browser:

![Light and dark theme](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-3.png)

**Drill into failing repos** — click the "CI failing" chip to filter failures, including the 5-run CI trend dots and the failing workflow name:

![CI failure drill-down](https://gcore.jsdelivr.net/gh/ReSerendipity/Github-Repo-Scan@main/docs/assets/readme-github-repo-scan-4.png)

### Quick Start

Requirements:

- **Node.js ≥ 18** (CI verified on Node 22). No `npm install` — zero runtime dependencies.
- Scanning needs a GitHub credential: a logged-in **gh CLI** (`gh auth login`), or `GH_TOKEN` / `GITHUB_TOKEN` in the environment. Pure UI work (sort/filter/theme) needs no credential.

```bash
# 1. Clone
git clone https://github.com/ReSerendipity/Github-Repo-Scan.git
cd Github-Repo-Scan

# 2. Start the local panel (default port 8787, opens the browser)
node scripts/server.mjs

# 3. Minimal check: open
#    http://127.0.0.1:8787/dashboard.html
#    Metric cards and the repo table mean it works; "重新扫描" pulls fresh data via gh.
```

Windows users can double-click `启动面板.bat`. Common commands:

| Goal | Command |
|---|---|
| Start the panel | `node scripts/server.mjs` (`--port 9000` to change port, `--no-open` to skip opening the browser, `--scan-on-start=off` to skip auto-scan) |
| Scan remote account + local cross-check | `node scripts/scan.mjs` (defaults to the current gh account; `node scripts/scan.mjs someUser` scans another account) |
| Local Git repos only | `node scripts/scan.mjs --local-only` |
| Re-render only, no network | `node scripts/scan.mjs --render-only` |
| Run tests | `node --test` |

### Requirements & Compatibility

- Node.js ≥ 18 (CI on Node 22); pure ESM (`.mjs`), no third-party runtime dependencies.
- Auth: prefers the local **gh CLI** login (token in the system keyring); falls back to a `GH_TOKEN`/`GITHUB_TOKEN` REST + GraphQL direct channel.
- Built for **personal accounts** (queries use `user(login:)`); organization accounts are not supported yet.
- The local server listens only on `127.0.0.1` with cross-origin checks; runs on macOS, Linux and Windows (`.bat` for one-click Windows launch).

### Examples

```bash
# Start on another port, using the bundled snapshot without auto-scanning
node scripts/server.mjs --port 9000 --scan-on-start=off

# Scan another public account and regenerate dashboard.html
node scripts/scan.mjs torvalds

# Scan only local Git repos, no GitHub calls
node scripts/scan.mjs --local-only

# Re-render the panel from the existing snapshot after styling tweaks
node scripts/scan.mjs --render-only
```

### FAQ

- **Port in use?** Run `node scripts/server.mjs --port 9000`.
- **Not logged in to gh?** Run `gh auth login`, or `export GH_TOKEN=...` (a Personal Access Token with `repo` scope) and retry. The token stays in the environment and is never written to disk.
- **Scanning is slow?** The default incremental scan reuses snapshots for unchanged repos and returns in seconds; the first full run (or a Shift-forced full scan) takes about 5–15 seconds for a whole account at concurrency 8.
- **Skip local directories?** Add `--remote-only`, or switch to remote-only in the panel. Local cross-check keeps only repos belonging to the current gh account by default.
- **Double-clicking `dashboard.html` shows no data?** Data is embedded in the HTML and should render directly; for the on-page "re-scan" button you need `node scripts/server.mjs`, because that button calls the local backend which proxies gh.

### Docs & Governance

- Architecture decision records: [`docs/adr/0001`](docs/adr/0001-render-architecture.md) · [`0002`](docs/adr/0002-github-fetch-dual-channel.md) · [`0003`](docs/adr/0003-snapshot-committing.md)
- [Module boundaries](docs/module-boundaries.md) · [Tech debt](docs/tech-debt.md) · [Release & rollback governance](docs/release-governance.md) · [AI agent contract](docs/agent-contract.md)
- See [CHANGELOG.md](CHANGELOG.md) for release history.
- Governance: [ReSerendipity/.github/governance](https://github.com/ReSerendipity/.github/tree/main/governance).

### Contributing

Issues and PRs are welcome. Run `node --test` before submitting and enable `hooks/pre-push` as a pre-push gate when useful; prefer signed commits (`git commit -s`). Please report security issues privately per the repository's security process rather than filing a public issue that exposes credentials.

### License

Released under the [Apache-2.0](LICENSE) license.
