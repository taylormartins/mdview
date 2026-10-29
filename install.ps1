<#
  Registers MdView for .md files, for the current user only (nothing machine-wide, no admin needed).
    - adds "Markdown (MdView)" to Open with, for .md .markdown .mdown
    - adds a right-click "View Markdown" entry (Windows 11: under "Show more options")
  Windows does not let a script pick your default app, so finish with: right-click a .md -> Open with ->
  Choose another app -> "Markdown (MdView)" -> Always.
  Undo with uninstall.ps1. Needs Node.js 18+ on PATH.
#>
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs  = Join-Path $here 'mdview.vbs'
$ico  = Join-Path $here 'assets\mdview.ico'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found on PATH. Install it from https://nodejs.org first.' }

$cmd = "wscript.exe `"$vbs`" `"%1`""
$prog = 'HKCU:\Software\Classes\MdView.Markdown'
New-Item -Path "$prog\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $prog -Name '(default)' -Value 'Markdown (MdView)'
New-Item -Path "$prog\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$prog\DefaultIcon" -Name '(default)' -Value $ico
Set-ItemProperty -Path "$prog\shell\open\command" -Name '(default)' -Value $cmd

foreach ($ext in '.md', '.markdown', '.mdown') {
  New-Item -Path "HKCU:\Software\Classes\$ext\OpenWithProgids" -Force | Out-Null
  New-ItemProperty -Path "HKCU:\Software\Classes\$ext\OpenWithProgids" -Name 'MdView.Markdown' -Value '' -PropertyType String -Force | Out-Null
  $m = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\MdView"
  New-Item -Path "$m\command" -Force | Out-Null
  Set-ItemProperty -Path $m -Name '(default)' -Value 'View Markdown'
  Set-ItemProperty -Path $m -Name 'Icon' -Value $ico
  Set-ItemProperty -Path "$m\command" -Name '(default)' -Value $cmd
}
Write-Host 'MdView registered for this user.'
Write-Host 'Last step: right-click a .md file > Open with > Choose another app > "Markdown (MdView)" > Always.'
