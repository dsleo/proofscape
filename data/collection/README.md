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

Current ledger snapshot (2026-10-12): all 462 approaches have a sketch; 41 are source-extracted paraphrases and 421 are reconstructions. There are route-level citations on 381 approaches; 81 still need a route citation. Verbatim-source status: 38 routes carry a complete proof passage transcribed verbatim from the cited source (`user-authorized`, under the project owner's personal-research authorization; 6 of those also have an openly verified licence recorded), 4 cited sources do not contain the complete claimed route, and 420 routes remain to be reviewed for exact source text. Proof passages are linked with locators rather than copied into this app, except `user-authorized` routes, whose transcriptions are copyright-encumbered and must not be deployed publicly without fresh permission. The 126-entry bibliography is distinct from the route-citation count. The first batch also has a separate manifest with 64 proof-validity, hypothesis, or route-overlap flags. These counts are regenerated from the ledger and batches with `npm run merge:proof-extractions`.

To validate and publish the static catalog, run `npm run build:historical-catalog` (also included in `npm run build:collection`). The builder rejects duplicate result and approach IDs, unknown source IDs, citations absent from the source register, extracted sketches without route citations and precise locators, missing proof sketches, and entries with fewer than two proposed approaches. It writes the deployable copy to the ignored `public/data/collection` directory.

## Method tags and the Methods ring

[`technique-vocabulary.json`](technique-vocabulary.json) is a controlled vocabulary of proof methods (a method is the central idea a route relies on, not the topic of the theorem). [`route-techniques.json`](route-techniques.json) assigns each of the 462 routes up to three methods, a `borrowsFrom` field, and optional flags (`near-duplicate`, `dependent`, `incomplete`, `not-the-stated-theorem`, `sketch-mismatch`, `not-a-route`) plus a `derivesFromTheorem` modifier for routes that mainly apply a larger named theorem. Tags are **inferred from the proof sketches** by two independent reviewers and reconciled; they are not verified against the cited sources. Routes carrying an exclusion flag are left out of every count.

The build (`npm run build:constellation`, also part of `build:collection`) validates the tags against the vocabulary and the catalog, then publishes `constellation.json`. Method pairs are **strict**: a pair joins two methods only when each one distinguishes its route from another route of the same theorem, so methods shared by two routes, or used together inside one route, never form a pair (triples follow the same rule across three routes). The build asserts this rule on every run.

The ring order in [`ring-order.json`](ring-order.json) is generated from rival-pair co-occurrence (never worse than the hand-made domain order it starts from) and checked in so the figure stays stable. Regenerate it deliberately with `npm run build:ring-order`.

The World view's island and method positions live in [`world-layout.json`](world-layout.json). They are generated from the data (islands pulled together by the rival pairs that cross between them; within an island, methods that appear in the same theorems sit closer and bridging methods face the coast of the island they link to) and then nudged by a fixed-seed search so the bridges cross as little as the graph allows (the method graph contains K5, so one crossing is unavoidable) and never run over a third island. The result is checked in so the map stays stable. Regenerate deliberately with `npm run build:world`.

