param([switch]$Acceptance)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$mode=if($Acceptance){'acceptance'}else{'demo'}
$record=Join-Path $projectRoot ".local/$mode/processes.json"
if(Test-Path $record){
 $state=Get-Content $record -Raw | ConvertFrom-Json
 foreach($processId in @($state.api,$state.web)){
  $processInfo=Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
  if($processInfo -and (($processInfo.CommandLine -like "*$projectRoot*devsync.jar*") -or ($processInfo.CommandLine -like '*node_modules/vite/bin/vite.js*' -and $processInfo.CommandLine -like $(if($Acceptance){'*5187*'}else{'*5186*'})))){Stop-Process -Id $processId}
 }
 Remove-Item -LiteralPath $record
}
$compose=if($Acceptance){'compose.acceptance.yaml'}else{'compose.yaml'}
docker compose -f (Join-Path $projectRoot $compose) stop db
if($LASTEXITCODE){throw 'Database stop failed.'}
Write-Output "Stopped $mode. Database volume preserved."
