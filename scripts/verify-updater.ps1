# Verifies the in-app updater pipeline is consistent before (and after)
# publishing a release:
#   - VERSION matches tauri.conf.json, package.json, Cargo.toml
#   - docs/latest.json exists, parses, and matches VERSION
#   - manifest signatures were made with the key matching the pubkey baked
#     into tauri.conf.json (minisign key IDs compared)
#   - artifacts referenced by the manifest exist locally with .sig files
#   - updater endpoints include the GitHub Pages manifest URL
#   - with -Online: the published manifest and asset URLs respond (run after
#     publish-release.ps1 and the Pages deploy)
param([switch]$Online)
$ErrorActionPreference = "Stop"
$failures = @()

function Check($label, [bool]$ok, $detail = "") {
    if ($ok) {
        Write-Host "  PASS  $label" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  $label  $detail" -ForegroundColor Red
        $script:failures += $label
    }
}

# minisign material: base64(file) -> line 2 is base64(alg[2] + keyId[8] + ...)
function KeyId($base64File) {
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64File))
    $line = @($text -split "`n" | Where-Object { $_.Trim() -and $_ -notmatch "comment" })[0].Trim()
    $bytes = [Convert]::FromBase64String($line)
    [BitConverter]::ToString($bytes[2..9])
}

$version = (Get-Content VERSION -Raw).Trim()
Write-Host "Verifying updater pipeline for v$version" -ForegroundColor Cyan

# 1. Version sync.
$conf = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$cargo = (Select-String -Path src-tauri/Cargo.toml -Pattern '^version = "(.+)"').Matches[0].Groups[1].Value
Check "tauri.conf.json version ($($conf.version))" ($conf.version -eq $version)
Check "package.json version ($($pkg.version))" ($pkg.version -eq $version)
Check "Cargo.toml version ($cargo)" ($cargo -eq $version)

# 2. Manifest.
Check "docs/latest.json exists" (Test-Path docs/latest.json)
$manifest = Get-Content docs/latest.json -Raw | ConvertFrom-Json
Check "manifest version ($($manifest.version))" ($manifest.version -eq $version)
$platformNames = @($manifest.platforms.PSObject.Properties.Name)
Check "manifest has platforms ($($platformNames -join ', '))" ($platformNames.Count -gt 0)

# 3. Key pairing: app pubkey vs local key vs manifest signatures.
$pubKeyId = KeyId $conf.plugins.updater.pubkey
$localPub = "$env:USERPROFILE\.tauri\markforge.key.pub"
if (Test-Path $localPub) {
    # The .pub file written by `tauri signer generate` is already base64.
    $localB64 = (Get-Content $localPub -Raw).Trim()
    Check "app pubkey matches local signing key" ((KeyId $localB64) -eq $pubKeyId)
} else {
    Check "local signing key present" $false "missing $localPub"
}
foreach ($name in $platformNames) {
    $sigKeyId = KeyId $manifest.platforms.$name.signature
    Check "$name signature signed by app pubkey" ($sigKeyId -eq $pubKeyId)
}

# 4. Local artifacts + sigs.
foreach ($name in $platformNames) {
    $url = $manifest.platforms.$name.url
    $leaf = Split-Path -Leaf $url
    $local = Get-ChildItem -Recurse -File packages -Filter $leaf -ErrorAction SilentlyContinue | Select-Object -First 1
    Check "$name artifact built ($leaf)" ($null -ne $local)
    if ($local) { Check "$name .sig present" (Test-Path "$($local.FullName).sig") }
    Check "$name URL uses tag v$version" ($url -match "/releases/download/v$([regex]::Escape($version))/")
}

# 5. Endpoints.
$endpoints = @($conf.plugins.updater.endpoints)
Check "update manifest endpoint configured" ($endpoints -contains "https://markforge.rickcollette.org/latest.json")

# 6. Online checks (after publishing).
if ($Online) {
    foreach ($url in $endpoints) {
        try {
            $resp = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 20
            Check "endpoint live: $url" ($resp.StatusCode -eq 200)
        } catch { Check "endpoint live: $url" $false $_.Exception.Message }
    }
    foreach ($name in $platformNames) {
        $url = $manifest.platforms.$name.url
        try {
            $resp = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 5
            Check "asset live: $name" ($resp.StatusCode -eq 200)
        } catch { Check "asset live: $name" $false $_.Exception.Message }
    }
}

Write-Host ""
if ($failures.Count -gt 0) {
    throw "Updater verification failed: $($failures.Count) check(s). See FAIL lines above."
}
Write-Host "==> All updater checks passed" -ForegroundColor Green
