# switch.ps1 — переключатель аккаунтов Claude Code и Codex
# Использование: .\switch.ps1 <tool> <account>
#   tool:    claude | codex
#   account: 1 (основной) | 2 (второй аккаунт)
#
# Примеры:
#   .\switch.ps1 codex 2
#   .\switch.ps1 claude 1

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("claude","codex")]
    [string]$Tool,

    [Parameter(Mandatory=$true, Position=1)]
    [ValidateSet("1","2")]
    [string]$Account
)

$SwitcherRoot = "C:\AI\ai-switcher\auth"

$Config = @{
    claude = @{
        Exe     = "C:\Users\Иван\.local\bin\claude"
        EnvVar  = "CLAUDE_CONFIG_DIR"
        Acc2Dir = "$SwitcherRoot\claude-acc2"
    }
    codex  = @{
        Exe     = "C:\Users\Иван\AppData\Local\OpenAI\Codex\bin\codex.exe"
        EnvVar  = "CODEX_HOME"
        Acc2Dir = "$SwitcherRoot\codex-acc2"
    }
}

$c = $Config[$Tool]

if ($Account -eq "1") {
    # Основной аккаунт — убираем переменную (дефолтный путь)
    Remove-Item "Env:\$($c.EnvVar)" -ErrorAction SilentlyContinue
    Write-Host "[$Tool] Аккаунт 1 (основной)" -ForegroundColor Green
} else {
    # Второй аккаунт — задаём кастомный HOME
    [System.Environment]::SetEnvironmentVariable($c.EnvVar, $c.Acc2Dir, "Process")
    $env:($c.EnvVar) = $c.Acc2Dir
    Write-Host "[$Tool] Аккаунт 2  ($($c.EnvVar) = $($c.Acc2Dir))" -ForegroundColor Cyan
}

Write-Host "Запускаю: $($c.Exe)" -ForegroundColor DarkGray
& $c.Exe
