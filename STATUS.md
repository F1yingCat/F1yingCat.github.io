# Status: 盘前速览部署

## 当前状态：等 GitHub Actions 恢复

- **时间**: 2026-08-26 23:25 北京时间 (15:25 UTC)
- **GitHub 故障**: Actions critical outage + Pages degraded performance（15:11 UTC 开始）
- **影响**: 4 个 workflow run 卡在 queue 里，包括 `pages-deploy.yml` 的两次触发
- **premarket.html 状态**: 404，等 Pages 恢复后会重新部署

## 已完成的修复（在 GitHub 恢复后会生效）

1. **Gmeek.yml 修复**（commit d05b60d）
   - 加了 "恢复 Mavis 推送的 premarket.html" 步骤，从 git HEAD 把 docs/premarket.html 恢复
   - 这样 Gmeek 在 runAll 模式下重写 docs/ 时不会清掉 Mavis 的内容

2. **删除 Gmeek 的 deploy job**（commit 91251e8）
   - 之前 build_type=workflow 时 Gmeek 有 `actions/deploy-pages@v4` 步骤
   - 改为 legacy 模式后这个步骤会和 legacy 模式冲突，导致直接 git push 触发 Pages build 失败
   - 删掉之后 Gmeek 只需 git push main，Pages 走 legacy 模式

3. **添加 pages-deploy.yml**（commit 69ed66a, 后续更新 f0cf824/c03d284）
   - Pages 改回 build_type=workflow
   - 新的 deploy workflow: checkout -> upload artifact -> deploy-pages@v4
   - 不带 concurrency group、不带 paths 过滤
   - 触发条件：push 到 main 或 workflow_dispatch

## 现状

- `docs/premarket.html` 在 main 分支上：✅ 存在（commit f17d28e "data: 8/25 美股 + 8/26 亚太 (Mavis 聚源)"）
- Pages 部署状态：❌ 等 GitHub Actions 恢复
- Mavis 部署提示词：/workspace/MAVIS_PROMPT.md

## GitHub 恢复后做的事

1. 等 queue 里的 4 个 run 完成（包括 pages-deploy.yml 的 push 和 dispatch 触发）
2. 验证 https://f1yingcat.github.io/premarket.html 返回 200
3. 测试 Mavis prompt 流程

## 关键教训

- Gmeek 的 runAll 模式会重写 docs/，**任何不在它认知里的文件都会被删掉**
- 用 `git checkout HEAD -- docs/premarket.html` 在 commit 步骤前恢复
- Pages 模式 legacy 和 workflow 不能混用：要么都用 legacy（不要 deploy job），要么都用 workflow（有 deploy job）
- 当前选 build_type=workflow + 专用 deploy workflow：可控、可调试
