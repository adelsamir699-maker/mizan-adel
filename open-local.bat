@echo off
REM Mizan - تشغيل محلي: يشغّل السيرفر ثم يفتح localhost:3001
cd /d "%~dp0"
start "" http://localhost:3001/
start "MizanServer" /min cmd /c "node server.js"
