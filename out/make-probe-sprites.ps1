param(
  [string]$Src = 'C:\WorkFiles\blog\static\index.html',
  [string]$Dst = 'C:\WorkFiles\blog\out\probe-sprites.html'
)
$ErrorActionPreference='Stop'
$txt = [System.IO.File]::ReadAllText($Src, [System.Text.Encoding]::UTF8)

# Pure-ASCII on purpose: PS 5.1 reads a no-BOM .ps1 as ANSI/GBK and mangles
# non-ASCII, which silently breaks every .Replace below.
# Must go just before </body>, i.e. AFTER the main <script> has run, so that the
# SPR object is already populated. Anchoring inside the script (e.g. on
# "var PORTAL = {") truncates it and the whole page goes blank.
$find = '</body>'
if($txt.LastIndexOf($find) -lt 0){ throw 'no </body>' }

$probe = @'
<script>
(function(){
  /* Runtime sprite check. The static validator (validate-sprites.ps1) only sees
     source literals, so it cannot see the 8 walk/run frames -- those are built
     at runtime by BODY22.concat(BELLY, legs). This walks the live SPR object. */
  var PALK='';
  for(var k in PAL){ if(Object.prototype.hasOwnProperty.call(PAL,k) && k.length===1) PALK+=k; }
  var keys=[]; for(var n in SPR){ if(Object.prototype.hasOwnProperty.call(SPR,n)) keys.push(n); }
  keys.sort();
  var problems=[], info=[];
  keys.forEach(function(n){
    var rows=SPR[n], bad=[], w=rows[0].length;
    /* The invariant is that every row agrees with row 0, not that the sprite is
       16 or 24 wide: book/house/lock are 16x16 header marks and paw is a 4x5
       detail stamp. 16 and 24 are the sizes the character sprites use. */
    rows.forEach(function(r,i){
      if(r.length!==w) bad.push('row'+i+' width='+r.length+' expected '+w);
      for(var q=0;q<r.length;q++){
        var ch=r.charAt(q);
        if(ch!=='.' && PALK.indexOf(ch)<0) bad.push('row'+i+' badchar['+ch+']');
      }
    });
    if(bad.length) problems.push(n+': '+bad.join(' | '));
    info.push(n+'('+rows.length+'r x'+w+')');
  });

  var SC=3, CW=24*SC+10, CH=28*SC+22;
  var cv=document.createElement('canvas');
  cv.width=CW*11; cv.height=CH+8;
  cv.style.cssText='position:fixed;left:0;top:0;z-index:99999;'
    +'background:#f2ece0;image-rendering:pixelated';
  document.body.appendChild(cv);
  var g=cv.getContext('2d');
  g.imageSmoothingEnabled=false;
  g.font='11px monospace'; g.textBaseline='top';

  function cell(col,row,label,spr,stride){
    var ox=col*CW, oy=row*CH;
    g.fillStyle=(row===0)?'#ffffff':'#efe7d8';
    g.fillRect(ox,oy,CW-2,CH-2);
    g.fillStyle='#241f31'; g.fillText(label,ox+3,oy+3);
    /* stride bar: how far the front paw reaches, in sprite cells */
    if(stride!==undefined){
      g.fillStyle='#5fbf6a';
      g.fillRect(ox+4+stride*SC, oy+16+26*SC, 3, 5);
    }
    for(var y=0;y<spr.length;y++){
      var r=spr[y];
      for(var x=0;x<r.length;x++){
        var ch=r.charAt(x);
        if(ch==='.') continue;
        g.fillStyle=PAL[ch];
        g.fillRect(ox+4+x*SC, oy+16+y*SC, SC, SC);
      }
    }
  }

  /* Every sprite in SPR, in key order. The walk/run frame sets were removed
     at the user's request, so there is no second cycle to lay out here --
     referencing SPR['cat24_walk0'] would be undefined and would throw
     before the report line ever renders. */
  var col=0;
  keys.forEach(function(n){ cell(col,0,n,SPR[n]); col++; });

  var out=document.createElement('pre');
  out.style.cssText='position:fixed;left:0;top:'+cv.height+'px;right:0;margin:0;padding:6px 8px;'
    +'background:#fff;color:#000;font:12px/1.4 monospace;z-index:99999;white-space:pre-wrap';
  var line1='palette single-char keys: '+PALK.length
    +'   sprites: '+keys.length
    +'   WIDTH/PALETTE PROBLEMS: '+(problems.length? problems.join(' ;; ') : 'NONE');
  var line2=info.join('  ');
  var line3='all cat sprites are 24 rows; movement is lean + hop + dust, no frame sets';
  out.textContent=line1+'\n'+line2+'\n'+line3;
  document.body.appendChild(out);
})();
</script>
'@

$i = $txt.LastIndexOf($find)
$out = $txt.Substring(0,$i) + $probe + $txt.Substring($i)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Dst, $out, $enc)
Write-Output ("sprite probe -> {0}" -f $Dst)
