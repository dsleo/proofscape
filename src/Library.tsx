import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ExternalLink, Search, Shuffle } from 'lucide-react'
import { MathText } from './MathText'
import { loadItems, loadRecord, type CollectionIndex, type FormalProof, type FormalRecord, type InformalProof, type InformalRecord, type Item, type RecordDetail } from './collection'
import './library.css'

type SourceId = 'proofwiki-math' | 'Nemotron-Math-Proofs-v2' | 'NuminaMath-LEAN-Proof-Artifacts'

// What each corpus really is, said where a reader chooses between them.
const sources: { id: SourceId; label: string; badge: string; blurb: string; url: string; featured?: string }[] = [
  { id: 'proofwiki-math', label: 'ProofWiki', badge: 'Written by people', featured: "Pythagoras's Theorem", url: 'https://huggingface.co/datasets/avewright/proofwiki-math',
    blurb: 'Theorems and the proofs contributors wrote for them on ProofWiki. Several proofs of one statement are often genuinely different arguments.' },
  { id: 'Nemotron-Math-Proofs-v2', label: 'Nemotron', badge: 'AI-generated', url: 'https://huggingface.co/datasets/nvidia/Nemotron-Math-Proofs-v2',
    blurb: 'Competition-style problems with proofs written by a single language model (DeepSeek-V4-Pro). Proofs of one problem are samples from the same model, so they tend to take the same route.' },
  { id: 'NuminaMath-LEAN-Proof-Artifacts', label: 'Lean', badge: 'Formal', url: 'https://huggingface.co/datasets/iiis-lean/NuminaMath-LEAN-Proof-Artifacts',
    blurb: 'Statements formalised in Lean 4, each with a proof written by a person and a proof found by an automated prover, side by side.' },
]

const params = () => new URLSearchParams(window.location.search)
const isInformal = (record: RecordDetail): record is InformalRecord => 'proofs' in record
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'The record could not be loaded.')
const sourceOf = (id: string | null) => sources.find((s) => s.id === id)
// a record's id begins with the name of its source
const prefixSource: Record<string, SourceId> = { proofwiki: 'proofwiki-math', nemotron: 'Nemotron-Math-Proofs-v2', numina: 'NuminaMath-LEAN-Proof-Artifacts' }
function startSource(): SourceId {
  const p = params()
  if (sourceOf(p.get('source'))) return p.get('source') as SourceId
  const named = prefixSource[(p.get('id') ?? '').split(':')[0]]
  if (named) return named
  return p.get('kind') === 'formal' ? 'NuminaMath-LEAN-Proof-Artifacts' : 'proofwiki-math'
}

