@echo off
title Mizan Program
cd /d "%~dp0"

echo.
echo  ============================================
echo   MIZAN - choose how to open
echo  ============================================
echo.
echo   [1] Open Mizan local   (server + localhost:3060)
echo   [2] Open Mizan online  (GitHub Pages + local docs server)
echo   [0] Exit
echo.
set /p choice=Choice (1/2/0):

if "%choice%"=="1" goto LOCAL
if "%choice%"=="2" goto ONLINE
if "%choice%"=="0" goto END
echo Wrong choice.
ping -n 3 127.0.0.1 >nul
goto END

:LOCAL
echo Starting Mizan docs server (hidden, stays alive)...
call :STARTSRV
ping -n 3 127.0.0.1 >nul
start "" "http://localhost:3060/open"
goto END

:ONLINE
echo Starting Mizan docs server (hidden, stays alive)...
call :STARTSRV
start "" "https://adelsamir699-maker.github.io/"
goto END

:STARTSRV
netstat -ano | findstr /r ":3060[ ]*LISTENING" >nul && goto :eof
pushd "%~dp0"
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList 'server.js' -WindowStyle Hidden"
popd
goto :eof

:END
exit
