param(
    [Parameter(Position=0)] [string]$Command = "list",
    [Parameter(Position=1)] [string]$ProjectId,
    [Parameter(Position=2)] [string]$Policy
)

$port = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "7700" }
$base = "http://127.0.0.1:$port"

switch ($Command) {
    "list" {
        $resp = Invoke-RestMethod -Uri "$base/policy" -Method GET -ErrorAction Stop
        $resp | ConvertTo-Json -Depth 5
    }
    "set" {
        if (-not $ProjectId -or -not $Policy) {
            Write-Error "Usage: ai-policy.ps1 set <projectId> <policy>"
            exit 1
        }
        $body = @{ projectId = $ProjectId; policy = $Policy } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "$base/policy" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
        $resp | ConvertTo-Json -Depth 5
    }
    default {
        Write-Error "Unknown command: $Command. Use: list | set"
        exit 1
    }
}
