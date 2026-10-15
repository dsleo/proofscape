import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ExternalLink, Search } from 'lucide-react'
import { MathText } from './MathText'
import { loadRecord, type CollectionIndex, type FormalProof, type FormalRecord, type InformalProof, type InformalRecord, type Item, type RecordDetail } from './collection'
import './library.css'

type SourceId = 'proofwiki-math' | 'Nemotron-Math-Proofs-v2' | 'NuminaMath-LEAN-Proof-Artifacts'

// What each corpus really is, said where a reader chooses between them.
const sources: { id: SourceId; label: string; badge: string; blurb: string; url: string }[] = [
  { id: 'proofwiki-math', label: 'ProofWiki', badge: 'Written by people', url: 'https://huggingface.co/datasets/avewright/proofwiki-math',
    blurb: 'Theorems and the proofs contributors wrote for them on ProofWiki. Several proofs of one statement are often genuinely different arguments.' },
  { id: 'Nemotron-Math-Proofs-v2', label: 'Nemotron', badge: 'AI-generated', url: 'https://huggingface.co/datasets/nvidia/Nemotron-Math-Proofs-v2',
    blurb: 'Competition-style problems with proofs written by a single language model (DeepSeek-V4-Pro). Proofs of one problem are samples from the same model, so they tend to take the same route.' },
  { id: 'NuminaMath-LEAN-Proof-Artifacts', label: 'Lean', badge: 'Formal', url: 'https://huggingface.co/datasets/iiis-lean/NuminaMath-LEAN-Proof-Artifacts',
    blurb: 'Statements formalised in Lean 4, each with a proof written by a person and a proof found by an automated prover, side by side.' },
]
const PAGE = 40
const proofFilters = [['', 'Any number of proofs'], ['2', 'Exactly 2'], ['3', 'Exactly 3'], ['4', 'Exactly 4'], ['5', '5 or more']] as const

const params = () => new URLSearchParams(window.location.search)
const isInformal = (record: RecordDetail): record is InformalRecord => 'proofs' in record
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'The record could not be loaded.')
const sourceOf = (id: string | null) => sources.find((s) => s.id === id)
function startSource(): SourceId {
  const p = params()
  if (sourceOf(p.get('source'))) return p.get('source') as SourceId
  return p.get('kind') === 'formal' ? 'NuminaMath-LEAN-Proof-Artifacts' : 'proofwiki-math'
}

function proofLabel(proof: InformalProof) {
  if (proof.method_cluster) return `${proof.method_cluster.id} · ${proof.method_cluster.name}`
  if (proof.content_type === 'proof_summary') return 'Human solution summary'
  if (proof.origin === 'synthetic') return 'Model-written proof'
  return 'Published proof'
}

