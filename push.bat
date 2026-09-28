@echo off
chcp 65001 >nul
setlocal

rem ===== RoutineCheck: add -> commit -> push =====
cd /d "C:\dev\web\projects\RoutineCheck" || (
  echo [ERROR] Folder not found: C:\dev\web\projects\RoutineCheck
  pause & exit /b 1
)

rem Commit message: 1st argument, or ask (Enter = timestamp)
set "MSG=%~1"
if "%MSG%"=="" set /p "MSG=Commit message (Enter = auto): "
if "%MSG%"=="" set "MSG=update %date% %time:~0,5%"

echo.
git status --short
echo.

git add -A
git diff --cached --quiet && (
  echo Nothing to commit. Pushing anyway...
) || (
  git commit -m "%MSG%" || ( echo [ERROR] commit failed & pause & exit /b 1 )
)

git push origin HEAD || (
  echo.
  echo [ERROR] push failed. Try: git pull --rebase origin HEAD
  pause & exit /b 1
)

echo.
echo Done! https://github.com/kaiyoshida0318/routinecheck
pause
