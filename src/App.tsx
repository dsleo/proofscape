import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, Search } from 'lucide-react'
import { MathText } from './MathText'
import { loadIndex, loadRecord, type CollectionIndex, type FormalProof, type InformalProof, type InformalRecord, type Item, type Kind, type RecordDetail } from './collection'
import type { ReactNode } from 'react'

const names: Record<string, string> = {
  'proofwiki-math': 'ProofWiki',
  'Nemotron-Math-Proofs-v2': 'Nemotron',
  'NuminaMath-LEAN-Proof-Artifacts': 'NuminaMath Lean',
}
const sourcePages: Record<string, string> = {
  'proofwiki-math': 'https://huggingface.co/datasets/avewright/proofwiki-math',
  'Nemotron-Math-Proofs-v2': 'https://huggingface.co/datasets/nvidia/Nemotron-Math-Proofs-v2',
  'NuminaMath-LEAN-Proof-Artifacts': 'https://huggingface.co/datasets/iiis-lean/NuminaMath-LEAN-Proof-Artifacts',
}
function sourceName(value: string) { return names[value] ?? value }
function pageFromUrl() { return Math.max(1, Number(new URLSearchParams(window.location.search).get('page')) || 1) }
function initialKind(): Kind { return new URLSearchParams(window.location.search).get('kind') === 'formal' ? 'formal' : 'informal' }
const initialParams = new URLSearchParams(window.location.search)
const initialRecordId = initialParams.get('id')
function errorText(error: unknown) { return error instanceof Error ? error.message : 'The collection could not be loaded.' }
function isInformal(record: RecordDetail): record is InformalRecord { return 'proofs' in record }

function proofLabel(proof: InformalProof) {
  if (proof.method_cluster) return `${proof.method_cluster.id} · ${proof.method_cluster.name}`
  if (proof.content_type === 'proof_summary') return 'Human solution summary'
  if (proof.origin === 'synthetic') return 'Synthetic proof candidate'
  return 'Published proof text'
}

function FormalProofBody({ proof }: { proof: FormalProof }) {
  const code = proof.main_theorem_split_valid && proof.main_theorem_proof_code ? proof.main_theorem_proof_code : proof.code
  return <><p className="collection-proof-note">Source validation: {proof.validation_status}</p><pre><code>{code}</code></pre></>
}

function ProofContent({ record, proofId }: { record: RecordDetail; proofId: string }) {
  if (isInformal(record)) {
    const proof = record.proofs.find((candidate) => candidate.proof_id === proofId)
    if (!proof) return null
    return <>
      {proof.method_cluster && <div className="collection-method-detail"><span>Source method group {proof.method_cluster.id}</span><p>{proof.method_cluster.defining_approach}</p>{proof.method_fingerprint?.primary_approach && <p><strong>Approach:</strong> {proof.method_fingerprint.primary_approach}</p>}</div>}
      <div className="collection-proof-text"><MathText text={proof.text} /></div>
      {proof.source_url && <a className="collection-source-link" href={proof.source_url} target="_blank" rel="noreferrer">Original proof <ExternalLink size={13} /></a>}
    </>
  }
  const proof = proofId === 'human' ? record.human_proof : record.prover_proof
  return <FormalProofBody proof={proof} />
}

function proofIds(record: RecordDetail) {
  return isInformal(record) ? record.proofs.map((proof) => proof.proof_id) : ['human', 'prover']
}
function proofTitle(record: RecordDetail, proofId: string, index: number) {
  if (!isInformal(record)) return proofId === 'human' ? 'Human Lean proof' : 'Prover Lean proof'
  return proofLabel(record.proofs[index])
}
function proofOrigin(record: RecordDetail, proofId: string) {
  if (!isInformal(record)) return proofId === 'human' ? 'Human' : 'Automated prover'
  const proof = record.proofs.find((candidate) => candidate.proof_id === proofId)
  return proof?.origin === 'synthetic' ? 'Synthetic candidate' : proof?.origin === 'human' ? 'Human' : sourceName(record.dataset)
}

