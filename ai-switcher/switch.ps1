param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("claude", "codex")]
    [string]$Tool,

    [Parameter(Mandatory = $true, Position = 1)]
    [ValidateSet("1", "2")]
    [string]$Account
)

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SwitcherRoot = Join-Path $RepoRoot "auth"

$Config = @{
    claude = @{
        Exe     = "claude"
        EnvVar  = "CLAUDE_CONFIG_DIR"
        Acc2Dir = Join-Path $SwitcherRoot "claude-acc2"
    }
    codex = @{
        Exe     = "codex"
        EnvVar  = "CODEX_HOME"
        Acc2Dir = Join-Path $SwitcherRoot "codex-acc2"
    }
}

$c = $Config[$Tool]

if ($Account -eq "1") {
    Remove-Item "Env:\$($c.EnvVar)" -ErrorAction SilentlyContinue
    Write-Host "[$Tool] Account 1 (default)" -ForegroundColor Green
} else {
    [System.Environment]::SetEnvironmentVariable($c.EnvVar, $c.Acc2Dir, "Process")
    $env:($c.EnvVar) = $c.Acc2Dir
    Write-Host "[$Tool] Account 2 ($($c.EnvVar) = $($c.Acc2Dir))" -ForegroundColor Cyan
}

Write-Host "Launching: $($c.Exe)" -ForegroundColor DarkGray
& $c.Exe
