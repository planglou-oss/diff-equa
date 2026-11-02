param(
    [ValidateRange(1, 65535)][int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$packageRoot = $PSScriptRoot
Set-Location -LiteralPath $packageRoot
$executable = Join-Path $packageRoot 'EE-Math.exe'
foreach ($required in @($executable, (Join-Path $packageRoot 'frontend/dist/index.html'), (Join-Path $packageRoot 'exam201_solutions.html'))) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw 'Package files are missing. Extract the entire ZIP before opening START.bat.'
    }
}

# Avoid opening an unrelated app if this port is already in use.
$probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $probe.Start()
} catch {
    throw "Port $Port is already in use. Close the other EE Math window or run .\START.bat -Port 8081."
} finally {
    $probe.Stop()
}

$url = "http://127.0.0.1:$Port"
Write-Host 'EE Math I - Windows portable edition'
Write-Host 'No Node.js, Go, installation, or API key is required.'
Write-Host 'The first launch imports the question images. Please wait.'
Write-Host "Open $url in your browser. Keep this window open. Press Ctrl+C to stop."
$browserJob = $null
if (-not $NoBrowser) {
    $browserJob = Start-Job -ArgumentList $url -ScriptBlock {
        param($url)
        $deadline = [DateTime]::UtcNow.AddSeconds(120)
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
        Write-Warning "Automatic browser opening timed out. Try $url after the server is ready."
    }
}

$serverExitCode = 0
try {
    & $executable -addr "127.0.0.1:$Port"
    $serverExitCode = $LASTEXITCODE
} finally {
    if ($browserJob) {
        Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
        Receive-Job -Job $browserJob -ErrorAction SilentlyContinue
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
}
exit $serverExitCode
