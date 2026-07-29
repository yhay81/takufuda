[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PagesPath = Join-Path $RepoRoot "src\ui\pages.tsx"
$ProductPath = Join-Path $RepoRoot "src\config\product.ts"
$WranglerPath = Join-Path $RepoRoot "wrangler.jsonc"
$PublicDirectory = Join-Path $RepoRoot "public"
$Pages = Get-Content -Raw -LiteralPath $PagesPath
$Product = Get-Content -Raw -LiteralPath $ProductPath
$Wrangler = Get-Content -Raw -LiteralPath $WranglerPath

if ($Pages.Contains('class="hero"') -or $Pages.Contains('class="product-flow"')) {
    throw "Text-led hero and generic product-flow sections are not releaseable product surfaces"
}

if (-not $Pages.Contains('class="workspace-shell"') -or -not $Pages.Contains("data-radar")) {
    throw "The product-specific visual workspace is missing"
}

if ($Pages.Contains("Success signal") -or $Pages.Contains("実験")) {
    throw "Internal experiment language must not appear inside the service"
}

if (-not $Pages.Contains("端末だけのメモ") -or -not $Pages.Contains("二次創作物")) {
    throw "Privacy boundary or required rights notice is missing"
}

if (-not $Product.Contains("takufuda.yhay81.com")) {
    throw "Use the canonical takufuda.yhay81.com production URL"
}

if (
    -not $Wrangler.Contains('"workers_dev": false') -or
    -not $Wrangler.Contains('"custom_domain": true') -or
    -not $Wrangler.Contains("takufuda.yhay81.com") -or
    $Wrangler.Contains("REPLACE_AFTER_D1_CREATE")
) {
    throw "Cloudflare production binding is incomplete"
}

foreach ($File in @("app.js", "styles.css", "robots.txt", "sitemap.xml", "og.svg")) {
    if (-not (Test-Path -LiteralPath (Join-Path $PublicDirectory $File))) {
        throw "Missing public artifact: $File"
    }
}

$KeyFiles = @(
    Get-ChildItem -LiteralPath $PublicDirectory -File |
        Where-Object { $_.Name -match "^[a-zA-Z0-9-]{8,128}\.txt$" }
)
if ($KeyFiles.Count -ne 1) {
    throw "Expected exactly one generated IndexNow key file, found $($KeyFiles.Count)"
}

$Key = (Get-Content -Raw -LiteralPath $KeyFiles[0].FullName).Trim()
if ($Key -ne $KeyFiles[0].BaseName) {
    throw "IndexNow key file name and content do not match"
}

Write-Output "Product release contract is satisfied"
