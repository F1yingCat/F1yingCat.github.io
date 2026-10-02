/* ============================================================
   F1yingCat - 精灵表与绘图
   ------------------------------------------------------------
   这份内容是从 index.html 里原样抽出来的：PAL（调色板）、SPR（13 帧精灵）、
   drawSprite（画法）。一个字符都没改。

   【重要】index.html 里还有一份完全相同的 PAL / SPR / drawSprite。
   那份是为了让首页保持单文件自包含（不依赖 assets/ 就能打开），代价是
   改猫的画法要改两处。改之前记得同步这里。
   两份的唯一差别：本文件末尾多了一句 window.PIX = {...} 的导出，
   别的页面靠它拿到这三样东西。

   精灵是调色板字符画：每个字符是一个色键（PAL 里查），
   "." 是透明。drawSprite 按 mul 整数放大，保证放大后每个源像素
   仍然占整数个设备像素——非整数缩放会被重采样出逐格的混合缝，
   实测一块纯橘色毛发上能数出 301 种颜色。
   ============================================================ */var PAL = {
  k:'#14121c', K:'#6e2c08', d:'#0d0b13', r:'#bf4f1c', o:'#ef7c2a',
  O:'#ffb03b', c:'#fffaf0', a:'#4aa3d4', j:'#5fbf6a', w:'#f2ece0',
  dusk:'#3b3350', stone:'#6b6288',
  /* 地形专用：低饱和青绿，与"涨跌绿"拉开距离 */
  g1:'#1e3a34', g2:'#26483d', g3:'#2f5648', w1:'#16293f', w2:'#1d3a55'
};

var SPR = {
/* 24×24 蜷着睡：身子盘成一团，头低垂在左边，尾巴绕到身前。
   底边落在第 22 行——drawSprite 按 feetY-44 起画，第 22 行正好压在地平线上。
   行内的 "|" 只是我数格子用的分隔符，drawSprite 会把它当普通字符忽略，
   所以渲染前要剥掉 */
cat24_sleep_raw:[
"........................",
"........................",
"........................",
"......KK........KK......",
".....KOK........KOK.....",
".....KOKKKKKKKKKKOK.....",
"....KOooooooooooooOK..K.",
"....KorrooooooorrooK..K.",
"....KKKKKKKKKKKKKKKK..K.",
"....KooooooooooooooK..K.",
"....KoccccooccccoooK..K.",
"...KcooooOOOOoooooocK.Ko",
"..KcoooorooooooroooocKKo",
"..KooccccccccccccooooKKo",
"..KKKKKKKKKKKKKKKKKKKK..",
".KoooooooooooooooooooK..",
".KrrrrrrrrrrrrrrrrrrrK..",
".KooorrrrooooorrrrroooK.",
".KrrrrrrrrrrrrrrrrrrrrK.",
".KooooooooooooooooooooK.",
"..KooooooooooooooooooK..",
"..KoooooooooooooooooooK.",
"..KKKKKKKKKKKKKKKKKKKK..",
"........................"

],
/* 24×24 主角色：内耳 / 虎斑 M / 眼睛高光 / 吻部 / 胡须 / 胸口奶白 / 环纹尾巴 */
cat24:[
"......KK........KK......",
".....KOK........KOK.....",
".....KOKKKKKKKKKKOK.....",
"....KOooooooooooooOK..K.",
"....KorrooooooorrooK..K.",
"....KokkooooookkoooK..K.",
"....KoOkooooookOoooK..K.",
"....KoooookkkkoooooK..K.",
"....KoccookkkkooccoK..K.",
"....KoccccooccccoooK..K.",
"....KroooooooooooorK..r.",
"...KcooooOOOOoooooocK.Ko",
"..KcoooorooooooroooocKKo",
"..KooccccccccccccooooKKo",
"..KoccccKccccccccooooKKo",
"..KccKKKKcccccKKKKccKKKo",
"..KrrrrrrrrroooooooooKKK",
"..KoorrrroooooorrrrooKKo",
"..KrrrrrrrrroooooooooKKK",
"..KroooooooooooooooorKKo",
"..KrroooooooooooooorrKKo",
"..KrrrrooooooooooooKKKKo",
"..KKKKKKKKKKKKKKKKKKK...",
"........................",
],
cat24_blink:[
"......KK........KK......",
".....KOK........KOK.....",
".....KOKKKKKKKKKKOK.....",
"....KOooooooooooooOK..K.",
"....KorrooooooorrooK..K.",
"....KooooooooooooooK..K.",
"....KokkooooookkoooK..K.",
"....KoooookkkkoooooK..K.",
"....KoccookkkkooccoK..K.",
"....KoccccooccccoooK..K.",
"....KroooooooooooorK..r.",
"...KcooooOOOOoooooocK.Ko",
"..KcoooorooooooroooocKKo",
"..KooccccccccccccooooKKo",
"..KoccccKccccccccooooKKo",
"..KccKKKKcccccKKKKccKKKo",
"..KrrrrrrrrroooooooooKKK",
"..KoorrrroooooorrrrooKKo",
"..KrrrrrrrrroooooooooKKK",
"..KroooooooooooooooorKKo",
"..KrroooooooooooooorrKKo",
"..KrrrrooooooooooooKKKKo",
"..KKKKKKKKKKKKKKKKKKK...",
"........................",
],

sit:[
"....K......K....",
"...KOK....KOK...",
"...KOOKKKKOOK...",
"...KooooooooK...",
"...KororroroK...",
"...KokkookkoK...",
"...KoOkookOok...",
"cc.KockkkcooKKoo",
".c.KoccooccoKror",
"...KroooooorKKoo",
"..KcooooOOoocKro",
"..KcoroooroocKoo",
"..KoccccccoooKor",
"..KoccKcccccoKK.",
"..KrororororoK..",
"..KKKKKKKKKKKK.."
],
/* 眨眼帧：眼睛收成一条 1px 横线 */
sit_blink:[
"....K......K....",
"...KOK....KOK...",
"...KOOKKKKOOK...",
"...KooooooooK...",
"...KororroroK...",
"...KokkookkoK...",
"...KooooooooK...",
"cc.KockkkcooKKoo",
".c.KoccooccoKror",
"...KroooooorKKoo",
"..KcooooOOoocKro",
"..KcoroooroocKoo",
"..KoccccccoooKor",
"..KoccKcccccoKK.",
"..KrororororoK..",
"..KKKKKKKKKKKK.."
],
sleep:[
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"................",
"...KKKKKKKKKK...",
"..Koooooooooook.",
"..Kokkoooookkk..",
"..Kcccccccccok..",
"..KOooooooooook.",
"...KKKKKKKKKK...",
"................",
"................"
],
house:[
"................",
".......KK.......",
"......KrrK......",
".....KrrrrK.....",
"....KrrrrrrK....",
"...KrrrrrrrrK...",
"..KrrrrrrrrrrK..",
".KKKKKKKKKKKKKK.",
".KccccccccccccK.",
".KcKKccccKKcccK.",
".KccccccccccccK.",
".KccKKKKKKccccK.",
".KccKKKKKKccccK.",
".KccKKKKKKccccK.",
".KKKKKKKKKKKKKK.",
"................"
],
book:[
"................",
"................",
"..KKKK...KKKK...",
"..KcccK..KcccK..",
"..KcccK..KcccK..",
"..KcccKKKKcccK..",
"..KccccccccccK..",
"..KccrccccrccK..",
"..KccrccccrccK..",
"..KccccccccccK..",
"..KccKccccKccK..",
"..KccKccccKccK..",
"..KccKKccKKccK..",
"..KKKKKKKKKKKK..",
"................",
"................"
],
monitor:[
"................",
"................",
".KKKKKKKKKKKKKK.",
".KccccccccccccK.",
".KccccccccccccK.",
".KcccccccjjcccK.",
".KccccccjjccccK.",
".KcccccjjcccccK.",
".KccccjjccccccK.",
".KccjjjcccccccK.",
".KcjjcccccccccK.",
".KjjccccccccccK.",
".KccccccccccccK.",
".KKKKKKKKKKKKKK.",
"......KKKK......",
".......KK......."
],
sun:[
"................",
"................",
"......OOOO......",
"....OOOOOOOO....",
"...OOOOOOOOOO...",
"...OOOOOOOOOO...",
"...OOOOOOOOOO...",
"....OOOOOOOO....",
"......OOOO......",
"....KKKKKKKK....",
"..KaaaaaaaaaaK..",
"..KaaOaaOaaOaaK.",
"..KaaaaaaaaaaK..",
"..KaaOaaOaaOaaK.",
"..KaaaaaaaaaaK..",
".KKKKKKKKKKKKKK."
],
search:[
"................",
"..KKKKKK........",
".KccccccK.......",
"KcaaaaaaacK.....",
"KcaaaaaaacK.....",
"KcaaaaaaacK.....",
"KcaaaaaaacK.....",
"KcaaaaaaacK.....",
"KcaaaaaaacK.....",
".KccccccKKK.....",
"..KKKKKK..KK....",
"..........KKK...",
"...........KKK..",
"............KKK.",
".............KK.",
"................"
],
lock:[
"................",
"................",
"......KKKK......",
".....K....K.....",
".....K....K.....",
"......KKKK......",
"....KKKKKKKK....",
"...KKKKKKKKKK...",
"...KKkKKKKkKK...",
"...KKKKKKKKKK...",
"...KKKKKKKKKK...",
"...KKKKKKKKKK...",
"...KKKKKKKKKK...",
"...KKKKKKKKKK...",
"................",
"................"
],
paw:["o.o.o","ooooo",".ooo.","o...o"]
};

