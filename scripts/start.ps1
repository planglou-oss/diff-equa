param([switch]$OpenBrowser)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodeExe = $nodeCommand.Source
} else {
    $nodeExe = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if (-not (Test-Path -LiteralPath $nodeExe)) { throw 'Install Node.js 22.12+ and add it to PATH. See README.md.' }
}
$env:PATH = (Split-Path $nodeExe -Parent) + [System.IO.Path]::PathSeparator + $env:PATH
$goExe = Join-Path $projectRoot '.tools/go/bin/go.exe'
if (-not (Test-Path -LiteralPath $goExe)) {
    $goCommand = Get-Command go -ErrorAction SilentlyContinue
    if (-not $goCommand) { throw 'Install Go 1.26+ and add it to PATH. See README.md.' }
    $goExe = $goCommand.Source
}
$env:GOCACHE = Join-Path $projectRoot '.tools/gocache'
$env:GOMODCACHE = Join-Path $projectRoot '.tools/gomod'
$localNpm = Join-Path $projectRoot '.tools/package/bin/npm-cli.js'
Push-Location -LiteralPath (Join-Path $projectRoot 'frontend')
try {
    if (Test-Path -LiteralPath $localNpm) {
        if (-not (Test-Path node_modules)) { & $nodeExe $localNpm ci --cache ../.tools/npm-cache --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } }
        & $nodeExe $localNpm run build
    } else {
        if (-not (Test-Path node_modules)) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } }
        & npm.cmd run build
    }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }
Push-Location -LiteralPath (Join-Path $projectRoot 'backend')
try {
    & $goExe build -o ../.tools/eemath.exe ./cmd/server
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
} finally { Pop-Location }
Write-Host 'Open http://127.0.0.1:8080 in your browser. Press Ctrl+C to stop.'
$browserJob = $null
if ($OpenBrowser) {
    $browserJob = Start-Job -ArgumentList 'http://127.0.0.1:8080' -ScriptBlock {
        param($url)
        $deadline = [DateTime]::UtcNow.AddSeconds(60)
        while ([DateTime]::UtcNow -lt $deadline) {
            $ready = $false
            try {
                $response = Invoke-WebRequest -Uri "$url/api/v1/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
                $ready = $response.StatusCode -eq 200
            } catch { }
            if ($ready) {
                Start-Process -FilePath $url
                return
            }
            Start-Sleep -Milliseconds 500
        }
    }
}
$serverExitCode = 0
try {
    & (Join-Path $projectRoot '.tools/eemath.exe')
    $serverExitCode = $LASTEXITCODE
} finally {
    if ($browserJob) {
        Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
        Receive-Job -Job $browserJob -ErrorAction SilentlyContinue
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
}
exit $serverExitCode
