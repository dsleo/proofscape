#!/usr/bin/env python3
"""Check completed Route B proofs in a Mathlib checkout at the pinned revision.

Usage: python3 scripts/check_route_b_proofs.py /path/to/mathlib4
The checkout must have its Lean toolchain and Mathlib cache installed.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/check_route_b_proofs.py /path/to/mathlib4')
mathlib = Path(sys.argv[1]).resolve()
data = json.loads((root / 'data/collection/proof-comparisons.json').read_text())
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=mathlib, text=True).strip()
if revision != data['revision']:
    raise SystemExit(f'Wrong Mathlib revision: expected {data["revision"]}, got {revision}')
proofs = [r for r in data['records'] if r.get('formalProofVerified')]
for record in proofs:
    path = root / record['formalProofSource']
    code = path.read_text(encoding='utf-8')
    if code.strip() != record['formalSketch'].strip():
        raise SystemExit(f'{record["id"]}: displayed proof differs from its source')
    if re.search(r'\b(sorry|admit|axiom)\b', code):
        raise SystemExit(f'{record["id"]}: unfinished proof or declared axiom')
    print(f'Checking {record["id"]}: {path.name}', flush=True)
    subprocess.run(['lake', 'env', 'lean', str(path)], cwd=mathlib, check=True)
print(f'Checked {len(proofs)} Route B proofs against Mathlib {revision}.')
