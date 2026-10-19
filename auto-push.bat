batch
@echo off
cd /d "%~dp0"
git add .
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
git commit -m "Auto-sync: %mydate% %mytime%" 2>nul
if errorlevel 1 (
  echo No changes to commit at %mydate% %mytime% >> auto-push.log
) else (
  git push origin master >> auto-push.log 2>&1
  echo Pushed at %mydate% %mytime% >> auto-push.log
)
exit /b 0