param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodeExe = $nodeCommand.Source
} else {
    $nodeExe = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if (-not (Test-Path -LiteralPath $nodeExe)) { throw 'Install Node.js 22.12+ with npm before building a package.' }
}
$goExe = Join-Path $projectRoot '.tools/go/bin/go.exe'
if (-not (Test-Path -LiteralPath $goExe)) {
    $goCommand = Get-Command go -ErrorAction SilentlyContinue
    if (-not $goCommand) { throw 'Install Go 1.26+ before building a package.' }
    $goExe = $goCommand.Source
}
$localNpm = Join-Path $projectRoot '.tools/package/bin/npm-cli.js'
$releaseRoot = Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
$buildName = 'EE-Math-Windows-x64-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$stagingRoot = Join-Path $releaseRoot $buildName
if (Test-Path -LiteralPath $stagingRoot) { throw "Package path already exists: $stagingRoot" }
$packageRoot = Join-Path $stagingRoot 'EE-Math'
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

# Build-time tools and local credentials are never copied into the package.
$names = @('PATH', 'GOOS', 'GOARCH', 'CGO_ENABLED', 'GOCACHE', 'GOMODCACHE')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:PATH = (Split-Path $nodeExe -Parent) + [IO.Path]::PathSeparator + $env:PATH
    $env:GOCACHE = Join-Path $projectRoot '.tools/gocache'
    $env:GOMODCACHE = Join-Path $projectRoot '.tools/gomod'
    $env:GOOS = 'windows'
    $env:GOARCH = 'amd64'
    $env:CGO_ENABLED = '0'
    Push-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    try {
        if (Test-Path -LiteralPath $localNpm) {
            if (-not (Test-Path node_modules)) {
                & $nodeExe $localNpm ci --cache ../.tools/npm-cache --no-audit --no-fund
                if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
            }
            & $nodeExe $localNpm run build
        } else {
            if (-not (Test-Path node_modules)) {
                & npm.cmd ci
                if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
            }
            & npm.cmd run build
        }
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    } finally { Pop-Location }
    Push-Location -LiteralPath (Join-Path $projectRoot 'backend')
    try {
        & $goExe build -trimpath -ldflags '-s -w' -o (Join-Path $packageRoot 'EE-Math.exe') ./cmd/server
        if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
    } finally { Pop-Location }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}

# Explicit allowlist: no local data/, .env, source tooling or user history.
$frontendRoot = Join-Path $packageRoot 'frontend'
New-Item -ItemType Directory -Path $frontendRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'frontend/dist') -Destination $frontendRoot -Recurse
foreach ($name in @('exam201_solutions.html', '.env.example')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $packageRoot
}
foreach ($name in @('START.bat', 'start.ps1', 'README.txt')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "portable/$name") -Destination $packageRoot
}
$reviewRoot = Join-Path $packageRoot 'reviews'
New-Item -ItemType Directory -Path $reviewRoot -Force | Out-Null
foreach ($name in @('LAPLACE_REVIEW.md', 'Z_TRANSFORM_REVIEW.md', 'BVP_REVIEW.md', 'laplace-review.json', 'z-transform-review.json', 'bvp-review.json')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot "docs/$name") -Destination $reviewRoot
}
$zipPath = Join-Path $releaseRoot ($buildName + '.zip')
Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($zipPath + '.sha256', "$hash  $([IO.Path]::GetFileName($zipPath))`r`n", [Text.Encoding]::ASCII)
Write-Host "Package: $zipPath"
Write-Host "SHA256: $hash"
