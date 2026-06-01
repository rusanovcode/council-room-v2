param(
    [Parameter(Position=0, Mandatory=$true)] [string]$ProjectId,
    [Parameter(Position=1)] [string]$Cwd = (Get-Location).Path
)

if ([Console]::IsInputRedirected) {
    Write-Error "ai-register.ps1 requires an interactive terminal. Piped/automated input is not allowed."
    exit 1
}

$port = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "7700" }
$url  = "http://127.0.0.1:$port/register"

$body = @{ projectId = $ProjectId; cwd = $Cwd } | ConvertTo-Json
try {
    $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    $resp | ConvertTo-Json -Depth 5
} catch {
    Write-Error "Registration failed: $_"
    exit 1
}
