$ErrorActionPreference = 'Stop'

# Minimal static file server. MarketViewer fetches data/manifest.json and
# data/<page>/latest.json, which file:// blocks on CORS -- so screenshots taken
# straight off the disk show an empty page and every layout bug hides.
# Binding to 127.0.0.1 avoids the admin-URL ACL prompt that localhost: uses.

$root = 'C:\WorkFiles\blog\docs'
$port = 8899
$prefix = "http://127.0.0.1:$port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "serving $root at $prefix"

$MIME = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.xml'   = 'application/xml; charset=utf-8'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.svg'   = 'image/svg+xml'
  '.woff2' = 'font/woff2'
  '.txt'   = 'text/plain; charset=utf-8'
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ($rel -eq '') { $rel = 'index.html' }
  $path = Join-Path $root ($rel -replace '/', '\')
  # keep the server inside $root
  if (-not $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue
  }
  if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path 'index.html' }
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    $ctx.Response.StatusCode = 404
    $b = [System.Text.Encoding]::UTF8.GetBytes("404 $rel")
    $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    $ctx.Response.Close(); continue
  }
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  $type = if ($MIME.ContainsKey($ext)) { $MIME[$ext] } else { 'application/octet-stream' }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $ctx.Response.ContentType = $type
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}
