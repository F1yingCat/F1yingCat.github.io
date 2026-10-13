# Status: 站点部署

> 本文件原是 2026-08-26 那次 GitHub 故障的现场记录。那次故障早已结束，
> 盘前速览页也已在 2026-10-02 主动删除。下面只保留**仍然成立**的结论，
> 过期的"待办"不再留着误导后来人。

## 当前状态（2026-10-02）

- **盘前速览不再是独立页面**。`docs/premarket.html` 已删除，盘前 / 盘中 / 盘后
  三个时段统一由 `MarketViewer.html` 承载，靠 `#premarket` / `#intraday` /
  `#postmarket` 落到对应那一栏，各自从 `data/<id>/latest.json` 取数。
  被删的那张页是写死在 2026-08-28 的静态快照，图表数据全部硬编码，
  echarts 还从 CDN 拉，早已和实时数据脱节。
- **源码在 `static/`，`docs/` 是构建产物**。两者按文件名一一对应
  （`docs/postList.json` 由 Gmeek 生成，`static/fonts/` 有意不同步，
  理由见 `market-viewer-sync.yml` 的注释）。
- **盘中观察仍是占位**。`data/intraday/latest.json` 只有 3 段 `待接入`，
  tab 能切、页面能渲染，但没接真实盘中数据。

## 部署链

```
Gmeek.yml                 每天 16:00 UTC / issue / 手动
  └─ 重新生成 docs/（读 backup/*.md + blogBase.json），自带 build + deploy

market-viewer-sync.yml    static/** 变化时，或 Gmeek 跑完后
  └─ 把 static/ 全量搬回 docs/ 并提交        ← 保护网在这一步

pages-deploy.yml          sync 完成后，或手动
  └─ 部署 docs/ 到 GitHub Pages
```

## 关键教训（仍然成立）

1. **Gmeek 的 runAll 模式会重写整个 `docs/`**，任何不在它认知里的文件都会被删掉，
   紧接着的 `git add .` / `git commit` 会把这次删除提交进去，看起来像"改好了"。
   **所以手工维护的内容一律放 `static/`**，由 `market-viewer-sync.yml` 在 Gmeek
   之后还原。直接手写进 `docs/` 的文件不会有人替它兜底 —— 当年 `premarket.html`
   就是因为直接写在 `docs/` 里，才需要在 `Gmeek.yml` 里单开一步
   `git checkout HEAD -- docs/premarket.html` 把它捡回来；
   该页随本次删除后，那一步已于 2026-10-02 一并移除（它保护的文件已不存在，
   留着只会误导）。目前 `docs/` 里已没有任何"没有 `static/` 对应物"的文件。
2. **Pages 模式 legacy 和 workflow 不能混用**：要么都用 legacy（不要 deploy job），
   要么都用 workflow（有 deploy job）。当前三条 workflow 各自带 deploy job，
   `pages-deploy.yml` 与 `Gmeek.yml` 的 deploy 共用 concurrency group `pages`
   排队（不 cancel），避免互相抢。
3. **`pages-deploy.yml` 必须 `checkout main`**，不能用
   `github.event.workflow_run.head_sha` —— 那个值是**触发 sync 的那个 commit**
   （通常是 Mavis 推数据那次），不是 sync 自己 push 上去的新 commit，
   照抄会让部署永远落后一拍。

## 已作废（2026-08-26 故障记录，仅存档）

- 当时 `premarket.html` 返回 404、等 Pages 恢复后重新部署 —— 故障已结束，
  且该页面已按上文的理由主动删除
- 当时为恢复该页而加的 `Gmeek.yml` 保护步骤 —— 已随该页删除而删除
- 当时"待办"里的"验证 https://f1yingcat.github.io/premarket.html 返回 200"
  —— 已无此页面，不应再作为待办
