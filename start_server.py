"""Start the Afarensis Enterprise backend server."""
import os, sys, subprocess

# Determine project root from this script's location
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(script_dir, "backend")

# Run uvicorn as a subprocess from the backend directory
sys.exit(subprocess.call(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"],
    cwd=backend_dir
))
