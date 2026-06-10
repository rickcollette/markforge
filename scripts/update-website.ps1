# Updates the GitHub Pages site (docs/) so all download links, file names,
# and the "Latest version" badge match the current VERSION.
# Idempotent; run any time after bumping the version.
$ErrorActionPreference = "Stop"

$version = (Get-Content VERSION -Raw).Trim()
$utf8 = New-Object Text.UTF8Encoding $false
$file = "docs/index.html"

$html = [IO.File]::ReadAllText("$PWD/$file")
$html = $html -replace "markforge-\d+\.\d+\.\d+-", "markforge-$version-"
$html = $html -replace "releases/download/v\d+\.\d+\.\d+/", "releases/download/v$version/"
$html = $html -replace '(id="latest-version">)\d+\.\d+\.\d+(<)', "`${1}$version`$2"
[IO.File]::WriteAllText("$PWD/$file", $html, $utf8)

Write-Host "==> $file updated to v$version" -ForegroundColor Green
Write-Host "    (commit + push docs/ to deploy via GitHub Pages)"
