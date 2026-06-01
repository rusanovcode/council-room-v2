param(
    [Parameter(Position=0, Mandatory=$true)] [string]$Service,
    [Parameter(Position=1)] [string]$Profile = "acc1"
)

$port = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "7700" }
$url  = "http://127.0.0.1:$port/kill"

$body = @{ service = $Service; profile = $Profile } | ConvertTo-Json
try {
    $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    $resp | ConvertTo-Json
} catch {
    Write-Error "Kill failed: $_"
    exit 1
}
