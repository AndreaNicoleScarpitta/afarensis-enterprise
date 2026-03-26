@echo off
echo 🔧 FIXING SSL CERTIFICATE ISSUES FOR PYTHON PIP
echo ================================================
echo.

echo Step 1: Updating pip with certificate bypass...
python -m pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org --upgrade pip

echo.
echo Step 2: Installing/updating certificates...
python -m pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org --upgrade certifi

echo.
echo Step 3: Installing essential build tools...
python -m pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org pyinstaller setuptools wheel

echo.
echo ✅ Certificate fix complete!
echo.
echo Now you can run: BUILD_EXE.bat
echo.
pause
