<#
  measure.ps1 - horizontal overflow probe for any page under docs/.

  ASCII-ONLY ON PURPOSE, same reason as genposts.ps1 / adopt-posts.ps1.

  WHY THIS EXISTS
    Screenshots lie about width. Headless Edge on Windows refuses a viewport
    narrower than ~496 CSS px whatever --window-size says, so a "360px"
    screenshot is a 496px render cropped to 360. That is how a real 107px
    horizontal overflow in the shared HUD read as a clean page: the screenshot
    showed content running off the right edge, and the natural reading of that
    is "the screenshot is cropped" -- which is also true. Two true things,
    opposite conclusions.

  WHY IT RUNS ITS OWN HTTP SERVER
    Two dead ends, both worth writing down:
      * file:// + iframe. A file:// document is an opaque origin, so the parent
        cannot read the frame's DOM. postMessage out of the frame works, but
        --dump-dom (the only way to get the parent's title back) stopped
        emitting anything at all in this Edge build, and reading numbers off a
        screenshot is how you get a confident wrong answer.
      * --dump-dom straight from file://. Same failure, no iframe needed.
    So: serve docs/ over http on a loopback port, put the page under test in an
    iframe of the requested width, and have the frame POST its numbers back to
    the same server. Same origin, so fetch() works and the numbers arrive as
    text this script can compare.

  WHY THERE IS NO Start-Job HERE
    The first version served from a background job, and the run always hung at
    the end: the job sat in a blocking HttpListener.GetContext(), which does not
    notice a stop request, so Stop-Job waited forever after the numbers were
    already printed. A tool that prints its answer and then never exits reads as
    a broken tool, and people stop running it. Everything below is on the main
    thread: GetContextAsync with a short Wait, so the loop stays responsive to
    its own deadline, and the browser runs as a separate process we wait on.

  KNOWING WHAT "overflow" MEANS
    This reports documentElement.scrollWidth - clientWidth. On tag.html a
    non-zero value is BY DESIGN: that page is a board you pan across, its
    plates are position:absolute and placed by positionPlates(), and
    html,body carry overflow:hidden. Nothing scrolls off; the camera moves.
    Read a non-zero there as "the world is wider than the window", not as a bug.

  USAGE
    powershell -NoProfile -ExecutionPolicy Bypass -File out/measure.ps1 -Page index.html
    powershell -NoProfile -ExecutionPolicy Bypass -File out/measure.ps1 -Page "post/Origin of everything.html"

  Exits 1 if any width overflowed, so it can gate a commit.
#>

param(
  [string] $Page = 'index.html',
  # A comma-separated STRING, not [int[]]. Under `powershell -File` every
  # argument arrives as one token, so `-Widths 320 360 480` binds 320 to
  # -Widths and then pushes "360" into the next positional parameter, which is
  # -Root. The failure looks like "no such dir: 360\docs" and sends you looking
  # at the wrong thing entirely.
  [string] $Widths = '320,360,400,480,560,760,1100,1600',
  [string] $Root = 'C:\WorkFiles\blog',
  [int] $Port = 0
)

$ErrorActionPreference = 'Stop'

# Pick a free port instead of a fixed one. HttpListener registers with http.sys,
# and that registration outlives the process that made it whenever a previous
# run was killed mid-flight -- a leftover browser stays connected to the dead
# server, and the new run either fails to bind or (worse) sees its requests
# answered by a listener whose results nobody is reading. Both look exactly
# like "the page has no layout problems", which is the one answer this tool must
# never give by accident.
function Get-FreePort {
  $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $l.Start()
  $p = $l.LocalEndpoint.Port
  $l.Stop()
  return $p
}
if ($Port -le 0) { $Port = Get-FreePort }
$widthList = @($Widths -split '[,\s]+' | Where-Object { $_ -ne '' } | ForEach-Object { [int]$_ })
$utf8 = New-Object System.Text.UTF8Encoding($false)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $edge)) { throw 'msedge.exe not found' }

$docs = Join-Path $Root 'docs'
if (-not (Test-Path $docs)) { throw ("no such dir: " + $docs) }
$prefix = "http://127.0.0.1:$Port/"

# ---- payloads -------------------------------------------------------------

