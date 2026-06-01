param(
    [Parameter(Position=0)]
    [ValidateSet("set","get","delete","status")]
    [string]$Action = "status",

    [string]$Service,   # claude | codex
    [string]$Profile = "apikey",
    [string]$Key
)

$port = if ($env:GATEWAY_PORT) { $env:GATEWAY_PORT } else { "7700" }
$base = "http://127.0.0.1:$port"

switch ($Action) {
    "set" {
        if (-not $Service) { Write-Error "–Service required"; exit 1 }
        if (-not $Key) {
            $secKey = Read-Host -Prompt "Enter API key for $Service/$Profile" -AsSecureString
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secKey)
            $Key  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
        $body = @{ service = $Service; profile = $Profile; key = $Key } | ConvertTo-Json
        try {
            $resp = Invoke-RestMethod -Uri "$base/api-key" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
            Write-Host "OK — API key set for $Service/$Profile" -ForegroundColor Green
        } catch {
            Write-Error "Failed: $_"
            exit 1
        }
    }
    "get" {
        if (-not $Service) { Write-Error "–Service required"; exit 1 }
        try {
            $resp = Invoke-RestMethod -Uri "$base/api-key?service=$Service&profile=$Profile" -Method GET -ErrorAction Stop
            $setStr = if ($resp.set) { "SET" } else { "NOT SET" }
            Write-Host "$Service/$Profile : $setStr"
        } catch {
            Write-Error "Failed: $_"
            exit 1
        }
    }
    "delete" {
        if (-not $Service) { Write-Error "–Service required"; exit 1 }
        $body = @{ service = $Service; profile = $Profile } | ConvertTo-Json
        try {
            Invoke-RestMethod -Uri "$base/api-key" -Method DELETE -Body $body -ContentType "application/json" -ErrorAction Stop | Out-Null
            Write-Host "OK — API key deleted for $Service/$Profile" -ForegroundColor Yellow
        } catch {
            Write-Error "Failed: $_"
            exit 1
        }
    }
    "status" {
        try {
            $resp = Invoke-RestMethod -Uri "$base/status" -Method GET -ErrorAction Stop
            Write-Host ""
            Write-Host "API key profiles" -ForegroundColor Cyan
            Write-Host ""
            foreach ($svc in @("claude","codex")) {
                $profs = $resp.profiles.$svc
                foreach ($p in $profs) {
                    if ($p.mode -eq "api") {
                        $keyStr = if ($p.apiKeySet) { "[KEY SET]" } else { "[NO KEY]" }
                        $active = if ($resp.active.$svc -eq $p.id) { " <-- active" } else { "" }
                        Write-Host ("  {0,-8} {1,-10} {2} {3}" -f $svc, $p.id, $keyStr, $active)
                    }
                }
            }
            Write-Host ""
            Write-Host "To activate:  Invoke-RestMethod -Uri $base/switch -Method POST -Body ('{""service"":""claude"",""profile"":""apikey""}') -ContentType application/json"
            Write-Host ""
        } catch {
            Write-Error "Gateway unavailable: $_"
            exit 1
        }
    }
}
