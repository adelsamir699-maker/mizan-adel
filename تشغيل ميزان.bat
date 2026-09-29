@echo off
title Mizan
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [ERROR] Node.js is not installed or not in PATH
  echo   Download it from: https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM Start the docs server hidden; it stays alive even after this window closes
netstat -ano | findstr /r ":3060[ ]*LISTENING" >nul || (pushd "%~dp0" & powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList 'server.js' -WindowStyle Hidden" & popd)
ping -n 3 127.0.0.1 >nul
start "" "http://localhost:3060/open"

echo.
echo   Mizan server started in background and opened in your browser.
echo   The server keeps running after you close this window.
echo.
echo   To stop the server:  taskkill /im node.exe /f
echo.
pause
