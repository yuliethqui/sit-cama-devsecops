@echo off
setlocal
set "MOBILE_NODE_HOME=%~dp0.tools\node-v22.23.5-win-x64"
if exist "%MOBILE_NODE_HOME%\node.exe" set "PATH=%MOBILE_NODE_HOME%;%PATH%"
pushd "%~dp0"
call npm.cmd run build -- --configuration=android-debug
if errorlevel 1 goto failed
call npx.cmd cap sync android
if errorlevel 1 goto failed
pushd android
call gradlew.bat :app:assembleDebug
set "MOBILE_ANDROID_EXIT_CODE=%ERRORLEVEL%"
popd
popd
exit /b %MOBILE_ANDROID_EXIT_CODE%
:failed
set "MOBILE_ANDROID_EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %MOBILE_ANDROID_EXIT_CODE%
