@echo off
chcp 65001 >nul
title Peter Walks the Sea
echo.
echo   Peter Walks the Sea -- starting...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found on this PC.
  echo   Install it from https://nodejs.org then double-click this again.
  echo.
  pause
  exit /b 1
)
echo   A browser window will open. Keep THIS window open while you play.
echo.
node "%~dp0scripts\serve.mjs" "%~dp0."
echo.
echo   Server stopped.
pause
