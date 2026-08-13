@echo off
setlocal
set "DIR=%~dp0"
set "CHECKFILE=%TEMP%\badmintoncounter_check.txt"

curl -s -o nul -w "%%{http_code}" http://localhost:3200/ > "%CHECKFILE%" 2>nul
set /p CODE=<"%CHECKFILE%"
del "%CHECKFILE%" >nul 2>nul

if not "%CODE%"=="200" (
  start "BadmintonCounter Server" /min cmd /c "cd /d "%DIR%" && npm start"
  timeout /t 2 /nobreak >nul
)

start "" "http://localhost:3200"
