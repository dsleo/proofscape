import { useMemo } from 'react'
import type { Catalog } from './historicalShared'
import { familyColor, familyName, fixed, MethodList, ResultsPanel, SelectionBar, useMethodData, useMethodSelection, useResultsRef } from './methodShared'
import type { MethodData, MethodModel } from './methodShared'

const CX = 340, CY = 300, RADIUS = 150, GAP = 8
const at = (angle: number, radius: number): [number, number] => [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius]

function RingBody({ data, model, catalog, onOpenEntry }: { data: MethodData; model: MethodModel; catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const sel = useMethodSelection(data, model)
  const results = useResultsRef()
  const layout = useMemo(() => {
    const per = (360 - GAP * data.ring.families.length) / data.ring.techniques.length
    const angle = new Map<string, number>()
    const arcs: { family: string; start: number; end: number }[] = []
    let cursor = -90
    for (const family of data.ring.families) {
      const ids = data.ring.techniques.filter((id) => model.names.get(id)?.family === family)
      ids.forEach((id, index) => angle.set(id, ((cursor + per * (index + 0.5)) * Math.PI) / 180))
      arcs.push({ family, start: (cursor * Math.PI) / 180, end: ((cursor + per * ids.length) * Math.PI) / 180 })
      cursor += per * ids.length + GAP
    }
    return { angle, arcs }
  }, [data, model])
  const { selection, live, chosen, label, press } = sel
  const chordKeys = Object.keys(data.pairs)

  return <section className="ring-view" aria-label="Methods and the theorems they prove">
    <SelectionBar sel={sel} results={results} lead={`${data.theorems.filter((theorem) => theorem.usableRoutes >= 1).length} theorems, ${data.vocabulary.techniques.length} proof methods. Click a method, or a chord between two methods.`} />
    <svg className="ring-svg" viewBox="0 0 680 600" role="group" aria-label="Proof methods arranged on a ring, grouped by domain">
      {layout.arcs.map((arc) => {
        const [x0, y0] = at(arc.start, RADIUS + 7), [x1, y1] = at(arc.end, RADIUS + 7), mid = (arc.start + arc.end) / 2, [lx, ly] = [CX + Math.cos(mid) * 292, CY + Math.sin(mid) * (RADIUS + 112)], cos = Math.cos(mid)
        return <g key={arc.family}>
          <path d={`M${fixed(x0)},${fixed(y0)}A${RADIUS + 7},${RADIUS + 7} 0 0 1 ${fixed(x1)},${fixed(y1)}`} fill="none" stroke={familyColor[arc.family]} strokeWidth="4" strokeLinecap="round" />
          <text x={fixed(lx)} y={fixed(ly + 4)} textAnchor={cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'} className="ring-family" style={{ fill: familyColor[arc.family] }}>{familyName[arc.family]}</text>
        </g>
      })}
      {Object.keys(data.triples).map((key) => {
        const item = `t:${key}`, ids = key.split('|'), on = chosen.has(item), isLive = live.triples.has(key), strong = model.triples.get(key)!.size >= 2
        const path = ids.map((id) => at(layout.angle.get(id)!, RADIUS)).map(([x, y]) => `${fixed(x)},${fixed(y)}`).join('L')
        return <path key={item} className="ring-triangle" d={`M${path}Z`} fill="#ae6b1f" stroke="#ae6b1f"
          fillOpacity={on ? 0.42 : isLive ? (selection.length ? 0.24 : strong ? 0.2 : 0.07) : 0.02} strokeOpacity={on ? 1 : isLive ? (selection.length ? 0.7 : strong ? 0.35 : 0.18) : 0.05} strokeWidth={on ? 2 : 1}
          aria-label={`${label(item)}, three routes`} {...press(item)}><title>{label(item)}</title></path>
      })}
      {chordKeys.map((key) => {
        const item = `e:${key}`, [a, b] = key.split('|'), on = chosen.has(item), isLive = live.edges.has(key), n = model.pairs.get(key)!.size
        const [x0, y0] = at(layout.angle.get(a)!, RADIUS), [x1, y1] = at(layout.angle.get(b)!, RADIUS)
        const cx = CX + ((x0 + x1) / 2 - CX) * 0.2, cy = CY + ((y0 + y1) / 2 - CY) * 0.2
        const same = model.names.get(a)?.family === model.names.get(b)?.family
        const d = `M${fixed(x0)},${fixed(y0)}Q${fixed(cx)},${fixed(cy)} ${fixed(x1)},${fixed(y1)}`
        return <g key={item}>
          <path d={d} fill="none" strokeLinecap="round" stroke={on ? '#ae6b1f' : same ? familyColor[model.names.get(a)!.family] : '#6e665d'}
            strokeWidth={(1.1 + Math.min(n, 6) * 0.9) + (on ? 2.4 : 0)} strokeOpacity={on ? 1 : isLive ? (selection.length ? 0.85 : n >= 2 ? 0.6 : 0.3) : 0.06} />
          <path d={d} fill="none" stroke="transparent" strokeWidth="10" className="ring-hit" aria-label={`${label(item)}, ${n} theorem${n === 1 ? '' : 's'}`} {...press(item)}>
            <title>{label(item)}: {n} theorem{n === 1 ? '' : 's'}</title>
          </path>
        </g>
      })}
      {layout.arcs.flatMap((arc) => data.ring.techniques.filter((id) => model.names.get(id)?.family === arc.family)).map((id) => {
        const item = `v:${id}`, a = layout.angle.get(id)!, [x, y] = at(a, RADIUS), [lx, ly] = at(a, RADIUS + 14)
        const n = model.uses.get(id) ?? 0, on = chosen.has(item), right = Math.cos(a) >= 0, degrees = (a * 180) / Math.PI + (right ? 0 : 180)
        const faded = selection.length > 0 && !live.methods.has(id) && !on
        return <g key={item} className="ring-node" opacity={faded ? 0.2 : 1} aria-label={`${model.names.get(id)?.short}, ${n} theorem${n === 1 ? '' : 's'}`} {...press(item)}>
          <title>{model.names.get(id)?.label}</title>
          <circle className="ring-dot" cx={fixed(x)} cy={fixed(y)} r={2.4 + Math.min(n, 14) * 0.5} fill={n ? familyColor[model.names.get(id)!.family] : '#cbc2b4'} stroke={on ? '#282522' : 'none'} strokeWidth={on ? 3 : 0} />
          <circle cx={fixed(x)} cy={fixed(y)} r="8" fill="transparent" />
          <text x={fixed(lx)} y={fixed(ly)} dy="4" transform={`rotate(${fixed(degrees)} ${fixed(lx)} ${fixed(ly)})`} textAnchor={right ? 'start' : 'end'} className="ring-label" style={{ fill: n ? '#332d26' : '#a69d91' }}>{model.names.get(id)?.short}</text>
        </g>
      })}
    </svg>
    <ResultsPanel sel={sel} model={model} catalog={catalog} results={results} onOpenEntry={onOpenEntry}
      hint="You get the theorems whose proofs use it. Keep clicking: only theorems that use everything you picked stay, and the rest of the ring fades. A chord joins two methods that distinguish two different routes of the same theorem. Thicker, darker chords are shared by more theorems." />
    <MethodList data={data} model={model} sel={sel} />
    <p className="ring-note">Chord thickness is the number of theorems; dot size is the number of theorems using the method. Methods are tagged by two independent reviewers from the proof sketches, so they are inferred, not source-verified. Routes judged duplicate, dependent or incomplete are left out, so counts are lower than the catalog's.</p>
  </section>
}

export default function MethodRing({ catalog, onOpenEntry }: { catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const { data, model, error } = useMethodData()
  if (error) return <div className="collection-offline" role="alert">The method ring is unavailable. {error}</div>
  if (!data || !model) return <div className="ring-loading" aria-live="polite">Loading the method index…</div>
  return <RingBody data={data} model={model} catalog={catalog} onOpenEntry={onOpenEntry} />
}
