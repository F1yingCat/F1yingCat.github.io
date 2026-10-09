/* ============================================================
   glass.js -- 像素风磨砂玻璃卡片的交互层
   ------------------------------------------------------------
   只干一件事：给每一张卡片接上指针，做出不超过 4 度的 3D 倾斜，
   指针离开时角度归零，由 CSS 那边过渡回正。

   嵌套的玻璃卡【不】互相让位——指针从卡片移到里面的按钮上时，两层照常
   一起倾斜。理由见 move() 里那段注释。

   这里原来还有第二件事：造一张 40x40 的像素光斑精灵（canvas 逐格填、
   alpha 量化成 5 级），挂到 :root 上给 CSS 当内部光斑的 background-image、
   当邻近边框提亮的 mask-image。按要求删掉了，材质和倾斜留下。
   连带删掉的还有纸色判定（.glass.paper）——它存在的唯一理由是白光配 screen
   落在奶油色纸条上等于什么都没发生，得换成琥珀精灵配 multiply。没有光斑了
   就没有两种精灵要挑，这个判定也就没有意义了。

   为什么不写进各页面的 script：三个页面各有一份内联 style，改一次要动三处，
   而三处总会漂。这轮已经把 restore 清单、posts.js、rss 都收敛成单一来源了，
   卡片效果再散开就没有意义了。
   ============================================================ */

(function () {
  'use strict';

  var TILT_MAX = 4;      // 度，硬上限。用户说"不超过 4 度"，这里是唯一的出处

  /* 覆盖站点上所有"卡片 / 按钮 / 大框"的面。
     .panel 是首页那四个区域大框（area0 小屋 / area1 公告栏 …）。它自己的
     横向视差由 positionPanels() 每帧写 --px、CSS 用独立的 translate 属性
     消费，两个动作叠成一条矩阵，互不覆盖——写在 transform 上会直接把视差冲掉，
     面板会钉在原地不动。
     .plate 是唯一完全不倾斜的面：它的 transform 归 positionPlates() 每帧改写，
     给它倾斜会直接把镜头拆了。它照样拿磨砂玻璃。 */
  var SELECTOR = [
    '.btn', '.btn-primary', '.card', '.znav button', '.save a', '.pager .pg',
    '.boardlist a', '.chanlist a', '.linklist a', '.plate', '.filters button', '.pip',
    '.panel'
  ].join(',');

  /* ---- 指针 -------------------------------------------------------- */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function attach(el, opts) {
    /* 幂等：scan() 会在 DOMContentLoaded 和 load 各跑一次，而卡片是各页面
       自己用 JS 生成的，生成时刻不固定。没这一道，第二次扫描会给同一张卡
       再绑一套监听，两套监听互相覆盖同一个 --rx，卡片开始抖。 */
    if (el.classList.contains('glass')) return;
    var flat = !!opts.flat;

    el.classList.add('glass');
    if (flat) el.classList.add('glass-flat'); else el.classList.add('tilt');

    function move(e) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;

      /* 这里原来有一段"嵌套让位"：指针落到内层玻璃卡上时，外层直接 leave()，
         角度归零、边框熄灭。理由是两层的【光斑】会叠在一起，读成两层脏玻璃。

         光斑删掉之后这个理由就不成立了，而它的副作用还在：指针从卡片移到
         里面的按钮上（首页 area0 大框里就有两个按钮），卡片会当场"咔"一下
         弹回原位，等指针再移回空白处才重新歪起来——同一个手势里断一下，
         读起来像卡片被点了一下。所以整段去掉：外层按指针在【自己】盒子里的
         位置照常算角度，和内层的倾斜一起跑。

         两者叠起来的总角度会超过 TILT_MAX（父子两条 transform 相乘），
         这是"跟着一起转"的必然结果，不是失控——指针走到卡片角落时父子各 4°，
         按钮累计 8°。要压回 4°就得让父子共用一个角度源（事件委托到根、
         按各自盒子换算），那是另一种做法，而且大框和按钮尺寸差四倍多，
         共用一个角度会让大框的倾斜变得几乎看不出来。这里按各自盒子算。 */

      var x = clamp(e.clientX - r.left, 0, r.width);
      var y = clamp(e.clientY - r.top, 0, r.height);
      el.classList.add('glass-live');

      if (flat) return;
      /* 倾斜按光标在卡片里的相对位置算：正中心 = 0 度，四角 = ±TILT_MAX。
         用实际像素偏移而不是百分比，是因为卡片的宽高差得很远，
         百分比会让宽卡片左右两侧几乎不动、上下却晃得很厉害。 */
      var nx = (x / r.width) * 2 - 1;
      var ny = (y / r.height) * 2 - 1;
      el.style.setProperty('--ry', (nx * TILT_MAX).toFixed(2) + 'deg');
      el.style.setProperty('--rx', (-ny * TILT_MAX).toFixed(2) + 'deg');
    }

    function enter(e) {
      /* 直接用键盘 focus 进来时不会有 pointermove，不走 move 的话角度会停在上
         一次离开的地方。不过度也不影响：它会自己补一个 .glass-live，边框照样亮。 */
      if (e.clientX || e.clientY) move(e);
      el.classList.add('glass-live');
    }
    function leave() {
      el.classList.remove('glass-live');
      /* 角度归零，transform 由 .glass.tilt:not(:hover) 的过渡平滑送回原位 */
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    }

    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointercancel', leave);
    el.addEventListener('focus', function () { el.classList.add('glass-live'); });
    el.addEventListener('blur', leave);
  }

  function scan() {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      /* .plate 的 transform 归 positionPlates() 管，倾斜会让镜头抖。
         归档页里它是唯一需要避让的面。 */
      attach(el, { flat: el.classList.contains('plate') });
    }
  }

  function boot() {
    scan();
    /* 卡片是各页面自己生成的，而它们的构建点有的在 DOMContentLoaded、
       有的更晚。load 之后再补扫一次，接住晚到的那批。attach 幂等，
       重复扫到不会重复绑定。 */
    window.addEventListener('load', scan);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();