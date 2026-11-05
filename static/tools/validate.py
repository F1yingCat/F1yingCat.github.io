#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MarketViewer 数据校验器 —— 每日定时任务在提交前跑这个。

设计目标：模型可以笨，但坏数据不能上线。

  python3 tools/validate.py static/data/premarket/latest.json
      校验，列出所有问题（带 JSON 路径），有问题就 exit 1

  python3 tools/validate.py static/data/premarket/latest.json --fix
      校验并就地修复能确定性修复的问题，打印改了什么

  python3 tools/validate.py --all
      校验 static/data/*/latest.json，任何一个不合格就 exit 1

  python3 tools/validate.py 新.json --old 旧.json
      额外做一次"和昨天比"的结构对比：段落少了、行数掉了一半、正文变空，
      这些往往是模型抄漏了，光看 schema 是查不出来的

只依赖标准库，单文件，可以直接 curl 下来跑。
退出码：0 = 通过；1 = 有错误；2 = 修好了但还有警告；3 = 用法错误
"""

import argparse
import glob
import json
import os
import re
import sys

# ---------------------------------------------------------------- 规则表

TOP_KEYS = {"title", "header", "sections", "footer"}

DIR_OK = {"up", "down", "flat"}
DIR_ALIAS = {
    "up": "up", "涨": "up", "上涨": "up", "红": "up", "↑": "up", "▲": "up", "+": "up",
    "down": "down", "跌": "down", "下跌": "down", "绿": "down", "↓": "down", "▼": "down", "-": "down",
    "flat": "flat", "平": "flat", "持平": "flat", "0": "flat",
}

CELL_TYPES = {"code", "pill", "source", "html"}
PILL_LEVELS = {"breach", "near", "ok"}

# 长度上限（来自 data/README.md）。默认只报警告：
# 现在的真实数据本来就超了几条，硬拦会把今天的更新挡在门外。
# 长度上限。按 2026-11 的真实数据量的 1.3 倍左右定的:
# 目的不是"精简",是"抓住跑飞"(模型某天写了 2 万字)。
LIMITS = {
    "header.title": 60,
    "header.summary": 1200,
    "sections[].title": 100,
    "kpis[].label": 40,
    "kpis[].chg": 1400,
    "sections[].note": 3000,
}

B_TAG = re.compile(r"</?b>")
ANY_TAG = re.compile(r"</?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>")
BAD_NUM = re.compile(r"^(nan|inf|-inf|undefined|null)$", re.I)
ALLOWED_TAGS = {"b", "br"}   # 渲染端只放行这两个（见 render.js 的 escKeepBold）


class Report:
    def __init__(self):
        self.errors = []    # (path, msg)
        self.warnings = []  # (path, msg)
        self.fixes = []     # (path, msg)

    def err(self, path, msg):
        self.errors.append((path, msg))

    def warn(self, path, msg):
        self.warnings.append((path, msg))

    def fixed(self, path, msg):
        self.fixes.append((path, msg))

    @property
    def ok(self):
        return not self.errors


# ---------------------------------------------------------------- 工具函数

def walk_strings(node, path=""):
    """遍历所有字符串值，产出 (path, parent, key, value)"""
    if isinstance(node, dict):
        for k, v in node.items():
            p = f"{path}.{k}" if path else k
            if isinstance(v, str):
                yield p, node, k, v
            else:
                yield from walk_strings(v, p)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            p = f"{path}[{i}]"
            if isinstance(v, str):
                yield p, node, i, v
            else:
                yield from walk_strings(v, p)


def strip_bad_tags(s):
    """去掉不支持的标签（保留标签里的文字）；<b>/<br> 原样留着"""
    def repl(m):
        return m.group(0) if m.group(1).lower() in ALLOWED_TAGS else ""
    return ANY_TAG.sub(repl, s)


def balance_b(s):
    """只保留配对上的 <b>；落单的开/闭标签丢掉。和 render.js 的 escKeepBold 同规则"""
    budget = s.count("</b>")
    out = []
    depth = 0
    pos = 0
    for m in B_TAG.finditer(s):
        out.append(s[pos:m.start()])
        tag = m.group(0)
        if tag == "<b>":
            if budget > 0:
                budget -= 1
                depth += 1
                out.append("<b>")
            # else: 丢掉落单的开标签
        else:
            if depth > 0:
                depth -= 1
                out.append("</b>")
            # else: 丢掉落单的闭标签
        pos = m.end()
    out.append(s[pos:])
    return "".join(out)


def text_len(s):
    """按"字"算长度：去掉标签，CJK 每字算 1，其他字符算 1"""
    return len(ANY_TAG.sub("", s))


# ---------------------------------------------------------------- 校验

def check_html(s, path, rep, fix):
    """只允许 <b>/</b>；其他标签、不配对的 <b> 都是问题"""
    tags = [m.group(1).lower() for m in ANY_TAG.finditer(s)]
    bad = [t for t in tags if t not in ALLOWED_TAGS]
    if bad:
        uniq = ", ".join(sorted(set(bad)))
        if fix:
            s2 = strip_bad_tags(s)
            rep.fixed(path, f"去掉不支持的标签 <{uniq}>")
            s = s2
        else:
            rep.err(path, f"含不支持的 HTML 标签 <{uniq}>（只允许 <b> / <br>，或用 **…**）")
    if s.count("<b>") != s.count("</b>"):
        if fix:
            s2 = balance_b(s)
            rep.fixed(path, f"<b> 不配对（{s.count('<b>')} 开 / {s.count('</b>')} 闭），已丢弃落单标签")
            s = s2
        else:
            rep.err(path, f"<b> 不配对（{s.count('<b>')} 开 / {s.count('</b>')} 闭）—— 会让后面的卡片被吞进这张卡里")
    return s


def check_cell(cell, path, rep, fix):
    if cell is None:
        return None
    if isinstance(cell, (str, int, float)):
        if isinstance(cell, str):
            s = check_html(cell, path, rep, fix)
            if BAD_NUM.match(s.strip()):
                rep.err(path, f"值是 {s!r}，像占位符/未求值")
                if fix:
                    return ""
            return s
        return cell
    if not isinstance(cell, dict):
        rep.err(path, f"单元格只能是字符串/数字/对象，实际是 {type(cell).__name__}")
        return cell
    if "dir" in cell and cell["dir"] is not None:
        d = str(cell["dir"]).strip()
        if d not in DIR_OK:
            mapped = DIR_ALIAS.get(d, DIR_ALIAS.get(d.lower()))
            if fix and mapped:
                cell["dir"] = mapped
                rep.fixed(f"{path}.dir", f"{d!r} → {mapped!r}")
            else:
                rep.err(f"{path}.dir", f"dir={d!r}，只能是 up/down/flat")
    if "type" in cell and cell["type"] is not None:
        t = str(cell["type"]).strip()
        if t not in CELL_TYPES:
            if fix:
                cell.pop("type", None)
                rep.fixed(f"{path}.type", f"未知类型 {t!r}，已删除（按普通文本渲染）")
            else:
                rep.err(f"{path}.type", f"type={t!r}，只能是 {sorted(CELL_TYPES)}")
    if "level" in cell and cell["level"] is not None:
        lv = str(cell["level"]).strip()
        if lv not in PILL_LEVELS:
            if fix:
                cell["level"] = "near"
                rep.fixed(f"{path}.level", f"{lv!r} → 'near'")
            else:
                rep.err(f"{path}.level", f"level={lv!r}，只能是 {sorted(PILL_LEVELS)}")
    if "text" in cell and isinstance(cell["text"], str):
        cell["text"] = check_html(cell["text"], f"{path}.text", rep, fix)
    return cell


def check_limit(path, s, limit, rep):
    if s is None or limit is None:
        return
    n = text_len(str(s))
    if n > limit:
        rep.warn(path, f"{n} 字，超过约定的 {limit} 字（渲染不会坏，但版面会变长）")


def validate(data, rep, fix=False):
    if not isinstance(data, dict):
        rep.err("$", "顶层必须是对象 {}")
        return data

    for k in data:
        if k not in TOP_KEYS:
            rep.warn(f"$.{k}", f"未知的顶层字段 {k!r}（会被忽略）")

    header = data.get("header")
    if not isinstance(header, dict):
        rep.err("$.header", "缺少 header 对象")
        header = data["header"] = {} if fix else header
    if not isinstance(header, dict):
        return data

    title = header.get("title", "")
    if not isinstance(title, str) or not title.strip():
        rep.err("$.header.title", "标题为空")
    else:
        header["title"] = check_html(title, "$.header.title", rep, fix)
        check_limit("$.header.title", header["title"], LIMITS["header.title"], rep)

    if "summary" in header and isinstance(header["summary"], str):
        header["summary"] = check_html(header["summary"], "$.header.summary", rep, fix)
        check_limit("$.header.summary", header["summary"], LIMITS["header.summary"], rep)

    tags = header.get("tags")
    if tags is not None:
        if not isinstance(tags, list):
            rep.err("$.header.tags", "tags 必须是数组")
        else:
            if len(tags) > 8:
                rep.warn("$.header.tags", f"{len(tags)} 条，页面只显示前 8 条（多出来的会被丢掉）")
            elif len(tags) < 3:
                rep.warn("$.header.tags", f"{len(tags)} 条，眉题会显得很空（建议 5–7 条）")
            for i, t in enumerate(tags):
                p = f"$.header.tags[{i}]"
                if not isinstance(t, str):
                    rep.err(p, "标签必须是字符串")
                    continue
                tags[i] = check_html(t, p, rep, fix)

    sections = data.get("sections")
    if not isinstance(sections, list):
        rep.err("$.sections", "缺少 sections 数组")
        return data
    if not sections:
        rep.err("$.sections", "sections 为空 —— 页面会整页空白")

    seen_ids = {}
    for i, s in enumerate(sections):
        p = f"$.sections[{i}]"
        if not isinstance(s, dict):
            rep.err(p, f"段落必须是对象，实际是 {type(s).__name__}")
            continue
        sid = s.get("id")
        if sid:
            if sid in seen_ids:
                rep.err(f"{p}.id", f"id={sid!r} 和 $.sections[{seen_ids[sid]}] 重复")
            seen_ids[sid] = i
        if not sid and not str(s.get("title") or "").strip():
            rep.err(p, "段落既没有 id 也没有 title")

        if "title" in s:
            s["title"] = check_html(str(s["title"] or ""), f"{p}.title", rep, fix)
            check_limit(f"{p}.title", s["title"], LIMITS["sections[].title"], rep)
        for key in ("source", "note", "legend"):
            if isinstance(s.get(key), str):
                s[key] = check_html(s[key], f"{p}.{key}", rep, fix)
        if isinstance(s.get("source"), str):
            check_limit(f"{p}.source", s["source"], None, rep)
        if isinstance(s.get("note"), str):
            check_limit(f"{p}.note", s["note"], LIMITS["sections[].note"], rep)

        # --- kpis
        kpis = s.get("kpis")
        if kpis is not None:
            if not isinstance(kpis, list):
                rep.err(f"{p}.kpis", "kpis 必须是数组")
            else:
                if s.get("type") == "kpi" and not kpis:
                    rep.err(f"{p}.kpis", "type=kpi 但 kpis 为空 —— 会渲染成一条空横幅")
                for j, k in enumerate(kpis):
                    kp = f"{p}.kpis[{j}]"
                    if not isinstance(k, dict):
                        rep.err(kp, "KPI 必须是对象")
                        continue
                    for f in ("label", "value", "chg"):
                        if f in k and isinstance(k[f], str):
                            k[f] = check_html(k[f], f"{kp}.{f}", rep, fix)
                    check_limit(f"{kp}.label", k.get("label"), LIMITS["kpis[].label"], rep)
                    check_limit(f"{kp}.chg", k.get("chg"), LIMITS["kpis[].chg"], rep)
                    if "dir" in k and k["dir"] is not None:
                        d = str(k["dir"]).strip()
                        if d not in DIR_OK:
                            mapped = DIR_ALIAS.get(d, DIR_ALIAS.get(d.lower()))
                            if fix and mapped:
                                k["dir"] = mapped
                                rep.fixed(f"{kp}.dir", f"{d!r} → {mapped!r}")
                            else:
                                rep.err(f"{kp}.dir", f"dir={d!r}，只能是 up/down/flat")
                    for f in ("value", "label"):
                        v = k.get(f)
                        if isinstance(v, str) and BAD_NUM.match(v.strip()):
                            rep.err(f"{kp}.{f}", f"{f}={v!r}，像占位符/未求值")
                            if fix:
                                k[f] = ""
                                rep.fixed(f"{kp}.{f}", f"清掉占位符 {v!r}（留空，页面上是空白而不是 NaN）")
                    if "value" not in k or k.get("value") in ("", None):
                        rep.warn(kp, "value 为空（会渲染成空白数字位）")

        # --- columns / rows
        cols, rows = s.get("columns"), s.get("rows")
        if cols is not None and not isinstance(cols, list):
            rep.err(f"{p}.columns", "columns 必须是数组")
        if rows is not None and not isinstance(rows, list):
            rep.err(f"{p}.rows", "rows 必须是数组")
        if isinstance(cols, list) and isinstance(rows, list):
            if not rows:
                rep.warn(f"{p}.rows", "0 行 —— 页面会显示「暂无数据」")
            for j, row in enumerate(rows):
                rp = f"{p}.rows[{j}]"
                if not isinstance(row, list):
                    rep.err(rp, "每一行必须是数组")
                    continue
                if len(row) != len(cols):
                    rep.warn(rp, f"{len(row)} 列，表头是 {len(cols)} 列 —— 错位会串列")
                for c_i, cell in enumerate(row):
                    rows[j][c_i] = check_cell(cell, f"{rp}[{c_i}]", rep, fix)

    return data


# ---------------------------------------------------------------- 和昨天比

def diff_old(new, old, rep):
    """结构对比：模型最容易犯的错不是写错字，是抄漏。"""
    if not isinstance(old, dict) or not isinstance(new, dict):
        return
    old_secs = {s.get("id"): s for s in (old.get("sections") or []) if isinstance(s, dict) and s.get("id")}
    new_secs = {s.get("id"): s for s in (new.get("sections") or []) if isinstance(s, dict) and s.get("id")}
    for sid, s in old_secs.items():
        if sid not in new_secs:
            rep.warn(f"$.sections[{sid}]", "昨天有这一段，今天没有了")
            continue
        o_rows = s.get("rows") or []
        n_rows = new_secs[sid].get("rows") or []
        if len(o_rows) >= 3 and len(n_rows) * 2 < len(o_rows):
            rep.warn(f"$.sections[{sid}].rows", f"行数从 {len(o_rows)} 掉到 {len(n_rows)}")
    o_tags = (old.get("header") or {}).get("tags") or []
    n_tags = (new.get("header") or {}).get("tags") or []
    if o_tags and len(n_tags) < 3:
        rep.warn("$.header.tags", f"标签从 {len(o_tags)} 条掉到 {len(n_tags)} 条")


# ---------------------------------------------------------------- CLI

def load_json(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    try:
        return json.loads(raw), None
    except json.JSONDecodeError as e:
        return None, (e.lineno, e.colno, e.msg, raw.splitlines())


def show_syntax_error(path, info):
    lineno, colno, msg, lines = info
    print(f"\n✗ {path}  JSON 语法错误：第 {lineno} 行第 {colno} 列 —— {msg}")
    if 1 <= lineno <= len(lines):
        line = lines[lineno - 1]
        print(f"    {lineno:>4} | {line[:160]}")
        print(f"         {' ' * max(0, colno - 1)}^")


def run_one(path, fix, strict, old_path, quiet=False):
    data, err = load_json(path)
    if err:
        show_syntax_error(path, err)
        return 1, Report()

    fixed_rep = Report()
    if fix:
        # 第一遍:能修的修掉,记下改了什么
        data = validate(data, fixed_rep, fix=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.write("\n")

    # 第二遍:按修完之后的状态给结论(退出码要反映最终结果,不是修复前的)
    rep = Report()
    data = validate(data, rep, fix=False)
    if old_path:
        old, oerr = load_json(old_path)
        if oerr:
            print(f"  ! 旧文件 {old_path} 读不了，跳过对比")
        else:
            diff_old(data, old, rep)

    if strict:
        rep.errors.extend(rep.warnings)
        rep.warnings = []

    if not quiet:
        rel = os.path.relpath(path)
        for p, m in rep.errors:
            print(f"  ✗ {rel}  {p}\n      {m}")
        for p, m in rep.warnings:
            print(f"  ! {rel}  {p}\n      {m}")
        for p, m in fixed_rep.fixes:
            print(f"  ✎ {rel}  {p}\n      已自动修复：{m}")
        if not (rep.errors or rep.warnings or fixed_rep.fixes):
            print(f"  ✓ {rel}")

    if rep.errors:
        return 1, rep
    if fixed_rep.fixes and not strict:
        return 2, rep
    return 0, rep


def main():
    ap = argparse.ArgumentParser(description="MarketViewer JSON 校验器")
    ap.add_argument("files", nargs="*", help="要校验的 JSON 文件")
    ap.add_argument("--fix", action="store_true", help="就地修复能确定性修复的问题")
    ap.add_argument("--strict", action="store_true", help="把警告也当错误（用于发版前）")
    ap.add_argument("--old", help="和上一版对比结构（抄漏检测）")
    ap.add_argument("--all", action="store_true", help="校验 static/data/*/latest.json")
    ap.add_argument("--quiet", action="store_true", help="只输出有问题的")
    args = ap.parse_args()

    targets = list(args.files)
    if args.all:
        targets += sorted(glob.glob("static/data/*/latest.json"))
    if not targets:
        ap.print_help()
        return 3

    worst = 0
    for t in targets:
        if not os.path.exists(t):
            print(f"  ✗ {t}  文件不存在")
            worst = max(worst, 1)
            continue
        code, rep = run_one(t, args.fix, args.strict, args.old, args.quiet)
        worst = max(worst, code)

    if worst == 0:
        print("\n全部通过。")
    elif worst == 2:
        print("\n已修复，可以提交（建议看一眼 diff）。")
    else:
        print("\n有错误，不要提交。修完再跑一次。")
    return worst


if __name__ == "__main__":
    sys.exit(main())
