(function () {
  'use strict';

  // 打开/刷新页面总是从顶部开始（避免浏览器恢复上次滚动位置、停在页面底部）
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  window.scrollTo(0, 0);
  // bfcache 软刷新/后台恢复时不重跑脚本，这里兜底回到顶部
  window.addEventListener('pageshow', function () { window.scrollTo(0, 0); });

  // 列布局恢复（列顺序 + 列宽）在每次 render 后应用；具体实现由 initColLayout 挂载
  var applyColLayout = function () {};

  var SVG_STAR = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>';
  var SVG_FORK = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/></svg>';
  var SVG_SUN = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0Zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm9.193 9.193a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 1 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM16 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8ZM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8Zm10.657-5.657a.75.75 0 0 1 0 1.061l-1.06 1.06a.75.75 0 1 1-1.061-1.06l1.06-1.06a.75.75 0 0 1 1.061 0ZM4.464 11.536a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 0 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0Z"/></svg>';
  var SVG_MOON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z"/></svg>';
  var SVG_SYNC = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/></svg>';

  var THEME_KEY = 'grs-theme';
  var AUTO_KEY = 'grs-auto';
  var SORT_KEY = 'grs-sort';
  var state = { data: null, sortKey: 'pushedAt', sortDir: 'desc', scanning: false, q: '', fLang: '', fStatus: '', noFork: false, noArchived: false, mode: 'both', expanded: {}, rankMetric: 'stars' };
  var VIEWS_KEY = 'ghscan.views.v1';
  var MODE_KEY = 'grs-mode';
  var viewState = { views: {}, current: '' };
  try { viewState.views = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}') || {}; } catch (e) { viewState.views = {}; }
  var autoTimer = null;

  var SVG_FOLDER = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M1.75 1.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V4.75a.25.25 0 0 0-.25-.25H7.5a.75.75 0 0 1-.6-.3L5.9 2.9a.25.25 0 0 0-.2-.1H1.75ZM0 1.75C0 .784.784 0 1.75 0h4.06c.464 0 .909.216 1.194.585l1.28 1.665h5.966c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V1.75Z"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function relTime(iso) {
    if (!iso) return '—';
    var days = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (days < 1 / 24) return Math.max(1, Math.round(days * 24 * 60)) + ' 分钟前';
    if (days < 1) return Math.round(days * 24) + ' 小时前';
    if (days < 30) return Math.round(days) + ' 天前';
    if (days < 365) return Math.round(days / 30) + ' 个月前';
    return (days / 365).toFixed(1) + ' 年前';
  }
  function fullTime(iso) {
    return iso ? new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
  }

  /* ---------- 主题 ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var b = document.getElementById('themeBtn');
    if (b) { b.innerHTML = t === 'dark' ? SVG_SUN : SVG_MOON; b.title = t === 'dark' ? '切换到亮色主题' : '切换到暗色主题'; }
  }

  /* ---------- 健康评分(与 scan-core.mjs 导出的 scoreOf/gradeOf 同款实现) ---------- */
  function scoreOf(r) {
    if (!r) return 0;
    var ci;
    if (r.ci && r.ci.cls === 'ok') {
      var tr = (r.ci.trend || []);
      var done = tr.filter(function (x) { return ['success', 'failure', 'timed_out', 'startup_failure', 'action_required'].indexOf(x.c) >= 0; });
      var okr = done.filter(function (x) { return x.c === 'success'; }).length;
      var ratio = done.length ? okr / done.length : 1;
      ci = 25 + Math.round(15 * ratio);
    } else if (r.ci && r.ci.cls === 'running') ci = 20;
    else if (r.ci && r.ci.cls === 'none') ci = 15;
    else ci = 0;
    var days = r.pushedAt ? (Date.now() - new Date(r.pushedAt).getTime()) / 86400000 : Infinity;
    var fresh = days <= 7 ? 30 : days <= 30 ? 24 : days <= 90 ? 16 : days <= 365 ? 8 : 2;
    var n = r.openIssues == null ? 0 : r.openIssues;
    var hyg = n === 0 ? 15 : n <= 2 ? 12 : n <= 9 ? 8 : n <= 29 ? 4 : 0;
    var relDays = (r.latestRelease && r.latestRelease.publishedAt)
      ? (Date.now() - new Date(r.latestRelease.publishedAt).getTime()) / 86400000 : null;
    var rel = relDays == null ? ((r.releases || 0) > 0 ? 5 : 3) : (relDays <= 90 ? 15 : relDays <= 365 ? 9 : 5);
    var total = ci + fresh + hyg + rel;
    if (r.isArchived) total = Math.round(total * 0.7);
    return Math.max(0, Math.min(100, total));
  }
  function gradeOf(score) {
    if (score >= 85) return { g: 'A', cls: 'ok' };
    if (score >= 70) return { g: 'B', cls: 'info' };
    if (score >= 50) return { g: 'C', cls: 'warn' };
    return { g: 'D', cls: 'fail' };
  }

  // 仓库大小格式化（与模块级 fmtSize 语义一致；客户端脚本拿不到模块作用域，须自带一份）
  function fmtSize(kb) {
    if (!kb) return '—';
    if (kb < 1024) return kb + ' KB';
    var mb = kb / 1024;
    if (mb < 1024) return mb.toFixed(1) + ' MB';
    return (mb / 1024).toFixed(2) + ' GB';
  }

  /* ---------- 排序 ---------- */
  var SORT_VAL = {
    name: function (r) { return r.name; },
    visibility: function (r) { return r.visibility === 'PRIVATE' ? 1 : 0; },
    ci: function (r) { return { fail: 3, running: 2, ok: 1, none: 0 }[r.ci.cls] || 0; },
    license: function (r) { return r.license ? r.license.toLowerCase() : null; },
    cli: function (r) { return r.cli ? ({ 'CLI': 2, '脚本集': 1, '无': 0 }[r.cli.state] ?? 0) : null; },
    release: function (r) { return r.latestRelease && r.latestRelease.publishedAt ? r.latestRelease.publishedAt : null; },
    issues: function (r) { return r.openIssues; },
    branches: function (r) { return r.branches; },
    stars: function (r) { return r.stars; },
    localBranch: function (r) {
      if (!state.data || !state.data.localScan) return null;
      var l = r.local;
      if (!l || !l.branch) return null;
      return (l.branch + (l.upstream ? ' ' + l.upstream : '')).toLowerCase();
    },
    forks: function (r) { return r.forks; },
    language: function (r) { return r.language ? r.language.toLowerCase() : null; },
    pushedAt: function (r) { return r.pushedAt; },
    score: function (r) { return scoreOf(r); },
    traffic: function (r) { return r.traffic ? r.traffic.views : null; },
    size: function (r) { return r.size || 0; },
    files: function (r) { return r.lastCommit && r.lastCommit.files ? r.lastCommit.fileCount : null; },
    createdAt: function (r) { return r.createdAt ? new Date(r.createdAt).getTime() : null; },
    local: function (r) {
      if (!state.data || !state.data.localScan) return null;
      var l = r.local;
      if (!l) return 0;
      if (l.dirty) return 3;
      if ((l.ahead || 0) > 0 || (l.behind || 0) > 0) return 2;
      return 1;
    }
  };
  var ASC_DEFAULT = { name: true, license: true, language: true };

  function saveSort() {
    try { localStorage.setItem(SORT_KEY, JSON.stringify({ k: state.sortKey, d: state.sortDir })); } catch (e) {}
  }
  function loadSort() {
    try {
      var ss = JSON.parse(localStorage.getItem(SORT_KEY) || 'null');
      if (ss && SORT_VAL[ss.k]) {
        state.sortKey = ss.k;
        state.sortDir = ss.d === 'asc' ? 'asc' : 'desc';
      }
    } catch (e) {}
  }

  /* ---------- 筛选 ---------- */
  function matchFilters(r) {
    if (state.noFork && r.isFork) return false;
    if (state.noArchived && r.isArchived) return false;
    if (state.fStatus === 'ok' && r.ci.cls !== 'ok') return false;
    if (state.fStatus === 'pub' && r.visibility !== 'PUBLIC') return false;
    if (state.fStatus === 'priv' && r.visibility !== 'PRIVATE') return false;
    if (state.fStatus === 'lowScore' && scoreOf(r) >= 50) return false;
    if (state.fStatus === 'archived' && !r.isArchived) return false;
    if (state.fStatus === 'fail' && r.ci.cls !== 'fail') return false;
    if (state.fStatus === 'running' && r.ci.cls !== 'running') return false;
    if (state.fStatus === 'none' && r.ci.cls !== 'none') return false;
    if (state.fStatus === 'hasIssue' && r.openIssues <= 0) return false;
    if (state.fStatus === 'noLic' && r.license) return false;
    if (state.fLang && r.language !== state.fLang) return false;
    var hasLocalData = state.data && state.data.localScan;
    if (state.fStatus === 'noLocal' && (!hasLocalData || !!r.local)) return false;
    if (state.fStatus === 'dirtyLocal' && (!hasLocalData || !r.local || !r.local.dirty)) return false;
    if (state.fStatus === 'aheadLocal' && (!hasLocalData || !r.local || !(((r.local.ahead || 0) > 0) || ((r.local.behind || 0) > 0)))) return false;
    if (state.q) {
      var qq = state.q.toLowerCase();
      var hay = (r.name + ' ' + (r.description || '')).toLowerCase();
      if (hay.indexOf(qq) === -1) return false;
    }
    return true;
  }

  function rebuildLangOptions() {
    var sel = document.getElementById('fLang');
    var langs = {};
    state.data.rows.forEach(function (r) { if (r.language) langs[r.language] = true; });
    var names = Object.keys(langs).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
    var cur = sel.value || state.fLang;
    var html = '<option value="">全部语言</option>';
    for (var i = 0; i < names.length; i++) html += '<option value="' + esc(names[i]) + '">' + esc(names[i]) + '</option>';
    sel.innerHTML = html;
    if (cur && names.indexOf(cur) >= 0) { sel.value = cur; state.fLang = cur; }
    else { state.fLang = ''; }
  }

  function visibleRows() {
    return currentRows().filter(matchFilters);
  }

  function currentRows() {
    var rows = state.data.rows.slice();
    var val = SORT_VAL[state.sortKey] || SORT_VAL.pushedAt;
    var dir = state.sortDir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      var va = val(a), vb = val(b);
      var an = va == null || va === '', bn = vb == null || vb === '';
      if (an && bn) return 0;
      if (an) return 1;   // 空值恒沉底
      if (bn) return -1;
      if (typeof va === 'string') return va.localeCompare(String(vb), 'zh-CN') * dir;
      return (va - vb) * dir;
    });
    return rows;
  }

  function updateArr() {
    var ths = document.querySelectorAll('th.sortable');
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i], k = th.getAttribute('data-key');
      th.classList.toggle('active', k === state.sortKey);
      var arr = th.querySelector('.arr');
      if (arr) arr.textContent = k === state.sortKey ? (state.sortDir === 'desc' ? '▼' : '▲') : '';
    }
  }

  /* ---------- 渲染 ---------- */
  function metric(v, k) {
    return '<div class="metric"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>';
  }

  function trendDots(r) {
    var t = (r.ci && r.ci.trend) || [];
    if (!t.length) return '';
    var out = '<span class="trend">';
    for (var i = 0; i < t.length; i++) {
      var x = t[i];
      var cls = '';
      if (x.c === 'success') cls = 'ok';
      else if (x.c === 'failure' || x.c === 'timed_out' || x.c === 'startup_failure' || x.c === 'action_required') cls = 'fail';
      else if (x.s && x.s !== 'completed') cls = 'run';
      out += '<span class="tdot ' + cls + '" title="' + esc(fullTime(x.at)) + ' · ' + esc(x.c == null ? (x.s || '未知') : x.c) + '"></span>';
    }
    return out + '</span>';
  }

  function ciCell(r) {
    var ci = r.ci;
    if (!ci.url) return '<span class="badge ' + ci.cls + '"><span class="dot"></span>' + esc(ci.state) + '</span>' + trendDots(r);
    var tip = '最近一次运行：' + (ci.workflow || '未知工作流') + (ci.ref ? '（' + ci.ref + '）' : '') + (ci.ranAt ? ' · ' + fullTime(ci.ranAt) : '');
    var sub = [ci.workflow, ci.ref ? '@' + ci.ref : '', ci.ranAt ? relTime(ci.ranAt) : ''].filter(Boolean).join(' · ');
    return '<a class="badge ' + ci.cls + '" href="' + esc(ci.url) + '" target="_blank" rel="noopener" title="' + esc(tip) + '"><span class="dot"></span>' + esc(ci.state) + '</a><div class="sub">' + esc(sub) + '</div>' + trendDots(r);
  }

  function cliCell(r) {
    var c = r.cli;
    if (!c) return '<span class="mut">—</span>';
    var cls = c.state === 'CLI' ? 'ok' : (c.state === '脚本集' ? 'warn' : 'none');
    var src = c.src === 'local' ? '本地检测' : (c.src === 'remote' ? '远程检测' : '');
    var tip = [c.detail, src].filter(Boolean).join(' · ') || '未检测到命令行入口';
    return '<span class="badge ' + cls + '" title="' + esc(tip) + '"><span class="dot"></span>' + esc(c.state) + '</span>';
  }

  function scoreCell(r) {
    var s = scoreOf(r), g = gradeOf(s);
    var col = g.cls === 'ok' ? 'var(--ok)' : g.cls === 'info' ? 'var(--accent)' : g.cls === 'warn' ? 'var(--warn)' : 'var(--fail)';
    var tip = 'CI ' + (r.ci ? r.ci.state : '?') + ' · 最近推送 ' + relTime(r.pushedAt) + ' · 开放 Issue ' + (r.openIssues || 0) + ' · 健康分 = CI 40 + 新鲜度 30 + Issue 卫生 15 + 发布节奏 15' + (r.isArchived ? '(归档仓七折)' : '');
    return '<span class="badge ' + g.cls + '" title="' + esc(tip) + '"><span class="dot"></span>' + s + ' · ' + g.g + '</span>' +
      '<div class="scorebar" title="' + s + ' 分"><i style="width:' + s + '%;background:' + col + '"></i></div>';
  }
  function visibilityCell(r) {
    if (!r.visibility) return '<span class="muted">—</span>';
    var priv = r.visibility === 'PRIVATE';
    return '<span class="badge ' + (priv ? 'warn' : 'local-ok') + '"><span class="dot"></span>' + (priv ? '私有' : '公开') + '</span>';
  }
  function sizeCell(r) {
    return '<span class="sz" title="' + (r.size || 0) + ' KB">' + fmtSize(r.size) + '</span>';
  }
  function filesCell(r) {
    var lc = r.lastCommit;
    if (!lc || !lc.fileCount) return '<span class="muted">—</span>';
    var open = !!state.expanded[r.name];
    var head = '<button class="filetoggle" type="button" data-name="' + esc(r.name) + '" title="' + esc((lc.message || '') + (lc.at ? ' · ' + fullTime(lc.at) : '')) + '">最近 ' + lc.fileCount + ' 文件</button>';
    if (!open) return head;
    var list = '<div class="filelist">';
    for (var i = 0; i < lc.files.length; i++) {
      var f = lc.files[i];
      var stCls = f.status === 'added' ? 'add' : (f.status === 'removed' ? 'del' : 'mod');
      var stTxt = f.status === 'added' ? 'A' : (f.status === 'removed' ? 'D' : 'M');
      var num = (f.add || 0) + (f.del || 0) ? ('+' + (f.add || 0) + ' −' + (f.del || 0)) : '';
      list += '<div class="fi"><span class="st ' + stCls + '">' + stTxt + '</span>' +
        (lc.url ? '<a class="fn" href="' + esc(lc.url) + '" target="_blank" rel="noopener" title="' + esc(f.name) + '">' + esc(f.name) + '</a>' : '<span class="fn" title="' + esc(f.name) + '">' + esc(f.name) + '</span>') +
        (num ? '<span class="num">' + num + '</span>' : '') + '</div>';
    }
    list += '</div>';
    return head + list;
  }
  function trafficCell(r) {
    var t = r.traffic;
    if (!t) return '<a class="muted" href="' + esc(r.url) + '/graphs/traffic" target="_blank" rel="noopener" title="未采集流量:设环境变量 SCAN_WITH_TRAFFIC=1 后重新扫描">—</a>';
    return '<a class="muted" href="' + esc(r.url) + '/graphs/traffic" target="_blank" rel="noopener" title="近 14 天:' + t.viewUniques + ' 位访客 · ' + t.cloneUniques + ' 人克隆">' + t.views + ' 浏览 · ' + t.clones + ' 克隆</a>';
  }

  function localCell(r) {
    var d = state.data;
    if (!d || !d.localScan) return '<span class="muted" title="未启用本地扫描：点「仅扫本地」或运行 node scan.mjs --local-only">—</span>';
    var l = r.local;
    if (!l) return '<span class="badge" title="本机扫描范围内没有对应目录"><span class="dot"></span>本地缺失</span>';
    var bits = [];
    if (l.dirty) bits.push('<span class="dirty">未提交 ' + (l.dirtyCount || 0) + '</span>');
    if ((l.ahead || 0) > 0) bits.push('↑' + l.ahead);
    if ((l.behind || 0) > 0) bits.push('↓' + l.behind);
    if (!bits.length) bits.push('干净');
    var tip = esc(l.path || '') + (l.branch ? ' @ ' + esc(l.branch) : '') + (l.upstream ? '（远程跟踪分支 ' + esc(l.upstream) + '）' : '') + ' · 基于本地缓存的远程 refs，不自动 fetch';
    var okBadge;
    if (l.path) {
      okBadge = '<a class="badge local-ok local-open" href="/api/open?path=' + encodeURIComponent(l.path) + '" title="点击在系统文件管理器中打开：' + tip + '"><span class="dot"></span>本地有</a>';
    } else {
      okBadge = '<span class="badge local-ok" title="' + tip + '"><span class="dot"></span>本地有</span>';
    }
    return okBadge + '<div class="sub">' + bits.join(' · ') + '</div>';
  }

  function localRowHtml(lr) {
    var ghLink;
    if (lr.github && lr.github.isGitHub) {
      var ghUrl = 'https://github.com/' + lr.github.owner + '/' + lr.github.repo;
      ghLink = '<a href="' + esc(ghUrl) + '" target="_blank" rel="noopener">' + esc(lr.github.owner + '/' + lr.github.repo) + '</a>';
    } else if (lr.remoteUrl) {
      ghLink = '<span class="muted" title="' + esc(lr.remoteUrl) + '">非 GitHub 远程</span>';
    } else {
      ghLink = '<span class="muted">无远程</span>';
    }
    var st = [];
    if (lr.dirty) st.push('<span class="tag warn">未提交 ' + (lr.dirtyCount || 0) + '</span>');
    if ((lr.ahead || 0) > 0) st.push('<span class="tag" title="本地领先远程">↑ ' + lr.ahead + '</span>');
    if ((lr.behind || 0) > 0) st.push('<span class="tag" title="本地落后远程">↓ ' + lr.behind + '</span>');
    if (!st.length) st.push('<span class="tag">干净</span>');
    if (lr.error) st.push('<span class="tag warn" title="' + esc(lr.error) + '">读取异常</span>');
    var branchTip = '本机当前检出的本地分支' + (lr.upstream ? '，远程跟踪分支 ' + esc(lr.upstream) : '');
    var limL = function (arr) { return arr.length > 50 ? arr.slice(0, 50).join('、') + '…（共 ' + arr.length + ' 个）' : arr.join('、'); };
    if (lr.localBranches && lr.localBranches.length) branchTip += '\n全部本地分支：' + esc(limL(lr.localBranches));
    if (lr.remoteBranches && lr.remoteBranches.length) branchTip += '\n远程跟踪分支：' + esc(limL(lr.remoteBranches));
    var nameCell = '<span class="repo-name">' + esc(lr.name) + '</span>' + (lr.matched ? '' : ' <span class="tag">远程无对应</span>');
    return '<tr>' +
      '<td class="repo">' + nameCell + '</td>' +
      '<td class="path" title="点击在系统文件管理器中打开：' + esc(lr.path) + '"><a class="local-open" href="/api/open?path=' + encodeURIComponent(lr.path) + '" title="点击在系统文件管理器中打开该文件夹">' + esc(lr.path) + '</a></td>' +
      '<td title="' + branchTip + '"><span class="branch-type loc" title="本机当前检出的本地分支">本地</span>' + esc(lr.branch || '—') + (lr.upstream ? ' <span class="branch-type rem" title="该本地分支对应的远程跟踪分支">远程</span><span class="muted">' + esc(lr.upstream) + '</span>' : '') + (lr.head ? ' <span class="muted">@' + esc(lr.head) + '</span>' : '') + '</td>' +
      '<td>' + st.join(' ') + '</td>' +
      '<td class="num">' + (lr.lastCommitAt ? '<span title="' + esc(fullTime(lr.lastCommitAt)) + '">' + esc(relTime(lr.lastCommitAt)) + '</span>' : '<span class="muted">—</span>') + '</td>' +
      '<td>' + ghLink + '</td>' +
      '</tr>';
  }

  function renderLocalBox() {
    var box = document.getElementById('localOnlyBox');
    var d = state.data;
    if (!d || !d.localScan) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var only = state.mode === 'both';
    if (only && d.localScan.localOnlyCount === 0) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var repos = d.localScan.repos.slice();
    if (only) repos = repos.filter(function (x) { return !x.matched; });
    repos.sort(function (a, b) { var va = a.lastCommitAt || '', vb = b.lastCommitAt || ''; return vb < va ? -1 : vb > va ? 1 : 0; });
    var label = only
      ? '本地独有仓库（' + repos.length + '）—— 本机存在、远程账号名下没有对应目录'
      : '本地 Git 仓库（' + repos.length + '）—— 只读本机 .git 状态，不做网络请求';
    box.style.display = '';
    box.innerHTML = '<div class="panel-title">' + esc(label) + '</div><div class="local-scroll"><table class="local-table"><thead><tr><th>仓库</th><th>本地路径</th><th>分支（本地/远程）</th><th>工作区状态</th><th>最近提交</th><th>远程</th></tr></thead><tbody>' + repos.map(localRowHtml).join('') + '</tbody></table></div>';
  }

  function localBranchCell(r) {
    var l = r.local;
    if (!l || !l.branch) return '<span class="muted" title="本机扫描范围内没有对应 Git 仓库">—</span>';
    var n = (l.localBranches && l.localBranches.length) || 1;
    var html = '<span class="branch-type loc" title="本机当前检出的本地分支">本地</span>' + esc(l.branch) + '<span class="muted" title="全部本地分支数"> · ' + n + ' 个</span>';
    if (l.upstream) html += ' <span class="branch-type rem" title="该本地分支对应的远程跟踪分支">远程</span><span class="muted">' + esc(l.upstream) + '</span>';
    return html;
  }
  function localBranchTip(r) {
    var l = r.local;
    if (!l || !l.branch) return '';
    var lim = function (arr) { return arr.length > 50 ? arr.slice(0, 50).join('、') + '…（共 ' + arr.length + ' 个）' : arr.join('、'); };
    var tip = '本地分支 ' + l.branch + (l.upstream ? ' · 远程分支 ' + l.upstream : '');
    if (l.localBranches && l.localBranches.length) tip += '\n全部本地分支：' + lim(l.localBranches);
    if (l.remoteBranches && l.remoteBranches.length) tip += '\n远程跟踪分支：' + lim(l.remoteBranches);
    return tip;
  }

  function rowHtml(r) {
    var tags =
      (r.visibility && r.visibility !== 'PUBLIC' ? '<span class="tag warn">私有</span>' : '') +
      (r.isArchived ? '<span class="tag">已归档</span>' : '') +
      (r.isFork ? '<span class="tag">fork</span>' : '');
    var lic = r.license
      ? (r.licenseUrl
          ? '<a href="' + esc(r.licenseUrl) + '" target="_blank" rel="noopener" title="打开 LICENSE 文件">' + esc(r.license) + '</a>'
          : '<span class="muted" title="未在根目录检测到标准 LICENSE 文件">' + esc(r.license) + '</span>')
      : '<span class="muted">未声明</span>';
    var rel = r.latestRelease
      ? '<a href="' + esc(r.latestRelease.url) + '" target="_blank" rel="noopener" title="' + esc(fullTime(r.latestRelease.publishedAt)) + '">' + esc(r.latestRelease.tag) + '</a><div class="sub">' + esc(((r.latestRelease.name && r.latestRelease.name !== r.latestRelease.tag) ? r.latestRelease.name + ' · ' : '') + (r.latestRelease.publishedAt ? relTime(r.latestRelease.publishedAt) : '')) + '</div>'
      : '<a class="muted" href="' + esc(r.url) + '/releases" target="_blank" rel="noopener">暂无发布</a>';
    var issue = '<a href="' + esc(r.url) + '/issues" target="_blank" rel="noopener" title="打开 Issues 页">' + r.openIssues + ' 个</a>' +
      (r.openPRs > 0 ? ' <a class="sub" href="' + esc(r.url) + '/pulls" target="_blank" rel="noopener" title="打开 Pull requests 页">+' + r.openPRs + ' PR</a>' : '');
    var branchTip = '打开 Branches 页：默认分支 ' + esc(r.defaultBranch) + '，共 ' + r.branches + ' 个';
    if (r.branchNames && r.branchNames.length) {
      branchTip += '\n全部远程分支：' + (r.branchNames.length > 50 ? esc(r.branchNames.slice(0, 50).join('、')) + '…（共 ' + r.branchNames.length + ' 个）' : esc(r.branchNames.join('、')));
    }
    var branch = '<span class="branch-type rem" title="GitHub 上的远程分支">远程</span><a href="' + esc(r.url) + '/branches" target="_blank" rel="noopener" title="' + branchTip + '">' + esc(r.defaultBranch) + ' · ' + r.branches + ' 个</a>';
    var star = '<a href="' + esc(r.url) + '/stargazers" target="_blank" rel="noopener" title="打开 Stargazers 页">' + SVG_STAR + ' ' + r.stars + '</a>';
    var fork = '<a href="' + esc(r.url) + '/forks" target="_blank" rel="noopener" title="打开 Forks 页">' + SVG_FORK + ' ' + r.forks + '</a>';
    return '<tr>' +
      '<td data-key="name" class="repo"><a class="repo-name" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a>' + tags + '<div class="desc" title="' + esc(r.description) + '">' + esc(r.description || '无描述') + '</div></td>' +
      '<td data-key="visibility" class="vis">' + visibilityCell(r) + '</td>' +
      '<td data-key="local" class="local-cell">' + localCell(r) + '</td>' +
      '<td data-key="score" class="score">' + scoreCell(r) + '</td>' +
      '<td data-key="ci">' + ciCell(r) + '</td>' +
      '<td data-key="license" class="lic">' + lic + '</td>' +
      '<td data-key="cli">' + cliCell(r) + '</td>' +
      '<td data-key="release">' + rel + '</td>' +
      '<td data-key="issues" class="num">' + issue + '</td>' +
      '<td data-key="branches" class="branch-cell branch-remote">' + branch + '</td>' +
      '<td data-key="localBranch" class="branch-cell branch-local" title="' + esc(localBranchTip(r)) + '">' + localBranchCell(r) + '</td>' +
      '<td data-key="stars" class="num">' + star + '</td>' +
      '<td data-key="forks" class="num">' + fork + '</td>' +
      '<td data-key="language" class="lang"><span class="lang" title="' + esc(r.language || '') + '"><span class="ldot" style="background:' + esc(r.langColor) + '"></span>' + esc(r.language || '—') + '</span></td>' +
      '<td data-key="size" class="num">' + sizeCell(r) + '</td>' +
      '<td data-key="traffic" class="num">' + trafficCell(r) + '</td>' +
      '<td data-key="files">' + filesCell(r) + '</td>' +
      '<td data-key="pushedAt" class="num"><span title="' + esc(fullTime(r.pushedAt)) + '">' + esc(relTime(r.pushedAt)) + '</span></td>' +
      '<td data-key="createdAt" class="num"><span title="' + esc(fullTime(r.createdAt)) + '">' + esc(relTime(r.createdAt)) + '</span></td>' +
      '</tr>';
  }

  function render() {
    var d = state.data;
    if (!d) {
      document.getElementById('scanMeta').textContent = '尚未扫描';
      document.getElementById('metrics').innerHTML = '';
      document.getElementById('tbody').innerHTML = '<tr><td class="empty" colspan="18">暂无数据 —— 点击右上角「重新扫描」开始第一次扫描（需已启动 node server.mjs）</td></tr>';
      return;
    }
    var avatar = document.getElementById('avatar');
    if (d.avatarUrl) { avatar.src = d.avatarUrl; avatar.style.display = ''; }
    document.getElementById('title').textContent = d.owner + ' · GitHub 仓库总览';
    var hasLocal = !!(d.localScan);
    var meta = '扫描时间 ' + fullTime(d.scannedAt) + ' · 共 ' + d.totals.repos + ' 个仓库（账号名下 ' + d.totals.totalRepos + ' 个） · 数据源 gh api（GraphQL + REST）';
    if (d.scanInfo) {
      var si = d.scanInfo;
      meta += ' · 本次' + (si.mode === 'reuse' ? '无变更·复用快照' : (si.mode === 'full' ? '强制全量' : '增量扫描 ' + si.deepScanned + '/' + si.total)) + ' · ' + ((si.durationMs || 0) / 1000).toFixed(1) + 's';
    }
    if (hasLocal) meta += ' · 本地对照 ' + d.localScan.count + ' 仓（' + fullTime(d.localScan.scannedAt) + '）';
    document.getElementById('scanMeta').textContent = meta;
    var t = d.totals;
    var pub = d.rows.filter(function (r) { return r.visibility === 'PUBLIC'; }).length;
    var priv = d.rows.filter(function (r) { return r.visibility === 'PRIVATE'; }).length;
    var totalSize = fmtSize(t.sizeTotal || 0);
    var weekStars = null;
    if (d.starWeekRef) {
      var ws = 0, hasW = false;
      for (var wi = 0; wi < d.rows.length; wi++) { if (d.rows[wi].starWeek != null) { ws += d.rows[wi].starWeek; hasW = true; } }
      if (hasW) weekStars = ws;
    }
    document.getElementById('metrics').innerHTML =
      metric(t.repos, '仓库') +
      metric(pub, '公开') +
      metric(priv, '私有') +
      metric(totalSize, '总大小') +
      metric(t.stars, 'Star 合计') +
      metric(weekStars == null ? '—' : (weekStars > 0 ? '+' : '') + weekStars, '本周新增★') +
      metric(t.forks, 'Fork 合计') +
      metric(t.openIssues + '<span class="vsub"> +' + t.openPRs + ' PR</span>', '开放 Issue') +
      metric(t.releases, '发布合计') +
      metric(t.ciOk + '<span class="vsub">/' + t.ciDone + '</span>', 'CI 通过 / 有记录') +
      metric(function () { var s = 0, n = d.rows.length || 1; for (var i = 0; i < d.rows.length; i++) s += scoreOf(d.rows[i]); return Math.round(s / n); }(), '平均健康分') +
      (hasLocal ? metric(t.localMatched + '<span class="vsub">/' + t.localTotal + '</span>', '本地对照') + metric(t.localMissing, '本地缺失') + metric(t.localOnly, '本地独有') + metric(t.localDirty, '本地未提交') : '');

    // 聚合视图：CI 失败 / 低健康分 / 未声明许可证 / 无 CI / 本地缺失 —— 点击 chip 直接套用筛选
    var ciFail = d.rows.filter(function (r) { return r.ci.cls === 'fail'; }).length;
    var ciNone = d.rows.filter(function (r) { return r.ci.cls === 'none'; }).length;
    var low = d.rows.filter(function (r) { return scoreOf(r) < 50; }).length;
    var noLicC = d.rows.filter(function (r) { return !r.license; }).length;
    var noLocalC = d.localScan ? d.rows.filter(function (r) { return !r.local; }).length : 0;
    var archivedC = d.rows.filter(function (r) { return r.isArchived; }).length;
    var chips = [];
    function chip(cls, n, label, status, plain) { if (n > 0) chips.push('<button class="alert-chip ' + cls + '" data-status="' + status + '" title="点击筛出这些仓库">' + (plain ? '' : '⚠ ') + '<span class="n">' + n + '</span> ' + label + '</button>'); }
    chip('fail', ciFail, '个仓库 CI 失败', 'fail');
    chip('warn', low, '个低健康分(&lt;50)', 'lowScore');
    chip('warn', noLicC, '个未声明许可证', 'noLic');
    chip('', ciNone, '个无 CI 记录', 'none');
    chip('', noLocalC, '个本地缺失', 'noLocal');
    chip('', archivedC, '个归档仓库', 'archived', true);
    document.getElementById('alertBox').innerHTML = chips.length ? '<span class="lbl">聚合视图：</span>' + chips.join('') : '';

    // 语言分布：按仓库数 Top 排序，条长按占比
    var langCount = {};
    var langColors = {};
    for (var li2 = 0; li2 < d.rows.length; li2++) {
      var lg = d.rows[li2].language || '未知';
      langCount[lg] = (langCount[lg] || 0) + 1;
      if (d.rows[li2].language) langColors[d.rows[li2].language] = d.rows[li2].langColor;
    }
    var langArr = Object.keys(langCount).map(function (k) { return { name: k, count: langCount[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
    var maxLang = langArr.length ? langArr[0].count : 1;
    var langHtml = langArr.map(function (x) {
      var col = langColors[x.name] || '#8b949e';
      return '<div class="lang-row"><div class="top"><span class="nm">' + esc(x.name) + '</span><span class="ct">' + x.count + ' 仓</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(x.count / maxLang * 100) + '%;background:' + col + '"></i></div></div>';
    }).join('');
    document.getElementById('langBox').innerHTML = langHtml ? '<span class="lbl">语言分布（Top ' + langArr.length + '）：</span>' + langHtml : '';

    // 排行榜（可切换指标）：Top 5
    var rankMetrics = [
      { key: 'stars', label: 'Star', get: function (r) { return r.stars || 0; }, unit: '★' },
      { key: 'forks', label: 'Fork', get: function (r) { return r.forks || 0; }, unit: 'Fork' },
      { key: 'issues', label: 'Issue', get: function (r) { return r.openIssues || 0; }, unit: 'Issue' },
      { key: 'health', label: '健康分', get: function (r) { return scoreOf(r); }, unit: '分' },
    ];
    var rm = rankMetrics.filter(function (m) { return m.key === state.rankMetric; })[0] || rankMetrics[0];
    var rankArr = d.rows.slice().sort(function (a, b) { return rm.get(b) - rm.get(a); }).slice(0, 5);
    var maxRank = rankArr.length ? rm.get(rankArr[0]) : 1;
    var toggles = rankMetrics.map(function (m) { return '<button class="rank-metric' + (m.key === rm.key ? ' on' : '') + '" data-metric="' + m.key + '" title="按 ' + m.label + ' 排行">' + m.label + '</button>'; }).join('');
    var rankHtml = rankArr.map(function (x, i) {
      var v = rm.get(x); var pct = maxRank > 0 ? Math.round(v / maxRank * 100) : 0;
      var valTxt = (rm.key === 'stars' ? v + ' ' : '') + rm.unit;
      if (rm.key === 'stars' && x.starWeek != null) {
        valTxt += ' <span class="swtrend ' + (x.starWeek > 0 ? 'up' : (x.starWeek < 0 ? 'down' : 'flat')) + '" title="近 7 天 Star 变化">' + (x.starWeek > 0 ? '+' : '') + x.starWeek + '/周</span>';
      }
      return '<div class="lang-row"><div class="top"><span><span class="rk">#' + (i + 1) + '</span><a class="nm" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a></span><span class="ct">' + valTxt + '</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%;background:var(--accent)"></i></div></div>';
    }).join('');
    document.getElementById('rankBox').innerHTML = rankArr.length ? '<span class="lbl">排行 Top5：</span>' + toggles + rankHtml : '';

    // 归档仓库独立分区（不参与活跃度评比，仅汇总列出）
    var archArr = d.rows.filter(function (r) { return r.isArchived; });
    var archHtml = archArr.map(function (x) {
      var s = scoreOf(x), g = gradeOf(s);
      return '<div class="lang-row"><div class="top"><span><span class="rk">●</span><a class="nm" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a></span><span class="ct">' + s + ' · ' + g.g + '</span></div></div>';
    }).join('');
    document.getElementById('archivedBox').innerHTML = archHtml ? '<span class="lbl">归档仓库（' + archArr.length + '，不参与活跃度评比）：</span>' + archHtml : '';

    rebuildLangOptions();

    document.getElementById('modeBox').style.display = hasLocal ? '' : 'none';
    if (!hasLocal && state.mode !== 'both') state.mode = 'both';
    document.getElementById('mainScroll').style.display = state.mode === 'local' ? 'none' : '';
    var rows = visibleRows();
    document.getElementById('tbody').innerHTML = rows.length
      ? rows.map(rowHtml).join('')
      : '<tr><td class="empty" colspan="17">没有匹配的仓库 —— 试试清空搜索或放宽筛选条件</td></tr>';
    renderLocalBox();
    applyColLayout(); // 恢复用户自定义的列顺序与列宽（拖拽重排/调宽后持久化，排序/筛选重渲染后保持）

    var extra = [];
    if (d.rate && typeof d.rate.remaining === 'number') {
      extra.push('GitHub API 余量 <strong>' + d.rate.remaining + '/' + d.rate.limit + '</strong>，' + esc(fullTime(new Date(d.rate.reset * 1000).toISOString())) + ' 重置');
    }
    if (d.truncated) extra.push('仓库超过 500 个，仅显示最近推送的前 500 个');
    document.getElementById('footExtra').innerHTML = extra.length ? extra.join(' · ') : '';
  }

  /* ---------- 扫描更新 ---------- */
  function setHint(text, cls) {
    var h = document.getElementById('scanHint');
    h.textContent = text;
    h.className = 'hint' + (cls ? ' ' + cls : '');
  }

  function doScan(e) {
    if (state.scanning) return;
    var full = !!(e && e.shiftKey);
    state.scanning = true;
    var btn = document.getElementById('scanBtn');
    btn.classList.add('scanning');
    btn.querySelector('.lbl').textContent = '扫描中…';
    setHint(full ? '强制全量扫描：逐仓拉取许可证 / CI / 最近提交（约 5–15 秒）…' : '先探测仓库有无变更，只对变更仓库深度扫描（无变更会秒级返回）…');
    fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full: full }) })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
      })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'HTTP 错误');
        state.data = j.data;
        updateArr();
        render();
        var si = state.data.scanInfo || {};
        var tag = si.mode === 'reuse' ? '无变更·复用快照' : (si.mode === 'full' ? '强制全量' : '增量扫描 ' + si.deepScanned + '/' + si.total);
        setHint('已更新：' + fullTime(state.data.scannedAt) + ' · ' + tag + ' · ' + ((si.durationMs || 0) / 1000).toFixed(1) + 's · dashboard.html 与 scan-data.json 已同步写入磁盘', 'okc');
      })
      .catch(function (e) {
        var m = String((e && e.message) || e);
        if (/failed to fetch|networkerror|load failed|fetch failed/i.test(m)) {
          m = '未检测到本地服务：请在项目文件夹运行 node server.mjs 启动后重试（或用 node scan.mjs 命令行刷新静态快照）';
        } else if (location.protocol.indexOf('http') === 0 && !/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
          m = '静态托管页面无法扫描（没有本地服务）：请在本地运行 node server.mjs 后使用，或直接浏览内嵌快照';
        }
        setHint('扫描失败：' + m, 'err');
      })
      .then(function () {
        state.scanning = false;
        btn.classList.remove('scanning');
        btn.querySelector('.lbl').textContent = '重新扫描';
      });
  }

  /* ---------- 本地扫描与视图模式 ---------- */
  function doScanLocal() {
    if (state.scanning) return;
    state.scanning = true;
    var btn = document.getElementById('scanLocalBtn');
    btn.classList.add('scanning');
    btn.querySelector('.lbl').textContent = '扫描中…';
    setHint('正在扫描本机 Git 仓库（遍历目录 + 读取 .git 状态，不访问 GitHub）…');
    fetch('/api/scan-local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
      })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'HTTP 错误');
        state.data = j.data;
        updateArr();
        setMode(state.mode, true);
        render();
        var ls = state.data.localScan;
        setHint('本地扫描完成：' + fullTime(ls.scannedAt) + ' · 本机 ' + ls.count + ' 仓 · 对上 ' + ls.matched + ' · dashboard.html 与 scan-data.json 已写入磁盘', 'okc');
      })
      .catch(function (e) {
        var m = String((e && e.message) || e);
        if (/failed to fetch|networkerror|load failed|fetch failed/i.test(m)) {
          m = '未检测到本地服务：请先运行 node server.mjs，或命令行 node scan.mjs --local-only';
        }
        setHint('本地扫描失败：' + m, 'err');
      })
      .then(function () {
        state.scanning = false;
        btn.classList.remove('scanning');
        btn.querySelector('.lbl').textContent = '仅扫本地';
      });
  }

  function setMode(m, skipRender) {
    var hasLocal = !!(state.data && state.data.localScan);
    state.mode = (m === 'local' && hasLocal) ? 'local' : 'both';
    try { localStorage.setItem(MODE_KEY, state.mode); } catch (e) {}
    document.getElementById('modeBoth').className = 'btn' + (state.mode === 'both' ? ' on' : '');
    document.getElementById('modeLocal').className = 'btn' + (state.mode === 'local' ? ' on' : '');
    if (!skipRender) render();
  }

  /* ---------- 自动刷新 ---------- */
  function applyAuto(silent) {
    var mins = parseInt(document.getElementById('auto').value, 10) || 0;
    try { localStorage.setItem(AUTO_KEY, String(mins)); } catch (e) {}
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (mins > 0) {
      autoTimer = setInterval(function () { if (!state.scanning) doScan(); }, mins * 60000);
      if (!silent) setHint('自动刷新已开启：每 ' + mins + ' 分钟扫描一次（每次消耗约 ' + '30–40 个 GitHub API 调用）', 'okc');
    }
  }

  /* ---------- 自定义视图 ---------- */
  function saveViews() { try { localStorage.setItem(VIEWS_KEY, JSON.stringify(viewState.views)); } catch (e) {} }
  function rebuildViewOptions() {
    var sel = document.getElementById('fView');
    var names = Object.keys(viewState.views).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
    var html = '<option value="">视图:手动状态</option>';
    for (var i = 0; i < names.length; i++) html += '<option value="' + esc(names[i]) + '">' + esc(names[i]) + '</option>';
    sel.innerHTML = html;
    if (viewState.current && viewState.views[viewState.current]) sel.value = viewState.current;
    else viewState.current = '';
  }
  function captureView() {
    return { q: state.q, fLang: state.fLang, fStatus: state.fStatus, noFork: state.noFork, noArchived: state.noArchived, sortKey: state.sortKey, sortDir: state.sortDir };
  }
  function applyView(v) {
    state.q = v.q || ''; document.getElementById('q').value = state.q;
    state.fLang = v.fLang || ''; document.getElementById('fLang').value = state.fLang;
    state.fStatus = v.fStatus || ''; document.getElementById('fStatus').value = state.fStatus;
    state.noFork = !!v.noFork; document.getElementById('fNoFork').checked = state.noFork;
    state.noArchived = !!v.noArchived; document.getElementById('fNoArchived').checked = state.noArchived;
    state.sortKey = SORT_VAL[v.sortKey] ? v.sortKey : 'pushedAt';
    state.sortDir = v.sortDir === 'asc' ? 'asc' : 'desc';
    saveSort(); updateArr(); rebuildLangOptions(); render();
  }

  /* ---------- 导出 CSV（当前筛选/排序结果） ---------- */
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    // 公式注入防护（CWE-1236，R2 P2-5）：以 = + - @ 或制表符开头的字段加 ' 前缀，Excel 按文本打开不执行公式
    if (/^[=+\-@\t]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function exportCsv() {
    var rows = visibleRows();
    var head = ['仓库', '可见性', '本地状态', '健康分', '健康等级', 'CI', '许可证', 'CLI', 'Release', 'Issue', 'PR', '远程分支', '远程分支全部', '本地分支', '本地分支全部', 'Star', '近7天★', 'Fork', '语言', '大小(KB)', '流量浏览', '流量克隆', '最近变更文件数', '最近推送', 'URL'];
    var lines = [head.map(csvCell).join(',')];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var g = gradeOf(scoreOf(r));
      var vis = r.visibility === 'PRIVATE' ? '私有' : (r.visibility === 'PUBLIC' ? '公开' : '');
      var local = r.local
        ? (r.local.dirty ? '未提交 ' + (r.local.dirtyCount || 0)
          : (((r.local.ahead || 0) > 0 || (r.local.behind || 0) > 0) ? '本地与远程不一致' : '本地有'))
        : '本地缺失';
      lines.push([
        r.name, vis, local, scoreOf(r), g.g, r.ci.state, r.license || '', (r.cli ? r.cli.state : ''),
        r.latestRelease ? r.latestRelease.tag : '', r.openIssues, r.openPRs, r.branches, (r.branchNames || []).join(';'), (r.local && r.local.branch ? r.local.branch + (r.local.upstream ? ' → ' + r.local.upstream : '') : ''), (r.local && r.local.localBranches ? r.local.localBranches.join(';') : ''), r.stars, r.starWeek == null ? '' : r.starWeek, r.forks,
        r.language || '', r.size || 0, r.traffic ? r.traffic.views : '', r.traffic ? r.traffic.clones : '',
        r.lastCommit ? r.lastCommit.fileCount : '', relTime(r.pushedAt), r.url,
      ].map(csvCell).join(','));
    }
    var csv = '﻿' + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.data && state.data.owner ? state.data.owner : 'github') + '-repos-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setHint('已导出 ' + rows.length + ' 个仓库到 CSV（UTF-8，Excel 可直接打开）', 'okc');
  }

  /* ---------- 复制 clone 命令 ---------- */
  function copyClones() {
    var rows = visibleRows();
    if (!rows.length) { setHint('当前没有可见仓库可复制', 'err'); return; }
    var text = rows.map(function (r) { return 'git clone ' + r.url; }).join('\n');
    function done() { setHint('已复制 ' + rows.length + ' 条 git clone 命令到剪贴板', 'okc'); }
    function fb() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) { setHint('复制失败（浏览器限制）：可在控制台手动复制', 'err'); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fb);
    else fb();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    var saved = 'light';
    try { saved = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(saved);

    document.getElementById('scanBtn').querySelector('.ico').innerHTML = SVG_SYNC;
    document.getElementById('scanBtn').addEventListener('click', doScan);
    document.getElementById('scanLocalBtn').querySelector('.ico2').innerHTML = SVG_FOLDER;
    document.getElementById('scanLocalBtn').addEventListener('click', doScanLocal);
    document.getElementById('modeBoth').addEventListener('click', function () { setMode('both'); });
    document.getElementById('modeLocal').addEventListener('click', function () { setMode('local'); });
    document.getElementById('cfgBtn').addEventListener('click', function () {
      var d = state.data || {};
      var cur = ((d.localScan && d.localScan.roots) || []).join(' ; ');
      var input = prompt('本地扫描根目录（分号分隔；留空恢复默认：主目录1层 + 桌面/文档/下载）:', cur);
      if (input === null) return;
      var roots = input.split(/[;；]/).map(function (s) { return s.trim(); }).filter(Boolean);
      fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localScanRoots: roots }) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }); })
        .then(function (j) {
          if (!j.ok) throw new Error(j.error || 'HTTP 错误');
          setHint(roots.length ? '本地目录已保存（' + roots.length + ' 个）：点「重新扫描」或「仅扫本地」生效' : '已清空自定义目录，恢复默认探测：点「重新扫描」或「仅扫本地」生效', 'okc');
        })
        .catch(function () {
          setHint('保存失败（需本地服务 node server.mjs）；也可命令行临时指定：node scan.mjs --local-paths "目录1;目录2"', 'err');
        });
    });
    document.getElementById('themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    var qEl = document.getElementById('q');
    qEl.addEventListener('input', function () { state.q = qEl.value.trim(); render(); });
    var fl = document.getElementById('fLang');
    fl.addEventListener('change', function () { state.fLang = fl.value; render(); });
    var fs = document.getElementById('fStatus');
    fs.addEventListener('change', function () { state.fStatus = fs.value; render(); });
    var nf = document.getElementById('fNoFork');
    nf.addEventListener('change', function () { state.noFork = nf.checked; render(); });
    var na = document.getElementById('fNoArchived');
    na.addEventListener('change', function () { state.noArchived = na.checked; render(); });
    var asEl = document.getElementById('fAutoScanStart');
    asEl.addEventListener('change', function () {
      fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoScanOnStart: asEl.checked ? 'always' : 'off' }) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (j) {
          if (!j.ok) setHint('保存启动扫描偏好失败（需本地服务 node server.mjs）', 'err');
          else setHint(asEl.checked ? '已开启：下次启动面板将先自动扫描（约 20–40 秒）再打开页面' : '已关闭启动前自动扫描', 'okc');
        });
    });
    var ooEl = document.getElementById('fOwnerOnly');
    ooEl.addEventListener('change', function () {
      fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localOwnerOnly: ooEl.checked }) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (j) {
          if (!j.ok) setHint('保存「只扫本账户」偏好失败（需本地服务 node server.mjs）', 'err');
          else setHint(ooEl.checked ? '已开启「只扫本账户」：点「重新扫描」后本地对照只保留本账号仓库' : '已关闭「只扫本账户」：点「重新扫描」后本机全部 Git 仓库都会算进来', 'okc');
        });
    });
    document.getElementById('csvBtn').addEventListener('click', exportCsv);
    document.getElementById('cloneBtn').addEventListener('click', copyClones);
    document.getElementById('alertBox').addEventListener('click', function (e) {
      var chip = e.target.closest ? e.target.closest('.alert-chip') : null;
      if (chip && chip.getAttribute('data-status')) {
        var st = chip.getAttribute('data-status');
        state.fStatus = st;
        document.getElementById('fStatus').value = st;
        render();
        setHint('已按聚合视图筛选：' + chip.textContent.replace(/^[⚠\s]+/, '').replace(/\s+/g, ' ').trim(), 'okc');
      }
    });
    document.getElementById('rankBox').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.rank-metric') : null;
      if (btn && btn.getAttribute('data-metric')) {
        state.rankMetric = btn.getAttribute('data-metric');
        render();
      }
    });
    document.getElementById('tbody').addEventListener('click', function (e) {
      var tgl = e.target.closest ? e.target.closest('.filetoggle') : null;
      if (tgl && tgl.getAttribute('data-name')) {
        var nm = tgl.getAttribute('data-name');
        if (state.expanded[nm]) delete state.expanded[nm]; else state.expanded[nm] = true;
        render();
      }
    });
    var au = document.getElementById('auto');
    au.addEventListener('change', function () { applyAuto(false); });
    var savedAuto = '0';
    try { savedAuto = localStorage.getItem(AUTO_KEY) || '0'; } catch (e) {}
    if (['10', '30', '60'].indexOf(savedAuto) >= 0) au.value = savedAuto;
    applyAuto(true);

    // 启动前扫描开关：从服务端配置回填复选框（无本地服务时静默跳过，默认不勾选）
    fetch('/api/config').then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        if (j && j.ok && j.config) {
          var m = String(j.config.autoScanOnStart || 'first').toLowerCase();
          document.getElementById('fAutoScanStart').checked = (m === 'always' || m === 'stale');
          // 「只扫本账户」默认开启，只有显式 false 才不勾选
          document.getElementById('fOwnerOnly').checked = (j.config.localOwnerOnly !== false);
        }
      }).catch(function () {});

    // 聚合视图折叠：从 localStorage 恢复偏好，点击切换
    var aggWrap = document.getElementById('aggWrap');
    var aggToggle = document.getElementById('aggToggle');
    function setAggCollapsed(c) {
      if (c) aggWrap.classList.add('collapsed'); else aggWrap.classList.remove('collapsed');
      try { localStorage.setItem('aggCollapsed', c ? '1' : '0'); } catch (e) {}
    }
    try { if (localStorage.getItem('aggCollapsed') === '1') aggWrap.classList.add('collapsed'); } catch (e) {}
    aggToggle.addEventListener('click', function () { setAggCollapsed(!aggWrap.classList.contains('collapsed')); });

    rebuildViewOptions();
    document.getElementById('fView').addEventListener('change', function () {
      var name = this.value;
      viewState.current = name;
      if (name && viewState.views[name]) applyView(viewState.views[name]);
    });
    document.getElementById('viewSave').addEventListener('click', function () {
      var name = prompt('视图名称(保存当前搜索/筛选/排序):', viewState.current || '');
      if (!name) return;
      viewState.views[name] = captureView();
      viewState.current = name;
      saveViews(); rebuildViewOptions();
      setHint('已保存视图「' + name + '」(共 ' + Object.keys(viewState.views).length + ' 个视图)', 'okc');
    });
    document.getElementById('viewDel').addEventListener('click', function () {
      if (!viewState.current || !viewState.views[viewState.current]) { setHint('先在下拉框选中要删除的视图', 'err'); return; }
      delete viewState.views[viewState.current];
      viewState.current = '';
      saveViews(); rebuildViewOptions();
      setHint('已删除视图', 'okc');
    });

    var ths = document.querySelectorAll('th.sortable');
    for (var i = 0; i < ths.length; i++) {
      (function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-key');
          if (state.sortKey === k) {
            state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
          } else {
            state.sortKey = k;
            state.sortDir = ASC_DEFAULT[k] ? 'asc' : 'desc';
          }
          saveSort();
          updateArr();
          render();
        });
      })(ths[i]);
    }

    try { if (localStorage.getItem(MODE_KEY) === 'local') state.mode = 'local'; } catch (e) {}
    loadSort();
    updateArr();
    var embedded = window.__SCAN_DATA__ || null;
    if (embedded) { state.data = embedded; render(); }
    else { render(); }
    // 有本地服务时，用服务的最新快照覆盖内嵌数据（静态快照可能更旧）
    fetch('/api/data')
      .then(function (r) { if (!r.ok) throw new Error('no data'); return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.data && j.data.rows) { state.data = j.data; render(); }
      })
      .catch(function () { /* file:// 或静态托管时无服务，用内嵌快照 */ });

    // 轮询服务状态：启动时的后台自动扫描完成后自动刷新（页面本身立即可用，无需等待扫描）
    var lastScannedAt = (state.data && state.data.scannedAt) || null;
    var wasScanning = false;
    function pollStatus() {
      fetch('/api/status')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok || !j.status) return;
          if (j.status.scanning) {
            wasScanning = true;
            setHint('后台正在扫描（' + (j.status.mode || 'auto') + '）… 无变更会秒级返回，可先浏览现有快照', '');
          } else if (wasScanning) {
            wasScanning = false;
            fetch('/api/data')
              .then(function (r) { return r.json(); })
              .then(function (jj) {
                if (jj && jj.ok && jj.data && jj.data.rows && jj.data.scannedAt !== lastScannedAt) {
                  state.data = jj.data; lastScannedAt = jj.data.scannedAt; updateArr(); render();
                  var si = jj.data.scanInfo || {};
                  setHint('后台扫描完成，已刷新：' + (si.mode === 'reuse' ? '无变更·复用快照' : (si.mode === 'full' ? '强制全量' : '增量 ' + si.deepScanned + '/' + si.total)) + ' · ' + ((si.durationMs || 0) / 1000).toFixed(1) + 's', 'okc');
                }
              })
              .catch(function () {});
          }
        })
        .catch(function () { /* 无本地服务时忽略 */ });
    }
    pollStatus();
    setInterval(pollStatus, 3000);

    // 魔搭社区魔粒余额：与 GitHub 扫描解耦的独立小组件
    // 打开时只读本地缓存（瞬开、不刷网络）；点「刷新」才请求 /api/modelscope?refresh=1
    function renderMoli(m) {
      var el = document.getElementById('moliBody');
      var bar = document.getElementById('moliBar');
      if (!el || !bar) return;
      if (!m || m.ok === false) {
        bar.classList.add('err');
        if (m && m.configured === false) {
          el.textContent = '未配置 ModelScope 凭据：设 MODELSCOPE_API_TOKEN 环境变数，或 modelscope login 后重试';
        } else {
          el.textContent = '拉取失败：' + String((m && m.error) || '未知错误') + (m && m.cached ? '（显示上次缓存）' : '');
        }
        return;
      }
      bar.classList.remove('err');
      var av = m.available_balance, tot = m.total_balance, fr = m.frozen_amount;
      var when = m.updatedAt ? new Date(m.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '';
      el.innerHTML =
        '<span class="moli-val">' + (av == null ? '—' : av) + '<small>可用</small></span>' +
        '<span class="moli-sep">·</span>总 ' + (tot == null ? '—' : tot) +
        (fr ? '<span class="moli-sep">·</span>冻结 ' + fr : '') +
        '<span class="moli-sep">·</span><span style="font-size:12px">更新 ' + when + (m.cached ? '（缓存）' : '') + '</span>';
    }
    function loadMoli(refresh) {
      fetch('/api/modelscope' + (refresh ? '?refresh=1' : ''))
        .then(function (r) { return r.json(); })
        .then(function (j) { renderMoli(j && j.moli); })
        .catch(function () { renderMoli({ ok: false, error: '本地服务不可用' }); });
    }
    var moliRefreshBtn = document.getElementById('moliRefresh');
    if (moliRefreshBtn) moliRefreshBtn.addEventListener('click', function () {
      var b = document.getElementById('moliBody'); if (b) b.textContent = '刷新中…';
      loadMoli(true);
    });
    loadMoli(false);

    // 主表滚轮转横向：横向滚动条在表格最底部、日常很难够到，
    // 鼠标悬停在表格上时滚轮直接左右滚动表格（到最左/最右边界后放行纵向滚动页面）
    var mainScrollEl = document.getElementById('mainScroll');
    if (mainScrollEl && mainScrollEl.addEventListener) {
      mainScrollEl.addEventListener('wheel', function (e) {
        var sw = mainScrollEl.scrollWidth, cw = mainScrollEl.clientWidth;
        if (sw <= cw + 2) return;                          // 无横向溢出：保持默认纵向滚动
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // 触控板横向手势：交给原生
        var atStart = mainScrollEl.scrollLeft <= 0 && e.deltaY < 0;
        var atEnd = mainScrollEl.scrollLeft >= sw - cw - 2 && e.deltaY > 0;
        if (atStart || atEnd) return;                      // 横向到边界：放行给页面纵向滚动
        e.preventDefault();
        mainScrollEl.scrollLeft += e.deltaY;
      }, { passive: false });
    }

    // 列布局管理：① 列宽拖拽（表头分隔线）② 列拖拽重排（表头文字，竖线提示插入位置）
    // ③ 顺序/宽度持久化到 localStorage，每次 render 后由 applyColLayout 恢复
    (function initColLayout() {
      var table = document.querySelector('table.main-table');
      if (!table) return;
      var row = table.querySelector('thead tr');
      var mainScroll = document.getElementById('mainScroll');
      var DEFAULTS = [126, 58, 106, 58, 88, 96, 72, 88, 56, 135, 218, 48, 48, 64, 56, 56, 78, 58, 58];
      var N = DEFAULTS.length;
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem('grs_cols') || 'null'); } catch (e) {}
      var order = [];
      for (var oi = 0; oi < N; oi++) order.push(oi);
      var widths = DEFAULTS.slice();
      if (saved && saved.order && saved.order.length === N) {
        for (oi = 0; oi < N; oi++) order[oi] = Number(saved.order[oi]);
        for (oi = 0; oi < N; oi++) widths[oi] = Math.max(40, Math.min(700, Number(saved.widths && saved.widths[oi]) || DEFAULTS[oi]));
      }
      function persist() { try { localStorage.setItem('grs_cols', JSON.stringify({ order: order, widths: widths })); } catch (e) {} }
      var baseThs = null, KEYS = [];
      function applyOrder() {
        if (!baseThs) {
          baseThs = Array.prototype.slice.call(row.children);
          for (var ki = 0; ki < baseThs.length; ki++) KEYS.push(baseThs[ki].getAttribute('data-key') || '');
        }
        // 幂等重排：始终以初始列序 KEYS[order[i]] 为目标定位，重复调用不会交错
        for (var i = 0; i < N; i++) {
          var key = KEYS[order[i]];
          var th = key ? row.querySelector('th[data-key="' + key + '"]') : null;
          if (th && th !== row.children[i]) row.insertBefore(th, row.children[i]);
        }
        var tbody = table.querySelector('tbody');
        if (!tbody) return;
        var trs = tbody.querySelectorAll('tr');
        for (var k = 0; k < trs.length; k++) {
          var tr = trs[k];
          if (tr.children.length !== N) continue; // 空态行（colspan）
          for (var j = 0; j < N; j++) {
            var tkey = KEYS[order[j]];
            var td = tkey ? tr.querySelector('td[data-key="' + tkey + '"]') : null;
            if (td && td !== tr.children[j]) tr.insertBefore(td, tr.children[j]);
          }
        }
      }
      function applyWidths() {
        var total = 0;
        for (var i = 0; i < N; i++) {
          var th = row.children[i];
          if (th) { th.style.width = widths[i] + 'px'; total += widths[i]; }
        }
        table.style.minWidth = total + 'px';
      }
      applyColLayout = function () { applyOrder(); applyWidths(); };
      applyColLayout();

      // 每个 th 挂载：宽度手柄 + 整列拖拽
      for (var ci = 0; ci < N; ci++) {
        (function (idx) {
          var th = row.children[idx];

          // —— 列宽拖拽（分隔线手柄）——
          var h = document.createElement('span');
          h.className = 'col-resizer';
          h.title = '拖动调整「' + th.textContent.trim() + '」列宽，双击恢复默认';
          h.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var zoom = (parseFloat(getComputedStyle(document.body).zoom) || 1) * (parseFloat(getComputedStyle(table).zoom) || 1);
            var startX = e.clientX, startW = widths[idx];
            function move(ev) {
              var nw = Math.max(40, Math.min(700, startW + (ev.clientX - startX) / zoom));
              if (nw !== widths[idx]) { widths[idx] = nw; th.style.width = nw + 'px'; }
              var total = 0;
              for (var k = 0; k < N; k++) total += widths[k];
              table.style.minWidth = total + 'px';
            }
            function up() {
              document.removeEventListener('mousemove', move);
              document.removeEventListener('mouseup', up);
              document.body.style.userSelect = '';
              persist();
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
            document.body.style.userSelect = 'none';
          });
          h.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
          h.addEventListener('dblclick', function (e) {
            e.preventDefault(); e.stopPropagation();
            widths[idx] = DEFAULTS[idx];
            applyColLayout();
            persist();
          });
          th.appendChild(h);

          // —— 整列拖拽重排（表头文字区域）——
          var guide = document.getElementById('colGuide');
          if (!guide && mainScroll) {
            guide = document.createElement('div');
            guide.id = 'colGuide';
            mainScroll.appendChild(guide);
          }
          th.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (e.target && e.target.classList && e.target.classList.contains('col-resizer')) return;
            var startX = e.clientX, startY = e.clientY;
            var moved = false;
            var zoom = 1;
            function colIndexAt(x) {
              var ths = row.children;
              for (var i = 0; i < ths.length; i++) {
                var r = ths[i].getBoundingClientRect();
                if (x < r.left + r.width / 2) return i;
              }
              return ths.length;
            }
            function move(ev) {
              if (!moved) {
                if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 4) return; // 拖拽阈值
                moved = true;
                zoom = (parseFloat(getComputedStyle(document.body).zoom) || 1) * (parseFloat(getComputedStyle(table).zoom) || 1);
                th.classList.add('col-dragging');
                document.body.style.userSelect = 'none';
              }
              ev.preventDefault();
              var to = colIndexAt(ev.clientX);
              var cRect = mainScroll.getBoundingClientRect();
              var ths = row.children;
              var xCss = to < ths.length ? (ths[to].getBoundingClientRect().left - cRect.left) / zoom : (cRect.right - cRect.left) / zoom;
              guide.style.left = Math.max(0, xCss) + 'px';
              guide.style.display = 'block';
            }
            function up() {
              document.removeEventListener('mousemove', move);
              document.removeEventListener('mouseup', up);
              guide.style.display = 'none';
              document.body.style.userSelect = '';
              if (!moved) return; // 未拖动 = 普通点击，交还排序
              th.classList.remove('col-dragging');
              var to = colIndexAt(lastX);
              if (to !== idx) {
                var f = order[idx];
                order.splice(idx, 1);
                order.splice(to, 0, f);
                var w = widths[idx];
                widths.splice(idx, 1);
                widths.splice(to, 0, w);
                applyColLayout();
                persist();
              }
              // 吞掉这次拖拽后的 click，避免触发排序
              function swallow(ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', swallow, true); }
              document.addEventListener('click', swallow, true);
            }
            var lastX = startX;
            document.addEventListener('mousemove', function (ev) { lastX = ev.clientX; });
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
          });
        })(ci);
      }
    })();

    // 表格大小滑块：整体缩放主表（叠加在页面 125% 上），自动记住
    var tsInput = document.getElementById('tableScale');
    var tsVal = document.getElementById('tableScaleVal');
    var mainTableEl = document.querySelector('table.main-table');
    function applyTableScale(v) {
      if (mainTableEl) mainTableEl.style.zoom = (v / 100).toFixed(2);
      if (tsVal) tsVal.textContent = v + '%';
      try { localStorage.setItem('grs_tscale', String(v)); } catch (e) {}
    }
    if (tsInput) {
      var savedScale = parseInt(localStorage.getItem('grs_tscale'), 10);
      if (isFinite(savedScale)) tsInput.value = Math.max(60, Math.min(160, savedScale));
      tsInput.addEventListener('input', function () { applyTableScale(parseInt(tsInput.value, 10) || 100); });
      applyTableScale(parseInt(tsInput.value, 10) || 100);
    }

    // 点击本地仓库路径：调本地服务在系统文件管理器中打开文件夹（不离开面板页）
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a.local-open') : null;
      if (!a) return;
      e.preventDefault();
      fetch(a.getAttribute('href'))
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }); })
        .then(function (j) {
          if (!j || !j.ok) setHint((j && j.error) || '打开文件夹失败', '');
        })
        .catch(function () { setHint('打开文件夹失败：本地服务未响应', ''); });
    });
  }

  boot();
})();
