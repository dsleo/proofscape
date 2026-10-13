#!/usr/bin/env python3
"""Join route technique tags to the course catalog and publish the constellation index."""

from __future__ import annotations

import itertools
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "collection"
ORDER_FILE = DATA / "ring-order.json"
OUTPUT = ROOT / "public" / "data" / "collection" / "constellation.json"
EXCLUDED = {"not-a-route", "dependent", "near-duplicate", "not-the-stated-theorem", "sketch-mismatch", "incomplete"}
FLAGS = EXCLUDED | {"title-sketch-mismatch", "sketch-self-corrects"}
GAP_DEG = 8  # empty arc between two families on the ring
# Hand-made seed: neighbouring domains share methods. The heuristic never ends worse than this.
SEED_FAMILIES = ["logic", "recursion", "discrete", "algebraic", "analytic", "geometric"]
SEED_ORDER = """
choice-maximality model-construction diagonalisation
extremal-descent fixed-point-iteration induction
pigeonhole density-increment counting bijection path-exchange probabilistic-argument arithmetic-identities generating-functions telescoping
group-action modular-arithmetic euclidean-gcd explicit-construction polynomial-methods leading-term-reduction generic-parameter-choice ideal-module-structure galois-field-theory character-sums categorical-equivalence linear-algebra
series-asymptotics euler-product-zeta fourier-analysis measure-approximation measure-transport rolle-mean-value integral-calculus ode-uniqueness convexity-inequality duality-separation orthogonal-decomposition variational-extremum completeness baire-category compactness ergodic-correspondence pde-potential maximum-principle complex-analysis
winding-degree differential-forms k-theory-pushforward morse-theory homology-cohomology local-to-global-patching topological-structure move-invariance triangulation-euler lattice-geometry dimension-lift symmetrization dissection-area similarity-trig coordinates-vectors
""".split()


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


def _angles(families: list[str], inner: dict[str, list[str]], count: int) -> dict[str, float]:
    per = (360 - GAP_DEG * len(families)) / count
    out, cursor = {}, 0.0
    for f in families:
        for i, t in enumerate(inner[f]):
            out[t] = cursor + per * (i + 0.5)
        cursor += per * len(inner[f]) + GAP_DEG
    return out


def _cost(families: list[str], inner: dict[str, list[str]], weight: dict, count: int) -> float:
    a = _angles(families, inner, count)
    total = 0.0
    for (x, y), w in weight.items():
        d = abs(a[x] - a[y])
        total += w * min(d, 360 - d)
    return total


def ring_order(techniques: list[dict], pair_index: dict[str, list[int]]) -> tuple[list[str], list[str], dict]:
    """Order families and techniques around the ring so frequent rival pairs sit close.

    Deterministic: families are chosen by exhaustive search, techniques within a family by
    repeated barycentre sorting followed by adjacent-swap hill climbing, both starting from
    SEED_ORDER and accepting only strict improvements, so the result is never worse than the seed.
    """
    family_of = {t["id"]: t["family"] for t in techniques}
    seed_rank = {t: i for i, t in enumerate(SEED_ORDER)}
    members = {f: sorted((t for t in family_of if family_of[t] == f), key=lambda t: (seed_rank.get(t, 10**6), t)) for f in set(family_of.values())}
    weight = {tuple(k.split("|")): len(v) for k, v in pair_index.items()}
    count = len(family_of)

    def angles(families, inner):
        return _angles(families, inner, count)

    def cost(families, inner):
        return _cost(families, inner, weight, count)

    seed_cost = cost(SEED_FAMILIES, members)
    best_families, best = SEED_FAMILIES, seed_cost
    for tail in itertools.permutations(SEED_FAMILIES[1:]):
        order = [SEED_FAMILIES[0], *tail]
        c = cost(order, members)
        if c < best - 1e-9:
            best_families, best = order, c
    inner = {f: list(v) for f, v in members.items()}
    for _ in range(60):
        improved = False
        a = angles(best_families, inner)
        for f in best_families:
            ids = inner[f]
            mid = sum(a[t] for t in ids) / len(ids)
            def target(t: str) -> float:
                sx = sy = 0.0
                for (x, y), w in weight.items():
                    other = y if x == t else x if y == t else None
                    if other is not None and other != t:
                        sx += w * math.cos(math.radians(a[other])); sy += w * math.sin(math.radians(a[other]))
                if sx == sy == 0:
                    return a[t] - mid
                return (math.degrees(math.atan2(sy, sx)) - mid + 180) % 360 - 180
            ranked = sorted(ids, key=lambda t: (target(t), ids.index(t)))
            trial = {**inner, f: ranked}
            if cost(best_families, trial) < cost(best_families, inner) - 1e-9:
                inner, improved = trial, True
        for f in best_families:
            for i in range(len(inner[f]) - 1):
                trial = {**inner, f: inner[f][:i] + [inner[f][i + 1], inner[f][i]] + inner[f][i + 2:]}
                if cost(best_families, trial) < cost(best_families, inner) - 1e-9:
                    inner, improved = trial, True
        if not improved:
            break
    final = cost(best_families, inner)
    assert final <= seed_cost + 1e-9, "ring order got worse than its seed"
    ordered = [t for f in best_families for t in inner[f]]
    return best_families, ordered, {"seedCost": round(seed_cost), "finalCost": round(final)}


