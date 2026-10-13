<#
  adopt-posts.ps1 - retemplate the post pages Gmeek generated.

  ASCII-ONLY ON PURPOSE, same reason as genposts.ps1: PowerShell 5.1 reads a
  BOM-less .ps1 as ANSI, so literal CJK in here gets mangled and the parse
  dies. All the Chinese lives in out/post.tpl.html, which is read with an
  explicit UTF8 decoder -- that is data, not source.

  WHAT IT DOES
    Gmeek writes every post page from its own Primer template: a CDN stylesheet,
    a light/dark theme switch, an utterances comment box, and a footer reading
    "Blog Title / Powered by Gmeek". Our two hand-written posts look nothing
    like that. So a brand-new issue produced a page that visibly fell out of the
    site's design -- the notice board and the archive page had already learned
    to follow blogBase.json, but the article itself had not.

    This step rewrites those pages into out/post.tpl.html: same HUD, same kicker,
    same pager, same pixel-cat illustration as the hand-written posts.

  WHERE IT RUNS
    Gmeek.yml, right after "Restore hand-written pages" and before "update html"
    (so the takeover is what gets committed AND what gets deployed);
    market-viewer-sync.yml, after the static->docs copy and before the push.

  IDEMPOTENT
    An adopted page carries the marker "out/adopt-posts.ps1" in an HTML comment
    and is skipped on the next run. Gmeek regenerates a page in Primer form only
    when its issue changes, and this step re-adopts it then, so a content edit
    still flows through. Hand-written pages under static/post/ are never Gmeek
    pages, so they never match and never get touched.

  IT DOES NOT MOVE ANYTHING
    The adopted file stays in docs/post/ and is never copied to static/. static/
    is the hand-written source of truth; a Gmeek page does not belong there.

  Fields it pulls, and where from:
    title / body / issue number  <- the Gmeek page itself
    date / words / label        <- blogBase.json -> postListJson, matched on the
                                   decoded postUrl. Not from the page: Gmeek's
                                   page carries no date, no word count and no
                                   label, and the kicker needs all three.

  Local : powershell -NoProfile -ExecutionPolicy Bypass -File out/adopt-posts.ps1
#>

param(
  [string] $Docs = 'C:\WorkFiles\blog\docs',
  [string] $Base = 'C:\WorkFiles\blog\blogBase.json',
  [string] $Tpl  = 'C:\WorkFiles\blog\out\post.tpl.html'
)

# param() has to be the very first statement, so this cannot go above it.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$ISSUES_ROOT = 'https://github.com/F1lyingCat/F1yingCat.github.io/issues'

# ---- small helpers --------------------------------------------------------

# HTML-escape for attribute and text context. & has to go first or the entities
# this function itself emits get escaped a second time.
function ConvertTo-HtmlText([string] $s) {
  if ($null -eq $s) { return '' }
  $t = [System.Net.WebUtility]::HtmlDecode($s)
  $t = $t.Replace('&', '&amp;')
  $t = $t.Replace('<', '&lt;')
  $t = $t.Replace('>', '&gt;')
  $t = $t.Replace('"', '&quot;')
  $t = $t.Replace("'", '&#39;')
  return $t
}

# JSON string body, for the data-post attribute. Single-quoted attribute, so a
# quote inside becomes a \\u escape rather than ending the attribute.
function ConvertTo-JsonBody([string] $s) {
  if ($null -eq $s) { return '' }
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if     ($ch -eq '\') { [void]$sb.Append('\\') }
    elseif ($ch -eq '"') { [void]$sb.Append('\"') }
    elseif ($c -lt 32)   { [void]$sb.Append(('\u{0:x4}' -f $c)) }
    else                { [void]$sb.Append($ch) }
  }
  return $sb.ToString()
}

