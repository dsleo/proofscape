import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { MathText } from './MathText'
import MethodRing from './MethodRing'
import WorldMap from './WorldMap'
import { displayRouteTitle, displayTitle, primaryReference, ProofExcerpt, ProofMathText, RelatedSourceLinks, SourceCitation } from './historicalShared'
import type { Catalog, Entry } from './historicalShared'

const catalogUrl = `${import.meta.env.BASE_URL}data/collection/historical-proof-catalog.json`
const fieldOptions = ['Algebra', 'Analysis', 'Combinatorics', 'Geometry', 'Logic & foundations', 'Number theory', 'Probability', 'Topology']
const levelOptions = ['School', 'Undergraduate', 'Graduate']

function levelMatches(entry: Entry, selected: string) {
  const text = entry.level.toLowerCase()
  if (!selected) return true
  return selected === 'School' ? text.includes('school') : selected === 'Undergraduate' ? text.includes('undergraduate') : text.includes('graduate')
}


export default function HistoricalResults() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [field, setField] = useState('')
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'world' | 'ring'>(() => { const value = new URLSearchParams(window.location.search).get('view'); return value === 'ring' || value === 'world' ? value : 'list' })
  const pendingPage = useRef<number | null>(null)

  useEffect(() => {
    document.title = 'Historical results — Proofscape'
    fetch(catalogUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Historical catalog request failed (${response.status}).`)
      return response.json() as Promise<Catalog>
    }).then(setCatalog).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The historical catalog could not be loaded.'))
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

  useEffect(() => {
    const url = new URL(window.location.href)
    if (view !== 'list') url.searchParams.set('view', view)
    else { url.searchParams.delete('view'); url.searchParams.delete('sel') }
    window.history.replaceState(null, '', url)
  }, [view])

  function clearFilters() { setQuery(''); setField(''); setLevel('') }

  function openEntry(id: number) {
    const index = catalog?.entries.findIndex((entry) => entry.id === id) ?? -1
    if (index < 0) return
    pendingPage.current = query || field || level ? index + 1 : null
    clearFilters()
    setPage(index + 1)
    setView('list')
  }

  return <section className="historical-view" id="collection-results" role="tabpanel" aria-labelledby="historical-tab" aria-label="Historical results with multiple proof approaches">
    <header className="historical-intro">
      <p className="historical-eyebrow">CURATED RESEARCH INDEX · {catalog?.entryCount ?? '—'} RESULTS · {catalog?.approachRecordCount ?? '—'} APPROACHES</p>
      <h1>Course-level results, different ways in.</h1>
      <p>This catalog collects central results taught from secondary school through graduate courses and records distinct proof approaches. It excludes contest problems and isolated exercises.</p>
    </header>

    <div className="historical-viewswitch" role="group" aria-label="Course results view">
      <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
      <button type="button" aria-pressed={view === 'world'} onClick={() => setView('world')}>World</button>
      <button type="button" aria-pressed={view === 'ring'} onClick={() => setView('ring')}>Ring</button>
    </div>

    {view !== 'list' ? (catalog ? (view === 'world' ? <WorldMap catalog={catalog} onOpenEntry={openEntry} /> : <MethodRing catalog={catalog} onOpenEntry={openEntry} />) : error ? <div className="collection-offline" role="alert">The historical results are unavailable. {error}</div> : null) : <>
    <div className="historical-controls" aria-label="Search and filter historical results">
      <label className="historical-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search theorem, field, approach, or source</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a result, approach, or source…" /></label>
      <label><span>Field</span><select value={field} onChange={(event) => setField(event.target.value)}><option value="">All fields</option>{fieldOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label><span>Course level</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">All levels</option>{levelOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    </div>

    {(query || field || level) && <div className="historical-count" aria-live="polite"><span>{filtered.length} matching results</span><button type="button" onClick={clearFilters}>Clear filters</button></div>}

    {error ? <div className="collection-offline" role="alert">The historical results are unavailable. {error}</div> : <div className="historical-list">
      {filtered.slice(page - 1, page).map((entry) => <article className="historical-entry" key={entry.id}>
        <div className="historical-entry-number">{String(entry.id).padStart(3, '0')}</div>
        <div className="historical-entry-main">
          <header><h2><MathText text={displayTitle(entry)} /></h2></header>
          <div className="historical-statement"><span className="historical-statement-label">Statement</span><MathText text={entry.statement} /></div>
          <details className="historical-approaches">
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

    {catalog && filtered.length > 0 && <nav className="historical-pagination" aria-label="Historical results pagination"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>← Previous</button><span>{page} / {filtered.length}</span><button type="button" onClick={() => setPage((current) => Math.min(filtered.length, current + 1))} disabled={page >= filtered.length}>Next →</button></nav>}
    </>}
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
