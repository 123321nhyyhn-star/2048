param([string]$SdkRoot, [string]$JavaRoot, [string]$NodePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $SdkRoot) {
    foreach ($candidate in @($env:ANDROID_SDK_ROOT, $env:ANDROID_HOME, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'build-tools'))) { $SdkRoot = $candidate; break }
    }
}
if (-not $SdkRoot) { throw 'Android SDK not found. Pass -SdkRoot.' }
if (-not $JavaRoot) {
    foreach ($candidate in @($env:JAVA_HOME, 'C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot')) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'bin\javac.exe'))) { $JavaRoot = $candidate; break }
    }
}
if (-not $JavaRoot) { throw 'Java JDK 17 or newer not found. Pass -JavaRoot.' }
if (-not $NodePath) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) { $NodePath = $nodeCommand.Source }
    elseif (Test-Path -LiteralPath 'Y:\nodejs\node.exe') { $NodePath = 'Y:\nodejs\node.exe' }
    else { throw 'Node.js 20 or newer not found. Pass -NodePath.' }
}
$buildTools = Get-ChildItem -LiteralPath (Join-Path $SdkRoot 'build-tools') -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } | Sort-Object { [Version]$_.Name } -Descending | Select-Object -First 1
$platform = Get-ChildItem -LiteralPath (Join-Path $SdkRoot 'platforms') -Directory |
    Where-Object { $_.Name -match '^android-\d+$' -and [int]$_.Name.Substring(8) -ge 35 } |
    Sort-Object { [int]$_.Name.Substring(8) } -Descending | Select-Object -First 1
if (-not $buildTools -or -not $platform) { throw 'Install Android build-tools >= 35 and platform >= 35.' }
$androidJar = Join-Path $platform.FullName 'android.jar'
$bootClasspath = $androidJar + [System.IO.Path]::PathSeparator + (Join-Path $buildTools.FullName 'core-lambda-stubs.jar')
$java = Join-Path $JavaRoot 'bin\java.exe'
$javac = Join-Path $JavaRoot 'bin\javac.exe'
$aapt = Join-Path $buildTools.FullName 'aapt2.exe'
$d8 = Join-Path $buildTools.FullName 'lib\d8.jar'
$signer = Join-Path $buildTools.FullName 'lib\apksigner.jar'
$zipalign = Join-Path $buildTools.FullName 'zipalign.exe'
$androidRoot = Join-Path $projectRoot 'android'
$build = Join-Path $androidRoot 'build'
$output = Join-Path $projectRoot 'artifacts\apk'
$signing = Join-Path $projectRoot '.tools\android-signing'
foreach ($directory in @($build, $output, $signing)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
# Every run gets a clean staging directory without deleting previous outputs or signing keys.
$stage = Join-Path $build ([Guid]::NewGuid().ToString('N'))
$classes = Join-Path $stage 'classes'
$generated = Join-Path $stage 'generated'
$dex = Join-Path $stage 'dex'
foreach ($directory in @($classes, $generated, $dex)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
function Invoke-Checked([string]$Tool, [string[]]$ToolArgs) {
    # Windows PowerShell treats benign compiler warnings on stderr as errors; use exit status.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Tool @ToolArgs; $result = $LASTEXITCODE } finally { $ErrorActionPreference = $previousPreference }
    if ($result -ne 0) { throw ('Build tool failed: ' + [System.IO.Path]::GetFileName($Tool) + ' (' + $result + ')') }
}
Push-Location $projectRoot
try {
    Invoke-Checked $NodePath @('scripts/sync-android.mjs')
    $resources = Join-Path $stage 'resources.zip'
    $unsigned = Join-Path $stage 'unsigned.apk'
    $aligned = Join-Path $stage 'aligned.apk'
    Invoke-Checked $aapt @('compile', '--dir', (Join-Path $androidRoot 'res'), '-o', $resources)
    Invoke-Checked $aapt @('link', '-o', $unsigned, '-I', $androidJar, '--manifest', (Join-Path $androidRoot 'AndroidManifest.xml'),
        '-A', (Join-Path $androidRoot 'assets'), '--java', $generated, '--min-sdk-version', '26', '--target-sdk-version', '35', $resources)
    $sources = @(Get-ChildItem -LiteralPath (Join-Path $androidRoot 'src') -Filter '*.java' -File -Recurse | ForEach-Object FullName)
    Invoke-Checked $javac (@('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-bootclasspath', $bootClasspath, '-d', $classes) + $sources)
    $bytecode = @(Get-ChildItem -LiteralPath $classes -Filter '*.class' -File -Recurse | ForEach-Object FullName)
    Invoke-Checked $java (@('-cp', $d8, 'com.android.tools.r8.D8', '--release', '--min-api', '26', '--lib', $androidJar, '--output', $dex) + $bytecode)
    $archive = [System.IO.Compression.ZipFile]::Open($unsigned, [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        foreach ($file in Get-ChildItem -LiteralPath $dex -Filter '*.dex' -File) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $file.Name,
                [System.IO.Compression.CompressionLevel]::NoCompression) | Out-Null
        }
    } finally { $archive.Dispose() }
    Invoke-Checked $zipalign @('-f', '-p', '4', $unsigned, $aligned)
    $keyStore = Join-Path $signing 'core2048-android-release.p12'
    $passwordFile = Join-Path $signing 'key-password.txt'
    if ((Test-Path -LiteralPath $keyStore) -and -not (Test-Path -LiteralPath $passwordFile)) {
        throw 'Existing Android signing key is missing its password file. Restore it; do not replace the key.'
    }
    if (-not (Test-Path -LiteralPath $passwordFile)) {
        $random = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($random) } finally { $rng.Dispose() }
        [System.IO.File]::WriteAllText($passwordFile, [Convert]::ToBase64String($random), (New-Object System.Text.UTF8Encoding($false)))
    }
    $env:CORE2048_KEY_PASSWORD = [System.IO.File]::ReadAllText($passwordFile)
    if (-not (Test-Path -LiteralPath $keyStore)) {
        Invoke-Checked (Join-Path $JavaRoot 'bin\keytool.exe') @('-genkeypair', '-keystore', $keyStore, '-storetype', 'PKCS12',
            '-storepass:env', 'CORE2048_KEY_PASSWORD', '-keypass:env', 'CORE2048_KEY_PASSWORD', '-alias', 'core2048',
            '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=CORE 2048')
    }
    $apk = Join-Path $output 'core2048-1.0.0.apk'
    Invoke-Checked $java @('-jar', $signer, 'sign', '--ks', $keyStore, '--ks-key-alias', 'core2048',
        '--ks-pass', 'env:CORE2048_KEY_PASSWORD', '--key-pass', 'env:CORE2048_KEY_PASSWORD',
        '--v1-signing-enabled', 'true', '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
        '--v4-signing-enabled', 'false', '--out', $apk, $aligned)
    Invoke-Checked $java @('-jar', $signer, 'verify', '--verbose', '--print-certs', $apk)
    Invoke-Checked $zipalign @('-c', '-p', '4', $apk)
    $hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText((Join-Path $output 'SHA256SUMS.txt'), ($hash + '  core2048-1.0.0.apk' + [Environment]::NewLine))
    Write-Host ('APK ready: ' + $apk)
    Write-Host ('Size: ' + (Get-Item -LiteralPath $apk).Length + ' bytes')
} finally {
    Remove-Item Env:\CORE2048_KEY_PASSWORD -ErrorAction SilentlyContinue
    Pop-Location
}
