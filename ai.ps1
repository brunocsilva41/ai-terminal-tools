param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$InputArgs
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeScript = Join-Path $ScriptRoot "wrappers/activation-profiles/compose_prompt.mjs"

function Show-Usage {
    Write-Host "Uso:"
    Write-Host "  ./ai.ps1 `"prompt`" --gemini"
    Write-Host "  ./ai.ps1 `"/deploy`" `"fazer deploy da API`" --claude"
    Write-Host "  ./ai.ps1 --activation /review `"revisar mudanças`" --copilot"
    Write-Host "  ./ai.ps1 --list-activations"
    Write-Host "  ./ai.ps1 --cli-cmd <comando> `"prompt`""
}

if (-not $InputArgs -or $InputArgs.Count -eq 0) {
    Show-Usage
    exit 1
}

$CLI = "--gemini"
$Activation = ""
$CustomCliCommand = ""
$ListActivations = $false
$Positionals = New-Object System.Collections.Generic.List[string]

for ($i = 0; $i -lt $InputArgs.Count; $i++) {
    $arg = $InputArgs[$i]
    switch ($arg) {
        "--gemini" { $CLI = "--gemini"; continue }
        "--claude" { $CLI = "--claude"; continue }
        "--copilot" { $CLI = "--copilot"; continue }
        "--codex" { $CLI = "--codex"; continue }
        "--opencloud" { $CLI = "--opencloud"; continue }
        "--list-activations" { $ListActivations = $true; continue }
        "--activation" {
            if ($i + 1 -ge $InputArgs.Count) { throw "Missing value for --activation." }
            $Activation = $InputArgs[$i + 1]
            $i++
            continue
        }
        "--cli-cmd" {
            if ($i + 1 -ge $InputArgs.Count) { throw "Missing value for --cli-cmd." }
            $CustomCliCommand = $InputArgs[$i + 1]
            $i++
            continue
        }
        default {
            $Positionals.Add($arg)
        }
    }
}

if ($ListActivations) {
    & node $ComposeScript --list
    exit $LASTEXITCODE
}

$Prompt = ""
if (-not [string]::IsNullOrWhiteSpace($Activation)) {
    if ($Positionals.Count -lt 1) { throw "Missing prompt when using --activation." }
    $Prompt = $Positionals[0]
}
elseif ($Positionals.Count -ge 2 -and $Positionals[0].StartsWith("/")) {
    $Activation = $Positionals[0]
    $Prompt = $Positionals[1]
}
elseif ($Positionals.Count -ge 1) {
    $Prompt = $Positionals[0]
}

if ([string]::IsNullOrWhiteSpace($Prompt)) {
    Show-Usage
    exit 1
}

$FinalPrompt = $Prompt
if (-not [string]::IsNullOrWhiteSpace($Activation)) {
    $composedLines = & node $ComposeScript --activation $Activation --prompt $Prompt
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to compose prompt for activation: $Activation"
    }
    $FinalPrompt = ($composedLines -join [Environment]::NewLine)
}

Write-Host "🚀 Dispatching prompt to $CLI..." -ForegroundColor Cyan

if (-not [string]::IsNullOrWhiteSpace($CustomCliCommand)) {
    & $CustomCliCommand -p $FinalPrompt
    exit $LASTEXITCODE
}

switch ($CLI) {
    "--gemini" { & gemini -p $FinalPrompt }
    "--claude" { & claude -p $FinalPrompt }
    "--copilot" { & copilot -p $FinalPrompt }
    "--codex" { & openai -p $FinalPrompt }
    "--opencloud" { & opencloud -p $FinalPrompt }
    default { throw "CLI desconhecido: $CLI" }
}
