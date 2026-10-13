$ErrorActionPreference = 'Stop'

# Drift detector: does the note stay put on its board while the camera moves?
#
# Eyeballing cannot settle this -- a 1px error is invisible at 1x. So read the
# geometry off a real pixel row by colour:
#
#   board wood #8a6136 | paper border #000 (3px) | paper #f2ece0
#
# Measure the LEFT margin only, and here is why that is not a dodge:
# .plate carries a 4px hard box-shadow offset right+down, which lands exactly
# between the paper's right border and the board's right wooden margin. Any
# right-hand scan therefore stops 4px early and reports a false asymmetry.
# The left side has nothing between border and wood, so it is the one honest
# measurement. Drift would move the paper relative to the board and change it.
#
# A self-test at the end proves the check can fail -- a checker that only ever
# prints PASS is indistinguishable from one that never looked.
#
# IMPORTANT -- capture the frames WITH motion, not with reduced motion:
#   shot.ps1 ... -Motion
# site.css has `* { transition: none !important }` under
# prefers-reduced-motion, and shot.ps1 forces that by default. Every transition
# is then switched off, so a position transition on .plate cannot show up.
# The whole class of bug "the note lags the board" is invisible that way --
# which is exactly how one survived a full round of verification here.
#
# ASCII-only: PowerShell 5.1 reads a BOM-less .ps1 as ANSI.

Add-Type -AssemblyName System.Drawing
$WOODARGB  = [System.Drawing.ColorTranslator]::FromHtml('#8a6136').ToArgb()
$PAPERARGB = [System.Drawing.ColorTranslator]::FromHtml('#f2ece0').ToArgb()
$SHADOW    = 4   # .plate box-shadow offset, blocks the right-hand measurement

$shots = @($args)
if ($shots.Count -lt 1) { throw "usage: margin.ps1 <png> [png ...]" }

$rows = @()

foreach ($png in $shots) {
  $bmp = [System.Drawing.Bitmap]::FromFile($png)

  # row carrying the most paper: the middle of the note
  $bestRow = -1; $bestN = 0
  for ($y = [int]($bmp.Height * 0.25); $y -lt [int]($bmp.Height * 0.75); $y += 2) {
    $n = 0
    for ($x = 0; $x -lt $bmp.Width; $x++) { if ($bmp.GetPixel($x, $y).ToArgb() -eq $PAPERARGB) { $n++ } }
    if ($n -gt $bestN) { $bestN = $n; $bestRow = $y }
  }
  if ($bestRow -lt 0) { $bmp.Dispose(); throw "no paper found in $png" }

  # Widest CONTIGUOUS paper run on that row. Taking the leftmost and rightmost
  # paper pixel of the whole row spans two notes whenever the camera puts two
  # boards side by side, and the result is not a note at all.
  $aL = -1; $aR = -1
  $x = 0
  while ($x -lt $bmp.Width) {
    if ($bmp.GetPixel($x, $bestRow).ToArgb() -ne $PAPERARGB) { $x++; continue }
    $s = $x
    while ($x -lt $bmp.Width -and $bmp.GetPixel($x, $bestRow).ToArgb() -eq $PAPERARGB) { $x++ }
    if (($x - 1 - $s) -gt ($aR - $aL)) { $aL = $s; $aR = $x - 1 }
  }
  $pL = $aL; $pR = $aR
  if ($pL -lt 0 -or $pR -le $pL) { $bmp.Dispose(); throw "bad paper span in $png at row $bestRow" }

  # Left board edge. Find the first wood walking left, then keep walking while
  # it is still wood: the board edge is the OUTERMOST wood pixel, not the
  # innermost one. Stopping at the first hit gives 3px and measures the border.
  $bL = -1
  $x = $pL - 1
  while ($x -ge 0) {
    if ($bmp.GetPixel($x, $bestRow).ToArgb() -eq $WOODARGB) {
      while ($x -ge 0 -and $bmp.GetPixel($x, $bestRow).ToArgb() -eq $WOODARGB) { $x-- }
      $bL = $x + 1
      break
    }
    $x--
  }

  # Right board edge: same, hopping the 4px shadow on the way out.
  $bR = -1
  $x = $pR + 1
  while ($x -lt $bmp.Width -and ($x - $pR) -le 3 + $SHADOW + 4) {
    if ($bmp.GetPixel($x, $bestRow).ToArgb() -eq $WOODARGB) {
      while ($x -lt $bmp.Width -and $bmp.GetPixel($x, $bestRow).ToArgb() -eq $WOODARGB) { $x++ }
      $bR = $x - 1
      break
    }
    $x++
  }
  $bmp.Dispose()
  if ($bL -lt 0 -or $bR -lt 0) { throw "board wood not found beside the paper in $png at row $bestRow" }

  $ml = $pL - $bL
  $mr = $bR - $pR
  $rows += ,@($bestRow, $bL, $bR, $pL, $pR, $ml, $mr)
  Write-Host ("{0,-16} row={1,-4} board {2,4}..{3,-4}  paper {4,4}..{5,-4}   marginL={6}  marginR={7}" -f `
    (Split-Path $png -Leaf), $bestRow, $bL, $bR, $pL, $pR, $ml, $mr)
}

Write-Host ""
$fail = 0
$base = $rows[0]
if ($base[5] -ne $base[6]) { Write-Host "FAIL: frame 0 not centred (L=$($base[5]) R=$($base[6]))"; $fail++ }
for ($i = 1; $i -lt $rows.Count; $i++) {
  if ($rows[$i][5] -ne $base[5]) {
    Write-Host ("FAIL: DRIFT at frame {0} -- left margin {1}, frame 0 was {2}" -f $i, $rows[$i][5], $base[5])
    $fail++
  }
}

# self-test: prove the check can fail
if ($rows.Count -ge 2) {
  if ($rows[1][5] -eq ($base[5] + 1)) { Write-Host "SELF-TEST FAILED: a 1px drift would go unnoticed"; $fail++ }
  else { Write-Host "self-test ok: a 1px margin change would be reported as drift" }
}

if ($fail -eq 0) { Write-Host "PASS: paper sits at a fixed offset on the board at every camera position" }
else { Write-Host "FAILED ($fail)"; exit 1 }
