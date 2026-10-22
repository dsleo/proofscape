#!/usr/bin/env python3
"""Triage every route whose complete source proof has not been reviewed.

This is an access and citation-quality audit, not an automatic proof check.
The output deliberately never upgrades a route to a verified full proof.
"""

from __future__ import annotations

import json
import hashlib
import re
import subprocess
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from curate_priority_proof_routes import CHECKED_REPLACEMENTS, REFERENCES, VERIFIED_FULL_PROOFS

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data/collection/historical-proof-catalog.json"
OUTPUT = ROOT / "data/collection/full-proof-source-review.json"
CACHE = ROOT / "data/collection/full-proof-url-access.json"
TEXT_DIR = Path(tempfile.gettempdir()) / "proofscape-full-proof-source-text"
NEWLY_VERIFIED = VERIFIED_FULL_PROOFS
MAX_BYTES = 18_000_000
MANUAL_SOURCE_LIMITS = {
    "3-r4": ("context-only-citation", "The cited survey describes analytic proof families without locating this complete route."),
    "4-r1": ("context-only-citation", "The cited survey discusses special-progression arguments rather than locating this exact proof."),
    "4-r2": ("context-only-citation", "The cited survey discusses algebraic proof families rather than locating this exact proof."),
    "7-r1": ("statement-only", "The textbook page presents and applies binomial expansion without an induction proof."),
    "7-r2": ("statement-only", "The textbook page presents binomial coefficients without the proposed subset-counting proof."),
    "7-r3": ("statement-only", "The textbook page presents the expansion without this monomial-grouping proof."),
    "19-r1": ("source-page-not-proof", "The linked page exposes metadata and navigation, not the constructive proof."),
    "19-r2": ("source-page-not-proof", "The linked page exposes metadata and navigation, not the ring-isomorphism proof."),
    "23-r1": ("route-mismatch", "The article uses Pick's theorem to prove Euler's formula; it does not prove Pick's theorem by triangulation."),
    "23-r2": ("route-mismatch", "The article assumes Pick's theorem in a proof of Euler's formula; it does not prove the catalogued route."),
    "23-r3": ("route-mismatch", "The article assumes Pick's theorem in a proof of Euler's formula; it does not give a unimodular-triangle proof."),
    "32-r3": ("route-mismatch", "The cited section proves the ordinary mean-value theorem, not this Cauchy mean-value argument."),
    "41-r1": ("route-mismatch", "The source proves rank-nullity by pivot and free-variable counting, not by extending a kernel basis."),
    "41-r3": ("route-mismatch", "The source uses pivot and free-variable counting, not split exact sequences."),
    "42-r1": ("route-mismatch", "The cited rank-nullity argument does not give this adapted-basis dimension proof."),
    "42-r2": ("route-mismatch", "The cited rank-nullity argument does not construct the addition-map proof."),
    "42-r3": ("route-mismatch", "The cited rank-nullity argument does not give the proposed Grassmannian route."),
    "43-r2": ("index-or-abstract-only", "The MIT link is a resource landing page; its separate PDF was not checked here."),
    "43-r3": ("index-or-abstract-only", "The MIT link is a resource landing page; its separate PDF was not checked here."),
    "45-r2": ("route-mismatch", "The Sylow lecture uses actions on subsets and cosets, not a class-equation induction proof."),
    "45-r3": ("route-mismatch", "The Sylow lecture does not prove a separate polynomial or permutation-representation construction."),
    "51-r1": ("route-mismatch", "The text invokes the polynomial Euclidean algorithm in another proof; it does not prove this route."),
    "51-r2": ("context-only-citation", "The UIC page discusses elimination and resultants, not the principal-ideal-generator argument."),
    "54-r3": ("statement-only", "The notes give binomial inversion examples without proving the alternating coefficient cancellation."),
    "55-r3": ("index-or-abstract-only", "The MIT resource page points to a separate document, rather than displaying its proof."),
    "58-r2": ("statement-only", "The source states the Euler characteristic as an alternating sum of Betti numbers without this route's derivation."),
    "58-r1": ("partial-proof", "The lecture gives combinatorial Gauss–Bonnet but not the proposed standalone triangulation-invariance proof."),
    "60-r1": ("scope-mismatch", "The linked discussion establishes the Bernoulli-average case; it does not prove the stated finite-variance iid theorem."),
    "61-r1": ("index-or-abstract-only", "The linked MIT page is a course index rather than a CLT proof."),
    "62-r1": ("statement-only", "The lecture states Borel–Cantelli without a complete proof."),
    "63-r2": ("scope-mismatch", "The slides prove finite Jensen by induction and mention Riemann-sum limits, but do not prove the stated expectation-level extension."),
    "63-r3": ("route-mismatch", "The MIT source gives the supporting-line argument, not the finite-approximation route in the sketch."),
    "65-r3": ("scope-mismatch", "The source proves Baire for complete metric spaces, not the proposed locally compact Hausdorff version."),
    "66-r1": ("index-or-abstract-only", "The linked course page does not contain the claimed proof."),
    "66-r2": ("index-or-abstract-only", "The linked course page does not contain the claimed proof."),
    "66-r3": ("index-or-abstract-only", "The linked course page does not contain the claimed proof."),
    "68-r2": ("route-mismatch", "The cited Bernstein-polynomial argument concerns the Weierstrass theorem, not this Stone–Weierstrass route."),
    "76-r1": ("index-or-abstract-only", "The MIT course description does not contain the Stokes proof."),
    "76-r2": ("index-or-abstract-only", "The MIT course description does not contain the Stokes proof."),
    "76-r3": ("statement-only", "The cited theorem is stated as a de Rham pairing, without its proof."),
    "77-r1": ("partial-proof", "The source calculates Stokes on a cube but only asserts the general partition-of-unity reduction."),
    "77-r2": ("partial-proof", "The source calculates Stokes on a cube but leaves the general manifold reduction to a sentence."),
    "81-r1": ("partial-proof", "The n-dimensional Brouwer deduction is written out, but its Sperner lemma is stated without proof."),
    "83-r1": ("route-mismatch", "The lecture uses winding numbers and local crossing, not the sketched polygonal-approximation limit."),
    "83-r3": ("index-or-abstract-only", "The linked course schedule does not contain the Jordan-curve proof."),
    "85-r3": ("scope-mismatch", "The slides prove the field-coefficient polynomial case; the sketch claims the full Noetherian coefficient-ring case."),
    "86-r1": ("scope-mismatch", "The proof assumes an infinite base field; the catalogued theorem has no such restriction."),
    "86-r3": ("scope-mismatch", "The graded Noether-normalization source assumes an infinite base field; the catalogue statement is unrestricted."),
    "88-r3": ("statement-only", "The notes invoke finite-field multiplicative-group cyclicity without proving it."),
    "97-r1": ("partial-proof", "The lecture begins the Dirichlet argument but stops before proving the theorem."),
    "97-r2": ("statement-only", "The notes state Chebotarev density and its relation to Dirichlet's theorem, without proving this route."),
    "98-r3": ("partial-proof", "The located section proves generalized-eigenspace decomposition but does not construct the full Jordan-chain basis in this route."),
    "98-r1": ("index-or-abstract-only", "The UCSD page lists lecture topics; it contains no Jordan-form proof text."),
    "98-r2": ("index-or-abstract-only", "The UCSD page lists lecture topics; it contains no PID-module proof text."),
    "104-r3": ("route-mismatch", "The cited notes use Henkin's construction, not the proposed product-space proof."),
    "105-r1": ("route-mismatch", "The cited homogeneous-coordinate proof is not the proposed synthetic route."),
    "105-r3": ("route-mismatch", "The cited homogeneous-coordinate proof is not the proposed route."),
    "106-r1": ("partial-proof", "The source proves the Eisenstein substitution for prime powers but not the claimed general-n induction."),
    "108-r1": ("index-or-abstract-only", "The MIT link is a course landing page."),
    "108-r2": ("index-or-abstract-only", "The MIT link is a course landing page."),
    "108-r3": ("index-or-abstract-only", "The MIT link is a course landing page."),
    "109-r1": ("scope-mismatch", "The lecture proves the two-color graph case; the catalogue sketch uses arbitrary uniformity and color count."),
    "109-r3": ("route-mismatch", "The source proves finite Ramsey by recurrence, not the proposed compactness route."),
    "109-r2": ("route-mismatch", "The source proves finite Ramsey by recurrence, not the proposed greedy route."),
    "110-r2": ("route-mismatch", "The note proves Erdős–Szekeres by longest-increasing-subsequence ranks, not the proposed poset chain–antichain route."),
    "110-r3": ("route-mismatch", "The note proves Erdős–Szekeres by ranks, not the proposed permutation-diagram proof."),
    "111-r2": ("route-mismatch", "The source gives Euler's product argument, not the proposed Erdős proof."),
    "111-r3": ("route-mismatch", "The source gives Euler's product argument, not the proposed grouping proof."),
    "112-r1": ("statement-only", "The DLMF page records beta-function identities without this route's proof."),
    "112-r2": ("statement-only", "The DLMF page records beta-function identities without this route's proof."),
    "112-r3": ("statement-only", "The DLMF page records beta-function identities without this route's proof."),
    "114-r2": ("index-or-abstract-only", "The UCSD course page lists a separate Riemann-mapping lecture PDF; the page contains no proof."),
    "114-r3": ("index-or-abstract-only", "The UCSD course page lists the extremal-function approach, not a Green-function proof."),
    "115-r2": ("index-or-abstract-only", "The UCSD course page lists separate normal-family lectures without their proof text."),
    "115-r3": ("index-or-abstract-only", "The UCSD course page lists separate normal-family lectures without their proof text."),
    "116-r1": ("route-mismatch", "The article proves Little Picard via Ahlfors' geometric lemma, not this original value-distribution route."),
    "116-r2": ("scope-mismatch", "The article mentions Nevanlinna theory but does not prove Picard through its second main theorem."),
    "117-r3": ("route-mismatch", "The notes prove moment consistency, not injectivity by compact-support polynomial density."),
    "119-r1": ("partial-proof", "The local Picard–Lindelöf proof ends with an exercise to complete the argument."),
    "119-r2": ("route-mismatch", "The cited chapter gives a contraction argument, not Peano polygonal approximations."),
    "119-r3": ("route-mismatch", "The cited chapter gives a contraction argument, not the proposed Gronwall route."),
    "90-r1": ("partial-proof", "The source states the representation and leaves key ultrafilter steps as exercises."),
    "139-r1": ("partial-proof", "The cited chapter gives propositional compactness and opens the Henkin method; it does not finish the first-order completeness proof."),
    "139-r2": ("route-mismatch", "The cited chapter discusses Henkin's method, not the proposed tableaux route."),
    "139-r3": ("route-mismatch", "The cited chapter discusses Henkin's method, not the proposed cut-elimination route."),
    "141-r3": ("route-mismatch", "The cited text proves ideal factorization, not the proposed geometry-of-numbers route."),
}
CONTEXT_PATTERN = re.compile(
    r"bibliographic/context|context only|contextual reference|open textbook course context|for .* context only|"
    r"not evidence for|no claim that this exact|not verified for this exact|"
    r"full chapter proof text not checked|course notes landing page|"
    r"book locator, not open proof text|edition locator|"
    r"verify the (?:specific|distinct) route|exact route not verified",
    re.IGNORECASE,
)


