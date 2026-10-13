#!/usr/bin/env python3
"""Join route technique tags to the course catalog and publish the constellation index."""

from __future__ import annotations

import itertools
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "collection"
OUTPUT = ROOT / "public" / "data" / "collection" / "constellation.json"
EXCLUDED = {"not-a-route", "dependent", "near-duplicate", "not-the-stated-theorem", "sketch-mismatch", "incomplete"}
FLAGS = EXCLUDED | {"title-sketch-mismatch", "sketch-self-corrects"}


def pairs_and_triples(routes: list[set[str]]) -> tuple[set[tuple], set[tuple]]:
    """Rival pairs and triples across the usable routes of one theorem.

    A tag joins a pair only if it distinguishes its route from the other one: tags shared
    by two routes, or sitting together inside one route, never form a pair.
    """
    pairs, triples = set(), set()
    for a, b in itertools.combinations(routes, 2):
        for x in a - b:
            for y in b - a:
                pairs.add(tuple(sorted((x, y))))
    for a, b, c in itertools.combinations(routes, 3):
        for x in a - b - c:
            for y in b - a - c:
                for z in c - a - b:
                    triples.add(tuple(sorted((x, y, z))))
    return pairs, triples


def selfcheck() -> None:
    fermat = [{"bijection", "modular"}, {"group"}, {"induction", "modular"}]
    pairs, triples = pairs_and_triples(fermat)
    assert ("bijection", "modular") not in pairs, "same-route pair leaked"
    assert ("induction", "modular") not in pairs, "same-route pair leaked"
    assert ("bijection", "induction") in pairs and ("group", "modular") in pairs
    assert ("bijection", "group", "induction") in triples
    assert pairs_and_triples([{"a"}, {"a"}]) == (set(), set()), "shared tag formed a pair"


def main() -> None:
    selfcheck()
    vocabulary = json.loads((DATA / "technique-vocabulary.json").read_text(encoding="utf-8"))
    tags = json.loads((DATA / "route-techniques.json").read_text(encoding="utf-8"))["routes"]
    catalog = json.loads((DATA / "historical-proof-catalog.json").read_text(encoding="utf-8"))

    ids = [t["id"] for t in vocabulary["techniques"]]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate technique ids in the vocabulary")
    families = {f["id"] for f in vocabulary["families"]}
    for technique in vocabulary["techniques"]:
        if technique["family"] not in families:
            raise ValueError(f"technique {technique['id']} has unknown family {technique['family']}")
    known, fields = set(ids), set(vocabulary["fields"])

    catalog_routes = {route["id"] for entry in catalog["entries"] for route in entry["routes"]}
    if catalog_routes != set(tags):
        raise ValueError(f"tag/catalog route mismatch; untagged={sorted(catalog_routes - set(tags))[:5]}, unknown={sorted(set(tags) - catalog_routes)[:5]}")
    for route_id, tag in tags.items():
        unknown = [t for t in tag["techniques"] if t not in known]
        if unknown:
            raise ValueError(f"route {route_id} uses unknown techniques {unknown}")
        if len(tag["techniques"]) > 3:
            raise ValueError(f"route {route_id} has more than three techniques")
        if tag.get("borrowsFrom") not in fields | {None}:
            raise ValueError(f"route {route_id} has unknown borrowsFrom {tag.get('borrowsFrom')}")
        if tag.get("flag") not in FLAGS | {None}:
            raise ValueError(f"route {route_id} has unknown flag {tag.get('flag')}")
        if not tag["techniques"] and not tag.get("flag") and not tag.get("derivesFromTheorem"):
            raise ValueError(f"route {route_id} has no technique, flag, or derivesFromTheorem")

    theorems, pair_index, triple_index, usable_total = [], {}, {}, 0
    for entry in catalog["entries"]:
        routes, usable = [], []
        for route in entry["routes"]:
            tag = tags[route["id"]]
            excluded = tag.get("flag") if tag.get("flag") in EXCLUDED else None
            routes.append({
                "id": route["id"],
                "title": route["title"],
                "techniques": tag["techniques"],
                "derivesFromTheorem": bool(tag.get("derivesFromTheorem")),
                "excluded": excluded,
                "borrowsFrom": tag.get("borrowsFrom"),
                "titleSketchDisagree": tag.get("flag") in {"title-sketch-mismatch", "sketch-self-corrects"},
            })
            if not excluded and tag["techniques"]:
                usable.append(set(tag["techniques"]))
        usable_total += len(usable)
        theorems.append({"id": entry["id"], "name": entry["name"], "areas": entry["areas"], "usableRoutes": len(usable), "routes": routes})
        if len(usable) >= 2:
            pairs, triples = pairs_and_triples(usable)
            for pair in pairs:
                pair_index.setdefault("|".join(pair), []).append(entry["id"])
            for triple in triples:
                triple_index.setdefault("|".join(triple), []).append(entry["id"])

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "vocabulary": {"families": vocabulary["families"], "techniques": vocabulary["techniques"]},
        "theorems": theorems,
        "pairs": pair_index,
        "triples": triple_index,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    with_two = sum(1 for t in theorems if t["usableRoutes"] >= 2)
    print(f"Wrote {len(theorems)} theorems ({with_two} with 2+ usable routes, {usable_total} usable routes), "
          f"{len(pair_index)} pairs, {len(triple_index)} triples to {OUTPUT}")


if __name__ == "__main__":
    main()
