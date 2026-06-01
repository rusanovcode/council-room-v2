$port = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "7700" }
$url  = "http://127.0.0.1:$port/status"
try {
    $resp = Invoke-RestMethod -Uri $url -Method GET -ErrorAction Stop
    $resp | ConvertTo-Json -Depth 5
} catch {
    Write-Error "Gateway unavailable at $url : $_"
    exit 1
}
