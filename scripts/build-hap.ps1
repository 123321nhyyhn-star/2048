param(
    [string]$ToolsRoot = $env:CORE_HARMONY_TOOLS,
    [string]$SdkRoot = $env:DEVECO_SDK_HOME,
    [ValidateSet('default', 'release')][string]$Product = 'default',
    [ValidateSet('debug', 'release')][string]$BuildMode = 'debug',
    [switch]$App,
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$harmonyRoot = Join-Path $projectRoot 'harmony'
$projectProfile = Get-Content -LiteralPath (Join-Path $harmonyRoot 'build-profile.json5') -Raw | ConvertFrom-Json
$selectedProduct = $projectProfile.app.products | Where-Object { $_.name -eq $Product } | Select-Object -First 1
if (-not $selectedProduct) { throw "Product $Product is not configured." }
if ($Product -eq 'release' -and $selectedProduct.signingConfig) {
    $releaseSigning = $projectProfile.app.signingConfigs | Where-Object { $_.name -eq $selectedProduct.signingConfig } | Select-Object -First 1
    if (-not $releaseSigning -or -not (Test-Path -LiteralPath $releaseSigning.material.profile)) { throw 'The selected release signing Profile is missing.' }
    Add-Type -AssemblyName System.Security
    $signedProfile = New-Object System.Security.Cryptography.Pkcs.SignedCms
    $signedProfile.Decode([System.IO.File]::ReadAllBytes($releaseSigning.material.profile))
    $releaseProfile = [System.Text.Encoding]::UTF8.GetString($signedProfile.ContentInfo.Content) | ConvertFrom-Json
    if ($releaseProfile.type -ne 'release') { throw 'Release distribution requires a release Profile; the configured Profile is a debug Profile.' }
}
if (-not $ToolsRoot) {
    $taskCandidates = @(
        (Join-Path $projectRoot '.tools\windows-26\command-line-tools'),
        (Join-Path $projectRoot '.tools\command-line-tools'),
        'C:\Program Files\Huawei\DevEco Studio',
        'C:\Program Files\Huawei\DevEco Studio Next',
        'D:\Program Files\Huawei\DevEco Studio'
    )
    $ToolsRoot = $taskCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $ToolsRoot -or -not (Test-Path -LiteralPath $ToolsRoot)) {
    throw 'Official HarmonyOS build tools were not found. Download them from https://developer.huawei.com/consumer/cn/download/ and set CORE_HARMONY_TOOLS to the extracted directory, or pass -ToolsRoot.'
}
$resolvedTools = (Resolve-Path -LiteralPath $ToolsRoot).Path
$hvigor = Get-Item -LiteralPath (Join-Path $resolvedTools 'bin\hvigorw.bat') -ErrorAction SilentlyContinue
if (-not $hvigor) { $hvigor = Get-ChildItem -LiteralPath $resolvedTools -Filter 'hvigorw.bat' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 }
$ohpm = Get-ChildItem -LiteralPath $resolvedTools -Filter 'ohpm.bat' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
$nodeRuntime = Get-ChildItem -LiteralPath $resolvedTools -Filter 'node.exe' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
$javaRuntime = Get-ChildItem -LiteralPath $resolvedTools -Filter 'java.exe' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $hvigor -or -not $ohpm) { throw 'The selected directory does not contain official Hvigor and OHPM tools.' }
Write-Host ('Tools: ' + $resolvedTools)
Write-Host ('Hvigor: ' + $hvigor.FullName)
Write-Host ('OHPM: ' + $ohpm.FullName)
if ($nodeRuntime) { $env:PATH = $nodeRuntime.DirectoryName + ';' + $env:PATH }
if ($javaRuntime) { $env:JAVA_HOME = Split-Path -Parent $javaRuntime.DirectoryName; $env:PATH = $javaRuntime.DirectoryName + ';' + $env:PATH }
if (-not $env:JAVA_HOME) {
    $taskJava = Get-Command java -ErrorAction SilentlyContinue
    if ($taskJava) { $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $taskJava.Source) }
    else {
        $taskJdk = Get-ChildItem -LiteralPath 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($taskJdk) { $env:JAVA_HOME = $taskJdk.FullName; $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH }
    }
}
if (-not $SdkRoot) { $SdkRoot = Join-Path $resolvedTools 'sdk' }
if (-not (Test-Path -LiteralPath (Join-Path $SdkRoot 'default'))) { throw 'HarmonyOS SDK is missing. Use the full official Windows Command Line Tools package, or set DEVECO_SDK_HOME to the SDK directory.' }
$env:DEVECO_SDK_HOME = (Resolve-Path -LiteralPath $SdkRoot).Path
$env:DEVECO_NODE_HOME = if ($nodeRuntime) { $nodeRuntime.DirectoryName } else { Split-Path -Parent (Get-Command node).Source }
$env:HVIGOR_USER_HOME = Join-Path $projectRoot '.tools\hvigor-user'
Write-Host ('SDK: ' + $env:DEVECO_SDK_HOME)
if ($CheckOnly) { exit 0 }
Push-Location $projectRoot
try { & node 'scripts/build.mjs'; if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }; & node 'scripts/sync-harmony.mjs'; if ($LASTEXITCODE -ne 0) { throw 'Native resource sync failed.' } } finally { Pop-Location }
Push-Location $harmonyRoot
try {
    & $ohpm.FullName install
    if ($LASTEXITCODE -ne 0) { throw 'OHPM dependency synchronization failed.' }
    $outputDir = Join-Path $projectRoot $(if ($Product -eq 'release') { 'artifacts\release' } else { 'artifacts\hap' })
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    $buildLog = Join-Path $outputDir 'build.log'
    # Windows PowerShell represents native stderr warnings as ErrorRecords.
    # Let the compiler finish, then check its exit code and explicit success result.
    try {
        $ErrorActionPreference = 'Continue'
        $buildArguments = if ($App) {
            @('--mode', 'project', '-p', "product=$Product", '-p', "buildMode=$BuildMode", 'assembleApp', '--no-daemon')
        } else {
            @('--mode', 'module', '-p', "product=$Product", '-p', 'module=entry@default', '-p', "buildMode=$BuildMode", 'assembleHap', '--no-daemon')
        }
        & $hvigor.FullName @buildArguments 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $buildLog
        $buildExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = 'Stop' }
    if ($buildExitCode -ne 0 -or (Get-Content -LiteralPath $buildLog -Raw) -notmatch 'BUILD SUCCESSFUL') { throw 'HarmonyOS HAP build failed. Check the build output above.' }
    $haps = @(Get-ChildItem -LiteralPath (Join-Path $harmonyRoot "entry\build\$Product\outputs") -Filter '*.hap' -Recurse -File)
    if ($haps.Count -eq 0) { throw 'The build reported success but no HAP was found.' }
    foreach ($hap in $haps) { Copy-Item -LiteralPath $hap.FullName -Destination $outputDir; Write-Host ('HAP: ' + (Join-Path $outputDir $hap.Name)) }
    if ($App) {
        $apps = @(Get-ChildItem -LiteralPath (Join-Path $harmonyRoot "build\outputs\$Product") -Filter '*.app' -Recurse -File)
        if ($apps.Count -eq 0) { throw 'The APP build reported success but no APP package was found.' }
        foreach ($package in $apps) { Copy-Item -LiteralPath $package.FullName -Destination $outputDir; Write-Host ('APP: ' + (Join-Path $outputDir $package.Name)) }
    }
    Write-Host 'Unsigned packages still require signing. AppGallery distribution requires the appropriate registered-app certificate and Profile.'
} finally { Pop-Location }
