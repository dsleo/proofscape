#!/usr/bin/env python3
"""Add checked, route-specific references to the historical proof catalogue.

This pass deliberately leaves an approach uncited when the available source only
supports its theorem, a different proof, or a merely related variant.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data/collection/historical-proof-catalog.json"
TECHNIQUES = ROOT / "data/collection/route-techniques.json"

REVIEW_FLAGS = {
    "61-r3": "dependent",
    "79-r3": "incomplete",
    "80-r3": "dependent",
}
CLEAR_FLAGS = {"61-r2", "99-r3"}
VERIFIED_FULL_PROOFS = {
    "52-r1", "52-r2", "52-r3", "54-r1", "56-r2", "56-r3", "57-r3", "60-r2",
    "61-r2", "67-r2", "70-r2", "73-r1", "74-r1", "75-r1", "75-r2",
    "79-r2", "81-r2", "83-r2", "85-r2", "87-r1", "87-r3",
    "85-r1", "89-r1", "89-r2", "91-r1", "92-r1", "96-r3", "99-r1",
    "99-r2", "99-r3", "99-r4", "100-r2",
    "55-r2", "56-r1", "57-r1", "59-r1", "59-r2", "62-r2",
    "62-r3", "64-r1", "67-r1", "68-r1", "68-r3",
    "69-r1", "69-r2", "70-r1", "70-r3", "71-r2", "79-r1",
    "80-r1", "81-r3", "82-r1", "84-r1", "84-r2", "91-r2",
    "54-r2", "96-r1", "141-r1", "141-r2",
    "58-r3", "80-r2", "82-r2", "82-r3", "84-r3",
    "87-r2", "88-r1", "116-r3", "117-r1", "117-r2",
    "132-r1", "132-r2",
}
MERGED_VARIANTS = {
    "59-r3": "59-r1", "61-r3": "61-r1", "64-r2": "64-r1",
    "67-r3": "67-r2", "71-r3": "71-r1", "72-r2": "72-r1",
    "72-r3": "72-r1", "73-r2": "73-r1", "74-r2": "74-r1",
    "75-r3": "75-r1", "79-r3": "79-r1", "80-r3": "80-r1",
    "86-r2": "86-r1", "88-r2": "88-r1", "89-r3": "89-r1",
    "90-r2": "90-r1", "90-r3": "90-r1", "91-r3": "91-r2",
    "92-r2": "92-r1", "92-r3": "92-r1",
}
RETIRED_ROUTES = {
    "60-r3": "This uses strong-law machinery rather than proving the stated weak law as an independent route.",
    "64-r3": "The proposed duality formula normally uses Hölder's inequality, so this proof would be circular.",
    "69-r3": "This derives a separation corollary from Hahn–Banach rather than proving Hahn–Banach.",
    "73-r3": "The duality argument assumes a bounded adjoint that closedness alone does not supply.",
    "74-r3": "The degree argument supplies local existence but the cited sources do not supply an independent full inverse-function proof.",
    "77-r3": "Potential fields give only special cases, not Green's or the divergence theorem generally.",
    "100-r3": "The proposed weak-compactness argument invokes uniform boundedness rather than proving it.",
}
REVIEW_NOTES = {
    "61-r2": "The displayed moment argument needs higher moments; finite variance alone does not supply them.",
    "61-r3": "This unpacks the characteristic-function convergence route rather than giving an independent proof.",
    "79-r3": "The maximum-modulus principle on expanding disks does not by itself force constancy; a further estimate is needed.",
    "80-r3": "The power-series expansion and contour deformation require prior analytic results and overlap with the Cauchy–Goursat route.",
}
FLAG_LABELS = {
    "dependent": "Depends on another route",
    "near-duplicate": "Overlaps another route",
    "incomplete": "Argument incomplete",
    "not-the-stated-theorem": "Covers a narrower statement",
    "sketch-mismatch": "Sketch does not match route",
    "title-sketch-mismatch": "Title and sketch disagree",
    "not-a-route": "Not an independent proof route",
}

# route id: (source label, URL, exact section or proof locator)
REFERENCES = {
    "52-r1": ("Yakovenko, Symmetric Polynomials and Newton Identities", "https://yakovenko.wordpress.com/wp-content/uploads/2011/04/lecture5symmetry.pdf", "Theorem 21 and its proof, pp. 8–10, logarithmic derivative and coefficient comparison"),
    "52-r2": ("Yakovenko, Symmetric Polynomials and Newton Identities", "https://yakovenko.wordpress.com/wp-content/uploads/2011/04/lecture5symmetry.pdf", "Theorem 21 and its proof, pp. 8–10, expansion of E'=PE and coefficient comparison"),
    "52-r3": ("Zeilberger, A Combinatorial Proof of Newton's Identities", "https://sites.math.rutgers.edu/~zeilberg/mamarimY/Zeilberger_y1984_p319.pdf", "p. 319, sign-reversing involution on weighted pairs (A,j^l)"),
    "54-r1": ("Mike Spivey, Pascal Matrices and Binomial Inversion", "https://mikespivey.wordpress.com/2017/05/05/pascal-matrices-and-binomial-inversion/", "Pascal matrix inverse and binomial inversion, paragraphs after displayed P3 and P3 inverse"),
    "54-r3": ("Columbia CS4205, Binomial Coefficients", "https://www.cs.columbia.edu/~cs4205/files/CM4.pdf", "§4.2, Binomial Inversion Operation, pp. 25–27; alternating binomial expansion"),
    "54-r2": ("Stanley, Enumerative Combinatorics I", "https://math.mit.edu/~rstan/ec/ec1.pdf", "§3.8, Möbius inversion and Boolean-algebra Möbius function"),
    "56-r2": ("MIT 18.200, Network Flows and Matching", "https://ocw.mit.edu/courses/18-200-principles-of-discrete-applied-mathematics-spring-2024/mit18_200_s24_lec11-12.pdf", "Theorem 4 and proof, PDF pp. 8–9, Hall's theorem via an integral max-flow/min-cut network"),
    "56-r3": ("UMass Amherst, Lecture 15: Hall's Marriage Theorem", "https://people.cs.umass.edu/~barring/cs250s13/lecture/15.pdf", "pp. 11–13, induction with a tight subset and the strict-inequality case"),
    "57-r3": ("IIT Kharagpur, Hall and König theorems", "https://cse.iitkgp.ac.in/~palash/Courses/2024Algorithms2/Files/Hall-Konig-Theorem.pdf", "Theorem 3, König's theorem by integral max-flow/min-cut"),
    "60-r2": ("MIT 18.175, Theory of Probability, Lecture 8", "https://ocw.mit.edu/courses/18-175-theory-of-probability-spring-2014/887e96172e82a615dac16fb26702d88b_MIT18_175S14_Lecture8.pdf", "slides 21–24, characteristic-function proof of weak law with finite mean"),
    "67-r2": ("UC Riverside, Sutherland analysis supplements", "https://math.ucr.edu/~res/math145A-2017/sutherland-supplements.pdf", "Theorem C.1.28, finite-net proof of Arzelà–Ascoli"),
    "70-r2": ("Sharifi, Point-Set Topology", "https://www.math.ucla.edu/~sharifi/notes/topology-ch03.html", "Theorems 3.4.10–3.4.11, Alexander subbase theorem and Tychonoff"),
    "73-r1": ("MIT 18.102, Introduction to Functional Analysis", "https://ocw.mit.edu/courses/18-102-introduction-to-functional-analysis-spring-2021/8fb8d5c170f1613151aca71de21027bc_MIT18_102s21_full_lec.pdf", "Theorem 40, closed graph theorem via the open mapping theorem, PDF p. 19"),
    "74-r1": ("MIT 18.965, Geometry of Manifolds, Lecture 4", "https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/55a7137272a97179db2a80b6e20d5de0_lecture4.pdf", "Theorem 5.1, contraction proof of inverse function theorem, pp. 1–2"),
    "75-r1": ("MIT 18.965, Geometry of Manifolds, Lecture 4", "https://ocw.mit.edu/courses/18-965-geometry-of-manifolds-fall-2004/55a7137272a97179db2a80b6e20d5de0_lecture4.pdf", "Theorem 5.2, implicit function theorem from inverse function theorem, pp. 2–4"),
    "75-r2": ("UBC, The Contraction Mapping Theorem and the Implicit Function Theorem", "https://www.math.ubc.ca/~feldman/m425/impFnThm.pdf", "pp. 3–5, fixed-point map g(x,z)=z−A⁻¹f(x,z+y₀)"),
    "76-r3": ("Berkeley, Integral Calculus", "https://math.berkeley.edu/~wodzicki/H185.S11/Integral%20Calculus.pdf", "§2.6, Theorem 2.4, Stokes theorem as de Rham/singular-chain pairing"),
    "81-r3": ("Hatcher, Algebraic Topology", "https://pi.math.cornell.edu/~hatcher/AT/AT.pdf", "Corollary 2.15, no-retraction theorem and Brouwer fixed-point theorem"),
    "82-r1": ("Galloway, Introduction to Differential Geometry", "https://www.math.miami.edu/~galloway/IntroDGnotes.pdf", "Chapter 6, Gauss–Bonnet via geodesic triangulation"),
    "82-r3": ("Yin Li, The Gauss–Bonnet–Chern Theorem on Riemannian Manifolds", "https://arxiv.org/abs/1111.4972", "Chern–Weil and Euler-class proofs of Gauss–Bonnet–Chern"),
    "84-r3": ("Milne, Fields and Galois Theory", "https://www.jmilne.org/math/CourseNotes/FT.pdf", "Chapter 8, Galois theory of étale algebras and finite G-sets"),
    "85-r2": ("Milne, A Primer of Commutative Algebra", "https://www.jmilne.org/math/xnotes/CA.pdf", "Theorem 3.7, Hilbert basis theorem and finite-generation argument"),
    "86-r3": ("Makdonald, Homological Algebra: Noether Normalizations", "https://smakdonald.github.io/Homological-Algebra/sec-noether-normalizations.html", "Lemma 14.18 and Theorem 14.21, graded Noether normalization over an infinite field"),
    "87-r1": ("Milne, A Primer of Commutative Algebra", "https://www.jmilne.org/math/xnotes/CA.pdf", "Theorem 13.1 and Theorem 13.8, Zariski's lemma and weak Nullstellensatz"),
    "87-r3": ("Milne, A Primer of Commutative Algebra", "https://www.jmilne.org/math/xnotes/CA.pdf", "Theorem 13.10 and Corollary 13.9, radical ideals and affine points"),
    "89-r1": ("MIT 18.102, Functional Analysis, Chapter 3", "https://math.mit.edu/~rbm/18.102Sp20/Chapter3.pdf", "Theorem 3.4 and its proof, PDF pp. 24–27, variational extremum and iteration"),
    "89-r2": ("MIT 18.102, Functional Analysis, Chapter 3", "https://math.mit.edu/~rbm/18.102Sp20/Chapter3.pdf", "Theorem 3.4 and its proof, PDF pp. 24–27, compact eigenvector and orthogonal complement"),
    "96-r1": ("MIT 18.785, Number Theory I, Lecture 16", "https://math.mit.edu/classes/18.785/2021fa/LectureNotes16.pdf", "§16.1–16.2, zero-free line and Newman's analytic proof of the prime number theorem"),
    "96-r2": ("TIFR, Lectures on the Riemann Zeta Function", "https://mathweb.tifr.res.in/sites/default/files/publications/ln/tifr01.pdf", "The Wiener–Ikehara theorem and its application to the prime number theorem"),
    "96-r3": ("Atle Selberg, An Elementary Proof of the Prime-Number Theorem", "https://www.math.lsu.edu/~mahlburg/teaching/handouts/2014-7230/Selberg-ElemPNT1949.pdf", "Annals of Mathematics 50 (1949), pp. 305–313, symmetry formula and elementary proof"),
    "97-r1": ("MIT 18.785, Number Theory I, Lecture 18", "https://math.mit.edu/classes/18.785/2021fa/LectureNotes18.pdf", "§18, Dirichlet L-functions and proof of Dirichlet's theorem"),
    "97-r2": ("Columbia, Class Field Theory notes", "https://www.math.columbia.edu/~chaoli/docs/ClassFieldTheory.html", "Chebotarev density theorem and cyclotomic specialization to primes in residue classes"),
    "99-r1": ("Keith Conrad, Stirling's Formula", "https://kconrad.math.uconn.edu/blurbs/analysis/stirling.pdf", "§3, Laplace's method applied to the gamma integral"),
    "99-r2": ("University of Colorado, Wallis' Formula and Stirling's Formula", "https://www.colorado.edu/amath/sites/default/files/attached-files/wallis_stirling2.pdf", "pp. 1–4, Wallis product followed by Stirling's formula"),
    "99-r4": ("Hjort and Stoltenberg, Probability Proofs for Stirling", "https://arxiv.org/pdf/2410.19555", "§2.1, Poisson CLT and telescoping positive-part expectation"),
    "99-r3": ("Rutgers, Real Analysis, Euler–Maclaurin Summation Formula", "https://math.camden.rutgers.edu/files/Real_Analysis_CHPTR4-End.pdf", "§4.15, pp. 310–312, Euler–Maclaurin expansion for log(n!) and evaluation of the constant via Wallis"),
    "61-r2": ("Terence Tao, Topics in Random Matrix Theory", "https://www.math.hkbu.edu.hk/~ttang/UsefulCollections/matrix-book-2011-02.pdf", "§2.2, pp. 107–110, truncation to bounded summands and method-of-moments CLT proof"),
    "63-r2": ("Utah, Inequalities of Analysis", "https://www.math.utah.edu/~treiberg/InequalitiesSlides.pdf", "Jensen's inequality, finite weighted induction proof"),
    "79-r2": ("Stanford Math 220B, Laplace Equation notes", "https://web.stanford.edu/class/math220b/handouts/laplace.pdf", "§3.2.5, Liouville theorem for bounded harmonic functions via mean-value estimates"),
    "80-r2": ("Howell and Mathews, Complex Analysis", "https://complexanalysis.org/web/sec_cauchy-integral-formulas.html", "§6.4, Cauchy's integral formula; read with §6.3 Green's-theorem proof of Cauchy–Goursat"),
    "81-r2": ("Princeton, Degree Theory", "https://web.math.princeton.edu/~const/deg.pdf", "Brouwer fixed-point theorem, proof by homotopy invariance of degree"),
    "83-r2": ("Hatcher, Algebraic Topology", "https://pi.math.cornell.edu/~hatcher/AT/AT.pdf", "Proposition 2B.1(b), Jordan curve theorem as a homology separation result"),
    "90-r1": ("Delft, Boolean Algebras and Logic", "https://fa.ewi.tudelft.nl/~hart/37/onderwijs/old-courses/boole.pdf", "Chapter 2 §2, Theorem 2.1 and Exercises I.3–I.6, ultrafilter construction"),
    "91-r1": ("University of Washington, Group Theory Lecture 10-4", "https://sites.math.washington.edu/~mcgovern/504%20pdf%202024/504.10-4.pdf", "pp. 6–10, Schreier transversal and free-generator proof"),
    "91-r2": ("Hatcher, Algebraic Topology", "https://pi.math.cornell.edu/~hatcher/AT/AT.pdf", "Proposition 1A.2 and Theorem 1A.4, covering graphs and maximal trees"),
    "92-r1": ("University of Tennessee, Integral Domains and Fields", "https://web.math.utk.edu/~dcartwr1/iaawa/section-domains-and-fields.html", "Theorem 4.16, injective multiplication on a finite domain"),
    "100-r2": ("Mathematics@CUHK, Gliding-hump proof", "https://cuhkmath.wordpress.com/2010/11/19/a-nontopological-proof-of-the-uniform-boundedness-principle/", "Displayed proof, steps (1)–(5), construction of a point with unbounded operator images"),
}

SOURCE_REPLACEMENTS = {
    "81-r1": ("Ginory, The Brouwer Fixed Point Theorem", "https://sites.math.rutgers.edu/~ag930/Some%20Math/Brouwer%20Fixed%20Point%20Theorem.pdf", "§4, Theorem 4.5, n-dimensional Sperner-labeling proof; Sperner's lemma is stated as Lemma 4.4"),
    "85-r1": ("Milne, Algebraic Geometry", "https://www.jmilne.org/math/CourseNotes/AG500.pdf", "Theorem 2.2 and Lemma 2.3, pp. 30–31, leading-coefficient ideals and induction"),
    "132-r1": ("MIT 6.854, Max-Flow Min-Cut Theorem", "https://ocw.mit.edu/courses/6-854j-advanced-algorithms-fall-2005/8346e77d563c80b0ae714a21bc9a4541_max_flow_dff.pdf", "§6.3, Theorem 1 and proof, PDF pp. 6–7, residual network and reachable-set cut"),
    "132-r2": ("MIT 18.200, Network Flows and Matching", "https://ocw.mit.edu/courses/18-200-principles-of-discrete-applied-mathematics-spring-2024/mit18_200_s24_lec11-12.pdf", "Theorem 1 and proof via LP duality and cut rounding, PDF pp. 4–5"),
    "133-r1": ("Bollobás, Modern Graph Theory", "https://link.springer.com/book/10.1007/978-1-4612-0619-4", "Bibliographic book record; the Cauchy–Binet proof was not located in accessible text"),
    "133-r2": ("Bollobás, Modern Graph Theory", "https://link.springer.com/book/10.1007/978-1-4612-0619-4", "Bibliographic book record; the electrical-network proof was not located in accessible text"),
    "133-r3": ("Bollobás, Modern Graph Theory", "https://link.springer.com/book/10.1007/978-1-4612-0619-4", "Bibliographic book record; the all-minors proof was not located in accessible text"),
}
CHECKED_REPLACEMENTS = {"81-r1", "85-r1", "132-r1", "132-r2"}

# This adjudicated ledger is generated from three 100-route source reviews.
# Only records accepted after a separate exact-route check enter the catalogue.
REMAINING_REVIEW = ROOT / "data/collection/remaining-proof-source-review.json"
if REMAINING_REVIEW.exists():
    remaining = json.loads(REMAINING_REVIEW.read_text(encoding="utf-8"))
    for record in remaining["records"]:
        if record["catalogueDecision"] != "accepted-full":
            continue
        route_id = record["id"]
        if not record.get("sourceUrl") or not record.get("preciseLocator"):
            raise ValueError(f"Accepted route lacks a direct source and locator: {route_id}")
        if route_id in REFERENCES or (route_id in SOURCE_REPLACEMENTS and route_id not in {"81-r1", "133-r1"}):
            raise ValueError(f"Remaining-source review collides with existing curation: {route_id}")
        VERIFIED_FULL_PROOFS.add(route_id)
        CHECKED_REPLACEMENTS.add(route_id)
        SOURCE_REPLACEMENTS[route_id] = (
            record["sourceLabel"], record["sourceUrl"], record["preciseLocator"]
        )

REVISED_SKETCHES = {
    "52-r3": ("Form the weighted set of pairs (A,j^l), where A is a subset of {1,…,n}, j is an index, |A|+l=k, and l=0 requires j∈A. Give each pair weight (−1)^|A|(∏_{i∈A}x_i)x_j^l. Their total weight is the Newton recurrence. Toggle j's membership in A, adjusting l by one; this is a weight-reversing involution, so all terms cancel."),
    "99-r4": ("Let Y_n be Poisson(n), viewed as a sum of n independent Poisson(1) variables, and Z_n=(Y_n−n)/√n. The ordinary CLT and bounded second moments give E[(Z_n)_+]→E[Z_+]=1/√(2π). The Poisson sum telescopes to E[(Z_n)_+]=√n·P(Y_n=n)=√n e^(−n)n^n/n!. Rearranging yields Stirling's formula, without invoking a local CLT."),
    "60-r2": ("Let φ(t)=E[e^{itX}] and μ=E[X]. A finite mean gives φ(t)=1+iμt+o(t) near zero. For A_n=(X_1+⋯+X_n)/n, independence yields φ_{A_n}(t)=[φ(t/n)]^n→e^{iμt}. Lévy's continuity theorem gives A_n⇒μ, and convergence in distribution to a constant implies convergence in probability."),
    "96-r1": ("Extend ζ(s) meromorphically past Re(s)=1 and prove that it has no zero on that line. Newman's contour argument then gives the asymptotic for a log-weighted prime-counting function; partial summation gives π(x)∼x/log x. The zero-free line and analytic passage are both essential."),
    "61-r2": ("First truncate the finite-variance summands at a fixed level and recenter them; the normalized tail sum has variance as small as desired, uniformly in n. For bounded summands, expand each fixed moment of the normalized sum: singleton indices vanish, and pairings give the Gaussian moments. Moment determinacy gives convergence for the bounded variables. Let the truncation level grow to obtain the finite-variance theorem."),
    "99-r3": ("Apply Euler–Maclaurin to log(n!) to obtain (n+1/2)log n−n+C+o(1), with an explicit remainder. Wallis' product determines C=½log(2π). Thus n!∼√(2πn)(n/e)^n. The asymptotic expansion is an Euler–Maclaurin route, although its leading constant shares Wallis' calculation with another route."),
    "79-r3": ("The maximum-modulus principle bounds values inside each disk by values on its boundary, but a common bound on expanding boundaries does not alone force the function to be constant. This sketch needs an additional argument, such as Cauchy's derivative estimate; with that addition it becomes the first route."),
    "80-r3": ("If a power-series expansion of f is already available, termwise integration around a circle isolates its constant coefficient f(z). Extending the circle formula to a general contour uses contour deformation. The expansion and deformation require earlier analytic results, so this is a dependent derivation rather than a separate foundational proof."),
}


def main():
    catalog = json.loads(PATH.read_text(encoding="utf-8"))
    techniques = json.loads(TECHNIQUES.read_text(encoding="utf-8"))
    routes = {route["id"]: route for entry in catalog["entries"] for route in entry["routes"]}
    for route_id, flag in REVIEW_FLAGS.items():
        techniques["routes"][route_id]["flag"] = flag
    for route_id in CLEAR_FLAGS:
        techniques["routes"][route_id].pop("flag", None)
    sources = catalog["sources"]
    existing = {link["url"]: source_id for source_id, source in sources.items() for link in source.get("links", [])}
    next_id = max(int(source_id[1:]) for source_id in sources if source_id.startswith("X")) + 1
    for route_id, (label, url, locator) in (REFERENCES | SOURCE_REPLACEMENTS).items():
        route = routes[route_id]
        if route.get("references"):
            if any(reference.get("url") == url for reference in route["references"]):
                route["verbatimStatus"] = "source-hosted-only" if route_id in VERIFIED_FULL_PROOFS else "not-yet-reviewed"
                if route_id in VERIFIED_FULL_PROOFS:
                    route["verbatimNote"] = "Complete route proof located at the cited section. The catalogue sketch is a paraphrase; source wording is not reproduced here."
                continue
            if route_id == "99-r2" and route["references"][0].get("url") == "https://sites.pitt.edu/~armin/advcalcI20/advcalc.pdf":
                route["references"] = []
            elif route_id == "56-r2" and route["references"][0].get("url") == "https://people.cs.umass.edu/~sheldon/teaching/cs311/lec/lec20.pdf":
                route["references"] = []
            elif route_id in SOURCE_REPLACEMENTS:
                route["references"] = []
            elif route_id == "99-r4" and route["references"][0].get("url") == "https://arxiv.org/abs/2410.19555":
                route["references"] = []
            else:
                raise ValueError(f"{route_id} already has a different reference; inspect before replacing")
        source_id = existing.get(url)
        if source_id is None:
            source_id = f"X{next_id:04d}"
            next_id += 1
            description = "Bibliographic source; exact route proof not verified." if route_id.startswith("133-") and route_id not in VERIFIED_FULL_PROOFS else "Route-level source checked against the proof approach."
            sources[source_id] = {"id": source_id, "label": label, "description": description, "links": [{"label": label, "url": url}]}
            existing[url] = source_id
        route["references"] = [{"label": label, "url": url, "sourceId": source_id, "sourceLabel": sources[source_id]["label"], "locator": locator}]
        route["extractionNotes"] = "Independently composed proof sketch; cited section supports this proof approach. Not a verbatim quotation."
        # A route citation does not establish that a complete source proof was located.
        route["verbatimStatus"] = "source-hosted-only" if route_id in VERIFIED_FULL_PROOFS else "not-yet-reviewed"
        if route_id in VERIFIED_FULL_PROOFS:
            route["verbatimNote"] = "Complete route proof located at the cited section. The catalogue sketch is a paraphrase; source wording is not reproduced here."
    for route_id, sketch in REVISED_SKETCHES.items():
        routes[route_id]["proofSketch"] = sketch
    for route_id in VERIFIED_FULL_PROOFS:
        route = routes[route_id]
        if not any(reference.get("locator") for reference in route.get("references", [])):
            raise ValueError(f"Cannot mark full proof located without direct locator: {route_id}")
        route["verbatimStatus"] = "source-hosted-only"
        route["verbatimNote"] = "Complete route proof located at the cited section. The catalogue sketch is a paraphrase; source wording is not reproduced here."
    routes["52-r3"]["title"] = "sign-reversing involution on weighted subsets"
    routes["99-r3"]["title"] = "Euler–Maclaurin expansion with Wallis constant"
    for route_id, route in routes.items():
        flag = techniques["routes"].get(route_id, {}).get("flag")
        if flag:
            route["reviewFlag"] = flag
            if route_id in MERGED_VARIANTS:
                target = MERGED_VARIANTS[route_id]
                route["mergedInto"] = target
                route["reviewNote"] = f"Variation of {target} ({routes[target]['title']}); grouped with that proof idea. " + REVIEW_NOTES.get(route_id, "")
            elif route_id in RETIRED_ROUTES:
                route["reviewNote"] = RETIRED_ROUTES[route_id]
                route.pop("mergedInto", None)
            else:
                route["reviewNote"] = REVIEW_NOTES.get(route_id, FLAG_LABELS.get(flag, "Route needs review") + "; it is excluded from the independent-route count.")
        else:
            route.pop("reviewFlag", None)
            route.pop("reviewNote", None)
            route.pop("mergedInto", None)
    cited_source_ids = {reference.get("sourceId") for route in routes.values() for reference in route.get("references", [])}
    cited_source_ids.update(source_id for entry in catalog["entries"] for source_id in entry.get("sourceIds", []))
    for source_id, source in list(sources.items()):
        if source_id not in cited_source_ids and any(link.get("url", "").startswith("https://doi.org/10.1007/978-1-") and not link["url"].isascii() for link in source.get("links", [])):
            del sources[source_id]
    catalog["sourceRecordCount"] = len(sources)
    catalog["approachCoverage"]["withLocatedReference"] = sum(bool(route.get("references")) for route in routes.values())
    catalog["approachCoverage"]["withoutRouteCitation"] = sum(not route.get("references") for route in routes.values())
    for entry in catalog["entries"]:
        cited = sum(bool(route.get("references")) for route in entry["routes"])
        entry["routeCoverage"]["withLocatedReference"] = cited
        entry["routeCoverage"]["withoutRouteCitation"] = len(entry["routes"]) - cited
        entry["citationStatus"] = "route-citations-complete" if cited == len(entry["routes"]) else "route-citations-partial"
    PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    TECHNIQUES.write_text(json.dumps(techniques, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Reviewed {len(REFERENCES)} route citations; {catalog['approachCoverage']['withoutRouteCitation']} remain")


if __name__ == "__main__":
    main()
