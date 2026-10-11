#!/bin/bash
# Double-click to start Learning Companion (local, temporary version).
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then python3 server.py; else echo "Python 3 is needed: https://www.python.org/downloads/"; read -r; fi
