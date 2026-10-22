#!/usr/bin/env python3
"""Copy reviewed route outcomes into the persistent extraction ledger."""

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "collection"
CATALOG = ROOT / "historical-proof-catalog.json"
LEDGER = ROOT / "proof-extraction-ledger.json"


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    routes = {route["id"]: route for entry in catalog["entries"] for route in entry["routes"]}
    records = {record["routeId"]: record for record in ledger["records"]}
    if routes.keys() != records.keys():
        raise ValueError("Catalogue and ledger route IDs differ")
    for route_id, route in routes.items():
        record = records[route_id]
        record["routeTitle"] = route["title"]
        record["status"] = route["sketchStatus"]
        record["proofSketch"] = route["proofSketch"]
        record["references"] = route.get("references", [])
        record["verbatimStatus"] = route.get("verbatimStatus", "not-yet-reviewed")
        record["verbatimNote"] = route.get("verbatimNote", "")
        record["routeEvidenceStatus"] = route.get("routeEvidenceStatus", "no-route-citation")
        record["fullProofAudit"] = route.get("fullProofAudit", "previously-reviewed")
        for key in ("reviewFlag", "reviewNote", "mergedInto"):
            if key in route:
                record[key] = route[key]
            else:
                record.pop(key, None)
    values = list(routes.values())
    ledger["progress"] = {
        "sourceExtracted": sum(r["sketchStatus"] == "source-extracted" for r in values),
        "assistantReconstructed": sum(r["sketchStatus"] == "assistant-reconstruction" for r in values),
        "referenceLocatedOnly": sum(r["sketchStatus"] == "reference-located" for r in values),
        "notYetSketched": sum(r["sketchStatus"] == "not-extracted" for r in values),
        "withRouteCitation": sum(bool(r.get("references")) for r in values),
        "withoutRouteCitation": sum(not r.get("references") for r in values),
    }
    statuses = Counter(r.get("verbatimStatus", "not-yet-reviewed") for r in values)
    ledger["verbatimProgress"] = {key: statuses[key] for key in (
        "source-hosted-only", "not-reproduced-rights", "source-text-unavailable",
        "route-not-found", "not-yet-reviewed", "user-authorized", "source-image")}
    ledger["verbatimProgress"]["fullProofsLocatedAtSource"] = sum(statuses[key] for key in (
        "source-hosted-only", "user-authorized", "source-image"))
    ledger["routeEvidenceProgress"] = dict(sorted(Counter(r.get("routeEvidenceStatus", "no-route-citation") for r in values).items()))
    ledger["lastUpdated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(ledger["progress"], ledger["verbatimProgress"], ledger["routeEvidenceProgress"])


if __name__ == "__main__":
    main()
