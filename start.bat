@echo off
setlocal
cd /d "%~dp0"
if not defined PORT set "PORT=8137"
echo ============================================
echo   Reading - TXT Reader
echo   URL: http://127.0.0.1:%PORT%/index.html
echo   Close this window to stop the server.
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
echo Starting server (python) on 127.0.0.1:%PORT% ...
start "" /b cmd /c "ping 127.0.0.1 -n 2 >nul & explorer http://127.0.0.1:%PORT%/index.html"
python -m http.server %PORT% --bind 127.0.0.1
goto end

:usepy2
echo Starting server (py) on 127.0.0.1:%PORT% ...
start "" /b cmd /c "ping 127.0.0.1 -n 2 >nul & explorer http://127.0.0.1:%PORT%/index.html"
py -m http.server %PORT% --bind 127.0.0.1
goto end

:usenode
echo Starting server (node) on 127.0.0.1:%PORT% ...
start "" /b cmd /c "ping 127.0.0.1 -n 2 >nul & explorer http://127.0.0.1:%PORT%/index.html"
node server.js
goto end

:noruntime
echo [WARN] Python/Node not found. Opening index.html (save = download copy).
start "" "index.html"
pause
goto end

:end
endlocal