function ProofContent({ record, proofId }: { record: InformalRecord; proofId: string }) {
  const proof = record.proofs.find((candidate) => candidate.proof_id === proofId)
  if (!proof) return null
  return <>
    {proof.method_cluster && <div className="collection-method-detail"><span>Source method group {proof.method_cluster.id}</span><p>{proof.method_cluster.defining_approach}</p></div>}
    <div className="collection-proof-text"><MathText text={proof.text} /></div>
    {proof.source_url && <a className="collection-source-link" href={proof.source_url} target="_blank" rel="noreferrer">Original proof <ExternalLink size={13} /></a>}
  </>
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

function InformalProofs({ record, openProof, setOpenProof, selected, onToggle, similar }: {
  record: InformalRecord; openProof: string | null; setOpenProof: (value: string | null) => void; selected: string[]; onToggle: (id: string) => void; similar: number
}) {
  const ready = selected.length === 2
  const label = (id: string) => proofLabel(record.proofs.find((p) => p.proof_id === id)!)
  return <section className="collection-expanded" aria-label="Proofs">
    {record.answer && <p className="collection-answer"><span>Answer</span>{record.answer}</p>}
    <div className="collection-proofs-heading"><span>{record.proofs.length} {record.proofs.length === 1 ? 'proof' : 'proofs'}</span>{similar > 0 && <span className="library-flag">{similar} pair{similar === 1 ? '' : 's'} nearly word-for-word identical</span>}</div>
    {!ready && <p className="collection-compare-help">Select two proofs to read them side by side.</p>}
    {ready && <div className="collection-compare-grid" aria-label="Side-by-side proof comparison">
      {selected.map((id) => <article className="collection-compare-panel" key={id}>
        <header><strong>{label(id)}</strong><span>{record.proofs.find((p) => p.proof_id === id)?.origin === 'synthetic' ? 'Model' : 'Person'}</span></header>
        <div className="collection-compare-content"><ProofContent record={record} proofId={id} /></div>
      </article>)}
    </div>}
    <div className="collection-proof-list">
      {record.proofs.map((proof, index) => <ProofDisclosure key={proof.proof_id} id={proof.proof_id} number={index + 1} label={proofLabel(proof)} openProof={openProof} setOpenProof={setOpenProof}
        selected={selected.includes(proof.proof_id)} onCompare={onToggle} compareDisabled={selected.length === 2 && !selected.includes(proof.proof_id)}>
        <ProofContent record={record} proofId={proof.proof_id} />
      </ProofDisclosure>)}
    </div>
  </section>
}

function codeOf(proof: FormalProof) { return proof.main_theorem_split_valid && proof.main_theorem_proof_code ? proof.main_theorem_proof_code : proof.code }

/** A Lean statement with its two proofs side by side: the person's and the prover's. */
function FormalDuel({ record }: { record: FormalRecord }) {
  const cols = [{ title: 'Written by a person', proof: record.human_proof }, { title: 'Found by an automated prover', proof: record.prover_proof }]
  return <section className="collection-expanded" aria-label="Human and automated proofs">
    <div className="collection-formal-statement"><h2>Formalized statement</h2><pre><code>{record.formal_statement}</code></pre></div>
    <div className="library-duel">
      {cols.map(({ title, proof }) => {
        const code = codeOf(proof), lines = code.split('\n').filter((l) => l.trim()).length
        return <article key={title} className="library-duel-col">
          <header><strong>{title}</strong><span>{lines} line{lines === 1 ? '' : 's'} · {code.length.toLocaleString()} characters</span><em>Validation: {proof.validation_status}</em></header>
          <pre><code>{code}</code></pre>
        </article>
      })}
    </div>
  </section>
}

function writeUrl(state: { source: SourceId; query: string; proofs: string; distinct: boolean; id: string | null; compare: string[]; proof: string | null }) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('tab', 'library')
  url.searchParams.set('source', state.source)
  if (state.query.trim()) url.searchParams.set('q', state.query.trim())
  if (state.proofs) url.searchParams.set('n', state.proofs)
  if (state.distinct) url.searchParams.set('distinct', '1')
  if (state.id) url.searchParams.set('id', state.id)
  state.compare.slice(0, 2).forEach((p) => url.searchParams.append('compare', p))
  if (state.proof) url.searchParams.set('proof', state.proof)
  window.history.replaceState(null, '', url)
}

