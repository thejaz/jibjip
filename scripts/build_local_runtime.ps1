[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
. (Join-Path $PSScriptRoot "recycle_workspace.ps1")
$runtimeDirectory = Join-Path $repositoryRoot "work\local-runtime"
$stampPath = Join-Path $runtimeDirectory ".jibjip-local-build.json"
$packageManifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "package.json") | ConvertFrom-Json
$appVersion = [string]$packageManifest.version
if ($appVersion -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') {
  throw "package.json must contain a numeric MAJOR.MINOR.PATCH version."
}
$connector = Join-Path $repositoryRoot "Connect Developer Tools.cmd"
$buildInputs = @(
  "packages\core\src", "packages\core\assets", "apps\web",
  "packages\core\package.json", "packages\core\vite.config.ts", "packages\core\tsconfig.build.json",
  "package.json", "package-lock.json", "LICENSE", "tsconfig.json", "vite-env.d.ts", "vite.config.ts", "scripts"
)

function Invoke-DeveloperTools {
  param([switch]$Disconnect)
  if (Test-Path -LiteralPath $connector) {
    if ($Disconnect) { & $connector disconnect } else { & $connector }
    if ($LASTEXITCODE -ne 0) { throw "Developer toolchain operation failed." }
  } elseif (-not $Disconnect -and -not (Test-Path -LiteralPath (Join-Path $repositoryRoot "node_modules\.bin\vite.cmd"))) {
    throw "Run npm ci once in this folder to install the locked development dependencies, then try again."
  }
}

function Get-BuildFingerprint {
  $entries = foreach ($buildInput in $buildInputs) {
    $path = Join-Path $repositoryRoot $buildInput
    if (-not (Test-Path -LiteralPath $path)) {
      throw "Required local build input is missing: $buildInput"
    }
    if (Test-Path -LiteralPath $path -PathType Container) {
      Get-ChildItem -LiteralPath $path -Recurse -File -Force | ForEach-Object {
        $relative = $_.FullName.Substring($repositoryRoot.Length + 1).Replace("\", "/")
        "$relative`t$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())"
      }
    } else {
      $relative = $path.Substring($repositoryRoot.Length + 1).Replace("\", "/")
      "$relative`t$((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant())"
    }
  }
  $payload = ($entries | Sort-Object) -join "`n"
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
    return (-join ($bytes | ForEach-Object { $_.ToString("x2") }))
  }
  finally {
    $sha256.Dispose()
  }
}

function Test-CurrentRuntime {
  param([string]$Fingerprint)

  foreach ($required in @("index.html", "app\index.html", "manifest.webmanifest", "sw.js", "assets", "data\jibjip-starter-seed.json", "build-profile.json", "LICENSE.txt")) {
    if (-not (Test-Path -LiteralPath (Join-Path $runtimeDirectory $required))) { return $false }
  }
  if ((Get-FileHash -LiteralPath (Join-Path $repositoryRoot "LICENSE") -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath (Join-Path $runtimeDirectory "LICENSE.txt") -Algorithm SHA256).Hash) { return $false }
  $sound = Join-Path $runtimeDirectory "audio\chick.mp3"
  if (-not (Test-Path -LiteralPath $sound)) { return $false }
  if ((Get-FileHash -LiteralPath $sound).Hash -ne (Get-FileHash -LiteralPath (Join-Path $repositoryRoot "packages\core\assets\audio\chick.mp3")).Hash) { return $false }
  foreach ($brandAsset in @("jibjip-type-en.svg", "jibjip-type-fa.svg")) {
    $sourcePath = Join-Path $repositoryRoot "packages\core\assets\brand\$brandAsset"
    $runtimePath = Join-Path $runtimeDirectory "brand\$brandAsset"
    if (-not (Test-Path -LiteralPath $runtimePath)) { return $false }
    if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $runtimePath -Algorithm SHA256).Hash) {
      return $false
    }
  }
  try {
    $stamp = Get-Content -LiteralPath $stampPath -Raw | ConvertFrom-Json
    $profile = Get-Content -LiteralPath (Join-Path $runtimeDirectory "build-profile.json") -Raw | ConvertFrom-Json
    return $stamp.fingerprint -eq $Fingerprint -and $profile.profile -eq "personal" -and $profile.appVersion -eq $appVersion
  } catch {
    return $false
  }
}

