@echo off
REM Local Cricket Management - run all tests (double-click this file, or run it from cmd)
REM Step 1: production build (catches typing mistakes in screens). Step 2: rules tests (tests\*.rules.test.mjs).
REM Everything is also saved to tests\test-output.txt
setlocal
pushd "%~dp0.."
set OUT=tests\test-output.txt
echo Local Cricket Management test run - %date% %time% > %OUT%
echo ============================================================ >> %OUT%

echo.
echo [1/2] Building the website (npm run build)...
echo [1/2] npm run build >> %OUT%
call npm run build >> %OUT% 2>&1
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Open tests\test-output.txt and look for the first error.
  goto :failed
)
echo       Build OK.

echo.
echo [2/2] Running the rules tests...
echo. >> %OUT%
echo [2/2] node tests\run-all.mjs >> %OUT%
node tests\run-all.mjs > tests\test-tap.txt 2>&1
set TESTCODE=%errorlevel%
type tests\test-tap.txt >> %OUT%
findstr /B /C:"# tests" /C:"# pass" /C:"# fail" /C:"not ok" tests\test-tap.txt
if not "%TESTCODE%"=="0" goto :failed

echo.
echo ============================================================
echo   ALL TESTS PASSED  - safe to deploy and push.
echo ============================================================
popd
pause
exit /b 0

:failed
echo.
echo ============================================================
echo   TESTS FAILED  - do NOT deploy. Send me tests\test-output.txt
echo ============================================================
popd
pause
exit /b 1
