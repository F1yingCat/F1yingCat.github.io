/* ============================================================
   F1yingCat - 站点共享脚本
   ------------------------------------------------------------
   三个页面（tag / post）共用它做的事只有四件：
     1 顶部时钟       —— 每秒更新，窄屏收成 HH:MM
     2 区导航         —— 四个区，点了回首页对应位置
     3 底部进度条     —— 四个可点的方块，和首页长得一样
     4 当前位置高亮

   刻意不做的事：不画猫精灵。首页的猫是从一整张精灵表里 drawSprite 出来的，
   别的页面没有那张表，引入它就得把 12 帧精灵一起搬过来。品牌位置改用
   一枚内联 SVG 像素猫——它就是首页 favicon 里那只，两处本来就是同一个图形。
   ============================================================ */
(function () {
  'use strict';

  /* 和首页的 ZONES 保持一致。改这里等于改全站，改完记得同步首页那份 */
  var ZONES = [
    { id: 'z0', cn: '小屋',   en: 'HOME',         icon: 'house' },
    { id: 'z1', cn: '公告栏', en: 'NOTICE BOARD', icon: 'book' },
    { id: 'z2', cn: '雨桥',   en: 'STORM BRIDGE', icon: 'monitor' },
    { id: 'z3', cn: '岸',     en: 'FAR SHORE',    icon: 'search' }
  ];
  /* 首页四个区的世界坐标。顶部区导航和底部方块点第 i 格都走
     homeHref() + '#' + ZONES[i].id，首页的深链会把猫放到这一区。 */
  /* 首页的相对地址不能写死：tag.html 在站点根，post/*.html 在 post/ 下，
     写死 'index.html' 会让文章页点任何一区都跳到 post/index.html —— 404。
     而且这个地址只在 JS 里拼出来，不出现在任何 href 属性上，
     扫 HTML 链接的检查器看不见它（这个坑就是这么漏出去的）。
     页面 head 里那个品牌链接的 href 是每个页面手写的、本来就是对的，
     直接读它，比在这里算相对路径可靠得多。 */
  function homeHref() {
    var b = document.getElementById('brand');
    var h = b && b.getAttribute('href');
    /* 首页的品牌链接是 '#z0' 这种纯片段（首页自带脚本，根本不加载本文件），
       但真被读到的话拼出来会是 '#z0#z1' 这样的坏片段。宁可退回站点根。 */
    if (!h || h.charAt(0) === '#') return './';
    return h;
  }

  var CAT_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<rect width="16" height="16" fill="#14121c"/>' +
      '<rect x="4" y="2" width="2" height="2" fill="#ef7c2a"/>' +
      '<rect x="10" y="2" width="2" height="2" fill="#ef7c2a"/>' +
      '<rect x="3" y="3" width="10" height="8" fill="#ef7c2a"/>' +
      '<rect x="4" y="6" width="2" height="2" fill="#14121c"/>' +
      '<rect x="10" y="6" width="2" height="2" fill="#14121c"/>' +
      '<rect x="6" y="9" width="4" height="4" fill="#ef7c2a"/>' +
    '</svg>';

  function el(id) { return document.getElementById(id); }

  /* ---------- 1. 时钟 ---------- */
  /* 挂在 setInterval 上而不是画布的 rAF 里：标签页切到后台时 rAF 会停摆，
     时钟会跟着停；定时器在后台被节流到 1Hz 一次，正好够用，也不占每帧预算 */
  function initClock() {
    var ce = el('clock');
    if (!ce) return;
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var d = new Date(), narrow = window.innerWidth <= 860;
      ce.textContent = narrow
        ? p2(d.getHours()) + ':' + p2(d.getMinutes())
        : d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
          ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
      ce.setAttribute('datetime', d.toISOString().slice(0, 19));
    }
    tick();
    setInterval(tick, 1000);
    window.addEventListener('resize', tick);
  }

  /* ---------- 2 + 3. 导航和进度条 ---------- */
  /* active: 0..3 高亮第几个。归档和文章页都属于「公告栏」也就是 z1，
     所以这几个页面写 data-active="1"：前两格点亮，橙色进度条走满一半。
     真要表示"不在任何一区"就传 -1，那时四格全灭、进度条不亮 */
  function initNav(active) {
    var nav = el('znav');
    if (nav) {
      nav.innerHTML = ZONES.map(function (z, i) {
        return '<button data-i="' + i + '" aria-current="' + (i === active ? 'true' : 'false') + '">' +
               z.en + '</button>';
      }).join('');
      nav.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-i]');
        if (!b) return;
        window.location.href = homeHref() + '#' + ZONES[parseInt(b.dataset.i, 10)].id;
      });
    }

    var tr = el('track');
    if (!tr) return;
    tr.innerHTML = '<div class="fill"></div>' + ZONES.map(function (z, i) {
      /* 12.5 / 37.5 / 62.5 / 87.5：四格在条上等距，和首页一字不差。
         position 用 left 的百分比，不跟着内容走 */
      return '<button class="pip' + (i <= active ? ' on' : '') + '" data-i="' + i + '" ' +
             'style="left:' + (12.5 + i * 25) + '%" aria-label="回到' + z.cn + '">' +
             '<b>' + z.cn + '</b></button>';
    }).join('');
    /* 橙色进度段：算法和首页 setZone() 里的完全一样 ((i+1)/NZ)。
       非首页没有猫在走，进度不随时间动，按当前区一次画到位；
       active 为 -1 时保持 CSS 里的 width:0，四格全灭表示"不在任何一区" */
    var fill = tr.querySelector('.fill');
    if (fill && active >= 0) fill.style.width = ((active + 1) / ZONES.length * 100).toFixed(1) + '%';
    tr.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (!b) return;
      window.location.href = homeHref() + '#' + ZONES[parseInt(b.dataset.i, 10)].id;
    });
  }

  /* ---------- 4. 品牌 ---------- */
  function initBrand() {
    var b = el('brand');
    if (b) b.insertAdjacentHTML('afterbegin', CAT_SVG);
  }

  function boot() {
    initBrand();
    initClock();
    /* 页面上写 data-active="0..3" 表示属于哪一区，不写就是 -1 */
    var a = document.body.getAttribute('data-active');
    initNav(a === null ? -1 : parseInt(a, 10));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
