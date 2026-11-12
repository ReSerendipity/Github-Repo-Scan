# GOTCHAS（坑点台账）

> 本文件由自进化协议维护：每次踩坑 / 修 bug 后追加到表尾，不删不改历史行。
> 路径优先 `local/agents/GOTCHAS.md`；存量 `docs/agents/GOTCHAS.md` 视为历史分片。
> 不得写密钥 / token / 口令 / 连接串；限制级内容只写指路，不摘正文。

| # | 坑点标题 | 触发场景 | 现象/报错 | 正确做法 | 首次发现日期 |
|---|---|---|---|---|---|
| 1 | 示例：把「探测不到」写成「缺失即故障」 | 干净检出 / CI 里读本地文件 | 报「文件缺失」，实际是设计上不入库 | 先查 `.gitignore` 与 `git ls-files`，再判定 | YYYY-MM-DD |
| 2 | 只搬函数不搬口径数据，异常被 catch 吞成"少取了一份数据" | 把某域从单文件外提（如 D3 CLI 检测），域内私有常量同时被另一处（`collectData`）直读 | `collect-data.test.mjs` 两条用例红：`row.cli` 为 `null`、`fetchErrors` 里多出 `tree`。真实原因是 `CLI_MANIFESTS` 未定义抛 `ReferenceError`，被 `try{...}catch{ fetchErrors.push("tree") }` 吞掉 | 外提前先 `grep -n` 该域每个私有常量在整个仓库的引用；被别的域消费的常量一并导出（用别名 import，别进门面白名单） | 2026-11-08 |
| 3 | 「旧用例全绿」不等于「重构成立」 | 拆分/外提类重构，跑完既有测试全绿就以为没事 | 复制式拆分（实现复制一份留在原处）旧用例照样全绿，而职责集中一点没变 | 补身份断言：门面符号必须与外提模块是**同一函数对象**（`core[name] === mod[name]`）；再补「原文件不得残留同名 `function`」与文件名导入防环 | 2026-11-08 |
| 4 | 负控回退整份文件只红了 1/9，说明其余 8 条不测这次改动 | 拆分类重构的负控 | 把 `scan-core.mjs` 回退 HEAD 后只有身份/残留/行数 3 条红，行为 6 条仍绿（它们测的是行为等价，本来就该绿） | 负控要分两组看：结构组必须红、行为组必须绿（后者绿才证明「外提没有改变行为」）；把这条差异写进提交信息，别拿「3 红」当覆盖率成绩 | 2026-11-08 |
| 5 | 台账被父目录级 ignore 挡住，`!` 反包含写了不生效 | 本仓 `.gitignore` 原为 `/local/`，按 ledger-gate 要求往台账补行后执行 `git add` | `git check-ignore -v` 仍命中 `/local/`，`git add -n` 报 paths are ignored；台账长期只存在于本机，远端无该文件 | 按 ADR-0019 改四段式：`/local/*` → `!/local/agents/` → `/local/agents/*` → `!/local/agents/GOTCHAS.md` → `!/local/agents/REVISION_LOG.md`；验收以 `git add -n` 成功为准，且同目录 `.ledger-baseline.json` 等内部件必须仍被忽略 | 2026-11-12 |