export default function Library({ index, indexError }: { index: CollectionIndex | null; indexError: string }) {
  const start = useRef(params())
  const [source, setSource] = useState<SourceId>(startSource)
  const [query, setQuery] = useState(start.current.get('q') ?? '')
  const [proofs, setProofs] = useState(start.current.get('n') ?? '')
  const [distinct, setDistinct] = useState(start.current.get('distinct') === '1')
  const [id, setId] = useState<string | null>(start.current.get('id'))
  const [shown, setShown] = useState(PAGE)
  const [record, setRecord] = useState<RecordDetail | null>(null)
  const [recordError, setRecordError] = useState('')
  const [openProof, setOpenProof] = useState<string | null>(start.current.get('proof'))
  const [selected, setSelected] = useState<string[]>(start.current.getAll('compare').slice(0, 2))

  const counts = useMemo(() => new Map(index?.sources.map((s) => [s.dataset, s.count]) ?? []), [index])
  const meta = sourceOf(source)!

  // an old link names only a record: find its source
  useEffect(() => {
    if (!index || !id) return
    const item = index.items.find((candidate) => candidate.id === id)
    if (item && sourceOf(item.dataset) && item.dataset !== source) setSource(item.dataset as SourceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const filtered = useMemo(() => {
    if (!index) return []
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return index.items.filter((item) => {
      if (item.dataset !== source) return false
      if (proofs === '5' ? item.n_proofs < 5 : proofs && item.n_proofs !== Number(proofs)) return false
      if (distinct && item.similar > 0) return false
      const text = `${item.title ?? ''} ${item.statement} ${(item.categories ?? []).join(' ')} ${item.source_id ?? ''}`.toLocaleLowerCase()
      return terms.every((term) => text.includes(term))
    })
  }, [index, source, query, proofs, distinct])

  const position = id ? filtered.findIndex((item) => item.id === id) : -1
  const current: Item | null = position >= 0 ? filtered[position] : index?.items.find((item) => item.id === id) ?? null

  useEffect(() => {
    if (!current) { setRecord(null); return }
    const controller = new AbortController()
    setRecord(null); setRecordError('')
    loadRecord(current.record_file, controller.signal).then((loaded) => { if (!controller.signal.aborted) setRecord(loaded) })
      .catch((error) => { if (!controller.signal.aborted) setRecordError(errorText(error)) })
    return () => controller.abort()
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { writeUrl({ source, query, proofs, distinct, id, compare: selected, proof: openProof }) }, [source, query, proofs, distinct, id, selected, openProof])

  function open(next: string | null) { setId(next); setOpenProof(null); setSelected([]); window.scrollTo({ top: 0 }) }
  function choose(next: SourceId) { setSource(next); setId(null); setShown(PAGE); setProofs(''); setDistinct(false); setOpenProof(null); setSelected([]) }
  const toggle = (proofId: string) => setSelected((c) => c.includes(proofId) ? c.filter((v) => v !== proofId) : c.length < 2 ? [...c, proofId] : c)

  return <div className="library">
    <div className="library-sources" role="tablist" aria-label="Library source">
      {sources.map((s) => <button type="button" key={s.id} role="tab" aria-selected={s.id === source} onClick={() => choose(s.id)}>
        <strong>{s.label}</strong><em>{s.badge}</em><span>{(counts.get(s.id) ?? 0).toLocaleString()}</span>
      </button>)}
    </div>
    <p className="library-blurb">{meta.blurb} <a href={meta.url} target="_blank" rel="noreferrer">Dataset <ExternalLink size={12} /></a></p>
    {indexError && <div className="collection-offline" role="alert"><strong>Library unavailable.</strong> {indexError}</div>}

    {!current && <>
      <div className="library-filters">
        <label className="collection-search"><Search size={17} /><span className="sr-only">Search statements</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setShown(PAGE) }} placeholder={source === 'proofwiki-math' ? 'Search statements, titles and ProofWiki categories…' : 'Search statements…'} /></label>
        {source !== 'NuminaMath-LEAN-Proof-Artifacts' && <>
          <label className="library-select"><span className="sr-only">Number of proofs</span>
            <select value={proofs} onChange={(event) => { setProofs(event.target.value); setShown(PAGE) }}>{proofFilters.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
          <label className="library-check"><input type="checkbox" checked={distinct} onChange={(event) => { setDistinct(event.target.checked); setShown(PAGE) }} /> Hide statements with near-identical proofs</label>
        </>}
      </div>
      <p className="library-count" aria-live="polite">{index ? `${filtered.length.toLocaleString()} statement${filtered.length === 1 ? '' : 's'}` : 'Loading…'}</p>
      <ol className="library-list">
        {filtered.slice(0, shown).map((item) => <li key={item.id}>
          <button type="button" onClick={() => open(item.id)}>
            <span className="library-row-head">{item.title && <strong>{item.title}</strong>}</span>
            <span className="library-row-statement"><MathText text={item.statement} /></span>
            <span className="library-row-meta">
              {item.dataset !== 'NuminaMath-LEAN-Proof-Artifacts' && <span>{item.n_proofs} proofs</span>}
              {item.dataset === 'NuminaMath-LEAN-Proof-Artifacts' && <span>human + prover proof</span>}
              {item.similar > 0 && <span className="library-flag">near-identical proofs</span>}
              {(item.categories ?? []).slice(0, 2).map((c) => <span key={c} className="library-tag">{c}</span>)}
            </span>
          </button>
        </li>)}
      </ol>
      {index && filtered.length === 0 && <div className="collection-empty">No statements match. Loosen the search or the filters.</div>}
      {shown < filtered.length && <button type="button" className="library-more" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} more</button>}
    </>}

    {current && <article className="collection-item">
      <div className="library-detail-nav">
        <button type="button" onClick={() => open(null)}>← Back to the list</button>
        {position >= 0 && <span><button type="button" aria-label="Previous statement" disabled={position <= 0} onClick={() => open(filtered[position - 1].id)}>←</button> {position + 1} / {filtered.length.toLocaleString()} <button type="button" aria-label="Next statement" disabled={position >= filtered.length - 1} onClick={() => open(filtered[position + 1].id)}>→</button></span>}
      </div>
      <div className="collection-item-meta"><span>{sourceOf(current.dataset)?.label} · {sourceOf(current.dataset)?.badge}</span><span>{current.n_proofs} {current.n_proofs === 1 ? 'proof' : 'proofs'}</span></div>
      {current.title && <p className="collection-item-title">{current.title}</p>}
      <div className="collection-statement"><MathText text={record ? (isInformal(record) ? record.statement : record.problem) : current.statement} /></div>
      {recordError && <div className="collection-offline" role="alert">{recordError}</div>}
      {!record && !recordError && <div className="collection-loading" role="status">Loading proofs…</div>}
      {record && (isInformal(record)
        ? <InformalProofs record={record} openProof={openProof} setOpenProof={setOpenProof} selected={selected} onToggle={toggle} similar={current.similar} />
        : <FormalDuel record={record} />)}
      {record && <div className="collection-provenance"><span>Source ID: <code>{record.source_id}</code></span>{isInformal(record) && record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer">Original <ExternalLink size={12} /></a>}</div>}
    </article>}
  </div>
}
