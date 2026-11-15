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
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/index.html"
  python -m http.server %PORT%
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    start "" "http://localhost:%PORT%/index.html"
    py -m http.server %PORT%
  ) else (
    echo.
    echo [提示] 未检测到 Python。将直接打开 index.html（可用，但保存为下载副本）。
    start "" "index.html"
    pause
  )
)
