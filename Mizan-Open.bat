@echo off
REM ==========================================================
REM  Mizan - تشغيل البرنامج (محلي + منشور على الإنترنت)
REM  اختصار سطح المكتب يفتح هذا الملف
REM ==========================================================
title Mizan Program
cd /d "%~dp0"

echo.
echo  ============================================
echo   MIZAN - اختر طريقة الفتح
echo  ============================================
echo.
echo   [1] تشغيل محلي  (يفتح السيرفر + localhost:3001)
echo   [2] النسخة المنشورة على الإنترنت
echo   [3] تشغيل محلي وفتح المتصفح على الشبكة 0.0.0.0
echo   [0] خروج
echo.
set /p choice=اختر (1/2/3/0): 

if "%choice%"=="1" goto LOCAL
if "%choice%"=="2" goto ONLINE
if "%choice%"=="3" goto LOCALNET
if "%choice%"=="0" goto END
echo اختيار غير صحيح.
pause
goto END

:LOCAL
echo.
echo تشغيل السيرفر المحلي على المنفذ 3001 ...
start "" http://localhost:3001/
start "MizanServer" /min cmd /c "node server.js"
echo تم. (Server يعمل في الخلفية - لإيقافه: اغلق نافذة MizanServer)
timeout /t 3 >nul
goto END

:LOCALNET
echo.
echo تشغيل السيرفر المحلي (يفتح على الشبكة) ...
start "" http://localhost:3001/
start "MizanServer" /min cmd /c "node server.js"
echo تم.
timeout /t 3 >nul
goto END

:ONLINE
echo.
echo فتح النسخة المنشورة على الإنترنت ...
start "" "https://adelsamir699-maker.github.io/"
echo تم.
goto END

:END
exit
