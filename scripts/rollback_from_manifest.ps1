param(
  [Parameter(Mandatory = $true)]
  [string]$ManifestPath,

  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Print-Usage {
  Write-Output "Usage:"
  Write-Output "  .\\scripts\\rollback_from_manifest.ps1 -ManifestPath .\\logs\\manifest.json"
  Write-Output "  .\\scripts\\rollback_from_manifest.ps1 -ManifestPath .\\logs\\manifest.json -Force"
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Manifest not found: $ManifestPath"
}

$envFile = Join-Path -Path (Get-Location) -ChildPath ".env.local"
if (Test-Path -LiteralPath $envFile) {
  Get-Content -Path $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    if ($line -notmatch "=") { return }
    $parts = $line -split "=", 2
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($key, $value, "Process")
  }
}

$baseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
if (-not $baseUrl) { $baseUrl = $env:SUPABASE_URL }
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $baseUrl) { throw "Missing SUPABASE_URL (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)" }
if (-not $serviceKey) { throw "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local" }

$manifestJson = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
$publicQids = @()
if ($null -ne $manifestJson.public_qids) {
  $publicQids = @($manifestJson.public_qids)
} elseif ($null -ne $manifestJson.imported) {
  $publicQids = @($manifestJson.imported)
}
$publicQids = @($publicQids | Where-Object { $_ -and $_.ToString().Trim() -ne "" })

Write-Output ("delete target count: {0}" -f $publicQids.Count)

if ($publicQids.Count -eq 0) {
  exit 0
}

if (-not $Force) {
  Write-Output "Dry run only. Re-run with -Force to delete."
  Print-Usage
  exit 0
}

$headers = @{
  "apikey" = $serviceKey
  "Authorization" = "Bearer $serviceKey"
}

Add-Type -AssemblyName System.Web

function Split-IntoChunks([string[]]$values, [int]$size) {
  $chunks = @()
  for ($i = 0; $i -lt $values.Count; $i += $size) {
    $chunks += ,($values[$i..([Math]::Min($i + $size - 1, $values.Count - 1))])
  }
  return $chunks
}

function Get-QuestionsByPublicQid([string[]]$qids) {
  $results = @()
  $chunks = Split-IntoChunks $qids 200
  foreach ($chunk in $chunks) {
    if ($chunk.Count -eq 0) { continue }
    $inClause = "(" + ($chunk -join ",") + ")"
    $query = "public_qid=in.{0}&select=id,public_qid" -f [System.Web.HttpUtility]::UrlEncode($inClause)
    $uri = "$baseUrl/rest/v1/questions?$query"
    $data = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
    if ($data) { $results += $data }
  }
  return $results
}

function Delete-QuestionTokens([string[]]$ids) {
  $chunks = Split-IntoChunks $ids 200
  foreach ($chunk in $chunks) {
    if ($chunk.Count -eq 0) { continue }
    $inClause = "(" + ($chunk -join ",") + ")"
    $query = "question_id=in.{0}" -f [System.Web.HttpUtility]::UrlEncode($inClause)
    $uri = "$baseUrl/rest/v1/question_tokens?$query"
    Invoke-RestMethod -Method Delete -Uri $uri -Headers $headers | Out-Null
  }
}

function Delete-Questions([string[]]$qids) {
  $chunks = Split-IntoChunks $qids 200
  foreach ($chunk in $chunks) {
    if ($chunk.Count -eq 0) { continue }
    $inClause = "(" + ($chunk -join ",") + ")"
    $query = "public_qid=in.{0}" -f [System.Web.HttpUtility]::UrlEncode($inClause)
    $uri = "$baseUrl/rest/v1/questions?$query"
    Invoke-RestMethod -Method Delete -Uri $uri -Headers $headers | Out-Null
  }
}

$questions = Get-QuestionsByPublicQid $publicQids
$foundQids = $questions | ForEach-Object { $_.public_qid }
$questionIds = $questions | ForEach-Object { $_.id }

if ($questionIds.Count -gt 0) {
  Delete-QuestionTokens $questionIds
  Delete-Questions $foundQids
}

Write-Output ("deleted {0}" -f $questionIds.Count)
exit 0
