@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PORT=8137"
echo ============================================
echo   Reading - TXT 阅读编辑器
echo   启动本地服务器:  http://localhost:%PORT%/index.html
echo   关闭本窗口即可停止服务
echo ============================================
echo.

set "RUNTIME="
where python >nul 2>nul && set "RUNTIME=python"
if not defined RUNTIME ( where py >nul 2>nul && set "RUNTIME=py" )
if not defined RUNTIME ( where node >nul 2>nul && set "RUNTIME=node" )

if not defined RUNTIME goto noruntime
if "%RUNTIME%"=="python" goto usepy
if "%RUNTIME%"=="py" goto usepy2
if "%RUNTIME%"=="node" goto usenode
goto noruntime

:usepy
start "" "http://localhost:%PORT%/index.html"
python -m http.server %PORT%
goto end

:usepy2
start "" "http://localhost:%PORT%/index.html"
py -m http.server %PORT%
goto end

:usenode
start "" "http://localhost:%PORT%/index.html"
node server.js
goto end

:noruntime
echo [提示] 未检测到 Python 或 Node，将直接打开 index.html
echo        （可正常阅读和编辑，保存时会下载副本到本地）
start "" "index.html"
pause
goto end

:end
endlocal
