<#
  genrss.ps1 - build rss.xml from blogBase.json.

  ASCII-ONLY ON PURPOSE, same reason as the other out/*.ps1 files.

  WHY THIS EXISTS
    rss.xml was the last hand-maintained copy of the article list. It had two
    items; the site had three. The missing one was MarketViewer, which came
    from a GitHub issue on 2026-10-02 -- so the rule was, in practice, "posts
    you wrote by hand reach the feed, posts that arrive as an issue do not".
    That is the same class of gap this round closed for the notice board, the
    archive and the article pages; the feed was the one left over.

  WHAT IS GENERATED AND WHAT IS NOT
    Generated: the <item> list and <lastBuildDate>.
    Hand-written and preserved: everything else in the file -- title, link,
    description, image, ttl. Those are prose, they change when the author
    decides to change them, and putting them in this script would mean every
    wording tweak meant editing an ASCII-only .ps1.

    So this reads the EXISTING rss.xml, keeps the text from the start of the
    file through </image> and from </channel> to the end, and replaces what lies
    between. The channel prose therefore stays editable in place, exactly like
    the hand-written pages that out/restore-docs.sh protects.

  ORDER
    Newest first. RSS readers assume that, and the hand-written file had it.
    Ties fall back to createdAt ascending so the order is total, not arbitrary.

  Local : powershell -NoProfile -ExecutionPolicy Bypass -File out/genrss.ps1
  CI    : market-viewer-sync.yml, after restore-docs.sh, before the commit.
#>

param(
  [string] $Base = 'C:\WorkFiles\blog\blogBase.json',
  # Comma-separated STRING, not [string[]]. Under `powershell -File` every
  # argument arrives as one token, so `-Out a.xml,b.xml` binds the whole
  # "a.xml,b.xml" as a single path.
  [string] $Out = 'C:\WorkFiles\blog\static\rss.xml,C:\WorkFiles\blog\docs\rss.xml'
)

# param() has to be the very first statement, so $ErrorActionPreference cannot
# go above it.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
. (Join-Path $PSScriptRoot 'lib-description.ps1')
$outList = @($Out -split ',' | Where-Object { $_ -ne '' } | ForEach-Object { $_.Trim() })
if ($outList.Count -eq 0) { throw '-Out named no files' }

# The feed's own file is its header. Read the first target.
$template = $outList[0]
if (-not (Test-Path $template)) { throw ("no such file: " + $template) }
$xml = [System.IO.File]::ReadAllText($template, [System.Text.Encoding]::UTF8)

$headEnd = $xml.IndexOf('</image>')
if ($headEnd -lt 0) { throw 'rss.xml has no </image>; refusing to guess where the header ends' }
$headEnd += '</image>'.Length
$tailStart = $xml.IndexOf('</channel>')
if ($tailStart -lt 0) { throw 'rss.xml has no </channel>' }

$head = $xml.Substring(0, $headEnd)
$tail = $xml.Substring($tailStart)

# ---- helpers --------------------------------------------------------------
# All of them are defined BEFORE the first use. Sort-Object invokes its
# expression scriptblock while it runs, so a helper declared further down the
# file is not merely "declared late" -- it does not exist yet at that moment.

# XML text-node escaping. Only & < > matter here; a title with a quote in it is
# perfectly legal as element content. & has to go first or this escapes its own
# output. Control characters are dropped because XML 1.0 cannot carry them and
# a stray 0x08 from a copied terminal would make the whole feed unparseable --
# which is a much louder failure than a missing character.
function ConvertTo-XmlText([string] $s) {
  if ($null -eq $s) { return '' }
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if     ($ch -eq '&') { [void]$sb.Append('&amp;') }
    elseif ($ch -eq '<') { [void]$sb.Append('&lt;') }
    elseif ($ch -eq '>') { [void]$sb.Append('&gt;') }
    elseif ($c -lt 32 -and $ch -ne "`t" -and $ch -ne "`n") { continue }
    else { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

# The link has to be the postUrl from blogBase, percent-encoding and all --
# the file on disk is named after the title and has a space in it, and
# https://.../post/Origin of everything.html is not a URL any reader will fetch.
function Get-PostUrl([string] $postUrl) {
  $p = [string]$postUrl
  if ($p -eq '') { return '' }
  if ($p -notmatch '^/') { $p = '/' + $p }
  return 'https://F1lyingCat.github.io' + $p
}

function Get-SortStamp($v) {
  if ($null -eq $v) { return 0.0 }
  $d = 0.0
  if ([double]::TryParse([string]$v, [ref]$d)) { return $d }
  return 0.0
}

# ---- source ---------------------------------------------------------------
$cfg = [System.IO.File]::ReadAllText($Base, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
if (-not $cfg.postListJson) { throw 'blogBase.json has no postListJson' }
$entries = @($cfg.postListJson.PSObject.Properties | ForEach-Object { $_.Value })
if ($entries.Count -eq 0) { throw 'postListJson is empty' }

# newest first
$posts = $entries | Sort-Object `
  @{ Expression = { $_.createdDate }; Descending = $true }, `
  @{ Expression = { Get-SortStamp $_.createdAt }; Descending = $true }

# ---- assemble -------------------------------------------------------------
$items = @()
foreach ($p in $posts) {
  $url = Get-PostUrl $p.postUrl
  if ($url -eq '') { continue }
  $lab = ''
  if ($p.labels -and @($p.labels).Count -gt 0) { $lab = [string]@($p.labels)[0] }
  $date = ConvertTo-RssDate $p.createdAt
  if ($date -eq '') { $date = [string]$p.createdDate }

  $lines = @()
  $lines += '    <item>'
  $lines += '      <title>' + (ConvertTo-XmlText ([string]$p.postTitle)) + '</title>'
  $lines += '      <link>' + (ConvertTo-XmlText $url) + '</link>'
  $lines += '      <description>' + (ConvertTo-XmlText (ConvertTo-Description $p.description)) + '</description>'
  if ($lab -ne '') { $lines += '      <category>' + (ConvertTo-XmlText $lab) + '</category>' }
  $lines += '      <guid isPermaLink="true">' + (ConvertTo-XmlText $url) + '</guid>'
  if ($date -ne '') { $lines += '      <pubDate>' + $date + '</pubDate>' }
  $lines += '    </item>'
  $items += ($lines -join "`n")
}

$now = [DateTimeOffset]::Now.ToOffset([TimeSpan]::FromHours(8))
$build = $now.ToString('ddd, dd MMM yyyy HH:mm:ss', [System.Globalization.CultureInfo]::InvariantCulture) + ' +0800'

# Replace lastBuildDate in the preserved header. The header is hand-written, so
# a plain replace is right: the tag appears exactly once, and if someone ever
# adds a second one the guard below says so instead of silently updating the
# wrong one.
$headFixed = [regex]::Replace($head, '<lastBuildDate>.*?</lastBuildDate>', '<lastBuildDate>' + $build + '</lastBuildDate>')
if ($headFixed -eq $head -and $head -match 'lastBuildDate') {
  throw 'lastBuildDate found but could not be replaced (tag shape changed?)'
}
if ($headFixed -notmatch 'lastBuildDate') {
  $headFixed = $headFixed -replace '(\s*<atom:link)', ("`n    <lastBuildDate>" + $build + '</lastBuildDate>$1')
}

$body = $headFixed + "`n" + ($items -join "`n") + "`n  " + $tail
$out = $body -replace "`r`n", "`n"

# Parse what we are about to write. A feed that is well-formed is the whole
# point; catching it here beats a reader silently showing zero items.
try { [xml]$null = $out } catch { throw ("generated rss.xml does not parse: " + $_.Exception.Message) }
if (([regex]::Matches($out, '<item>')).Count -ne $items.Count) { throw 'item count mismatch after assembly' }

foreach ($o in $outList) {
  $dir = Split-Path -Parent $o
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  # explicit LF: WriteAllLines would use Environment.NewLine, i.e. CRLF on Windows
  [System.IO.File]::WriteAllText($o, $out, $utf8)
  Write-Output ("wrote {0}  ({1} items, {2} bytes, lastBuildDate {3})" -f $o, $items.Count, (Get-Item $o).Length, $build)
}
