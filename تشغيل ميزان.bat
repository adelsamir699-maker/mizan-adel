@echo off
chcp 65001 > nul
title Mizan
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [خطأ] Node.js غير مثبت أو مش موجود في PATH
  echo   نزّله من: https://nodejs.org
  echo.
  pause
  exit /b 1
)

start "Mizan Web Server" /min node server.js
timeout /t 2 /nobreak >nul
start "" "http://localhost:3060/open"

echo.
echo   تم تشغيل سيرفر ميزان وفتحه في المتصفح.
echo.
echo   لإيقاف السيرفر: افتح نافذة "Mizan Web Server" من شريط المهام
echo   واضغط Ctrl+C  (أو taskkill /fi "WINDOWTITLE eq Mizan Web Server*" /t /f)
echo.
echo   ملاحظة: لو الصفحة فتحت قديمة، يبقى فيه سيرفر تاني شغال على
echo   نفس المنفذ — وقّفه وافتح الملف ده تاني.
echo.
pause
