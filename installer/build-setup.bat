@echo off
setlocal
pushd "%~dp0\.."

call npm run build
set "BUILD_RESULT=%ERRORLEVEL%"
if not "%BUILD_RESULT%"=="0" goto finish

call npm run build:exe
set "BUILD_RESULT=%ERRORLEVEL%"
if not "%BUILD_RESULT%"=="0" goto finish

set "ISCC="
where ISCC.exe >nul 2>nul
if "%ERRORLEVEL%"=="0" set "ISCC=ISCC.exe"

if not defined ISCC if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"

if not defined ISCC (
  echo Inno Setup 6 was not found. Install it from https://jrsoftware.org/isdl.php and try again.
  set "BUILD_RESULT=1"
  goto finish
)

"%ISCC%" installer\CodeOllie.iss
set "BUILD_RESULT=%ERRORLEVEL%"

if "%BUILD_RESULT%"=="0" echo Created CodeOllie-Setup-64bit.exe in the repository root.

:finish
popd
if not "%BUILD_RESULT%"=="0" exit /b %BUILD_RESULT%
exit /b 0
