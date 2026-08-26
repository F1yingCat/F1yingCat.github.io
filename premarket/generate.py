#!/usr/bin/env python3
"""
Pre-market 盘前速览 - 自动生成脚本
每日抓取美股/亚太/外汇/原油/金属/韩股数据，生成静态 HTML。

数据源:
  - yfinance: 美股指数、汇市、原油、贵金属、KOSPI、韩股
  - US Treasury Daily Yield Curve: 美债 2Y/10Y/30Y

Usage:
  python3 generate.py            # 生成 docs/premarket.html
  python3 generate.py --out path # 输出到指定文件
"""
import argparse
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("缺少 yfinance，请先 pip install yfinance", file=sys.stderr)
    raise

try:
    import requests
except ImportError:
    print("缺少 requests，请先 pip install requests", file=sys.stderr)
    raise

# ============== 工具函数 ==============

def safe_pct(new, old):
    if old is None or old == 0 or new is None:
        return None
    return (new - old) / old * 100

def fmt_price(v, digits=2):
    if v is None:
        return "—"
    return f"{v:,.{digits}f}"

def fmt_pct(v, signed=True):
    if v is None:
        return "—"
    return f"{v:+.2f}%" if signed else f"{v:.2f}%"

def class_updown(v):
    if v is None or v == 0:
        return "flat"
    return "up" if v > 0 else "down"

# ============== 数据抓取 ==============

def fetch_yahoo(ticker, period="10d"):
    """抓 yfinance 数据，返回 (last_close, prev_close, last_date)"""
    try:
        df = yf.download(ticker, period=period, progress=False, timeout=20)
        if df is None or df.empty or len(df) < 2:
            return None, None, None
        # 去掉时区
        idx = df.index
        if idx.tz is not None:
            idx = idx.tz_convert(None)
        df.index = idx
        last = df["Close"].iloc[-1]
        prev = df["Close"].iloc[-2]
        return float(last), float(prev), idx[-1].strftime("%Y-%m-%d")
    except Exception as e:
        print(f"  [WARN] {ticker}: {e}", file=sys.stderr)
        return None, None, None

def fetch_us_treasury_yields():
    """抓美国财政部每日国债收益率曲线"""
    url = (
        "https://home.treasury.gov/resource-center/data-chart-center/"
        "interest-rates/daily-treasury-rates.csv/2026/all"
        "?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv"
    )
    try:
        r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        lines = r.text.splitlines()
        if not lines:
            return None, None, None, None, None, None
        header = lines[0].split(",")
        col_map = {}
        for i, h in enumerate(header):
            h = h.strip()
            if h in ("2 Yr", "10 Yr", "30 Yr"):
                col_map[h] = i
        if not all(k in col_map for k in ("2 Yr", "10 Yr", "30 Yr")):
            print("  [WARN] Treasury CSV header 异常", file=sys.stderr)
            return None, None, None, None, None, None
        rows = []
        for line in lines[1:]:
            parts = line.split(",")
            if len(parts) <= max(col_map.values()):
                continue
            try:
                d = parts[0]
                y2 = float(parts[col_map["2 Yr"]])
                y10 = float(parts[col_map["10 Yr"]])
                y30 = float(parts[col_map["30 Yr"]])
                rows.append((d, y2, y10, y30))
            except (ValueError, IndexError):
                continue
        if len(rows) < 2:
            return None, None, None, None, None, None
        today = rows[-1]
        prev = rows[-2]
        return (
            today[1], prev[1],
            today[2], prev[2],
            today[3], prev[3],
            today[0],
        )
    except Exception as e:
        print(f"  [WARN] Treasury: {e}", file=sys.stderr)
        return None, None, None, None, None, None, None

# ============== 抓所有数据 ==============

