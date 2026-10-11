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
