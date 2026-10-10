#!/usr/bin/env python3
"""Create redistributable, compressed release inputs from a local collection build."""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path, help="Directory containing informal.jsonl and formal.jsonl")
    parser.add_argument("--output", type=Path, default=Path("data/source"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    for filename, kind in (("informal.jsonl", "informal"), ("formal.jsonl", "formal")):
        source = args.source_dir / filename
        destination = args.output / f"{filename}.gz"
        count = 0
        with source.open("rb") as original, destination.open("wb") as compressed:
            with gzip.GzipFile(filename="", mode="wb", fileobj=compressed, mtime=0, compresslevel=9) as output:
                for line in original:
                    row = json.loads(line)
                    # The base ProofRank card has no license, while its method outputs
                    # are CC BY-NC-SA. Exclude those rows from this public release.
                    if kind == "informal" and row.get("dataset") == "ProofRank":
                        continue
                    output.write(line)
                    count += 1
        print(f"Wrote {count:,} {kind} rows to {destination} ({destination.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
