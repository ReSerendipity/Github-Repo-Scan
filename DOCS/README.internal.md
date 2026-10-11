# github-repo-scan 对内项目说明（维护者专用）

> 本文件位于 `DOCS/`，由根目录 `AGENTS.md` 引用；根目录 `readme.md` 一律对外。
> 架构决策记录见 `DOCS/adr/`；技术债登记见 `DOCS/tech-debt.md`。

**客户端脚本专项守卫**（重要）：客户端应用存于 `assets/dashboard-client.js`（**真实浏览器 JS**，NEXT 落地时已从模板字面量中解码抽离），由 `render-dashboard.mjs` 在渲染时读取并原样注入 `<script>` 块。

- 该文件内容必须保持「真实 JS + 可安全内嵌 HTML」两个不变式：**不得含反引号、`${`、`</script>` 或裸 CR**（它被原样注入模板输出，任何一项都会破坏整页脚本，导致页面永久卡在「正在载入…」）。
- 服务端模板字面量（`render-dashboard.mjs` 中的 HTML/CSS 部分）仍会处理转义，改动时注意 `\n`、`\r`、`\s` 会被「吃掉」（`\n`→真换行、`\s`→`s`）；但该风险已不再作用于客户端脚本文件本身。
- 测试用 `vm.Script` 实际解析每个脚本块、断言不含裸 CR，并扫描「调用了服务端专有函数却没自带定义」的引用，防止此类问题复现（见 `tests/core.test.mjs`）。

**提交前必须运行**：改动 `scan-core.mjs` / `render-dashboard.mjs` / `shared.mjs` / `assets/dashboard-client.js` 等核心逻辑后，需本地 `node --test` 全绿再提交。
