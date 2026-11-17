@echo off
setlocal

rem Prefer the project-local Node runtime when it is available.
set "MOBILE_NODE_HOME=%~dp0.tools\node-v22.23.5-win-x64"
if exist "%MOBILE_NODE_HOME%\node.exe" set "PATH=%MOBILE_NODE_HOME%;%PATH%"

pushd "%~dp0"
call npm.cmd start -- --host=localhost --port=8100 %*
set "MOBILE_SERVE_EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %MOBILE_SERVE_EXIT_CODE%