function ProofDisclosure({ id, number, label, openProof, setOpenProof, selected, onCompare, compareDisabled, children }: {
  id: string; number: number; label: string; openProof: string | null; setOpenProof: (value: string | null) => void
  selected: boolean; onCompare: (id: string) => void; compareDisabled: boolean; children: ReactNode
}) {
  const open = openProof === id
  return <div className="collection-proof-row">
    <section className="collection-proof">
      <button type="button" className="collection-proof-toggle" aria-expanded={open} onClick={() => setOpenProof(open ? null : id)}>
        <span className="collection-proof-number">{String(number).padStart(2, '0')}</span><span>{label}</span><ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && <div className="collection-proof-body">{children}</div>}
    </section>
    <button type="button" className="collection-compare-select" aria-pressed={selected} disabled={compareDisabled} onClick={() => onCompare(id)}>{selected ? 'Selected' : 'Compare'}</button>
  </div>
}

function StatementProofs({ record, openProof, setOpenProof, selectedProofs, onToggleCompare }: {
  record: RecordDetail; openProof: string | null; setOpenProof: (value: string | null) => void
  selectedProofs: string[]; onToggleCompare: (id: string) => void
}) {
  const ids = proofIds(record)
  const labels = new Map(ids.map((id, index) => [id, proofTitle(record, id, index)]))
  const comparisonReady = selectedProofs.length === 2
  return <section className="collection-expanded" aria-label="Proof artifacts">
    {isInformal(record) && record.answer && <p className="collection-answer"><span>Answer</span>{record.answer}</p>}
    <div className="collection-proofs-heading"><span>Proof artifacts</span><span>{ids.length} {ids.length === 1 ? 'record' : 'records'}</span></div>
    {!comparisonReady && <p className="collection-compare-help">Select two artifacts to read them side by side. Comparison is limited to proofs grouped under this source record.</p>}
    {comparisonReady && <div className="collection-compare-grid" aria-label="Side-by-side proof comparison">
      {selectedProofs.map((id) => <article className="collection-compare-panel" key={id}>
        <header><strong>{labels.get(id)}</strong><span>{proofOrigin(record, id)}</span></header>
        <div className="collection-compare-content"><ProofContent record={record} proofId={id} /></div>
      </article>)}
    </div>}
    <div className="collection-proof-list">
      {ids.map((id, index) => <ProofDisclosure key={id} id={id} number={index + 1} label={labels.get(id) ?? 'Proof'} openProof={openProof} setOpenProof={setOpenProof} selected={selectedProofs.includes(id)} onCompare={onToggleCompare} compareDisabled={selectedProofs.length === 2 && !selectedProofs.includes(id)}>
        <ProofContent record={record} proofId={id} />
      </ProofDisclosure>)}
    </div>
  </section>
}

function writeUrl(kind: Kind, page: number, query: string, id?: string | null, compare: string[] = [], proof?: string | null) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('kind', kind)
  url.searchParams.set('page', String(page))
  if (query.trim()) url.searchParams.set('q', query.trim())
  if (id) url.searchParams.set('id', id)
  compare.slice(0, 2).forEach((proofId) => url.searchParams.append('compare', proofId))
  if (proof) url.searchParams.set('proof', proof)
  window.history.replaceState(null, '', url)
}

