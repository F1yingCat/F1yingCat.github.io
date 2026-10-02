/* ============================================================
   F1yingCat - 文章页
   ------------------------------------------------------------
   文章页是【纵向】的，这是它和首页/归档页最大的分歧点。
   归档页横着走，因为"翻旧文章"这个动作本身就是往回翻；
   读一篇文章不是——眼睛要的是一条竖着的线，横着走会读不下去。
   所以这里保留的只有外壳：同一套色板、同一个像素字体、同一条
   底部进度条、同一个 HUD。身体是竖的。

   每篇文章配一幅程序化像素插画，画在 <canvas data-art="..."> 上。
   三篇各一幅：起点、盘前的钟、撞墙的猫。都是硬边色块，没有渐变。
   ============================================================ */
(function () {
  'use strict';

  /* 文章清单来自 assets/posts.js —— 由 out/genposts.ps1 从 blogBase.json 生成。
     之前这里是手写副本，和首页 index.html / 归档页 tag.html 各存一份，
     改文章元数据要记得三处都改；现在三处共用同一份数据。

     唯一差别在 href：posts.js 里是【站点根相对】的 post/xxx.html，
     而这个脚本跑在 /post/xxx.html 里，原样用会解析成 /post/post/xxx.html。
     所以每条都把开头的 post/ 剥掉。 */
  var POSTS = (window.POSTS || []).map(function (p) {
    return {
      cn: p.cn, lab: p.lab, date: p.date, words: p.words,
      href: String(p.href || '').replace(/^post\//, '')
    };
  });
  var ICONS = { bug: '#2a1a10', documentation: '#1a2f47' };

  function el(id) { return document.getElementById(id); }
  function q(sel) { return document.querySelector(sel); }

  /* ================= 插画 =================
     逻辑分辨率固定，CSS 宽度变了就按整数倍放大 ——
     整数倍是硬约束：放大 1.5 倍时每个源像素会落成 1.5 个设备像素，
     canvas 会插值出一条缝，整幅画就不再是像素画了。 */
  var ART_W = 320, ART_H = 200;

  function fitCanvas(cv) {
    var cssW = cv.parentNode.clientWidth || ART_W;
    var s = Math.max(1, Math.floor(cssW / ART_W));
    var w = ART_W * s, h = ART_H * s;
    cv.width = w; cv.height = h;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.setTransform(s, 0, 0, s, 0, 0);
    return g;
  }

  /* 夜空底 + 一条地平线。三幅共用，改一处三幅一起变 */
  function backdrop(g, top, ground) {
    g.fillStyle = '#14121c'; g.fillRect(0, 0, ART_W, ART_H);
    g.fillStyle = '#191527'; g.fillRect(0, ground, ART_W, ART_H - ground);
    g.fillStyle = '#100d1a'; g.fillRect(0, ground, ART_W, 2);
    /* 星：位置由下标哈希定，不用 Math.random，否则每次刷新位置都在跳 */
    for (var i = 0; i < 26; i++) {
      var h = (i * 2654435761) >>> 0;
      var x = (h >>> 4) % ART_W, y = 8 + ((h >>> 13) % (ground - 24));
      g.fillStyle = i % 3 === 0 ? '#8a8f99' : '#3b3350';
      g.fillRect(x, y, 1, 1);
    }
    void top;
  }

  var ART = {
    /* 起点：一个亮点往外炸开，辐射线长短交替。
       这是"一切的开始"，所以中心是画面上最亮的一个点 */
    origin: function (g) {
      backdrop(g, 0, 168);
      var cx = ART_W / 2, cy = 84;
      for (var i = 0; i < 24; i++) {
        var a = i * 15 * Math.PI / 180;
        var len = 26 + (i % 3) * 22;
        g.fillStyle = i % 2 ? '#a06f2e' : '#6b4a20';
        for (var r = 8; r < len; r++) {
          g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
        }
      }
      g.fillStyle = '#ffb03b'; g.fillRect(cx - 3, cy - 3, 6, 6);
      g.fillStyle = '#fffaf0'; g.fillRect(cx - 2, cy - 2, 4, 4);
      g.fillStyle = '#ffe0a0'; g.fillRect(cx - 5, cy - 1, 1, 1); g.fillRect(cx + 5, cy - 1, 1, 1);
      /* 地上的一道地平线，中心被照亮 —— 起点是"从地面升起来"的 */
      g.fillStyle = '#4a453c'; g.fillRect(0, 168, ART_W, 3);
      g.fillStyle = '#ffb03b'; g.fillRect(cx - 9, 168, 18, 1);
    },

    /* 盘前的钟：一个 08:45 的像素挂钟，下面一条向上的折线。
       盘前速览是每天 08:45 更新的，这个时刻就是这篇文章的全部内容 */
    premarket: function (g) {
      backdrop(g, 0, 168);
      var cx = 96, cy = 84, r = 42;
      g.fillStyle = '#241f31';
      for (var i = 0; i < r * 2; i++) { /* 先铺一圈方块当钟面 */
        for (var j = 0; j < r * 2; j++) {
          var dx = i - r, dy = j - r;
          if (dx * dx + dy * dy <= r * r) { g.fillRect(cx - r + i, cy - r + j, 1, 1); }
        }
      }
      g.fillStyle = '#0f0c1a';
      for (var k = 0; k < r * 2 - 6; k++) {
        for (var m = 0; m < r * 2 - 6; m++) {
          var ex = k - (r - 3), ey = m - (r - 3);
          if (ex * ex + ey * ey <= (r - 3) * (r - 3)) { g.fillRect(cx - r + 3 + k, cy - r + 3 + m, 1, 1); }
        }
      }
      /* 12 / 3 / 6 / 9 四个刻度 */
      g.fillStyle = '#ffb03b';
      g.fillRect(cx, cy - r + 6, 1, 5); g.fillRect(cx, cy + r - 11, 1, 5);
      g.fillRect(cx - r + 6, cy, 5, 1); g.fillRect(cx + r - 11, cy, 5, 1);
      /* 指针指向 08:45 —— 08 点是 8/12 圈，45 分是 3/4 圈 */
      g.fillStyle = '#fffaf0';
      for (var h2 = 0; h2 < 20; h2++) {
        g.fillRect(Math.round(cx + Math.cos((8 / 12) * 2 * Math.PI) * h2),
                  Math.round(cy + Math.sin((8 / 12) * 2 * Math.PI) * h2), 1, 1);
      }
      g.fillStyle = '#ef7c2a';
      for (var h3 = 0; h3 < 28; h3++) {
        g.fillRect(Math.round(cx + Math.cos((45 / 60) * 2 * Math.PI) * h3),
                  Math.round(cy + Math.sin((45 / 60) * 2 * Math.PI) * h3), 1, 1);
      }
      g.fillStyle = '#ffb03b'; g.fillRect(cx - 2, cy - 2, 4, 4);
      /* 右边一条向上的折线：盘前看的是"今晚往哪走"。
         折线必须走【阶梯】——横一段、竖一格、再横一段。原版按
         dx*s/n 直接插值，画出来是一道 45 度斜线，而斜线在这个站里
         读成"划痕"（首页的引线为这件事专门改成直角）。 */
      var pts = [[0, 66], [22, 52], [44, 58], [66, 40], [88, 30], [110, 34]];
      for (var p = 0; p < pts.length; p++) {
        g.fillStyle = p === pts.length - 1 ? '#ffb03b' : '#ef7c2a';
        g.fillRect(180 + pts[p][0], pts[p][1], 3, 3);
        if (p < pts.length - 1) {
          var xa = 180 + pts[p][0], ya = pts[p][1];
          var xb = 180 + pts[p + 1][0], yb2 = pts[p + 1][1];
          /* 先横后竖，走成一个台阶 */
          g.fillStyle = '#6b4a20';
          for (var hx2 = xa + 3; hx2 < xb; hx2++) g.fillRect(hx2, ya, 1, 1);
          var stepY = yb2 > ya ? 1 : -1;
          for (var vy = ya; vy !== yb2; vy += stepY) g.fillRect(xb - 3, vy, 1, 1);
        }
      }
      /* 竖轴：原来 #2e2a20（亮度 39）压在夜空上读成一道裂缝。
         提到和一档刻度同色，并给它加上刻度短线，才读得出"这是一根坐标轴" */
      g.fillStyle = '#2a2438';
      g.fillRect(178, 64, 1, 104);
      g.fillStyle = '#3b3350';
      for (var tk = 0; tk < 5; tk++) g.fillRect(175, 68 + tk * 24, 7, 1);
    },

    /* 撞墙的猫：用首页那只真猫，撞在墙上，墙上几个洞。
       文章只有 12 个字 "So many bugs"，画不出更复杂的东西了 */
    bug: function (g) {
      backdrop(g, 0, 168);
      /* 墙 */
      g.fillStyle = '#2b3038'; g.fillRect(196, 44, 120, 124);
      g.fillStyle = '#3a4048'; g.fillRect(196, 44, 120, 2);
      g.fillStyle = '#1e2228';
      for (var y = 50; y < 168; y += 14) g.fillRect(196, y, 120, 1);
      for (var y2 = 44; y2 < 168; y2 += 14) {
        for (var x = 200; x < 316; x += 20) {
          g.fillRect(x + ((y2 / 14) % 2 ? 10 : 0), y2, 1, 14);
        }
      }
      /* 墙上的洞：一个 bug 就是墙破了个洞 */
      var holes = [[224, 72, 14], [258, 100, 11], [238, 128, 9], [288, 66, 8]];
      for (var q2 = 0; q2 < holes.length; q2++) {
        var hx = holes[q2][0], hy = holes[q2][1], hr = holes[q2][2];
        g.fillStyle = '#0a0810';
        for (var yy = -hr; yy <= hr; yy++) {
          for (var xx = -hr; xx <= hr; xx++) {
            if (xx * xx + yy * yy <= hr * hr) g.fillRect(hx + xx, hy + yy, 1, 1);
          }
        }
        g.fillStyle = '#4a453c';
        g.fillRect(hx - hr - 1, hy - 1, 2, 1);
        g.fillRect(hx + hr, hy - 1, 1, 2);
      }
      /* 地面 */
      g.fillStyle = '#3a3f42'; g.fillRect(0, 168, ART_W, 6);
      g.fillStyle = '#4c5257'; g.fillRect(0, 168, ART_W, 1);
      g.fillStyle = '#343a3c'; g.fillRect(0, 170, ART_W, 4);
      g.fillStyle = '#262b30'; g.fillRect(0, 174, ART_W, 1);
      /* 猫：站在墙前，尾巴炸着。复用首页那只，不重画 */
      if (window.PIX) {
        /* feetY-92 而不是 feetY-44：首页那边是 drawSprite(g,nm,x,feetY-44,2)，
           精灵 24 行 × mul 2 = 48 像素高，底边落在 feetY+4，正好压地平线。
           这里照抄了 -44，猫就浮在地面上方 40 像素 —— 画面上读成
           "一只悬在空中的猫"，第一眼根本不会觉得它站在地上 */
        window.PIX.drawSprite(g, 'cat24', 150, 168 - 92, 2);
        /* 撞出来的星星：三点。x 要落在猫右缘（174）到墙左缘（196）之间，
           画到 172 就有一半压在猫身上，白画 */
        g.fillStyle = '#ffb03b';
        g.fillRect(180, 112, 2, 2); g.fillRect(190, 104, 2, 2); g.fillRect(178, 96, 2, 2);
        g.fillStyle = '#fffaf0';
        g.fillRect(181, 113, 1, 1); g.fillRect(191, 105, 1, 1);
      }
    }
  };

  function drawArt(cv) {
    var which = cv.getAttribute('data-art');
    var fn = ART[which];
    if (!fn) return;
    fn(fitCanvas(cv));
  }

  /* ================= 页面装配 ================= */
  function boot() {
    var raw = document.body.getAttribute('data-post');
    if (!raw) return;
    var p;
    try { p = JSON.parse(raw); } catch (e) { return; }

    /* kicker：标签 + 日期 + 字数。标签色和归档页的 .lab 同一套 */
    var k = el('kicker');
    if (k) {
      k.innerHTML = '<span class="lab' + (p.lab === 'bug' ? ' bug' : '') + '">' +
                    p.lab.toUpperCase() + '</span>' +
                    '<span class="dt">' + p.date + '</span>' +
                    '<span class="dt">' + p.words + ' 词</span>';
    }
    var h = el('postTitle');
    if (h && p.title) h.textContent = p.title;

    /* 上下篇。没了就不显示那一半，别留一个点不动的箭头 */
    var pager = el('pager');
    if (pager) {
      var i = POSTS.findIndex(function (x) { return x.href === p.href; });
      var prev = i > 0 ? POSTS[i - 1] : null;
      var next = i >= 0 && i < POSTS.length - 1 ? POSTS[i + 1] : null;
      var html = '';
      if (prev) html += '<a class="pg prev" href="' + prev.href + '">' +
                         '<span class="dir">← 上一篇</span><span class="t">' + prev.cn + '</span></a>';
      if (next) html += '<a class="pg next" href="' + next.href + '">' +
                         '<span class="dir">下一篇 →</span><span class="t">' + next.cn + '</span></a>';
      pager.innerHTML = html;
      if (!html) pager.style.display = 'none';
    }

    var cvs = document.querySelectorAll('canvas[data-art]');
    for (var i2 = 0; i2 < cvs.length; i2++) drawArt(cvs[i2]);
    /* 视口变了要重画：插画是按整数倍放大的，宽度一变倍数就得跟着变 */
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        for (var i3 = 0; i3 < cvs.length; i3++) drawArt(cvs[i3]);
      }, 140);
    });
    void ICONS;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
