@echo off
echo Starting Afarensis Backend...
cd /d "%~dp0"
pip install fastapi uvicorn httpx python-jose[cryptography] pydantic --quiet
python simple_backend.py
pause
