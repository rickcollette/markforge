# Builds MarkForge Linux packages in Docker and collects the artifacts into
#   packages/<os>/<arch>/markforge-<version>-<os>-<arch>.<ext>
# Run from the repository root. VERSION is the single source of truth and
# must match src-tauri/tauri.conf.json.
# The patch version is bumped automatically; pass -NoBump to rebuild the
# current version (e.g. when packaging other platforms at the same version).
# -Target builds a single distro: ubuntu-24.04 | debian-12 | all (default).
param(
    [switch]$NoBump,
    [ValidateSet("all", "ubuntu-24.04", "debian-12")]
    [string]$Target = "all"
)
$ErrorActionPreference = "Stop"

if (-not $NoBump) { ./scripts/bump-version.ps1 }
$version = (Get-Content VERSION -Raw).Trim()
$tauriVersion = (Get-Content src-tauri/tauri.conf.json | ConvertFrom-Json).version
if ($version -ne $tauriVersion) {
    throw "VERSION ($version) does not match src-tauri/tauri.conf.json ($tauriVersion). Sync them before building."
}
$arch = "amd64"

$targets = @(
    @{ Os = "ubuntu-24.04"; Dockerfile = "docker/Dockerfile.ubuntu-24.04"; Tag = "markforge-build:ubuntu24"; AppImage = $false },
    @{ Os = "debian-12";    Dockerfile = "docker/Dockerfile.debian-12";    Tag = "markforge-build:debian12"; AppImage = $true }
) | Where-Object { $Target -eq "all" -or $_.Os -eq $Target }

foreach ($t in $targets) {
    Write-Host "==> Building $($t.Os)" -ForegroundColor Cyan
    docker build -f $t.Dockerfile -t $t.Tag .
    if ($LASTEXITCODE -ne 0) { throw "Docker build failed for $($t.Os)" }

    $outDir = "packages/$($t.Os)/$arch"
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    $container = "mf-extract"
    cmd /c "docker rm -f $container >nul 2>&1"
    docker create --name $container $t.Tag | Out-Null

    $deb = "$outDir/markforge-$version-$($t.Os)-$arch.deb"
    docker cp "${container}:/app/src-tauri/target/release/bundle/deb/MarkForge_${version}_${arch}.deb" $deb
    Write-Host "==> $deb" -ForegroundColor Green

    if ($t.AppImage) {
        # The AppImage bundles WebKitGTK and all other libraries; built on the
        # oldest supported base (Debian 12) for maximum glibc compatibility.
        $appimage = "packages/linux/$arch/markforge-$version-linux-$arch.AppImage"
        New-Item -ItemType Directory -Force -Path "packages/linux/$arch" | Out-Null
        docker cp "${container}:/app/src-tauri/target/release/bundle/appimage/MarkForge_${version}_${arch}.AppImage" $appimage
        Write-Host "==> $appimage" -ForegroundColor Green
    }

    docker rm $container | Out-Null
}
