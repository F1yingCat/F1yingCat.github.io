<#
  readout.ps1 - narrow-viewport overflow check, via a screenshot you can read.

  ASCII-ONLY ON PURPOSE, same reason as the other out/*.ps1 files.

  WHY A SCREENSHOT, OF ALL THINGS
    Two facts about this machine forced the order of those choices:
      * Headless Edge on Windows will not give a viewport narrower than about
        496 CSS px whatever --window-size says. So a "360px screenshot" is a
        496px render cropped to 360, and content that looks cut off at the
        right edge is indistinguishable from content that overflows. That is
        the whole reason Round 20's "20 widths, 0 overflow" was never true.
      * --dump-dom has stopped emitting anything at all in this Edge build, and
        --dump-dom was how the value got back out of a harness page.

    What still works, reliably: a file:// page in a fixed-width iframe, the
    frame posting its numbers up with postMessage (the one channel that crosses
    a file:// opaque origin), the parent painting those numbers in large text,
    and shot.ps1 taking the picture. The numbers come back as pixels, so the
    readout is deliberately crude: one line per width, 28px, plus a colour
    change on any overflow. Read it; do not parse it. This complements
    measure.ps1, which is the one that can gate a commit.

  USAGE
    powershell -NoProfile -ExecutionPolicy Bypass -File out/readout.ps1 `
        -Page "docs/post/Origin of everything.html" -Widths 320,360,480,760,1100

  Leaves out/readout-<w>.png per width for you to look at.
#>

param(
  [string] $Page = 'docs/post/Origin of everything.html',
  [string] $Widths = '320,360,400,480,560,760,1100,1600',
  [string] $Root = 'C:\WorkFiles\blog'
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
$widthList = @($Widths -split ',' | Where-Object { $_ -ne '' } | ForEach-Object { [int]$_ })

$src = Join-Path $Root $Page
if (-not (Test-Path $src)) { throw ("no such page: " + $src) }
# The probe has to sit next to the page: "../assets/..." has to keep resolving,
# or the page loads with no stylesheet and no scripts and every number below is
# a measurement of an unstyled document.
$dir = Split-Path -Parent $src
$probePath = Join-Path $dir '_m.html'
# The iframe must point at the PROBE copy, not the original. Pointing it at the
# original renders a perfect page and reports nothing: the box sits on "waiting"
# while the screenshot below it looks completely healthy, which is exactly the
# kind of quiet wrong that gets mistaken for a tool problem.
$frameUrl = 'file:///' + ((($probePath) -replace '\\', '/') -replace ' ', '%20')

$probeJs = @'
<script>
(function () {
  var errs = [];
  window.addEventListener('error', function (e) {
    errs.push('ERR ' + (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || ''));
  });
  function report() {
    var de = document.documentElement;
    var out = ['vw=' + de.clientWidth, 'over=' + (de.scrollWidth - de.clientWidth),
               'errs=' + (errs.join(' ; ') || 'none')];
    var all = document.querySelectorAll('body *');
    var bad = 0, first = '';
    for (var i = 0; i < all.length; i++) {
      var r = all[i].getBoundingClientRect();
      if (r.right > de.clientWidth + 0.5 || r.left < -0.5) {
        if (bad === 0) first = all[i].tagName.toLowerCase() + '.' + all[i].className;
        bad++;
      }
    }
    out.push('offenders=' + bad + (first ? ' first=' + first : ''));
    var cv = document.querySelector('canvas.art');
    if (cv) out.push('art=' + cv.getAttribute('data-art') + ' css=' + cv.style.width);
    var pg = document.getElementById('pager');
    if (pg) out.push('pager=' + (pg.textContent || '(empty)'));
    try { parent.postMessage(out.join(' | '), '*'); } catch (e) {}
  }
  window.addEventListener('load', function () { setTimeout(report, 500); });
  // Post again a few times: a single post can be lost to the same
  // virtual-time race that makes the browser quit early. Repeating costs
  // nothing and makes the readout independent of when it happened to fire.
  var n = 0;
  var t = setInterval(function () { report(); if (++n >= 8) clearInterval(t); }, 400);
})();
</script>
'@

$html = [System.IO.File]::ReadAllText($src, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($probePath, ($html -replace '</body>', ($probeJs + "`n</body>")), $utf8)

# Edge writes a benign "QQBrowser user data path not found" to stderr; with
# ErrorActionPreference=Stop that would abort the run.
$ErrorActionPreference = 'Continue'
$outDir = Join-Path $Root 'out'
$harness = Join-Path $env:TEMP 'ovf-readout.html'
$errLog = Join-Path $env:TEMP 'readout-err.log'

Write-Output ('=== ' + $Page)
foreach ($w in $widthList) {
  $png = Join-Path $outDir ('readout-' + $w + '.png')
  $url = 'file:///' + (($harness -replace '\\', '/')) + '?w=' + $w + '&src=' + [System.Uri]::EscapeDataString($frameUrl)
  $ok = $false
  for ($try = 1; $try -le 3 -and -not $ok; $try++) {
    $prof = Join-Path $env:TEMP ('rprof-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    if (Test-Path $png) { [System.IO.File]::Delete($png) }
    # Sleep before EVERY launch, not just between widths.
    # The failure pattern on this machine is specific: the first headless launch
    # after a pause writes its screenshot, and every launch that follows within
    # a second or two writes nothing at all -- no error, no file. Distinct
    # --user-data-dir values do not help. It looks like the new process handing
    # itself to a browser process that is still shutting down. Two seconds of
    # nothing in between makes the whole width list come back.
    Start-Sleep -Seconds 2
    & $edge '--headless=new' '--disable-gpu' '--no-sandbox' '--hide-scrollbars' `
            '--force-device-scale-factor=1' '--window-size=1400,300' `
            ('--user-data-dir=' + $prof) '--virtual-time-budget=15000' `
            ('--screenshot=' + $png) $url *> $errLog
    # The PNG lands AFTER the browser process returns. Checking immediately
    # reports "NO IMAGE" for runs that actually produced a picture, and the
    # 3000-byte blank one that does exist is a screenshot taken before the
    # subframe painted -- so the size test alone is not enough either.
    Start-Sleep -Milliseconds 1500
    $ok = (Test-Path $png) -and ((Get-Item $png).Length -gt 8000)
    if (-not $ok -and $try -lt 3) { Start-Sleep -Seconds 2 }
  }
  $tag = if ($ok) { '  ok' } else { '  NO IMAGE' }
  Write-Output ('  w=' + $w.ToString().PadLeft(4) + ' -> ' + (Split-Path -Leaf $png) + $tag)
}

if (Test-Path $probePath) { [System.IO.File]::Delete($probePath) }
Write-Output ('probe removed: ' + (-not (Test-Path $probePath)))
