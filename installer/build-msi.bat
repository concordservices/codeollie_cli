@echo off
REM Build MSI installer for CodeOllie CLI
REM Requires WiX Toolset v3 or later (install via: winget install WiXToolset.WiXToolset)

echo Building CodeOllie.msi...

REM Compile .wxs to .wixobj
candle CodeOllie.wxs -out CodeOllie.wixobj
if %ERRORLEVEL% neq 0 (
    echo Failed to compile .wxs
    pause
    exit /b 1
)

REM Link .wixobj to .msi
light CodeOllie.wixobj -out ..\CodeOllie.msi -ext WixUtilExtension
if %ERRORLEVEL% neq 0 (
    echo Failed to link .msi
    pause
    exit /b 1
)

echo Successfully created CodeOllie.msi
pause
