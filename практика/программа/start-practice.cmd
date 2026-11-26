@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" py -m venv .venv || goto failed
.venv\Scripts\python.exe -m pip install -r requirements.txt || goto failed
if not exist "frontend\dist\index.html" (
    call npm.cmd --prefix frontend ci || goto failed
    call npm.cmd --prefix frontend run build || goto failed
)
.venv\Scripts\python.exe -m admissions practice-demo || goto failed
set "DATABASE_URL=sqlite:///data/practice-demo.sqlite3"
set "INTERNAL_NETWORKS=127.0.0.0/8,::1/128"
for /f "delims=" %%s in ('.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"') do set "JWT_SECRET=%%s"
echo Open http://127.0.0.1:8002/ after Uvicorn starts.
.venv\Scripts\python.exe -m uvicorn admissions.api:create_app --factory --host 127.0.0.1 --port 8002 --no-proxy-headers
if errorlevel 1 goto failed
exit /b 0
:failed
echo Setup failed. Check the error above.
pause
exit /b 1
