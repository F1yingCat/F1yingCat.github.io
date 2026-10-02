param(
  [string]$Src = 'C:\WorkFiles\blog\static\index.html',
  [string]$Dst = 'C:\WorkFiles\blog\out\probe-final.html'
)
$ErrorActionPreference='Stop'
$txt = [System.IO.File]::ReadAllText($Src, [System.Text.Encoding]::UTF8)

# ASCII-only anchors on purpose: PS 5.1 reads a no-BOM .ps1 as ANSI/GBK and
# mangles non-ASCII, which silently breaks every .Replace below.
$find = "cat.x=zi*ZONE_W+SCENE_W/2;"
if($txt.IndexOf($find) -lt 0){ throw 'deep-link anchor not found' }
$repl = "var mcx=String(location.search||'').match(/[?&]cx=(\d+)/);" +
        "cat.x=mcx?parseInt(mcx[1],10):zi*ZONE_W+SCENE_W/2;"
$txt = $txt.Replace($find, $repl)

$probe = @'
<script>
(function(){
  var errs=[], N=0, started=false, el=null;
  /* Headless 只在截图那一刻出帧，中间的 rAF 和 CSS transition 都不会推进，
     于是引线的 .22s 淡入永远停在 opacity:0——截图artifact，不是页面 bug。
     这里把过渡关掉，让终态直接落到画面上 */
  var st=document.createElement('style');
  st.textContent='.leader,.leaderStem,.leaderDot{transition:none!important}';
  document.head.appendChild(st);
  window.addEventListener('error',function(e){ errs.push('onerror: '+e.message); });
  var oe=console.error, ow=console.warn;
  console.error=function(){ errs.push('console.error: '+[].join.call(arguments,' ')); oe.apply(console,arguments); };
  console.warn =function(){ errs.push('console.warn: '+[].join.call(arguments,' ')); ow.apply(console,arguments); };
  function show(){
    N++;
    var ld=[], i, g, kids;
    kids=document.getElementById('leaders').children;
    for(i=0;i<kids.length;i++){
      var L=kids[i].children[0], r=L.getBoundingClientRect();
      ld.push(kids[i].dataset.lead+'['+Math.round(r.left)+','+Math.round(r.top)
        +' '+Math.round(r.width)+'x'+Math.round(r.height)
        +' op='+getComputedStyle(L).opacity+']');
    }
    var pw=[], pv=[];
    for(i=0;i<4;i++){
      var e=document.getElementById('p'+i);
      pw.push(Math.round(e.offsetLeft)+'/'+Math.round(e.offsetTop)
             +'/'+e.offsetWidth+'x'+e.offsetHeight);
      pv.push(e.style.opacity+'/'+e.style.visibility);
    }
    var s='frames='+N
      +' | ERRORS='+errs.length+(errs.length? ' :: '+errs.join(' ;; ') : '')
      +' | cat.x='+Math.round(cat.x)+' zone='+zoneOf(cat.x)
      +' S='+view.S+' vw='+view.vw+' vh='+view.vh
      +' camX='+Math.round(view.camX)
      +' | narrow='+(view.vw<=860)
      +' | leaders=['+ld.join(',')+']'
      +' | panelBox=['+pw.join(' | ')+']'
      +' | panelOp=['+pv.join(' | ')+']';
    if(!el){
      el=document.createElement('pre');
      el.style.cssText='position:fixed;left:0;top:0;right:0;margin:0;padding:6px 9px;'
        +'background:#fff;color:#000;font:12px/1.35 monospace;z-index:99999;white-space:pre-wrap';
      document.body.appendChild(el);
    }
    el.textContent=s;
  }
  function tick(){ if(started) return; started=true; show(); requestAnimationFrame(show); }
  requestAnimationFrame(tick);
  setTimeout(function(){ if(!started) tick(); }, 200);
  setTimeout(show, 1500);
})();
</script>
'@

$i = $txt.LastIndexOf('</body>')
if($i -lt 0){ throw 'no </body>' }
$out = $txt.Substring(0,$i) + $probe + $txt.Substring($i)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Dst, $out, $enc)
Write-Output ("final probe -> {0}" -f $Dst)
