$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$archivePath = Join-Path $outputDir 'core-2048-harmony-source.zip'
# Strip signing data in memory. Keep the working project's phone signing intact.
$publicProfile = Get-Content -LiteralPath (Join-Path $projectRoot 'harmony\build-profile.json5') -Raw | ConvertFrom-Json
$publicProfile.app.signingConfigs = @()
foreach ($product in $publicProfile.app.products) { $product.PSObject.Properties.Remove('signingConfig') }
$publicProfileText = $publicProfile | ConvertTo-Json -Depth 100
if ($publicProfileText -match '"(storePassword|keyPassword|profile|certpath|storeFile)"\s*:') {
    throw 'The public build profile still contains signing information. Source export stopped.'
}
# Allow only source and delivery resources; never include SDKs or signing material.
$sourceRoots = @('src', 'public', 'scripts', 'tests', 'dist', 'harmony', 'android')
$sourceFiles = @('README.md', 'QA.md', 'INSTALL.md', 'INTERNAL_TEST.md', 'ANDROID.md', 'index.html', 'package.json', 'package-lock.json', '.gitignore')
$files = @($sourceFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) })
foreach ($sourceRoot in $sourceRoots) {
    $files += Get-ChildItem -LiteralPath (Join-Path $projectRoot $sourceRoot) -File -Recurse | Where-Object {
        $_.FullName -notmatch '[\\/](oh_modules|node_modules|build|\.hvigor|\.idea)[\\/]' -and
        $_.Name -ne 'local.properties' -and $_.Extension -notin @('.p12', '.cer', '.p7b', '.jks', '.keystore')
    }
}
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
        if ($relative -eq 'harmony/build-profile.json5') {
            $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
            $writer = New-Object System.IO.StreamWriter($entry.Open(), (New-Object System.Text.UTF8Encoding($false)))
            try { $writer.Write($publicProfileText) } finally { $writer.Dispose() }
            continue
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Host ('Source archive: ' + $archivePath)
Write-Host ('Files: ' + $files.Count)
