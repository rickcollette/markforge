# Publishes the current version to GitHub:
#   - creates (or updates) the release v<version> on rickcollette/markforge
#   - uploads all packages, .sig files, and latest.json as release assets
#   - with -PushPages, also commits and pushes docs/ so GitHub Pages serves
#     the new manifest and download links
# Requires: GitHub CLI (gh) authenticated, and the repo cloned with a remote.
param(
    [string]$Notes = "Bug fixes and improvements.",
    [switch]$PushPages
)
$ErrorActionPreference = "Stop"

$version = (Get-Content VERSION -Raw).Trim()
$tag = "v$version"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is not installed. Install from https://cli.github.com/ and run 'gh auth login'."
}
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Not a git repository. Initialize and add the GitHub remote first (git init; git remote add origin https://github.com/rickcollette/markforge.git)."
}

# Assets for this version, plus the manifest copy for the fallback endpoint.
$assets = @(Get-ChildItem -Recurse -File packages |
    Where-Object { $_.Name -like "*$version*" } |
    ForEach-Object FullName)
if (Test-Path packages/latest.json) { $assets += (Resolve-Path packages/latest.json).Path }
if ($assets.Count -eq 0) { throw "No assets found for $version. Build packages first." }

Write-Host "==> Publishing $tag with $($assets.Count) assets" -ForegroundColor Cyan
gh release view $tag *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Host "==> Release $tag exists; uploading assets (clobber)" -ForegroundColor Yellow
    gh release upload $tag @assets --clobber
    if ($LASTEXITCODE -ne 0) { throw "gh release upload failed" }
} else {
    gh release create $tag @assets --title "MarkForge $version" --notes $Notes
    if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
}
Write-Host "==> https://github.com/rickcollette/markforge/releases/tag/$tag" -ForegroundColor Green

if ($PushPages) {
    Write-Host "==> Pushing docs/ (GitHub Pages)" -ForegroundColor Cyan
    git add docs
    git commit -m "Release ${tag}: update manifest and download links"
    git push
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    Write-Host "==> Pages will redeploy automatically" -ForegroundColor Green
} else {
    Write-Host "    Remember: commit + push docs/ so Pages serves the new latest.json." -ForegroundColor Yellow
}
