$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$jombitProject = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$jombitWorkspace = [System.IO.Path]::GetFullPath((Join-Path $jombitProject '..'))
$jombitOutput = [System.IO.Path]::GetFullPath((Join-Path $jombitWorkspace 'outputs/jombit-independent'))
if (-not $jombitOutput.StartsWith($jombitWorkspace + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Output path is outside the workspace.' }
if (-not (Test-Path -LiteralPath (Join-Path $jombitProject 'dist/JomBit.html'))) { throw 'Run the build before exporting.' }
[void](New-Item -ItemType Directory -Path $jombitOutput -Force)

function New-JomBitArchive($archivePath, $sourceRoot, $sourceFiles) {
  $temporaryArchive = $archivePath + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
  $archive = [System.IO.Compression.ZipFile]::Open($temporaryArchive, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($sourceFile in $sourceFiles) {
      $relative = $sourceFile.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
      if ($relative -match '(^|/)(node_modules|\.git)/' -or $relative -match '(^|/)\.env($|\.(?!example$))') { throw 'A private or generated file was selected for the archive.' }
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $sourceFile.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal)
    }
  } finally { $archive.Dispose() }
  Move-Item -LiteralPath $temporaryArchive -Destination $archivePath -Force
}

$jombitSourceFiles = @(
  foreach ($directory in @('api', 'app', 'design', 'lib', 'public', 'scripts', 'server', 'src', 'tests')) {
    Get-ChildItem -LiteralPath (Join-Path $jombitProject $directory) -Recurse -File -Force
  }
  foreach ($file in @('.env.example', '.gitignore', 'GEMINI-SETUP.md', 'HOSTED-SCANNING.md', 'README.md', 'index.html', 'package.json', 'package-lock.json', 'postcss.config.mjs', 'tsconfig.json', 'vercel.json', 'vite.config.ts')) {
    Get-Item -LiteralPath (Join-Path $jombitProject $file) -Force
  }
)
New-JomBitArchive (Join-Path $jombitOutput 'JomBit-source.zip') $jombitProject $jombitSourceFiles
$jombitDist = Join-Path $jombitProject 'dist'
New-JomBitArchive (Join-Path $jombitOutput 'JomBit-site.zip') $jombitDist @(Get-ChildItem -LiteralPath $jombitDist -Recurse -File -Force)
foreach ($file in @('JomBit.html', 'JomBit-app-demo.html')) {
  Copy-Item -LiteralPath (Join-Path $jombitDist $file) -Destination (Join-Path $jombitOutput $file)
}
Copy-Item -LiteralPath (Join-Path $jombitProject 'GEMINI-SETUP.md') -Destination (Join-Path $jombitOutput 'GEMINI-SETUP.md')
Write-Output 'Refreshed standalone JomBit website, app demo, site archive and source archive. Private environment files excluded.'
