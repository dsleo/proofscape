import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Catalog } from './historicalShared'
import { familyName, fixed, MethodList, ResultsPanel, SelectionBar, useMethodData, useMethodSelection, useResultsRef } from './methodShared'
import type { MethodData, MethodModel } from './methodShared'
import './world.css'

const INK = '#3a3022', AMBER = '#ae6b1f'
const island: Record<string, { stroke: string; fill: string }> = {
  logic: { stroke: '#7b5aa6', fill: '#d9ccec' }, recursion: { stroke: '#b8702d', fill: '#f3d6b0' }, discrete: { stroke: '#3f8a56', fill: '#c6e4cf' },
  algebraic: { stroke: '#b8404f', fill: '#f4c6cc' }, analytic: { stroke: '#2f5fae', fill: '#bcd2f1' }, geometric: { stroke: '#a08a1f', fill: '#eee3a8' },
}

function seeded(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296 }
}

function hull(points: [number, number][]) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = [], upper: [number, number][] = []
  for (const q of p) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (const q of [...p].reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  lower.pop(); upper.pop()
  return lower.concat(upper)
}

function smooth(points: [number, number][]) {
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points[points.length - 1], points[0])
  let d = `M${fixed(start[0])},${fixed(start[1])}`
  points.forEach((p, i) => { const e = mid(p, points[(i + 1) % points.length]); d += `Q${fixed(p[0])},${fixed(p[1])} ${fixed(e[0])},${fixed(e[1])}` })
  return `${d}Z`
}

