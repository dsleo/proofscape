#!/usr/bin/env python3
"""Record the disposition of the 74 initially uncited priority routes."""

import json
from collections import Counter
from pathlib import Path

from curate_priority_proof_routes import REFERENCES

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data/collection/historical-proof-catalog.json"
OUTPUT = ROOT / "data/collection/proof-route-evidence-review.json"


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    routes = {route["id"]: route for entry in catalog["entries"] for route in entry["routes"]}
    reviewed = sorted(set(REFERENCES) | {route_id for route_id, route in routes.items() if not route.get("references")})
    if len(reviewed) != 74:
        raise ValueError(f"Expected 74 priority routes, found {len(reviewed)}")
    cited = []
    set_aside = []
    for route_id in reviewed:
        route = routes[route_id]
        if route.get("references"):
            ref = route["references"][0]
            if not ref.get("locator"):
                raise ValueError(f"Missing route locator: {route_id}")
            cited.append({"id": route_id, "source": ref["label"], "url": ref["url"], "locator": ref["locator"]})
        else:
            if not route.get("reviewFlag") or not route.get("reviewNote"):
                raise ValueError(f"Unresolved uncited priority route: {route_id}")
            set_aside.append({"id": route_id, "flag": route["reviewFlag"], "resolution": "merged-variant" if route.get("mergedInto") else "retired-or-unresolved", "mergedInto": route.get("mergedInto"), "reason": route["reviewNote"]})
    output = {
        "method": "The original 74 routes without a direct citation were reviewed against route-specific sources and mathematical validity. A set-aside route remains visible in the catalog but is excluded from map route counts; its generic bibliography is not presented as proof evidence.",
        "initialQueueCount": len(reviewed),
        "nowCitedCount": len(cited),
        "setAsideCount": len(set_aside),
        "setAsideByReason": dict(sorted(Counter(item["flag"] for item in set_aside).items())),
        "setAsideByResolution": dict(sorted(Counter(item["resolution"] for item in set_aside).items())),
        "catalogRouteCount": len(routes),
        "catalogCitedCount": sum(bool(route.get("references")) for route in routes.values()),
        "cited": cited,
        "setAside": set_aside,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Priority routes: {len(cited)} cited, {len(set_aside)} set aside with review flags")


if __name__ == "__main__":
    main()
