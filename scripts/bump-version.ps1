# Bumps the app version and syncs it everywhere it is declared.
#   ./scripts/bump-version.ps1            # 1.0.0 -> 1.0.1 (patch)
#   ./scripts/bump-version.ps1 minor      # 1.0.1 -> 1.1.0
#   ./scripts/bump-version.ps1 major      # 1.1.0 -> 2.0.0
#   ./scripts/bump-version.ps1 -Set 1.2.3 # explicit version
# VERSION is the single source of truth; this script propagates it to
# src-tauri/tauri.conf.json, package.json, and src-tauri/Cargo.toml.
# (Cargo.lock is refreshed automatically by the next cargo build.)
param(
    [ValidateSet("major", "minor", "patch")]
    [string]$Part = "patch",
    [string]$Set
)
$ErrorActionPreference = "Stop"

$utf8 = New-Object Text.UTF8Encoding $false
$old = (Get-Content VERSION -Raw).Trim()

if ($Set) {
    if ($Set -notmatch '^\d+\.\d+\.\d+$') { throw "-Set must be semver (got '$Set')" }
    $new = $Set
} else {
    $p = $old.Split(".")
    switch ($Part) {
        "major" { $new = "$([int]$p[0] + 1).0.0" }
        "minor" { $new = "$($p[0]).$([int]$p[1] + 1).0" }
        "patch" { $new = "$($p[0]).$($p[1]).$([int]$p[2] + 1)" }
    }
}

[IO.File]::WriteAllText("$PWD/VERSION", $new, $utf8)

# tauri.conf.json / package.json: replace only the top-level "version" key.
foreach ($f in "src-tauri/tauri.conf.json", "package.json") {
    $text = [IO.File]::ReadAllText("$PWD/$f")
    $text = $text -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$new`""
    [IO.File]::WriteAllText("$PWD/$f", $text, $utf8)
}

# Cargo.toml: only the [package] version line starts at column 0.
$cargo = [IO.File]::ReadAllText("$PWD/src-tauri/Cargo.toml")
$cargo = $cargo -replace '(?m)^version = "\d+\.\d+\.\d+"', "version = `"$new`""
[IO.File]::WriteAllText("$PWD/src-tauri/Cargo.toml", $cargo, $utf8)

Write-Host "==> version: $old -> $new" -ForegroundColor Green