# First match of a capture group, '' when the pattern misses.
function Get-First([string] $text, [string] $pattern, [int] $group) {
  $m = [regex]::Match($text, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($m.Success) { return $m.Groups[$group].Value }
  return ''
}

# Inner HTML of the element whose opening tag ends with $marker. Counts nested
# <div> so a div inside the body does not end the scan early.
function Get-InnerHtml([string] $t, [string] $marker) {
  $i = $t.IndexOf($marker)
  if ($i -lt 0) { return '' }
  $start = $i + $marker.Length
  $depth = 1
  $pos = $start
  while ($pos -lt $t.Length) {
    $lt = $t.IndexOf('<', $pos)
    if ($lt -lt 0) { break }
    $gt = $t.IndexOf('>', $lt)
    if ($gt -lt 0) { break }
    $tag = $t.Substring($lt, $gt - $lt + 1)
    if ($tag -match '^<div\b') {
      $depth++
    } elseif ($tag -match '^</div\s*>') {
      $depth--
      if ($depth -eq 0) { return $t.Substring($start, $lt - $start) }
    }
    $pos = $gt + 1
  }
  return $t.Substring($start)
}

# Strip the junk Gmeek leaves in the rendered body, and the script the template
# had no business carrying over. The literal href="url" anchor is Gmeek's
# source-link footer -- it shows up as a broken link to the bare site domain.
function ConvertTo-Body([string] $html) {
  if ($null -eq $html) { return '' }
  $t = $html
  # Gmeek's source-link footer. It arrives as
  #   ...</p>\n<a href="url">f1lyingcat.github.io/Foo.html</a></p>
  # -- an anchor sitting OUTSIDE the last </p> but followed by a stray </p> of its
  # own, which is how Gmeek closes its markdown-body. So the <br> before it and
  # the </p> after it go too, otherwise an orphan </p> is left behind. (A browser
  # ignores a stray </p>, but leaving it there means the next run's output differs
  # from the previous one for no reason, and that is how "why is this file dirty"
  # mysteries start.)
  $t = [regex]::Replace($t, '(?is)(<br\s*/?>\s*)?<a\s+href="url"[^>]*>.*?</a>\s*(</p>)?', '')
  $t = [regex]::Replace($t, '(?s)<script\b.*?</script>', '')
  # an emptied anchor left a dangling <br> / empty <p> behind
  $t = [regex]::Replace($t, '(?i)<br\s*/?>\s*</p>', '</p>')
  $t = [regex]::Replace($t, '(?i)<p\s*>\s*</p>', '')
  $t = $t.Trim()
  if ($t -eq '') { return '<p class="empty">&#12396;</p>' }
  return $t
}

# ---- read the inputs ------------------------------------------------------

$tpl = [System.IO.File]::ReadAllText($Tpl, [System.Text.Encoding]::UTF8)
$cfg = [System.IO.File]::ReadAllText($Base, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

# postUrl -> metadata. Key it on the DECODED on-disk file name, which is what we
# are actually looking at when we walk docs/post/.
$meta = @{}
foreach ($prop in $cfg.postListJson.PSObject.Properties) {
  $v = $prop.Value
  $url = [string]$v.postUrl
  if ($url -eq '') { continue }
  $file = $url -replace '^post/', ''
  $file = [System.Uri]::UnescapeDataString($file)
  $lab = ''
  if ($v.labels -and @($v.labels).Count -gt 0) { $lab = [string]@($v.labels)[0] }
  $words = 0
  if ($null -ne $v.wordCount) { $words = [int]$v.wordCount }
  $meta[$file] = @{
    title = [string]$v.postTitle
    date  = [string]$v.createdDate
    words = $words
    lab   = $lab
    href  = ($url -replace '^post/', '')
  }
}

$postDir = Join-Path $Docs 'post'
if (-not (Test-Path $postDir)) { throw ("no such dir: " + $postDir) }

$adopted = 0
$skipped = 0
$matched = 0

foreach ($f in (Get-ChildItem -Path $postDir -Filter '*.html' | Sort-Object Name)) {
  $html = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)

  # already ours, or ours by hand
  if ($html.Contains('out/adopt-posts.ps1')) { $skipped++; continue }
  if ($html.Contains('assets/post.js')) { $skipped++; continue }
  # not a Gmeek page
  if (-not ($html -match 'meekdai\.com/Gmeek\.html' -or $html -match 'meek_theme')) {
    $skipped++
    continue
  }

  # ---- pull the content out of the Gmeek page ----
  $title = [System.Net.WebUtility]::HtmlDecode((Get-First $html '<h1[^>]*class="postTitle"[^>]*>(.*?)</h1>' 1)).Trim()
  if ($title -eq '') {
    $title = [System.Net.WebUtility]::HtmlDecode((Get-First $html '<title>(.*?)</title>' 1)).Trim()
  }
  # Gmeek appends the site name to <title>; our own pages use "Title . F1yingCat"
  $title = ($title -replace '\s*[-|\u00b7]\s*F1lyingCat\s*$', '').Trim()
  if ($title -eq '') { $title = [System.IO.Path]::GetFileNameWithoutExtension($f.Name) }

  $desc = [System.Net.WebUtility]::HtmlDecode((Get-First $html '<meta[^>]*property="og:description"[^>]*content="([^"]*)"' 1)).Trim()
  if ($desc -eq '') {
    $desc = [System.Net.WebUtility]::HtmlDecode((Get-First $html '<meta[^>]*name="description"[^>]*content="([^"]*)"' 1)).Trim()
  }
  # newlines inside a meta content are legal but read badly in the source
  $desc = ($desc -replace '\s+', ' ').Trim()

  $issue = Get-First $html 'github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/issues/(\d+)' 1
  $issueUrl = $ISSUES_ROOT
  if ($issue -ne '') { $issueUrl = $ISSUES_ROOT + '/' + $issue }

  $body = ConvertTo-Body (Get-InnerHtml $html 'id="postBody">')

  # ---- metadata from blogBase.json ----
  $m = $null
  if ($meta.ContainsKey($f.Name)) { $m = $meta[$f.Name] }
  if ($null -ne $m) {
    $matched++
    if ($title -eq '' -and $m.title -ne '') { $title = $m.title }
  }
  $lab = ''
  $date = ''
  $words = 0
  if ($null -ne $m) {
    $lab = $m.lab
    $date = $m.date
    $words = $m.words
  }
  if ($lab -eq '') { $lab = 'documentation' }

  # href for data-post: post.js strips the leading "post/" off every posts.js
  # entry, so the page has to carry exactly what is left after that strip --
  # percent-encoding and all. Unescaping the file name instead produces
  # "MarketViewer -shi-chang-su-lan.html" where posts.js says
  # "MarketViewer%20-shi-chang-su-lan.html"; the findIndex in the pager then
  # misses and BOTH arrows silently disappear.
  $href = ''
  if ($null -ne $m) { $href = $m.href }
  if ($href -eq '') { $href = [System.Uri]::EscapeDataString($f.Name) }

  $json = '{"title":"' + (ConvertTo-JsonBody $title) + '",' +
          '"href":"'   + (ConvertTo-JsonBody $href) + '",' +
          '"lab":"'    + (ConvertTo-JsonBody $lab) + '",' +
          '"date":"'   + (ConvertTo-JsonBody $date) + '",' +
          '"words":'   + $words + '}'

  # ---- fill the template ----
  # Body goes in LAST on purpose: it is the only field that can contain the
  # placeholder tokens itself, and inserting it last means it is never scanned.
  $out = $tpl
  $out = $out.Replace('@@ADOPTED@@', '')
  $out = $out.Replace('@@TITLE@@', (ConvertTo-HtmlText $title))
  $out = $out.Replace('@@DESC@@', (ConvertTo-HtmlText $desc))
  $out = $out.Replace('@@URLENC@@', [System.Uri]::EscapeDataString($f.Name))
  $out = $out.Replace('@@POSTJSON@@', (ConvertTo-HtmlText $json))
  $out = $out.Replace('@@SLUG@@', (ConvertTo-HtmlText $title))
  $out = $out.Replace('@@ISSUE@@', (ConvertTo-HtmlText $issueUrl))
  # No-JS fallback caption. It deliberately does NOT name a scene: which of the
  # 16 illustrations this post gets is decided by pickArt() in post.js from the
  # title hash, and a caption that guessed wrong would be a lie. With JS on,
  # post.js overwrites this with the real scene name.
  $out = $out.Replace('@@ARTCAP@@', 'PIXEL CAT')
  $out = $out.Replace('@@BODY@@', $body)

  [System.IO.File]::WriteAllText($f.FullName, ($out -replace "`r`n", "`n"), $utf8)
  Write-Output ('adopted {0}  (title={1} lab={2} date={3} words={4} issue={5})' -f $f.Name, $title, $lab, $date, $words, $issueUrl)
  $adopted++
}

Write-Output ('done: adopted {0}, skipped {1}, blogBase matched {2}' -f $adopted, $skipped, $matched)
