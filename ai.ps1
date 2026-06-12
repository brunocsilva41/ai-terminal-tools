param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$InputArgs
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeScript = Join-Path $ScriptRoot "wrappers/activation-profiles/compose_prompt.mjs"

function Test-GeminiCapacityError {
    param([string]$OutputText)

    return $OutputText.Contains("MODEL_CAPACITY_EXHAUSTED") -or
        $OutputText.Contains("RESOURCE_EXHAUSTED") -or
        $OutputText.Contains("No capacity available for model")
}

function Get-GeminiAttempts {
    $attempts = New-Object System.Collections.Generic.List[object]
    $seen = New-Object System.Collections.Generic.HashSet[string]
    $preferredModel = ""
    if (-not [string]::IsNullOrWhiteSpace($env:AI_GEMINI_MODEL)) {
        $preferredModel = $env:AI_GEMINI_MODEL.Trim()
    }
    $fallbackModels = @()

    if (-not [string]::IsNullOrWhiteSpace($env:AI_GEMINI_FALLBACK_MODELS)) {
        $fallbackModels = $env:AI_GEMINI_FALLBACK_MODELS.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    }

    function Add-Attempt {
        param(
            [string]$Label,
            [string]$Model = ""
        )

        $key = if ([string]::IsNullOrWhiteSpace($Model)) { "__default__" } else { $Model }
        if ($seen.Add($key)) {
            $attempts.Add([pscustomobject]@{
                Label = $Label
                Model = $Model
            }) | Out-Null
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($preferredModel)) {
        Add-Attempt -Label "configured model $preferredModel" -Model $preferredModel
    }
    else {
        Add-Attempt -Label "Gemini CLI default model"
    }

    foreach ($model in $fallbackModels) {
        Add-Attempt -Label "fallback model $model" -Model $model
    }

    if ([string]::IsNullOrWhiteSpace($preferredModel) -and $fallbackModels.Count -eq 0) {
        Add-Attempt -Label "fallback model gemini-2.5-pro" -Model "gemini-2.5-pro"
        Add-Attempt -Label "fallback model gemini-2.5-flash" -Model "gemini-2.5-flash"
    }

    return $attempts
}

function Invoke-GeminiWithFallback {
    param([string]$PromptText)

    $attempts = Get-GeminiAttempts
    $lastCapacityOutput = ""

    for ($index = 0; $index -lt $attempts.Count; $index++) {
        $attempt = $attempts[$index]
        $geminiArgs = @()

        if (-not [string]::IsNullOrWhiteSpace($attempt.Model)) {
            Write-Host "Using Gemini model $($attempt.Model) ($($index + 1)/$($attempts.Count))." -ForegroundColor DarkCyan
            $geminiArgs += @("--model", $attempt.Model)
        }

        $geminiArgs += @("--prompt", $PromptText)
        $stdoutFile = [System.IO.Path]::GetTempFileName()
        $stderrFile = [System.IO.Path]::GetTempFileName()

        try {
            $process = Start-Process -FilePath "gemini" -ArgumentList $geminiArgs -Wait -NoNewWindow -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
            $stdoutText = if (Test-Path $stdoutFile) { Get-Content $stdoutFile -Raw -ErrorAction SilentlyContinue } else { "" }
            $stderrText = if (Test-Path $stderrFile) { Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue } else { "" }
            $exitCode = $process.ExitCode
            $outputParts = @($stdoutText, $stderrText) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            $outputText = ($outputParts -join [Environment]::NewLine)
        }
        finally {
            if (Test-Path $stdoutFile) { Remove-Item -LiteralPath $stdoutFile -Force }
            if (Test-Path $stderrFile) { Remove-Item -LiteralPath $stderrFile -Force }
        }

        if ($exitCode -eq 0) {
            if (-not [string]::IsNullOrWhiteSpace($outputText)) {
                Write-Output $outputText
            }
            return 0
        }

        if (-not (Test-GeminiCapacityError -OutputText $outputText)) {
            if (-not [string]::IsNullOrWhiteSpace($outputText)) {
                Write-Error $outputText
            }
            return $exitCode
        }

        $lastCapacityOutput = $outputText
        if ($index + 1 -lt $attempts.Count) {
            $nextAttempt = $attempts[$index + 1]
            $nextLabel = if ([string]::IsNullOrWhiteSpace($nextAttempt.Model)) { "Gemini CLI default model" } else { $nextAttempt.Model }
            Write-Warning "Gemini returned 429/capacity exhaustion for $($attempt.Label). Retrying with $nextLabel."
        }
    }

    Write-Error "Gemini is unavailable because all configured/default models are out of capacity."
    Write-Host "Set AI_GEMINI_MODEL or AI_GEMINI_FALLBACK_MODELS to override the retry order." -ForegroundColor Yellow

    if ($env:AI_GEMINI_DEBUG_ERRORS -eq "1" -and -not [string]::IsNullOrWhiteSpace($lastCapacityOutput)) {
        Write-Host ""
        Write-Host "--- Gemini raw error ---" -ForegroundColor DarkYellow
        Write-Host $lastCapacityOutput
    }

    return 1
}

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
    "--gemini" {
        $geminiExitCode = Invoke-GeminiWithFallback -PromptText $FinalPrompt
        exit $geminiExitCode
    }
    "--claude" { & claude -p $FinalPrompt }
    "--copilot" { & copilot -p $FinalPrompt }
    "--codex" { & openai -p $FinalPrompt }
    "--opencloud" { & opencloud -p $FinalPrompt }
    default { throw "CLI desconhecido: $CLI" }
}
