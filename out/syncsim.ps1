$ErrorActionPreference = 'Stop'

# Sandbox simulation of the market-viewer-sync "Sync static -> docs" step.
#
# Why simulate instead of trusting the YAML: the sync step is the only thing
# standing between a Gmeek rebuild and a silent revert of every page built in
# the pixel-night style. Gmeek rewrites docs/ wholesale on a daily schedule, so
# a path missing from this list is a page that quietly reverts overnight.
#
# The real risk is the path list, not the bash syntax -- every command is a
# plain cp. So replay the exact same list against a sandbox whose docs/ has
# been seeded with Gmeek-style garbage, and assert every synced path comes out
# byte-identical to static/.
# ASCII-only on purpose: PowerShell 5.1 reads a BOM-less .ps1 as ANSI.

$real = 'C:\WorkFiles\blog'
$sandbox = 'C:\WorkFiles\blog\out\_syncsim'

if (Test-Path $sandbox) { Remove-Item -Recurse -Force $sandbox }
New-Item -ItemType Directory -Force -Path $sandbox | Out-Null

# static/ = the real source tree
Copy-Item -Recurse "$real\static" "$sandbox\static"

# docs/ = seeded with what Gmeek leaves behind: its own template versions of
# every file, plus an extra post it invented, to prove we do not clean up after
# Gmeek (we do not -- sync only overwrites, never deletes).
$docs = "$sandbox\docs"
New-Item -ItemType Directory -Force -Path "$docs\post", "$docs\assets", "$docs\data" | Out-Null
foreach ($f in 'index.html', 'tag.html', 'rss.xml', 'MarketViewer.html') {
  Set-Content -LiteralPath "$docs\$f" -Value 'GMEEK TEMPLATE VERSION' -Encoding ASCII
}
Set-Content -LiteralPath "$docs\post\Gmeek-orphan.html" -Value 'GMEEK' -Encoding ASCII
Set-Content -LiteralPath "$docs\assets\gmeek.css" -Value 'GMEEK' -Encoding ASCII
Set-Content -LiteralPath "$docs\data\gmeek.json" -Value '{}' -Encoding ASCII

# ---- replay the workflow's cp list, line for line --------------------------
Copy-Item "$sandbox\static\index.html"       "$docs\index.html"
if (Test-Path "$sandbox\static\tag.html") { Copy-Item "$sandbox\static\tag.html" "$docs\tag.html" }
if (Test-Path "$sandbox\static\rss.xml")  { Copy-Item "$sandbox\static\rss.xml"  "$docs\rss.xml" }
if ((Test-Path "$sandbox\static\post") -and (Get-ChildItem "$sandbox\static\post" -Filter '*.html')) {
  New-Item -ItemType Directory -Force -Path "$docs\post" | Out-Null
  Get-ChildItem "$sandbox\static\post" -Filter '*.html' | ForEach-Object {
    Copy-Item $_.FullName "$docs\post\$($_.Name)" -Force
  }
}
if (Test-Path "$sandbox\static\MarketViewer.html") { Copy-Item "$sandbox\static\MarketViewer.html" "$docs\MarketViewer.html" }
if (Test-Path "$sandbox\static\assets") { Copy-Item "$sandbox\static\assets\*" "$docs\assets" -Recurse -Force }
if (Test-Path "$sandbox\static\data")   { Copy-Item "$sandbox\static\data\*"   "$docs\data"   -Recurse -Force }

# ---- assert ----------------------------------------------------------------
$fail = 0
Write-Host "=== every synced path must equal its static/ source ==="
$checks = @(
  'index.html', 'tag.html', 'rss.xml', 'MarketViewer.html',
  'post\Origin of everything.html',
  'post\Pre-market -pan-qian-su-lan.html',
  'post\hao-duo-bug-a-..html',
  'assets\site.css', 'assets\site.js', 'assets\sprite.js',
  'assets\post.js', 'assets\cat.png',
  'data\manifest.json', 'data\premarket\latest.json'
)
foreach ($rel in $checks) {
  # the CJK filename is pulled off disk rather than typed, keeping this ASCII
  $realRel = $rel
  if ($rel -like 'post\hao-duo-bug-a-*') {
    $name = (Get-ChildItem "$real\static\post" -Filter 'hao-duo-bug*').Name
    $realRel = "post\$name"
    $rel = $realRel
  }
  $a = "$sandbox\static\$realRel"
  $b = "$docs\$rel"
  if (-not (Test-Path $b)) { Write-Host "  MISSING IN DOCS  $rel"; $fail++; continue }
  $same = (Get-FileHash $a).Hash -eq (Get-FileHash $b).Hash
  if (-not $same) { $fail++ }
  $mark = if ($same) { 'OK  ' } else { 'DIFF' }
  Write-Host "  $mark  $rel"
}

Write-Host ""
Write-Host "=== Gmeek leftovers sync does NOT delete (expected, sync only overwrites) ==="
foreach ($f in 'post\Gmeek-orphan.html', 'assets\gmeek.css', 'data\gmeek.json') {
  $still = Test-Path "$docs\$f"
  Write-Host "  $(if ($still) { 'present' } else { 'GONE   ' })  $f"
}

Write-Host ""
if ($fail -eq 0) { Write-Host "SYNC SIMULATION PASSED" } else { Write-Host "SYNC SIMULATION FAILED ($fail)" ; exit 1 }
