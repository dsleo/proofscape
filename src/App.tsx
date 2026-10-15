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
  const [index, setIndex] = useState<CollectionIndex | null>(null)
  const [indexError, setIndexError] = useState('')

  useEffect(() => { document.title = 'Proofscape — explore how proofs differ' }, [])
  // the library index is large: fetch it only when the library is opened (or about to be)
  const [wantIndex, setWantIndex] = useState(tab === 'library')
  useEffect(() => {
    if (wantIndex) loadIndex().then(setIndex).catch((error) => setIndexError(errorText(error)))
  }, [wantIndex])

  function go(next: Tab) {
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('tab', next === 'explore' ? 'historical' : 'library')
    window.history.replaceState(null, '', url)
    setTab(next)
    if (next === 'library') setWantIndex(true)
    window.scrollTo({ top: 0 })
  }

  return <div className="dataset-page">
    <header className="proofscape-header"><a className="proofscape-brand" href={`${import.meta.env.BASE_URL}`} aria-label="Proofscape home"><img className="proofscape-mark" src={`${import.meta.env.BASE_URL}proofscape-mark.svg`} alt="" /><strong>Proofscape</strong></a></header>
    <main className="collection-main">
      <header className="collection-intro">
        <h1>{tab === 'explore' ? 'How do different proofs reach the same theorem?' : 'Proof Diversity Explorer'}</h1>
        <p className="collection-intro-copy">{tab === 'explore'
          ? 'A curated set of 150 results from the mathematics curriculum, each with its distinct proof approaches, mapped by the methods they use.'
          : 'One statement, many routes. Nearly ten thousand statements from three public datasets, each with the proofs written for it: read them side by side and watch different approaches arrive at the same result.'}</p>
      </header>

      <nav className="proof-track-tabs" role="tablist" aria-label="Section">
        <button id="explore-tab" type="button" className="proof-track-tab" role="tab" aria-selected={tab === 'explore'} aria-controls="collection-results" onClick={() => go('explore')}>Explore <span>150 curated results</span></button>
        <button id="library-tab" type="button" className="proof-track-tab" role="tab" aria-selected={tab === 'library'} aria-controls="collection-results" onClick={() => go('library')} onPointerEnter={() => setWantIndex(true)} onFocus={() => setWantIndex(true)}>Library <span>3 datasets</span></button>
      </nav>

      <div id="collection-results" role="tabpanel" aria-labelledby={tab === 'explore' ? 'explore-tab' : 'library-tab'}>
        {tab === 'explore' ? <HistoricalResults onOpenLibrary={() => go('library')} /> : <Library index={index} indexError={indexError} />}
      </div>
    </main>
    <footer className="proofscape-footer"><a href="https://github.com/dsleo/proofscape">Source and dataset notes</a></footer>
  </div>
}
