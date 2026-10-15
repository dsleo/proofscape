import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { MathText } from './MathText'
import { displayRouteTitle, displayTitle, primaryReference, ProofMathText, SourceCitation } from './historicalShared'
import type { Catalog, Entry, Route } from './historicalShared'
import './ring.css'

export type Technique = { id: string; family: string; group?: string; glyph?: string; label: string; short: string; gloss: string; provisional?: boolean }
export type Group = { id: string; family: string; label: string }
export type RingRoute = { id: string; title: string; techniques: string[]; derivesFromTheorem: boolean; excluded: string | null; titleSketchDisagree: boolean }
export type RingTheorem = { id: number; name: string; areas: string[]; usableRoutes: number; routes: RingRoute[] }
export type MethodData = {
  vocabulary: { families: { id: string; label: string }[]; groups: Group[]; techniques: Technique[] }
  ring: { families: string[]; techniques: string[] }
  world: { size?: [number, number]; islands: Record<string, { x: number; y: number; r: number }>; sites: Record<string, [number, number]> }
  theorems: RingTheorem[]
  pairs: Record<string, number[]>
  triples: Record<string, number[]>
}

const dataUrl = `${import.meta.env.BASE_URL}data/collection/constellation.json`
export const familyColor: Record<string, string> = { logic: '#6a4f7a', discrete: '#4f6b5a', algebraic: '#8a4a5a', analytic: '#3f5a7a', geometric: '#7a6a2a' }
export const familyName: Record<string, string> = { logic: 'Logic', discrete: 'Combinatorics', algebraic: 'Algebra', analytic: 'Analysis', geometric: 'Geometry' }
export const PAGE = 4

export const fixed = (value: number) => value.toFixed(1)
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const parts = (item: string) => ({ kind: item.slice(0, 1), key: item.slice(2) })
const bridgeKey = (a: string, b: string) => [a, b].sort().join('|')

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

