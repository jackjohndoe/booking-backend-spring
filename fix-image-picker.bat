@echo off
echo Clearing caches and restarting Expo...
echo.

echo Stopping any running Expo processes...
taskkill /F /IM node.exe 2>nul

echo Clearing Metro bundler cache...
if exist "%TEMP%\metro-*" rmdir /s /q "%TEMP%\metro-*" 2>nul
if exist "%TEMP%\haste-map-*" rmdir /s /q "%TEMP%\haste-map-*" 2>nul

echo Clearing watchman cache...
watchman watch-del-all 2>nul

echo Clearing npm cache...
call npm cache clean --force

echo Starting Expo with cleared cache...
call npx expo start --clear

pause

