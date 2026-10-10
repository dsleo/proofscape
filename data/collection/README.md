# Proofscape release data

This public release is a filtered proof-diversity collection. It contains 9,843 statement records:

- 1,606 ProofWiki records and 4,659 Nemotron records in the informal track.
- 3,578 NuminaMath human/prover pairs in the formal Lean track.

ProofRank's 119 records are deliberately excluded. Its base dataset card declares no license, and its separately released method-clustering outputs are CC BY-NC-SA 4.0. Excluding those records avoids republishing material under unclear or incompatible terms.

## Sources and terms

- ProofWiki Math: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), source dataset [record](https://huggingface.co/datasets/avewright/proofwiki-math), pinned revision `7d49431dd99f83236cc9c34ae9ec907581164c7f`.
- Nemotron Math Proofs v2: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), source dataset [record](https://huggingface.co/datasets/nvidia/Nemotron-Math-Proofs-v2), pinned revision `7665d7f1d006fd89aa852a9dab8060c60b63f814`.
- NuminaMath Lean Proof Artifacts: [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), source dataset [record](https://huggingface.co/datasets/iiis-lean/NuminaMath-LEAN-Proof-Artifacts), pinned revision `43f4ea4da40c48be8e89edb84cb0825d8a4dfe2d`. The upstream attribution caveat is retained.

Record-level source IDs, URLs, dataset names, and validation fields are kept in the generated artifacts. Proofscape does not infer that records from separate source datasets are equivalent statements. The informal track contains source texts, including model-generated candidates; they are not validated proofs. The formal source's validation status is copied from its upstream artifact and is not recomputed here.

The compressed release inputs in `data/source` are exact JSONL records except for the exclusion above. The build generates a search index and separately compressed record assets under `public/data/collection`. The static assets are not checked in; GitHub Actions creates them during deployment.

The original research protocol and hand-curated study seeds remain in this directory. The study seeds are not treated as ground-truth strategy labels by the explorer.
