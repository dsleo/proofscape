#!/usr/bin/env python3
"""Join route technique tags to the course catalog and publish the constellation index."""

from __future__ import annotations

import collections
import itertools
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "collection"
ORDER_FILE = DATA / "ring-order.json"
WORLD_FILE = DATA / "world-layout.json"
WORLD_W, WORLD_H, WORLD_TOP = 1700, 1150, 130
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


def _segments_cross(a: list[float], b: list[float], c: list[float], d: list[float]) -> bool:
    def turn(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return turn(a, b, c) * turn(a, b, d) < 0 and turn(c, d, a) * turn(c, d, b) < 0


def _segment_distance(p: list[float], a: list[float], b: list[float]) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy or 1.0)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


CLEAR = 0.7
SEED = 11
T0 = 600.0
STEPS = 12000


def untangle(centre: dict[str, list[float]], reach: dict[str, float], bridge: collections.Counter) -> None:
    """Move islands so bridges cross as little as the graph allows and never run over a third island.

    Annealed with a fixed seed, so the layout is reproducible. The method graph of this catalogue
    contains K5, so one crossing is unavoidable; the viewer draws that one as bridge over bridge.
    """
    links = [tuple(k) for k in bridge]
    names = list(centre)
    rng = random.Random(SEED)

    spacing = [False]

    def cost() -> float:
        total = 0.0
        for a, b in itertools.combinations(names, 2):
            gap = reach[a] + reach[b] + 70 - math.dist(centre[a], centre[b])
            if gap > 0:
                total += 40 * gap
        for (a, b), (c, d) in itertools.combinations(links, 2):
            if len({a, b, c, d}) == 4 and _segments_cross(centre[a], centre[b], centre[c], centre[d]):
                total += 4000
        for (a, b), (c, d) in itertools.combinations(links, 2) if spacing[0] else ():  # keep unrelated bridges apart, and fan out those that share an island
            if len({a, b, c, d}) == 4:
                close = min(_segment_distance(centre[a], centre[c], centre[d]), _segment_distance(centre[b], centre[c], centre[d]),
                            _segment_distance(centre[c], centre[a], centre[b]), _segment_distance(centre[d], centre[a], centre[b]))
                if close < 120:
                    total += 25 * (120 - close)
            else:
                shared = ({a, b} & {c, d}).pop()
                u = [centre[x][i] - centre[shared][i] for x in ({a, b} - {shared}) for i in (0, 1)]
                v = [centre[x][i] - centre[shared][i] for x in ({c, d} - {shared}) for i in (0, 1)]
                angle = math.acos(max(-1.0, min(1.0, (u[0] * v[0] + u[1] * v[1]) / ((math.hypot(*u) * math.hypot(*v)) or 1.0))))
                if angle < 0.5:
                    total += 1500 * (0.5 - angle)
        for a, b in links:
            total += 0.6 * math.dist(centre[a], centre[b])
            for c in names:
                if c not in (a, b):
                    clear = _segment_distance(centre[c], centre[a], centre[b]) - reach[c] * CLEAR
                    if clear < 0:
                        total += 3000 - 20 * clear
        return total

    keep, keep_cost = {f: list(p) for f, p in centre.items()}, float("inf")
    for _ in range(60):  # restarts from random scatterings; annealing alone settles on 2-3 crossings
        for f in names:
            centre[f] = [rng.uniform(reach[f] + 10, WORLD_W - reach[f] - 10), rng.uniform(reach[f] + WORLD_TOP, WORLD_H - reach[f] - 10)]
        best, temperature = cost(), T0
        for _ in range(STEPS):
            f = rng.choice(names)
            old = list(centre[f])
            centre[f][0] = min(WORLD_W - reach[f] - 10, max(reach[f] + 10, old[0] + rng.gauss(0, 70)))
            centre[f][1] = min(WORLD_H - reach[f] - 10, max(reach[f] + WORLD_TOP, old[1] + rng.gauss(0, 70)))
            now = cost()
            if now <= best or rng.random() < math.exp((best - now) / temperature):
                best = now
            else:
                centre[f] = old
            temperature = max(2.0, temperature * 0.9993)
        if best < keep_cost:
            keep, keep_cost = {f: list(p) for f, p in centre.items()}, best
        if keep_cost < 4000 + 0.6 * 11 * 700:  # one crossing and nothing run over: good enough
            break
    for f in names:
        centre[f] = keep[f]
    spacing[0] = True  # polish: spread the bridges out without letting a second crossing appear
    best, temperature = cost(), 60.0
    for _ in range(20000):
        f = rng.choice(names)
        old = list(centre[f])
        centre[f][0] = min(WORLD_W - reach[f] - 10, max(reach[f] + 10, old[0] + rng.gauss(0, 30)))
        centre[f][1] = min(WORLD_H - reach[f] - 10, max(reach[f] + WORLD_TOP, old[1] + rng.gauss(0, 30)))
        now = cost()
        if now <= best or rng.random() < math.exp((best - now) / temperature):
            best = now
        else:
            centre[f] = old
        temperature = max(1.0, temperature * 0.9997)


