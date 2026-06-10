# Signs the built packages for the in-app updater and generates the update
# manifest. Run AFTER build-windows-package.ps1 / build-linux-packages.ps1.
#
#   ./scripts/make-update-manifest.ps1 [-Notes "What changed"]
#
# Produces:
#   packages/windows/x64/*.exe.sig        minisign signature (updater)
#   packages/linux/amd64/*.AppImage.sig   minisign signature (updater)
#   docs/latest.json                      manifest served by GitHub Pages
#   packages/latest.json                  same file, to attach to the release
#
# Release flow:
#   1. Build packages (scripts auto-bump the version).
#   2. Run this script.
#   3. Create GitHub release v<version> and upload everything in packages/
#      (including the .sig files and latest.json).
#   4. Commit + push docs/latest.json (GitHub Pages serves the new manifest).
#
# Signing key: %USERPROFILE%\.tauri\markforge.key (generate once with
#   npx tauri signer generate -w "$env:USERPROFILE\.tauri\markforge.key")
param([string]$Notes = "Bug fixes and improvements.")
$ErrorActionPreference = "Stop"

$version = (Get-Content VERSION -Raw).Trim()
$keyPath = "$env:USERPROFILE\.tauri\markforge.key"
if (-not (Test-Path $keyPath)) {
    throw "Signing key not found at $keyPath. Generate one with: npx tauri signer generate -w `"$keyPath`""
}

$repo = "https://github.com/rickcollette/markforge"
$exe = "packages/windows/x64/markforge-$version-windows-x64.exe"
$appimage = "packages/linux/amd64/markforge-$version-linux-amd64.AppImage"

function Sign-Artifact($file) {
    if (-not (Test-Path $file)) {
        Write-Host "==> SKIP (not built): $file" -ForegroundColor Yellow
        return $null
    }
    # '""' resolves to an empty password for keys generated without one.
    npx tauri signer sign -f $keyPath --password '""' $file | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Signing failed for $file" }
    Write-Host "==> signed $file" -ForegroundColor Green
    (Get-Content "$file.sig" -Raw).Trim()
}

$platforms = [ordered]@{}
$exeSig = Sign-Artifact $exe
if ($exeSig) {
    $platforms["windows-x86_64"] = [ordered]@{
        signature = $exeSig
        url       = "$repo/releases/download/v$version/$(Split-Path -Leaf $exe)"
    }
}
$appimageSig = Sign-Artifact $appimage
if ($appimageSig) {
    $platforms["linux-x86_64"] = [ordered]@{
        signature = $appimageSig
        url       = "$repo/releases/download/v$version/$(Split-Path -Leaf $appimage)"
    }
}
if ($platforms.Count -eq 0) { throw "No artifacts found for version $version. Build packages first." }

$manifest = [ordered]@{
    version   = $version
    notes     = $Notes
    pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = $platforms
}

$json = $manifest | ConvertTo-Json -Depth 4
$utf8 = New-Object Text.UTF8Encoding $false
[IO.File]::WriteAllText("$PWD/docs/latest.json", $json, $utf8)
[IO.File]::WriteAllText("$PWD/packages/latest.json", $json, $utf8)
Write-Host "==> docs/latest.json + packages/latest.json (v$version)" -ForegroundColor Green
