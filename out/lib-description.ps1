<#
  lib-description.ps1 - text helpers shared by genposts.ps1 and genrss.ps1.

  ASCII-ONLY ON PURPOSE, same reason as every other .ps1 in out/.

  Why a library at all: ConvertTo-Description cleans the description that
  Gmeek derives from backup/<title>.md, and the archive page, the home board
  and the RSS all show that same string. When the RSS generator had its own
  copy, the two copies would drift -- and the exact failure that motivated
  ConvertTo-Description in the first place (Round 21, the literal
  "[f1lyingcat.github.io](url)" Gmeek appends to an existing post) would then
  show up fixed on the site and still broken in the feed.

  Dot-sourced, not a module: the CI steps call these scripts with `pwsh -File`
  and no profile, so Import-Module would have to resolve a path that differs
  between a local checkout and a runner. $PSScriptRoot does not.

  Local : . (Join-Path $PSScriptRoot 'lib-description.ps1')
#>

# ---- clean a post description ---------------------------------------------
# Gmeek derives `description` from backup/<title>.md, and it sometimes leaves
# markdown syntax and appended source-link footers in there. Observed on
# 2026-10-02: commit 3cdc968 appended a line "[f1lyingcat.github.io](url)" to
# backup/Origin of everything.md, which turned the description into
#   "This is how everything start." + newline + "[f1lyingcat.github.io](url)" + CJK period
# and inflated wordCount 29 -> 56. Copied verbatim, the archive plate, the home
# board and the feed would all render the literal "[f1lyingcat.github.io](url)".
#
# So: unwrap markdown links/images, drop the leftover URL, collapse newlines.
function ConvertTo-Description([string] $s) {
  if ($null -eq $s) { return '' }
  $t = $s
  # Gmeek's source-link footer looks like [f1lyingcat.github.io](url): the label IS
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

# ---- RFC 1123 date in the site's timezone --------------------------------
# The two hand-written pubDates in rss.xml are both exactly
# createdAt + 8 hours, so the feed and the article list agree about when a post
# went up. Keeping that derivation is the point: a hand-maintained feed drifts
# from createdAt the first time somebody edits a post in Gmeek, and the only
# symptom is a feed that sorts wrong.
#
# InvariantCulture is not optional here. 'ddd' and 'MMM' come from the current
# locale, and on a machine set to zh-CN they render as the Chinese day and
# month names -- which is not RFC 1123 and which most feed readers refuse to
# parse. The +0800 is appended by hand because .NET's zzz gives "+08:00" and the
# file has always used the compact form.
function ConvertTo-RssDate($unix) {
  if ($null -eq $unix) { return '' }
  $secs = 0L
  if (-not [long]::TryParse([string]$unix, [ref]$secs)) { return '' }
  if ($secs -le 0) { return '' }
  $d = [DateTimeOffset]::FromUnixTimeSeconds($secs).ToOffset([TimeSpan]::FromHours(8))
  return $d.ToString('ddd, dd MMM yyyy HH:mm:ss', [System.Globalization.CultureInfo]::InvariantCulture) + ' +0800'
}