def frozen_ring(techniques: list[dict], pair_index: dict, refresh: bool) -> tuple[list[str], list[str], dict]:
    """Use the checked-in ring order so the figure stays stable; recompute only on request."""
    ids = {t["id"]: t["family"] for t in techniques}
    weight = {tuple(k.split("|")): len(v) for k, v in pair_index.items()}
    if refresh or not ORDER_FILE.exists():
        families, ordered, stats = ring_order(techniques, pair_index)
        ORDER_FILE.write_text(json.dumps({"families": families, "techniques": ordered, "note": "Generated by build_constellation.py --refresh-order; edit only by regenerating."}, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {ORDER_FILE.name}")
        return families, ordered, stats
    stored = json.loads(ORDER_FILE.read_text(encoding="utf-8"))
    ordered = [t for t in stored["techniques"] if t in ids]
    added = [t for t in ids if t not in set(ordered)]
    for t in added:  # new technique: park it at the end of its family until the next refresh
        last = max((i for i, x in enumerate(ordered) if ids[x] == ids[t]), default=len(ordered) - 1)
        ordered.insert(last + 1, t)
    if added or len(ordered) != len(stored["techniques"]):
        print(f"warning: ring order out of date ({len(added)} new, {len(stored['techniques']) - (len(ordered) - len(added))} removed); run with --refresh-order")
    families = [f for f in stored["families"] if any(ids[t] == f for t in ordered)]
    inner = {f: [t for t in ordered if ids[t] == f] for f in families}
    seed_inner = {f: sorted((t for t in ids if ids[t] == f), key=lambda t: ({x: i for i, x in enumerate(SEED_ORDER)}.get(t, 10**6), t)) for f in set(ids.values())}
    return families, [t for f in families for t in inner[f]], {
        "seedCost": round(_cost(SEED_FAMILIES, seed_inner, weight, len(ids))),
        "finalCost": round(_cost(families, inner, weight, len(ids))),
    }


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
    missing = [t["id"] for t in vocabulary["techniques"] if not t.get("short")]
    if missing:
        raise ValueError(f"techniques without a short label: {missing}")
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

    family_order, technique_order, ring_stats = frozen_ring(vocabulary["techniques"], pair_index, refresh="--refresh-order" in sys.argv)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "vocabulary": {"families": vocabulary["families"], "techniques": vocabulary["techniques"]},
        "ring": {"families": family_order, "techniques": technique_order, **ring_stats},
        "theorems": theorems,
        "pairs": pair_index,
        "triples": triple_index,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    with_two = sum(1 for t in theorems if t["usableRoutes"] >= 2)
    print(f"Wrote {len(theorems)} theorems ({with_two} with 2+ usable routes, {usable_total} usable routes), "
          f"{len(pair_index)} pairs, {len(triple_index)} triples to {OUTPUT}")
    print(f"Ring order: families {family_order}; chord length {ring_stats['seedCost']} -> {ring_stats['finalCost']}")


if __name__ == "__main__":
    main()
