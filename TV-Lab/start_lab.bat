@echo off
title TCL Google TV Experiment Lab
echo Starting TCL Google TV Experiment Lab...
start "" http://localhost:8080
python "%~dp0server.py" 8080
pause
