# Proofscape

Proofscape is a browser for exploring proof diversity: how different arguments approach the same mathematical statement. It brings together informal proof texts and formal proof artifacts, with side-by-side comparison where records share a source statement.

## What can be explored

The site opens on **Explore**, a map of 150 curated results; a second section, the **Library**, holds three public corpora, kept apart because they are different things.

- **Explore** (the front door):  a curated index of 150 historically central results taught from secondary school through graduate courses, with 462 separately tracked proof approaches. Where a source has been reviewed, its citation and paraphrased proof sketch appear together on that approach. A **World** view maps the proof methods used across those approaches as islands (one per domain) joined by bridges where two methods of different domains distinguish two routes of one theorem, with methods that share theorems placed closer, drawn as a full-window illustrated map that reveals more methods, names and trails as you zoom in, with a search box for methods and theorems and a per-theorem view that lays each proof route over the methods it uses; clicking methods, method pairs, bridges or islands lists the theorems whose proofs use them.

The **Library** reads one statement at a time, with a search box per source (matches are listed under the box; "Random statement" picks one). It opens on a showcase statement, then those with the most proofs:

- **ProofWiki (written by people):** theorems with the proofs contributors wrote. Searchable by text, title and ProofWiki category.
- **Nemotron (AI-generated):** competition-style problems with proofs from a single language model (DeepSeek-V4-Pro), so alternative proofs of one problem are samples from the same model.
- **Lean (formal):** NuminaMath statements formalised in Lean 4, each with the human proof and the automated prover's proof side by side, with the source validation status shown for each.

### Using the map

- **Zoom** with two-finger scroll, pinch, double-click or the buttons; **drag** to move. Names, trails and bridge cables appear as you zoom in.
- **Click** a method, trail, bridge or island for a short note; **double-click** (or use the note's button) to list the theorems that use it. Selections narrow each other.
- **Hover** a method to see its name and the methods it is paired with.
- **Search** for a method, or for a theorem to lay each of its proof routes over the methods it uses.
- Tap or click an island's land for its note. Click an empty spot of water, or press Esc, to start over.
- **Keyboard:** the arrow keys move the map, `+` and `−` zoom, `0` resets the view; Tab visits the controls, islands and bridges (methods join the tab order once the view is zoomed in; search and the Theorems & methods drawer reach every method at any zoom).
- On a phone the map opens zoomed in, and the Theorems & methods drawer is a sheet over the lower half.

The comparison keeps the shared source statement and provenance visible. Records from different datasets are not automatically matched, so Proofscape does not present cross-source pairs as proofs of the same statement. Informal records are source artifacts, not correctness certificates; source annotations are not expert-verified ground truth.

## Run locally

The release inputs are compressed in `data/source`. Generate the static index and individual proof records, then start Vite:

```sh
npm ci
npm run build:collection
npm run dev
```

For a production build, run `npm run build`. The app is a static Vite site; GitHub Actions builds and publishes it to GitHub Pages at `https://dsleo.github.io/proofscape/`.

The generated `public/data/collection` directory is intentionally ignored by Git. It contains a short source list (`index.json`), one searchable statement index per source (`index-<dataset>.json`, fetched only when that source is read) and individually compressed records, so opening one record does not download the whole collection.

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

### Links

Everything you see has an address, so any view can be shared. Parameters combine freely:

| Link | Opens |
| --- | --- |
| `?tab=historical` | the map (the default) |
| `?tab=historical&theorem=76` | the map with that theorem's proof routes laid over the methods |
| `?tab=historical&method=homology-cohomology` | the map flown to that method, with its note open |
| `?tab=historical&sel=i:analytic` | the map with that island selected (`b:` for a bridge, `v:` a method, `e:` a method pair) |
| `?tab=historical&at=1300,700,3` | the map at a spot: world x, y and zoom (the address updates as you move) |
| `?tab=historical&view=list&entry=76` | the list of curated results at that theorem |
| `?tab=library&source=proofwiki-math&q=pythagoras` | a Library search (without `id`, the best match) |
| `?tab=library&source=proofwiki-math&id=...` | a Library statement (sources: `proofwiki-math`, `Nemotron-Math-Proofs-v2`, `NuminaMath-LEAN-Proof-Artifacts`; `q` searches) |

## Project layout

| Path | What it holds |
| --- | --- |
| `src/App.tsx` | The shell: Explore and Library sections, the lazy-loaded library index |
| `src/Library.tsx` | The three-source library: search, one statement at a time, human vs prover proofs |
| `src/HistoricalResults.tsx` | The curated list, and the entry to the map (drawn into the page body, with the rest of the page made inert while it is open) |
| `src/ErrorBoundary.tsx` | A fallback instead of a blank page when the map fails to load |
| `src/WorldMap.tsx` | The map component: camera, interaction, selection, search, theorem view, the rising sea |
| `src/worldLayout.ts` | Islands, bridges, chords and sub-domain names built from the data |
| `src/worldTerrain.ts` | The terrain of one island: contours, rivers, trees, landmarks, flood levels |
| `src/worldLabels.ts` | Where each method's name goes at each zoom level |
| `src/worldTheme.ts`, `src/worldShared.ts`, `src/WorldLand.tsx`, `src/WorldRibbon.tsx` | Theme, geometry helpers, the static land layer, the banner |
| `src/methodShared.tsx` | The method vocabulary model and the shared selection and results panel |
| `scripts/` | Python builders for the static collection, the course catalogue and the map data |
| `data/collection/` | Curated catalogue, technique vocabulary, route tags and the frozen layouts |

## Maintaining the map data

`technique-vocabulary.json` assigns every technique to a family (an island), a group (a sub-domain) and a symbol. After changing a family or group, regenerate the frozen layouts, then commit them so the map stays stable between builds:

```sh
npm run build:ring-order   # technique order
npm run build:world        # island and method positions (about a minute: it searches for a layout with few bridge crossings)
```

## Deployment

The `Deploy Proofscape to GitHub Pages` workflow builds the static record assets and deploys `dist/`. The repository uses the `/proofscape/` Vite base path for the project Pages URL. Enable Pages with **GitHub Actions** as the build and deployment source.

## Research notes

- [`data/collection/PROOF_DIVERSITY_STUDY.md`](data/collection/PROOF_DIVERSITY_STUDY.md) proposes a study protocol that keeps proof acceptance, strategy relation, and preference as separate questions.
- [`data/collection/featured-results.json`](data/collection/featured-results.json) is a curation file for future study design; those labels are not used as ground truth in the explorer.
