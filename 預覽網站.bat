@echo off
rem Local preview for the IHS Lab website.
rem Double-click this file: it starts a local web server and opens the site.
rem Close the "IHS Lab server" window to stop the server.
cd /d "%~dp0"
set PORT=8123

where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>nul
  if errorlevel 1 (
    echo Python was not found. Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
  )
  set PY=py
)

start "IHS Lab server" %PY% -m http.server %PORT%
timeout /t 2 /nobreak >nul
start "" http://localhost:%PORT%/
