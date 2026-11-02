param(
    [Parameter(Mandatory = $true)][string]$ZipPath,
    [ValidateRange(1024, 65535)][int]$Port = 18082
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$ZipPath = (Resolve-Path -LiteralPath $ZipPath).Path
$testRoot = Join-Path $projectRoot ('.tools/portable-smoke-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$extractRoot = Join-Path $testRoot 'fresh package path'
Expand-Archive -LiteralPath $ZipPath -DestinationPath $extractRoot
$packageRoot = Join-Path $extractRoot 'EE-Math'

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
    foreach ($entry in $archive.Entries) {
        $name = $entry.FullName.Replace('\', '/')
        if ($name -match '(^|/)(data|\.tools|node_modules)/|(^|/)\.env$|\.db(-shm|-wal)?$') {
            throw "Private/development file in package: $name"
        }
    }
} finally { $archive.Dispose() }
foreach ($required in @('EE-Math.exe', 'START.bat', 'start.ps1', 'README.txt', '.env.example', 'frontend/dist/index.html')) {
    if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $required))) { throw "Missing package file: $required" }
}
if ((Get-FileHash (Join-Path $projectRoot 'exam201_solutions.html')).Hash -ne (Get-FileHash (Join-Path $packageRoot 'exam201_solutions.html')).Hash) {
    throw 'Legacy source bytes changed in the package'
}
if (Test-Path -LiteralPath (Join-Path $packageRoot 'data')) { throw 'Expected fresh package without a database' }

