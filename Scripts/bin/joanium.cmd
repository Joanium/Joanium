@echo off
setlocal

set "INSTALLED=%LOCALAPPDATA%\Programs\Joanium\Joanium.exe"

if exist "%INSTALLED%" (
    start "" "%INSTALLED%" %*
    exit /b 0
)

echo [joanium] Joanium is not installed.
echo   Download: https://github.com/Joanium/Joanium/releases/latest
exit /b 1
