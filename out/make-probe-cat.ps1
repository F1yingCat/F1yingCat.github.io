param(
  [string]$Src = 'C:\WorkFiles\blog\static\index.html',
  [string]$Dst = 'C:\WorkFiles\blog\out\probe-cat.html'
)
$ErrorActionPreference='Stop'
$txt = [System.IO.File]::ReadAllText($Src, [System.Text.Encoding]::UTF8)

# ASCII-only anchors on purpose: PS 5.1 reads a no-BOM .ps1 as ANSI/GBK and
# mangles non-ASCII, which silently breaks every .Replace below.
$find = 'cat.x=zi*ZONE_W+SCENE_W/2;'
if($txt.IndexOf($find) -lt 0){ throw 'deep-link anchor not found' }
$txt = $txt.Replace($find, 'cat.x=200;')

$probe = @'
<script>
(function(){
  /* The cat's wander, observed rather than assumed.
     The complaint was "it sits down and never moves again". The old machine
     set asleep=true once idle passed 16 and NOTHING cleared it except human
     input, so that was literally true.

     Headless emits two or three rAF frames, far too few for a wander to
     play out, so drive frame() from a timer with a synthetic clock and log
     every state transition. Drive it from day 0: there is no DOM node to
     attach to here on purpose, because every "put the text somewhere"
     attempt so far collided with the report box and hid the result. */
  var RMm=RM; RMm={matches:false};
  var log=[], t=0, prev=null, errs=[];
  window.addEventListener('error',function(e){ errs.push(e.message); });

  function state(){
    if(cat.asleep) return 'NAP';
    if(cat.patrol===null) return 'idle';
    if(Math.abs(cat.patrol-cat.x)<4) return 'SIT';
    return cat.moving?'walk':'stand';
  }
  function tick(){
    t+=100; lastT=0;
    try{ frame(t); }
    catch(e){
      log.push('THROW@'+(t/1000).toFixed(1)+'s:'+e.message);
      finish(); return;
    }
    var s=state();
    if(s!==prev){
      log.push((t/1000).toFixed(1)+'s '+s+'@'+Math.round(cat.x)
               +' tgt='+(cat.patrol===null?'-':Math.round(cat.patrol)));
      prev=s;
    }
    if(t>=9000) finish();
  }
  var done=false;
  function finish(){
    if(done) return; done=true;
    var p=document.createElement('pre');
    p.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;'
      +'margin:0;padding:18px;background:#ffe600;color:#000;overflow:auto;'
      +'font:14px/1.5 monospace;white-space:pre-wrap';
    p.textContent='CAT WANDER  (errors='+errs.length+', transitions='+log.length+')\n\n'
      +log.join('\n');
    document.body.appendChild(p);
  }
  setTimeout(function step(){ tick(); if(!done) setTimeout(step, 100); }, 100);
  setTimeout(finish, 13000);
})();
</script>
'@

$i = $txt.LastIndexOf('</body>')
if($i -lt 0){ throw 'no </body>' }
$out = $txt.Substring(0,$i) + $probe + $txt.Substring($i)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Dst, $out, $enc)
Write-Output ("cat probe -> {0}" -f $Dst)
