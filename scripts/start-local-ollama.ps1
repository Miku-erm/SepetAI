$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPortable = Join-Path $taskRoot '.local\ollama\ollama.exe'
try {
  $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2
  Write-Output 'Ollama is already running on port 11434.'
  exit 0
} catch {}
$env:OLLAMA_HOST = '127.0.0.1:11434'
if (Test-Path -LiteralPath $taskPortable) {
  $env:OLLAMA_MODELS = Join-Path $taskRoot '.local\models'
  & $taskPortable serve
} elseif (Get-Command ollama -ErrorAction SilentlyContinue) {
  & ollama serve
} else {
  throw 'Install Ollama from https://ollama.com/download, then run ollama pull qwen3:4b.'
}
