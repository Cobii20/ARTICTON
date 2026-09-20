param(
  [string]$ModelsDirectory = "public/models",
  [string]$OutputRoot = "model-optimization-candidates",
  [ValidateSet("Balanced1024", "Aggressive512", "All")]
  [string]$Profile = "All"
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path -LiteralPath ".").Path
$resolvedModels = (Resolve-Path -LiteralPath $ModelsDirectory).Path
$resolvedOutputRoot = [System.IO.Path]::GetFullPath((Join-Path $workspace $OutputRoot))

function Assert-InWorkspace([string]$Path, [string]$Label) {
  $workspaceBoundary = $workspace.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $candidate = [System.IO.Path]::GetFullPath($Path)
  if (-not $candidate.Equals($workspace, [System.StringComparison]::OrdinalIgnoreCase) -and
      -not $candidate.StartsWith($workspaceBoundary, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label must stay inside the project workspace."
  }
}

function Invoke-GltfTransform([string[]]$Arguments, [string]$FailureMessage) {
  & npx.cmd -y --package=@gltf-transform/cli@latest gltf-transform @Arguments
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

Assert-InWorkspace $resolvedModels "ModelsDirectory"
Assert-InWorkspace $resolvedOutputRoot "OutputRoot"

$profiles = @(
  [pscustomobject]@{
    Name = "balanced-1024"
    TextureSize = 1024
    WebpQuality = 80
    SimplifyRatio = 0.90
    SimplifyError = 0.0005
  },
  [pscustomobject]@{
    Name = "aggressive-512"
    TextureSize = 512
    WebpQuality = 65
    SimplifyRatio = 0.70
    SimplifyError = 0.002
  }
)

if ($Profile -ne "All") {
  $selectedName = if ($Profile -eq "Balanced1024") { "balanced-1024" } else { "aggressive-512" }
  $profiles = @($profiles | Where-Object Name -eq $selectedName)
}

$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$runDirectory = Join-Path $resolvedOutputRoot $runId
$models = @(Get-ChildItem -LiteralPath $resolvedModels -Filter "*.glb" -File | Sort-Object Name)

if ($models.Count -eq 0) { throw "No GLB files were found in $resolvedModels." }

New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null

foreach ($profileConfig in $profiles) {
  $profileDirectory = Join-Path $runDirectory $profileConfig.Name
  $workingDirectory = Join-Path $runDirectory (".working-" + $profileConfig.Name)
  New-Item -ItemType Directory -Path $profileDirectory, $workingDirectory -Force | Out-Null
  $report = [System.Collections.Generic.List[object]]::new()

  try {
    foreach ($model in $models) {
      $optimizedStage = Join-Path $workingDirectory ("optimized-" + $model.Name)
      $webpStage = Join-Path $workingDirectory ("webp-" + $model.Name)
      $output = Join-Path $profileDirectory $model.Name
      Write-Host "[$($profileConfig.Name)] Optimizing $($model.Name)..."

      Invoke-GltfTransform @(
        "optimize", $model.FullName, $optimizedStage,
        "--compress", "meshopt",
        "--meshopt-level", "high",
        "--texture-compress", "webp",
        "--texture-size", [string]$profileConfig.TextureSize,
        "--simplify", "true",
        "--simplify-ratio", [string]$profileConfig.SimplifyRatio,
        "--simplify-error", [string]$profileConfig.SimplifyError
      ) "Optimization failed for $($model.Name)."

      Invoke-GltfTransform @(
        "webp", $optimizedStage, $webpStage,
        "--quality", [string]$profileConfig.WebpQuality,
        "--effort", "90"
      ) "WebP compression failed for $($model.Name)."

      # The WebP command decodes EXT_meshopt_compression while rewriting the
      # container, so Meshopt must be the final transformation before validation.
      Invoke-GltfTransform @(
        "meshopt", $webpStage, $output,
        "--level", "high"
      ) "Final Meshopt compression failed for $($model.Name)."

      Invoke-GltfTransform @("validate", $output) "Validation failed for $($model.Name)."

      $outputFile = Get-Item -LiteralPath $output
      $savedBytes = $model.Length - $outputFile.Length
      $report.Add([pscustomobject]@{
        File = $model.Name
        OriginalBytes = $model.Length
        CandidateBytes = $outputFile.Length
        SavedBytes = $savedBytes
        SavingsPercent = [math]::Round(($savedBytes / $model.Length) * 100, 2)
        TextureSize = $profileConfig.TextureSize
        WebpQuality = $profileConfig.WebpQuality
        SimplifyRatio = $profileConfig.SimplifyRatio
        SimplifyError = $profileConfig.SimplifyError
        Validation = "Passed"
        Priority = if ($model.Name -in @("CpuAMD(Base).glb", "NEWcpuAMD.glb")) { "AMD CPU" } else { "" }
      })
    }
  }
  finally {
    if (Test-Path -LiteralPath $workingDirectory) {
      Remove-Item -LiteralPath $workingDirectory -Recurse -Force
    }
  }

  $reportPath = Join-Path $runDirectory ("report-" + $profileConfig.Name + ".csv")
  $report | Export-Csv -LiteralPath $reportPath -NoTypeInformation
  $originalTotal = ($report | Measure-Object OriginalBytes -Sum).Sum
  $candidateTotal = ($report | Measure-Object CandidateBytes -Sum).Sum
  $totalSavings = (($originalTotal - $candidateTotal) / $originalTotal) * 100
  Write-Host ("{0}: {1:N2} MiB -> {2:N2} MiB ({3:N2}% saved)" -f $profileConfig.Name, ($originalTotal / 1MB), ($candidateTotal / 1MB), $totalSavings)
  Write-Host "Report: $reportPath"
}

Write-Host "Candidate run complete: $runDirectory"
Write-Host "Active files in $resolvedModels were not modified."
