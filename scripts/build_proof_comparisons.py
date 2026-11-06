#!/usr/bin/env python3
"""Validate and publish the curated Mathlib/alternative proof comparisons."""
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'data/collection/proof-comparisons.json'
target = ROOT / 'public/data/collection/proof-comparisons.json'
license_source = ROOT / 'data/collection/MATHLIB-LICENSE.txt'
data = json.loads(source.read_text(encoding='utf-8'))
records = data['records']
assert len({r['id'] for r in records}) == len(records), 'duplicate comparison ID'
matched = [r['historicalId'] for r in records if r['historicalId'] is not None]
assert len(set(matched)) == len(matched), 'multiple comparisons mapped to one Explore entry'
catalog = json.loads((ROOT / 'data/collection/historical-proof-catalog.json').read_text(encoding='utf-8'))
catalog_ids = {entry['id'] for entry in catalog['entries']}
assert set(matched) <= catalog_ids, 'comparison maps to an unknown Explore entry'
for r in records:
    for key in ('id', 'name', 'statement', 'proofA', 'proofB', 'formalSketch', 'evidence', 'evidenceStatus'):
        assert r.get(key), f"{r.get('id')}: missing {key}"
    assert r['mathlibCore'], f"{r['id']}: missing Mathlib proof"
    for declaration in r['mathlibCore'] + r['mathlibSupporting']:
        for field in ('symbol', 'code', 'url', 'attribution', 'role'):
            assert declaration.get(field), f"{r['id']}: missing declaration {field}"
        assert urlparse(declaration['url']).scheme == 'https'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
shutil.copyfile(license_source, target.parent / 'MATHLIB-LICENSE.txt')
print(f"Wrote {len(records)} Mathlib comparisons ({len(matched)} linked to Explore)")
