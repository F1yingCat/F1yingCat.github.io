param(
  [string]$Path,
  [string]$Out,
  [int]$Width = 390,
  [int]$Height = 900,
  [int]$DelayMs = 1200
)

$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe' }
if (-not (Test-Path $edge)) { throw 'msedge.exe not found' }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not [System.IO.Path]::IsPathRooted($Path)) { $Path = Join-Path $root $Path }
if (-not [System.IO.Path]::IsPathRooted($Out)) { $Out = Join-Path $root $Out }
$file = (Resolve-Path $Path).Path
# A space in the file name has to become %20: this repo's post pages are named
# after their titles, so "MarketViewer -shi-chang-su-lan.html" is normal, and
# passing the raw space makes the headless browser silently produce nothing.
$url = 'file:///' + (($file -replace '\\', '/') -replace ' ', '%20')
$outDir = Split-Path -Parent $Out
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$prof = Join-Path $env:TEMP ('shot-prof-' + [System.Guid]::NewGuid().ToString('N').Substring(0, 8))
$budget = [Math]::Max(500, $DelayMs)

$args = @(
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--force-prefers-reduced-motion',
  '--disable-lcd-text',
  ('--window-size={0},{1}' -f $Width, $Height),
  ('--user-data-dir=' + $prof),
  ('--virtual-time-budget=' + $budget),
  ('--screenshot=' + $Out),
  $url
)

$logFile = Join-Path $env:TEMP 'shot-stderr.log'
# Edge spits a benign "QQBrowser user data path not found" warning to stderr;
# with ErrorActionPreference=Stop that would abort us, so run the browser call in
# a relaxed scope and just park the stream in a log file.
#
# Retries: --virtual-time-budget races the page's own timers. The site runs a
# rAF loop (sprite.js) and a 1s clock interval (site.js), and when virtual time
# does not converge on the budget the browser just exits without writing the
# file. It is not a page problem -- the same URL succeeds on the next attempt --
# so a couple of retries is the whole fix. Three tries, not one, because a flaky
# screenshot tool gets ignored and then every check is skipped.
$ErrorActionPreference = 'Continue'
$ok = $false
for ($try = 1; $try -le 3 -and -not $ok; $try++) {
  & $edge @args *> $logFile
  $ok = Test-Path $Out
  if (-not $ok -and $try -lt 3) { Start-Sleep -Milliseconds 700 }
}
$ErrorActionPreference = 'Stop'
if (Test-Path $prof) { Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue }
if (-not (Test-Path $Out)) { throw "screenshot not produced: $Out" }
Write-Output ("OK {0} ({1}x{2})" -f $Out, $Width, $Height)