const words = (text: string) => text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
// "pythagorean" should find "Pythagoras": long words are compared by their first letters
const stemOf = (term: string) => (term.length >= 6 ? term.slice(0, Math.max(4, term.length - 3)) : term)
/** How well an item answers the search terms: 0 means not at all. A hit in the title counts for more than one in the statement. */
function score(terms: string[], titleWords: string[], bodyWords: string[], raw: string) {
  let total = 0
  for (const term of terms) {
    const stem = stemOf(term)
    if (titleWords.some((w) => w.startsWith(stem))) total += 3
    else if (bodyWords.some((w) => w.startsWith(stem))) total += 1
    else if (raw.includes(term)) total += 0.5
    else return 0
  }
  return total
}
/** One line to recognise a statement by in a list of matches. */
function gist(item: Item) {
  return (item.title ?? item.statement).replace(/\$|\\[a-z]+|[{}:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
}

function proofLabel(proof: InformalProof, number: number) {
  if (proof.method_cluster) return `${proof.method_cluster.id} · ${proof.method_cluster.name}`
  if (proof.content_type === 'proof_summary') return 'Human solution summary'
  return `Proof ${number}`
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

function ProofDisclosure({ id, label, openProof, setOpenProof, selected, onCompare, compareDisabled, children }: {
  id: string; label: string; openProof: string | null; setOpenProof: (value: string | null) => void
  selected: boolean; onCompare: (id: string) => void; compareDisabled: boolean; children: ReactNode
}) {
  const open = openProof === id
  return <div className="collection-proof-row">
    <section className="collection-proof">
      <button type="button" className="collection-proof-toggle" aria-expanded={open} onClick={() => setOpenProof(open ? null : id)}>
        <span>{label}</span><ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && <div className="collection-proof-body">{children}</div>}
    </section>
    <button type="button" className="collection-compare-select" aria-pressed={selected} disabled={compareDisabled} onClick={() => onCompare(id)}>{selected ? 'Selected' : 'Compare'}</button>
  </div>
}

function InformalProofs({ record, openProof, setOpenProof, selected, onToggle }: {
  record: InformalRecord; openProof: string | null; setOpenProof: (value: string | null) => void; selected: string[]; onToggle: (id: string) => void
}) {
  const ready = selected.length === 2
  const label = (id: string) => { const at = record.proofs.findIndex((p) => p.proof_id === id); return proofLabel(record.proofs[at], at + 1) }
  return <section className="collection-expanded" aria-label="Proofs">
    {record.answer && <p className="collection-answer"><span>Answer</span>{record.answer}</p>}
    <div className="collection-proofs-heading"><span>{record.proofs.length} {record.proofs.length === 1 ? 'proof' : 'proofs'}</span></div>
    {!ready && <p className="collection-compare-help">Select two proofs to read them side by side.</p>}
    {ready && <div className="collection-compare-grid" aria-label="Side-by-side proof comparison">
      {selected.map((id) => <article className="collection-compare-panel" key={id}>
        <header><strong>{label(id)}</strong><span>{record.proofs.find((p) => p.proof_id === id)?.origin === 'synthetic' ? 'Model' : 'Person'}</span></header>
        <div className="collection-compare-content"><ProofContent record={record} proofId={id} /></div>
      </article>)}
    </div>}
    <div className="collection-proof-list">
      {record.proofs.map((proof, index) => <ProofDisclosure key={proof.proof_id} id={proof.proof_id} label={proofLabel(proof, index + 1)} openProof={openProof} setOpenProof={setOpenProof}
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

function writeUrl(state: { source: SourceId; query: string; id: string | null; compare: string[]; proof: string | null }) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('tab', 'library')
  url.searchParams.set('source', state.source)
  if (state.query.trim()) url.searchParams.set('q', state.query.trim())
  if (state.id) url.searchParams.set('id', state.id)
  state.compare.slice(0, 2).forEach((p) => url.searchParams.append('compare', p))
  if (state.proof) url.searchParams.set('proof', state.proof)
  window.history.replaceState(null, '', url)
}

export default function Library({ index, indexError }: { index: CollectionIndex | null; indexError: string }) {
  const start = useRef(params())
  const [source, setSource] = useState<SourceId>(startSource)
  const [items, setItems] = useState<Item[] | null>(null)
  const [itemsError, setItemsError] = useState('')
  const [query, setQuery] = useState(start.current.get('q') ?? '')
  const [id, setId] = useState<string | null>(start.current.get('id'))
  const [record, setRecord] = useState<RecordDetail | null>(null)
  const [recordError, setRecordError] = useState('')
  const [openProof, setOpenProof] = useState<string | null>(start.current.get('proof'))
  const [selected, setSelected] = useState<string[]>(start.current.getAll('compare').slice(0, 2))
  const [matchesOpen, setMatchesOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const counts = useMemo(() => new Map(index?.sources.map((s) => [s.dataset, s.count]) ?? []), [index])
  const meta = sourceOf(source)!

  // only the source being read is downloaded
  useEffect(() => {
    let live = true
    setItems(null); setItemsError('')
    loadItems(source).then((loaded) => { if (live) setItems(loaded) }).catch((error) => { if (live) setItemsError(errorText(error)) })
    return () => { live = false }
  }, [source])

  // the library opens on a showcase statement, then those with the most proofs: that is where different routes can be compared
  // (past twelve, a pile of proofs stops being a comparison, so the count is capped for ranking)
  const ranked = useMemo(() => {
    const rank = (item: Item) => (item.title && item.title === meta.featured ? -99 : -Math.min(item.n_proofs, 12))
    return (items ?? []).slice().sort((a, b) => rank(a) - rank(b))
  }, [items, meta.featured])
  const searchable = useMemo(() => ranked.map((item) => ({
    title: words(`${item.title ?? ''} ${(item.categories ?? []).join(' ')}`),
    body: words(item.statement),
    raw: `${item.title ?? ''} ${item.statement} ${(item.categories ?? []).join(' ')} ${item.source_id ?? ''}`.toLocaleLowerCase(),
  })), [ranked])

  const wanted = useDeferredValue(query)
  const filtered = useMemo(() => {
    const terms = words(wanted)
    if (terms.length === 0) return ranked
    const hits: { item: Item; points: number }[] = []
    ranked.forEach((item, at) => {
      const points = score(terms, searchable[at].title, searchable[at].body, searchable[at].raw)
      if (points > 0) hits.push({ item, points })
    })
    return hits.sort((a, b) => b.points - a.points).map((hit) => hit.item) // a stable sort: ties keep their order by proofs
  }, [ranked, searchable, wanted])

  // one statement at a time: the one named by the link, else the best match
  const found = id ? filtered.findIndex((item) => item.id === id) : -1
  const position = found >= 0 ? found : 0
  const current: Item | null = filtered[position] ?? (id ? ranked.find((item) => item.id === id) ?? null : null)

  useEffect(() => {
    if (!current) { setRecord(null); return }
    const controller = new AbortController()
    setRecord(null); setRecordError('')
    loadRecord(current.record_file, controller.signal).then((loaded) => { if (!controller.signal.aborted) setRecord(loaded) })
      .catch((error) => { if (!controller.signal.aborted) setRecordError(errorText(error)) })
    return () => controller.abort()
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // the address names a statement only once one has been chosen
  useEffect(() => { writeUrl({ source, query, id, compare: selected, proof: openProof }) }, [source, query, id, selected, openProof])
  useEffect(() => { document.title = `${current?.title ?? 'Library'} — Proofscape` }, [current?.title])

  function show(item: Item | undefined) {
    if (!item) return
    setId(item.id); setOpenProof(null); setSelected([]); setMatchesOpen(false); setActive(-1)
  }
  const go = (next: number) => show(filtered[Math.min(filtered.length - 1, Math.max(0, next))])
  const surprise = () => show(filtered[Math.floor(Math.random() * filtered.length)])
  function choose(next: SourceId) { setSource(next); setId(null); setQuery(''); setOpenProof(null); setSelected([]); setMatchesOpen(false) }
  const toggle = (proofId: string) => setSelected((c) => c.includes(proofId) ? c.filter((v) => v !== proofId) : c.length < 2 ? [...c, proofId] : c)

  const matches = query.trim() && matchesOpen ? filtered.slice(0, 8) : []
  function onSearchKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setMatchesOpen(false); setActive(-1) }
    else if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setActive((a) => (a + 1) % matches.length) }
    else if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setActive((a) => (a <= 0 ? matches.length : a) - 1) }
    else if (event.key === 'Enter' && matches.length) { event.preventDefault(); show(matches[Math.max(0, active)]) }
  }

  return <div className="library">
    <div className="library-sources" role="group" aria-label="Library source">
      {sources.map((s) => <button type="button" key={s.id} aria-pressed={s.id === source} onClick={() => choose(s.id)}>
        <strong>{s.label}</strong><em>{s.badge}</em><span>{(counts.get(s.id) ?? 0).toLocaleString()}</span>
      </button>)}
    </div>
    <p className="library-blurb">{meta.blurb} <a href={meta.url} target="_blank" rel="noreferrer">Dataset <ExternalLink size={12} /></a></p>
    {(indexError || itemsError) && <div className="collection-offline" role="alert"><strong>Library unavailable.</strong> {indexError || itemsError}</div>}

    <div className="library-filters">
      <div className="library-search">
        <label className="collection-search"><Search size={17} /><span className="sr-only">Search statements</span>
          <input value={query} role="combobox" aria-expanded={matches.length > 0} aria-controls="library-matches" aria-autocomplete="list" aria-activedescendant={active >= 0 ? `library-match-${active}` : undefined} autoComplete="off"
            onChange={(event) => { setQuery(event.target.value); setId(null); setOpenProof(null); setSelected([]); setMatchesOpen(true); setActive(-1) }}
            onFocus={() => setMatchesOpen(true)} onBlur={() => window.setTimeout(() => setMatchesOpen(false), 150)} onKeyDown={onSearchKey}
            placeholder={source === 'proofwiki-math' ? 'Search statements, titles and ProofWiki categories…' : 'Search statements…'} /></label>
        {matches.length > 0 && <ul className="library-matches" id="library-matches" role="listbox" aria-label="Matching statements">
          {matches.map((item, at) => <li key={item.id} id={`library-match-${at}`} role="option" aria-selected={at === active} onMouseDown={(event) => { event.preventDefault(); show(item) }}>
            <span>{gist(item)}</span><em>{item.n_proofs} proofs</em>
          </li>)}
          {filtered.length > matches.length && <li className="library-matches-more" role="presentation">{(filtered.length - matches.length).toLocaleString()} more: use the arrows below</li>}
        </ul>}
      </div>
      <button type="button" className="library-surprise" onClick={surprise} disabled={filtered.length === 0}><Shuffle size={15} aria-hidden="true" /> Random statement</button>
    </div>

    {!items && !itemsError && <div className="collection-loading" role="status">Loading the statements…</div>}
    {current && <article className="collection-item">
      <div className="collection-item-meta"><span>{sourceOf(current.dataset)?.label} · {sourceOf(current.dataset)?.badge}</span><span>{current.n_proofs} {current.n_proofs === 1 ? 'proof' : 'proofs'}</span></div>
      {current.title && <p className="collection-item-title">{current.title}</p>}
      <div className="collection-statement"><MathText text={record ? (isInformal(record) ? record.statement : record.problem) : current.statement} /></div>
      {recordError && <div className="collection-offline" role="alert">{recordError}</div>}
      {!record && !recordError && <div className="collection-loading" role="status">Loading proofs…</div>}
      {record && (isInformal(record)
        ? <InformalProofs record={record} openProof={openProof} setOpenProof={setOpenProof} selected={selected} onToggle={toggle} />
        : <FormalDuel record={record} />)}
      {record && <div className="collection-provenance"><span>Source ID: <code>{record.source_id}</code></span>{isInformal(record) && record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer">Original <ExternalLink size={12} /></a>}</div>}
    </article>}
    {items && !current && <div className="collection-empty">No statements match. Try a shorter search.</div>}

    {current && <nav className="collection-pagination" aria-label="Browse statements">
      <button type="button" disabled={position <= 0} onClick={() => go(position - 1)}>← Previous</button>
      <span>{(position + 1).toLocaleString()} / {filtered.length.toLocaleString()}</span>
      <button type="button" disabled={position >= filtered.length - 1} onClick={() => go(position + 1)}>Next →</button>
    </nav>}
  </div>
}