function WorldBody({ data, model, catalog, onOpenEntry }: { data: MethodData; model: MethodModel; catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const sel = useMethodSelection(data, model)
  const results = useResultsRef()
  const [W, H] = data.world.size ?? [1000, 720]
  const svg = useRef<SVGSVGElement>(null)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const { selection, live, chosen, label, press } = sel

  const world = useMemo(() => {
    const sites = data.ring.techniques.map((id) => {
      const [x, y] = data.world.sites[id]
      return { id, x, y, family: model.names.get(id)!.family, short: model.names.get(id)!.short, use: model.uses.get(id) ?? 0 }
    })
    const radius = (use: number) => 5 + Math.min(use, 14) * 0.6
    const islands = Object.entries(data.world.islands).map(([family, box]) => {
      const mine = sites.filter((s) => s.family === family)
      const pts = mine.map((s): [number, number] => [s.x, s.y])
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
      let h = hull(pts)
      if (h.length < 3) h = [[cx - 30, cy], [cx + 30, cy], [cx, cy - 30], [cx, cy + 30]]
      const pad = pts.length < 6 ? 52 : 38, rnd = seeded(family), ring: [number, number][] = []
      h.forEach((p, i) => {
        const q = h[(i + 1) % h.length], steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 20))
        for (let t = 0; t < steps; t++) {
          const u = t / steps, x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, e = pad + (rnd() * 2 - 1) * 7
          ring.push([x + (dx / d) * e, y + (dy / d) * e])
        }
      })
      return { family, cx: box.x, cy: box.y, r: box.r, path: smooth(ring), top: Math.min(...ring.map((p) => p[1])) }
    })
    const byFamily = new Map(islands.map((i) => [i.family, i]))
    const siteOf = new Map(sites.map((s) => [s.id, s]))
    const lanes = new Map<string, string>()
    const bridges = [...model.bridges.entries()].map(([key, chordKeys]) => {
      const [fa, fb] = key.split('|'), A = byFamily.get(fa)!, B = byFamily.get(fb)!
      const dx = B.cx - A.cx, dy = B.cy - A.cy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux
      const bx = A.cx + ux * A.r * 0.95, by = A.cy + uy * A.r * 0.95, ex = B.cx - ux * B.r * 0.95, ey = B.cy - uy * B.r * 0.95
      const total = chordKeys.reduce((sum, k) => sum + (model.pairs.get(k)?.size ?? 0), 0)
      const dw = Math.max(7, Math.min(20, 5 + total * 0.4)), m = chordKeys.length, pitch = Math.min(5, (dw - 3) / Math.max(1, m - 1))
      chordKeys.forEach((k, idx) => {
        const off = (idx - (m - 1) / 2) * pitch
        let [a, b] = k.split('|').map((id) => siteOf.get(id)!)
        if (a.family !== fa) [a, b] = [b, a]
        const hax = bx + px * off, hay = by + py * off, hbx = ex + px * off, hby = ey + py * off
        lanes.set(k, `M${a.x},${a.y}Q${fixed(hax - ux * 38)},${fixed(hay - uy * 38)} ${fixed(hax)},${fixed(hay)}L${fixed(hbx)},${fixed(hby)}Q${fixed(hbx + ux * 38)},${fixed(hby + uy * 38)} ${b.x},${b.y}`)
      })
      const cab = dw / 2 + 9
      const cables = [1, -1].map((s) => `M${fixed(bx)},${fixed(by)}Q${fixed((bx + ex) / 2 + px * cab * s * 1.6)},${fixed((by + ey) / 2 + py * cab * s * 1.6)} ${fixed(ex)},${fixed(ey)}`)
      const towers = [0.22, 0.78].map((t) => {
        const tx = bx + (ex - bx) * t, ty = by + (ey - by) * t, h = dw / 2 + 10
        return `M${fixed(tx + px * h)},${fixed(ty + py * h)}L${fixed(tx - px * h)},${fixed(ty - py * h)}`
      })
      return { key, fa, fb, dw, deck: `M${fixed(bx)},${fixed(by)}L${fixed(ex)},${fixed(ey)}`, cables, towers, count: m }
    })
    const chords = Object.keys(data.pairs).map((key) => {
      const [a, b] = key.split('|').map((id) => siteOf.get(id)!)
      const lane = lanes.get(key)
      let d = lane
      if (!d) {
        const home = byFamily.get(a.family)!, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, vx = mx - home.cx, vy = my - home.cy, vl = Math.hypot(vx, vy) || 1
        d = `M${a.x},${a.y}Q${fixed(mx + (vx / vl) * 16)},${fixed(my + (vy / vl) * 16)} ${b.x},${b.y}`
      }
      return { key, d, cross: !!lane, family: a.family, n: model.pairs.get(key)!.size }
    })
    const placed: number[][] = sites.map((s) => { const r = radius(s.use); return [s.x - r, s.y - r, s.x + r, s.y + r] })
    const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle' }>()
    const overlap = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
    for (const s of [...sites].sort((a, b) => b.use - a.use)) {
      const r = radius(s.use), w = s.short.length * 10 + 8, h = 20
      const options: { x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: number[] }[] = [
        { x: s.x + r + 5, y: s.y + 7, anchor: 'start', box: [s.x + r + 5, s.y - 13, s.x + r + 5 + w, s.y + 7] },
        { x: s.x - r - 5, y: s.y + 7, anchor: 'end', box: [s.x - r - 5 - w, s.y - 13, s.x - r - 5, s.y + 7] },
        { x: s.x, y: s.y - r - 6, anchor: 'middle', box: [s.x - w / 2, s.y - r - 6 - h + 4, s.x + w / 2, s.y - r - 6 + 4] },
        { x: s.x, y: s.y + r + 19, anchor: 'middle', box: [s.x - w / 2, s.y + r + 4, s.x + w / 2, s.y + r + 4 + h] },
      ]
      for (const option of options) {
        const own = [s.x - r, s.y - r, s.x + r, s.y + r]
        if (option.box[0] > 2 && option.box[2] < W - 2 && !placed.some((box) => box.join() !== own.join() && overlap(option.box, box))) {
          placed.push(option.box); labels.set(s.id, option); break
        }
      }
    }
    const rnd = seeded('clouds')
    const clouds = Array.from({ length: 44 }, () => ({ x: rnd() * W, y: rnd() * H, rx: 44 + rnd() * 70, ry: 16 + rnd() * 26 }))
    return { sites, islands, bridges, chords, labels, clouds, radius }
  }, [data, model, W, H])

  useEffect(() => {
    const node = svg.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, ((event.clientX - rect.left) * W) / rect.width, ((event.clientY - rect.top) * H) / rect.height)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  const clamp = (k: number, x: number, y: number) => ({ k, x: Math.min(0, Math.max(W * (1 - k), x)), y: Math.min(0, Math.max(H * (1 - k), y)) })
  function zoomAt(factor: number, px = W / 2, py = H / 2) {
    setView((v) => {
      const k = Math.min(3.5, Math.max(1, v.k * factor))
      return clamp(k, px - (px - v.x) * (k / v.k), py - (py - v.y) * (k / v.k))
    })
  }
  function down(event: ReactPointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest('[data-world-item]') || view.k === 1) return
    drag.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = ((event.clientX - drag.current.x) * W) / rect.width, dy = ((event.clientY - drag.current.y) * H) / rect.height
    drag.current = { x: event.clientX, y: event.clientY }
    setView((v) => clamp(v.k, v.x + dx, v.y + dy))
  }

  return <section className="ring-view world-view" aria-label="A world of proof methods and the theorems they prove">
    <SelectionBar sel={sel} results={results} lead={`${data.theorems.filter((theorem) => theorem.usableRoutes >= 1).length} theorems, ${data.vocabulary.techniques.length} methods, ${data.ring.families.length} islands. Click a method, a road or bridge lane, a bridge, or an island name.`} />
    <div className="world-frame">
      <svg ref={svg} className="world-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Islands of proof methods joined by bridges" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        <rect width={W} height={H} fill="#e7e5de" />
        <g transform={`translate(${fixed(view.x)} ${fixed(view.y)}) scale(${view.k.toFixed(3)})`}>
          {world.clouds.map((c, i) => <ellipse key={i} cx={fixed(c.x)} cy={fixed(c.y)} rx={fixed(c.rx)} ry={fixed(c.ry)} fill="#d3d0c6" stroke="#c6c3b8" strokeWidth="1.5" />)}
          {world.islands.map((i) => <g key={i.family}>
            <path d={i.path} fill="none" stroke="#f7f3ea" strokeWidth="12" strokeLinejoin="round" />
            <path d={i.path} fill={island[i.family].fill} stroke={island[i.family].stroke} strokeWidth="2.4" />
          </g>)}
          {world.bridges.map((b) => {
            const item = `b:${b.key}`, on = chosen.has(item), faded = selection.length > 0 && !live.bridges.has(b.key) && !on
            return <g key={b.key} data-world-item className="world-bridge" opacity={faded ? 0.2 : 1} aria-label={`${label(item)}, ${b.count} method pair${b.count === 1 ? '' : 's'}`} {...press(item)}>
              <title>{label(item)}: {b.count} method pairs</title>
              <path d={b.deck} stroke={on ? AMBER : '#8d7b52'} strokeWidth={b.dw + 4} />
              <path d={b.deck} stroke="#eadfc2" strokeWidth={b.dw} />
              {b.cables.map((d, i) => <path key={i} d={d} fill="none" stroke="#6b5a3a" strokeWidth="1.6" />)}
              {b.towers.map((d, i) => <path key={i} d={d} stroke="#6b5a3a" strokeWidth="5" strokeLinecap="round" />)}
            </g>
          })}
          {Object.keys(data.triples).map((key) => {
            const item = `t:${key}`, on = chosen.has(item), isLive = live.triples.has(key), strong = model.triples.get(key)!.size >= 2
            const path = key.split('|').map((id) => { const s = world.sites.find((site) => site.id === id)!; return `${s.x},${s.y}` }).join('L')
            return <path key={item} data-world-item className="ring-triangle" d={`M${path}Z`} fill={AMBER} stroke={AMBER}
              fillOpacity={on ? 0.4 : isLive ? (selection.length ? 0.22 : strong ? 0.16 : 0.05) : 0.015} strokeOpacity={on ? 1 : isLive ? (selection.length ? 0.6 : 0.18) : 0.04} strokeWidth={on ? 2.5 : 1}
              aria-label={`${label(item)}, three routes`} {...press(item)}><title>{label(item)}</title></path>
          })}
          {world.chords.map((c) => {
            const item = `e:${c.key}`, on = chosen.has(item), isLive = live.edges.has(c.key)
            return <g key={item}>
              <path d={c.d} fill="none" strokeLinecap="round" stroke={on ? AMBER : c.cross ? INK : island[c.family].stroke}
                strokeWidth={1.2 + Math.min(c.n, 5) * 0.9 + (on ? 2.6 : 0)} strokeOpacity={on ? 1 : isLive ? (selection.length ? 0.9 : c.n >= 2 ? 0.6 : 0.3) : 0.07} />
              <path d={c.d} data-world-item fill="none" stroke="transparent" strokeWidth="12" className="ring-hit" aria-label={`${label(item)}, ${c.n} theorem${c.n === 1 ? '' : 's'}`} {...press(item)}>
                <title>{label(item)}: {c.n} theorem{c.n === 1 ? '' : 's'}</title>
              </path>
            </g>
          })}
          {world.sites.map((s) => {
            const item = `v:${s.id}`, on = chosen.has(item), faded = selection.length > 0 && !live.methods.has(s.id) && !on, l = world.labels.get(s.id)
            return <g key={item} data-world-item className="world-site" opacity={faded ? 0.25 : 1} aria-label={`${s.short}, ${s.use} theorem${s.use === 1 ? '' : 's'}`} {...press(item)}>
              <title>{model.names.get(s.id)?.label}</title>
              <circle cx={s.x} cy={s.y} r={world.radius(s.use)} fill="#fffdf8" stroke={on ? '#282522' : island[s.family].stroke} strokeWidth={on ? 4 : 2.4} />
              {l && <text className="world-label" x={fixed(l.x)} y={fixed(l.y)} textAnchor={l.anchor}>{s.short}</text>}
            </g>
          })}
          {world.islands.map((i) => {
            const item = `i:${i.family}`, on = chosen.has(item), faded = selection.length > 0 && !live.islands.has(i.family) && !on
            return <g key={item} data-world-item className="world-island-name" opacity={faded ? 0.3 : 1} aria-label={`${familyName[i.family]} island`} {...press(item)}>
              <text x={fixed(i.cx)} y={fixed(i.top - 10)} textAnchor="middle" style={{ fill: on ? AMBER : island[i.family].stroke }}>{familyName[i.family].toUpperCase()}</text>
            </g>
          })}
        </g>
        <path d={`M${W / 2 - 290},24H${W / 2 + 290}L${W / 2 + 266},50L${W / 2 + 290},76H${W / 2 - 290}L${W / 2 - 266},50Z`} fill="#f7f3ea" stroke={INK} strokeWidth="1.8" />
        <text className="world-title" x={W / 2} y="60" textAnchor="middle">THE WORLD OF PROOF</text>
        <circle cx="74" cy="74" r="46" fill="#f7f3ea" stroke={INK} strokeWidth="1.8" />
        <path d="M44,84H104M52,84V62M96,84V62M52,62Q74,78 96,62" fill="none" stroke={INK} strokeWidth="2.4" />
        <circle cx={W - 74} cy="74" r="46" fill="#f7f3ea" stroke={INK} strokeWidth="1.8" />
        <path d={`M${W - 74},38L${W - 66},74L${W - 74},110L${W - 82},74Z`} fill={INK} /><path d={`M${W - 110},74L${W - 74},82L${W - 38},74L${W - 74},66Z`} fill="none" stroke={INK} strokeWidth="1.8" />
      </svg>
      <div className="world-zoom" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoomAt(1.4)} aria-label="Zoom in" disabled={view.k >= 3.5}>+</button>
        <button type="button" onClick={() => zoomAt(1 / 1.4)} aria-label="Zoom out" disabled={view.k <= 1}>−</button>
        <button type="button" onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="Reset view" disabled={view.k === 1}>⌂</button>
      </div>
    </div>
    <ResultsPanel sel={sel} model={model} catalog={catalog} results={results} onOpenEntry={onOpenEntry}
      hint="Islands are domains of method. Methods that appear in the same theorems sit closer together. A road inside an island, or a lane on a bridge between islands, is a chord: two methods that distinguish two routes of one theorem. Click a bridge or an island name to select it as a whole. Hold Ctrl or Cmd and scroll to zoom." />
    <MethodList data={data} model={model} sel={sel} />
    <p className="ring-note">Bridge width shows how many theorems cross it; dot size is the number of theorems using the method. Methods are tagged by two independent reviewers from the proof sketches, so they are inferred, not source-verified. Routes judged duplicate, dependent or incomplete are left out.</p>
  </section>
}

export default function WorldMap({ catalog, onOpenEntry }: { catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const { data, model, error } = useMethodData()
  if (error) return <div className="collection-offline" role="alert">The world map is unavailable. {error}</div>
  if (!data || !model) return <div className="ring-loading" aria-live="polite">Loading the method index…</div>
  return <WorldBody data={data} model={model} catalog={catalog} onOpenEntry={onOpenEntry} />
}
