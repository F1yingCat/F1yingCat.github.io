param(
  [Parameter(Mandatory=$true)][string]$Src,
  [Parameter(Mandatory=$true)][string]$Dst,
  [int]$X=0,[int]$Y=0,[int]$W=390,[int]$H=80,[int]$Scale=3
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$img=[System.Drawing.Image]::FromFile($Src)
try{
  $bmp=New-Object System.Drawing.Bitmap ($W*$Scale),($H*$Scale)
  try{
    $g=[System.Drawing.Graphics]::FromImage($bmp)
    try{
      $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $g.DrawImage($img,(New-Object System.Drawing.Rectangle 0,0,($W*$Scale),($H*$Scale)),
                        (New-Object System.Drawing.Rectangle $X,$Y,$W,$H),
                        [System.Drawing.GraphicsUnit]::Pixel)
    } finally { $g.Dispose() }
    $bmp.Save($Dst,[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $bmp.Dispose() }
} finally { $img.Dispose() }
Write-Output "cropped -> $Dst"
