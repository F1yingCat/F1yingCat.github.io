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
    /* Narrower than the 320px logical width: even 1:1 does not fit, and
       Math.max(1, ...) would hand back a 320px canvas in a 280px column, which
       is a 40px horizontal scrollbar on a 320px phone. Keep the bitmap at 320
       (so the drawing is still the authored pixels) and shrink only the CSS
       box; image-rendering:pixelated keeps the edges hard instead of blurring
       them. This is the only place a non-integer scale can appear, and it needs
       a viewport under ~360px to happen at all. */
    if (cssW < ART_W) {
      cv.width = ART_W; cv.height = ART_H;
      cv.style.width = cssW + 'px';
      cv.style.height = Math.round(cssW * ART_H / ART_W) + 'px';
      var g0 = cv.getContext('2d');
      g0.imageSmoothingEnabled = false;
      return g0;
    }
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

  /* ================= 白天用的几件工具 =================
     夜里的那套（backdrop）不能直接拿来画白天：天空是硬三段色带，
     太阳是和归档页同一形制的三档同心色环（芯 / 中 / 边），
     云是几根横条叠出来的，海是横向的硬色带。
     全是硬边，没有一处渐变；折线走直角阶梯，斜线在这个站里读成"划痕"。 */

  /* 三段天空：顶 / 中 / 地平线上方一段 */
  function skyDay(g, ground, a, b, c) {
    g.fillStyle = a; g.fillRect(0, 0, ART_W, Math.round(ground * 0.42));
    g.fillStyle = b; g.fillRect(0, Math.round(ground * 0.42), ART_W, Math.round(ground * 0.30));
    g.fillStyle = c; g.fillRect(0, Math.round(ground * 0.72), ART_W, ground - Math.round(ground * 0.72));
  }

  /* 太阳：芯 #fff3c4 / 中 #f6cf5e / 边 #e3ac44，由外往内逐层铺。
     逐行算半宽、整行填充，所以轮廓是台阶而不是圆弧 */
  function sunDisc(g, cx, cy, r) {
    var bands = [['#e3ac44', 0], ['#f6cf5e', 0.42], ['#fff3c4', 0.70]];
    for (var bi = 0; bi < bands.length; bi++) {
      var rr = r * bands[bi][1];
      g.fillStyle = bands[bi][0];
      for (var dy = -r; dy <= r; dy++) {
        var half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
        if (rr <= 0) { g.fillRect(cx - half, cy + dy, half * 2, 1); continue; }
        /* 内圈：只填 [cx-half, cx-half+rr] 和对称的一侧，rr 也是整数宽 */
        var iw = Math.max(0, Math.round(half * bands[bi][1]));
        if (iw > 0) {
          g.fillRect(cx - half, cy + dy, iw, 1);
          g.fillRect(cx + half - iw, cy + dy, iw, 1);
        } else {
          g.fillRect(cx - half, cy + dy, half * 2, 1);
        }
      }
    }
  }

  /* 云：几根横条叠成，下面两段短一点，两头用格子收边而不是弧 */
  function cloud(g, x, y, w) {
    g.fillStyle = '#f2ece0';
    g.fillRect(x + 4, y, w - 8, 3);
    g.fillRect(x, y + 3, w, 3);
    g.fillRect(x + 4, y + 6, w - 8, 2);
    g.fillStyle = '#dcd3c4';
    g.fillRect(x, y + 6, w, 1);
  }

  /* 海：横向硬色带 + 几道断续的高光，全部水平，不打斜线 */
  function sea(g, y, h) {
    g.fillStyle = '#2f5f86'; g.fillRect(0, y, ART_W, h);
    g.fillStyle = '#3a76a4'; g.fillRect(0, y, ART_W, 3);
    g.fillStyle = '#25506f'; g.fillRect(0, y + h - 4, ART_W, 4);
    g.fillStyle = '#6fa8c9';
    for (var r = 0; r < 5; r++) {
      var ry = y + 8 + r * 6;
      var rx = 6 + ((r * 47) % 120);
      g.fillRect(rx, ry, 26, 1);
      g.fillRect(rx + 40, ry, 14, 1);
    }
  }

  /* 白天的草地：三段绿色，底下压一道深边 */
  function grassDay(g, y) {
    g.fillStyle = '#6faa5c'; g.fillRect(0, y, ART_W, 30);
    g.fillStyle = '#5c9649'; g.fillRect(0, y + 12, ART_W, 18);
    g.fillStyle = '#3f7a30'; g.fillRect(0, y + 24, ART_W, 6);
  }

  /* 把猫按到 feetY 这条地平线上。
     偏移是 -44 不是别的数：cat24 共 24 行，最后一行非空是第 22 行，
     drawSprite 把它画在 oy + 22*mul = oy + 44。所以 oy = feetY - 44 时
     猫脚正好压在地平线上。
     原来的 bug 那幅图用的是 -92，猫脚落在 120 而地平线在 168 —— 整整
     浮空 47 像素。注释里写的"这里照抄了 -44，猫就浮在地面上方"方向说反了，
     -44 才是对的，-92 才是浮空的那次改动。 */
  function catAt(g, x, feetY, sprite) {
    if (!window.PIX) return;
    window.PIX.drawSprite(g, sprite || 'cat24', x, feetY - 44, 2);
  }

  /* 地面一条。几幅共用，和 bug 里那段一致 */
  function ground(g, y) {
    g.fillStyle = '#3a3f42'; g.fillRect(0, y, ART_W, 6);
    g.fillStyle = '#4c5257'; g.fillRect(0, y, ART_W, 1);
    g.fillStyle = '#343a3c'; g.fillRect(0, y + 2, ART_W, 4);
    g.fillStyle = '#262b30'; g.fillRect(0, y + 6, ART_W, 1);
  }

  /* 砖墙：横竖缝交错，全部 1px 实线 */
  function bricks(g, x, y, w, h) {
    g.fillStyle = '#2b3038'; g.fillRect(x, y, w, h);
    g.fillStyle = '#3a4048'; g.fillRect(x, y, w, 2);
    g.fillStyle = '#1e2228';
    for (var r = 0; r < h; r += 14) g.fillRect(x, y + r, w, 1);
    for (var r2 = 0; r2 < h; r2 += 14) {
      for (var c = x + 4; c < x + w - 2; c += 20) {
        g.fillRect(c + ((r2 / 14) % 2 ? 10 : 0), y + r2, 1, 14);
      }
    }
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

    /* 一个 08:45 的像素挂钟，下面一条向上的阶梯折线。原本是给盘前速览那篇画的，
       那篇已经删了，但这个钟本身好看，就留下来当通用场景 */
    clock: function (g) {
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
        catAt(g, 150, 168);
        /* 撞出来的星星：三点。x 要落在猫右缘（174）到墙左缘（196）之间，
           画到 172 就有一半压在猫身上，白画。y 跟着猫的新位置走：
           猫现在占 124..168，星星落在上半身那一段。 */
        g.fillStyle = '#ffb03b';
        g.fillRect(180, 136, 2, 2); g.fillRect(190, 128, 2, 2); g.fillRect(178, 120, 2, 2);
        g.fillStyle = '#fffaf0';
        g.fillRect(181, 137, 1, 1); g.fillRect(191, 129, 1, 1);
      }
    },

    /* ================= 猫的日常 =================
       下面几幅不再绑死某篇文章，是一只猫在夜里做的各种事。
       给文章配图时按标题哈希挑一幅（见 pickArt），所以每篇固定一张、
       刷新不会换，而不同的文章会落到不同的画面上。
       共同规矩：硬边色块、没有渐变、折线一律走直角阶梯（斜线在这个站里
       读成"划痕"），猫永远用首页那只真精灵，不另画。 */

    /* 坐墙头：猫蹲在墙顶，尾巴垂下来，星星从墙那边升起来 */
    perch: function (g) {
      backdrop(g, 0, 168);
      bricks(g, 40, 112, 240, 56);
      catAt(g, 168, 112);
      /* 尾巴：从猫的右后侧垂到墙面，一格一格往下，不画斜线 */
      g.fillStyle = '#ef7c2a';
      g.fillRect(190, 106, 3, 10); g.fillRect(190, 116, 3, 10);
      g.fillRect(190, 126, 3, 8);  g.fillRect(190, 134, 2, 6);
      /* 三颗星，位置由下标定，和 backdrop 里的星同一个哈希习惯 */
      for (var s = 0; s < 3; s++) {
        var sx = 84 + s * 58, sy = 40 + (s % 2) * 22;
        g.fillStyle = '#fffaf0';
        g.fillRect(sx, sy, 3, 1); g.fillRect(sx + 1, sy - 1, 1, 3);
      }
      g.fillStyle = '#ffb03b';
      g.fillRect(83, 39, 1, 1); g.fillRect(88, 39, 1, 1);
      g.fillRect(141, 60, 1, 1); g.fillRect(146, 60, 1, 1);
    },

    /* 盯水盆：地上一个水洼，里面有条鱼，猫低头看 */
    puddle: function (g) {
      backdrop(g, 0, 168);
      ground(g, 168);
      /* 水洼：三层台阶拼的椭圆，边缘比水面暗一档 */
      g.fillStyle = '#22303a';
      g.fillRect(120, 158, 88, 4); g.fillRect(104, 162, 120, 4); g.fillRect(96, 166, 136, 4);
      g.fillStyle = '#2c4356';
      g.fillRect(124, 160, 80, 2); g.fillRect(108, 164, 112, 2);
      /* 涟漪：两段断续的横线 */
      g.fillStyle = '#4a6a80';
      g.fillRect(132, 162, 22, 1); g.fillRect(168, 165, 30, 1);
      /* 鱼：身子两格 + 尾巴一个台阶 */
      g.fillStyle = '#6b6288'; g.fillRect(168, 162, 10, 2);
      g.fillStyle = '#8a83a8'; g.fillRect(170, 162, 2, 1);
      g.fillRect(178, 161, 2, 1); g.fillRect(178, 165, 2, 1); g.fillRect(180, 160, 2, 1);
      /* 猫在左边低头看。精灵自带尾巴，不再另画尾巴笔画 ——
         另画的那几格在画面上离身体太远，读成一个孤立橙色方块 */
      catAt(g, 62, 168);
    },

    /* 纸箱：猫从箱子里探出半个身子，箱盖翻在两边。
       画法是"箱体 → 猫 → 再把箱体正面盖回去"，第二次画的那层就是遮挡，
       猫的下半身因此被箱子吃掉，读成"在箱子里"而不是"站在箱子后面"。
       猫脚取 134：精灵占 [feetY-44, feetY] = [90, 134]，箱口在 128，
       于是 128..134 那 6 像素被盖住，露出 90..128 的头和前胸。 */
    boxcat: function (g) {
      backdrop(g, 0, 168);
      ground(g, 168);
      var bx = 140, bw = 96, by = 128, bh = 40;
      function boxFront() {
        g.fillStyle = '#6b4a20'; g.fillRect(bx, by, bw, bh);
        g.fillStyle = '#8a6136'; g.fillRect(bx, by, bw, 3);
        g.fillStyle = '#4a3115';
        g.fillRect(bx, by + 20, bw, 1); g.fillRect(bx, by + 32, bw, 1);
        for (var v = by + 28; v < by + bh; v += 12) g.fillRect(bx + 8, v, 1, 12);
      }
      boxFront();
      /* 翻开的箱盖：两块斜着的板，用阶梯画，不画真斜线 */
      g.fillStyle = '#8a6136';
      g.fillRect(bx - 12, by - 6, 4, 8); g.fillRect(bx - 16, by - 14, 4, 8); g.fillRect(bx - 20, by - 22, 4, 8);
      g.fillRect(bx + bw + 8, by - 6, 4, 8); g.fillRect(bx + bw + 12, by - 14, 4, 8); g.fillRect(bx + bw + 16, by - 22, 4, 8);
      catAt(g, 188, 134);
      boxFront();   /* 遮挡：把猫压在箱子里的那一层 */
    },

    /* 雨夜：猫蹲在路灯底下，雨是竖的（竖不是斜，不违反阶梯那条） */
    rain: function (g) {
      backdrop(g, 0, 168);
      ground(g, 168);
      /* 雨：只在灯下画，不然整屏白点太吵 */
      for (var d = 0; d < 34; d++) {
        var rx = 40 + ((d * 53) % 240);
        var ry = 20 + ((d * 37) % 130);
        g.fillStyle = d % 3 === 0 ? '#4a5570' : '#2f3a52';
        g.fillRect(rx, ry, 1, 6);
      }
      /* 灯柱 */
      g.fillStyle = '#2b3038'; g.fillRect(258, 46, 5, 122);
      g.fillStyle = '#3a4048'; g.fillRect(258, 46, 1, 122);
      g.fillStyle = '#4a5058'; g.fillRect(250, 40, 21, 6);
      /* 灯罩下的光：一格一格往下堆，不是渐变 */
      g.fillStyle = '#3a3320';
      g.fillRect(244, 46, 33, 3); g.fillRect(238, 49, 45, 3);
      g.fillRect(232, 52, 57, 3); g.fillRect(226, 55, 69, 3);
      /* 灯泡 */
      g.fillStyle = '#ffb03b'; g.fillRect(256, 46, 9, 4);
      g.fillStyle = '#fffaf0'; g.fillRect(259, 47, 3, 2);
      /* 地上的光斑：同样靠堆出来的 */
      g.fillStyle = '#2e2a1c';
      g.fillRect(226, 168, 70, 2); g.fillRect(216, 170, 90, 2);
      g.fillRect(206, 172, 110, 2); g.fillRect(196, 174, 130, 2);
      catAt(g, 150, 168);
    },

    /* 屋顶：猫在屋顶平台上，弯月挂在另一边。
       屋面一律走直角台阶——斜着排的砖在 1x 下会连成一条斜线，读成划痕 */
    roof: function (g) {
      backdrop(g, 0, 168);
      /* 楼体正面 */
      g.fillStyle = '#1e2228'; g.fillRect(0, 140, ART_W, 28);
      g.fillStyle = '#151920';
      for (var wy = 146; wy < 168; wy += 12) g.fillRect(0, wy, ART_W, 1);
      /* 窗：方块，其中一扇是亮的 */
      g.fillStyle = '#2b3038';
      g.fillRect(28, 150, 9, 9); g.fillRect(60, 150, 9, 9);
      g.fillStyle = '#151920';
      g.fillRect(32, 154, 1, 5); g.fillRect(64, 154, 1, 5);
      g.fillStyle = '#3a3320'; g.fillRect(92, 150, 9, 9);
      g.fillStyle = '#ffb03b'; g.fillRect(95, 153, 3, 3);
      g.fillStyle = '#2b3038';
      g.fillRect(172, 150, 9, 9); g.fillRect(204, 150, 9, 9);
      /* 屋顶平台：左边低、右边高，中间两级直角台阶 */
      g.fillStyle = '#2b3038';
      g.fillRect(0, 128, 108, 12);
      g.fillRect(108, 116, 12, 24);
      g.fillRect(120, 116, 12, 24);
      g.fillRect(132, 128, ART_W - 132, 12);
      /* 压顶亮边：一读就知道这是屋面而不是一条线 */
      g.fillStyle = '#4a5058';
      g.fillRect(0, 128, 108, 3);
      g.fillRect(108, 116, 24, 3);
      g.fillRect(132, 128, ART_W - 132, 3);
      /* 台阶踏面再压一道暗边，台阶感更硬 */
      g.fillStyle = '#191c22';
      g.fillRect(108, 116, 2, 24); g.fillRect(120, 116, 2, 24);
      /* 弯月：先画满，再用夜空色偏心挖掉一块 */
      var mx = 244, my = 60, mr = 26;
      g.fillStyle = '#ffb03b';
      for (var yy = -mr; yy <= mr; yy++) {
        for (var xx = -mr; xx <= mr; xx++) {
          if (xx * xx + yy * yy <= mr * mr) g.fillRect(mx + xx, my + yy, 1, 1);
        }
      }
      g.fillStyle = '#14121c';
      for (var yy2 = -mr; yy2 <= mr; yy2++) {
        for (var xx2 = -mr + 12; xx2 <= mr + 12; xx2++) {
          if (xx2 * xx2 + yy2 * yy2 <= mr * mr) g.fillRect(mx + xx2, my + yy2, 1, 1);
        }
      }
      /* 猫蹲在低平台上，面朝月亮。平台面在 y=128，猫脚就取 128 */
      catAt(g, 56, 128);
    },

    /* ================= 白天 =================
       夜里的画法不能直接搬到白天：底色、太阳、云、海、地面全不一样。
       下面八幅共用上面那套 daytime 工具，硬边、无渐变、折线走阶梯。 */

    /* 海边日出：太阳压在海平线上，猫坐在沙滩上背对着它 */
    beach: function (g) {
      skyDay(g, 120, '#4f9fd8', '#79bde9', '#a9d9f3');
      sunDisc(g, 214, 108, 22);
      cloud(g, 26, 34, 62); cloud(g, 250, 52, 48);
      sea(g, 120, 40);
      /* 沙滩：四段硬色，越近越亮 */
      g.fillStyle = '#d9c49a'; g.fillRect(0, 160, ART_W, 14);
      g.fillStyle = '#e6d4ae'; g.fillRect(0, 170, ART_W, 16);
      g.fillStyle = '#efdfbe'; g.fillRect(0, 180, ART_W, 20);
      /* 太阳在沙面上拉出来的一道反光：竖着的硬条，不是斜的 */
      g.fillStyle = '#f7ecc9';
      g.fillRect(208, 160, 12, 8); g.fillRect(204, 168, 20, 8); g.fillRect(200, 176, 28, 8);
      catAt(g, 62, 182);
      /* 沙滩上两行脚印：4 个小方块，往右下错开 */
      g.fillStyle = '#c9b287';
      g.fillRect(96, 172, 2, 2); g.fillRect(104, 176, 2, 2);
      g.fillRect(92, 180, 2, 2); g.fillRect(100, 184, 2, 2);
    },

    /* 海上：一只船，猫站在甲板上，海鸥在头顶 */
    boat: function (g) {
      skyDay(g, 84, '#5aa7dc', '#8bc8ec', '#b6e0f2');
      sunDisc(g, 60, 58, 18);
      cloud(g, 150, 30, 54); cloud(g, 240, 48, 40);
      sea(g, 84, 116);
      /* 海鸥：三根一体的横条加两个下折的小头，纯直角 */
      g.fillStyle = '#f2ece0';
      g.fillRect(196, 52, 8, 1); g.fillRect(204, 52, 8, 1);
      g.fillRect(196, 53, 1, 1); g.fillRect(211, 53, 1, 1);
      /* 船体：两条横线夹一段，船头翘起也是阶梯 */
      var bx = 96, by = 138;
      g.fillStyle = '#8a6136'; g.fillRect(bx, by, 104, 4);
      g.fillStyle = '#6b4a20'; g.fillRect(bx, by + 4, 104, 6);
      g.fillStyle = '#8a6136';
      g.fillRect(bx, by, 14, 1); g.fillRect(bx - 10, by - 3, 10, 3);
      g.fillRect(bx - 18, by - 6, 8, 3);
      /* 桅杆：竖的 */
      g.fillStyle = '#6b4a20'; g.fillRect(bx + 60, by - 54, 2, 54);
      /* 帆：一块梯形，全用横条堆 */
      g.fillStyle = '#f2ece0';
      g.fillRect(bx + 44, by - 50, 14, 2);
      g.fillRect(bx + 40, by - 46, 18, 2);
      g.fillRect(bx + 38, by - 42, 20, 2);
      catAt(g, bx + 24, by);
      /* 船在水上的影子：一段深色横带 */
      g.fillStyle = '#25506f'; g.fillRect(bx - 14, by + 12, 140, 3);
    },

    /* 山上看夕阳：两层山脊，夕阳压在西边那道山棱上 */
    summit: function (g) {
      skyDay(g, 120, '#3f7fae', '#79bde9', '#f0c98a');
      sunDisc(g, 96, 104, 26);
      cloud(g, 210, 40, 58); cloud(g, 28, 64, 44);
      /* 山：横条一层层收窄，堆出台阶状的山棱，不画斜线 */
      function ridge(g, cx, base, halfW, h, col, col2) {
        for (var i = 0; i < h; i++) {
          var w = Math.floor(halfW * (1 - i / h));
          g.fillStyle = col; g.fillRect(cx - w, base - i, w * 2, 1);
        }
        g.fillStyle = col2;
        g.fillRect(cx - Math.floor(halfW * 0.35), base - h, Math.floor(halfW * 0.7), 2);
      }
      ridge(g, 236, 132, 92, 74, '#2f5f52', '#e8c46a');
      ridge(g, 64, 140, 78, 48, '#3a6f4a', '#2a4f3a');
      g.fillStyle = '#1e3d33'; g.fillRect(0, 132, ART_W, ART_H - 132);
      /* 猫在近处这道山脊的顶上（x=64、h=48，峰顶 92） */
      catAt(g, 64, 92);
    },

    /* 院子：栅栏、两丛花，猫在草地上 */
    garden: function (g) {
      skyDay(g, 150, '#5aa7dc', '#9ad0ee', '#cfe9f5');
      sunDisc(g, 256, 44, 20);
      cloud(g, 32, 40, 56);
      grassDay(g, 150);
      /* 栅栏：横板 + 竖柱，全部直角 */
      g.fillStyle = '#b98d54';
      g.fillRect(0, 118, ART_W, 4); g.fillRect(0, 132, ART_W, 4);
      for (var p = 6; p < ART_W; p += 22) { g.fillRect(p, 112, 3, 30); }
      /* 花：茎一根，花头三格十字 */
      function flower(g, x, y, col) {
        g.fillStyle = '#3f7a30'; g.fillRect(x, y, 1, 9);
        g.fillStyle = col;
        g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5);
      }
      flower(g, 46, 146, '#e2557a'); flower(g, 60, 150, '#f2b53a');
      flower(g, 262, 144, '#e2557a');
      catAt(g, 168, 172);
    },

    /* 窗台：室内，猫坐在窗沿上往外看，窗外是白天的院子 */
    window: function (g) {
      /* 室内墙 */
      g.fillStyle = '#2a2438'; g.fillRect(0, 0, ART_W, ART_H);
      /* 窗外：先把一小块白天铺好，再压窗框 */
      g.fillStyle = '#8bc8ec'; g.fillRect(60, 26, 200, 110);
      g.fillStyle = '#a9d9f3'; g.fillRect(60, 96, 200, 40);
      g.fillStyle = '#6faa5c'; g.fillRect(60, 136, 200, 12);
      sunDisc(g, 220, 52, 14);
      cloud(g, 80, 40, 40);
      /* 窗框：四根硬边，中间一根竖棂 */
      g.fillStyle = '#f2ece0';
      g.fillRect(56, 22, 208, 5); g.fillRect(56, 141, 208, 6);
      g.fillRect(56, 22, 5, 125); g.fillRect(259, 22, 5, 125);
      g.fillRect(158, 27, 4, 114);
      /* 窗台 */
      g.fillStyle = '#8a6136'; g.fillRect(48, 147, 224, 5);
      g.fillStyle = '#6b4a20'; g.fillRect(48, 152, 224, 4);
      catAt(g, 100, 147);
      /* 窗帘：两侧各一摞，褶子用竖条 */
      g.fillStyle = '#7a3f52';
      g.fillRect(28, 14, 24, 138); g.fillRect(268, 14, 24, 138);
      g.fillStyle = '#5e2f3e';
      g.fillRect(34, 14, 3, 138); g.fillRect(274, 14, 3, 138);
    },

    /* 白天草地：和归档页那套草原一个色调，只是近景 */
    field: function (g) {
      skyDay(g, 132, '#4f9fd8', '#79bde9', '#a9d9f3');
      sunDisc(g, 208, 46, 18);
      cloud(g, 24, 30, 58); cloud(g, 236, 24, 46);
      /* 远山：两层台阶 */
      function ridge(g, cx, base, halfW, h, col) {
        for (var i = 0; i < h; i++) {
          var w = Math.floor(halfW * (1 - i / h));
          g.fillStyle = col; g.fillRect(cx - w, base - i, w * 2, 1);
        }
      }
      ridge(g, 70, 132, 60, 30, '#8ec47a');
      ridge(g, 210, 132, 72, 22, '#a5d18f');
      grassDay(g, 132);
      /* 土路：一段硬边，两侧压深 */
      g.fillStyle = '#b0925f'; g.fillRect(0, 168, ART_W, 14);
      g.fillStyle = '#99794b'; g.fillRect(0, 176, ART_W, 6);
      g.fillStyle = '#cbb083'; g.fillRect(0, 168, ART_W, 2);
      catAt(g, 108, 168);
    },

    /* 池塘：白天，猫在池边低头，水里有条鱼 */
    pond: function (g) {
      skyDay(g, 150, '#5aa7dc', '#9ad0ee', '#cfe9f5');
      cloud(g, 34, 36, 52);
      sunDisc(g, 62, 48, 16);
      grassDay(g, 150);
      /* 池：三层台阶的椭圆 */
      g.fillStyle = '#2c4356';
      g.fillRect(150, 160, 96, 6); g.fillRect(132, 166, 132, 6); g.fillRect(120, 172, 156, 6);
      g.fillStyle = '#3a6a8c';
      g.fillRect(156, 163, 84, 3); g.fillRect(140, 169, 116, 3);
      /* 鱼 + 两道波纹 */
      g.fillStyle = '#c8894a'; g.fillRect(196, 170, 12, 2);
      g.fillRect(206, 169, 2, 1); g.fillRect(206, 172, 2, 1);
      g.fillStyle = '#7fa8c4';
      g.fillRect(168, 168, 18, 1); g.fillRect(214, 175, 22, 1);
      catAt(g, 74, 176);
    },

    /* 雪：白地、飘雪、猫踩出一串脚印 */
    snow: function (g) {
      skyDay(g, 150, '#4a5a78', '#6b7a96', '#8f9bb2');
      cloud(g, 20, 30, 60); cloud(g, 210, 44, 50);
      /* 雪地：两层白 */
      g.fillStyle = '#e8edf2'; g.fillRect(0, 150, ART_W, 30);
      g.fillStyle = '#f6f8fa'; g.fillRect(0, 162, ART_W, 38);
      g.fillStyle = '#c9d2dc'; g.fillRect(0, 148, ART_W, 3);
      /* 飘雪：错开的三档白点 */
      for (var s = 0; s < 40; s++) {
        var sx = (s * 61) % ART_W, sy = 14 + ((s * 37) % 128);
        g.fillStyle = s % 4 === 0 ? '#ffffff' : '#cfd8e4';
        g.fillRect(sx, sy, 1, 1);
      }
      catAt(g, 178, 176);
      /* 脚印：从猫往左下错开，2x2 的小坑 */
      g.fillStyle = '#b9c4d1';
      g.fillRect(158, 178, 2, 2); g.fillRect(146, 182, 2, 2);
      g.fillRect(134, 186, 2, 2); g.fillRect(122, 190, 2, 2);
    }
  };

  /* 给一篇文章挑一幅图。
     用标题的哈希而不是 Math.random：同一篇文章刷新多少次都是同一张，
     而不同文章会散到不同画面上。用 Math.random 的话每次刷新猫都在换，
     那不叫配图，叫抽奖。 */
  function pickArt(slug) {
    var keys = Object.keys(ART);
    var h = 0, s = String(slug || '');
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return keys[h % keys.length];
  }

  /* 每幅画的名字。
     配图是按标题哈希自动挑的，所以图注没法在手写 HTML 里定死——手写那两篇
     是作者自己选的图，标题可以讲点画里没有的话；自动挑的这十六幅只能报出
     画名。带 data-auto="1" 的 figcaption 会被这里覆盖掉。 */
  var ARTCAP = {
    origin: 'ORIGIN', clock: 'CLOCK', bug: 'BUG', perch: 'PERCH',
    puddle: 'PUDDLE', boxcat: 'BOXCAT', rain: 'RAIN', roof: 'ROOF',
    beach: 'BEACH', boat: 'BOAT', summit: 'SUMMIT', garden: 'GARDEN',
    window: 'WINDOW', field: 'FIELD', pond: 'POND', snow: 'SNOW'
  };
  var ARTCN = {
    origin: '第一个点', clock: '钟和折线', bug: '楼下的夜', perch: '砖墙上的夜',
    puddle: '水洼', boxcat: '箱子里', rain: '路灯下的雨', roof: '屋顶',
    beach: '海边日出', boat: '海上的船', summit: '山上看夕阳', garden: '院子',
    window: '窗台', field: '白天草地', pond: '池塘', snow: '雪'
  };

  function drawArt(cv) {
    var which = cv.getAttribute('data-art');
    /* 没写 data-art 就按文章挑一幅。以前这里是直接 return，
       于是 Gmeek 新建的页面（根本没有这个 canvas）画出来是一片空白。 */
    if (!which || !ART[which]) {
      which = pickArt(cv.getAttribute('data-slug') || document.title);
      cv.setAttribute('data-art', which);
    }
    var fn = ART[which];
    if (!fn) return;
    fn(fitCanvas(cv));

    /* 自动挑的图要自动写图注。手写那两篇的图注是作者写的，不带 data-auto，
       所以不会被碰。 */
    var cap = cv.parentNode && cv.parentNode.querySelector
            ? cv.parentNode.querySelector('figcaption[data-auto]') : null;
    if (cap && ARTCAP[which]) cap.textContent = ARTCAP[which] + ' \u2014 ' + ARTCN[which];
  }

  /* ================= 页面装配 ================= */
  function boot() {
    var raw = document.body.getAttribute('data-post');
    if (!raw) return;
    var p;
    try { p = JSON.parse(raw); } catch (e) { return; }

    /* kicker：标签 + 日期 + 字数。标签色和归档页的 .lab 同一套
       空的那几项不输出：被 out/adopt-posts.ps1 接管的页面如果没在 blogBase.json
       里找到记录（极少见，但真发生过），日期和字数都是空的，硬渲染就是一个
       光秃秃的小方块。 */
    var k = el('kicker');
    if (k) {
      var bits = '';
      if (p.lab) {
        bits += '<span class="lab' + (p.lab === 'bug' ? ' bug' : '') + '">' +
                p.lab.toUpperCase() + '</span>';
      }
      if (p.date)  bits += '<span class="dt">' + p.date + '</span>';
      if (p.words) bits += '<span class="dt">' + p.words + ' \u8bcd</span>';
      k.innerHTML = bits;
      if (!bits) k.style.display = 'none';
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

    /* 找所有"该画插画"的 canvas。data-art 可以缺——缺了就按 slug 挑一幅，
       所以选择器不能只认 data-art，否则新文章（还没定下画哪幅）一张都画不出来。
       .art 是约定好的标记；data-art / data-slug 留着是为了能直接点名。 */
    function artCanvases() {
      return document.querySelectorAll('canvas[data-art], canvas[data-slug], canvas.art');
    }

    var cvs = artCanvases();
    for (var i2 = 0; i2 < cvs.length; i2++) drawArt(cvs[i2]);
    /* 视口变了要重画：插画是按整数倍放大的，宽度一变倍数就得跟着变 */
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var again = artCanvases();
        for (var i3 = 0; i3 < again.length; i3++) drawArt(again[i3]);
      }, 140);
    });
    void ICONS;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
