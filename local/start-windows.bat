@echo off
rem Double-click to start Learning Companion (local, temporary version).
cd /d "%~dp0"
where py >nul 2>nul && (py -3 server.py) || (python server.py)
if errorlevel 1 (echo Python 3 is needed: https://www.python.org/downloads/ & pause)
