#!/usr/bin/env python3
"""Apply extraction results (data/collection/extractions/verbatim/results/*.json) to the batch files.

Each results file maps routeId -> result (schema in verbatim/README.md). Excerpt images referenced by a
result must exist in data/collection/proof-images/. Then run:
  npm run merge:proof-extractions && npm run build:historical-catalog
"""
import json, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "data" / "collection" / "extractions"
RES = EXT / "verbatim" / "results"
IMG = ROOT / "data" / "collection" / "proof-images"
FILES = {"001-050": (1, 50), "051-100": (51, 100), "101-150": (101, 150)}

def batch_of(route_id):
    e = int(route_id.split("-")[0])
    return next(k for k, (a, b) in FILES.items() if a <= e <= b)

def main():
    data = {k: json.loads((EXT / f"batch-{k}.json").read_text(encoding="utf-8")) for k in FILES}
    results = {}
    for p in sorted(RES.glob("*.json")):
        results.update(json.loads(p.read_text(encoding="utf-8")))
    out = collections.Counter(); notes = []
    for rid, r in results.items():
        try:
            rec = next(x for x in data[batch_of(rid)]["records"] if x["routeId"] == rid)
        except StopIteration:
            notes.append(f"{rid}: unknown route"); continue
        images = [im for im in (r.get("images") or []) if (IMG / Path(str(im.get("file", ""))).name).is_file()]
        missing = [im.get("file") for im in (r.get("images") or []) if im not in images]
        if missing: notes.append(f"{rid}: missing image files {missing}")
        sketch = (r.get("proofSketch") or "").strip()
        match = r.get("routeMatch")
        had_text = rec.get("verbatimStatus") == "user-authorized" and rec.get("verbatimProof")
        url = (r.get("sourceUrl") or "").strip()
        if url:
            have = [x for x in rec["references"] if x["url"] == url]
            if not have:
                rec["references"].append({"label": r.get("sourceTitle") or url, "url": url, "locator": r.get("locator") or "", "sourceType": "source consulted in extraction pass"})
            elif r.get("locator") and len(have[0].get("locator", "")) < len(r["locator"]):
                have[0]["locator"] = r["locator"]
        tag = f" Excerpt pass: routeMatch={match}; reuseStatus={r.get('reuseStatus')}."
        if tag not in rec.get("notes", ""):
            rec["notes"] = rec.get("notes", "") + tag
        if images and sketch and match in ("verified", "uncertain"):
            # The source-page crop is the primary evidence shown in the app;
            # remove any prior transcription so the same passage is not stored twice.
            rec.pop("verbatimProof", None)
            rec.pop("verbatimLicense", None); rec.pop("verbatimLicenseUrl", None)
            rec["proofSketch"] = sketch
            rec["provenance"] = "source-extracted"
            rec["provenanceCorrectionReason"] = "Sketch rewritten from the cited proof during the excerpt pass."
            rec["proofImages"] = [{"src": f"data/collection/proof-images/{Path(im['file']).name}", "caption": im.get("caption", "")} for im in images]
            rec["verbatimStatus"] = "source-image"
            note = f"Excerpt images are crops of the cited source. Source: {r.get('sourceTitle')} — {r.get('locator')}. Attribution: {r.get('attribution')} Route match: {match}. {r.get('transcriptionNotes') or ''}".strip()
            if r.get("reuseStatus") == "license-permits-redistribution" and r.get("license") and str(r.get("licenseUrl", "")).startswith("https://"):
                rec["verbatimLicense"] = r["license"]; rec["verbatimLicenseUrl"] = r["licenseUrl"]
            rec["verbatimNote"] = note
        elif match == "mismatch":
            rec.pop("verbatimProof", None)
            rec["verbatimStatus"] = "route-not-found"
            rec["verbatimNote"] = (r.get("reasonNotReproduced") or "The cited source does not contain this route.") + f" Source checked: {r.get('sourceTitle')}, {r.get('locator')}."
        elif r.get("reuseStatus") == "unavailable":
            rec["verbatimStatus"] = "source-text-unavailable"
            rec["verbatimNote"] = (r.get("reasonNotReproduced") or "The source passage could not be retrieved.") + f" Source: {r.get('sourceTitle')}, {r.get('locator')}."
        elif had_text:
            pass  # keep the earlier user-authorized passage if no source-page image exists
        else:
            rec.setdefault("verbatimStatus", "not-yet-reviewed")
            if r.get("reasonNotReproduced"): rec["verbatimNote"] = r["reasonNotReproduced"]
        out[rec["verbatimStatus"]] += 1
    for k in FILES:
        (EXT / f"batch-{k}.json").write_text(json.dumps(data[k], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(dict(out)); print("\n".join(notes))

if __name__ == "__main__":
    main()