def world_layout(techniques: list[dict], families: list[str], order: list[str], pair_index: dict, theorem_sets: list[set]) -> dict:
    """Place one island per method domain and the methods on it.

    Islands are pulled together by the rival pairs that cross between them; within an island,
    methods that appear in the same theorems are pulled together, and a method that bridges to
    another island is pulled toward the coast facing it. Deterministic: no randomness.
    """
    family_of = {t["id"]: t["family"] for t in techniques}
    members = {f: [m for m in order if family_of[m] == f] for f in families}
    cooc: collections.Counter = collections.Counter()
    for group in theorem_sets:
        for a, b in itertools.combinations(sorted(group), 2):
            cooc[(a, b)] += 1
    pairs = {tuple(k.split("|")): len(v) for k, v in pair_index.items()}
    bridge: collections.Counter = collections.Counter()
    pull: dict[str, collections.Counter] = {m: collections.Counter() for m in family_of}
    for (a, b), w in pairs.items():
        fa, fb = family_of[a], family_of[b]
        if fa != fb:
            bridge[tuple(sorted((fa, fb)))] += w
            pull[a][fb] += w
            pull[b][fa] += w
    radius = {f: 58 + 24.0 * math.sqrt(max(1, len(members[f]))) for f in families}
    reach = {f: 0.8 * radius[f] + 74 for f in families}  # what the sites and the coast actually need
    centre = {f: [WORLD_W / 2 + 300 * math.cos(2 * math.pi * i / len(families)), (WORLD_H + WORLD_TOP) / 2 + 200 * math.sin(2 * math.pi * i / len(families))] for i, f in enumerate(families)}
    for _ in range(900):
        force = {f: [0.0, 0.0] for f in families}
        for a, b in itertools.combinations(families, 2):
            dx, dy = centre[b][0] - centre[a][0], centre[b][1] - centre[a][1]
            d = math.hypot(dx, dy) or 1.0
            w = bridge.get(tuple(sorted((a, b))), 0)
            near = reach[a] + reach[b] + 60
            # linked islands settle at a distance that shrinks with their bridge weight; others only keep apart
            f = (0.02 + 0.004 * w) * (d - (near + max(0, 100 - w * 4))) if w else min(0.0, 0.02 * (d - near))
            force[a][0] += f * dx / d; force[a][1] += f * dy / d
            force[b][0] -= f * dx / d; force[b][1] -= f * dy / d
        for f in families:
            centre[f][0] += force[f][0] * 0.5
            centre[f][1] += force[f][1] * 0.5
        for _ in range(4):  # hard constraint: coasts never overlap, and islands stay on the map
            for a, b in itertools.combinations(families, 2):
                dx, dy = centre[b][0] - centre[a][0], centre[b][1] - centre[a][1]
                d = math.hypot(dx, dy) or 1.0
                gap = reach[a] + reach[b] + 40 - d
                if gap > 0:
                    centre[a][0] -= dx / d * gap / 2; centre[a][1] -= dy / d * gap / 2
                    centre[b][0] += dx / d * gap / 2; centre[b][1] += dy / d * gap / 2
            for f in families:
                centre[f][0] = min(WORLD_W - reach[f] - 10, max(reach[f] + 10, centre[f][0]))
                centre[f][1] = min(WORLD_H - reach[f] - 10, max(reach[f] + WORLD_TOP, centre[f][1]))
    untangle(centre, reach, bridge)
    sites: dict[str, list[int]] = {}
    for f in families:
        ms, (cx, cy), r = members[f], centre[f], radius[f]
        p = {m: [cx + 0.55 * r * math.cos(2 * math.pi * i / len(ms) + 0.3), cy + 0.55 * r * math.sin(2 * math.pi * i / len(ms) + 0.3)] for i, m in enumerate(ms)}
        for _ in range(600):
            move = {m: [0.0, 0.0] for m in ms}
            for a, b in itertools.combinations(ms, 2):
                dx, dy = p[b][0] - p[a][0], p[b][1] - p[a][1]
                d = math.hypot(dx, dy) or 0.1
                w = cooc.get(tuple(sorted((a, b))), 0)
                f1 = (0.05 * (d - max(38, 96 - 11 * w)) if w else 0.0) - (0.35 * (38 - d) if d < 38 else 0.0)
                move[a][0] += f1 * dx / d; move[a][1] += f1 * dy / d
                move[b][0] -= f1 * dx / d; move[b][1] -= f1 * dy / d
            for m in ms:
                for other, w in pull[m].items():
                    ux, uy = centre[other][0] - cx, centre[other][1] - cy
                    n = math.hypot(ux, uy) or 1.0
                    s = 0.012 * min(w, 8)
                    move[m][0] += s * (cx + ux / n * r * 0.78 - p[m][0])
                    move[m][1] += s * (cy + uy / n * r * 0.78 - p[m][1])
                dx, dy = p[m][0] - cx, p[m][1] - cy
                d = math.hypot(dx, dy)
                if d > r * 0.8:
                    move[m][0] -= 0.3 * (d - r * 0.8) * dx / d
                    move[m][1] -= 0.3 * (d - r * 0.8) * dy / d
            for m in ms:
                p[m][0] += move[m][0] * 0.6
                p[m][1] += move[m][1] * 0.6
        sites.update({m: [round(p[m][0]), round(p[m][1])] for m in ms})
    return {"size": [WORLD_W, WORLD_H], "islands": {f: {"x": round(centre[f][0]), "y": round(centre[f][1]), "r": round(reach[f])} for f in families}, "sites": sites}


