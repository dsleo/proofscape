#!/usr/bin/env python3
"""Promote backlog routes whose complete proof a second, independent verifier also read, and record every outcome."""

import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "collection"
QUEUE = ROOT / "source-review-queue"
CATALOG = ROOT / "historical-proof-catalog.json"
OUT = ROOT / "proof-backlog-review.json"

# Confirmed by the verifier, but the source uses a different mechanism, proves a
# weaker statement, leaves the key step to a figure or exercise, or is an informal note.
HELD_BACK = {
    "37-r1": "source regroups the series directly instead of using the addition law",
    "149-r1": "source uses the mod-2 transfer sequence, not the cup-power argument of the sketch",
    "97-r1": "source proves infinitely many primes, not the density in the sketch",
    "103-r4": "source checks the recurrence by residues, not by a bijection",
    "33-r3": "tail-sum step is only described as a slight modification",
    "115-r3": "Cauchy derivative bound is a one-line remark",
    "125-r1": "source concludes only almost everywhere",
    "109-r2": "source covers only the two-uniform (graph) case",
    "146-r1": "Reidemeister moves are figures that were not read",
    "21-r1": "only source is an informal self-published note",
    "134-r2": "source proves only finite Hall; also read from a restricted PDF",
    "135-r1": "restricted PDF; proves Kruskal's tree theorem, not the stated graph-minor result",
}


def load(pattern):
    rows = {}
    for path in sorted(glob.glob(str(QUEUE / pattern))):
        for row in json.loads(Path(path).read_text()):
            rows[row["routeId"]] = row
    return rows


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
    backlog, verify = load("backlog-results-*.json"), load("verify-results-*.json")
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    routes = {r["id"]: r for e in catalog["entries"] for r in e["routes"]}
    promoted, records = [], []
    for rid, b in sorted(backlog.items(), key=lambda kv: (int(kv[0].split("-")[0]), kv[0])):
        v = verify.get(rid)
        status = b["outcome"]
        if b["outcome"] == "complete-proof-found":
            if v is None:
                status = "claimed-unverified"
            elif v["verdict"] != "confirmed":
                status = "verifier-" + v["verdict"]
            elif rid in HELD_BACK:
                status = "held-back"
            else:
                status = "promoted"
        rec = {"routeId": rid, "finalStatus": status, "reviewOutcome": b["outcome"], "sourceUrl": b.get("sourceUrl"),
               "preciseLocator": b.get("preciseLocator"), "sketchProblem": b.get("sketchProblem"),
               "verification": {k: v.get(k) for k in ("verdict", "correctedLocator", "missingStep", "note")} if v else None}
        if rid in HELD_BACK:
            rec["heldBackReason"] = HELD_BACK[rid]
        if status == "promoted":
            url = (v.get("sourceUrl") or b["sourceUrl"])
            locator = v.get("correctedLocator") or b["preciseLocator"]
            label = b.get("sourceLabel") or "Source"
            r = routes[rid]
            r["references"] = [{"label": label, "url": url, "sourceId": register_source(catalog, label, url), "sourceLabel": label, "locator": locator}]
            r["extractionNotes"] = "Independently composed proof sketch; cited section supports this proof approach. Not a verbatim quotation. Complete proof read by two independent reviewers (backlog review 2026-10)."
            r["verbatimStatus"] = "source-hosted-only"
            r["verbatimNote"] = "Complete route proof located at the cited section. The catalogue sketch is a paraphrase; source wording is not reproduced here."
            r["fullProofAudit"] = "complete-proof-located"
            r["routeEvidenceStatus"] = "route-checked"
            promoted.append(rid)
            rec["preciseLocator"], rec["sourceUrl"] = locator, url
        records.append(rec)
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = {}
    for r in records:
        counts[r["finalStatus"]] = counts.get(r["finalStatus"], 0) + 1
    OUT.write_text(json.dumps({"method": "Each unverified route was searched by one reviewer; every claimed complete proof was re-read by a second, independent verifier instructed to refute it. Only routes confirmed by both, with the same method as the sketch, were promoted. Reviewers' sketch criticisms are kept here and were not applied to the catalogue.",
                               "routeCount": len(records), "counts": counts, "promoted": promoted, "records": records}, ensure_ascii=False, indent=1) + "\n")
    print(counts)


if __name__ == "__main__":
    main()
