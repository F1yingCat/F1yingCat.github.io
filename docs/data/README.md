# MarketViewer Data Schema

## 文件结构

每个页面有独立 JSON:
- `premarket/latest.json` — 盘前速览
- `postmarket/latest.json` — 盘后总结
- `intraday/latest.json` — 盘中观察(可选)

## 字段长度限制(防止页面撑坏)

| 字段 | 限制 | 原因 |
|---|---|---|
| `header.title` | ≤ 30 字 | header 大标题 |
| `header.summary` | ≤ 500 字 | 移动端 header 高度 |
| `header.tags` | 5-7 个,每个 ≤ 30 字 | tag-row flex-wrap 排数 |
| `sections[].title` | ≤ 50 字 | section 标题 |
| `sections[].note` | ≤ 200 字 | 详情/解读 popover 内 |
| `sections[].kpis[].chg` | ≤ 80 字 | KPI chg 文字 3 行内 |
| `sections[].kpis[].label` | ≤ 30 字 | KPI 标签 |
| `sections[].tags` | 3-5 个,每个 ≤ 30 字 | section tag-row |

## Render 端防御

即使数据超长,render.js 会自动处理:
- **tags 数量** > 8:只取前 8
- **tag 文字** > 80 字符:截断 + `…` 省略(完整文字仍在 popover 弹窗)
- **summary 文字** > 500 字:截到最近句号边界 + `…` 省略
- **KPI chg 文字**:line-clamp 3 行(超出截断)
- **note 文字**:popover 动态 maxHeight = trigger 上下可用空间

## Tag 风格参考(以 premarket 6 tag 为例)

```js
// premarket 6 tag 风格
tags: [
  'Pre-market 盘前速览',                          // meta
  '2026-09-09 美股收盘',                          // meta
  '2026-09-09 亚太 + 欧股 + 期货 收盘',           // meta
  '2026-09-10 亚太开盘(韩股 KOSPI 低开 7,038.85)',  // 关键事实 1 行
  '聚源数据库',                                  // 数据源
  '🕐 最后更新 2026-09-10 09:10'                  // 更新时间
]
```

**原则**:
- 2-3 个 meta 标签(页面类型 + 日期 + 状态)
- 1-2 个核心事实 tag(单行,最关键的市场数据)
- 1 个数据源 tag
- 1 个更新时间 tag

详细数据 → 在下方 `sections[].kpis` / `sections[].charts` / `sections[].rows` 展示,header 只标摘要 + 时间。

## JSON 示例

```json
{
  "title": "盘后总结 · 2026-09-10",
  "header": {
    "tags": [
      "Post-market 盘后总结",
      "2026-09-10 A 股收盘",
      "8 大指数 0 涨 8 跌(指数汇总 1 行)",
      "沪深京成交 1.66 万亿(-11.25%, 关键状态)",
      "聚源数据库 + cffex 期货直抓",
      "🕐 最后更新 2026-09-10 21:30 北京时间"
    ],
    "title": "沪深 8 大指数 / 成交 / ETF / 期货 / 明日关注",
    "summary": "9 月 10 日 A 股 8 大指数 0 涨 8 跌(沪指 -0.43% ...)。<b>沪深京成交 1.66 万亿</b>(较 9/9 -11.25%,年内第二地量) ...(< 500 字)"
  },
  "sections": [...]
}
```
