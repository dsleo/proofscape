#!/usr/bin/env python3
"""Generate the static index and per-record assets used by GitHub Pages."""

from __future__ import annotations

import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data" / "source"
OUTPUT = ROOT / "public" / "data" / "collection"


def preview(text: str, limit: int = 420) -> str:
    """Keep the index small: the full statement lives in the record and is read when it is opened."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut + " …"


def main() -> None:
    records_dir = OUTPUT / "records"
    if records_dir.exists():
        for old_file in records_dir.iterdir():
            if old_file.is_file():
                old_file.unlink()
    records_dir.mkdir(parents=True, exist_ok=True)

    items: list[dict] = []
    source_counts: Counter[tuple[str, str]] = Counter()

    for filename, kind in (("informal.jsonl.gz", "informal"), ("formal.jsonl.gz", "formal")):
        with gzip.open(SOURCES / filename, "rb") as source:
            for line in source:
                row = json.loads(line)
                statement = row["statement"] if kind == "informal" else row["problem"]
                item = {
                    "id": row["id"],
                    "kind": kind,
                    "dataset": row["dataset"],
                    "title": row.get("source_metadata", {}).get("title") if kind == "informal" else None,
                    "statement": preview(statement),
                    "source_id": row.get("source_id"),
                    "categories": [c for c in (row.get("categories") or [])][:4] if kind == "informal" else [],
                    "n_proofs": row["n_proofs"] if kind == "informal" else 2,
                    # Avoid the .gz extension: static hosts may transparently
                    # serve it with Content-Encoding: gzip, which makes the
                    # browser decompress it before our client-side decoder.
                    "record_file": f"{hashlib.sha256(row['id'].encode('utf-8')).hexdigest()}.json.bin",
                }
                items.append(item)
                payload = json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
                record_path = records_dir / item["record_file"]
                record_path.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
                source_counts[(kind, row["dataset"])] += 1

    payload = {
        "version": 1,
        "sources": [{"kind": kind, "dataset": dataset, "count": count} for (kind, dataset), count in sorted(source_counts.items())],
        "items": items,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "index.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total_bytes = sum(path.stat().st_size for path in records_dir.iterdir() if path.is_file()) + (OUTPUT / "index.json").stat().st_size
    print(f"Wrote {len(items):,} records ({total_bytes:,} static bytes) to {OUTPUT}")


if __name__ == "__main__":
    main()
