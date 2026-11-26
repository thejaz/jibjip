# Dot-source for recoverable removal of known local output. Never follows links.
function Send-WorkspacePathToRecycleBin {
  param([Parameter(Mandatory)][string]$Path, [string]$Root = ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))))
  $workspace = [IO.Path]::GetFullPath($Root).TrimEnd('\')
  $target = [IO.Path]::GetFullPath($Path)
  if (-not $target.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Cleanup target is outside its workspace." }
  if ($target -match '(?i)(^|[\\/])\.git([\\/]|$)' -or $target -match '(?i)(personal-database\.local\.md|CHANGELOG\.md)$') { throw "Protected history or personal locator cannot be recycled." }
  $ancestor = $target
  while ($ancestor.Length -ge $workspace.Length) {
    if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Cleanup cannot traverse a reparse point." }
    if ($ancestor -eq $workspace) { break }
    $ancestor = [IO.Path]::GetDirectoryName($ancestor)
  }
  if (-not (Test-Path -LiteralPath $target)) { return }
  $item = Get-Item -LiteralPath $target -Force
  $pending = [Collections.Generic.Stack[IO.FileSystemInfo]]::new()
  $pending.Push($item)
  while ($pending.Count -gt 0) {
    $entry = $pending.Pop()
    if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing to recycle output containing a reparse point." }
    if ($entry -is [IO.FileInfo] -and $entry.Extension -eq '.json') {
      try { $value = Get-Content -LiteralPath $entry.FullName -Raw | ConvertFrom-Json -ErrorAction Stop } catch { $value = $null }
      if ($null -ne $value -and $null -ne $value.PSObject.Properties['source'] -and $null -ne $value.source -and $null -ne $value.source.PSObject.Properties['kind'] -and $value.source.kind -eq 'jibjip-backup') { throw "Recovery data is protected from cleanup." }
    }
    if ($entry -is [IO.DirectoryInfo]) {
      foreach ($child in $entry.EnumerateFileSystemInfos()) { $pending.Push($child) }
    }
  }
  Add-Type -AssemblyName Microsoft.VisualBasic
  if ($item -is [IO.DirectoryInfo]) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($target, 'OnlyErrorDialogs', 'SendToRecycleBin', 'ThrowException')
  } else {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($target, 'OnlyErrorDialogs', 'SendToRecycleBin', 'ThrowException')
  }
}
