// server.mjs 安全边界函数单测（对应评估报告 R2 P1-1 同源校验 / P1-2 路径白名单 / P1-3 路径脱敏展开）
// 只测纯函数判定，不启动服务：server.mjs 的 listen 已收进 isDirectRun() 守卫，被 import 时无副作用。
// 风格沿用 tests/core.test.mjs：node:test + node:assert/strict，直连导入被测模块的导出。
import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { sameOriginOk, corsHeadersFor, withinScanRoots } from "../scripts/server.mjs";
import { unmaskLocalPath, maskLocalPath, readLocalConfig, defaultLocalRoots } from "../scripts/scan-core.mjs";

// server.mjs 的安全函数只读 req.headers.origin，用最小请求对象桩化，无需真实 HTTP 连接
const reqOf = (origin) => ({ headers: origin === undefined ? {} : { origin } });

// 与 withinScanRoots 内部一致的「生效白名单」解析：配置根优先，否则默认根（默认根条目可能是 {path,depth} 对象）
function effectiveRoots() {
  const cfg = (readLocalConfig().localScanRoots || []).filter((x) => typeof x === "string");
  const raw = cfg.length ? cfg : defaultLocalRoots().map((r) => (typeof r === "string" ? r : (r && r.path) || ""));
  return raw.filter(Boolean).map((x) => x.replace(/[\\/]+$/, "")).filter((x) => x.length > 1);
}

// 大小写整体翻转（用于验证比较不区分大小写，跨 Windows/Linux 都成立）
const flipCase = (s) => s.replace(/[A-Za-z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));

/* ---------------- sameOriginOk：跨站来源判定（R2 P1-1） ---------------- */

test("sameOriginOk：无 Origin 与本地来源放行", () => {
  assert.equal(sameOriginOk(reqOf(undefined)), true, "无 Origin 头（同源页面 GET、curl 等本地客户端）放行");
  assert.equal(sameOriginOk(reqOf("")), true, "空 Origin 同无 Origin");
  assert.equal(sameOriginOk(reqOf("http://127.0.0.1")), true, "无端口的本地来源");
  assert.equal(sameOriginOk(reqOf("http://127.0.0.1:8787")), true, "默认端口");
  assert.equal(sameOriginOk(reqOf("http://localhost:8787")), true);
  assert.equal(sameOriginOk(reqOf("https://localhost")), true, "https 与任意端口同样属于本地来源");
  assert.equal(sameOriginOk(reqOf("http://127.0.0.1:1")), true, "端口位只要求是数字");
  assert.equal(sameOriginOk(reqOf("http://localhost:65535")), true);
});

test("sameOriginOk：非本地来源一律拒绝（前后缀伪装、锚点、端口位）", () => {
  const rejected = [
    "https://evil.com",
    "http://evil.com/127.0.0.1", // 主机不是本地，路径里塞本地串
    "http://127.0.0.1.evil.com", // 后缀伪装成本地 IP 的子域
    "http://127.0.0.1:8787.attacker.test",
    "http://localhost.evil.com",
    "http://x127.0.0.1:8787", // 前缀伪装
    "http://mylocalhost:8787",
    "http://127.0.0.1:8787/", // 带路径：$ 锚点必须拒绝
    "http://localhost:8787x", // 端口后跟非数字
    "http://localhost:8787:9", // 端口后再接端口
    "https://127.0.0.1:8787@evil.com", // userinfo 式拼接
    "http://:8787", // 缺主机
    "127.0.0.1:8787", // 缺协议
    "ws://localhost:8787", // 非 http(s) 协议
    "http://192.168.1.1:8787", // 局域网地址不算本地回环
    "http://0.0.0.0:8787",
  ];
  for (const origin of rejected) {
    assert.equal(sameOriginOk(reqOf(origin)), false, "应拒绝跨域来源：" + origin);
  }
});

test("sameOriginOk：未知字段的存在不影响判定（只看 Origin）", () => {
  // 服务端不读 Referer/Host 兜底，攻击者无法用别的头绕过
  const req = { headers: { origin: "https://evil.com", referer: "http://127.0.0.1:8787/", host: "127.0.0.1:8787" } };
  assert.equal(sameOriginOk(req), false);
});

