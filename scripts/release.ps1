# One-command release: builds every target, signs update artifacts, writes
# the update manifest, refreshes the website, verifies the pipeline, and
# (optionally) publishes to GitHub.
#
#   ./scripts/release.ps1 -Notes "What changed"                # build + stage everything locally
#   ./scripts/release.ps1 -Notes "..." -Publish -PushPages     # full release to GitHub
#   ./scripts/release.ps1 -Bump minor -Notes "..."             # 1.0.x -> 1.1.0
#
# Individual steps can also be run on their own:
#   build-windows-package.ps1 / build-linux-packages.ps1 [-Target <distro>]
#   make-update-manifest.ps1 / update-website.ps1
#   publish-release.ps1 / verify-updater.ps1 [-Online]
param(
    [ValidateSet("major", "minor", "patch", "none")]
    [string]$Bump = "patch",
    [string]$Notes = "Bug fixes and improvements.",
    [switch]$Publish,
    [switch]$PushPages,
    [switch]$SkipWindows,
    [switch]$SkipLinux
)
$ErrorActionPreference = "Stop"

if ($Bump -ne "none") { ./scripts/bump-version.ps1 $Bump }
$version = (Get-Content VERSION -Raw).Trim()
Write-Host "=== Releasing MarkForge v$version ===" -ForegroundColor Cyan

if (-not $SkipWindows) { ./scripts/build-windows-package.ps1 -NoBump }
if (-not $SkipLinux)   { ./scripts/build-linux-packages.ps1 -NoBump }

./scripts/make-update-manifest.ps1 -Notes $Notes
./scripts/update-website.ps1
./scripts/verify-updater.ps1

if ($Publish) {
    ./scripts/publish-release.ps1 -Notes $Notes -PushPages:$PushPages
    if ($PushPages) { ./scripts/verify-updater.ps1 -Online }
} else {
    Write-Host ""
    Write-Host "Staged locally. To publish:" -ForegroundColor Yellow
    Write-Host "  ./scripts/publish-release.ps1 -Notes `"$Notes`" -PushPages"
    Write-Host "  ./scripts/verify-updater.ps1 -Online   # after Pages deploys"
}