def frozen_world(techniques: list[dict], families: list[str], order: list[str], pair_index: dict, theorem_sets: list[set], refresh: bool) -> dict:
    """Keep the world layout stable between builds; recompute only on request."""
    ids = {t["id"]: t["family"] for t in techniques}
    if refresh or not WORLD_FILE.exists():
        world = world_layout(techniques, families, order, pair_index, theorem_sets)
        WORLD_FILE.write_text(json.dumps(world, indent=1) + "\n", encoding="utf-8")
        print(f"Wrote {WORLD_FILE.name}")
        return world
    world = json.loads(WORLD_FILE.read_text(encoding="utf-8"))
    sites = {m: xy for m, xy in world["sites"].items() if m in ids}
    for m in ids:
        if m not in sites:  # new technique: park it at its island's centre until the next refresh
            home = world["islands"][ids[m]]
            sites[m] = [home["x"], home["y"]]
            print(f"warning: no world position for {m}; run with --refresh-world")
    return {"size": world.get("size", [WORLD_W, WORLD_H]), "islands": world["islands"], "sites": sites}


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

    theorems, pair_index, triple_index, usable_total, theorem_sets = [], {}, {}, 0, []
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
        if usable:
            theorem_sets.append(set().union(*usable))
        theorems.append({"id": entry["id"], "name": entry["name"], "areas": entry["areas"], "usableRoutes": len(usable), "routes": routes})
        if len(usable) >= 2:
            pairs, triples = pairs_and_triples(usable)
            for pair in pairs:
                pair_index.setdefault("|".join(pair), []).append(entry["id"])
            for triple in triples:
                triple_index.setdefault("|".join(triple), []).append(entry["id"])

    family_order, technique_order, ring_stats = frozen_ring(vocabulary["techniques"], pair_index, refresh="--refresh-order" in sys.argv)
    world = frozen_world(vocabulary["techniques"], family_order, technique_order, pair_index, theorem_sets, refresh="--refresh-world" in sys.argv)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "vocabulary": {"families": vocabulary["families"], "techniques": vocabulary["techniques"]},
        "ring": {"families": family_order, "techniques": technique_order, **ring_stats},
        "world": world,
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
