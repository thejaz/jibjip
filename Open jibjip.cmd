@echo off
cd /d "%~dp0"

PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\build_local_runtime.ps1"
if errorlevel 1 (
  echo jibjip could not build the current source.
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri 'http://127.0.0.1:4318/__jibjip_health__'; if ($response.Content -eq 'jibjip-ok') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 goto open_app

where pythonw.exe >nul 2>nul
if errorlevel 1 (
  start "jibjip local server" /min python.exe "scripts\serve_app.py"
) else (
  start "" /b pythonw.exe "scripts\serve_app.py"
)

powershell.exe -NoProfile -Command "for ($attempt = 0; $attempt -lt 40; $attempt++) { try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri 'http://127.0.0.1:4318/__jibjip_health__'; if ($response.Content -eq 'jibjip-ok') { exit 0 } } catch {}; Start-Sleep -Milliseconds 250 }; exit 1"
if errorlevel 1 (
  echo jibjip could not start its local server on http://localhost:4318/.
  echo Close any program using port 4318, then try again.
  pause
  exit /b 1
)

:open_app
powershell.exe -NoProfile -Command "$stamp = Get-Content -Raw -LiteralPath 'work\local-runtime\.jibjip-local-build.json' | ConvertFrom-Json; Start-Process ('http://localhost:4318/app/?v=' + $stamp.fingerprint)"
exit /b 0
