#!/usr/bin/env python3
"""Run the bounded native Robbo differential and integration suite."""
import shutil,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
deno=shutil.which('deno') or '/opt/homebrew/bin/deno'
subprocess.run([sys.executable,str(root/'tools/build_robbo.py'),'--check'],cwd=root,check=True)
for test in sorted((root/'tools').glob('test-robbo-*.mjs')):
    subprocess.run([deno,'run','--allow-read',str(test)],cwd=root,check=True)
print('PASS complete bounded Robbo suite; see research/robbo/PORTING.md for fidelity limits.')
