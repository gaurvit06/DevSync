param(
    [Parameter(Mandatory)]
    [uri] $ApiOrigin
)

$ErrorActionPreference = 'Stop'

if (-not $ApiOrigin.IsAbsoluteUri -or
    $ApiOrigin.Scheme -ne 'https' -or $ApiOrigin.IsLoopback -or
    $ApiOrigin.AbsolutePath -ne '/' -or $ApiOrigin.Query -or
    $ApiOrigin.Fragment -or $ApiOrigin.UserInfo) {
    throw 'Use the hosted DevSync API HTTPS origin, with no credentials, path, query, or fragment.'
}

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$frontend = Join-Path $workspace 'frontend'
$bundle = Join-Path ([IO.Path]::GetTempPath()) "devsync-vercel-$([guid]::NewGuid().ToString('N'))/devsync"

& npm.cmd --prefix $frontend run build | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed with exit code $LASTEXITCODE."
}

$source = Join-Path $frontend 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html') -PathType Leaf)) {
    throw 'Frontend build did not produce index.html.'
}

$public = Join-Path $bundle 'public'
New-Item -ItemType Directory -Path $public -Force | Out-Null
Get-ChildItem -LiteralPath $source | Copy-Item -Destination $public -Recurse
@('.env*', '.gitignore') | Set-Content -LiteralPath (Join-Path $bundle '.vercelignore') -Encoding utf8

$origin = $ApiOrigin.GetLeftPart([UriPartial]::Authority)
[ordered] @{
    '$schema' = 'https://openapi.vercel.sh/vercel.json'
    framework = $null
    buildCommand = ''
    installCommand = ''
    outputDirectory = 'public'
    rewrites = @(
        @{
            source = '/api/:path*'
            destination = "$origin/api/:path*"
        }
    )
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $bundle 'vercel.json') -Encoding utf8

Write-Output $bundle