def fetch_all():
    print("开始抓取市场数据...")
    data = {
        "us_index": {},
        "hk_futures": {},
        "a50": None,
        "treasury": {},
        "fx": {},
        "oil": {},
        "metals": {},
        "kr": {},
        "fetch_time": datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M"),
    }

    # 1) 美股指数
    us_map = {
        "dji":  ("^DJI",   "道琼斯",     "us.DJI"),
        "spx":  ("^GSPC",  "标普500",    "us.INX"),
        "ixic": ("^IXIC",  "纳斯达克",   "us.IXIC"),
        "sox":  ("^SOX",   "费城半导体", "$SOX"),
    }
    for k, (t, name, code) in us_map.items():
        c, p, d = fetch_yahoo(t)
        data["us_index"][k] = {
            "name": name, "code": code, "close": c, "prev": p, "date": d,
            "chg": (c - p) if c is not None and p is not None else None,
            "pct": safe_pct(c, p),
        }
        time.sleep(1)

    # 2) 港股/A50
    hsi, hsi_p, hsi_d = fetch_yahoo("^HSI"); time.sleep(1)
    hstech, hstech_p, hstech_d = fetch_yahoo("^HSTECH"); time.sleep(1)
    a50, a50_p, a50_d = fetch_yahoo("^XIN9")
    if a50 is None:
        time.sleep(1)
        a50, a50_p, a50_d = fetch_yahoo("CN=F")
    time.sleep(1)
    data["hk_futures"] = {
        "hsi":     {"name": "恒指期货", "close": hsi,     "prev": hsi_p,     "date": hsi_d,     "chg": (hsi-hsi_p)     if hsi and hsi_p else None,     "pct": safe_pct(hsi, hsi_p)},
        "hstech":  {"name": "恒科期货", "close": hstech,  "prev": hstech_p,  "date": hstech_d,  "chg": (hstech-hstech_p) if hstech and hstech_p else None, "pct": safe_pct(hstech, hstech_p)},
    }
    data["a50"] = {"name": "富时A50", "close": a50, "prev": a50_p, "date": a50_d, "chg": (a50-a50_p) if a50 and a50_p else None, "pct": safe_pct(a50, a50_p)}

    # 3) 美债
    t2, t2p, t10, t10p, t30, t30p, tdate = fetch_us_treasury_yields()
    data["treasury"] = {
        "y2":  {"yield": t2,  "prev": t2p,  "chg_bp": (t2-t2p)*100  if t2  is not None and t2p  is not None else None, "date": tdate},
        "y10": {"yield": t10, "prev": t10p, "chg_bp": (t10-t10p)*100 if t10 is not None and t10p is not None else None, "date": tdate},
        "y30": {"yield": t30, "prev": t30p, "chg_bp": (t30-t30p)*100 if t30 is not None and t30p is not None else None, "date": tdate},
    }

    # 4) 外汇
    fx_map = {
        "dxy": ("DX-Y.NYB", "美元指数 DXY", 100, 99.5, 100.5),
        "cnh": ("CNH=X",    "离岸人民币 CNH", 6.73, 6.65, 6.78),
        "jpy": ("JPY=X",    "美元兑日元",    None, 156, 162),
    }
    for k, (t, name, warn, ymin, ymax) in fx_map.items():
        c, p, d = fetch_yahoo(t)
        data["fx"][k] = {
            "name": name, "close": c, "prev": p, "date": d,
            "chg": (c - p) if c is not None and p is not None else None,
            "pct": safe_pct(c, p), "warn": warn, "ymin": ymin, "ymax": ymax,
        }
        time.sleep(1)

    # 5) 原油
    oil_map = {
        "wti":   ("CL=F", "WTI",     "10月"),
        "brent": ("BZ=F", "布伦特",   "10月"),
    }
    for k, (t, name, contract) in oil_map.items():
        c, p, d = fetch_yahoo(t)
        data["oil"][k] = {
            "name": name, "close": c, "prev": p, "date": d, "contract": contract,
            "chg": (c - p) if c is not None and p is not None else None,
            "pct": safe_pct(c, p),
        }
        time.sleep(1)

    # 6) 金属
    metal_map = {
        "gold":   ("GC=F", "COMEX黄金", "美元/oz"),
        "copper": ("HG=F", "COMEX铜",   "美元/lb"),
    }
    for k, (t, name, unit) in metal_map.items():
        c, p, d = fetch_yahoo(t)
        data["metals"][k] = {
            "name": name, "close": c, "prev": p, "date": d, "unit": unit,
            "chg": (c - p) if c is not None and p is not None else None,
            "pct": safe_pct(c, p),
        }
        time.sleep(1)

    # 7) 韩股
    kospi, kospi_p, kospi_d = fetch_yahoo("^KS11"); time.sleep(1)
    samsung, samsung_p, samsung_d = fetch_yahoo("005930.KS"); time.sleep(1)
    skhynix, skhynix_p, skhynix_d = fetch_yahoo("000660.KS")
    data["kr"] = {
        "kospi":   {"name": "KOSPI",   "code": "KS11",     "close": kospi,   "prev": kospi_p,   "date": kospi_d,   "chg": (kospi-kospi_p)   if kospi and kospi_p else None,   "pct": safe_pct(kospi, kospi_p)},
        "samsung": {"name": "三星电子", "code": "005930.KS", "close": samsung, "prev": samsung_p, "date": samsung_d, "chg": (samsung-samsung_p) if samsung and samsung_p else None, "pct": safe_pct(samsung, samsung_p)},
        "skhynix": {"name": "SK海力士", "code": "000660.KS", "close": skhynix, "prev": skhynix_p, "date": skhynix_d, "chg": (skhynix-skhynix_p) if skhynix and skhynix_p else None, "pct": safe_pct(skhynix, skhynix_p)},
    }

    return data

