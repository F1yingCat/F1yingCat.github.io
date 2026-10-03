/* ============================================================
   Post list -- GENERATED FILE, DO NOT EDIT BY HAND
   ------------------------------------------------------------
   Built by out/genposts.ps1 from blogBase.json -> postListJson.
   Regenerate:
     powershell -NoProfile -ExecutionPolicy Bypass -File out/genposts.ps1

   Change blogBase.json (Gmeek writes it) to change content. Editing this
   file by hand gets overwritten on the next Gmeek run.

   Home page, archive page and post pages all read this one array. They used
   to be three hand-written copies, so adding a post meant editing three
   places and missing one showed up as "listed on the home page, gone from
   the archive".

   href is relative to the SITE ROOT (post/xxx.html). post.js runs from
   /post/ and strips the leading post/ before using it.

   Fields: cn title / desc summary / lab label / date / words / href
   Order: createdDate ascending (old -> new), matching the archive layout.
   Posts at generation time: 3
   ============================================================ */
window.POSTS = [
    { cn:'Origin of everything', desc:'This is how everything start.。', lab:'documentation', date:'2025-11-13', words:29, href:'post/Origin%20of%20everything.html' },
    { cn:'好多bug啊。。', desc:'So many bugs。', lab:'bug', date:'2026-08-27', words:12, href:'post/hao-duo-bug-a-%E3%80%82%E3%80%82.html' },
    { cn:'MarketViewer 市场速览', desc:'每日于 北京时间09:03 和 北京时间19:30 分别更新盘前速览和盘后总结。', lab:'documentation', date:'2026-10-02', words:85, href:'post/MarketViewer%20-shi-chang-su-lan.html' }
];