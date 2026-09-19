param(
  [ValidateSet("Plan", "Execute")]
  [string]$Action = "Plan",
  [string]$ProjectId = "articton-57fd8"
)

$ErrorActionPreference = "Stop"
$ExpectedProject = "articton-57fd8"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ManifestPath = Join-Path $Root "release-artifact.json"
$Completed = [System.Collections.Generic.List[string]]::new()

function Stop-Release([string]$Message) {
  Write-Error $Message
  exit 1
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

if ($ProjectId -ne $ExpectedProject) { Stop-Release "Refusing target '$ProjectId'. Production must be '$ExpectedProject'." }
if (-not (Test-Path -LiteralPath $ManifestPath)) { Stop-Release "release-artifact.json is missing. Build, test, then run npm run release:artifact." }
$Manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
if ($Manifest.projectId -ne $ExpectedProject) { Stop-Release "Artifact project does not match production." }
if ($Manifest.schemaVersion -ne 1) { Stop-Release "Unsupported artifact manifest version." }

$EnvFile = Join-Path $Root ".env.production"
if (-not (Test-Path -LiteralPath $EnvFile)) { Stop-Release ".env.production is missing. Copy the example and fill the production public configuration." }
$EnvText = Get-Content -Raw -LiteralPath $EnvFile
foreach ($Required in @(
  "VITE_FIREBASE_DEPLOYMENT_MODE=full",
  "VITE_FIREBASE_PROJECT_ID=$ExpectedProject",
  "VITE_FIREBASE_AUTH_DOMAIN=$ExpectedProject.firebaseapp.com"
)) {
  if (-not $EnvText.Contains($Required)) { Stop-Release "Production environment is missing '$Required'." }
}
if ($EnvText -match "replace_with|demo-articton|localhost|VITE_USE_.*EMULATOR=true") { Stop-Release "Production environment contains a placeholder, demo project, localhost, or emulator setting." }

foreach ($Input in $Manifest.inputs.PSObject.Properties) {
  $Path = Join-Path $Root $Input.Name
  if (-not (Test-Path -LiteralPath $Path) -or (Get-Sha256 $Path) -ne $Input.Value) {
    Stop-Release "Protected release input changed after artifact creation: $($Input.Name)"
  }
}
foreach ($File in $Manifest.files) {
  $Path = Join-Path $Root $File.path
  if (-not (Test-Path -LiteralPath $Path) -or (Get-Sha256 $Path) -ne $File.sha256) {
    Stop-Release "Release artifact changed or is missing: $($File.path)"
  }
}

Push-Location $Root
try {
  $CliVersion = & npx -y firebase-tools@latest --version
  if ($LASTEXITCODE -ne 0) { Stop-Release "Firebase CLI is unavailable." }
  $ActiveProject = & npx -y firebase-tools@latest use
  if ($LASTEXITCODE -ne 0 -or ($ActiveProject -join "`n") -notmatch [regex]::Escape($ExpectedProject)) {
    Stop-Release "Firebase CLI active project is not '$ExpectedProject'."
  }

  Write-Host "ARTICTON production release preflight passed."
  Write-Host "Action: $Action"
  Write-Host "Firebase CLI: $CliVersion"
  Write-Host "Project: $ExpectedProject"
  Write-Host "Artifact: $($Manifest.fileCount) files, $($Manifest.totalBytes) bytes, created $($Manifest.createdAt)"
  Write-Host "Order: Functions -> Firestore indexes -> Firestore rules -> Storage rules -> Hosting"
  Write-Host "No build, billing change, data migration, or Function deletion is performed by this script."

  if ($Action -eq "Plan") { exit 0 }
  if ($env:ARTICTON_PRODUCTION_APPROVED -ne "DEPLOY_articton-57fd8") {
    Stop-Release "Execution requires ARTICTON_PRODUCTION_APPROVED=DEPLOY_articton-57fd8 in this terminal."
  }

  $Steps = @(
    @{ Name = "functions"; Args = @("deploy", "--only", "functions", "--project", $ExpectedProject, "--non-interactive") },
    @{ Name = "firestore-indexes"; Args = @("deploy", "--only", "firestore:indexes", "--project", $ExpectedProject, "--non-interactive") },
    @{ Name = "firestore-rules"; Args = @("deploy", "--only", "firestore:rules", "--project", $ExpectedProject, "--non-interactive") },
    @{ Name = "storage-rules"; Args = @("deploy", "--only", "storage", "--project", $ExpectedProject, "--non-interactive") },
    @{ Name = "hosting"; Args = @("deploy", "--only", "hosting", "--project", $ExpectedProject, "--non-interactive") }
  )
  foreach ($Step in $Steps) {
    Write-Host "Starting $($Step.Name)..."
    & npx -y firebase-tools@latest @($Step.Args)
    if ($LASTEXITCODE -ne 0) { Stop-Release "Release stopped at $($Step.Name). Completed: $($Completed -join ', ')" }
    $Completed.Add($Step.Name)
  }
  Write-Host "Release completed: $($Completed -join ', ')"
} finally {
  Pop-Location
}