test("corsHeadersFor：仅本地来源回显 Origin，外部来源不回显任何 CORS 头", () => {
  assert.deepEqual(corsHeadersFor(reqOf(undefined)), { "Access-Control-Allow-Origin": "*" }, "无 Origin → 通配（本地客户端）");
  const local = corsHeadersFor(reqOf("http://localhost:8787"));
  assert.equal(local["Access-Control-Allow-Origin"], "http://localhost:8787", "本地来源按原样回显");
  assert.equal(local["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
  assert.equal(local["Access-Control-Allow-Headers"], "Content-Type");
  assert.deepEqual(corsHeadersFor(reqOf("https://evil.com")), {}, "外部来源不返回 CORS 头，浏览器按 SOP 拦截");
});

/* ---------------- withinScanRoots：/api/open 路径白名单（R2 P1-2） ---------------- */

test("withinScanRoots：白名单内放行（根本身、子路径、结尾分隔符、大小写不敏感）", () => {
  const roots = effectiveRoots();
  assert.ok(roots.length >= 1, "本机应能解析出至少一个扫描根（配置根或默认根）");
  for (const r of roots) {
    assert.equal(withinScanRoots(r), true, "根本身应在白名单内：" + r);
    assert.equal(withinScanRoots(join(r, "Github-Repo-Scan")), true, "直接子路径：" + r);
    assert.equal(withinScanRoots(join(r, "a", "b", "c")), true, "多层子路径：" + r);
    assert.equal(withinScanRoots(r + sep), true, "结尾分隔符应被归一：" + r);
    assert.equal(withinScanRoots(r + sep + sep), true, "多个结尾分隔符同样归一：" + r);
    assert.equal(withinScanRoots(flipCase(r)), true, "比较不区分大小写：" + r);
    assert.equal(withinScanRoots(flipCase(join(r, "Repo"))), true, "子路径大小写混写同样放行：" + r);
  }
});

test("withinScanRoots：白名单外拒绝（前缀重叠兄弟目录、父目录、无关绝对路径、空值）", () => {
  const roots = effectiveRoots();
  assert.ok(roots.length >= 1, "本机应能解析出至少一个扫描根");
  const r = roots[0];
  // 关键边界：必须是「目录边界」匹配，仅字符串前缀重叠不算在内
  assert.equal(withinScanRoots(join(r + "Evil", "secret-repo")), false, "兄弟目录不得因前缀重叠放行：" + r);
  assert.equal(withinScanRoots(r + "Evil"), false, "根拼后缀形成的兄弟目录应拒绝：" + r);
  assert.equal(withinScanRoots(r.slice(0, -1)), false, "根去掉一个字符的真子串应拒绝：" + r);
  assert.equal(withinScanRoots(join(r, "..")), false, "根的真父目录不应因包含关系放行：" + r);
  const unrelated = process.platform === "win32" ? "C:\\Windows\\System32\\drivers\\etc\\hosts" : "/etc/hosts";
  assert.equal(withinScanRoots(unrelated), false, "与扫描根无关的系统路径应拒绝");
  assert.equal(withinScanRoots("C:\\Users\\Public\\repo"), false, "跨用户目录应拒绝");
  assert.equal(withinScanRoots(""), false, "空串 fail-closed");
  assert.equal(withinScanRoots(null), false, "空值 fail-closed（服务端调用前另做判空）");
});

/* ---------------- unmaskLocalPath：脱敏路径展开（R2 P1-3） ---------------- */

test("unmaskLocalPath：合法脱敏串展开为主目录下的绝对路径", () => {
  const home = homedir();
  assert.equal(unmaskLocalPath("~"), home, "单独 ~ 展开为主目录");
  assert.equal(unmaskLocalPath("~/Repo"), join(home, "Repo"), "~/ 形式展开");
  assert.equal(unmaskLocalPath("~\\Repo"), join(home, "Repo"), "反斜杠形式同样展开");
  assert.equal(unmaskLocalPath("~/Desktop/x"), join(home, "Desktop", "x"), "多级子路径展开");
  assert.equal(unmaskLocalPath("~/a/b/c/d"), join(home, "a", "b", "c", "d"), "深层子路径展开");
  assert.equal(unmaskLocalPath("D:\\Other\\repo"), "D:\\Other\\repo", "非脱敏绝对路径原样返回");
  assert.equal(unmaskLocalPath(""), "", "空串原样返回（falsy 早退）");
  assert.equal(unmaskLocalPath(null), null, "空值原样返回");
  // 与 maskLocalPath 的往返保证：主目录下路径脱敏后能还原
  const p = join(home, "Repo");
  assert.equal(maskLocalPath(p), "~/Repo", "主目录直属仓库应脱敏为 ~/Repo");
  assert.equal(unmaskLocalPath(maskLocalPath(p)), p, "往返应还原为原路径");
});

test("unmaskLocalPath：不以 ~/ 起头的伪脱敏串不展开", () => {
  assert.equal(unmaskLocalPath("~evil"), "~evil", "~ 后必须是分隔符才展开");
  assert.equal(unmaskLocalPath("~user/Repo"), "~user/Repo", "他人主目录形式不展开（不做 ~user 解析）");
  assert.equal(unmaskLocalPath("a~/b"), "a~/b", "内嵌 ~ 不展开");
  assert.equal(unmaskLocalPath("$HOME/x"), "$HOME/x", "不依赖 shell 变量展开");
  assert.equal(unmaskLocalPath("~ ~/x"), "~ ~/x", "含空白的畸形串不展开");
  assert.equal(unmaskLocalPath("~/~"), join(homedir(), "~"), "嵌套 ~ 只展开一层，不做递归展开");
});

test("unmaskLocalPath + withinScanRoots：穿越型脱敏串展开后被白名单拦下", () => {
  const home = homedir();
  const traversal = unmaskLocalPath("~/../../evil.txt");
  assert.ok(!traversal.includes("~"), "展开结果不应残留 ~ 前缀");
  assert.notEqual(traversal, home, "穿越串不应被当作主目录本身");
  // 展开只负责还原，鉴权靠白名单：join 归一化 .. 后落到扫描根之外 → 拒绝
  assert.equal(withinScanRoots(traversal), false, "~/../../ 展开后的路径不得通过白名单");
  assert.equal(withinScanRoots(unmaskLocalPath("~user/Repo")), false, "未展开的 ~user 形式同样被白名单拒绝");
  assert.equal(withinScanRoots(unmaskLocalPath("$HOME/x")), false, "未展开的变量式路径同样被拒绝");
  // 合法脱敏串（面板里 local.path 的实际形态）展开后必须通过白名单
  const roots = effectiveRoots();
  assert.ok(roots.length >= 1, "本机应能解析出至少一个扫描根");
  const inside = unmaskLocalPath(maskLocalPath(join(roots[0], "Github-Repo-Scan")));
  if (inside.startsWith(home)) {
    assert.equal(withinScanRoots(inside), true, "主目录下的合法路径展开后应放行：" + inside);
  }
});
