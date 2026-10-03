<#
  genposts.ps1 - build the single shared post list for the whole site.

  ASCII-ONLY ON PURPOSE. PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so CJK
  in these comments gets mangled and the parse dies (margin.ps1 carries the
  same warning). The generated posts.js may contain CJK -- it is written as
  data with an explicit UTF8 encoder, which is a different thing entirely.

  Source : blogBase.json -> postListJson
  Output : window.POSTS in a plain <script> (see -Out)

  Why blogBase.json and not docs/postList.json:
    blogBase.json's postListJson has every field the pages need --
    postTitle / postUrl / createdDate / labels / description / wordCount,
    which map onto cn / href / date / lab / desc / words.
    docs/postList.json carries only 5 fields; description and wordCount are
    missing, so it cannot drive the boards.

  Why a generated <script> and not a runtime fetch:
    fetch() is blocked by CORS on file:// (render.js already learned this the
    hard way -- MarketViewer sits at "loading" forever when opened from disk),
    and all three pages would need async handling plus a loading state.
    An ordinary <script> has neither problem.

  Order: createdDate ascending (oldest -> newest), matching the archive page's
    left-to-right layout. The home page's notice board takes the TAIL of the
    array for "most recent"; see the slice comment in index.html.

  Fields: cn / desc / lab / date / words / href
    The old hand-written arrays also carried `lv`, which nothing in the site
    ever reads, so it is not emitted. `pin` is not emitted either -- index.html
    derives it from the display position purely as a CSS class.

  Local : powershell -NoProfile -ExecutionPolicy Bypass -File genposts.ps1
  CI    : market-viewer-sync.yml, shell: pwsh, output to docs/assets/.
          Do NOT point it at static/ from inside that workflow: its trigger
          paths are static/**, so committing back into static/ makes the
          workflow re-trigger itself forever.
#>

param(
  [string] $Base = 'C:\WorkFiles\blog\blogBase.json',
  [string[]] $Out = @('C:\WorkFiles\blog\static\assets\posts.js')
)

# param() has to be the very first statement in the file, so $ErrorActionPreference
# cannot go above it.
$ErrorActionPreference = 'Stop'

# ---- JS string literal escaping ------------------------------------------
# Backslash first, then quote, then the control characters. U+2028/U+2029 are
# legal inside a JS string but trip up some parsers, so escape them too.
function ConvertTo-JsString([string] $s) {
  if ($null -eq $s) { return "''" }
  $t = $s -replace '\\', '\\\\'
  $t = $t -replace "'", "\'"
  $t = $t -replace "`r`n", '\n'
  $t = $t -replace "`r", '\n'
  $t = $t -replace "`n", '\n'
  $t = $t -replace ([char]0x2028), '\u2028'
  $t = $t -replace ([char]0x2029), '\u2029'
  $t = $t -replace '</', '<\/'
  return "'" + $t + "'"
}

# ---- clean a post description ---------------------------------------------
# Gmeek derives `description` from backup/<title>.md, and it sometimes leaves
# markdown syntax and appended source-link footers in there. Observed on
# 2026-10-02: commit 3cdc968 appended a line "[f1yingcat.github.io](url)" to
# backup/Origin of everything.md, which turned the description into
#   "This is how everything start." + newline + "[f1lyingcat.github.io](url)" + CJK period
# and inflated wordCount 29 -> 56. Copied verbatim, the archive plate and the
# home board would both render the literal "[f1yingcat.github.io](url)".
#
# So: unwrap markdown links/images, drop the leftover URL, collapse newlines.
function ConvertTo-Description([string] $s) {
  if ($null -eq $s) { return '' }
  $t = $s
  # Gmeek's source-link footer looks like [f1yingcat.github.io](url): the label IS
  # a domain and the target is a placeholder. Drop those whole -- unwrapping them
  # would leave the bare domain sitting in the sentence. A link whose label has
  # a dot and no space is a source link, not prose.
  $t = $t -replace '\[[^\]]*\.[^\]\s]*\]\([^)]*\)', ''
  $t = $t -replace '!\[[^\]]*\]\([^)]*\)', ''        # images -> gone
  $t = $t -replace '\[([^\]]*)\]\([^)]*\)', '$1'      # [text](url) -> text
  $t = $t -replace '\[([^\]]*)\]\[[^\]]*\]', '$1'      # [text][ref]  -> text
  $t = $t -replace 'https?://\S+', ''                 # bare URLs
  $t = $t -replace '`+', ''                           # stray backticks
  $t = $t -replace '\s+', ' '                         # newlines/tabs -> space
  # Removing a link can leave "text" + space + a CJK full stop -- a space
  # stranded in front of CJK punctuation. Chinese typography has no such space.
  # The class is written with \u escapes on purpose: this file must stay pure
  # ASCII, because PowerShell 5.1 reads a BOM-less .ps1 as ANSI and would mangle
  # literal CJK characters into something the regex can never match.
  $t = $t -replace '\s+(?=[\u3002\uFF0C\u3001\uFF1B\uFF1A\uFF1F\uFF01\uFF09\u3011\u300B\u300D\u300F\u2026\u2014\uFF05])', ''
  return $t.Trim()
}

# ---- read source ---------------------------------------------------------
$raw = [System.IO.File]::ReadAllText($Base, [System.Text.Encoding]::UTF8)
$cfg = $raw | ConvertFrom-Json

if (-not $cfg.postListJson) { throw "blogBase.json has no postListJson" }
$entries = @($cfg.postListJson.PSObject.Properties | ForEach-Object { $_.Value })
if ($entries.Count -eq 0) { throw "postListJson is empty" }

# ---- sort: createdDate asc, then createdAt asc as a tie-break ------------
# createdAt is a Unix timestamp today (Int32), but it is the one field whose
# format belongs to Gmeek, not to us. Casting it straight to [double] makes the
# whole sort throw on any other shape -- and because the CI step that calls this
# carries continue-on-error, the visible result would be a red run plus an
# articles list frozen at whatever it was, with no visible symptom in the site.
# Unparseable means "no tie-break information", i.e. 0. The primary key is
# createdDate, so the order stays right either way.
function Get-SortStamp($v) {
  if ($null -eq $v) { return 0.0 }
  $d = 0.0
  if ([double]::TryParse([string]$v, [ref]$d)) { return $d }
  return 0.0
}

$posts = $entries | Sort-Object `
  @{ Expression = { $_.createdDate }; Ascending = $true }, `
  @{ Expression = { Get-SortStamp $_.createdAt }; Ascending = $true }

# ---- assemble ------------------------------------------------------------
$lines = @()
foreach ($p in $posts) {
  $lab = ''
  if ($p.labels -and @($p.labels).Count -gt 0) { $lab = [string]@($p.labels)[0] }

  $words = 0
  if ($null -ne $p.wordCount) { $words = [int]$p.wordCount }

  $fields = @(
    "cn:"    + (ConvertTo-JsString $p.postTitle)
    "desc:"  + (ConvertTo-JsString (ConvertTo-Description $p.description))
    "lab:"   + (ConvertTo-JsString $lab)
    "date:"  + (ConvertTo-JsString $p.createdDate)
    "words:" + $words
    "href:"  + (ConvertTo-JsString $p.postUrl)
  )
  $lines += '    { ' + ($fields -join ', ') + ' }'
}

# comma between array elements (and a trailing one is legal JS, but keep it clean)
for ($i = 0; $i -lt $lines.Count - 1; $i++) { $lines[$i] = $lines[$i] + ',' }

$count = $posts.Count

$body = @"
/* ============================================================
   Post list -- GENERATED FILE, DO NOT EDIT BY HAND
   ------------------------------------------------------------
   Built by out/genposts.ps1 from blogBase.json -> postListJson.
   Regenerate:
     powershell -NoProfile -ExecutionPolicy Bypass -File out/genposts.ps1

   Change blogBase.json (Gmeek writes it) to change content. Editing this
   file by hand gets overwritten on the next Gmeek run.

   Home page, archive page and post pages all read this one array. They used
   to be three hand-written copies, so adding a post meant editing three
   places and missing one showed up as "listed on the home page, gone from
   the archive".

   href is relative to the SITE ROOT (post/xxx.html). post.js runs from
   /post/ and strips the leading post/ before using it.

   Fields: cn title / desc summary / lab label / date / words / href
   Order: createdDate ascending (old -> new), matching the archive layout.
   Posts at generation time: $count
   ============================================================ */
window.POSTS = [
$($lines -join "`n")
];
"@

$enc = New-Object System.Text.UTF8Encoding($false)
foreach ($o in $Out) {
  $dir = Split-Path -Parent $o
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  # explicit LF: WriteAllLines would use Environment.NewLine, i.e. CRLF on Windows
  [System.IO.File]::WriteAllText($o, ($body -replace "`r`n", "`n"), $enc)
  Write-Output ("wrote {0}  ({1} posts, {2} bytes)" -f $o, $count, (Get-Item $o).Length)
}