$oldPath = $env:PATH
$oldKey = $env:GEMINI_API_KEY
$oldModel = $env:GEMINI_MODEL
$launcher = $null
$conflictProcess = $null
$powerShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$stdout = Join-Path $testRoot 'stdout.log'
$stderr = Join-Path $testRoot 'stderr.log'
$scriptPath = Join-Path $packageRoot 'start.ps1'
try {
    $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
    $env:GEMINI_API_KEY = ''
    $env:GEMINI_MODEL = ''
    foreach ($command in @('node', 'npm', 'go')) {
        if (Get-Command $command -ErrorAction SilentlyContinue) { throw "Unexpected build tool on test PATH: $command" }
    }
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $scriptPath + '"'), '-NoBrowser', '-Port', $Port)
    $batchCommand = '""' + (Join-Path $packageRoot 'START.bat') + '" -NoBrowser -Port ' + $Port + '"'
    $launcher = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32/cmd.exe') -ArgumentList @('/d', '/s', '/c', $batchCommand) -WorkingDirectory $testRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $baseURL = "http://127.0.0.1:$Port"
    $deadline = [DateTime]::UtcNow.AddSeconds(90)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        $launcher.Refresh()
        if ($launcher.HasExited) { throw ('Portable launcher exited: ' + [IO.File]::ReadAllText($stderr)) }
        try { $ready = (Invoke-RestMethod "$baseURL/api/v1/health" -TimeoutSec 2).ok } catch { }
        if ($ready) { break }
        Start-Sleep -Milliseconds 200
    }
    if (-not $ready) { throw 'Portable server did not become ready' }
    $catalog = Invoke-RestMethod "$baseURL/api/v1/catalog"
    $total = ($catalog.topics | Measure-Object -Property totalCount -Sum).Sum
    if ($total -ne 427 -or $catalog.aiAvailable) { throw "Unexpected catalog: $total questions, AI enabled $($catalog.aiAvailable)" }

    $verified = 0
    foreach ($file in @('laplace_explanations.json', 'z_transform_explanations.json', 'bvp_explanations.json')) {
        $items = Get-Content -LiteralPath (Join-Path $projectRoot "backend/internal/studycontent/$file") -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($item in $items) {
            $solution = Invoke-RestMethod "$baseURL/api/v1/questions/$($item.questionId)/solutions"
            if ($solution.aiExplanation.bodyHtml -cne $item.bodyHtml -or $solution.aiExplanation.reviewStatus -ne $item.reviewStatus) {
                throw "Incorrect seeded explanation: $($item.questionId)"
            }
            $verified++
        }
    }
    if ($verified -ne 123) { throw "Unexpected authored coverage $verified" }
    $index = Invoke-WebRequest "$baseURL/" -UseBasicParsing
    if ($index.StatusCode -ne 200) { throw 'Frontend index unavailable' }
    $assets = [regex]::Matches($index.Content, '(?:src|href)="(/assets/[^"]+)"')
    if ($assets.Count -lt 2) { throw 'Frontend entry assets missing' }
    foreach ($match in $assets) {
        if ((Invoke-WebRequest ($baseURL + $match.Groups[1].Value) -UseBasicParsing).StatusCode -ne 200) { throw 'Frontend asset unavailable' }
    }
    $detail = Invoke-RestMethod "$baseURL/api/v1/questions/ee201-t09-q025/solutions"
    foreach ($url in @($detail.original.url, '/mascot.png')) {
        $image = Invoke-WebRequest ($baseURL + $url) -UseBasicParsing
        if ($image.StatusCode -ne 200 -or $image.Headers['Content-Type'] -notmatch 'image/png') { throw "PNG unavailable: $url" }
    }
    $font = Get-ChildItem -LiteralPath (Join-Path $packageRoot 'frontend/dist/assets') -Filter '*.woff2' | Select-Object -First 1
    if ((Invoke-WebRequest "$baseURL/assets/$($font.Name)" -UseBasicParsing).StatusCode -ne 200) { throw 'Bundled font unavailable' }
    if (-not (Test-Path -LiteralPath (Join-Path $packageRoot 'data/eemath.db'))) { throw 'Fresh database not created' }

    # A second launch must fail safely instead of opening/stopping the first app.
    $conflictError = Join-Path $testRoot 'conflict-stderr.log'
    $conflictProcess = Start-Process -FilePath $powerShell -ArgumentList $arguments -WorkingDirectory $testRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'conflict-stdout.log') -RedirectStandardError $conflictError
    if (-not $conflictProcess.WaitForExit(15000)) { throw 'Second launch did not fail promptly' }
    if ($conflictProcess.ExitCode -eq 0 -or [IO.File]::ReadAllText($conflictError) -notmatch 'already in use') { throw 'Port conflict not reported clearly' }
    if (-not (Invoke-RestMethod "$baseURL/api/v1/health").ok) { throw 'First app disrupted by second launch' }
    Write-Host 'PASS: START.bat starts the ZIP under Windows PowerShell 5.1 with no Node/npm/Go on PATH and no API key.'
    Write-Host 'PASS: 427 questions, 123 authored explanations/statuses, web assets, fonts and images.'
    Write-Host 'PASS: fresh database created, no personal files shipped, second-launch port conflict handled.'
    Write-Host "Smoke-test logs: $testRoot"
} finally {
    $env:PATH = $oldPath
    $env:GEMINI_API_KEY = $oldKey
    $env:GEMINI_MODEL = $oldModel
    if ($conflictProcess) {
        $conflictProcess.Refresh()
        if (-not $conflictProcess.HasExited) { Stop-Process -Id $conflictProcess.Id -ErrorAction SilentlyContinue }
    }
    if ($launcher) {
        # The unique extracted path identifies only the server started by this test.
        $ownedServers = @(Get-CimInstance Win32_Process -Filter "Name = 'EE-Math.exe'" | Where-Object { $_.ExecutablePath -eq (Join-Path $packageRoot 'EE-Math.exe') })
        foreach ($server in $ownedServers) { Stop-Process -Id $server.ProcessId -ErrorAction SilentlyContinue }
        $null = $launcher.WaitForExit(5000)
        $launcher.Refresh()
        if (-not $launcher.HasExited) { Stop-Process -Id $launcher.Id -ErrorAction SilentlyContinue }
    }
}
