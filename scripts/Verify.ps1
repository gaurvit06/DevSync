param([switch]$SkipImageBuild)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
& "$PSScriptRoot/Stop-Local.ps1" -Acceptance
& "$PSScriptRoot/Stop-Local.ps1"
New-Item -ItemType Directory -Force artifacts/verification | Out-Null
$javaHome=(Get-ChildItem .tools -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if($javaHome){$env:JAVA_HOME=$javaHome}
$env:DOCKER_API_VERSION='1.44'
& backend/mvnw.cmd -B -f backend/pom.xml clean verify *> artifacts/verification/backend-tests.log
if($LASTEXITCODE){throw 'Backend verification failed: artifacts/verification/backend-tests.log'}
Push-Location frontend
try{
 foreach($step in @('ci','run typecheck','run lint','test','run build')){
  $argsList=$step.Split(' ')
  & npm.cmd @argsList
  if($LASTEXITCODE){throw "Frontend verification failed: $step"}
 }
 if($env:PLAYWRIGHT_CHANNEL -eq 'chromium'){npx.cmd playwright install chromium;if($LASTEXITCODE){throw 'Browser installation failed.'}}
}finally{Pop-Location}
docker compose config -q
if($LASTEXITCODE){throw 'Compose configuration invalid.'}
if(!$SkipImageBuild){
 docker compose build *> artifacts/verification/compose-build.log
 if($LASTEXITCODE){throw 'Image build failed: artifacts/verification/compose-build.log'}
}
& "$PSScriptRoot/Start-Local.ps1" -Acceptance
try{
 Push-Location frontend
 try{npm.cmd run test:e2e;if($LASTEXITCODE){throw 'Browser acceptance failed.'}}finally{Pop-Location}
 & "$PSScriptRoot/Stop-Local.ps1" -Acceptance
 & "$PSScriptRoot/Start-Local.ps1" -Acceptance
 node scripts/check-persistence.mjs
 if($LASTEXITCODE){throw 'Restart persistence check failed.'}
}finally{& "$PSScriptRoot/Stop-Local.ps1" -Acceptance}
Write-Output 'Verification passed. Review artifacts/verification and VERIFICATION.md for scope.'
