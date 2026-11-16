@echo off
setlocal

rem Use the compatible project-local Node runtime when available.
set "MOBILE_NODE_HOME=%~dp0.tools\node-v22.23.5-win-x64"
if exist "%MOBILE_NODE_HOME%\node.exe" set "PATH=%MOBILE_NODE_HOME%;%PATH%"

pushd "%~dp0"
node --version
call npm.cmd run build -- %*
set "MOBILE_BUILD_EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %MOBILE_BUILD_EXIT_CODE%
