# Removes everything install.ps1 added (current user only). Your .md files are not touched.
$keys = @('HKCU:\Software\Classes\MdView.Markdown')
foreach ($ext in '.md', '.markdown', '.mdown') {
  $keys += "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\MdView"
  $p = "HKCU:\Software\Classes\$ext\OpenWithProgids"
  if (Test-Path $p) { Remove-ItemProperty -Path $p -Name 'MdView.Markdown' -ErrorAction SilentlyContinue }
}
foreach ($k in $keys) { if (Test-Path $k) { Remove-Item -Path $k -Recurse -Force } }
Write-Host 'MdView entries removed. If it was your default for .md, Windows will ask again next time.'
