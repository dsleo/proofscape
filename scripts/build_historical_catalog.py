#!/usr/bin/env python3
"""Validate and publish the curated course-level multiple-proof catalog."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "collection" / "historical-proof-catalog.json"
STATEMENTS = ROOT / "data" / "collection" / "historical-statements.json"
OUTPUT = ROOT / "public" / "data" / "collection" / "historical-proof-catalog.json"


def reference_type(url: str) -> str:
    value = url.casefold()
    if "mathoverflow.net" in value:
        return "Math forum"
    if "proofwiki.org" in value:
        return "Community proof wiki"
    if "maa.org" in value:
        return "Journal index"
    if "springer.com" in value:
        return "Textbook or monograph publisher"
    if "arxiv.org" in value:
        return "Research paper or survey"
    if any(host in value for host in ("mit.edu", "ocw.mit.edu", "ubc.ca", "osu.edu", "hmc.edu")):
        return "University course material"
    if any(host in value for host in ("euclids-elements.org", "archive.org", "openlibrary.org", "kurims.kyoto-u.ac.jp")):
        return "Primary text or mathematical archive"
    if "huggingface.co" in value:
        return "Dataset"
    return "Exposition or reference archive"


def enrich_reference(link: dict, source_id: str, source_label: str) -> dict:
    kind = reference_type(link["url"])
    return {**link, "sourceId": source_id, "sourceLabel": source_label, "sourceType": kind}


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def primary_reference(route: dict) -> dict | None:
    references = route.get("references", [])
    if len(references) <= 1:
        return references[0] if references else None

    evidence = normalized(" ".join([
        route.get("verbatimNote", ""),
        *(image.get("caption", "") for image in route.get("proofImages", [])),
    ]))
    ranked = []
    for index, reference in enumerate(references):
        score = 0
        for label in (reference.get("label", ""), reference.get("sourceLabel", "")):
            phrase = normalized(label)
            if len(phrase) > 4 and phrase in evidence:
                score += 100 + len(phrase)
        hostname = urlparse(reference.get("url", "")).hostname or ""
        domain_name = hostname.removeprefix("www.").split(".")[0]
        if len(domain_name) > 3 and domain_name in evidence.split():
            score += 50
        locator = normalized(reference.get("locator", ""))
        if len(locator) > 8 and locator in evidence:
            score += 25
        ranked.append((score, index, reference))
    best = max(ranked, key=lambda item: (item[0], item[1]))
    return best[2] if best[0] > 0 else references[-1]


def main() -> None:
    catalog = json.loads(SOURCE.read_text(encoding="utf-8"))
    statements = json.loads(STATEMENTS.read_text(encoding="utf-8"))
    entries = catalog.get("entries", [])
    sources = catalog.get("sources", {})
    if catalog.get("entryCount") != len(entries):
        raise ValueError("entryCount does not match the catalog entries")
    ids = [entry["id"] for entry in entries]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate catalog entry ids")
    expected_statement_ids = {str(entry_id) for entry_id in ids}
    if set(statements) != expected_statement_ids:
        missing = sorted(expected_statement_ids - set(statements), key=int)
        extra = sorted(set(statements) - expected_statement_ids)
        raise ValueError(f"statement catalog ID mismatch; missing={missing}, extra={extra}")
    for entry in entries:
        statement = statements[str(entry["id"])].strip()
        if not statement:
            raise ValueError(f"entry {entry['id']} has an empty theorem statement")
        entry["statement"] = statement
    unknown = {source_id for entry in entries for source_id in entry.get("sourceIds", []) if source_id not in sources}
    if unknown:
        raise ValueError(f"unregistered source ids: {sorted(unknown)}")
    for source_id, source in sources.items():
        source["references"] = [enrich_reference(link, source_id, source["label"]) for link in source.get("links", [])]
    for entry in entries:
        if len(entry.get("routes", [])) < 2:
            raise ValueError(f"entry {entry['id']} needs at least two proposed route families")
        route_ids = [route.get("id") for route in entry["routes"]]
        if None in route_ids or len(route_ids) != len(set(route_ids)):
            raise ValueError(f"entry {entry['id']} has missing or duplicate route ids")
        for route in entry["routes"]:
            if route.get("sketchStatus") not in {"source-extracted", "assistant-reconstruction", "reference-located", "not-extracted"}:
                raise ValueError(f"route {route.get('id')} has an invalid sketchStatus")
            if not route.get("proofSketch", "").strip():
                raise ValueError(f"route {route['id']} cannot be published without a proof sketch")
            if route.get("sketchStatus") == "source-extracted" and (not route.get("proofSketch") or not route.get("references")):
                raise ValueError(f"route {route['id']} claims an extracted sketch without text and a citation")
            if route.get("sketchStatus") == "source-extracted" and not any(reference.get("locator", "").strip() for reference in route.get("references", [])):
                raise ValueError(f"route {route['id']} claims an extracted sketch without a precise locator")
            verbatim_status = route.get("verbatimStatus", "not-yet-reviewed")
            if verbatim_status not in {"source-hosted-only", "not-reproduced-rights", "source-text-unavailable", "route-not-found", "not-yet-reviewed", "user-authorized", "source-image"}:
                raise ValueError(f"route {route['id']} has invalid verbatimStatus")
            verbatim = route.get("verbatimProof")
            if verbatim and verbatim_status != "user-authorized":
                raise ValueError(f"route {route['id']} contains a verbatim passage without a user-authorized verbatimStatus")
            if verbatim_status == "source-hosted-only" and not any(reference.get("locator", "").strip() for reference in route.get("references", [])):
                raise ValueError(f"route {route['id']} marks a proof source-hosted without a precise locator")
            if route.get("verbatimLicense") and not route.get("verbatimLicenseUrl", "").startswith("https://"):
                raise ValueError(f"route {route['id']} records a reuse license without its terms URL")
            if route.get("sketchStatus") == "assistant-reconstruction" and not route.get("proofSketch"):
                raise ValueError(f"route {route['id']} claims a reconstruction without sketch text")
            if route.get("sketchStatus") == "reference-located" and not route.get("references"):
                raise ValueError(f"route {route['id']} claims a located reference without a citation")
            for reference in route.get("references", []):
                source_id = reference.get("sourceId")
                if source_id not in sources:
                    raise ValueError(f"route {route['id']} cites unregistered source {source_id}")
                registered_urls = {link["url"] for link in sources[source_id].get("links", [])}
                if reference.get("url") not in registered_urls:
                    raise ValueError(f"route {route['id']} citation URL is absent from source register {source_id}")
                kind = reference_type(reference["url"])
                reference["sourceType"] = kind
                reference.pop("useNote", None)
            selected_reference = primary_reference(route)
            route["references"] = [selected_reference] if selected_reference else []
        route_count = len(entry["routes"])
        cited_count = sum(bool(route.get("references")) for route in entry["routes"])
        sketch_count = sum(route["sketchStatus"] == "source-extracted" for route in entry["routes"])
        entry["routeCoverage"] = {
            "routeCount": route_count,
            "withSketch": sum(bool(route.get("proofSketch")) for route in entry["routes"]),
            "withSourceExtractedSketch": sketch_count,
            "withAssistantReconstruction": sum(route["sketchStatus"] == "assistant-reconstruction" for route in entry["routes"]),
            "withLocatedReference": cited_count,
            "withoutRouteCitation": route_count - cited_count,
        }
        entry["citationStatus"] = "route-citations-complete" if cited_count == route_count else "route-citations-partial" if cited_count else "route-citations-needed"
        entry["sourceLocatorStatus"] = "route-specific"

    catalog["sourceRecordCount"] = len(sources)
    catalog["approachRecordCount"] = sum(len(entry["routes"]) for entry in entries)
    catalog["approachCoverage"] = {
        "withSketch": sum(bool(route.get("proofSketch")) for entry in entries for route in entry["routes"]),
        "withSourceExtractedSketch": sum(route["sketchStatus"] == "source-extracted" for entry in entries for route in entry["routes"]),
        "withAssistantReconstruction": sum(route["sketchStatus"] == "assistant-reconstruction" for entry in entries for route in entry["routes"]),
        "withLocatedReference": sum(bool(route.get("references")) for entry in entries for route in entry["routes"]),
        "withoutRouteCitation": sum(not route.get("references") for entry in entries for route in entry["routes"]),
    }
    catalog["verbatimCoverage"] = {
        "source-hosted-only": sum(route.get("verbatimStatus") == "source-hosted-only" for entry in entries for route in entry["routes"]),
        "not-reproduced-rights": sum(route.get("verbatimStatus") == "not-reproduced-rights" for entry in entries for route in entry["routes"]),
        "source-text-unavailable": sum(route.get("verbatimStatus") == "source-text-unavailable" for entry in entries for route in entry["routes"]),
        "route-not-found": sum(route.get("verbatimStatus") == "route-not-found" for entry in entries for route in entry["routes"]),
        "not-yet-reviewed": sum(route.get("verbatimStatus", "not-yet-reviewed") == "not-yet-reviewed" for entry in entries for route in entry["routes"]),
        "user-authorized": sum(route.get("verbatimStatus") == "user-authorized" for entry in entries for route in entry["routes"]),
        "source-image": sum(route.get("verbatimStatus") == "source-image" for entry in entries for route in entry["routes"]),
    }
    catalog["verbatimCoverage"]["fullProofsLocatedAtSource"] = catalog["verbatimCoverage"]["source-hosted-only"] + catalog["verbatimCoverage"]["user-authorized"] + catalog["verbatimCoverage"]["source-image"]
    # proof-excerpt images: validate and copy next to the catalog
    image_src = ROOT / "data" / "collection" / "proof-images"
    image_dst = OUTPUT.parent / "proof-images"
    image_dst.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        for route in entry["routes"]:
            for image in route.get("proofImages", []):
                name = Path(image["src"]).name
                if not (image_src / name).is_file():
                    raise ValueError(f"route {route['id']} references missing proof image {name}")
                (image_dst / name).write_bytes((image_src / name).read_bytes())
                image["src"] = f"data/collection/proof-images/{name}"
            for field in ("extractionNotes", "verbatimStatus", "verbatimProof", "verbatimNote", "verbatimLicense", "verbatimLicenseUrl"):
                route.pop(field, None)
        for field in ("routeCoverage", "citationStatus", "sourceLocatorStatus"):
            entry.pop(field, None)
    catalog.pop("verbatimCoverage", None)
    catalog.pop("approachCoverage", None)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(entries):,} historical candidates and {len(sources):,} source records to {OUTPUT}")


if __name__ == "__main__":
    main()
