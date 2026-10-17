import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Search } from 'lucide-react'
import { MathText } from './MathText'
import ErrorBoundary from './ErrorBoundary'
import { cachedJson, dataUrl } from './collection'
// the map carries its own code (terrain generator, selection model): load it when asked for
const loadWorld = () => {
  void cachedJson(dataUrl('constellation.json')).catch(() => undefined) // start the map's data now; the map asks for the same request
  return import('./WorldMap')
}
const WorldMap = lazy(loadWorld)
import { displayRouteTitle, displayTitle, primaryReference, ProofExcerpt, ProofMathText, RelatedSourceLinks, SourceCitation } from './historicalShared'
import type { Catalog, Entry } from './historicalShared'

const catalogUrl = dataUrl('historical-proof-catalog.json')
const fieldOptions = ['Algebra', 'Analysis', 'Combinatorics', 'Geometry', 'Logic & foundations', 'Number theory', 'Probability', 'Topology']
const levelOptions = ['School', 'Undergraduate', 'Graduate']

function levelMatches(entry: Entry, selected: string) {
  const text = entry.level.toLowerCase()
  if (!selected) return true
  return selected === 'School' ? text.includes('school') : selected === 'Undergraduate' ? text.includes('undergraduate') : text.includes('graduate')
}


// shown at once while the map's data and code arrive, so the page behind it is never seen
function MapBoot() { return <div className="world-boot" role="status" aria-live="polite"><span>Loading the map…</span></div> }
function MapNotice({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return <div className="world-boot" role="alert"><span>{children}</span><button type="button" className="world-boot-back" onClick={onBack}>← Results list</button></div>
}

// The map owns the whole window. It is drawn straight into the page body and the rest of the page is made inert,
// so that keyboard focus and screen readers stay on what can be seen.
function MapHost({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    return () => root?.removeAttribute('inert')
  }, [])
  return createPortal(children, document.body)
}