# Injected into whichever page is under test, only when _probe is in the query.
$probeJs = @'
<script>
(function () {
  var q = new URLSearchParams(location.search);
  if (!q.get('_probe')) return;
  var errs = [];
  window.addEventListener('error', function (e) {
    errs.push('ERR ' + (e.message || '') + ' @' +
              String(e.filename || '').split('/').pop() + ':' + (e.lineno || ''));
  });
  window.addEventListener('load', function () {
    // Post on a timer, repeatedly, instead of once.
    // --virtual-time-budget races whatever the page is doing, and a single
    // post at load+700ms lands in a different place on every run: sometimes the
    // budget is spent before the timer fires, sometimes after. Repeating it
    // makes the result independent of that race -- the server keeps whatever
    // arrived last, and there is always something.
    var n = 0;
    var send = setInterval(function () {
      var de = document.documentElement;
      var out = ['req=' + (new URLSearchParams(location.search).get('w') || '?'),
                 'vw=' + de.clientWidth, 'over=' + (de.scrollWidth - de.clientWidth),
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
      try { fetch('/__result', { method: 'POST', body: out.join(' || ') }); } catch (e) {}
      if (++n >= 20) clearInterval(send);
    }, 250);
  });
})();
</script>
'@

$harnessHtml = @'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>measure</title>
<style>html,body{margin:0;background:#000}iframe{border:0;display:block;height:2600px}</style>
</head><body>
<iframe id="f"></iframe>
<script>
var q = new URLSearchParams(location.search);
var f = document.getElementById('f');
f.style.width = (q.get('w') || '360') + 'px';
f.src = q.get('src') + '?_probe=1&w=' + (q.get('w') || '360');
</script>
</body></html>
'@

$MIME = @{
  '.html' = 'text/html; charset=utf-8';   '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8';    '.json' = 'application/json; charset=utf-8'
  '.xml'  = 'application/xml; charset=utf-8'; '.png' = 'image/png'
  '.jpg'  = 'image/jpeg';                 '.svg'  = 'image/svg+xml'
  '.woff2'= 'font/woff2';                  '.txt'  = 'text/plain; charset=utf-8'
}

# ---- run ------------------------------------------------------------------

$shotDir = Join-Path $env:TEMP 'measure-shot'
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Path $shotDir | Out-Null }
$srcEnc = [System.Uri]::EscapeDataString('/' + $Page)
$bad = 0
Write-Output ('=== ' + $Page)
# The server runs in a job and the browser is invoked directly, because that is
# the one combination where both halves are known to work on this machine:
#   * server in a job  -> keeps serving while the main thread is blocked on the
#     browser. A listener on the main thread cannot do that: you cannot both call
#     GetContext() and run Edge at the same time.
#   * browser via `&`  -> Start-Process -ArgumentList silently produced runs that
#     never loaded the page and never wrote a screenshot. Same flags, same URL,
#     no error either way. Not worth debugging; use what works.
#
# The job and the main thread share nothing but two files in TEMP. Hashtables
# and script state do not cross a runspace boundary, and the first version tried.
#
# The job is never stopped. Stop-Job on a listener parked in a blocking
# GetContext() hangs, and a tool that prints its answer and then never exits
# reads as broken. Letting the process exit takes the runspace with it.


# The job owns the results; the main thread asks for them over the same listener.
#
# IPC used to go through a file in TEMP and that was a bad idea twice over: the
# job holds the file open while writing, so the main thread's ReadAllText threw
# "being used by another process"; and a POST from a previous width could land
# after the next width had already cleared the file, so a 400px run reported the
# 360px run's numbers. A poll endpoint has neither problem -- the result lives in
# the runspace that produced it and is fetched on demand, and every payload
# carries the width it was measured at so a late one is detected, not believed.
$serverJob = Start-Job -ScriptBlock {
  param($docs, $probeJs, $harnessHtml, $MIME, $prefix)
  $ErrorActionPreference = 'Stop'
  $enc = New-Object System.Text.UTF8Encoding($false)
  $result = 'none'
  $lastReq = ''
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add($prefix)
  $listener.Start()
  while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    try {
      $url = $ctx.Request.Url
      $path = $url.AbsolutePath
      $resp = $ctx.Response
      $lastReq = [string]$url.PathAndQuery
      if ($ctx.Request.HttpMethod -eq 'POST' -and $path -eq '/__result') {
        $sr = New-Object System.IO.StreamReader($ctx.Request.InputStream, [System.Text.Encoding]::UTF8)
        $body = $sr.ReadToEnd(); $sr.Close()
        if ($body -ne '') { $result = $body }
        $resp.StatusCode = 204; $resp.Close(); continue
      }
      if ($path -eq '/__poll') {
        $payload = $result + "`n" + $lastReq
        $result = 'none'
        $b = $enc.GetBytes($payload)
        $resp.ContentType = 'text/plain; charset=utf-8'
        $resp.ContentLength64 = $b.Length
        $resp.OutputStream.Write($b, 0, $b.Length)
        $resp.Close(); continue
      }
      $bytes = $null; $type = 'application/octet-stream'
      if ($path -eq '/__harness') {
        $bytes = $enc.GetBytes($harnessHtml); $type = 'text/html; charset=utf-8'
      } else {
        $rel = [System.Uri]::UnescapeDataString($path).TrimStart('/')
        if ($rel -eq '') { $rel = 'index.html' }
        $file = Join-Path $docs ($rel -replace '/', '\')
        if (-not $file.StartsWith($docs, [System.StringComparison]::OrdinalIgnoreCase)) {
          $resp.StatusCode = 403; $resp.Close(); continue
        }
        if (Test-Path -LiteralPath $file -PathType Container) { $file = Join-Path $file 'index.html' }
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
          $resp.StatusCode = 404; $resp.Close(); continue
        }
        $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
        $type = if ($MIME.ContainsKey($ext)) { $MIME[$ext] } else { 'application/octet-stream' }
        if ($url.Query -like '*_probe*') {
          $html = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
          $bytes = $enc.GetBytes(($html -replace '</body>', ($probeJs + "`n</body>")))
          $type = 'text/html; charset=utf-8'
        } else {
          $bytes = [System.IO.File]::ReadAllBytes($file)
        }
      }
      $resp.ContentType = $type
      $resp.ContentLength64 = $bytes.Length
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
      $resp.Close()
    } catch {
      try { $ctx.Response.StatusCode = 500; $ctx.Response.Close() } catch {}
    }
  }
} -ArgumentList $docs, $probeJs, $harnessHtml, $MIME, $prefix