export function useMethodData() {
  const [data, setData] = useState<MethodData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(dataUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Method index request failed (${response.status}).`)
      return response.json() as Promise<MethodData>
    }).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The method index could not be loaded.'))
  }, [])
  const model = useMemo(() => {
    if (!data) return null
    const names = new Map(data.vocabulary.techniques.map((technique) => [technique.id, technique]))
    const used = new Map<number, Set<string>>()
    const islandsOf = new Map<number, Set<string>>()
    const uses = new Map<string, number>()
    for (const theorem of data.theorems) {
      const set = new Set<string>(), islands = new Set<string>()
      theorem.routes.forEach((route) => { if (!route.excluded) route.techniques.forEach((id) => { set.add(id); islands.add(names.get(id)?.family ?? '') }) })
      used.set(theorem.id, set)
      islandsOf.set(theorem.id, islands)
      set.forEach((id) => uses.set(id, (uses.get(id) ?? 0) + 1))
    }
    const byFamily = new Map<string, string[]>()
    data.ring.techniques.forEach((id) => { const family = names.get(id)?.family ?? ''; byFamily.set(family, [...(byFamily.get(family) ?? []), id]) })
    const bridgesOf = new Map<number, Set<string>>()
    const bridges = new Map<string, string[]>()
    for (const [key, ids] of Object.entries(data.pairs)) {
      const [a, b] = key.split('|')
      const fa = names.get(a)?.family ?? '', fb = names.get(b)?.family ?? ''
      if (fa === fb) continue
      const bk = bridgeKey(fa, fb)
      bridges.set(bk, [...(bridges.get(bk) ?? []), key])
      ids.forEach((id) => bridgesOf.set(id, (bridgesOf.get(id) ?? new Set<string>()).add(bk)))
    }
    const sets = (index: Record<string, number[]>) => new Map(Object.entries(index).map(([key, ids]) => [key, new Set(ids)]))
    return { names, used, uses, islandsOf, bridgesOf, bridges, byFamily, pairs: sets(data.pairs), triples: sets(data.triples) }
  }, [data])
  return { data, model, error }
}
export type MethodModel = NonNullable<ReturnType<typeof useMethodData>['model']>

export function useMethodSelection(data: MethodData, model: MethodModel) {
  const [selection, setSelection] = useState<string[]>(readSelection)
  const [count, setCount] = useState(PAGE)
  useEffect(() => { writeSelection(selection) }, [selection])

  const holds = (id: number, item: string) => {
    const { kind, key } = parts(item)
    if (kind === 'v') return !!model.used.get(id)?.has(key)
    if (kind === 'i') return !!model.islandsOf.get(id)?.has(key)
    if (kind === 'b') return !!model.bridgesOf.get(id)?.has(key)
    return (kind === 'e' ? model.pairs : model.triples).get(key)?.has(id) ?? false
  }
  const matched = data.theorems.filter((theorem) => selection.every((item) => holds(theorem.id, item)))
  const pool = selection.length ? matched : data.theorems.filter((theorem) => theorem.usableRoutes >= 1)
  const live = {
    methods: new Set<string>(), edges: new Set<string>(), triples: new Set<string>(), islands: new Set<string>(), bridges: new Set<string>(),
  }
  for (const [key, ids] of model.pairs) if (pool.some((theorem) => ids.has(theorem.id))) live.edges.add(key)
  for (const [key, ids] of model.triples) if (pool.some((theorem) => ids.has(theorem.id))) live.triples.add(key)
  for (const theorem of pool) {
    model.used.get(theorem.id)?.forEach((id) => live.methods.add(id))
    model.islandsOf.get(theorem.id)?.forEach((id) => live.islands.add(id))
    model.bridgesOf.get(theorem.id)?.forEach((id) => live.bridges.add(id))
  }
  const chosen = new Set(selection)
  const memberMethods = (item: string): string[] => {
    const { kind, key } = parts(item)
    if (kind === 'v') return [key]
    if (kind === 'i') return model.byFamily.get(key) ?? []
    if (kind === 'b') return key.split('|').flatMap((family) => model.byFamily.get(family) ?? [])
    return key.split('|')
  }
  const methods = new Set(selection.flatMap(memberMethods))
  const label = (item: string) => {
    const { kind, key } = parts(item)
    if (kind === 'i') return `${familyName[key]} island`
    if (kind === 'b') return `${key.split('|').map((family) => familyName[family]).join(' ⇄ ')} bridge`
    return key.split('|').map((id) => model.names.get(id)?.short ?? id).join(' + ')
  }
  const isLive = (item: string) => {
    const { kind, key } = parts(item)
    return kind === 'v' ? live.methods.has(key) : kind === 'e' ? live.edges.has(key) : kind === 't' ? live.triples.has(key) : kind === 'i' ? live.islands.has(key) : live.bridges.has(key)
  }
  function toggle(item: string) {
    setCount(PAGE)
    setSelection((current) => {
      if (current.includes(item)) return current.filter((value) => value !== item)
      return current.length === 0 || isLive(item) ? [...current, item] : [item]
    })
  }
  const press = (item: string) => ({
    tabIndex: 0, role: 'button' as const,
    onClick: () => toggle(item),
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(item) } },
  })
  return { selection, matched, live, chosen, methods, label, toggle, press, count, setCount, clear: () => { setSelection([]); setCount(PAGE) } }
}
export type MethodSelection = ReturnType<typeof useMethodSelection>

function Approach({ route, source, methods, names }: { route: RingRoute; source?: Route; methods: Set<string>; names: Map<string, Technique> }) {
  const reference = source ? primaryReference(source) : undefined
  const fromSource = source?.sketchStatus === 'source-extracted'
  const lead = route.techniques.find((id) => methods.has(id)) ?? route.techniques[0]
  const color = lead ? familyColor[names.get(lead)?.family ?? ''] : undefined
  return <details className="ring-approach" style={{ borderLeftColor: color }}>
    <summary>
      <span className="ring-approach-tags">
        {route.techniques.map((id) => <span key={id} className={methods.has(id) ? 'ring-tag ring-tag-on' : 'ring-tag'} style={{ color: familyColor[names.get(id)?.family ?? ''] }}>{names.get(id)?.short ?? id}</span>)}
        {route.derivesFromTheorem && <span className="ring-tag ring-tag-quiet">applies a known theorem</span>}
      </span>
      <span className="ring-approach-title">{source ? <ProofMathText text={displayRouteTitle(source)} /> : capitalize(route.title)}{route.titleSketchDisagree && <span className="ring-warning" title="The title and the proof sketch describe different routes"> ⚠</span>}</span>
    </summary>
    <div className="ring-approach-body">
      {source?.proofSketch && <div className="ring-sketch"><ProofMathText text={source.proofSketch} /></div>}
      <div className={fromSource ? 'ring-evidence ring-evidence-source' : 'ring-evidence'}>{fromSource ? 'Sketch read from the cited source' : 'Sketch reconstructed, not taken from a source'}</div>
      {reference && <SourceCitation reference={reference} />}
    </div>
  </details>
}

function TheoremCard({ theorem, entry, source, methods, names, heading, onOpen }: { theorem: RingTheorem; entry: Entry | undefined; source: Map<string, Route>; methods: Set<string>; names: Map<string, Technique>; heading: string; onOpen: (id: number) => void }) {
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
    <div className="ring-approaches-label">Approaches matching {heading}</div>
    <div className="ring-approaches">
      {used.map((route) => <Approach key={route.id} route={route} source={source.get(route.id)} methods={methods} names={names} />)}
    </div>
    {(shown.length > 0 || hidden > 0) && <details className="ring-others">
      <summary>{shown.length} other approach{shown.length === 1 ? '' : 'es'}{hidden > 0 ? `, ${hidden} omitted as duplicate or incomplete` : ''}</summary>
      {shown.map((route) => <Approach key={route.id} route={route} source={source.get(route.id)} methods={methods} names={names} />)}
    </details>}
  </article>
}

export function SelectionBar({ sel, lead, results }: { sel: MethodSelection; lead: string; results: RefObject<HTMLDivElement | null> }) {
  return <div className="ring-bar" aria-live="polite">
    {sel.selection.length === 0 ? (lead ? <p className="ring-lead">{lead}</p> : null) : <div className="ring-selection">
      {sel.selection.map((item) => <button type="button" className="ring-chip" key={item} onClick={() => sel.toggle(item)}>{sel.label(item)} <span aria-hidden="true">×</span><span className="sr-only"> remove</span></button>)}
      <span className="ring-count">{sel.matched.length} theorem{sel.matched.length === 1 ? '' : 's'}</span>
      <button type="button" className="ring-jump" onClick={() => results.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>Results ↓</button>
      <button type="button" className="ring-clear" onClick={sel.clear}>Clear</button>
    </div>}
  </div>
}

export function ResultsPanel({ sel, model, catalog, hint, results, onOpenEntry }: { sel: MethodSelection; model: MethodModel; catalog: Catalog; hint: string; results: RefObject<HTMLDivElement | null>; onOpenEntry: (id: number) => void }) {
  const entries = useMemo(() => new Map(catalog.entries.map((entry) => [entry.id, entry])), [catalog])
  const routes = useMemo(() => new Map(catalog.entries.flatMap((entry) => entry.routes.map((route) => [route.id, route] as const))), [catalog])
  const shown = sel.matched.slice(0, sel.count)
  const heading = sel.selection.map(sel.label).join(' · ')
  return <div className="ring-panel" ref={results}>
    {sel.selection.length === 0 ? <p className="ring-hint">{hint}</p> : <>
      <p className="ring-summary">Theorems matching all of: {sel.selection.map((item, index) => <span key={item}>{index > 0 && ', '}<strong>{sel.label(item)}</strong></span>)}</p>
      {sel.matched.length === 0 && <p className="ring-hint">No theorem fits all of these. Remove one of them.</p>}
      <div className="ring-results">
        {shown.map((theorem) => <TheoremCard key={theorem.id} theorem={theorem} entry={entries.get(theorem.id)} source={routes} methods={sel.methods} names={model.names} heading={heading} onOpen={onOpenEntry} />)}
      </div>
      {sel.matched.length > sel.count && <button type="button" className="ring-more" onClick={() => sel.setCount(sel.matched.length)}>Show all {sel.matched.length}</button>}
    </>}
  </div>
}

export function MethodList({ data, model, sel }: { data: MethodData; model: MethodModel; sel: MethodSelection }) {
  return <details className="ring-methodlist" open={window.matchMedia('(max-width: 640px)').matches || undefined}>
    <summary>All {data.vocabulary.techniques.length} methods as a list</summary>
    {data.ring.families.map((family) => <div key={family} className="ring-methodgroup">
      <div className="ring-methodfamily" style={{ color: familyColor[family] }}>{familyName[family]}</div>
      {data.vocabulary.groups.filter((group) => group.family === family).map((group) => <div key={group.id} className="ring-methodsub">
        <div className="ring-methodsubname">{group.label}</div>
        <div className="ring-methods">
          {(model.byFamily.get(family) ?? []).filter((id) => model.names.get(id)?.group === group.id).map((id) => {
            const item = `v:${id}`, n = model.uses.get(id) ?? 0, on = sel.chosen.has(item), faded = sel.selection.length > 0 && !sel.live.methods.has(id) && !on
            return <button type="button" key={id} className={on ? 'ring-method ring-method-on' : faded ? 'ring-method ring-method-faded' : 'ring-method'} aria-pressed={on} title={model.names.get(id)?.gloss} onClick={() => sel.toggle(item)}>
              <i className="ring-glyph" aria-hidden="true">{model.names.get(id)?.glyph}</i>{model.names.get(id)?.short} <span>{n}</span>
            </button>
          })}
        </div>
      </div>)}
    </div>)}
  </details>
}

export function useResultsRef() { return useRef<HTMLDivElement>(null) }
