param(
  [string]$Src = 'C:\WorkFiles\blog\static\index.html',
  [string]$Dst = 'C:\WorkFiles\blog\out\probe-pix.html'
)
$ErrorActionPreference='Stop'
$txt = [System.IO.File]::ReadAllText($Src, [System.Text.Encoding]::UTF8)

# ASCII-only anchors on purpose: PS 5.1 reads a no-BOM .ps1 as ANSI/GBK and
# mangles non-ASCII, which silently breaks every .Replace below.
$find = "cat.x=zi*ZONE_W+SCENE_W/2;"
if($txt.IndexOf($find) -lt 0){ throw 'deep-link anchor not found' }
$repl = "var mcx=String(location.search||'').match(/[?&]cx=(\d+)/);" +
        "cat.x=mcx?parseInt(mcx[1],10):(String(location.search||'').match(/[?&]cx=(\d+)/)?zi*ZONE_W+SCENE_W/2:3394);"
$txt = $txt.Replace($find, $repl)

$probe = @'
<script>
(function(){
  var errs=[], el=null;
  window.addEventListener('error',function(e){ errs.push('onerror: '+e.message); });
  var oe=console.error, ow=console.warn;
  console.error=function(){ errs.push('E: '+[].join.call(arguments,' ')); oe.apply(console,arguments); };
  console.warn =function(){ errs.push('W: '+[].join.call(arguments,' ')); ow.apply(console,arguments); };

  /* NB: the canvas handle must be taken inside show(), not here.
     buildWorld() runs from the page's own resize handler, so view.world is
     still null while this IIFE is being parsed. Reading it at the top level
     throws during parse, which kills the whole IIFE before any setTimeout
     is registered - and the probe then shows nothing at all, which looks
     exactly like "the probe is fine, the page has no data". */
  function px(x,y){
    var d=view.world.main.getContext('2d').getImageData(x,y,1,1).data;
    return ('#'+((1<<24)+(d[0]<<16)+(d[1]<<8)+d[2]).toString(16).slice(1));
  }
  function lum(x,y){
    var d=view.world.main.getContext('2d').getImageData(x,y,1,1).data;
    return Math.round(0.2126*d[0]+0.7152*d[1]+0.0722*d[2]);
  }
  function put(s){
    if(!el){
      el=document.createElement('pre');
      el.style.cssText='position:fixed;left:0;top:0;width:100%;margin:0;padding:8px 10px;'
        +'background:#fff;color:#000;font:13px/1.5 monospace;z-index:999999;'
        +'white-space:pre-wrap;border-bottom:3px solid #000';
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.textContent=s;
  }
  function show(){
    if(!view.world){ put('WAIT no view.world'); return; }
    var L=[], i;
    if(window.__wlog) L.push('WANDER '+window.__wlog);
    /* --- 1. the road: is the top lip lit at every single x from 0 to the
       shore? A continuous road must have a lit lip with no dark gap. --- */
    var dark=[], lipMax=0, lipMin=255, n=0;
    for(i=0;i<=3800;i+=10){
      var gy=groundAt(i);
      var L0=lum(i,gy), L1=lum(i,gy+3);
      n++;
      if(L1<lipMin) lipMin=L1;
      if(L0>lipMax) lipMax=L0;
      /* a lip that is not brighter than the face below it is no lip */
      if(L0<L1-8) dark.push(i);
    }
    L.push('LIPdark='+dark.length+'/'+n+(dark.length?(' first@'+dark.slice(0,8).join(',')):'')+' lipLum='+lipMin+'..'+lipMax);

    /* --- 2. the same road, sampled at every material change, face colour
       plus the top lip colour, so the seven materials can be told apart --- */
    var SAMPLES=[300,600,700,860,1000,1500,1650,1750,1820,1860,1900,2200,
                 2560,2600,2640,2680,2750,3000,3300,3410];
    var rows=[];
    for(i=0;i<SAMPLES.length;i++){
      var x=SAMPLES[i], gy2=groundAt(x);
      rows.push(x+':'+px(x,gy2)+'/'+px(x,gy2+3)+'/y'+gy2);
    }
    L.push('ROAD ['+rows.join(' ')+']');

    /* --- 3. the window: the glow ring must not sit on the glass.
       Inside the glass should be the bright orange, not the halo yellow. --- */
    L.push('WIN glass='+px(267,wallTopPx())+' halo='+px(267,wallTopPx()-46)
      +' ringR='+px(313,wallTopPx())+' glassLum='+lum(267,wallTopPx()));

    /* --- 4. the lamp: core must be the brightest pixel of the whole lamp,
       and the ground pool below it must be brighter than bare ground. --- */
    var ty=GROUND-74+3;
    L.push('LAMP core='+px(ZONE_W+92,ty)+' coreLum='+lum(ZONE_W+92,ty)
      +' pool='+px(ZONE_W+92,GROUND)+' poolLum='+lum(ZONE_W+92,GROUND)
      +' faceLum='+lum(ZONE_W+92,GROUND+4) +' farFaceLum='+lum(ZONE_W+150,GROUND+4));

    /* --- 5. the stairs: each step must be lower than the one before --- */
    var st=[];
    for(i=0;i<=4;i++) st.push(groundAt(STAIR_A+10+i*(STAIR_B-STAIR_A)/4));
    L.push('STAIR '+st.join('>'));

    /* --- 6. the fish. It lives in frame(), not in the baked layer, so the
       canvas has to be sampled: if the swim box were off the water, or the
       on-screen cull compared device pixels against world units, the fish
       would silently never appear.

       Headless only produces two or three rAF frames, so the camera easing
       never lands: camX sat at 2266 while the cat stood at 3394. Reading
       the canvas then says "fish off screen", which is a fact about the
       camera, not about the fish. Park the cat and the camera first, then
       drive exactly one frame by hand and sample what that frame drew. */
    cat.x=3394;
    view.camX=Math.max(0,Math.min(Math.max(0,WORLD_W-view.viewW), 3394-CAT_SX));
    view.camX=(3394-CAT_SX<0)?0:view.camX;
    view.camX=Math.max(0,Math.min(Math.max(0,WORLD_W-view.viewW), 3394-CAT_SX));
    frame(1200);
    /* Multi-frame motion check. Headless gives two or three rAF frames, which
       is not enough time for anything to travel, so drive frame() from a
       timer and watch the fish's world x and its painted centroid. Fish.x
       moving is the proof that it swims; a non-zero belly-pixel count on
       every row is the proof that it is on the water and not culled. */
    if(!window.__mvStarted){
      window.__mvStarted=true;
      var mv=[];
      var iv=setInterval(function(){
        /* shot.ps1 forces reduced motion, and under it the fish does not move
           by design. Leave it on and the swim log reads twelve identical
           rows, which proves nothing at all about whether the fish swims.
           Assigning RM.matches=false does NOT work: on a MediaQueryList that
           property is a read-only accessor, so the write is silently dropped
           in sloppy mode. The whole binding has to be replaced. */
        RM={matches:false};
        cat.x=3394;
        view.camX=Math.max(0,Math.min(Math.max(0,WORLD_W-view.viewW), 3394-CAT_SX));
        frame(performance.now());
        var fy0=Math.round((FISH_Y+view.destY)*view.S);
        var n=0, sx=0;
        for(var y=Math.max(0,fy0-14); y<Math.min(view.vh,fy0+16); y++){
          var row=view.ctx.getImageData(0,y,view.vw,1).data;
          for(var x=0;x<view.vw;x++){
            var p=[row[x*4],row[x*4+1],row[x*4+2]];
            if(Math.abs(p[0]-74)<=3&&Math.abs(p[1]-118)<=3&&Math.abs(p[2]-145)<=3){ n++; sx+=x; }
          }
        }
        mv.push(Math.round(fish.x)+'/'+n+'/'+(n?Math.round(sx/n):-1));
        if(mv.length>=12){
          clearInterval(iv);
          var f=document.getElementById('swim');
          if(f) f.textContent='SWIM x/n/cx per frame: '+mv.join(' ');
        }
      },160);
      var sp=document.createElement('div');
      sp.id='swim';
      sp.style.cssText='position:fixed;left:0;top:0;z-index:1000000;background:#ffe;'
        +'color:#000;font:12px/1.4 monospace;padding:2px 6px';
      sp.textContent='SWIM (collecting)';
      /* NOT a child of el: show() does el.textContent=s, which would wipe
         out every child element on each of its three calls and the swim log
         would silently vanish after the first frame */
      document.body.insertBefore(sp, el);
      if(0){ var fd0=document.createElement('div');
      fd0.id='fore';
      fd0.style.cssText='position:fixed;left:0;top:19px;z-index:1000000;background:#efe;'
        +'color:#000;font:12px/1.4 monospace;padding:2px 6px';
      if(0) document.body.insertBefore(fd0, el);
    }
    /* Blow the fish's neighbourhood straight out of the canvas, 3x, and
       paste it into the page. Freezing the loop is not enough: headless
       fires a resize during capture, and assigning canvas.width wipes the
       bitmap, so a paused loop leaves a blank frame on screen while the
       numeric read (taken moments earlier) still shows the fish. Copying
       the pixels out at the moment they were read is the only way for the
       screenshot and the numbers to describe the same frame. */
    (function(){
      var fU2=Math.max(1,Math.round(view.S));
      var cx2=Math.round((fish.x-view.camX)*view.S)+2*fU2;
      var cy2=Math.round((FISH_Y+view.destY)*view.S)+2*fU2;
      var MW=150, MH=48, ZM=3;
      var d=document.createElement('canvas');
      d.width=MW*ZM; d.height=MH*ZM;
      var dc=d.getContext('2d');
      dc.imageSmoothingEnabled=false;
      dc.drawImage(view.cv, cx2-MW/2, cy2-MH/2, MW, MH, 0, 0, MW*ZM, MH*ZM);
      var im=document.createElement('img');
      im.src=d.toDataURL();
      im.style.cssText='position:fixed;left:16px;top:150px;z-index:999998;'
        +'width:'+(MW*ZM)+'px;height:'+(MH*ZM)+'px;'
        +'image-rendering:pixelated;border:2px solid #fff';
      document.body.appendChild(im);
      el.insertAdjacentElement('afterend', im);
    })();
    paused=true;

    var fU=Math.max(1,Math.round(view.S));
    var fox=Math.round((fish.x-view.camX)*view.S);
    var foy=Math.round((FISH_Y+view.destY)*view.S);
    function vp(x,y){
      if(x<0||y<0||x>=view.vw||y>=view.vh) return 'offscr';
      var q=view.ctx.getImageData(x,y,1,1).data;
      return ('#'+((1<<24)+(q[0]<<16)+(q[1]<<8)+q[2]).toString(16).slice(1));
    }
    var fs='';
    for(var fi=-3;fi<=5;fi++) fs+=fi+':'+vp(fox+fi*fU, foy+2*fU)+' ';
    L.push('FISH box='+FISH_X0+'..'+FISH_X1+' y='+FISH_Y+' shoreY='+SHORE_Y
      +' waterX='+(3*ZONE_W+540)+' onLand='+(fish.x<3*ZONE_W+570)
      +' x='+Math.round(fish.x)+' dir='+fish.dir
      +' | camX='+Math.round(view.camX)+' vw='+view.vw+' S='+view.S
      +' | devX='+fox+' devY='+foy+' | row '+fs
      +' | water='+vp(fox+14*fU, foy+6*fU));

    /* --- 7. the foreground layer. FORE_LAMPS is a local var inside
       buildWorld(), so the probe cannot ask the page where it thinks the
       lamps are — asking is exactly the thing that can be wrong. Scan the
       fore canvas for non-transparent columns instead: those are the lamps,
       whatever the code believes about them. --- */
    var fc=view.world.fore.getContext('2d');
    var runs=[], inRun=false, runStart=0;
    for(var x2=0;x2<view.world.fore.width;x2++){
      var a2=fc.getImageData(x2,145,1,1).data[3];
      if(a2>0 && !inRun){ inRun=true; runStart=x2; }
      else if(a2===0 && inRun){ inRun=false; if(x2-runStart>=4) runs.push(runStart+'-'+(x2-1)); }
    }
    if(inRun) runs.push(runStart+'-end');
    L.push('FORE w='+view.world.fore.width+' pillarRuns@145: '+runs.join(' '));
    var fd=document.getElementById('fore');
    if(fd) fd.textContent='FORE w='+view.world.fore.width+'  pillars@145: '+runs.join(' ');
    /* Dump a slice of the fore layer so the hand-placed lamp coordinates can
       be checked against the artwork itself instead of against a guess about
       where the camera was when the screenshot happened. */
    if(0)(function(){
      var d=document.createElement('canvas');
      var X=1200, Y=120, W=1500, H=90, ZM=1;
      d.width=W*ZM; d.height=H*ZM;
      var dc=d.getContext('2d');
      dc.fillStyle='#101018'; dc.fillRect(0,0,d.width,d.height);
      dc.drawImage(view.world.fore, X, Y, W, H, 0, 0, W*ZM, H*ZM);
      var im=document.createElement('img');
      im.src=d.toDataURL();
      if(0){ im.style.cssText='position:fixed'; document.body.appendChild(im); }
    })();

    /* --- 8. the cat's wander. The complaint was "it sits down and never
       moves again", which is exactly what the old state machine did: idle
       past 16 set asleep=true and NOTHING ever cleared it except human
       input. Headless gives 2-3 rAF frames, so drive frame() from a timer
       with a synthetic clock and log the state; a stuck cat is invisible
       in a single screenshot. */
    if(!window.__mv2){
      window.__mv2=true;
      var wlog=[], t0=0, lastAsp=null, nxt=0;
      var iv2=setInterval(function(){
        t0+=80;
        lastT=0;                      /* frame() derives dt from lastT */
        try{ frame(t0); }
        catch(e3){ wlog.push('THROW@'+Math.round(t0/1000)+':'+e3.message); clearInterval(iv2);
          window.__wlog=wlog.join(' '); show(); return; }
        var st = cat.asleep?'NAP':(cat.patrol===null?'rest':(cat.moving?'walk':'?'));
        if(st!==lastAsp){ wlog.push(Math.round(t0/1000*10)/10+'s:'+st+'@'+Math.round(cat.x)); lastAsp=st; }
        if(t0>=5600){ clearInterval(iv2);
          window.__wlog=wlog.join(' ')+' | turns='+wlog.length;
          var big=document.createElement('pre');
          big.style.cssText='position:fixed;left:0;top:120px;right:0;z-index:9999999;'
            +'margin:0;padding:14px;background:#ffff00;color:#000;'
            +'font:15px/1.5 monospace;white-space:pre-wrap;border:3px solid #000';
          big.textContent='WANDER  '+window.__wlog;
          document.body.insertBefore(big, document.body.firstChild);
          try{ show(); }catch(e2){}
        }
        void nxt;
      },80);
      if(0){ var wd0=document.createElement('div');
      wd0.id='walk';
      wd0.style.cssText='position:fixed;left:0;top:38px;z-index:1000000;background:#eef;'
        +'color:#000;font:11px/1.35 monospace;padding:2px 6px;max-width:1500px';
      if(0) document.body.insertBefore(wd0, el);
    }

    var s='ERRORS='+errs.length+(errs.length?(' :: '+errs.join(' ;; ')):'')
      +' | '+L.join(' | ');
    put(s);
  }
  function wallTopPx(){ return GROUND-80+32; }
  function go(tag){
    try{ show(); }
    catch(err){ put('THROW('+tag+'): '+err.message); }
  }
  (function tick(){ requestAnimationFrame(function(){ requestAnimationFrame(go.bind(null,'raf')); }); })();
  setTimeout(function(){ go('t600'); },600);
  setTimeout(function(){ go('t1800'); },1800);
})();
</script>
'@

$i = $txt.LastIndexOf('</body>')
if($i -lt 0){ throw 'no </body>' }
$out = $txt.Substring(0,$i) + $probe + $txt.Substring($i)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Dst, $out, $enc)
Write-Output ("pix probe -> {0}" -f $Dst)