def inspect_url(url: str) -> dict:
    try:
        audit_url = url.replace("https://arxiv.org/abs/", "https://arxiv.org/pdf/") if "arxiv.org/abs/" in url else url
        response = requests.get(audit_url, timeout=18, headers={"User-Agent": "Proofscape source audit/1.0"}, stream=True)
        response.raise_for_status()
        data = bytearray()
        for chunk in response.iter_content(65536):
            data.extend(chunk)
            if len(data) > MAX_BYTES:
                return {"access": "oversize", "httpStatus": response.status_code, "finalUrl": response.url, "auditUrl": audit_url}
        content_type = response.headers.get("Content-Type", "").lower()
        is_pdf = "pdf" in content_type or data[:4] == b"%PDF"
        if is_pdf:
            with tempfile.NamedTemporaryFile(suffix=".pdf") as temporary:
                temporary.write(data)
                temporary.flush()
                result = subprocess.run(["pdftotext", "-layout", temporary.name, "-"], capture_output=True, timeout=25)
            text = result.stdout.decode("utf-8", errors="replace") if result.returncode == 0 else ""
        else:
            soup = BeautifulSoup(bytes(data), "html.parser")
            for element in soup(["script", "style", "nav", "footer"]):
                element.decompose()
            text = soup.get_text(" ", strip=True)
        words = len(text.split())
        if words >= 100:
            TEXT_DIR.mkdir(parents=True, exist_ok=True)
            (TEXT_DIR / f"{hashlib.sha256(url.encode()).hexdigest()}.txt").write_text(text, encoding="utf-8")
        return {
            "access": "text-available" if words >= 100 else "little-or-no-text",
            "httpStatus": response.status_code,
            "finalUrl": response.url,
            "auditUrl": audit_url,
            "format": "pdf" if is_pdf else "html",
            "wordCount": words,
            "proofMentions": len(re.findall(r"\bproof\b", text, re.IGNORECASE)),
        }
    except (requests.RequestException, subprocess.TimeoutExpired, OSError) as error:
        return {"access": "fetch-failed", "error": str(error)[:220]}


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    pending = [route for entry in catalog["entries"] for route in entry["routes"] if route.get("verbatimStatus", "not-yet-reviewed") == "not-yet-reviewed" or route["id"] in NEWLY_VERIFIED]
    if len(pending) != 371:
        raise ValueError(f"Expected 371 initially unreviewed routes; found {len(pending)}")
    urls = sorted({route["references"][0]["url"] for route in pending if route.get("references")})
    checks: dict[str, dict] = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(inspect_url, url): url for url in urls if url not in checks or ("arxiv.org/abs/" in url and checks[url].get("auditUrl") != url.replace("https://arxiv.org/abs/", "https://arxiv.org/pdf/")) or (checks[url]["access"] == "text-available" and not (TEXT_DIR / f"{hashlib.sha256(url.encode()).hexdigest()}.txt").exists())}
        for future in as_completed(futures):
            checks[futures[future]] = future.result()
    CACHE.write_text(json.dumps(dict(sorted(checks.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    records = []
    for route in pending:
        ref = next(iter(route.get("references", [])), None)
        if route["id"] in NEWLY_VERIFIED:
            disposition = "complete-proof-located"
            reason = "The cited section was read and matches the complete route, including its additional hypotheses or shared lemma."
        elif route.get("reviewFlag") and not ref:
            disposition = "route-set-aside"
            reason = route.get("reviewNote", "")
        elif route["id"] in MANUAL_SOURCE_LIMITS:
            disposition, reason = MANUAL_SOURCE_LIMITS[route["id"]]
        elif ref and CONTEXT_PATTERN.search(ref.get("locator", "")):
            disposition = "context-only-citation"
            reason = "The catalog locator itself disclaims evidence for this exact proof route."
        elif not ref:
            disposition = "no-route-citation"
            reason = "No direct route source is recorded."
        elif checks[ref["url"]]["access"] != "text-available":
            disposition = "source-text-not-available-in-audit"
            reason = "This pass could not retrieve readable source text; it does not establish that the proof is unavailable elsewhere."
        elif (checks[ref["url"]].get("format") == "html" and urlparse(ref["url"]).netloc in {"doi.org", "link.springer.com", "press.princeton.edu"}) or ref["url"] in {
            "https://diestel-graph-theory.com/", "https://pi.math.cornell.edu/~hatcher/AT/ATchapters.html"
        } or ("ocw.mit.edu/courses/" in ref["url"] and "/resources/" not in ref["url"] and ref["url"].endswith("/")):
            disposition = "index-or-abstract-only"
            reason = "The linked page is a publisher record, book or course index, rather than the located proof section."
        else:
            disposition = "source-text-retrieved-proof-unverified"
            reason = "Readable text was retrieved, but complete proof and route match require mathematical review."
        records.append({
            "id": route["id"], "title": route["title"], "disposition": disposition,
            "reason": reason, "url": ref["url"] if ref else None,
            "locator": ref.get("locator", "") if ref else "",
            "sourceCheck": checks.get(ref["url"]) if ref else None,
        })
    result = {
        "method": "All 371 previously unreviewed routes were checked for review eligibility and source-text access. This audit does not equate HTTP access, a proof keyword, a theorem statement, or a bibliography listing with a verified complete proof.",
        "reviewedRouteCount": len(records), "uniqueSourceUrls": len(urls),
        "dispositions": dict(sorted(Counter(record["disposition"] for record in records).items())),
        "records": records,
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    disposition_by_id = {record["id"]: record["disposition"] for record in records}
    if any(disposition_by_id[route_id] != "complete-proof-located" for route_id in VERIFIED_FULL_PROOFS):
        raise ValueError("A manually verified complete proof lost its audit status")
    if any(disposition_by_id[route_id] != expected[0] for route_id, expected in MANUAL_SOURCE_LIMITS.items() if route_id not in VERIFIED_FULL_PROOFS):
        raise ValueError("A manually reviewed source limitation lost its audit status")
    for entry in catalog["entries"]:
        for route in entry["routes"]:
            route_id = route["id"]
            route["fullProofAudit"] = disposition_by_id.get(route_id, "previously-reviewed")
            if disposition_by_id.get(route_id) in {"context-only-citation", "index-or-abstract-only", "source-page-not-proof", "route-mismatch", "scope-mismatch", "statement-only", "partial-proof"}:
                route["routeEvidenceStatus"] = "background-only"
            elif route.get("sketchStatus") == "source-extracted" or route_id in REFERENCES or route_id in CHECKED_REPLACEMENTS or route_id in VERIFIED_FULL_PROOFS:
                route["routeEvidenceStatus"] = "route-checked"
            elif route.get("references"):
                route["routeEvidenceStatus"] = "route-unverified"
            else:
                route["routeEvidenceStatus"] = "no-route-citation"
            if route["routeEvidenceStatus"] == "route-checked" and disposition_by_id.get(route_id) in {"route-mismatch", "scope-mismatch", "statement-only", "partial-proof"}:
                raise ValueError(f"Unsupported route marked checked: {route_id}")
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Audited {len(records)} routes across {len(urls)} URLs: {result['dispositions']}")


if __name__ == "__main__":
    main()
