param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 8183
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".htm"  = "text/html; charset=utf-8"
  ".css"  = "text/css"
  ".js"   = "application/javascript"
  ".json" = "application/json"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".pdf"  = "application/pdf"
  ".woff" = "font/woff"
  ".woff2"= "font/woff2"
  ".xml"  = "application/xml"
  ".txt"  = "text/plain"
  ".webmanifest" = "application/manifest+json"
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $Root ($path.TrimStart("/"))

    # Nette URL's zonder .html (bv. /occasions -> /occasions.html) en map-index (/occasions/slug/ -> index.html)
    if (-not (Test-Path $filePath -PathType Leaf)) {
      if (Test-Path "$filePath.html" -PathType Leaf) { $filePath = "$filePath.html" }
      elseif (Test-Path (Join-Path $filePath "index.html") -PathType Leaf) { $filePath = Join-Path $filePath "index.html" }
    }

    # /occasions/<slug>/ is op Netlify een rewrite naar occasion.html
    if (-not (Test-Path $filePath -PathType Leaf) -and $path -match "^/occasions/[^/]+/?$") { $filePath = Join-Path $Root "occasion.html" }

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = $mime[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
      $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $response.OutputStream.Write($notFound, 0, $notFound.Length)
    }
    $response.OutputStream.Close()
  } catch {
    Write-Host "Error: $($_.Exception.Message)"
  }
}
