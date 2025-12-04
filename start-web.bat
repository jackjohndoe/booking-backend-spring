@echo off
cd /d "%~dp0"
echo Starting Expo web server...
npx expo start --web --no-dev --minify
pause



