param(
    [string]$Period = "today"   # today | week | all
)

function Get-UsageVal {
    param($obj, [string]$prop)
    if ($null -eq $obj) { return 0 }
    $v = $obj.$prop
    if ($null -eq $v) { return 0 }
    return [int]$v
}

function Get-TokenStats {
    param([string]$Label, [string]$ProjectsDir)

    if (-not (Test-Path $ProjectsDir)) {
        return [PSCustomObject]@{
            Account   = $Label
            "Input K" = 0; "Output K" = 0
            "CacheR K"= 0; "CacheW K"= 0
            Sessions  = 0; "Cost USD"= 0
        }
    }

    $cutoff = switch ($Period) {
        "today" { (Get-Date).Date }
        "week"  { (Get-Date).Date.AddDays(-7) }
        default { [DateTime]::MinValue }
    }

    $inTok = 0; $outTok = 0; $cacheRead = 0; $cacheWrite = 0
    $sessions = 0; $costUSD = 0

    Get-ChildItem -Path $ProjectsDir -Recurse -Filter "*.jsonl" -ErrorAction SilentlyContinue | ForEach-Object {
        $content = Get-Content $_.FullName -Encoding UTF8 -ErrorAction SilentlyContinue
        if (-not $content) { return }
        foreach ($line in $content) {
            if (-not $line -or $line.Trim() -eq "") { continue }
            try {
                $ev = $line | ConvertFrom-Json -ErrorAction Stop

                if ($ev.timestamp) {
                    $ts = [DateTime]::Parse($ev.timestamp)
                    if ($ts -lt $cutoff) { continue }
                }

                $usage = $null
                if ($ev.message -and $ev.message.usage) {
                    $usage = $ev.message.usage
                }
                if ($usage) {
                    $inTok      += Get-UsageVal $usage "input_tokens"
                    $outTok     += Get-UsageVal $usage "output_tokens"
                    $cacheRead  += Get-UsageVal $usage "cache_read_input_tokens"
                    $cacheWrite += Get-UsageVal $usage "cache_creation_input_tokens"
                    $sessions++
                }
                if ($ev.costUSD) { $costUSD += [double]$ev.costUSD }
            } catch {}
        }
    }

    [PSCustomObject]@{
        Account   = $Label
        "Input K" = [math]::Round($inTok  / 1000, 1)
        "Output K"= [math]::Round($outTok / 1000, 1)
        "CacheR K"= [math]::Round($cacheRead  / 1000, 1)
        "CacheW K"= [math]::Round($cacheWrite / 1000, 1)
        Sessions  = $sessions
        "Cost USD"= [math]::Round($costUSD, 4)
    }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$switcherRoot = Split-Path -Parent $scriptRoot
$acc1Dir = "$env:USERPROFILE\.claude\projects"
$acc2Dir = Join-Path $switcherRoot "auth\claude-acc2\projects"

Write-Host ""
Write-Host "Claude token usage [$Period]" -ForegroundColor Cyan
Write-Host "(remaining tokens not exposed by Claude CLI)" -ForegroundColor DarkGray
Write-Host ""

$rows = @(
    (Get-TokenStats "acc1 (default)" $acc1Dir)
    (Get-TokenStats "acc2"           $acc2Dir)
)
$rows | Format-Table -AutoSize