# Wait for the job to actually be listening, not just spawned. A raw TcpClient
# connect is the check: Test-NetConnection takes about a second per call, and at
# 40 attempts that is most of a minute spent waiting for a job that is usually
# ready in 200ms.
$listening = $false
for ($i = 0; $i -lt 40 -and -not $listening; $i++) {
  $c = New-Object System.Net.Sockets.TcpClient
  try { $c.Connect('127.0.0.1', $Port); $listening = $true } catch { $listening = $false }
  $c.Close()
  if (-not $listening) { Start-Sleep -Milliseconds 200 }
}
if (-not $listening) { Write-Output '  (server never came up)'; exit 2 }

# Edge spits a benign "QQBrowser user data path not found" warning to stderr;
# with ErrorActionPreference=Stop that would abort the run.
$ErrorActionPreference = 'Continue'
$errLog = Join-Path $env:TEMP 'measure-stderr.log'

foreach ($w in $widthList) {
  $body = 'none'
  $last = ''
  # Two launches per width. The browser intermittently exits without ever loading
  # the page -- virtual time races the frame's own timers, same as in shot.ps1 --
  # and the symptom is silence, not an error. Retrying here keeps a flaky
  # browser from reading as a layout bug, which is the worse failure: someone
  # goes hunting for a real problem that was never there.
  for ($attempt = 1; $attempt -le 2 -and $body -eq 'none'; $attempt++) {
    $prof = Join-Path $env:TEMP ('mprof-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    $shot = Join-Path $shotDir ('m' + $w + '.png')
    $url = $prefix + '__harness?w=' + $w + '&src=' + $srcEnc
    & $edge '--headless=new' '--disable-gpu' '--no-sandbox' '--hide-scrollbars' `
            '--force-device-scale-factor=1' '--window-size=1800,1000' `
            ('--user-data-dir=' + $prof) '--virtual-time-budget=12000' `
            ('--screenshot=' + $shot) $url *> $errLog

    # The browser has returned by now, but its POSTs are already in the job's
    # hands -- or are about to be, if the process quit a hair before the last
    # one went out. Poll a few times rather than reading once.
    for ($k = 0; $k -lt 6 -and $body -eq 'none'; $k++) {
      Start-Sleep -Milliseconds 400
      $req = [System.Net.HttpWebRequest]::Create($prefix + '__poll')
      $req.Timeout = 4000
      $req.ReadWriteTimeout = 4000
      $payload = 'none'
      try {
        $rd = New-Object System.IO.StreamReader($req.GetResponse().GetResponseStream(), [System.Text.Encoding]::UTF8)
        $payload = $rd.ReadToEnd(); $rd.Close()
      } catch { $payload = 'none' }
      $lines = $payload -split "`n"
      $last = if ($lines.Count -gt 1) { $lines[1] } else { '' }
      $cand = $lines[0]
      # A result has to name the width it was measured at. A browser from an
      # earlier width can still be alive and post late, and believing it is how
      # a run reports vw=320 for 360, 400 and 480 in a row -- a page that looks
      # like it stubbornly refuses to get wider. A mismatch is discarded.
      if ($cand -ne 'none' -and $cand -ne '') {
        if ($cand -match 'req=(\d+)' -and [int]$Matches[1] -eq $w) { $body = $cand }
      }
    }
    if ($body -eq 'none' -and $attempt -lt 2) { Start-Sleep -Seconds 2 }
  }

  $over = 0
  if ($body -match 'over=(-?\d+)') { $over = [int]$Matches[1] }
  $flag = ''
  if ($body -eq 'none' -or $body -eq '') {
    $why = if ($last -like ('*w=' + $w + '*')) { "browser loaded the page (last: $last) but the probe never posted" }
           elseif ($last -eq '') { 'browser never reached the server' }
           else { "browser never asked for this width (last: $last)" }
    $body = 'none'
    $flag = '   <-- PROBE NEVER REPORTED (' + $why + ')'
    $bad++
  }
  elseif ($over -ne 0) { $flag = '   <-- OVERFLOW'; $bad++ }
  Write-Output ('  w=' + $w.ToString().PadLeft(4) + '  ' + $body + $flag)
}

if ($bad -gt 0) { Write-Output ('FAIL: ' + $bad + ' of ' + $widthList.Count + ' widths'); exit 1 }
Write-Output ('OK: ' + $widthList.Count + ' widths clean')