# ============== HTML 模板 ==============

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Pre-market 盘前速览 · {date_label}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>
  :root{{ --bg:#f4f6f9; --card:#ffffff; --ink:#1f2937; --sub:#6b7280;
         --up:#e23c3c; --down:#1a9e57; --line:#e5e7eb; --accent:#2f5fd0;
         --warn:#e8973c; --danger:#e23c3c; }}
  *{{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}}
  body{{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    line-height:1.55;}}
  .wrap{{max-width:480px;margin:0 auto;padding:14px 12px 44px;}}
  header.top{{background:linear-gradient(135deg,#2f5fd0,#3f7be0);color:#fff;border-radius:14px;padding:18px 16px;margin-bottom:16px;}}
  header.top h1{{margin:0 0 6px;font-size:18px;font-weight:700;line-height:1.35;}}
  header.top p{{margin:0;font-size:12px;opacity:.92;}}
  .tag{{display:inline-block;background:rgba(255,255,255,.18);border-radius:6px;padding:2px 9px;font-size:11px;margin:0 6px 6px 0;}}
  section{{background:var(--card);border-radius:12px;padding:15px 14px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.05);}}
  section h2{{margin:0 0 4px;font-size:15.5px;font-weight:700;display:flex;align-items:center;gap:7px;}}
  section h2 .bar{{width:4px;height:16px;background:var(--accent);border-radius:2px;display:inline-block;}}
  .src{{font-size:11px;color:var(--sub);margin:2px 0 12px;line-height:1.5;}}
  table{{width:100%;border-collapse:collapse;font-size:12.5px;}}
  th,td{{padding:8px 6px;text-align:right;border-bottom:1px solid var(--line);}}
  th:first-child,td:first-child{{text-align:left;}}
  thead th{{background:#f8fafc;color:var(--sub);font-weight:600;font-size:11px;}}
  tbody tr:hover{{background:#fafbfe;}}
  .up{{color:var(--up);font-weight:600;}}
  .down{{color:var(--down);font-weight:600;}}
  .flat{{color:var(--sub);font-weight:600;}}
  .code{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:var(--sub);}}
  .col-code{{display:none;}}
  .pill{{display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600;}}
  .pill.breach{{background:#fde8e8;color:var(--danger);}}
  .pill.near{{background:#fef3e2;color:var(--warn);}}
  .pill.ok{{background:#e8f6ee;color:var(--down);}}
  .chart{{width:100%;height:260px;}}
  .note{{font-size:11.5px;color:var(--sub);background:#f8fafc;border-left:3px solid var(--accent);padding:9px 12px;border-radius:0 8px 8px 0;margin-top:10px;line-height:1.5;}}
  .note b{{color:var(--ink);}}
  .kpi-row{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;}}
  .kpi{{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px;}}
  .kpi .lbl{{font-size:11px;color:var(--sub);line-height:1.3;}}
  .kpi .val{{font-size:18px;font-weight:700;margin-top:3px;}}
  .kpi .chg{{font-size:11.5px;margin-top:2px;}}
  footer{{font-size:11px;color:var(--sub);text-align:center;padding:12px;}}
  .legend{{font-size:11px;color:var(--sub);margin:-4px 0 8px;}}
</style>
</head>
<body>
<div class="wrap">

  <header class="top">
    <div>
      <span class="tag">Pre-market 盘前速览</span>
      <span class="tag">{date_label}</span>
      <span class="tag">手机版</span>
    </div>
    <h1>美股 / 富时A50 / 美债 / 外汇 / 原油 / 金属 / 韩股</h1>
    <p>数据生成于 {fetch_time} 北京时间。源: yfinance + US Treasury。盘前请以最新报价为准。</p>
  </header>

  <section>
    <h2><span class="bar"></span>一、盘前关键关注</h2>
    <div class="kpi-row">
      <div class="kpi"><div class="lbl">标普500</div><div class="val">{kpi_spx}</div><div class="chg {kpi_spx_cls}">{kpi_spx_chg}</div></div>
      <div class="kpi"><div class="lbl">10Y美债收益率</div><div class="val">{kpi_y10}</div><div class="chg {kpi_y10_cls}">{kpi_y10_chg}</div></div>
      <div class="kpi"><div class="lbl">30Y美债收益率</div><div class="val">{kpi_y30}</div><div class="chg {kpi_y30_cls}">{kpi_y30_chg}</div></div>
      <div class="kpi"><div class="lbl">美元指数 DXY</div><div class="val">{kpi_dxy}</div><div class="chg {kpi_dxy_cls}">{kpi_dxy_chg}</div></div>
      <div class="kpi"><div class="lbl">离岸人民币 CNH</div><div class="val">{kpi_cnh}</div><div class="chg {kpi_cnh_cls}">{kpi_cnh_chg}</div></div>
      <div class="kpi"><div class="lbl">COMEX黄金</div><div class="val">{kpi_gold}</div><div class="chg {kpi_gold_cls}">{kpi_gold_chg}</div></div>
    </div>
  </section>

  <section>
    <h2><span class="bar"></span>二、美股指数及期货</h2>
    <div class="src">来源: yfinance / Yahoo Finance · 美股上一交易日收盘 · 亚太指数/期货为最近盘中</div>
    <table>
      <thead><tr><th>标的</th><th class="col-code">代码</th><th>收盘价</th><th>涨跌</th><th>涨跌幅</th></tr></thead>
      <tbody>
        <tr><td>道琼斯</td><td class="code col-code">us.DJI</td><td>{us_dji_close}</td><td class="{us_dji_cls}">{us_dji_chg}</td><td class="{us_dji_cls}">{us_dji_pct}</td></tr>
        <tr><td>标普500</td><td class="code col-code">us.INX</td><td>{us_spx_close}</td><td class="{us_spx_cls}">{us_spx_chg}</td><td class="{us_spx_cls}">{us_spx_pct}</td></tr>
        <tr><td>纳斯达克</td><td class="code col-code">us.IXIC</td><td>{us_ixic_close}</td><td class="{us_ixic_cls}">{us_ixic_chg}</td><td class="{us_ixic_cls}">{us_ixic_pct}</td></tr>
        <tr><td>费城半导体SOX</td><td class="code col-code">$SOX</td><td>{us_sox_close}</td><td class="{us_sox_cls}">{us_sox_chg}</td><td class="{us_sox_cls}">{us_sox_pct}</td></tr>
        <tr><td>恒指期货</td><td class="code col-code">HSImain</td><td>{hsi_close}</td><td class="{hsi_cls}">{hsi_chg}</td><td class="{hsi_cls}">{hsi_pct}</td></tr>
        <tr><td>恒科期货</td><td class="code col-code">HTImain</td><td>{hstech_close}</td><td class="{hstech_cls}">{hstech_chg}</td><td class="{hstech_cls}">{hstech_pct}</td></tr>
        <tr><td>富时A50</td><td class="code col-code">CN</td><td>{a50_close}</td><td class="{a50_cls}">{a50_chg}</td><td class="{a50_cls}">{a50_pct}</td></tr>
      </tbody>
    </table>
    <div id="chartEquity" class="chart"></div>
    <div class="legend">▲ 红涨 / ▼ 绿跌（A股惯例）· 数据可能因周末/节假日缺最新一天</div>
  </section>

  <section>
    <h2><span class="bar"></span>三、美债收益率及预警</h2>
    <div class="src">来源: US Treasury Daily Treasury Yield Curve Rates · 2Y/10Y/30Y 到期收益率 · 日变动单位 bp</div>
    <table>
      <thead><tr><th>期限</th><th>收益率</th><th>日变动</th><th>预警线</th><th>状态</th></tr></thead>
      <tbody>
        <tr><td>2年</td><td>{y2_close}</td><td class="{y2_cls}">{y2_chg}</td><td>—</td><td><span class="pill ok">正常</span></td></tr>
        <tr><td>10年</td><td>{y10_close}</td><td class="{y10_cls}">{y10_chg}</td><td>4.7%</td><td><span class="pill {y10_pill}">{y10_status}</span></td></tr>
        <tr><td>30年</td><td>{y30_close}</td><td class="{y30_cls}">{y30_chg}</td><td>5.3%</td><td><span class="pill {y30_pill}">{y30_status}</span></td></tr>
      </tbody>
    </table>
    <div id="chartYield" class="chart"></div>
    <div class="note"><b>预警逻辑：</b>10Y 收益率 ≥ 4.7% 视为已突破；30Y ≥ 5.3% 视为已突破。本表显示最新一日收盘状态，<b>{yield_note}</b>。</div>
  </section>

  <section>
    <h2><span class="bar"></span>四、美元指数与人民币</h2>
    <div class="src">来源: yfinance (DX-Y.NYB / CNH=X / JPY=X) · 24h 滚动行情 · 美元/日元为间接报价</div>
    <table>
      <thead><tr><th>标的</th><th>最新价</th><th>涨跌</th><th>涨跌幅</th><th>预警线</th><th>状态</th></tr></thead>
      <tbody>
        <tr><td>美元指数 DXY</td><td>{dxy_close}</td><td class="{dxy_cls}">{dxy_chg}</td><td class="{dxy_cls}">{dxy_pct}</td><td>100</td><td><span class="pill {dxy_pill}">{dxy_status}</span></td></tr>
        <tr><td>离岸人民币 CNH</td><td>{cnh_close}</td><td class="{cnh_cls}">{cnh_chg}</td><td class="{cnh_cls}">{cnh_pct}</td><td>6.73</td><td><span class="pill {cnh_pill}">{cnh_status}</span></td></tr>
        <tr><td>美元兑日元</td><td>{jpy_close}</td><td class="{jpy_cls}">{jpy_chg}</td><td class="{jpy_cls}">{jpy_pct}</td><td>—</td><td><span class="pill ok">正常</span></td></tr>
      </tbody>
    </table>
    <div id="chartFxDxy" class="chart"></div>
    <div id="chartFxCnh" class="chart"></div>
    <div class="note">DXY &lt; 100 视为美元偏弱、&gt; 100 偏强；CNH &gt; 6.73 视为人民币贬值压力加大。USD/JPY 在 158-160 区间运行。</div>
  </section>

  <section>
    <h2><span class="bar"></span>五、原油价格</h2>
    <div class="src">来源: yfinance (CL=F WTI 主力 / BZ=F Brent 主力) · 下一交易月合约 · 美元/桶</div>
    <table>
      <thead><tr><th>标的</th><th>美元/桶</th><th>涨跌幅</th><th>合约</th></tr></thead>
      <tbody>
        <tr><td>WTI</td><td>{wti_close}</td><td class="{wti_cls}">{wti_pct}</td><td>10月</td></tr>
        <tr><td>布伦特</td><td>{brent_close}</td><td class="{brent_cls}">{brent_pct}</td><td>10月</td></tr>
      </tbody>
    </table>
    <div class="note"><b>口径说明：</b>yfinance 抓取主力合约报价，盘中可能与官方结算价存在差异；以 NYMEX / ICE 官方为准。</div>
  </section>

  <section>
    <h2><span class="bar"></span>六、COMEX 黄金与铜</h2>
    <div class="src">来源: yfinance (GC=F / HG=F) · 活跃合约 · 单位见行内</div>
    <table>
      <thead><tr><th>标的</th><th>收盘价</th><th>涨跌</th><th>涨跌幅</th></tr></thead>
      <tbody>
        <tr><td>COMEX黄金</td><td>{gold_close}/oz</td><td class="{gold_cls}">{gold_chg}</td><td class="{gold_cls}">{gold_pct}</td></tr>
        <tr><td>COMEX铜</td><td>{copper_close}/lb</td><td class="{copper_cls}">{copper_chg}</td><td class="{copper_cls}">{copper_pct}</td></tr>
      </tbody>
    </table>
    <div class="note">黄金为长端利率与避险情绪的对冲；铜与全球制造业 PMI 同步性较高。</div>
  </section>

  <section>
    <h2><span class="bar"></span>七、韩国市场</h2>
    <div class="src">来源: yfinance (^KS11 / 005930.KS / 000660.KS) · KOSPI 综合 · 报价单位: 韩元</div>
    <table>
      <thead><tr><th>标的</th><th class="col-code">代码</th><th>收盘价</th><th>涨跌</th><th>涨跌幅</th></tr></thead>
      <tbody>
        <tr><td>KOSPI</td><td class="code col-code">KS11</td><td>{kospi_close}</td><td class="{kospi_cls}">{kospi_chg}</td><td class="{kospi_cls}">{kospi_pct}</td></tr>
        <tr><td>三星电子</td><td class="code col-code">005930.KS</td><td>{samsung_close}</td><td class="{samsung_cls}">{samsung_chg}</td><td class="{samsung_cls}">{samsung_pct}</td></tr>
        <tr><td>SK海力士</td><td class="code col-code">000660.KS</td><td>{skhynix_close}</td><td class="{skhynix_cls}">{skhynix_chg}</td><td class="{skhynix_cls}">{skhynix_pct}</td></tr>
      </tbody>
    </table>
    <div id="chartKorea" class="chart"></div>
    <div class="note">三星电子、SK海力士为 HBM/存储芯片龙头，与英伟达 GPU 周期高度相关。</div>
  </section>

  <footer>
    本页由 GitHub Action 自动生成 · 数据源: yfinance + US Treasury · 不构成投资建议<br>
    最后更新: {fetch_time} (北京时间)
  </footer>

</div>

<script>
  echarts.init(document.getElementById('chartEquity')).setOption({{
    tooltip:{{trigger:'axis', axisPointer:{{type:'shadow'}}, formatter:'{{b}}: {{c}}%'}},
    grid:{{left:84, right:24, top:14, bottom:20}},
    xAxis:{{type:'value', axisLabel:{{formatter:'{{value}}%'}}}},
    yAxis:{{type:'category', data:['道琼斯','标普500','纳斯达克','费城半导体','恒指期货','恒科期货','富时A50']}},
    series:[{{type:'bar', data:[
      {{value:{eq_dji}, itemStyle:{{color:'{eq_dji_c}'}}}},
      {{value:{eq_spx}, itemStyle:{{color:'{eq_spx_c}'}}}},
      {{value:{eq_ixic}, itemStyle:{{color:'{eq_ixic_c}'}}}},
      {{value:{eq_sox}, itemStyle:{{color:'{eq_sox_c}'}}}},
      {{value:{eq_hsi}, itemStyle:{{color:'{eq_hsi_c}'}}}},
      {{value:{eq_hstech}, itemStyle:{{color:'{eq_hstech_c}'}}}},
      {{value:{eq_a50}, itemStyle:{{color:'{eq_a50_c}'}}}}
    ]}}]
  }});

  echarts.init(document.getElementById('chartYield')).setOption({{
    tooltip:{{trigger:'axis', axisPointer:{{type:'shadow'}}, formatter:'{{b}}: {{c}}%'}},
    grid:{{left:48, right:24, top:40, bottom:22}},
    xAxis:{{type:'category', data:['2年','10年','30年']}},
    yAxis:{{type:'value', axisLabel:{{formatter:'{{value}}%'}}, max:6}},
    series:[{{type:'bar', barWidth:'46%', data:[
      {{value:{y2_v}, itemStyle:{{color:'#5b8def'}}}},
      {{value:{y10_v}, itemStyle:{{color:'{y10_c}'}}}},
      {{value:{y30_v}, itemStyle:{{color:'{y30_c}'}}}}
    ], markLine:{{
      silent:true, symbol:'none', lineStyle:{{type:'dashed'}},
      data:[
        {{yAxis:4.7, lineStyle:{{color:'#e23c3c'}}, label:{{formatter:'10Y 4.7%', color:'#e23c3c', position:'insideEndTop', fontSize:10}}}},
        {{yAxis:5.3, lineStyle:{{color:'#e8973c'}}, label:{{formatter:'30Y 5.3%', color:'#e8973c', position:'insideEndTop', fontSize:10}}}}
      ]
    }}}}]}});

  echarts.init(document.getElementById('chartKorea')).setOption({{
    tooltip:{{trigger:'axis', axisPointer:{{type:'shadow'}}, formatter:'{{b}}: {{c}}%'}},
    grid:{{left:78, right:24, top:14, bottom:20}},
    xAxis:{{type:'value', axisLabel:{{formatter:'{{value}}%'}}}},
    yAxis:{{type:'category', data:['KOSPI','三星电子','SK海力士']}},
    series:[{{type:'bar', data:[
      {{value:{kr_kospi}, itemStyle:{{color:'{kr_kospi_c}'}}}},
      {{value:{kr_samsung}, itemStyle:{{color:'{kr_samsung_c}'}}}},
      {{value:{kr_skhynix}, itemStyle:{{color:'{kr_skhynix_c}'}}}}
    ]}}]
  }});

  echarts.init(document.getElementById('chartFxDxy')).setOption({{
    title:{{text:'美元指数 DXY（预警 100）', left:'center', textStyle:{{fontSize:12, color:'#1f2937'}}}},
    tooltip:{{trigger:'axis', formatter:'{{b}}: {{c}}'}},
    grid:{{left:40, right:16, top:38, bottom:20}},
    xAxis:{{type:'category', data:['DXY']}},
    yAxis:{{type:'value', min:{dxy_ymin}, max:{dxy_ymax}, axisLabel:{{formatter:'{{value}}'}}}},
    series:[{{type:'bar', barWidth:'40%', data:[{{value:{dxy_v}, itemStyle:{{color:'{dxy_c}'}}}}], markLine:{{
      silent:true, symbol:'none', lineStyle:{{type:'dashed', color:'#e23c3c'}},
      data:[{{yAxis:100, label:{{formatter:'预警 100', color:'#e23c3c', position:'end', fontSize:10}}}}]
    }}}}]
  }});

  echarts.init(document.getElementById('chartFxCnh')).setOption({{
    title:{{text:'离岸人民币 CNH（预警 6.73）', left:'center', textStyle:{{fontSize:12, color:'#1f2937'}}}},
    tooltip:{{trigger:'axis', formatter:'{{b}}: {{c}}'}},
    grid:{{left:44, right:16, top:38, bottom:20}},
    xAxis:{{type:'category', data:['CNH']}},
    yAxis:{{type:'value', min:{cnh_ymin}, max:{cnh_ymax}, axisLabel:{{formatter:'{{value}}'}}}},
    series:[{{type:'bar', barWidth:'40%', data:[{{value:{cnh_v}, itemStyle:{{color:'{cnh_c}'}}}}], markLine:{{
      silent:true, symbol:'none', lineStyle:{{type:'dashed', color:'#e23c3c'}},
      data:[{{yAxis:6.73, label:{{formatter:'预警 6.73', color:'#e23c3c', position:'end', fontSize:10}}}}]
    }}}}]
  }});
</script>
</body>
</html>
"""

def fmt_kpi(v, digits=2):
    if v is None: return "—"
    return f"{v:,.{digits}f}"

def fmt_chg(v, digits=2):
    if v is None: return "—"
    return f"{v:+,.{digits}f}"

def pill_for(yield_v, threshold, prev_yield_v):
    if yield_v is None: return "ok", "—"
    if yield_v >= threshold: return "breach", "已突破"
    if prev_yield_v is not None and prev_yield_v < threshold <= yield_v:
        return "near", "刚破"
    return "ok", "正常"

def color_for(v):
    if v is None or v == 0: return "#9ca3af"
    return "#e23c3c" if v > 0 else "#1a9e57"

def build_html(data):
    spx = data["us_index"]["spx"]
    y10 = data["treasury"]["y10"]
    y30 = data["treasury"]["y30"]
    dxy = data["fx"]["dxy"]
    cnh = data["fx"]["cnh"]
    gold = data["metals"]["gold"]

    y10_pill, y10_status = pill_for(y10["yield"], 4.7, y10["prev"])
    y30_pill, y30_status = pill_for(y30["yield"], 5.3, y30["prev"])

    if y10["yield"] is not None and y30["yield"] is not None:
        y10_above = y10["yield"] >= 4.7
        y30_above = y30["yield"] >= 5.3
        if y10_above and y30_above:
            yield_note = "10Y 与 30Y 均处于预警线上方，长端利率压力较大"
        elif y10_above and not y30_above:
            yield_note = "10Y 处于预警线上方，30Y 已回落至 5.3% 下方"
        elif not y10_above and y30_above:
            yield_note = "30Y 处于预警线上方，10Y 已回落至 4.7% 下方"
        else:
            yield_note = "10Y/30Y 均回落至预警线下方，长端压力缓解"
    else:
        yield_note = "数据缺失"

    date_label = data["fetch_time"][:10]

    def kpi_arrow(pct, dec=2):
        if pct is None: return "—"
        if pct > 0: return f"▲ +{pct:.{dec}f}%"
        if pct < 0: return f"▼ {pct:.{dec}f}%"
        return "— 0.00%"

    ctx = dict(
        date_label=date_label,
        fetch_time=data["fetch_time"],
        kpi_spx=fmt_kpi(spx["close"]),
        kpi_spx_cls=class_updown(spx["pct"]),
        kpi_spx_chg=kpi_arrow(spx["pct"]),
        kpi_y10=(fmt_kpi(y10["yield"]) + "%" if y10["yield"] is not None else "—"),
        kpi_y10_cls=class_updown(y10["chg_bp"]),
        kpi_y10_chg=("▲ 已破 4.7%" if y10["yield"] and y10["yield"]>=4.7 else ("▼ 回落至 4.7% 下方" if y10["yield"] is not None else "—")),
        kpi_y30=(fmt_kpi(y30["yield"]) + "%" if y30["yield"] is not None else "—"),
        kpi_y30_cls=class_updown(y30["chg_bp"]),
        kpi_y30_chg=("▲ 突破 5.3%" if y30["yield"] and y30["yield"]>=5.3 else ("▼ 回落至 5.3% 下方" if y30["yield"] is not None else "—")),
        kpi_dxy=fmt_kpi(dxy["close"], 2),
        kpi_dxy_cls=class_updown(dxy["pct"]),
        kpi_dxy_chg=kpi_arrow(dxy["pct"]),
        kpi_cnh=fmt_kpi(cnh["close"], 4),
        kpi_cnh_cls=class_updown(cnh["pct"]),
        kpi_cnh_chg=kpi_arrow(cnh["pct"]),
        kpi_gold=fmt_kpi(gold["close"]),
        kpi_gold_cls=class_updown(gold["pct"]),
        kpi_gold_chg=kpi_arrow(gold["pct"]),
        us_dji_close=fmt_kpi(data["us_index"]["dji"]["close"]),
        us_dji_chg=fmt_chg(data["us_index"]["dji"]["chg"]),
        us_dji_pct=fmt_pct(data["us_index"]["dji"]["pct"]),
        us_dji_cls=class_updown(data["us_index"]["dji"]["pct"]),
        us_spx_close=fmt_kpi(spx["close"]),
        us_spx_chg=fmt_chg(spx["chg"]),
        us_spx_pct=fmt_pct(spx["pct"]),
        us_spx_cls=class_updown(spx["pct"]),
        us_ixic_close=fmt_kpi(data["us_index"]["ixic"]["close"]),
        us_ixic_chg=fmt_chg(data["us_index"]["ixic"]["chg"]),
        us_ixic_pct=fmt_pct(data["us_index"]["ixic"]["pct"]),
        us_ixic_cls=class_updown(data["us_index"]["ixic"]["pct"]),
        us_sox_close=fmt_kpi(data["us_index"]["sox"]["close"]),
        us_sox_chg=fmt_chg(data["us_index"]["sox"]["chg"]),
        us_sox_pct=fmt_pct(data["us_index"]["sox"]["pct"]),
        us_sox_cls=class_updown(data["us_index"]["sox"]["pct"]),
        hsi_close=fmt_kpi(data["hk_futures"]["hsi"]["close"]),
        hsi_chg=fmt_chg(data["hk_futures"]["hsi"]["chg"]),
        hsi_pct=fmt_pct(data["hk_futures"]["hsi"]["pct"]),
        hsi_cls=class_updown(data["hk_futures"]["hsi"]["pct"]),
        hstech_close=fmt_kpi(data["hk_futures"]["hstech"]["close"]),
        hstech_chg=fmt_chg(data["hk_futures"]["hstech"]["chg"]),
        hstech_pct=fmt_pct(data["hk_futures"]["hstech"]["pct"]),
        hstech_cls=class_updown(data["hk_futures"]["hstech"]["pct"]),
        a50_close=fmt_kpi(data["a50"]["close"]),
        a50_chg=fmt_chg(data["a50"]["chg"]),
        a50_pct=fmt_pct(data["a50"]["pct"]),
        a50_cls=class_updown(data["a50"]["pct"]),
        y2_close=(fmt_kpi(data["treasury"]["y2"]["yield"]) + "%" if data["treasury"]["y2"]["yield"] is not None else "—"),
        y2_chg=(f"{data['treasury']['y2']['chg_bp']:+.1f}bp" if data["treasury"]["y2"]["chg_bp"] is not None else "—"),
        y2_cls=class_updown(data["treasury"]["y2"]["chg_bp"]),
        y10_close=(fmt_kpi(y10["yield"]) + "%" if y10["yield"] is not None else "—"),
        y10_chg=(f"{y10['chg_bp']:+.1f}bp" if y10["chg_bp"] is not None else "—"),
        y10_cls=class_updown(y10["chg_bp"]),
        y10_pill=y10_pill, y10_status=y10_status,
        y30_close=(fmt_kpi(y30["yield"]) + "%" if y30["yield"] is not None else "—"),
        y30_chg=(f"{y30['chg_bp']:+.1f}bp" if y30["chg_bp"] is not None else "—"),
        y30_cls=class_updown(y30["chg_bp"]),
        y30_pill=y30_pill, y30_status=y30_status,
        yield_note=yield_note,
        dxy_close=fmt_kpi(dxy["close"], 2),
        dxy_chg=fmt_chg(dxy["chg"], 2),
        dxy_pct=fmt_pct(dxy["pct"]),
        dxy_cls=class_updown(dxy["pct"]),
        dxy_pill=("breach" if dxy["close"] and dxy["close"]>=100 else "ok"),
        dxy_status=("已突破" if dxy["close"] and dxy["close"]>=100 else "未触发"),
        cnh_close=fmt_kpi(cnh["close"], 4),
        cnh_chg=fmt_chg(cnh["chg"], 4),
        cnh_pct=fmt_pct(cnh["pct"]),
        cnh_cls=class_updown(cnh["pct"]),
        cnh_pill=("breach" if cnh["close"] and cnh["close"]>=6.73 else "ok"),
        cnh_status=("已突破" if cnh["close"] and cnh["close"]>=6.73 else "未触发"),
        jpy_close=fmt_kpi(data["fx"]["jpy"]["close"], 2),
        jpy_chg=fmt_chg(data["fx"]["jpy"]["chg"], 2),
        jpy_pct=fmt_pct(data["fx"]["jpy"]["pct"]),
        jpy_cls=class_updown(data["fx"]["jpy"]["pct"]),
        wti_close=fmt_kpi(data["oil"]["wti"]["close"]),
        wti_pct=fmt_pct(data["oil"]["wti"]["pct"]),
        wti_cls=class_updown(data["oil"]["wti"]["pct"]),
        brent_close=fmt_kpi(data["oil"]["brent"]["close"]),
        brent_pct=fmt_pct(data["oil"]["brent"]["pct"]),
        brent_cls=class_updown(data["oil"]["brent"]["pct"]),
        gold_close=fmt_kpi(gold["close"]),
        gold_chg=fmt_chg(gold["chg"]),
        gold_pct=fmt_pct(gold["pct"]),
        gold_cls=class_updown(gold["pct"]),
        copper_close=fmt_kpi(data["metals"]["copper"]["close"], 3),
        copper_chg=fmt_chg(data["metals"]["copper"]["chg"], 3),
        copper_pct=fmt_pct(data["metals"]["copper"]["pct"]),
        copper_cls=class_updown(data["metals"]["copper"]["pct"]),
        kospi_close=fmt_kpi(data["kr"]["kospi"]["close"]),
        kospi_chg=fmt_chg(data["kr"]["kospi"]["chg"]),
        kospi_pct=fmt_pct(data["kr"]["kospi"]["pct"]),
        kospi_cls=class_updown(data["kr"]["kospi"]["pct"]),
        samsung_close=fmt_kpi(data["kr"]["samsung"]["close"], 0),
        samsung_chg=fmt_chg(data["kr"]["samsung"]["chg"], 0),
        samsung_pct=fmt_pct(data["kr"]["samsung"]["pct"]),
        samsung_cls=class_updown(data["kr"]["samsung"]["pct"]),
        skhynix_close=fmt_kpi(data["kr"]["skhynix"]["close"], 0),
        skhynix_chg=fmt_chg(data["kr"]["skhynix"]["chg"], 0),
        skhynix_pct=fmt_pct(data["kr"]["skhynix"]["pct"]),
        skhynix_cls=class_updown(data["kr"]["skhynix"]["pct"]),
        eq_dji=round(data["us_index"]["dji"]["pct"] or 0, 2),
        eq_spx=round(spx["pct"] or 0, 2),
        eq_ixic=round(data["us_index"]["ixic"]["pct"] or 0, 2),
        eq_sox=round(data["us_index"]["sox"]["pct"] or 0, 2),
        eq_hsi=round(data["hk_futures"]["hsi"]["pct"] or 0, 2),
        eq_hstech=round(data["hk_futures"]["hstech"]["pct"] or 0, 2),
        eq_a50=round(data["a50"]["pct"] or 0, 2),
        eq_dji_c=color_for(data["us_index"]["dji"]["pct"]),
        eq_spx_c=color_for(spx["pct"]),
        eq_ixic_c=color_for(data["us_index"]["ixic"]["pct"]),
        eq_sox_c=color_for(data["us_index"]["sox"]["pct"]),
        eq_hsi_c=color_for(data["hk_futures"]["hsi"]["pct"]),
        eq_hstech_c=color_for(data["hk_futures"]["hstech"]["pct"]),
        eq_a50_c=color_for(data["a50"]["pct"]),
        y2_v=data["treasury"]["y2"]["yield"] or 0,
        y10_v=y10["yield"] or 0,
        y30_v=y30["yield"] or 0,
        y10_c=("#e23c3c" if (y10["yield"] and y10["yield"]>=4.7) else "#1a9e57"),
        y30_c=("#e8973c" if (y30["yield"] and y30["yield"]>=5.3) else "#1a9e57"),
        kr_kospi=round(data["kr"]["kospi"]["pct"] or 0, 2),
        kr_samsung=round(data["kr"]["samsung"]["pct"] or 0, 2),
        kr_skhynix=round(data["kr"]["skhynix"]["pct"] or 0, 2),
        kr_kospi_c=color_for(data["kr"]["kospi"]["pct"]),
        kr_samsung_c=color_for(data["kr"]["samsung"]["pct"]),
        kr_skhynix_c=color_for(data["kr"]["skhynix"]["pct"]),
        dxy_v=dxy["close"] or 0,
        dxy_ymin=99.5, dxy_ymax=100.5,
        dxy_c=("#e23c3c" if (dxy["close"] and dxy["close"]>=100) else "#1a9e57"),
        cnh_v=cnh["close"] or 0,
        cnh_ymin=6.65, cnh_ymax=6.78,
        cnh_c=("#e23c3c" if (cnh["close"] and cnh["close"]>=6.73) else "#1a9e57"),
    )
    return HTML_TEMPLATE.format(**ctx)

# ============== 主流程 ==============

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="docs/premarket.html", help="output HTML path")
    args = parser.parse_args()

    data = fetch_all()
    html = build_html(data)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"OK -> {out} ({len(html)} bytes)")

    json_path = out.parent / "premarket-data.json"
    def _serialize(o):
        if hasattr(o, "isoformat"): return o.isoformat()
        return str(o)
    json_path.write_text(json.dumps(data, default=_serialize, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"JSON -> {json_path}")

if __name__ == "__main__":
    main()