function Test-StagedRuntime {
  param([string]$Directory)

  $sound = Join-Path $Directory "audio\chick.mp3"
  if (-not (Test-Path -LiteralPath $sound) -or (Get-FileHash -LiteralPath $sound).Hash -ne (Get-FileHash -LiteralPath (Join-Path $repositoryRoot "packages\core\assets\audio\chick.mp3")).Hash) {
    throw "The staged local runtime sound does not match the canonical asset."
  }

  foreach ($required in @("index.html", "app\index.html", "manifest.webmanifest", "sw.js", "assets", "data\jibjip-starter-seed.json", "build-profile.json", "LICENSE.txt")) {
    if (-not (Test-Path -LiteralPath (Join-Path $Directory $required))) {
      throw "The staged local runtime is missing $required."
    }
  }

  $profile = Get-Content -LiteralPath (Join-Path $Directory "build-profile.json") -Raw | ConvertFrom-Json
  if ((Get-FileHash -LiteralPath (Join-Path $repositoryRoot "LICENSE") -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath (Join-Path $Directory "LICENSE.txt") -Algorithm SHA256).Hash) {
    throw "The staged local runtime license does not match the canonical MIT license."
  }
  if ($profile.profile -ne "personal" -or $profile.appVersion -ne $appVersion) {
    throw "The staged local runtime is not a personal build."
  }

  $seedSource = Join-Path $repositoryRoot "packages\core\assets\data\jibjip-starter-seed.json"
  $seedOutput = Join-Path $Directory "data\jibjip-starter-seed.json"
  if ((Get-FileHash -LiteralPath $seedSource -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $seedOutput -Algorithm SHA256).Hash) {
    throw "The staged local runtime seed does not match the approved source seed."
  }

  foreach ($brandAsset in @("jibjip-type-en.svg", "jibjip-type-fa.svg")) {
    $sourcePath = Join-Path $repositoryRoot "packages\core\assets\brand\$brandAsset"
    $outputPath = Join-Path $Directory "brand\$brandAsset"
    if (-not (Test-Path -LiteralPath $outputPath)) {
      throw "The staged local runtime is missing the brand asset $brandAsset."
    }
    if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash) {
      throw "The staged local runtime brand asset does not match the source: $brandAsset."
    }
  }

  $files = @(Get-ChildItem -LiteralPath $Directory -Recurse -File -Force)
  if (-not ($files | Where-Object { $_.FullName -match "[\\/]assets[\\/].+\.js$" })) {
    throw "The staged local runtime contains no JavaScript bundle."
  }
  if (-not ($files | Where-Object { $_.FullName -match "[\\/]assets[\\/].+\.css$" })) {
    throw "The staged local runtime contains no stylesheet bundle."
  }

  foreach ($file in $files) {
    $relative = $file.FullName.Substring($Directory.Length + 1).Replace("\", "/").ToLowerInvariant()
    if ($relative -eq "data/jibjip-starter-seed.json") { continue }
    if (
      $relative -match "(^|/)(data|seed|collaboration|work|node_modules|\.git|\.agents|\.openai)(/|$)" -or
      $relative -match "(^|/)\.env" -or
      $relative -match "(backup|\.map$|\.xlsx?$|\.pem$|\.key$|\.zip$|\.htaccess$|\.htpasswd$)"
    ) {
      throw "The staged local runtime contains a forbidden file: $relative"
    }
  }
}

function Install-StagedRuntime {
  param([string]$StagingDirectory)

  if (-not ([IO.Path]::GetFullPath($StagingDirectory)).StartsWith($runtimeDirectory + "-staging-", [StringComparison]::OrdinalIgnoreCase)) { throw "Unexpected runtime staging target." }
  foreach ($directory in @($runtimeDirectory, $StagingDirectory)) {
    if ((Test-Path -LiteralPath $directory) -and ((Get-Item -LiteralPath $directory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Runtime promotion cannot follow a reparse point." }
  }
  $previousDirectory = "$runtimeDirectory-previous-$([guid]::NewGuid().ToString('N'))"
  $movedPrevious = $false
  try {
    if (Test-Path -LiteralPath $runtimeDirectory) {
      Move-Item -LiteralPath $runtimeDirectory -Destination $previousDirectory
      $movedPrevious = $true
    }
    Move-Item -LiteralPath $StagingDirectory -Destination $runtimeDirectory
    if ($movedPrevious) {
      Send-WorkspacePathToRecycleBin $previousDirectory
    }
  }
  catch {
    if (-not (Test-Path -LiteralPath $runtimeDirectory) -and $movedPrevious -and (Test-Path -LiteralPath $previousDirectory)) {
      Move-Item -LiteralPath $previousDirectory -Destination $runtimeDirectory
    }
    throw
  }
}

Push-Location $repositoryRoot
try {
  $fingerprint = Get-BuildFingerprint
  if (Test-CurrentRuntime $fingerprint) {
    Write-Host "jibjip local runtime is current."
    exit 0
  }

  $stagingDirectory = "$runtimeDirectory-staging-$([guid]::NewGuid().ToString('N'))"

  try {
    Invoke-DeveloperTools

    $env:JIBJIP_LOCAL_RUNTIME_OUTPUT = $stagingDirectory
    npm run build:personal
    if ($LASTEXITCODE -ne 0) { throw "The local personal build failed." }

    Test-StagedRuntime $stagingDirectory

    $stamp = [ordered]@{
      profile = "personal"
      fingerprint = $fingerprint
      builtAt = (Get-Date).ToUniversalTime().ToString("o")
    }
    [IO.File]::WriteAllText(
      (Join-Path $stagingDirectory ".jibjip-local-build.json"),
      (($stamp | ConvertTo-Json) + "`n"),
      [Text.UTF8Encoding]::new($false)
    )
    Install-StagedRuntime $stagingDirectory
    Write-Host "jibjip local runtime was rebuilt from the current source."
  }
  catch {
    if (Test-Path -LiteralPath $stagingDirectory) {
      Send-WorkspacePathToRecycleBin $stagingDirectory
    }
    throw
  }
  finally {
    Remove-Item Env:\JIBJIP_LOCAL_RUNTIME_OUTPUT -ErrorAction SilentlyContinue
    Invoke-DeveloperTools -Disconnect
  }
}
finally {
  Pop-Location
}
