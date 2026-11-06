# Proofscape release data

This public release is a filtered proof-diversity collection. It contains 9,843 statement records:

- 1,606 ProofWiki records and 4,659 Nemotron records in the informal track.
- 3,578 NuminaMath human/prover pairs in the formal track.

ProofRank's 119 records are deliberately excluded. Its base dataset card declares no license, and its separately released method-clustering outputs are CC BY-NC-SA 4.0. Excluding those records avoids republishing material under unclear or incompatible terms.

## Sources and terms

- ProofWiki Math: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), source dataset [record](https://huggingface.co/datasets/avewright/proofwiki-math), pinned revision `7d49431dd99f83236cc9c34ae9ec907581164c7f`.
- Nemotron Math Proofs v2: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), source dataset [record](https://huggingface.co/datasets/nvidia/Nemotron-Math-Proofs-v2), pinned revision `7665d7f1d006fd89aa852a9dab8060c60b63f814`.
- NuminaMath Lean Proof Artifacts: [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), source dataset [record](https://huggingface.co/datasets/iiis-lean/NuminaMath-LEAN-Proof-Artifacts), pinned revision `43f4ea4da40c48be8e89edb84cb0825d8a4dfe2d`. The upstream attribution caveat is retained.

Record-level source IDs, URLs, dataset names, and validation fields are kept in the generated artifacts. Proofscape does not infer that records from separate source datasets are equivalent statements. The informal track contains source texts, including model-generated candidates; they are not validated proofs. The formal source's validation status is copied from its upstream artifact and is not recomputed here.

The compressed release inputs in `data/source` are exact JSONL records except for the exclusion above. The build generates a search index and separately compressed record assets under `public/data/collection`. The static assets are not checked in; GitHub Actions creates them during deployment.

The original research protocol and hand-curated study seeds remain in this directory. The study seeds are not treated as ground-truth strategy labels by the explorer.

## Course-results index and approach evidence

[`historical-proof-catalog.json`](historical-proof-catalog.json) is a separate, hand-curated index of 150 historical results taught in standard courses from secondary school through graduate school. It is not counted among the 9,843 source-dataset records above. Its 462 approach records each have a stable ID, a source-derived sketch when extracted, an extraction state, and route-specific references. The full source register is the catalog-wide bibliography and discovery trail; it includes references that have not yet been attached to a particular approach.

Each approach displays its direct citation and locator alongside its source status. The current index has a sketch record for every route; `source-extracted` means a sketch was paraphrased from inspected source text, while `assistant-reconstruction` means the sketch was independently reconstructed. Neither means the source's exact wording is copied into Proofscape. The separate verbatim status records whether a complete source proof has been located, whether reuse terms were verified, or whether source/route review remains unresolved. Exact source wording stays at the cited source: this index links to the proof and locator rather than reproducing full passages. MathOverflow, ProofWiki, and similar community resources are discovery leads; a route found there still needs a primary, textbook, or lecture source to become a sourced proof approach.

Extraction work is tracked route-by-route in [`proof-extraction-ledger.json`](proof-extraction-ledger.json). It records sketches, provenance, sources checked, locators, notes, and remaining work so later passes can resume without repeating completed reviews. Parallel source-review batches are stored in `extractions/batch-*.json`; after a batch is reviewed, `npm run merge:proof-extractions` merges it into the catalog and updates the ledger. Batch records use `source-extracted` only when the source text was consulted; `assistant-reconstruction` is a clearly identified fallback sketch and must not be presented as source-derived. The Course results tab labels those two kinds separately.

Current catalog snapshot (2026-10-20): all 462 approaches have a sketch; 87 are source-extracted paraphrases and 375 are reconstructions. Of the original 74-route evidence queue, 47 now have direct route citations, 20 are grouped with an existing proof idea, and 7 are retired as invalid or narrower arguments. The latter 27 remain visible with review notes but are excluded from map route counts; see [`proof-route-evidence-review.json`](proof-route-evidence-review.json).

Across the catalog, 441 routes carry a link, but these links have different evidential strength: 273 routes have a checked match to their proof approach, 23 need route-level verification, and 145 link only to background, an index, an incomplete proof, or another argument. The other 21 have no route citation. The [full-proof source audit](full-proof-source-review.json) triaged all 371 routes that previously lacked an exact-proof review. A further [300-route small-model review](remaining-proof-source-review.json) inspected alternative sources for selected routes and preserved the prior audit limitations for the rest. Of 35 proposed complete proofs, 32 passed a separate exact-route check and were added to the catalogue; three were withheld because the source omitted a necessary step. The catalogue now points to 185 complete proofs at cited sections; 64 citations expressly disclaim route support, 20 source texts could not be retrieved in the audit, and the remainder have a specific access or match outcome. A [re-check of the 37 inaccessible routes](inaccessible-source-recheck.json) promoted two more (113-r2, 113-r3) from free alternative sources. A final [backlog review](proof-backlog-review.json) searched the remaining 266 routes with one reviewer and had every claimed complete proof re-read by a second verifier trying to refute it: 80 routes were promoted, 13 were downgraded to partial by the verifier, 10 more were confirmed but held back for a method difference or a skipped step, and the reviewers' criticisms of individual sketches are kept in that file rather than applied. This is a triage of all 371, not a claim that 371 complete proofs were found. The current exact-text status is 185 source-hosted proofs, 55 source images, 29 user-authorized proofs, 7 route-not-found flags, and 186 routes still without a verified complete proof. The 230-entry bibliography is distinct from route citations. Source excerpts and transcriptions need their reuse status checked before public deployment. The ledger is synchronized from the curated catalog with `python3 scripts/sync_proof_review_ledger.py`.

To validate and publish the static catalog, run `npm run build:historical-catalog` (also included in `npm run build:collection`). The builder rejects duplicate result and approach IDs, unknown source IDs, citations absent from the source register, extracted sketches without route citations and precise locators, missing proof sketches, and entries with fewer than two proposed approaches. It writes the deployable copy to the ignored `public/data/collection` directory.

## Method tags and the Methods ring

[`technique-vocabulary.json`](technique-vocabulary.json) is a controlled vocabulary of proof methods (a method is the central idea a route relies on, not the topic of the theorem). [`route-techniques.json`](route-techniques.json) assigns each of the 462 routes up to three methods, a `borrowsFrom` field, and optional flags (`near-duplicate`, `dependent`, `incomplete`, `not-the-stated-theorem`, `sketch-mismatch`, `not-a-route`) plus a `derivesFromTheorem` modifier for routes that mainly apply a larger named theorem. Tags are **inferred from the proof sketches** by two independent reviewers and reconciled; they are not verified against the cited sources. Routes carrying an exclusion flag are left out of every count.

The build (`npm run build:constellation`, also part of `build:collection`) validates the tags against the vocabulary and the catalog, then publishes `constellation.json`. Method pairs are **strict**: a pair joins two methods only when each one distinguishes its route from another route of the same theorem, so methods shared by two routes, or used together inside one route, never form a pair (triples follow the same rule across three routes). The build asserts this rule on every run.

### Approaches set aside from the map

In `route-techniques.json`, a route's `flag` can mark it as one the reviewers set aside. 140 of the 462 catalogued approaches carry such a flag, and `build_constellation.py` leaves them out of `constellation.json`, so they never appear on the map, in its pairs, or in its theorem lists. They stay in the catalog, in `route-techniques.json`, and in the Explore list, where every theorem keeps all of its recorded approaches.

| Flag | Routes | Meaning | Example (the set-aside route is the last one) |
| --- | --- | --- | --- |
| `near-duplicate` | 72 | the same idea as a kept approach | Binomial theorem: induct on the exponent; count subsets by size; *multiply out and group monomials* |
| `incomplete` | 30 | the sketch is too thin to say which methods it uses | Cauchy–Schwarz: *Hölder as a more general route* |
| `not-the-stated-theorem` | 15 | it proves a stronger or different statement | Weak law of large numbers: *truncation plus Borel–Cantelli* (the strong law) |
| `dependent` | 15 | it is a kept approach in disguise, or needs it | Mean value theorem: *subtract the secant line and apply Rolle* |
| `sketch-mismatch` | 4 | the title and the sketch describe different proofs | Irrationality of √p: *lowest-terms divisibility* |
| `not-a-route` | 2 | a remark or caution, not a proof | Primes in an arithmetic progression: *do not conflate these special cases with Dirichlet's theorem* |
| `title-sketch-mismatch` | 1 | the title and argument identify different routes | See the recorded route review note. |
| `sketch-self-corrects` | 1 | the sketch itself explains why the proposed proof does not work | See the recorded route review note. |

The flags are the reviewers' judgement, not source-verified, and several are debatable. To bring a route back onto the map, remove its `flag` (and check that it has techniques) and run `npm run build:constellation`.

The technique order in [`ring-order.json`](ring-order.json) (from the retired Ring view; it still orders the method list) is generated from rival-pair co-occurrence and checked in so it stays stable. Regenerate it deliberately with `npm run build:ring-order`.

The World view's island and method positions live in [`world-layout.json`](world-layout.json). They are generated from the data (islands pulled together by the rival pairs that cross between them; within an island, methods that appear in the same theorems sit closer and bridging methods face the coast of the island they link to) and then nudged by a fixed-seed search so the bridges cross as little as the graph allows (the method graph contains K5, so one crossing is unavoidable) and never run over a third island. The result is checked in so the map stays stable. Regenerate deliberately with `npm run build:world`.


## Technique hierarchy

`technique-vocabulary.json` places every technique in a **family** (one island on the World map) and, inside it, a **group** (a sub-domain such as *Homological and categorical algebra*). A technique belongs where its mathematics lives, not where it is usually applied: chain complexes and exact sequences sit with algebra, not geometry. After changing a family or group, regenerate the frozen layouts with `npm run build:ring-order && npm run build:world`.

Each technique also carries a `glyph`, the mathematical symbol that marks it on the World map (Σ for telescoping sums, χ for the Euler characteristic, ∫ for integral calculus, and so on). It is purely visual; keep it to one to three characters.

## Mathlib and alternative proof comparisons

`proof-comparisons.json` contains the 28 curated statements from the review, each with two informal proofs, verbatim excerpts from a pinned Mathlib revision, an explicitly uncompiled Lean-style sketch for the alternative, and a difficulty assessment. The Mathlib source excerpts carry their file-level attribution; their Apache 2.0 license is in `MATHLIB-LICENSE.txt`. The sketches and qualitative comparisons do not establish that one route is formally harder.

The optional `historicalId` field links a comparison to the corresponding Explore statement. Twenty-seven have a matching Explore entry; Lagrange's subgroup theorem currently has no corresponding entry. Some comparisons specialize a broader Explore statement, so the interface also shows the exact scope of the comparison. `scripts/build_proof_comparisons.py` validates and publishes this dataset for both Library and Explore.
