param([switch]$Acceptance,[switch]$Rebuild)
$ErrorActionPreference='Stop'
$managedKeys=@('JAVA_HOME','PORT','DATABASE_URL','DATABASE_USER','DATABASE_PASSWORD','MYSQL_ROOT_PASSWORD','API_TARGET','AI_API_KEY','AI_API_URL','AI_MODEL','COOKIE_SECURE','CALL_ICE_URLS','CALL_TURN_USERNAME','CALL_TURN_CREDENTIAL')
$originalEnv=@{}
foreach($key in $managedKeys){$originalEnv[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
try {
$projectRoot=Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
if(Test-Path .env){foreach($line in Get-Content .env){if($line -match '^([A-Z_]+)=(.*)$' -and $managedKeys -contains $matches[1] -and !(Test-Path "Env:$($matches[1])")){[Environment]::SetEnvironmentVariable($matches[1],$matches[2],'Process')}}}
$mode=if($Acceptance){'acceptance'}else{'demo'}
$apiPort=if($Acceptance){8087}else{8086}
$webPort=if($Acceptance){5187}else{5186}
$compose=if($Acceptance){'compose.acceptance.yaml'}else{'compose.yaml'}
$runtime=Join-Path $projectRoot ".local/$mode"
New-Item -ItemType Directory -Force $runtime | Out-Null
$javaHome=(Get-ChildItem "$projectRoot/.tools" -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if(!$javaHome){$javaHome=$env:JAVA_HOME}
if(!$javaHome -or !(Test-Path "$javaHome/bin/java.exe")){throw 'Install JDK 21 and set JAVA_HOME.'}
$env:JAVA_HOME=$javaHome
if($Rebuild -or !(Test-Path backend/target/devsync-1.0.0.jar)){
 & backend/mvnw.cmd -B -f backend/pom.xml -DskipTests package
 if($LASTEXITCODE){throw 'Backend build failed.'}
}
if(!(Test-Path frontend/node_modules/vite/bin/vite.js)){npm.cmd --prefix frontend ci;if($LASTEXITCODE){throw 'npm ci failed.'}}
docker compose -f $compose up -d --wait db
if($LASTEXITCODE){throw 'Database failed to become ready. Start Docker Desktop and check ports.'}
foreach($port in @($apiPort,$webPort)){if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){throw "Port $port is occupied. Stop this mode before starting again."}}
Copy-Item backend/target/devsync-1.0.0.jar "$runtime/devsync.jar" -Force
$env:PORT="$apiPort"
$env:DATABASE_URL=if($Acceptance){'jdbc:mysql://localhost:3309/devsync'}else{'jdbc:mysql://localhost:3308/devsync'}
$env:DATABASE_PASSWORD=if($Acceptance){'acceptance-only'}elseif($env:DATABASE_PASSWORD){$env:DATABASE_PASSWORD}else{'devsync-local-only'}
$env:DATABASE_USER=if($Acceptance){'devsync'}elseif($env:DATABASE_USER){$env:DATABASE_USER}else{'devsync'}
$env:API_TARGET="http://127.0.0.1:$apiPort"
if($Acceptance){
 $env:AI_API_KEY=''
 $env:CALL_ICE_URLS=''
 $env:CALL_TURN_USERNAME=''
 $env:CALL_TURN_CREDENTIAL=''
}
$java=Start-Process -FilePath "$javaHome/bin/java.exe" -ArgumentList @('-jar',"`"$runtime/devsync.jar`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$runtime/api.log" -RedirectStandardError "$runtime/api.err.log"
$node=(Get-Command node.exe).Source
$web=Start-Process -FilePath $node -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$webPort",'--strictPort') -WorkingDirectory "$projectRoot/frontend" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$runtime/web.log" -RedirectStandardError "$runtime/web.err.log"
@{api=$java.Id;web=$web.Id} | ConvertTo-Json | Set-Content "$runtime/processes.json"
$ready=$false
for($attempt=0;$attempt -lt 60;$attempt++){
 try{$r=Invoke-RestMethod "http://127.0.0.1:$apiPort/actuator/health/readiness";if($r.status -eq 'UP'){$ready=$true;break}}catch{}
 if($java.HasExited){throw "API exited. Read $runtime/api.log and api.err.log"}
 Start-Sleep -Seconds 2
}
if(!$ready){throw "API readiness timed out. Read $runtime/api.log"}
Invoke-WebRequest "http://127.0.0.1:$webPort" | Out-Null
Write-Output "DevSync $mode ready: http://127.0.0.1:$webPort"
} finally {
 foreach($key in $managedKeys){if($null -eq $originalEnv[$key]){Remove-Item "Env:$key" -ErrorAction SilentlyContinue}else{[Environment]::SetEnvironmentVariable($key,$originalEnv[$key],'Process')}}
}
