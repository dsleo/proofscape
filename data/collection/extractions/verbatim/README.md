# Excerpt extraction pass

`tasks/tasks-NN.json` — routes for one worker. `results/results-NN.json` — one JSON object per worker.
`scripts/integrate_verbatim.py` applies results to `batch-*.json`; then
`npm run merge:proof-extractions && npm run build:historical-catalog`.

Result object per route (all keys required; use null where not applicable):
```
{ "routeId", "sourceTitle", "sourceUrl", "locator",
  "routeMatch": "verified | mismatch | uncertain",
  "proofSketch": "short paraphrase written from reading the cited proof (not copied)",
  "images": [ {"file": "<routeId>-1.png", "caption": "what the crop shows (page/section)"} ],
  "reuseStatus": "public-domain | license-permits-redistribution | user-authorized | unclear | copyrighted | unavailable",
  "license": null | "name", "licenseUrl": null | "https://…", "attribution": "…",
  "transcriptionNotes": null | "…  (what is omitted/cropped; any caveat)",
  "reasonNotReproduced": null | "why no excerpt (mismatch / unavailable / uncertain)" }
```
Images live in `data/collection/proof-images/`.