export default function DatasetExplorer() {
  const [index, setIndex] = useState<CollectionIndex | null>(null)
  const [indexError, setIndexError] = useState('')
  const [kind, setKind] = useState<Kind>(initialKind)
  const [query, setQuery] = useState(new URLSearchParams(window.location.search).get('q') ?? '')
  const [page, setPage] = useState(pageFromUrl)
  const [deepLinkId, setDeepLinkId] = useState(new URLSearchParams(window.location.search).get('id'))
  const [urlReady, setUrlReady] = useState(!initialRecordId)
  const [record, setRecord] = useState<RecordDetail | null>(null)
  const [recordError, setRecordError] = useState('')
  const [openProof, setOpenProof] = useState<string | null>(null)
  const [selectedProofs, setSelectedProofs] = useState<string[]>([])
  const pendingDeepLink = useRef({ id: initialRecordId, compare: initialParams.getAll('compare').slice(0, 2), proof: initialParams.get('proof') })

  useEffect(() => { document.title = 'Proofscape — explore mathematical proofs' }, [])
  useEffect(() => { loadIndex().then(setIndex).catch((error) => setIndexError(errorText(error))) }, [])

  useEffect(() => {
    if (!index || !deepLinkId) return
    const target = index.items.find((item) => item.id === deepLinkId)
    const position = index.position[deepLinkId]
    if (!target || !position) { setIndexError('This proof record is not part of the public collection.'); setDeepLinkId(null); setUrlReady(true); return }
    setKind(target.kind)
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    const filteredPosition = index.items.filter((candidate) => candidate.kind === target.kind && terms.every((term) => `${candidate.statement} ${candidate.title ?? ''} ${candidate.source_id ?? ''}`.toLocaleLowerCase().includes(term))).findIndex((candidate) => candidate.id === target.id)
    if (filteredPosition >= 0) setPage(filteredPosition + 1)
    else {
      setQuery('')
      setPage(index.items.filter((candidate) => candidate.kind === target.kind).findIndex((candidate) => candidate.id === target.id) + 1)
    }
    setDeepLinkId(null)
  }, [index, deepLinkId, query])

  const visibleItems = useMemo(() => {
    if (!index) return []
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return index.items.filter((item) => item.kind === kind && terms.every((term) => `${item.statement} ${item.title ?? ''} ${item.source_id ?? ''}`.toLocaleLowerCase().includes(term)))
  }, [index, kind, query])
  const totalPages = visibleItems.length
  const item: Item | null = visibleItems[page - 1] ?? null

  useEffect(() => {
    if (!item) { setRecord(null); return }
    const controller = new AbortController()
    setRecord(null); setRecordError(''); setOpenProof(null); setSelectedProofs([])
    loadRecord(item.record_file, controller.signal).then((loaded) => {
      if (controller.signal.aborted) return
      setRecord(loaded)
      const pending = pendingDeepLink.current
      if (pending.id === item.id) {
        const validIds = new Set(proofIds(loaded))
        const compare = [...new Set(pending.compare)].filter((proofId) => validIds.has(proofId)).slice(0, 2)
        const proof = pending.proof && validIds.has(pending.proof) ? pending.proof : null
        setSelectedProofs(compare)
        setOpenProof(proof)
        pendingDeepLink.current = { id: null, compare: [], proof: null }
        setUrlReady(true)
      }
    }).catch((error) => { if (!controller.signal.aborted) { setRecordError(errorText(error)); if (pendingDeepLink.current.id === item.id) setUrlReady(true) } })
    return () => controller.abort()
  }, [item?.id])

  useEffect(() => { if (urlReady) writeUrl(kind, page, query, item?.id ?? deepLinkId, selectedProofs, openProof) }, [kind, page, query, item?.id, deepLinkId, selectedProofs, openProof, urlReady])

  const informalCount = index?.sources.filter((source) => source.kind === 'informal').reduce((sum, source) => sum + source.count, 0) ?? 0
  const formalCount = index?.sources.filter((source) => source.kind === 'formal').reduce((sum, source) => sum + source.count, 0) ?? 0

  function changeKind(next: Kind) { setKind(next); setPage(1); setOpenProof(null); setSelectedProofs([]) }
  function toggleCompare(id: string) {
    setSelectedProofs((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 2 ? [...current, id] : current)
  }
  function resetSearch() { setPage(1); setOpenProof(null); setSelectedProofs([]) }

  return <div className="dataset-page">
    <header className="proofscape-header"><a className="proofscape-brand" href={`${import.meta.env.BASE_URL}`} aria-label="Proofscape home"><img className="proofscape-mark" src={`${import.meta.env.BASE_URL}proofscape-mark.svg`} alt="" /><strong>Proofscape</strong></a></header>
    <main className="collection-main">
      <header className="collection-intro"><h1>Explore proofs</h1><p className="collection-intro-copy">Proofscape is a collection for exploring proof diversity: how different arguments approach the same mathematical statement. Browse records from <a href={sourcePages['proofwiki-math']} target="_blank" rel="noreferrer">ProofWiki Math</a>, <a href={sourcePages['Nemotron-Math-Proofs-v2']} target="_blank" rel="noreferrer">Nemotron Math Proofs v2</a>, and <a href={sourcePages['NuminaMath-LEAN-Proof-Artifacts']} target="_blank" rel="noreferrer">NuminaMath Lean Proof Artifacts</a>.</p></header>

      <nav className="proof-track-tabs" role="tablist" aria-label="Proof type">
        <button id="informal-tab" type="button" className="proof-track-tab" role="tab" aria-selected={kind === 'informal'} aria-controls="collection-results" onClick={() => changeKind('informal')}>Informal <span>{informalCount.toLocaleString()}</span></button>
        <button id="formal-tab" type="button" className="proof-track-tab" role="tab" aria-selected={kind === 'formal'} aria-controls="collection-results" onClick={() => changeKind('formal')}>Formal <span>{formalCount.toLocaleString()}</span></button>
      </nav>

      <section className="collection-controls" aria-label="Search the collection">
        <div className="proof-filter-row">
          <label className="collection-search"><Search size={17} /><span className="sr-only">Search statements</span><input value={query} onChange={(event) => { resetSearch(); setQuery(event.target.value) }} placeholder={kind === 'formal' ? 'Search statements or Lean problem text…' : 'Search theorem statements and source titles…'} /></label>
        </div>
      </section>

      {indexError && <div className="collection-offline" role="alert"><strong>Collection unavailable.</strong> {indexError}</div>}
      <nav className="collection-pagination collection-pagination-top" aria-label="Browse statements"><button type="button" aria-label="Previous statement" disabled={page <= 1 || !index} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedProofs([]) }}>←</button><span>{index ? (totalPages ? `${page.toLocaleString()} / ${totalPages.toLocaleString()}` : 'No matches') : 'Loading collection…'}</span><button type="button" aria-label="Next statement" disabled={page >= totalPages || !index} onClick={() => { setPage((value) => Math.min(totalPages, value + 1)); setSelectedProofs([]) }}>→</button></nav>

      <section id="collection-results" className="collection-list" aria-label={`${kind} proof records`} role="tabpanel" aria-labelledby={kind === 'informal' ? 'informal-tab' : 'formal-tab'} aria-live="polite">
        {item && <article className="collection-item">
          <div className="collection-item-meta"><span>{sourceName(item.dataset)}</span><span>{item.n_proofs} {item.n_proofs === 1 ? 'proof' : 'proofs'}</span></div>
          {item.title && <p className="collection-item-title">{item.title}</p>}
          <div className="collection-statement"><MathText text={item.statement} /></div>
          {recordError && <div className="collection-offline" role="alert">{recordError}</div>}
          {!record && !recordError && <div className="collection-loading" role="status">Loading proof artifacts…</div>}
          {record && <>
            {!isInformal(record) && <div className="collection-formal-statement"><h2>Formalized statement</h2><pre><code>{record.formal_statement}</code></pre></div>}
            <StatementProofs record={record} openProof={openProof} setOpenProof={setOpenProof} selectedProofs={selectedProofs} onToggleCompare={toggleCompare} />
            <div className="collection-provenance"><span>Source ID: <code>{record.source_id}</code></span><a href={sourcePages[record.dataset]} target="_blank" rel="noreferrer">Source dataset <ExternalLink size={12} /></a></div>
          </>}
        </article>}
        {index && !item && <div className="collection-empty">No records found. Try a shorter search or choose another source.</div>}
      </section>

      {item && <nav className="collection-pagination" aria-label="Browse statements after reading"><button type="button" aria-label="Previous statement" disabled={page <= 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedProofs([]) }}>←</button><span>{page.toLocaleString()} / {totalPages.toLocaleString()}</span><button type="button" aria-label="Next statement" disabled={page >= totalPages} onClick={() => { setPage((value) => Math.min(totalPages, value + 1)); setSelectedProofs([]) }}>→</button></nav>}

    </main>
    <footer className="proofscape-footer"><a href="https://github.com/dsleo/proofscape">Source and dataset notes</a></footer>
  </div>
}
