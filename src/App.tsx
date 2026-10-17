import { useEffect, useState } from 'react'
import HistoricalResults from './HistoricalResults'
import Library from './Library'
import './historical.css'
import { loadIndex, type CollectionIndex } from './collection'

type Tab = 'explore' | 'library'

// The map is the front door. An old link that names a record, a kind or a source still lands in the library.
function initialTab(): Tab {
  const p = new URLSearchParams(window.location.search)
  if (p.get('tab') === 'library' || p.has('id') || p.has('kind') || p.has('source')) return p.get('tab') === 'historical' ? 'explore' : 'library'
  return 'explore'
}

function errorText(error: unknown) { return error instanceof Error ? error.message : 'The collection could not be loaded.' }

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [homeKey, setHomeKey] = useState(0)
  const [index, setIndex] = useState<CollectionIndex | null>(null)
  const [indexError, setIndexError] = useState('')

  // the source list is tiny; each source's statements are fetched by the library when it is opened
  useEffect(() => { loadIndex().then(setIndex).catch((error) => setIndexError(errorText(error))) }, [])

  function go(next: Tab) {
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('tab', next === 'explore' ? 'historical' : 'library')
    window.history.replaceState(null, '', url)
    setTab(next)
    if (next === 'explore') setHomeKey((n) => n + 1)
    window.scrollTo({ top: 0 })
  }

  const plainClick = (event: React.MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey
  return <div className="dataset-page">
    <a className="skip-link" href="#content">Skip to the content</a>
    <header className="proofscape-header"><a className="proofscape-brand" href={`${import.meta.env.BASE_URL}`} aria-label="Proofscape home" onClick={(event) => { if (plainClick(event)) { event.preventDefault(); go('explore') } }}><img className="proofscape-mark" src={`${import.meta.env.BASE_URL}proofscape-mark.svg`} alt="" /><strong>Proofscape</strong></a></header>
    <main className="collection-main" id="content">
      <header className="collection-intro">
        <h1>{tab === 'explore' ? 'How do different proofs establish the same theorem?' : 'Proof Diversity Explorer'}</h1>
        <p className="collection-intro-copy">{tab === 'explore'
          ? 'A curated set of 150 results from the mathematics curriculum, each with its distinct proof approaches, mapped by the methods they use.'
          : 'One statement, many routes. Nearly ten thousand statements from three public datasets, each with the proofs written for it: read them side by side and watch different approaches arrive at the same result.'}</p>
      </header>

      <nav className="proof-track-tabs" aria-label="Section">
        <a href="?tab=historical" className="proof-track-tab" aria-current={tab === 'explore' ? 'page' : undefined} onClick={(event) => { if (plainClick(event)) { event.preventDefault(); go('explore') } }}>Explore <span>150 curated results</span></a>
        <a href="?tab=library" className="proof-track-tab" aria-current={tab === 'library' ? 'page' : undefined} onClick={(event) => { if (plainClick(event)) { event.preventDefault(); go('library') } }}>Library <span>3 datasets</span></a>
      </nav>

      {tab === 'explore' ? <HistoricalResults key={homeKey} onOpenLibrary={() => go('library')} /> : <Library index={index} indexError={indexError} />}
    </main>
    <footer className="proofscape-footer"><a href="https://github.com/dsleo/proofscape/issues/new">Send feedback</a><a href="https://github.com/dsleo/proofscape">Source and dataset notes</a></footer>
  </div>
}
