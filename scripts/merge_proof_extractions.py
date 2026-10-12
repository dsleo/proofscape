#!/usr/bin/env python3
"""Merge route-level extraction batches into the Proofscape catalog and ledger."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "collection" / "historical-proof-catalog.json"
LEDGER = ROOT / "data" / "collection" / "proof-extraction-ledger.json"
BATCH_DIR = ROOT / "data" / "collection" / "extractions"


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    route_map = {route["id"]: (entry, route) for entry in catalog["entries"] for route in entry["routes"]}
    ledger_map = {record["routeId"]: record for record in ledger["records"]}
    url_to_source = {
        link["url"]: (source_id, link)
        for source_id, source in catalog["sources"].items()
        for link in source.get("links", [])
    }
    next_source_number = 1 + max((int(sid[1:]) for sid in catalog["sources"] if sid.startswith("X") and sid[1:].isdigit()), default=0)
    batches = sorted(path for path in BATCH_DIR.glob("batch-*.json") if re.fullmatch(r"batch-\d{3}-\d{3}", path.stem))

    for batch_path in batches:
        batch = json.loads(batch_path.read_text(encoding="utf-8"))
        batch_name = batch.get("batch", batch_path.stem.removeprefix("batch-"))
        batch_records = batch.get("records", [])
        batch_seen: set[str] = set()
        for record in batch_records:
            route_id = record.get("routeId")
            if route_id not in route_map:
                raise ValueError(f"{batch_path.name} contains unknown route id: {route_id}")
            if route_id in batch_seen:
                raise ValueError(f"{batch_path.name} repeats route id: {route_id}")
            batch_seen.add(route_id)
            status = record.get("provenance")
            if status not in {"source-extracted", "assistant-reconstruction", "reference-located"}:
                raise ValueError(f"{batch_path.name} {route_id} has invalid provenance: {status}")
            sketch = record.get("proofSketch", "").strip()
            if status in {"source-extracted", "assistant-reconstruction"} and not sketch:
                raise ValueError(f"{batch_path.name} {route_id} has no proof sketch")
            if status == "reference-located" and record.get("references"):
                pass
            if not record.get("references") and status != "assistant-reconstruction":
                raise ValueError(f"{batch_path.name} {route_id} needs a source citation")
            if status == "source-extracted" and not any(ref.get("locator", "").strip() for ref in record.get("references", [])):
                raise ValueError(f"{batch_path.name} {route_id} needs a precise source locator for its extracted sketch")

            entry, route = route_map[route_id]
            quality = {"not-extracted": 0, "reference-located": 1, "assistant-reconstruction": 2, "source-extracted": 3}
            if quality[status] >= quality.get(route.get("sketchStatus", "not-extracted"), 0) or record.get("provenanceCorrectionReason"):
                route["proofSketch"] = sketch
                route["sketchStatus"] = status
                route["extractionNotes"] = record.get("notes", "")
            merged_refs = list(route.get("references", []))
            for ref in record.get("references", []):
                url = ref.get("url", "").strip()
                label = ref.get("label", "").strip()
                if not url or not label:
                    raise ValueError(f"{batch_path.name} {route_id} has a citation without label or URL")
                if url not in url_to_source:
                    source_id = f"X{next_source_number:04d}"
                    next_source_number += 1
                    source = {"id": source_id, "label": label, "description": f"Route-level source added during proof extraction ({batch_name}).", "links": [{"label": label, "url": url}]}
                    catalog["sources"][source_id] = source
                    url_to_source[url] = (source_id, source["links"][0])
                source_id, link = url_to_source[url]
                normalized = {"label": label, "url": url, "sourceId": source_id, "sourceLabel": catalog["sources"][source_id]["label"], "locator": ref.get("locator", "")}
                if not any(existing.get("url") == url for existing in merged_refs):
                    merged_refs.append(normalized)
                ledger_record = ledger_map[route_id]
                attempt = {"checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sourceId": source_id, "label": label, "url": url, "locator": ref.get("locator", ""), "outcome": "sketch-extracted" if status == "source-extracted" else "source-recorded"}
                duplicate_attempt = any(old.get("url") == url and old.get("locator", "") == attempt["locator"] and old.get("outcome") == attempt["outcome"] for old in ledger_record["attemptLog"])
                if not duplicate_attempt:
                    ledger_record["attemptLog"].append(attempt)
            route["references"] = merged_refs
            verbatim_status = record.get("verbatimStatus", route.get("verbatimStatus", "not-yet-reviewed"))
            allowed_verbatim_statuses = {"source-hosted-only", "not-reproduced-rights", "source-text-unavailable", "route-not-found", "not-yet-reviewed", "user-authorized", "source-image"}
            if verbatim_status not in allowed_verbatim_statuses:
                raise ValueError(f"{batch_path.name} {route_id} has invalid verbatimStatus: {verbatim_status}")
            if verbatim_status == "source-hosted-only" and not any(ref.get("locator", "").strip() for ref in merged_refs):
                raise ValueError(f"{batch_path.name} {route_id} needs a precise locator for its source-hosted proof")
            route["verbatimStatus"] = verbatim_status
            route["verbatimNote"] = record.get("verbatimNote", "")
            if record.get("proofImages"):
                route["proofImages"] = record["proofImages"]
            else:
                route.pop("proofImages", None)
            if record.get("verbatimLicense"):
                route["verbatimLicense"] = record["verbatimLicense"]
            if record.get("verbatimLicenseUrl"):
                route["verbatimLicenseUrl"] = record["verbatimLicenseUrl"]
            if verbatim_status == "user-authorized" and record.get("verbatimProof", "").strip():
                route["verbatimProof"] = record["verbatimProof"]
            else:
                route.pop("verbatimProof", None)
            ledger_record = ledger_map[route_id]
            ledger_record.update({"status": route.get("sketchStatus", status), "proofSketch": route.get("proofSketch", sketch), "references": [{"sourceId": ref.get("sourceId"), "label": ref.get("label"), "url": ref.get("url"), "locator": ref.get("locator")} for ref in merged_refs], "batch": batch_name, "notes": route.get("extractionNotes", record.get("notes", "")), "verbatimStatus": verbatim_status, "verbatimNote": route["verbatimNote"]})
            if record.get("verbatimLicense"):
                ledger_record["verbatimLicense"] = record["verbatimLicense"]
                ledger_record["verbatimLicenseUrl"] = record.get("verbatimLicenseUrl", "")
            ledger_record.pop("verbatimProof", None)
            notes = ledger_record["notes"].lower()
            if status == "source-extracted" or "direct route evidence" in notes or "route-supporting source located" in notes:
                ledger_record["citationAudit"] = "route-supporting-source"
            elif "exact-route source unresolved" in notes or "exact-route citation work unresolved" in notes or "contextual only" in notes:
                ledger_record["citationAudit"] = "contextual-or-unresolved"
            elif "theorem/context-only" in notes or "theorem-level" in notes or "context-only" in notes:
                ledger_record["citationAudit"] = "contextual-or-unresolved"
            elif merged_refs:
                ledger_record["citationAudit"] = "citation-present-audit-unspecified"
            else:
                ledger_record["citationAudit"] = "no-route-citation"

        bounds = re.search(r"(\d{3})-(\d{3})", batch_path.name)
        if bounds:
            first, last = map(int, bounds.groups())
            expected = {route_id for route_id, (entry, _) in route_map.items() if first <= entry["id"] <= last}
            missing = expected - batch_seen
            extra = batch_seen - expected
            if missing or extra:
                raise ValueError(f"{batch_path.name} coverage mismatch: {len(missing)} missing, {len(extra)} out-of-range route records")

        ledger["batches"][batch_name] = {"file": batch_path.name, "processedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "records": len(batch_seen), "expectedRouteIds": sorted(batch_seen)}

    # Import route-level review flags kept separate from proof text so issues
    # can be fixed without losing the original extraction/audit trail.
    audit_path = BATCH_DIR / "batch-001-050-audit.json"
    if audit_path.exists():
        audit = json.loads(audit_path.read_text(encoding="utf-8"))
        for route_id, flag in audit.get("reviewFlags", {}).items():
            if route_id in ledger_map:
                ledger_map[route_id]["reviewFlags"] = [flag]
        ledger["auditManifests"] = {"001-050": {"file": audit_path.name, "routeCount": audit.get("counts", {}).get("routeCount"), "flaggedForReview": audit.get("counts", {}).get("flaggedForReview"), "directRouteEvidence": sorted(audit.get("directRouteEvidence", {}))}}

    route_count = 0
    counts = {"source-extracted": 0, "assistant-reconstruction": 0, "reference-located": 0, "not-extracted": 0}
    cited = 0
    for entry in catalog["entries"]:
        for route in entry["routes"]:
            route_count += 1
            status = route.get("sketchStatus", "not-extracted")
            counts[status] += 1
            cited += bool(route.get("references"))
        entry["routeCoverage"] = {
            "routeCount": len(entry["routes"]),
            "withSketch": sum(bool(route.get("proofSketch")) for route in entry["routes"]),
            "withSourceExtractedSketch": sum(route.get("sketchStatus") == "source-extracted" for route in entry["routes"]),
            "withAssistantReconstruction": sum(route.get("sketchStatus") == "assistant-reconstruction" for route in entry["routes"]),
            "withLocatedReference": sum(bool(route.get("references")) for route in entry["routes"]),
            "withoutRouteCitation": sum(not route.get("references") for route in entry["routes"]),
        }
        entry["citationStatus"] = "route-citations-complete" if entry["routeCoverage"]["withoutRouteCitation"] == 0 else "route-citations-partial" if entry["routeCoverage"]["withLocatedReference"] else "route-citations-needed"

    ledger["lastUpdated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ledger["totalApproaches"] = route_count
    ledger["progress"] = {"sourceExtracted": counts["source-extracted"], "assistantReconstructed": counts["assistant-reconstruction"], "referenceLocatedOnly": counts["reference-located"], "notYetSketched": counts["not-extracted"], "withRouteCitation": cited, "withoutRouteCitation": route_count - cited}
    verbatim_counts = {"source-hosted-only": 0, "not-reproduced-rights": 0, "source-text-unavailable": 0, "route-not-found": 0, "not-yet-reviewed": 0, "user-authorized": 0, "source-image": 0}
    for route in (route for entry in catalog["entries"] for route in entry["routes"]):
        route.setdefault("verbatimStatus", "not-yet-reviewed")
        verbatim_counts[route["verbatimStatus"]] = verbatim_counts.get(route["verbatimStatus"], 0) + 1
    ledger["verbatimProgress"] = {**verbatim_counts, "fullProofsLocatedAtSource": verbatim_counts["source-hosted-only"] + verbatim_counts["user-authorized"] + verbatim_counts["source-image"]}
    catalog["sourceRecordCount"] = len(catalog["sources"])
    catalog["approachRecordCount"] = route_count
    catalog["approachCoverage"] = {"withSketch": counts["source-extracted"] + counts["assistant-reconstruction"], "withSourceExtractedSketch": counts["source-extracted"], "withAssistantReconstruction": counts["assistant-reconstruction"], "withLocatedReference": cited, "withoutRouteCitation": route_count - cited}
    catalog["verbatimCoverage"] = {**verbatim_counts, "fullProofsLocatedAtSource": verbatim_counts["source-hosted-only"] + verbatim_counts["user-authorized"]}
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Processed {len(batches)} extraction batches across {route_count} routes: {ledger['progress']}")


if __name__ == "__main__":
    main()
