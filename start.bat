@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8137
echo ============================================
echo   Reading - TXT 阅读编辑器
echo   正在启动本地服务器 http://localhost:%PORT%/index.html
echo   关闭本窗口即可停止服务
echo ============================================

where python >nul 2>nul
if %errorlevel%==0 goto usepy
where py >nul 2>nul
if %errorlevel%==0 goto usepy2
where node >nul 2>nul
if %errorlevel%==0 goto usenode

echo.
echo [提示] 未检测到 Python 或 Node，将直接打开 index.html
echo        （可正常阅读和编辑，保存时会下载副本）
start "" "index.html"
pause
exit /b

:usepy
start "" "http://localhost:%PORT%/index.html"
python -m http.server %PORT%
exit /b

:usepy2
start "" "http://localhost:%PORT%/index.html"
py -m http.server %PORT%
exit /b

:usenode
start "" "http://localhost:%PORT%/index.html"
node server.js
exit /b
