$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Site pixel cat, same rect geometry as the inline data: URI favicon in
# index.html / tag.html / post/*.html. Rendered at an integer 2x into a 32x32
# PNG, used as the RSS channel <image>: feed readers want a real fetchable
# URL and will not render an inline data: URI.
# NOTE: this file is deliberately ASCII-only. PowerShell 5.1 reads a BOM-less
# .ps1 as ANSI, and CJK comments in here corrupt the parse.
# If the cat art changes, update the data: URI in the four page heads too.
$RECTS = @(
  @(0,  0, 16, 16, '#14121c'),
  @(4,  2,  2,  2, '#ef7c2a'),
  @(10, 2,  2,  2, '#ef7c2a'),
  @(3,  3, 10,  8, '#ef7c2a'),
  @(4,  6,  2,  2, '#14121c'),
  @(10, 6,  2,  2, '#14121c'),
  @(6,  9,  4,  4, '#ef7c2a')
)

$scale = 2
$dim   = 16 * $scale
Write-Host "scale=$scale dim=$dim"

$out = 'C:\WorkFiles\blog\static\assets\cat.png'
$bmp = New-Object System.Drawing.Bitmap -ArgumentList $dim, $dim
try {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    # Kill interpolation and antialiasing outright: this is the one step
    # that would silently turn a pixel grid into mush.
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::None
    $g.CompositingMode   = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#14121c'))
    foreach ($r in $RECTS) {
      $col = [System.Drawing.ColorTranslator]::FromHtml($r[4])
      $br  = New-Object System.Drawing.SolidBrush -ArgumentList $col
      try {
        $g.FillRectangle($br, ([int]$r[0]*$scale), ([int]$r[1]*$scale), ([int]$r[2]*$scale), ([int]$r[3]*$scale))
      } finally { $br.Dispose() }
    }
  } finally { $g.Dispose() }
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $bmp.Dispose() }

$fi = New-Object System.IO.FileInfo -ArgumentList $out
Write-Host "wrote $($fi.FullName)  $($fi.Length) B  $($dim)x$($dim)"
