[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute takufuda $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param([int]$Numerator, [int]$Denominator)
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$Importers = [int]$Row.importers
$Savers = [int]$Row.savers

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "takufuda"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        editors = [int]$Row.editors
        importers = $Importers
        savers = $Savers
        sharers = [int]$Row.sharers
        ccfolia_users = [int]$Row.ccfolia_users
        exporters = [int]$Row.exporters
        returned_users = [int]$Row.returned_users
        users_7d = [int]$Row.users_7d
        savers_7d = [int]$Row.savers_7d
        import_actions = [int]$Row.import_actions
        save_actions = [int]$Row.save_actions
        share_actions = [int]$Row.share_actions
        ccfolia_actions = [int]$Row.ccfolia_actions
        published_sheets = [int]$Row.published_sheets
    }
    rates = [ordered]@{
        visitor_to_import_percent = Get-Percent $Importers $Users
        visitor_to_save_percent = Get-Percent $Savers $Users
        save_to_share_percent = Get-Percent ([int]$Row.sharers) $Savers
        save_to_ccfolia_percent = Get-Percent ([int]$Row.ccfolia_users) $Savers
        return_percent = Get-Percent ([int]$Row.returned_users) $Users
    }
} | ConvertTo-Json -Depth 4
