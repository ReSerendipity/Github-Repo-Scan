# github-repo-scan 对内项目说明（维护者专用）

> 本文件位于 `DOCS/`，由根目录 `AGENTS.md` 引用；根目录 `readme.md` 一律对外。
> 架构决策记录见 `DOCS/adr/`；技术债登记见 `DOCS/tech-debt.md`。

**客户端脚本专项守卫**（重要）：客户端应用存于 `assets/dashboard-client.js`（**真实浏览器 JS**，NEXT 落地时已从模板字面量中解码抽离），由 `render-dashboard.mjs` 在渲染时读取并原样注入 `<script>` 块。

- 该文件内容必须保持「真实 JS + 可安全内嵌 HTML」两个不变式：**不得含反引号、`${`、`</script>` 或裸 CR**（它被原样注入模板输出，任何一项都会破坏整页脚本，导致页面永久卡在「正在载入…」）。
- 服务端模板字面量（`render-dashboard.mjs` 中的 HTML/CSS 部分）仍会处理转义，改动时注意 `\n`、`\r`、`\s` 会被「吃掉」（`\n`→真换行、`\s`→`s`）；但该风险已不再作用于客户端脚本文件本身。
- 测试用 `vm.Script` 实际解析每个脚本块、断言不含裸 CR，并扫描「调用了服务端专有函数却没自带定义」的引用，防止此类问题复现（见 `tests/core.test.mjs`）。

**提交前必须运行**：改动 `scan-core.mjs` / `render-dashboard.mjs` / `shared.mjs` / `assets/dashboard-client.js` 等核心逻辑后，需本地 `node --test` 全绿再提交。

**安全响应约定**（对应评估报告 R2 P2-9，2026-10-11 建立）：
- 密钥泄露（gitleaks 命中或人工发现）：**24 小时内**完成处置——立即轮换受影响的 token/凭据、评估 git 历史清理（filter-repo 或 gitleaks 报告归档）、在 `gitleaks.toml` 记录结论（只记路径级 allowlist，不放宽规则本身）。
- 外部工具链漏洞（gh / git / python / actions 等）：评估影响后 **7 天内**处理或登记到 `DOCS/tech-debt.md`。
- 每周日 gitleaks 全量历史扫描 + CodeQL 定时分析结果纳入例行检查；CI 门禁失败视为 P1 事件处理。
- 审计日志：`scan-audit.jsonl`（不入库）为扫描操作留痕；建议设置 `SCAN_AUDIT_KEY` 环境变量启用逐行 HMAC 防篡改（未设置时控制台会提示一次明文模式）。
