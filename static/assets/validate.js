/* ============================================================
   validate.js —— 浏览器端的最后一道防线
   ------------------------------------------------------------
   真正的闸门是 tools/validate.py（提交前跑，不合格就不提交）。
   这里是兜底：万一坏数据还是上线了，页面也不能塌，至少要知道
   "哪里不对"，而不是让人对着一张空白页猜。

   用法：render.js 在 fetch 完 latest.json 之后调用
     const v = window.MVValidate.check(data);
     if (!v.ok) 显示一条横幅，然后照常渲染（渲染层自己会兜住）

   和 validate.py 的规则是"同一套的一个子集"：
     只查会让版面塌掉或让内容读不出来的，不查长度和措辞。
   ============================================================ */
(function (root) {
  'use strict';

  var DIRS = { up: 1, down: 1, flat: 1 };
  var TYPES = { code: 1, pill: 1, source: 1, html: 1 };
  var LEVELS = { breach: 1, near: 1, ok: 1 };
  var TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  var ALLOWED = { b: 1, br: 1 };

  function textIssues(s, path, out) {
    if (typeof s !== 'string') return;
    var m, bad = {};
    TAG.lastIndex = 0;
    while ((m = TAG.exec(s))) {
      var t = m[1].toLowerCase();
      if (!ALLOWED[t]) bad[t] = 1;
    }
    var names = Object.keys(bad);
    if (names.length) out.errors.push({ path: path, msg: '不支持的标签 <' + names.join('>, <') + '>' });
    if ((s.match(/<b>/g) || []).length !== (s.match(/<\/b>/g) || []).length) {
      out.errors.push({ path: path, msg: '<b> 不配对' });
    }
  }

  function checkCell(c, path, out) {
    if (c == null) return;
    if (typeof c === 'string') { textIssues(c, path, out); return; }
    if (typeof c !== 'object') return;
    if (c.dir != null && !DIRS[String(c.dir)]) out.errors.push({ path: path + '.dir', msg: 'dir=' + c.dir });
    if (c.type != null && !TYPES[String(c.type)]) out.errors.push({ path: path + '.type', msg: 'type=' + c.type });
    if (c.level != null && !LEVELS[String(c.level)]) out.errors.push({ path: path + '.level', msg: 'level=' + c.level });
    if (typeof c.text === 'string') textIssues(c.text, path + '.text', out);
  }

  function check(data) {
    var out = { ok: true, errors: [], warnings: [] };

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      out.errors.push({ path: '$', msg: '顶层不是对象' });
      out.ok = false;
      return out;
    }
    var h = data.header;
    if (!h || typeof h !== 'object') out.errors.push({ path: '$.header', msg: '缺少 header' });
    else {
      textIssues(h.title, '$.header.title', out);
      textIssues(h.summary, '$.header.summary', out);
      (h.tags || []).forEach(function (t, i) { textIssues(t, '$.header.tags[' + i + ']', out); });
    }

    var secs = data.sections;
    if (!Array.isArray(secs) || !secs.length) {
      out.errors.push({ path: '$.sections', msg: '没有段落' });
    } else {
      var seen = {};
      secs.forEach(function (s, i) {
        var p = '$.sections[' + i + ']';
        if (!s || typeof s !== 'object') { out.errors.push({ path: p, msg: '段落不是对象' }); return; }
        if (s.id) {
          if (seen[s.id] != null) out.errors.push({ path: p + '.id', msg: 'id 与 [' + seen[s.id] + '] 重复' });
          seen[s.id] = i;
        }
        textIssues(s.title, p + '.title', out);
        textIssues(s.note, p + '.note', out);
        textIssues(s.source, p + '.source', out);
        (s.kpis || []).forEach(function (k, j) {
          var kp = p + '.kpis[' + j + ']';
          textIssues(k && k.label, kp + '.label', out);
          textIssues(k && k.value, kp + '.value', out);
          textIssues(k && k.chg, kp + '.chg', out);
          if (k && k.dir != null && !DIRS[String(k.dir)]) out.errors.push({ path: kp + '.dir', msg: 'dir=' + k.dir });
        });
        (s.rows || []).forEach(function (row, j) {
          if (!Array.isArray(row)) { out.errors.push({ path: p + '.rows[' + j + ']', msg: '行不是数组' }); return; }
          row.forEach(function (c, ci) { checkCell(c, p + '.rows[' + j + '][' + ci + ']', out); });
        });
      });
    }

    out.ok = out.errors.length === 0;
    return out;
  }

  var api = { check: check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MVValidate = api;
})(typeof window !== 'undefined' ? window : this);
