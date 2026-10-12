# github-repo-scan AGENTS.md — AI 辅助开发指南

## 📂 对内/对外文档分区（最高优先级约定）

- **根目录 `README.md`（本仓为 `readme.md`）= 对外展示**：面向 GitHub 访客与用户，只写「这是什么、怎么用、怎么参与」。
- **`DOCS/` = 对内项目说明的唯一位置**：内部开发进度、决策记录、发布备忘、维护者备注等一律写入 `DOCS/`（对内说明入口：`DOCS/README.internal.md`）。
- **架构决策记录（ADR）统一放 `DOCS/adr/`**，编号递增，记录备选方案与取舍理由；新增关键取舍时必须成文（见 `DOCS/adr/0001-0003` 示例）。
- 维护者备忘不得写回根 README；AI 更新文档时先判断「陌生用户读了能否行动」，不能行动的进 `DOCS/`。

## 文档优先级

1. 代码与配置本身
2. `AGENTS.md`
3. `README.md` / `docs/**`
4. `DOCS/adr/`（架构决策记录）与 `DOCS/tech-debt.md`（技术债登记）

## 变更评审约定

- 触及核心模块（`scan-core.mjs` / `render-dashboard.mjs` / `shared.mjs` / `assets/`）或门禁配置（`.github/`、`hooks/`、`gitleaks.toml`、`.pre-commit-config.yaml`）的跨模块改动，**先开 PR 评审后合并**；单人阶段至少保留变更说明（提交信息注明对应评估/落地建议）。
- 分区负责人见 `.github/CODEOWNERS`：新增协作者或接入机器人时按区收窄授权。

## 推送与分支保护约定

- 本仓为**单协作者项目**：`main` 直推（admin 豁免）为既定工作流；远端分支保护的 PR-only 规则仅作**防误操作与 bot 兜底**，不要求日常变更走 PR。
- 后续 agent 直推时若收到远端 "Changes must be made through a pull request" 类提示：按本约定属预期行为（admin 直推会被标记 bypass 并放行），**不视为受阻**，照常继续；除非提示为凭据缺失、权限拒绝等真实失败。
- 若未来新增协作者或接入 bot，再按「变更评审约定」启用 PR 流程并收紧分支保护。
