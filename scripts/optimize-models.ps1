param(
  [string]$ModelsDirectory = "public/models"
)

$ErrorActionPreference = "Stop"
$resolvedModels = (Resolve-Path -LiteralPath $ModelsDirectory).Path
$workspace = (Resolve-Path -LiteralPath ".").Path

if (-not $resolvedModels.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "ModelsDirectory must stay inside the project workspace."
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("articton-models-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

try {
  $models = Get-ChildItem -LiteralPath $resolvedModels -Filter "*.glb" -File
  foreach ($model in $models) {
    $output = Join-Path $temporaryDirectory $model.Name
    Write-Host "Compressing $($model.Name)..."
    & npx.cmd -y --package=@gltf-transform/cli@latest gltf-transform draco $model.FullName $output
    if ($LASTEXITCODE -ne 0) { throw "Compression failed for $($model.Name)." }

    & npx.cmd -y --package=@gltf-transform/cli@latest gltf-transform validate $output | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Validation failed for $($model.Name)." }

    if ((Get-Item -LiteralPath $output).Length -ge $model.Length) {
      Copy-Item -LiteralPath $model.FullName -Destination $output -Force
    }
  }

  foreach ($model in $models) {
    $validatedOutput = Join-Path $temporaryDirectory $model.Name
    Copy-Item -LiteralPath $validatedOutput -Destination $model.FullName -Force
  }
}
finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}

$totalBytes = (Get-ChildItem -LiteralPath $resolvedModels -Filter "*.glb" -File | Measure-Object Length -Sum).Sum
Write-Host ("Optimized model total: {0:N2} MB" -f ($totalBytes / 1MB))
