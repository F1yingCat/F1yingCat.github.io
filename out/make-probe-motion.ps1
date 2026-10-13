param(
  [string]$Src = 'C:\WorkFiles\blog\static\index.html',
  [string]$Dst = 'C:\WorkFiles\blog\out\probe-motion.html'
)
$ErrorActionPreference='Stop'
$txt = [System.IO.File]::ReadAllText($Src, [System.Text.Encoding]::UTF8)

# ASCII-only anchors on purpose: PS 5.1 reads a no-BOM .ps1 as ANSI/GBK and
# mangles non-ASCII, which silently breaks every .Replace below.
$find = 'cat.x=zi*ZONE_W+SCENE_W/2;'
if($txt.IndexOf($find) -lt 0){ throw 'deep-link anchor not found' }
$repl = "cat.x=3394;"
$txt = $txt.Replace($find, $repl)

$probe = @'
<script>
(function(){
  /* shot.ps1 forces prefers-reduced-motion, and under reduced motion the star
     pulse, the cloud drift, the cat hop and the fish swim are all zeroed on
     purpose. So every settled capture of this page shows the STILL state and
     cannot prove any of that motion exists. This probe turns reduced motion
     off and records per-frame values so the motion is actually observable. */
  var RMm=RM;
  RMm.matches=false;

  var errs=[], rows=[], started=false, el=null;
  window.addEventListener('error',function(e){ errs.push('onerror: '+e.message); });
  var oe=console.error; console.error=function(){ errs.push('E: '+[].join.call(arguments,' ')); oe.apply(console,arguments); };

  var CTX=view.ctx;
  function near(p,r,g,b){ return Math.abs(p[0]-r)<=3 && Math.abs(p[1]-g)<=3 && Math.abs(p[2]-b)<=3; }

  /* Every colour the fish is drawn with, and nothing the water is drawn with.
     Water tops out at (34,67,92); the fish starts at (42,81,112). A 3-unit
     window keeps the two sets from ever overlapping, so a non-zero count
     means fish pixels and not "the sea happens to match". */
  var FISHC=[ [42,81,112],[43,84,112],[74,118,145],[49,96,126],[39,81,110],[111,154,181],[25,45,74] ];
  function isFish(p){
    for(var i=0;i<FISHC.length;i++) if(near(p,FISHC[i][0],FISHC[i][1],FISHC[i][2])) return true;
    return false;
  }

  function sample(){
    var W=view.vw, H=view.vh;
    var top=Math.round((FISH_Y+view.destY)*view.S)-14;
    var bot=Math.round((FISH_Y+view.destY)*view.S)+16;
    var n=0, sx=0, minx=1e9, maxx=-1;
    /* stars and clouds, the previous regression targets, stay in the report */
    var b2=0, b1=0, cl=0, clFirst=-1;
    for(var yy=Math.max(0,top); yy<Math.min(H,bot); yy++){
      var row=CTX.getImageData(0,yy,W,1).data;
      for(var xx=0; xx<W; xx++){
        var p=[row[xx*4],row[xx*4+1],row[xx*4+2]];
        if(isFish(p)){ n++; sx+=xx; if(xx<minx)minx=xx; if(xx>maxx)maxx=xx; }
      }
    }
    for(var y2=40; y2<H; y2+=3){
      var r2=CTX.getImageData(0,y2,W,1).data;
      for(var x2=0; x2<W; x2++){
        var q=[r2[x2*4],r2[x2*4+1],r2[x2*4+2]];
        if(near(q,255,250,240)) b2++;
        else if(near(q,138,143,153)) b1++;
        else if(near(q,59,52,87)||near(q,51,45,75)||near(q,40,34,57)||near(q,33,28,48)){
          cl++; if(clFirst<0) clFirst=x2;
        }
      }
    }
    return {
      t:Math.round(performance.now()),
      fx:Math.round(fish.x), dir:fish.dir, j:+fish.j.toFixed(2),
      tail:Math.floor(performance.now()*(fish.j>0?0.023:0.011))%2,
      n:n, cx:(n?Math.round(sx/n):-1), min:minx, max:maxx,
      b2:b2, b1:b1, cl:cl, clFirst:clFirst
    };
  }

  function tick(){
    if(started) return; started=true;
    /* Park the cat at the water's edge and put the camera where it belongs.
       Headless only produces two or three rAF frames, so the camera easing
       never lands and the fish would be culled off screen for the whole run.
       Driving frame() from a timer keeps it advancing and makes the camera
       steady, so what the numbers report is the fish and not the camera. */
    var iv=setInterval(function(){
      cat.x=3394;
      view.camX=Math.max(0,Math.min(Math.max(0,WORLD_W-view.viewW), 3394-CAT_SX));
      frame(performance.now());
      rows.push(sample());
      if(rows.length>=20){ clearInterval(iv); show(); }
    }, 160);
    setTimeout(function(){ clearInterval(iv); show(); }, 6000);
  }
  function show(){
    if(!el){
      el=document.createElement('pre');
      el.style.cssText='position:fixed;left:0;top:0;right:0;margin:0;padding:6px 9px;'
        +'background:#fff;color:#000;font:11px/1.35 monospace;z-index:99999;white-space:pre';
      document.body.appendChild(el);
    }
    var head='RM.matches='+RM.matches+' (forced false)  frames='+rows.length
      +'  errors='+errs.length+(errs.length? ' :: '+errs.join(' ;; ') : '')
      +'\nFish pixels read off the live canvas; centroid must MOVE and the count must stay > 0.'
      +'\nt    fishX d jump tail |  fishPx   centroid  [min-max]  starHi/Lo cloudPx@x0';
    el.textContent=head+'\n'+rows.map(function(r){
      return String(r.t%100000).padStart(5)+' x'+String(r.fx).padStart(4)+' d'+r.dir
        +' j'+String(r.j).padStart(4)+' t'+r.tail+'  n'+String(r.n).padStart(5)
        +' cx'+String(r.cx).padStart(5)+' ['+String(r.min).padStart(4)+'-'+String(r.max).padStart(4)+']'
        +'  s'+String(r.b2).padStart(3)+'/'+String(r.b1).padStart(3)
        +' c'+String(r.cl).padStart(4)+'@'+String(r.clFirst).padStart(4);
    }).join('\n');
  }
  requestAnimationFrame(tick);
  setTimeout(function(){ if(!started) tick(); }, 200);
})();
</script>
'@

$i = $txt.LastIndexOf('</body>')
if($i -lt 0){ throw 'no </body>' }
$out = $txt.Substring(0,$i) + $probe + $txt.Substring($i)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Dst, $out, $enc)
Write-Output ("motion probe -> {0}" -f $Dst)
