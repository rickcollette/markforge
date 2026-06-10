# Builds the MarkForge Windows NSIS installer and collects the artifact into
#   packages/<os>/<arch>/markforge-<version>-<os>-<arch>.exe
# The installer is fully self-contained: it embeds the WebView2 offline
# installer and the app is built with a statically linked C runtime.
# Run from the repository root. VERSION is the single source of truth and
# must match src-tauri/tauri.conf.json.
# The patch version is bumped automatically; pass -NoBump to rebuild the
# current version (e.g. when packaging other platforms at the same version).
param([switch]$NoBump)
$ErrorActionPreference = "Stop"

if (-not $NoBump) { ./scripts/bump-version.ps1 }
$version = (Get-Content VERSION -Raw).Trim()
$tauriVersion = (Get-Content src-tauri/tauri.conf.json | ConvertFrom-Json).version
if ($version -ne $tauriVersion) {
    throw "VERSION ($version) does not match src-tauri/tauri.conf.json ($tauriVersion). Sync them before building."
}
$os = "windows"
$arch = "x64"

npm run tauri build -- --bundles nsis
if ($LASTEXITCODE -ne 0) { throw "tauri build failed" }

$outDir = "packages/$os/$arch"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = "$outDir/markforge-$version-$os-$arch.exe"

Copy-Item "src-tauri/target/release/bundle/nsis/MarkForge_${version}_x64-setup.exe" $outFile -Force
Write-Host "==> $outFile" -ForegroundColor Green