/* 蜷睡精灵是按 "每 6 格一组、用 | 分隔" 手写的，加载时把 | 剥掉，正式名就叫
   cat24_sleep。少了这两行，归档页的猫一坐下/睡着就【整只消失】——
   drawSprite 查不到名字会静默 return，一个像素都不画，影子倒还在原地。
   index.html 自带的那份 PAL/SPR 一直有这两行，所以只有用本文件的归档页中招。
   文件头那句"改猫的画法要改两处"的头一次真的咬人。 */
SPR.cat24_sleep = SPR.cat24_sleep_raw.map(function(r){ return r.replace(/\|/g,''); });
delete SPR.cat24_sleep_raw;

function drawSprite(g,name,ox,oy,mul,alpha,force){
  var rows=SPR[name]; if(!rows) return; mul=mul||1;
  var W=0,i; for(i=0;i<rows.length;i++) W=Math.max(W,rows[i].length);
  var x0=ox-Math.floor((W*mul)/2);
  if(alpha!==undefined) g.save(), g.globalAlpha=alpha;
  for(var y=0;y<rows.length;y++){
    var row=rows[y], yy=oy+y*mul;
    for(var x=0;x<row.length;x++){
      var ch=row.charAt(x);
      if(ch==='.'||!PAL[ch]) continue;
      g.fillStyle=force||PAL[ch];
      g.fillRect(x0+x*mul,yy,mul,mul);
    }
  }
  if(alpha!==undefined) g.restore();
}

/* 导出一个命名空间。普通 <script> 不是模块，用 window 挂出来最省事，
   也让别的脚本能看出这几样东西是"从别处来的"而不是本地临时变量 */
window.PIX = { PAL: PAL, SPR: SPR, drawSprite: drawSprite };