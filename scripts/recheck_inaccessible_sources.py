#!/usr/bin/env python3
"""Record the re-check of the 37 source-inaccessible routes and promote the ones with a verified exact-route proof."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "collection"
CATALOG = ROOT / "historical-proof-catalog.json"
REVIEW = ROOT / "remaining-proof-source-review.json"
OUT = ROOT / "inaccessible-source-recheck.json"

PROMOTED = {
    "113-r2": (
        "https://tqft.net/web/teaching/2016/Analysis3/LectureNotes/12.Stone-Weierstrass.pdf",
        "tqft.net Analysis 3 lecture notes",
        "§12, Theorem 12.2 with Lemmas 12.6–12.8 (|f| from a polynomial approximating (ε²+t)^½, lattice closure, two-stage compactness patching)",
        "Complete proof of Stone–Weierstrass read in full; every stage of the route (closure under |f|, max/min, finite-cover patching) is present.",
    ),
    "113-r3": (
        "https://sites.brown.edu/drpeyam/files/2023/01/Lecture-5.pdf",
        "Brown, Lecture 5: Weierstrass approximation",
        "§1, Steps 1–3: Landau polynomial kernel Q_n(x)=c_n(1−x²)^n, estimate c_n<√n, near/far split of the convolution",
        "Complete positive-kernel proof read in full: reduction to f(0)=f(1)=0, kernel mass bound, uniform continuity for the near part, kernel tail →0.",
    ),
}

OUTCOMES = {
    "96-r2": ("mismatch", "Free copies (Zagier, Monthly 1997) prove PNT with Newman's analytic Tauberian theorem, not the Wiener–Ikehara theorem named in the route; the original TIFR link is dead (404)."),
    "114-r2": ("partial", "CMI Lecture 18 gives the normalise/maximise-derivative argument but takes the competitor-construction lemma from Lecture 17 and Montel/Hurwitz as black boxes."),
    "115-r2": ("partial", "Andrist notes (Ljubljana) state Montel's theorem, Arzelà–Ascoli and local equicontinuity without proofs."),
    "115-r3": ("partial", "Same: statements only in the free notes found."),
    "127-r2": ("data-issue", "The catalogue sketch for this route describes Fourier inversion/Plancherel, not a Fourier-series isoperimetric proof; the sketch needs rewriting before any source can be matched."),
}
DEFAULT = ("still-inaccessible", "Cited source is a paywalled book/journal DOI or a dead link and no free exact-route text was found.")


def register_source(catalog, label, url):
    """Return the id of the source register entry for url, adding one if absent."""
    sources = catalog["sources"]
    for sid, source in sources.items():
        if any(link["url"] == url for link in source.get("links", [])):
            return sid
    sid = "X%04d" % (max(int(k[1:]) for k in sources if k.startswith("X")) + 1)
    sources[sid] = {"id": sid, "label": label, "description": "Route-specific source located in the 2026-10 proof review.", "links": [{"label": label, "url": url}]}
    catalog["sourceRecordCount"] = len(sources)
    return sid


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    routes = {r["id"]: r for e in catalog["entries"] for r in e["routes"]}
    ids = [x["id"] for x in review["records"] if x["reviewConclusion"] == "source-inaccessible"]
    results = []
    for rid in ids:
        if rid in PROMOTED:
            url, label, locator, note = PROMOTED[rid]
            r = routes[rid]
            r["references"] = [{"label": label, "url": url, "sourceId": register_source(catalog, label, url), "sourceLabel": label, "locator": locator}]
            r["extractionNotes"] = "Independently composed proof sketch; cited section supports this proof approach. Not a verbatim quotation. Re-checked after the original source proved inaccessible."
            r["verbatimStatus"] = "source-hosted-only"
            r["verbatimNote"] = "Complete route proof located at the cited section. The catalogue sketch is a paraphrase; source wording is not reproduced here."
            r["fullProofAudit"] = "complete-proof-located"
            r["routeEvidenceStatus"] = "route-checked"
            results.append({"id": rid, "outcome": "promoted", "sourceUrl": url, "locator": locator, "reason": note})
        else:
            outcome, reason = OUTCOMES.get(rid, DEFAULT)
            results.append({"id": rid, "outcome": outcome, "reason": reason})
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT.write_text(json.dumps({"recheckedRouteCount": len(results), "records": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(len(results), "rechecked;", sum(r["outcome"] == "promoted" for r in results), "promoted")


if __name__ == "__main__":
    main()
