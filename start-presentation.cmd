@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    py -m venv .venv || goto failed
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto failed

if not exist "frontend\dist\index.html" (
    pushd frontend
    call npm.cmd ci || goto failed
    call npm.cmd run build || goto failed
    popd
)

".venv\Scripts\python.exe" -m admissions presentation || goto failed
set "DATABASE_URL=sqlite:///data/presentation.sqlite3"
for /f "delims=" %%s in ('".venv\Scripts\python.exe" -c "import secrets; print(secrets.token_urlsafe(48))"') do set "JWT_SECRET=%%s"
set "INTERNAL_NETWORKS=127.0.0.0/8,::1/128"
echo Open http://127.0.0.1:8001/ after Uvicorn starts.
".venv\Scripts\python.exe" -m uvicorn admissions.api:create_app --factory --host 127.0.0.1 --port 8001 --no-proxy-headers
if errorlevel 1 goto failed
exit /b 0

:failed
echo Setup failed. Check the error above.
pause
exit /b 1
