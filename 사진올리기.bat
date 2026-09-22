@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  창연명리 사진 올리기
echo  사진 폴더: C:\Users\wuenw\Desktop\사진
echo ============================================
echo.
node update-site.js
echo.
pause
