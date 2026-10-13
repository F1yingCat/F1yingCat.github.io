$ErrorActionPreference = 'Stop'

# Internal link checker for the non-market pages.
# Resolves every relative href/src in the given pages against the deployed
# tree (docs/) and reports anything that does not land on a real file.
# ASCII-only on purpose: PowerShell 5.1 reads a BOM-less .ps1 as ANSI.

$root = 'C:\WorkFiles\blog\docs'

# Pull the real page names off disk rather than typing them, so the CJK
# filename stays out of this file.
$pages = @()
foreach ($d in @('post')) {
  $pages += Get-ChildItem (Join-Path $root $d) -Filter '*.html' | ForEach-Object {
    $_.FullName.Substring($root.Length + 1)
  }
}
$pages += @('index.html', 'tag.html', 'MarketViewer.html')

$seen  = New-Object System.Collections.Generic.HashSet[string]
$bad   = New-Object System.Collections.Generic.List[string]
$total = 0

foreach ($rel in $pages) {
  $full = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $full)) { $bad.Add("MISSING PAGE  $rel"); continue }
  $html = Get-Content -LiteralPath $full -Raw -Encoding UTF8
  $dir  = Split-Path -Parent $full
  foreach ($m in [regex]::Matches($html, '(?:href|src)\s*=\s*"([^"]+)"')) {
    $u = $m.Groups[1].Value
    if ($u -match '^(https?:|data:|mailto:|#|//)') { continue }
    # Skip JS concatenation fragments such as href="' + c.href + '".
    # Those are code, not URLs; treating them as links produces pure noise.
    if ($u -match "[+`$']") { continue }
    $u = ($u -split '#')[0]
    if ([string]::IsNullOrWhiteSpace($u)) { continue }
    $total++
    $target = [System.IO.Path]::GetFullPath((Join-Path $dir $u))
    $key = "$rel -> $u"
    [void]$seen.Add($key)
    if (-not (Test-Path -LiteralPath $target)) { $bad.Add("DEAD LINK    $key") }
  }
}

# --- pass 2: navigation targets that only exist inside JS --------------------
# Scanning HTML href/src alone is not enough. site.js builds the zone-nav and
# the bottom pip bar as `window.location.href = <something> + '#zN'`, so those
# targets never appear in any href attribute and a pass-1-only checker reports
# "ALL RESOLVE" on a build whose main navigation 404s.
#
# So: for every <script src> a page loads, pull the quoted literals that look
# like relative asset paths and resolve each one *from that page's directory*.
# A literal that is correct from / but wrong from /post/ is exactly the bug this
# pass exists to catch, and it is invisible to pass 1.
$jsChecked = 0
foreach ($rel in $pages) {
  $full = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $full)) { continue }
  $html = Get-Content -LiteralPath $full -Raw -Encoding UTF8
  $dir  = Split-Path -Parent $full
  foreach ($sm in [regex]::Matches($html, '<script[^>]+src\s*=\s*"([^"]+)"')) {
    $srel = $sm.Groups[1].Value
    if ($srel -match '^(https?:|data:|//)') { continue }
    if ($srel -match "[+`$']") { continue }
    $sabs = [System.IO.Path]::GetFullPath((Join-Path $dir $srel))
    if (-not (Test-Path -LiteralPath $sabs)) { continue }   # pass 1 already flags this
    $js = Get-Content -LiteralPath $sabs -Raw -Encoding UTF8
    # Strip comments before hunting literals. Without this, a path that is only
    # *mentioned* in a comment ("the old hardcoded 'index.html' 404s here")
    # gets reported as a live dead path -- which is exactly what happened the
    # first time this pass ran. Naive strip: a '//' inside a string literal can
    # still truncate a line. Acceptable here, since only relative asset paths
    # are of interest and those carry no scheme.
    $js = [regex]::Replace($js, '/\*.*?\*/', ' ', 'Singleline')
    $js = [regex]::Replace($js, '(?m)//[^\r\n]*', ' ')
    $jsChecked++
    $shown = [System.IO.Path]::GetFileName($sabs)
    foreach ($lm in [regex]::Matches($js, "['""]([A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:html|xml|css|js|png|svg|json))['""]")) {
      $lit = $lm.Groups[1].Value
      if ($lit -match '/assets/') { continue }   # repo-root asset, depth-independent
      $target = [System.IO.Path]::GetFullPath((Join-Path $dir $lit))
      $total++
      $key = "$rel --$shown--> $lit"
      [void]$seen.Add($key)
      if (-not (Test-Path -LiteralPath $target)) {
        $bad.Add("DEAD JS PATH  $key")
      }
    }
  }
}

Write-Host "pages checked : $($pages.Count)"
Write-Host "scripts read  : $jsChecked"
Write-Host "links resolved: $total unique=$($seen.Count)"
Write-Host "dead links    : $($bad.Count)"
$bad | ForEach-Object { Write-Host "  $_" }
if ($bad.Count -eq 0) { Write-Host "ALL INTERNAL LINKS RESOLVE" }
