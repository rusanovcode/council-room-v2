param(
    [Parameter(Position=0, Mandatory=$true)] [string]$Prompt,
    [Parameter(Position=1)] [string]$Cwd = (Get-Location).Path,
    [string]$ProjectId = ""
)

$port = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "7700" }
$url  = "http://127.0.0.1:$port/run"

$body = @{
    service   = "claude"
    prompt    = $Prompt
    cwd       = $Cwd
    projectId = $ProjectId
} | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Output $resp.output
    if ($resp.limitDetected) { Write-Warning "Rate limit detected." }
    exit $resp.exitCode
} catch {
    Write-Error "Run failed: $_"
    exit 1
}
