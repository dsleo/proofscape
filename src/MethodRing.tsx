import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { MathText } from './MathText'
import { displayRouteTitle, displayTitle, primaryReference, ProofMathText, SourceCitation } from './historicalShared'
import type { Catalog, Entry, Route } from './historicalShared'
import './ring.css'

type Technique = { id: string; family: string; label: string; short: string; gloss: string; provisional?: boolean }
type RingRoute = { id: string; title: string; techniques: string[]; derivesFromTheorem: boolean; excluded: string | null; titleSketchDisagree: boolean }
type RingTheorem = { id: number; name: string; areas: string[]; usableRoutes: number; routes: RingRoute[] }
type RingData = {
  vocabulary: { families: { id: string; label: string }[]; techniques: Technique[] }
  ring: { families: string[]; techniques: string[] }
  theorems: RingTheorem[]
  pairs: Record<string, number[]>
  triples: Record<string, number[]>
}

const dataUrl = `${import.meta.env.BASE_URL}data/collection/constellation.json`
const familyColor: Record<string, string> = { logic: '#6a4f7a', recursion: '#8a5a2b', discrete: '#4f6b5a', algebraic: '#8a4a5a', analytic: '#3f5a7a', geometric: '#7a6a2a' }
const familyName: Record<string, string> = { logic: 'Logic', recursion: 'Reduction', discrete: 'Counting', algebraic: 'Algebra', analytic: 'Analysis', geometric: 'Geometry' }
const CX = 340, CY = 300, RADIUS = 150, GAP = 8
const PAGE = 4

const at = (angle: number, radius: number): [number, number] => [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius]
const fixed = (value: number) => value.toFixed(1)
const parts = (item: string) => { const [kind, key] = [item.slice(0, 1), item.slice(2)]; return { kind, key, members: key.split('|') } }
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

function readSelection() {
  const raw = new URLSearchParams(window.location.search).get('sel') ?? ''
  return raw.split(',').filter(Boolean).map((item) => item.replace(/~/g, '|'))
}

function writeSelection(selection: string[]) {
  const url = new URL(window.location.href)
  if (selection.length) url.searchParams.set('sel', selection.map((item) => item.replace(/\|/g, '~')).join(','))
  else url.searchParams.delete('sel')
  window.history.replaceState(null, '', url)
}

