$ErrorActionPreference = 'Stop'

# Replace one line range in a UTF-8 / LF file, by 1-based line number.
# Line-range replacement beats string matching here: the target comment blocks
# contain full-width CJK punctuation, and repeated exact-string edits kept
# failing on invisible differences even though the visible text was identical.
#
# Usage: replacelines.ps1 <file> <start> <end> <utf8 newlines file|->

$ErrorActionPreference = 'Stop'

$path    = $args[0]
$start   = [int]$args[1]
$end     = [int]$args[2]
$newFile = $args[3]

$enc = New-Object System.Text.UTF8Encoding($false)   # no BOM, matching the site files
$lines = [System.IO.File]::ReadAllLines($path, $enc)
$new   = if ([string]::IsNullOrEmpty($newFile)) { @() } else { [System.IO.File]::ReadAllLines($newFile, $enc) }

if ($start -lt 1 -or $end -gt $lines.Length -or $start -gt $end) {
  throw "bad range $start..$end (file has $($lines.Length) lines)"
}

$out = @()
$out += $lines[0..($start - 2)]
$out += $new
if ($end -lt $lines.Length) { $out += $lines[$end..($lines.Length - 1)] }

$text = ($out -join "`n") + "`n"
[System.IO.File]::WriteAllText($path, $text, $enc)

Write-Host "replaced lines $start..$end with $($new.Count) line(s); file now $((Get-Item $path).Length) bytes"
