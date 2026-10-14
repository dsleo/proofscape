# Proofscape

Proofscape is a browser for exploring proof diversity: how different arguments approach the same mathematical statement. It brings together informal proof texts and formal proof artifacts, with side-by-side comparison where records share a source statement.

## What can be explored

- **Informal:** the multiple proof texts grouped under one ProofWiki or Nemotron statement record.
- **Formal:** the human proof and prover proof paired in one NuminaMath record, with the source validation status shown for each.
- **Course results:** a curated index of 150 historically central results taught from secondary school through graduate courses, with 462 separately tracked proof approaches. Where a source has been reviewed, its citation and paraphrased proof sketch appear together on that approach. A **World** view maps the proof methods used across those approaches as islands (one per domain) joined by bridges where two methods of different domains distinguish two routes of one theorem, with methods that share theorems placed closer, drawn as a full-width illustrated map that reveals more methods, names and trails as you zoom in; a **Ring** view shows the same data as a compact chord diagram. In both, clicking methods, method pairs, bridges or islands lists the theorems whose proofs use them.

The comparison keeps the shared source statement and provenance visible. Records from different datasets are not automatically matched, so Proofscape does not present cross-source pairs as proofs of the same statement. Informal records are source artifacts, not correctness certificates; source annotations are not expert-verified ground truth.

## Run locally

The release inputs are compressed in `data/source`. Generate the static index and individual proof records, then start Vite:

```sh
npm ci
npm run build:collection
npm run dev
```

For a production build, run `npm run build`. The app is a static Vite site; GitHub Actions builds and publishes it to GitHub Pages at `https://dsleo.github.io/proofscape/`.

The generated `public/data/collection` directory is intentionally ignored by Git. It contains a compact searchable index and individually compressed records, so opening one record does not download the whole collection.

## Dataset and attribution

This release contains 9,843 records: 6,265 informal records from ProofWiki Math and Nemotron Math Proofs v2, plus 3,578 paired human/prover records from NuminaMath Lean Proof Artifacts.

| Source | Included material | Source terms |
| --- | --- | --- |
| [ProofWiki Math](https://huggingface.co/datasets/avewright/proofwiki-math) | Informal proof records | CC BY-SA 3.0 |
| [Nemotron Math Proofs v2](https://huggingface.co/datasets/nvidia/Nemotron-Math-Proofs-v2) | Synthetic proof candidates | CC BY 4.0 |
| [NuminaMath Lean Proof Artifacts](https://huggingface.co/datasets/iiis-lean/NuminaMath-LEAN-Proof-Artifacts) | Human/prover Lean pairs | Apache-2.0; see its upstream attribution context |

The 119 ProofRank records are excluded from this public release because the base dataset card does not specify a license. Its separately published method-label output is CC BY-NC-SA 4.0. Source identifiers, links, validation labels, and applicable license metadata remain attached to included records. See [`data/collection/README.md`](data/collection/README.md) and [`data/collection/manifest.json`](data/collection/manifest.json) for pinned revisions and details.

The dataset is a research collection, not a uniform proof-verification set. The formal source's validation field describes the upstream validation result; it is not recomputed by Proofscape.

The course-results tab is maintained in [`data/collection/historical-proof-catalog.json`](data/collection/historical-proof-catalog.json). Citations and sketches are attached to individual approaches; source-extracted sketches are distinguished from assistant reconstructions. The route-by-route [`proof-extraction-ledger.json`](data/collection/proof-extraction-ledger.json) and batch files track sources checked and remaining work so extraction can continue without repeating reviews. See [`data/collection/README.md`](data/collection/README.md) for the evidence rules and merge workflow.

## Deployment

The `Deploy Proofscape to GitHub Pages` workflow builds the static record assets and deploys `dist/`. The repository uses the `/proofscape/` Vite base path for the project Pages URL. Enable Pages with **GitHub Actions** as the build and deployment source.

## Research notes

- [`data/collection/PROOF_DIVERSITY_STUDY.md`](data/collection/PROOF_DIVERSITY_STUDY.md) proposes a study protocol that keeps proof acceptance, strategy relation, and preference as separate questions.
- [`data/collection/featured-results.json`](data/collection/featured-results.json) is a curation file for future study design; those labels are not used as ground truth in the explorer.