function Approach({ route, source, methods, names }: { route: RingRoute; source?: Route; methods: Set<string>; names: Map<string, Technique> }) {
  const [open, setOpen] = useState(false)
  const reference = source ? primaryReference(source) : undefined
  const fromSource = source?.sketchStatus === 'source-extracted'
  const lead = route.techniques.find((id) => methods.has(id)) ?? route.techniques[0]
  const color = lead ? familyColor[names.get(lead)?.family ?? ''] : undefined
  return <div className="ring-approach" style={{ borderLeftColor: color }}>
    <div className="ring-approach-tags">
      {route.techniques.map((id) => <span key={id} className={methods.has(id) ? 'ring-tag ring-tag-on' : 'ring-tag'} style={{ color: familyColor[names.get(id)?.family ?? ''] }}>{names.get(id)?.short ?? id}</span>)}
      {route.derivesFromTheorem && <span className="ring-tag ring-tag-quiet">applies a known theorem</span>}
    </div>
    <div className="ring-approach-title">{source ? <ProofMathText text={displayRouteTitle(source)} /> : capitalize(route.title)}{route.titleSketchDisagree && <span className="ring-warning" title="The title and the proof sketch describe different routes"> ⚠</span>}</div>
    {source?.proofSketch && <div className={open ? 'ring-sketch ring-sketch-open' : 'ring-sketch'}><ProofMathText text={source.proofSketch} /></div>}
    <div className="ring-approach-foot">
      <span className={fromSource ? 'ring-evidence ring-evidence-source' : 'ring-evidence'}>{fromSource ? 'Sketch read from the cited source' : 'Sketch reconstructed, not taken from a source'}</span>
      {source?.proofSketch && <button type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Show less' : 'Read sketch'}</button>}
    </div>
    {open && reference && <SourceCitation reference={reference} />}
  </div>
}

function TheoremCard({ theorem, entry, source, methods, names, onOpen }: { theorem: RingTheorem; entry: Entry | undefined; source: Map<string, Route>; methods: Set<string>; names: Map<string, Technique>; onOpen: (id: number) => void }) {
  const [statement, setStatement] = useState(false)
  const used = theorem.routes.filter((route) => !route.excluded && route.techniques.some((id) => methods.has(id)))
  const others = theorem.routes.filter((route) => !used.includes(route))
  const hidden = others.filter((route) => route.excluded).length
  const shown = others.filter((route) => !route.excluded)
  return <article className="ring-card">
    <header className="ring-card-head">
      <span className="ring-number">{String(theorem.id).padStart(3, '0')}</span>
      <h3>{entry ? <MathText text={displayTitle(entry)} /> : theorem.name}</h3>
      <button type="button" className="ring-open" onClick={() => onOpen(theorem.id)}>Open in course results <ArrowUpRight size={12} aria-hidden="true" /></button>
    </header>
    {entry && <div className={statement ? 'ring-statement ring-statement-open' : 'ring-statement'}>
      <MathText text={entry.statement} />
      <button type="button" onClick={() => setStatement((value) => !value)}>{statement ? 'Collapse statement' : 'Full statement'}</button>
    </div>}
    <div className="ring-approaches-label">Approaches using {[...methods].map((id) => names.get(id)?.short ?? id).join(' · ')}</div>
    <div className="ring-approaches">
      {used.map((route) => <Approach key={route.id} route={route} source={source.get(route.id)} methods={methods} names={names} />)}
    </div>
    {(shown.length > 0 || hidden > 0) && <details className="ring-others">
      <summary>{shown.length} other approach{shown.length === 1 ? '' : 'es'}{hidden > 0 ? `, ${hidden} omitted as duplicate or incomplete` : ''}</summary>
      {shown.map((route) => <Approach key={route.id} route={route} source={source.get(route.id)} methods={methods} names={names} />)}
    </details>}
  </article>
}

export default function MethodRing({ catalog, onOpenEntry }: { catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const [data, setData] = useState<RingData | null>(null)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState<string[]>(readSelection)
  const [showOne, setShowOne] = useState(false)
  const [showTriangles, setShowTriangles] = useState(true)
  const [count, setCount] = useState(PAGE)
  const results = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(dataUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Method index request failed (${response.status}).`)
      return response.json() as Promise<RingData>
    }).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The method index could not be loaded.'))
  }, [])

  useEffect(() => { writeSelection(selection) }, [selection])

  const model = useMemo(() => {
    if (!data) return null
    const names = new Map(data.vocabulary.techniques.map((technique) => [technique.id, technique]))
    const order = data.ring.techniques
    const per = (360 - GAP * data.ring.families.length) / order.length
    const angle = new Map<string, number>()
    const arcs: { family: string; start: number; end: number }[] = []
    let cursor = -90
    for (const family of data.ring.families) {
      const ids = order.filter((id) => names.get(id)?.family === family)
      ids.forEach((id, index) => angle.set(id, ((cursor + per * (index + 0.5)) * Math.PI) / 180))
      arcs.push({ family, start: (cursor * Math.PI) / 180, end: ((cursor + per * ids.length) * Math.PI) / 180 })
      cursor += per * ids.length + GAP
    }
    const used = new Map<number, Set<string>>()
    const uses = new Map<string, number>()
    for (const theorem of data.theorems) {
      const set = new Set<string>()
      theorem.routes.forEach((route) => { if (!route.excluded) route.techniques.forEach((id) => set.add(id)) })
      used.set(theorem.id, set)
      set.forEach((id) => uses.set(id, (uses.get(id) ?? 0) + 1))
    }
    const sets = (index: Record<string, number[]>) => new Map(Object.entries(index).map(([key, ids]) => [key, new Set(ids)]))
    return { names, angle, arcs, used, uses, pairs: sets(data.pairs), triples: sets(data.triples) }
  }, [data])

  const entries = useMemo(() => new Map(catalog.entries.map((entry) => [entry.id, entry])), [catalog])
  const routes = useMemo(() => new Map(catalog.entries.flatMap((entry) => entry.routes.map((route) => [route.id, route] as const))), [catalog])

  if (error) return <div className="collection-offline" role="alert">The method ring is unavailable. {error}</div>
  if (!data || !model) return <div className="ring-loading" aria-live="polite">Loading the method index…</div>

  const holds = (id: number, item: string) => {
    const { kind, key } = parts(item)
    return kind === 'v' ? !!model.used.get(id)?.has(key) : (kind === 'e' ? model.pairs : model.triples).get(key)?.has(id) ?? false
  }
  const matched = data.theorems.filter((theorem) => selection.every((item) => holds(theorem.id, item)))
  const pool = selection.length ? matched : data.theorems.filter((theorem) => theorem.usableRoutes >= 1)
  const liveEdges = new Set<string>(), liveTriples = new Set<string>(), liveMethods = new Set<string>()
  for (const [key, ids] of model.pairs) if (pool.some((theorem) => ids.has(theorem.id))) liveEdges.add(key)
  for (const [key, ids] of model.triples) if (pool.some((theorem) => ids.has(theorem.id))) liveTriples.add(key)
  pool.forEach((theorem) => model.used.get(theorem.id)?.forEach((id) => liveMethods.add(id)))
  const chosen = new Set(selection)
  const methods = new Set(selection.flatMap((item) => parts(item).members))

  function toggle(item: string) {
    setCount(PAGE)
    setSelection((current) => {
      if (current.includes(item)) return current.filter((value) => value !== item)
      const { kind, key } = parts(item)
      const live = kind === 'v' ? liveMethods.has(key) : kind === 'e' ? liveEdges.has(key) : liveTriples.has(key)
      return current.length === 0 || live ? [...current, item] : [item]
    })
  }
  const press = (item: string) => ({
    tabIndex: 0, role: 'button' as const,
    onClick: () => toggle(item),
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(item) } },
  })
  const label = (item: string) => parts(item).members.map((id) => model.names.get(id)?.short ?? id).join(' + ')

  const chordKeys = Object.keys(data.pairs)
  const visibleChords = chordKeys.filter((key) => chosen.has(`e:${key}`) || model.pairs.get(key)!.size >= 2 || showOne || (selection.length > 0 && liveEdges.has(key)))
  const shown = matched.slice(0, count)

  return <section className="ring-view" aria-label="Methods and the theorems they prove">
    <div className="ring-bar" aria-live="polite">
      {selection.length === 0 ? <>
        <p className="ring-lead">{data.theorems.filter((theorem) => theorem.usableRoutes >= 1).length} theorems, {data.vocabulary.techniques.length} proof methods. Click a method, or a chord between two methods.</p>
      </> : <>
        <div className="ring-selection">
          {selection.map((item) => <button type="button" className="ring-chip" key={item} onClick={() => toggle(item)}>{label(item)} <span aria-hidden="true">×</span><span className="sr-only"> remove</span></button>)}
          <span className="ring-count">{matched.length} theorem{matched.length === 1 ? '' : 's'}</span>
          <button type="button" className="ring-jump" onClick={() => results.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>Results ↑</button>
          <button type="button" className="ring-clear" onClick={() => { setSelection([]); setCount(PAGE) }}>Clear</button>
        </div>
      </>}
    </div>
    <div className="ring-panel" ref={results}>
      {selection.length === 0 ? <p className="ring-hint">You get the theorems whose proofs use it. Keep clicking: only theorems that use everything you picked stay, and the rest of the ring fades. A chord joins two methods that distinguish two different routes of the same theorem.</p> : <>
        <p className="ring-summary">Theorems whose proofs use all of: {[...methods].map((id, index) => <span key={id}>{index > 0 && ', '}<strong style={{ color: familyColor[model.names.get(id)?.family ?? ''] }}>{model.names.get(id)?.short}</strong></span>)}</p>
        {matched.length === 0 && <p className="ring-hint">No theorem fits all of these. Remove one of them.</p>}
        <div className="ring-results">
          {shown.map((theorem) => <TheoremCard key={theorem.id} theorem={theorem} entry={entries.get(theorem.id)} source={routes} methods={methods} names={model.names} onOpen={onOpenEntry} />)}
        </div>
        {matched.length > count && <button type="button" className="ring-more" onClick={() => setCount(matched.length)}>Show all {matched.length}</button>}
      </>}
    </div>

    <div className="ring-controls">
      <label><input type="checkbox" checked={showOne} onChange={(event) => setShowOne(event.target.checked)} /> Show pairs found in only one theorem</label>
      <label><input type="checkbox" checked={showTriangles} onChange={(event) => setShowTriangles(event.target.checked)} /> Show triangles (three rival routes)</label>
      <span>{visibleChords.length} of {chordKeys.length} chords shown</span>
    </div>

    <svg className="ring-svg" viewBox="0 0 680 600" role="group" aria-label="Proof methods arranged on a ring, grouped by domain">
      {model.arcs.map((arc) => {
        const [x0, y0] = at(arc.start, RADIUS + 7), [x1, y1] = at(arc.end, RADIUS + 7), mid = (arc.start + arc.end) / 2, [lx, ly] = [CX + Math.cos(mid) * 292, CY + Math.sin(mid) * (RADIUS + 112)], cos = Math.cos(mid)
        return <g key={arc.family}>
          <path d={`M${fixed(x0)},${fixed(y0)}A${RADIUS + 7},${RADIUS + 7} 0 0 1 ${fixed(x1)},${fixed(y1)}`} fill="none" stroke={familyColor[arc.family]} strokeWidth="4" strokeLinecap="round" />
          <text x={fixed(lx)} y={fixed(ly + 4)} textAnchor={cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'} className="ring-family" style={{ fill: familyColor[arc.family] }}>{familyName[arc.family]}</text>
        </g>
      })}
      {Object.keys(data.triples).map((key) => {
        const item = `t:${key}`, ids = key.split('|'), on = chosen.has(item), live = liveTriples.has(key), strong = model.triples.get(key)!.size >= 2
        if (!showTriangles && !on && !(selection.length && live)) return null
        const path = ids.map((id) => at(model.angle.get(id)!, RADIUS)).map(([x, y]) => `${fixed(x)},${fixed(y)}`).join('L')
        return <path key={item} className="ring-triangle" d={`M${path}Z`} fill="#ae6b1f" stroke="#ae6b1f"
          fillOpacity={on ? 0.42 : live ? (selection.length ? 0.24 : strong ? 0.2 : 0.09) : 0.02} strokeOpacity={on ? 1 : live ? (selection.length ? 0.7 : 0.35) : 0.05} strokeWidth={on ? 2 : 1}
          aria-label={`${label(item)}, three routes`} {...press(item)}><title>{label(item)}</title></path>
      })}
      {visibleChords.map((key) => {
        const item = `e:${key}`, [a, b] = key.split('|'), on = chosen.has(item), live = liveEdges.has(key), n = model.pairs.get(key)!.size
        const [x0, y0] = at(model.angle.get(a)!, RADIUS), [x1, y1] = at(model.angle.get(b)!, RADIUS)
        const cx = CX + ((x0 + x1) / 2 - CX) * 0.2, cy = CY + ((y0 + y1) / 2 - CY) * 0.2
        const same = model.names.get(a)?.family === model.names.get(b)?.family
        const d = `M${fixed(x0)},${fixed(y0)}Q${fixed(cx)},${fixed(cy)} ${fixed(x1)},${fixed(y1)}`
        return <g key={item}>
          <path d={d} fill="none" strokeLinecap="round" stroke={on ? '#ae6b1f' : same ? familyColor[model.names.get(a)!.family] : '#6e665d'}
            strokeWidth={(1.1 + Math.min(n, 6) * 0.9) + (on ? 2.4 : 0)} strokeOpacity={on ? 1 : live ? (selection.length ? 0.85 : 0.6) : 0.06} />
          <path d={d} fill="none" stroke="transparent" strokeWidth="10" className="ring-hit" aria-label={`${label(item)}, ${n} theorem${n === 1 ? '' : 's'}`} {...press(item)}>
            <title>{label(item)}: {n} theorem{n === 1 ? '' : 's'}</title>
          </path>
        </g>
      })}
      {model.arcs.flatMap((arc) => data.ring.techniques.filter((id) => model.names.get(id)?.family === arc.family)).map((id) => {
        const item = `v:${id}`, a = model.angle.get(id)!, [x, y] = at(a, RADIUS), [lx, ly] = at(a, RADIUS + 14)
        const n = model.uses.get(id) ?? 0, on = chosen.has(item), right = Math.cos(a) >= 0, degrees = (a * 180) / Math.PI + (right ? 0 : 180)
        const faded = selection.length > 0 && !liveMethods.has(id) && !on
        return <g key={item} className="ring-node" opacity={faded ? 0.2 : 1} aria-label={`${model.names.get(id)?.short}, ${n} theorem${n === 1 ? '' : 's'}`} {...press(item)}>
          <title>{model.names.get(id)?.label}</title>
          <circle className="ring-dot" cx={fixed(x)} cy={fixed(y)} r={2.4 + Math.min(n, 14) * 0.5} fill={n ? familyColor[model.names.get(id)!.family] : '#cbc2b4'} stroke={on ? '#282522' : 'none'} strokeWidth={on ? 3 : 0} />
          <circle cx={fixed(x)} cy={fixed(y)} r="8" fill="transparent" />
          <text x={fixed(lx)} y={fixed(ly)} dy="4" transform={`rotate(${fixed(degrees)} ${fixed(lx)} ${fixed(ly)})`} textAnchor={right ? 'start' : 'end'} className="ring-label" style={{ fill: n ? '#332d26' : '#a69d91' }}>{model.names.get(id)?.short}</text>
        </g>
      })}
    </svg>
    <details className="ring-methodlist" open={window.matchMedia('(max-width: 640px)').matches || undefined}>
      <summary>All {data.vocabulary.techniques.length} methods as a list</summary>
      {data.ring.families.map((family) => <div key={family} className="ring-methodgroup">
        <div className="ring-methodfamily" style={{ color: familyColor[family] }}>{familyName[family]}</div>
        <div className="ring-methods">
          {data.ring.techniques.filter((id) => model.names.get(id)?.family === family).map((id) => {
            const item = `v:${id}`, n = model.uses.get(id) ?? 0, on = chosen.has(item), faded = selection.length > 0 && !liveMethods.has(id) && !on
            return <button type="button" key={id} className={on ? 'ring-method ring-method-on' : faded ? 'ring-method ring-method-faded' : 'ring-method'} aria-pressed={on} title={model.names.get(id)?.gloss} onClick={() => toggle(item)}>
              {model.names.get(id)?.short} <span>{n}</span>
            </button>
          })}
        </div>
      </div>)}
    </details>
    <p className="ring-note">Chord thickness is the number of theorems; dot size is the number of theorems using the method. Methods are tagged by two independent reviewers from the proof sketches, so they are inferred, not source-verified. Routes judged duplicate, dependent or incomplete are left out, so counts are lower than the catalog's.</p>
  </section>
}
