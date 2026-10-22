#!/usr/bin/env python3
"""Reconcile the three small-model source reviews with a conservative catalogue decision."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/collection/source-review-queue"
OUTPUT = ROOT / "data/collection/remaining-proof-source-review.json"

# Each of these was checked against the source text and the catalogue sketch.
ACCEPTED_FULL = {
    "5-r2", "6-r2", "7-r1", "10-r2", "11-r1", "11-r2", "12-r1", "13-r1",
    "14-r1", "16-r1", "18-r2", "19-r1", "20-r1",
    "28-r1", "43-r3", "61-r1", "66-r1", "66-r2", "76-r1", "76-r2",
    "81-r1", "98-r1", "108-r1", "108-r2", "108-r3",
    "129-r1", "129-r3", "131-r1", "131-r3", "133-r1", "138-r1", "150-r1",
}

RESERVATIONS = {
    "15-r3": "The Cambridge page asserts the prime-divisibility of intermediate binomial coefficients without proving it; this route is not a complete source proof there.",
    "128-r1": "The notes give the finite-box induction but only assert the approximation step needed for the general measurable-set statement.",
    "130-r1": "The UCLA notes prove Radon's lemma but stop after announcing the general-dimensional Helly induction base; the induction step is absent.",
}

SOURCE_LABELS = {
    "richardhammack.github.io": "Hammack, Book of Proof",
    "math.libretexts.org": "Mathematics LibreTexts course text",
    "www.amsi.org.au": "Australian Mathematical Sciences Institute",
    "linearalgebra.math.umanitoba.ca": "University of Manitoba, Trigonometry Review",
    "people.math.wisc.edu": "University of Wisconsin, Mathematics 222 notes",
    "jwilson.coe.uga.edu": "University of Georgia, Heron's Formula Project",
    "webapps.math.uci.edu": "UC Irvine, Real Analysis notes",
    "math.mit.edu": "MIT mathematics course notes",
    "www.maths.tcd.ie": "Trinity College Dublin, Metric Spaces notes",
    "lorecchia.github.io": "Linear Algebra Review, CMSC 35410",
    "www.mit.edu": "MIT, Convex Analysis slides",
    "www.math.ucla.edu": "UCLA, Combinatorial Discrete Geometry notes",
    "web.stanford.edu": "Stanford, Cantor–Bernstein proof",
    "faculty.bard.edu": "Bard, Noether's Theorem lecture notes",
    "people.maths.bris.ac.uk": "University of Bristol, Linear Algebra notes",
    "math.oxford.emory.edu": "Emory, Intermediate Value Theorem proof",
    "publikationen.bibliothek.kit.edu": "KIT, From Sperner's Lemma to Differential Equations",
    "www.math.stonybrook.edu": "Stony Brook, Algebraic Topology notes",
    "www.math.brown.edu": "Brown, Matrix Tree Theorem notes",
}

LOCATOR_CORRECTIONS = {
    "13-r1": "§7.3 Proposition 7.1 (Bézout), PDF pp. 163–164; Proposition 10.1 (Euclid's lemma), PDF p. 197",
    "81-r1": "§1.2 Theorem 1.1 (Sperner's lemma), PDF pp. 24–25; §2.1 Theorem 2.3 (simplex fixed point), PDF pp. 32–33; §2.2 Theorem 2.5 (closed ball/convex set), PDF pp. 36–37",
}

SOURCE_OVERRIDES = {
    "11-r2": (
        "https://math.mit.edu/~djk/18_01/chapter05/proof05.html",
        "MIT 18.01, 'Proof of the Law of Cosines,' vector and dot-product derivation",
        "The Wisconsin note invokes the law of cosines to prove the dot-product angle formula, so it cannot support this direction. The MIT page derives the law of cosines from the vector difference and dot product, taking the geometric dot-product formula as a prior fact.",
    ),
    "81-r1": (
        "https://publikationen.bibliothek.kit.edu/1000042944/3288564",
        LOCATOR_CORRECTIONS["81-r1"],
        "The book proves the n-dimensional Sperner lemma, derives the simplex fixed-point theorem by label refinement and compactness, then extends it to closed balls and compact convex sets. All stages of the catalog route are present.",
    ),
    "108-r1": (
        "https://www.math.stonybrook.edu/~cschnell/pdf/notes/mat530.pdf",
        "Theorem 4 (Sperner's lemma), PDF pp. 146–147, parity proof for an arbitrary triangulation",
        "The Stony Brook notes prove the odd number of fully labeled simplices for any triangulation by induction and graph-degree parity; this supplies the boundary-face parity route.",
    ),
    "108-r2": (
        "https://www.math.stonybrook.edu/~cschnell/pdf/notes/mat530.pdf",
        "Theorem 4, PDF pp. 146–147, adjacency graph with an exterior vertex and odd-degree endpoints",
        "The source explicitly constructs the graph across facets with colors 1,…,n and uses degree parity, exactly matching the catalog graph-path route.",
    ),
    "108-r3": (
        "https://www.math.stonybrook.edu/~cschnell/pdf/notes/mat530.pdf",
        "Theorem 4, PDF pp. 146–147, induction on dimension and boundary-face count",
        "The source proves Sperner's lemma for arbitrary triangulations by induction on dimension, using an odd boundary count and interior face pairing.",
    ),
}


def main() -> None:
    assigned_batches = [json.loads((QUEUE / f"batch-{batch}.json").read_text())["records"] for batch in (1, 2, 3)]
    prior = {row["id"]: row for assigned in assigned_batches for row in assigned}
    if len(prior) != 300:
        raise ValueError(f"Expected 300 remaining routes, found {len(prior)}")

    records = []
    for batch in (1, 2, 3):
        assigned = assigned_batches[batch - 1]
        raw = json.loads((QUEUE / f"results-{batch}.json").read_text())
        reviewed = raw if isinstance(raw, list) else raw["records"]
        if [r["id"] for r in reviewed] != [r["id"] for r in assigned]:
            raise ValueError(f"Batch {batch} does not cover its assigned routes in order")
        for item in reviewed:
            route_id = item["id"]
            conclusion = item["conclusion"]
            if conclusion == "full-proof-verified" and route_id not in ACCEPTED_FULL and route_id not in RESERVATIONS:
                raise ValueError(f"Unadjudicated full-proof claim: {route_id}")
            url = item.get("sourceUrl") or item.get("source URL")
            locator = LOCATOR_CORRECTIONS.get(route_id, item.get("preciseLocator") or item.get("precise locator") or "")
            evidence = item.get("evidence") or item.get("evidence/limitation") or ""
            if route_id in SOURCE_OVERRIDES:
                url, locator, evidence = SOURCE_OVERRIDES[route_id]
            decision = "accepted-full" if route_id in ACCEPTED_FULL else "not-verified"
            records.append({
                "id": route_id,
                "priorDisposition": prior[route_id]["disposition"],
                "reviewConclusion": conclusion,
                "catalogueDecision": decision,
                "sourceLabel": SOURCE_LABELS.get(urlparse(url or "").netloc, "Source reviewed") if url else None,
                "sourceUrl": url,
                "preciseLocator": locator,
                "evidence": evidence,
                "inspectionBasis": item.get("inspectionBasis", "Proof text inspected" if conclusion == "full-proof-verified" else "Reviewer note; see evidence"),
                "confidence": item.get("confidence"),
                "integrationNote": RESERVATIONS.get(route_id) or ("Reviewer source replaced during independent exact-route check." if route_id in SOURCE_OVERRIDES else None),
            })

    if len(records) != 300 or len({r["id"] for r in records}) != 300 or {r["id"] for r in records} != set(prior):
        raise ValueError("Merged review does not cover the 300-route queue exactly")
    if {r["id"] for r in records if r["catalogueDecision"] == "accepted-full"} != ACCEPTED_FULL:
        raise ValueError("Accepted full-proof set does not match the reconciled records")
    output = {
        "method": "Three GPT-5.6 Luna batches covered the 300 previously unverified routes. Most records preserve a specific prior audit limitation; only independently inspected, exact-route proofs accepted after a separate catalogue check are promoted. A source title, abstract, outline, or search result never establishes a complete proof.",
        "reviewedRouteCount": len(records),
        "acceptedFullProofs": len(ACCEPTED_FULL),
        "reviewConclusions": dict(sorted(Counter(r["reviewConclusion"] for r in records).items())),
        "records": records,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Reconciled {len(records)} routes; accepted {len(ACCEPTED_FULL)} new complete proofs")


if __name__ == "__main__":
    main()
