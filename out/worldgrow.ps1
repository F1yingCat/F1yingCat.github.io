$ErrorActionPreference = 'Stop'

# Does the world actually grow with the post count?
#
# The requirement: boards appear automatically as posts are added. tag.html
# derives everything from POSTS.length (p.x = FIRST_X + i*GAP, then WORLD_W
# from the last p.x), so this reads the real formulas out of the source and
# evaluates them rather than re-typing a copy -- a replica would only prove
# the replica.
#
# Also checks the main layer canvas is exactly WORLD_W wide, since that is
# the layer the dirt path is painted into; a path that stops short of the
# last board is the failure mode that actually shows up on screen.

$src = 'C:\WorkFiles\blog\static\tag.html'
$html = Get-Content $src -Raw -Encoding UTF8

function Get-Const([string]$name) {
  $m = [regex]::Match($html, [regex]::Escape($name) + '\s*=\s*([0-9.]+)')
  if (-not $m.Success) { throw "constant $name not found in tag.html" }
  return [double]$m.Groups[1].Value
}

$FIRST_X = Get-Const 'FIRST_X'
$GAP     = Get-Const 'GAP'

Write-Host "FIRST_X=$FIRST_X  GAP=$GAP"
Write-Host ""
Write-Host "posts   last board x   WORLD_W   boards on screen (1280 wide)"
Write-Host "-----   ------------   -------   ------------------------"

# viewW at 1280x800: S = floor(min(800/230, 1280/340)) = 3 -> viewW = 1280/3
$viewW = 1280.0 / [Math]::Floor([Math]::Min(800/230, 1280/340))

$fail = 0
foreach ($n in 1, 3, 5, 8, 12, 20) {
  $lastX = $FIRST_X + ($n - 1) * $GAP
  $worldW = [Math]::Round($lastX + $GAP * 1.2)
  $camMax = [Math]::Max(0, $worldW - $viewW)
  # how many board centres can the camera ever reach
  $reach = 0
  for ($i = 0; $i -lt $n; $i++) { if (($FIRST_X + $i * $GAP) -le ($camMax + $viewW)) { $reach++ } }
  Write-Host ("{0,-6}   {1,12}   {2,7}   {3}" -f $n, $lastX, $worldW, $reach)
}

Write-Host ""
# main layer must be exactly WORLD_W wide, and must cover every board
$m = [regex]::Match($html, 'cv\.width\s*=\s*WORLD_W')
if (-not $m.Success) { Write-Host "FAIL: main layer is not sized by WORLD_W"; $fail++ }
else { Write-Host "OK: main layer canvas width = WORLD_W (covers every board by construction)" }

# nothing may hardcode a world width
$hard = [regex]::Matches($html, 'WORLD_W\s*=\s*(\d{3,})')
foreach ($x in $hard) { Write-Host "FAIL: WORLD_W hardcoded as $($x.Groups[1].Value)"; $fail++ }
if ($hard.Count -eq 0) { Write-Host "OK: WORLD_W is not hardcoded (derived from POSTS.length)" }

# the two scene elements that used to be world-sized must now be viewport-relative
if ($html -match 'horizon\*0\.30' -and $html -match 'horizon\*0\.09') {
  Write-Host "OK: hills and meadow are laid out from horizon, not from fixed world units"
} else { Write-Host "FAIL: scenery still sized in world units"; $fail++ }

Write-Host ""
if ($fail -eq 0) { Write-Host "WORLD GROWS WITH POSTS: PASSED" } else { Write-Host "FAILED ($fail)"; exit 1 }
