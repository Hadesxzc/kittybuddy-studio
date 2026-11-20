# Builds the web app, gzips it and places it in firmware/data for LittleFS upload.
$ErrorActionPreference = "Stop"

Push-Location "$PSScriptRoot\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Frontend build failed" }
Pop-Location

$dataDir = "$PSScriptRoot\firmware\data"
if (Test-Path $dataDir) { Remove-Item "$dataDir\*" -Recurse -Force }
else { New-Item -ItemType Directory -Path $dataDir | Out-Null }

$dist = "$PSScriptRoot\frontend\dist"
Get-ChildItem $dist -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($dist.Length + 1)
    $target = Join-Path $dataDir $rel
    New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
    if ($_.Extension -in ".js", ".css", ".html", ".svg") {
        # The device serves "<file>.gz" transparently with Content-Encoding: gzip
        $in = [IO.File]::OpenRead($_.FullName)
        $out = [IO.File]::Create("$target.gz")
        $gz = New-Object IO.Compression.GZipStream($out, [IO.Compression.CompressionLevel]::Optimal)
        $in.CopyTo($gz); $gz.Dispose(); $out.Dispose(); $in.Dispose()
    } else {
        Copy-Item $_.FullName $target
    }
}

$bytes = (Get-ChildItem $dataDir -Recurse -File | Measure-Object Length -Sum).Sum
"Wrote {0} files ({1:N0} KB) to firmware/data" -f (Get-ChildItem $dataDir -Recurse -File).Count, ($bytes / 1KB)
"Next: cd firmware; pio run -t upload; pio run -t uploadfs"
