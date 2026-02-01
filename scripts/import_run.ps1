param(
  [Parameter(Mandatory = $true)]
  [string]$File,

  [int]$Limit = 0,

  [switch]$DryRun,

  [string]$LogName = (Get-Date -Format "yyyyMMdd_HHmmss")
)

$ErrorActionPreference = "Stop"

$logDir = Join-Path -Path "logs" -ChildPath "import"
if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$logFile = Join-Path -Path $logDir -ChildPath ("{0}.log" -f $LogName)
$env:IMPORT_LOG_NAME = $LogName

$validateArgs = @("run", "csv:validate", "--", "--file", $File)
if ($Limit -gt 0) {
  $validateArgs += @("--limit", $Limit)
}

& npm @validateArgs 2>&1 | Tee-Object -FilePath $logFile
$validateExit = $LASTEXITCODE
if ($validateExit -ne 0) {
  exit 1
}

$importArgs = @("tsx", "scripts/import_questions.ts", "--file", $File)
if ($Limit -gt 0) {
  $importArgs += @("--limit", $Limit)
}
if ($DryRun) {
  $importArgs += "--dry-run"
}

& npx @importArgs 2>&1 | Tee-Object -FilePath $logFile
$importExit = $LASTEXITCODE
if ($importExit -ne 0) {
  exit 1
}

exit 0
