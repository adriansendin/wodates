#!/usr/bin/env python3
"""
Script para ejecutar type checking y linting.
Equivalente a 'npm run check' en los otros módulos.

Uso: python check.py
"""

import subprocess
import sys
from pathlib import Path

def run_command(command: list[str], description: str) -> bool:
    """Ejecuta un comando y retorna True si es exitoso."""
    print(f"[*] {description}...")
    result = subprocess.run(command, cwd=Path(__file__).parent)
    if result.returncode != 0:
        print(f"[ERROR] {description} fallo!")
        return False
    return True

def main():
    """Ejecuta type-check y lint."""
    python_exe = sys.executable
    checks = [
        ([python_exe, "-m", "mypy", "app", "main.py"], "Running type checks"),
        ([python_exe, "-m", "ruff", "check", "app", "main.py"], "Running linter"),
    ]
    
    for command, description in checks:
        if not run_command(command, description):
            sys.exit(1)
    
    print("[OK] All checks passed!")

if __name__ == "__main__":
    main()