export default function HistoricalResults({ onOpenLibrary }: { onOpenLibrary?: () => void } = {}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [field, setField] = useState('')
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'world'>(() => { const p = new URLSearchParams(window.location.search); return p.get('view') === 'list' || p.has('entry') ? 'list' : 'world' })
  const wantedEntry = useRef(Number(new URLSearchParams(window.location.search).get('entry')) || null)
  const pendingPage = useRef<number | null>(null)
  const [arrivedAt, setArrivedAt] = useState<number | null>(null)

  const touched = useRef(false) // the address names an entry only once the reader has moved, or arrived by a link that did
  useEffect(() => {
    cachedJson<Catalog>(catalogUrl).then(setCatalog).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The historical catalog could not be loaded.'))
  }, [])

  const filtered = useMemo(() => {
    if (!catalog) return []
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return catalog.entries.filter((entry) => {
      if (field && !entry.areas.includes(field)) return false
      if (!levelMatches(entry, level)) return false
      const routeText = entry.routes.map((route) => `${route.title} ${route.proofSketch} ${route.references.map((reference) => `${reference.label} ${reference.sourceLabel} ${reference.locator ?? ''}`).join(' ')}`).join(' ')
      const text = `${entry.name} ${entry.statement} ${entry.level} ${entry.areas.join(' ')} ${routeText}`.toLocaleLowerCase()
      return terms.every((term) => text.includes(term))
    })
  }, [catalog, field, level, query])

  useEffect(() => { setPage(pendingPage.current ?? 1); pendingPage.current = null }, [query, field, level])

  // a link to the entry now showing, so any result can be shared
  const shownId = filtered[page - 1]?.id
  useEffect(() => {
    const entry = filtered[page - 1]
    document.title = view === 'world' ? 'Map of proof methods — Proofscape' : entry ? `${displayTitle(entry).replace(/\$/g, '')} — Proofscape` : 'Proofscape — explore how proofs differ'
  }, [view, filtered, page])
  useEffect(() => {
    if (wantedEntry.current !== null) return
    const url = new URL(window.location.href)
    if (view === 'list') { url.searchParams.set('view', 'list'); ['sel', 'theorem', 'method', 'at'].forEach((name) => url.searchParams.delete(name)); if (shownId !== undefined && touched.current) url.searchParams.set('entry', String(shownId)) }
    else { url.searchParams.delete('view'); url.searchParams.delete('entry') }
    window.history.replaceState(null, '', url)
  }, [view, shownId])

  // opening a link that names an entry: go to it once the catalogue is here
  useEffect(() => {
    if (!catalog || wantedEntry.current === null) return
    const index = catalog.entries.findIndex((entry) => entry.id === wantedEntry.current)
    wantedEntry.current = null
    if (index >= 0) { touched.current = true; setPage(index + 1) }
  }, [catalog])

  function showOnMap(id: number) {
    const url = new URL(window.location.href)
    url.searchParams.set('theorem', String(id))
    url.searchParams.delete('entry'); url.searchParams.delete('at'); url.searchParams.delete('method')
    window.history.replaceState(null, '', url)
    setView('world')
  }

  function clearFilters() { setQuery(''); setField(''); setLevel('') }

  function openEntry(id: number) {
    const index = catalog?.entries.findIndex((entry) => entry.id === id) ?? -1
    if (index < 0) return
    touched.current = true
    pendingPage.current = query || field || level ? index + 1 : null
    clearFilters()
    setPage(index + 1)
    setArrivedAt(id)
    setView('list')
  }

  // arriving from the map: land on the theorem itself, its approaches open, not at the top of the page
  useEffect(() => {
    if (arrivedAt === null || view !== 'list') return
    document.getElementById(`entry-${arrivedAt}`)?.scrollIntoView({ block: 'start' })
  }, [arrivedAt, view, page, catalog])

  if (view === 'world') {
    const back = () => setView('list')
    return <MapHost>
      <ErrorBoundary fallback={<MapNotice onBack={back}>The map could not be loaded.</MapNotice>}>
        {catalog
          ? <Suspense fallback={<MapBoot />}><WorldMap catalog={catalog} onOpenEntry={openEntry} onClose={back} onLibrary={onOpenLibrary} /></Suspense>
          : error ? <MapNotice onBack={back}>The historical results are unavailable. {error}</MapNotice> : <MapBoot />}
      </ErrorBoundary>
    </MapHost>
  }

  const move = (change: (current: number) => number) => { touched.current = true; setPage(change) }
  return <section className="historical-view" aria-label="Course-level results with their proof approaches">
    <header className="historical-intro">
      <p className="historical-eyebrow">{catalog?.entryCount ?? '—'} results · {catalog?.approachRecordCount ?? '—'} approaches</p>
      <p>Central results taught from secondary school through graduate courses, with their distinct proof approaches. Contest problems and isolated exercises are left out.</p>
    </header>

    <div className="historical-viewswitch" role="group" aria-label="Course results view">
      <button type="button" aria-pressed={false} onClick={() => setView('world')} onPointerEnter={() => void loadWorld()} onFocus={() => void loadWorld()}>Show the map</button>
    </div>

    <div className="historical-controls" aria-label="Search and filter historical results">
      <label className="historical-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search theorem, field, approach, or source</span><input value={query} onChange={(event) => { touched.current = true; setQuery(event.target.value) }} placeholder="Search a result, approach, or source…" /></label>
      <label><span>Field</span><select value={field} onChange={(event) => { touched.current = true; setField(event.target.value) }}><option value="">All fields</option>{fieldOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label><span>Course level</span><select value={level} onChange={(event) => { touched.current = true; setLevel(event.target.value) }}><option value="">All levels</option>{levelOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    </div>

    {(query || field || level) && <div className="historical-count" aria-live="polite"><span>{filtered.length} matching results</span><button type="button" onClick={clearFilters}>Clear filters</button></div>}

    {error ? <div className="collection-offline" role="alert">The historical results are unavailable. {error}</div> : <div className="historical-list">
      {filtered.slice(page - 1, page).map((entry) => <article className="historical-entry" key={entry.id} id={`entry-${entry.id}`}>
        <div className="historical-entry-number">{String(entry.id).padStart(3, '0')}</div>
        <div className="historical-entry-main">
          <header><h2><MathText text={displayTitle(entry)} /></h2>
            <p className="historical-links"><a href={`?tab=historical&view=list&entry=${entry.id}`}>Link to this result</a> · <a href={`?tab=historical&theorem=${entry.id}`} onClick={(event) => { event.preventDefault(); showOnMap(entry.id) }}>Its routes on the map</a></p>
          </header>
          <div className="historical-statement"><span className="historical-statement-label">Statement</span><MathText text={entry.statement} /></div>
          <details className="historical-approaches" open={arrivedAt === entry.id || undefined}>
            <summary>Proof approaches ({entry.routes.length})</summary>
            <ol className="historical-routes">{entry.routes.map((route) => <li key={route.id}>
              <details className="historical-approach">
                <summary><ProofMathText text={displayRouteTitle(route)} /></summary>
                <div className="historical-approach-content">
                  <ProofExcerpt route={route} />
                  {primaryReference(route) ? <SourceCitation reference={primaryReference(route)!} /> : <RelatedSourceLinks sourceIds={entry.sourceIds} sources={catalog?.sources ?? {}} />}
                </div>
              </details>
            </li>)}</ol>
          </details>
        </div>
      </article>)}
      {catalog && filtered.length === 0 && <div className="collection-empty">No results match these filters. Try a broader search.</div>}
    </div>}

    {catalog && filtered.length > 0 && <nav className="historical-pagination" aria-label="Historical results pagination"><button type="button" onClick={() => move((current) => Math.max(1, current - 1))} disabled={page <= 1}>← Previous</button><span>{page} / {filtered.length}</span><button type="button" onClick={() => move((current) => Math.min(filtered.length, current + 1))} disabled={page >= filtered.length}>Next →</button></nav>}
    {catalog && <details className="historical-source-register"><summary>Full source register <span>{Object.keys(catalog.sources).length} catalog-wide records</span></summary>
      <p>The full source register is the bibliography for the whole index: theorem sources, books and papers, plus discovery leads such as community discussions and datasets. Not every register item supports a specific approach; direct route citations appear with that approach above.</p>
      {Object.values(catalog.sources).map((source) => <section key={source.id}>
        <h3>{source.id} · {source.label}</h3><p>{source.description}</p>
        {source.references.map((reference) => <article className="historical-reference" key={reference.url}>
          <a href={reference.url} target="_blank" rel="noreferrer">{reference.label} <ExternalLink size={12} aria-hidden="true" /></a>
          {reference.locator && <p className="historical-locator">{reference.locator}</p>}
        </article>)}
      </section>)}
    </details>}
    <p className="historical-sources-note">Approach citations and proof sketches are kept together so each route can be checked against its own source. The source register remains a catalog-wide bibliography and discovery trail.</p>
  </section>
}
