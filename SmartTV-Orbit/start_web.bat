@echo off
title SmartTV Orbit - Cloud Remote
echo Starting SmartTV Orbit Web App on port 8090...
echo.
echo Local URL: http://localhost:8090
echo Phone URL: http://10.218.252.160:8090
echo.
python -m http.server 8090 --directory "%~dp0web"
pause
