import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Catalog } from './historicalShared'
import { familyName, fixed, MethodList, ResultsPanel, SelectionBar, useMethodData, useMethodSelection, useResultsRef } from './methodShared'
import type { MethodData, MethodModel } from './methodShared'
import { islandArt, moon } from './worldArt'
import './world.css'

type P = [number, number]
const CHALK = '#f3efe6', NIGHT = '#080a10', ORANGE = '#f5a04a'
const land: Record<string, { top: string; light: string }> = {
  analytic: { top: '#23509c', light: '#8db4ff' }, algebraic: { top: '#9c2a43', light: '#ff8aa3' }, geometric: { top: '#1b7a72', light: '#6fe0d2' },
  discrete: { top: '#3b7a31', light: '#9be385' }, recursion: { top: '#a8672a', light: '#ffbf7a' }, logic: { top: '#65489a', light: '#c0a6ff' },
}
const KEY = 'proofscape.world.explored'

function seeded(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296 }
}

function hull(points: P[]) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: P[] = [], upper: P[] = []
  for (const q of p) { while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (const q of [...p].reverse()) { while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  lower.pop(); upper.pop()
  return lower.concat(upper)
}

function smooth(points: P[], dy = 0) {
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + dy]
  const start = mid(points[points.length - 1], points[0])
  let d = `M${fixed(start[0])},${fixed(start[1])}`
  points.forEach((p, i) => { const e = mid(p, points[(i + 1) % points.length]); d += `Q${fixed(p[0])},${fixed(p[1] + dy)} ${fixed(e[0])},${fixed(e[1])}` })
  return `${d}Z`
}

function readExplored() {
  try { return new Set<string>(JSON.parse(window.localStorage.getItem(KEY) ?? '[]')) } catch { return new Set<string>() }
}

function WorldBody({ data, model, catalog, onOpenEntry }: { data: MethodData; model: MethodModel; catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const sel = useMethodSelection(data, model)
  const results = useResultsRef()
  const [W, H] = data.world.size ?? [1000, 720]
  const HV = H + 70
  const svg = useRef<SVGSVGElement>(null)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [explored, setExplored] = useState(readExplored)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const { selection, live, chosen, label, press } = sel

  useEffect(() => {
    const picked = selection.filter((item) => 'vet'.includes(item[0])).flatMap((item) => item.slice(2).split('|'))
    if (!picked.some((id) => !explored.has(id))) return
    const next = new Set([...explored, ...picked])
    setExplored(next)
    try { window.localStorage.setItem(KEY, JSON.stringify([...next])) } catch { /* private mode: keep it in memory */ }
  }, [selection, explored])

  const world = useMemo(() => {
    const sites = data.ring.techniques.map((id) => {
      const [x, y] = data.world.sites[id]
      return { id, x, y, family: model.names.get(id)!.family, short: model.names.get(id)!.short, use: model.uses.get(id) ?? 0 }
    })
    const radius = (use: number) => 4 + Math.min(use, 14) * 0.5
    const islands = Object.entries(data.world.islands).map(([family, box]) => {
      const mine = sites.filter((s) => s.family === family)
      const pts = mine.map((s): P => [s.x, s.y])
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
      let h = hull(pts)
      if (h.length < 3) h = [[cx - 30, cy], [cx + 30, cy], [cx, cy - 30], [cx, cy + 30]]
      const pad = pts.length < 6 ? 78 : 62, rnd = seeded(family), ring: P[] = []
      h.forEach((p, i) => {
        const q = h[(i + 1) % h.length], steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 18))
        for (let t = 0; t < steps; t++) {
          const u = t / steps, x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, e = pad + (rnd() * 2 - 1) * 10
          ring.push([x + (dx / d) * e, y + (dy / d) * e])
        }
      })
      const art = islandArt(family, ring, [cx, cy], pts, seeded(`${family}-art`))
      const ys = ring.map((p) => p[1]), bottom = Math.max(...ys)
      const bottoms = ring.filter((p) => p[1] > bottom - 40).sort((a, b) => a[0] - b[0])
      const spikes = bottoms.filter((_, i) => i % Math.max(1, Math.floor(bottoms.length / 4)) === 0).slice(0, 5)
        .map((p) => `M${fixed(p[0] - 11)},${fixed(p[1] + 12)}L${fixed(p[0] + 11)},${fixed(p[1] + 12)}L${fixed(p[0] + 2)},${fixed(p[1] + 12 + 26 + (Math.round(p[0]) % 7) * 3)}Z`).join('')
      return { family, cx: box.x, cy: box.y, r: box.r, top: Math.min(...ys), path: smooth(ring), under: smooth(ring, 16), spikes, art }
    })
    const byFamily = new Map(islands.map((i) => [i.family, i]))
    const siteOf = new Map(sites.map((s) => [s.id, s]))
    const lanes = new Map<string, string>()
    const bridges = [...model.bridges.entries()].map(([key, chordKeys]) => {
      const [fa, fb] = key.split('|'), A = byFamily.get(fa)!, B = byFamily.get(fb)!
      const dx = B.cx - A.cx, dy = B.cy - A.cy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux
      const bx = A.cx + ux * A.r * 0.95, by = A.cy + uy * A.r * 0.95, ex = B.cx - ux * B.r * 0.95, ey = B.cy - uy * B.r * 0.95
      const total = chordKeys.reduce((sum, k) => sum + (model.pairs.get(k)?.size ?? 0), 0)
      const dw = Math.max(8, Math.min(22, 6 + total * 0.4)), m = chordKeys.length, pitch = Math.min(5, (dw - 3) / Math.max(1, m - 1))
      chordKeys.forEach((k, idx) => {
        const off = (idx - (m - 1) / 2) * pitch
        let [a, b] = k.split('|').map((id) => siteOf.get(id)!)
        if (a.family !== fa) [a, b] = [b, a]
        const hax = bx + px * off, hay = by + py * off, hbx = ex + px * off, hby = ey + py * off
        lanes.set(k, `M${a.x},${a.y}Q${fixed(hax - ux * 38)},${fixed(hay - uy * 38)} ${fixed(hax)},${fixed(hay)}L${fixed(hbx)},${fixed(hby)}Q${fixed(hbx + ux * 38)},${fixed(hby + uy * 38)} ${b.x},${b.y}`)
      })
      const hw = dw / 2
      const deck = `M${fixed(bx + px * hw)},${fixed(by + py * hw)}L${fixed(ex + px * hw)},${fixed(ey + py * hw)}L${fixed(ex - px * hw)},${fixed(ey - py * hw)}L${fixed(bx - px * hw)},${fixed(by - py * hw)}Z`
      const at = (t: number): P => [bx + (ex - bx) * t, by + (ey - by) * t]
      const [t1, t2] = [0.24, 0.76], th = 44 + dw
      const T1 = at(t1), T2 = at(t2), top1: P = [T1[0], T1[1] - th], top2: P = [T2[0], T2[1] - th]
      const midX = (top1[0] + top2[0]) / 2, midY = (top1[1] + top2[1]) / 2 + 36
      const cable = `M${fixed(bx)},${fixed(by - 2)}L${fixed(top1[0])},${fixed(top1[1])}Q${fixed(midX)},${fixed(midY)} ${fixed(top2[0])},${fixed(top2[1])}L${fixed(ex)},${fixed(ey - 2)}`
      let hangers = ''
      for (let i = 1; i <= 8; i++) {
        const u = i / 9, x = top1[0] + (top2[0] - top1[0]) * u
        const cy = (1 - u) * (1 - u) * top1[1] + 2 * (1 - u) * u * midY + u * u * top2[1]
        hangers += `M${fixed(x)},${fixed(cy)}V${fixed(at(t1 + (t2 - t1) * u)[1])}`
      }
      const towers = [[T1, top1], [T2, top2]].map(([base, top]) => `M${fixed(base[0])},${fixed(base[1])}L${fixed(top[0])},${fixed(top[1])}`).join('')
      return { key, deck, cable, hangers, towers, lanterns: [top1, top2], count: m }
    })
    const chords = Object.keys(data.pairs).map((key) => {
      const [a, b] = key.split('|').map((id) => siteOf.get(id)!)
      let d = lanes.get(key)
      if (!d) {
        const home = byFamily.get(a.family)!, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, vx = mx - home.cx, vy = my - home.cy, vl = Math.hypot(vx, vy) || 1
        d = `M${a.x},${a.y}Q${fixed(mx + (vx / vl) * 16)},${fixed(my + (vy / vl) * 16)} ${b.x},${b.y}`
      }
      return { key, d, cross: lanes.has(key), family: a.family, n: model.pairs.get(key)!.size }
    })
    const placed: number[][] = sites.map((s) => { const r = radius(s.use); return [s.x - r, s.y - r, s.x + r, s.y + r] })
    const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end' | 'middle' }>()
    const overlap = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
    for (const s of [...sites].sort((a, b) => b.use - a.use)) {
      const r = radius(s.use), w = s.short.length * 10.6 + 8, h = 22
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
    const sky = seeded('sky')
    const stars = Array.from({ length: 150 }, () => ({ x: sky() * W, y: sky() * HV, r: 0.6 + sky() * 1.1, o: 0.25 + sky() * 0.6 }))
    const moonPath = moon(W - 130, 150, 40, 200, seeded('moon'))
    const clouds: { x: number; y: number; s: number }[] = []
    for (let tries = 0; tries < 200 && clouds.length < 12; tries++) {
      const c = { x: sky() * W, y: 90 + sky() * (HV - 120), s: 0.7 + sky() * 0.8 }
      if (islands.some((i) => Math.hypot(i.cx - c.x, i.cy - c.y) < i.r + 70) || clouds.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 160)) continue
      clouds.push(c)
    }
    return { sites, islands, bridges, chords, labels, stars, moonPath, clouds, radius }
  }, [data, model, W, H, HV])

  useEffect(() => {
    const node = svg.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, ((event.clientX - rect.left) * W) / rect.width, ((event.clientY - rect.top) * HV) / rect.height)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  const clamp = (k: number, x: number, y: number) => ({ k, x: Math.min(0, Math.max(W * (1 - k), x)), y: Math.min(0, Math.max(HV * (1 - k), y)) })
  function zoomAt(factor: number, px = W / 2, py = HV / 2) {
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
    const dx = ((event.clientX - drag.current.x) * W) / rect.width, dy = ((event.clientY - drag.current.y) * HV) / rect.height
    drag.current = { x: event.clientX, y: event.clientY }
    setView((v) => clamp(v.k, v.x + dx, v.y + dy))
  }
  const toneProps = (tone: 'line' | 'faint' | 'accent' | 'tint' | 'dots') => tone === 'accent' ? { stroke: ORANGE, strokeOpacity: 0.9, strokeWidth: 1.8 } : tone === 'faint' ? { stroke: CHALK, strokeOpacity: 0.4, strokeWidth: 1.2 } : tone === 'dots' ? { stroke: CHALK, strokeOpacity: 0.42, strokeWidth: 2, fill: 'none' } : tone === 'tint' ? { stroke: CHALK, strokeOpacity: 0.3, strokeWidth: 1.1, fill: CHALK, fillOpacity: 0.07 } : { stroke: CHALK, strokeOpacity: 0.9, strokeWidth: 1.6 }

  return <section className="ring-view world-view" aria-label="A world of proof methods and the theorems they prove">
    <SelectionBar sel={sel} results={results} lead={`${data.theorems.filter((theorem) => theorem.usableRoutes >= 1).length} theorems, ${data.vocabulary.techniques.length} methods, ${data.ring.families.length} islands. Click a method, a road or bridge lane, a bridge, or an island name.`} />
    <div className="world-frame">
      <svg ref={svg} className="world-svg" viewBox={`0 0 ${W} ${HV}`} role="group" aria-label="Floating islands of proof methods joined by bridges" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        <rect width={W} height={HV} fill={NIGHT} />
        <g transform={`translate(${fixed(view.x)} ${fixed(view.y)}) scale(${view.k.toFixed(3)})`}>
          <g pointerEvents="none">
            {world.stars.map((s, i) => <circle key={i} cx={fixed(s.x)} cy={fixed(s.y)} r={s.r.toFixed(1)} fill={CHALK} opacity={s.o} />)}
            <path d={world.moonPath} stroke={CHALK} strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
            {world.clouds.map((c, i) => <path key={i} transform={`translate(${fixed(c.x)} ${fixed(c.y)}) scale(${c.s.toFixed(2)})`} d="M0,0H70a13,13 0 0 0 -3,-25a18,18 0 0 0 -34,-7a15,15 0 0 0 -28,15a11,11 0 0 0 -5,17Z" fill="none" stroke={CHALK} strokeOpacity="0.16" strokeWidth="1.4" />)}
          </g>
          {world.islands.map((i) => <g key={i.family} pointerEvents="none">
            <path d={i.under} fill="#0c1017" stroke={CHALK} strokeOpacity="0.35" strokeWidth="1.2" />
            <path d={i.spikes} fill="#0c1017" stroke={CHALK} strokeOpacity="0.3" strokeWidth="1" />
            <path d={i.path} fill={land[i.family].top} stroke={CHALK} strokeOpacity="0.9" strokeWidth="1.7" strokeLinejoin="round" />
            {i.art.map((a, n) => <path key={n} d={a.d} fill="none" strokeLinecap="round" strokeLinejoin="round" {...toneProps(a.tone)} />)}
          </g>)}
          {world.bridges.map((b) => {
            const item = `b:${b.key}`, on = chosen.has(item), faded = selection.length > 0 && !live.bridges.has(b.key) && !on
            const ink = on ? ORANGE : CHALK
            return <g key={b.key} data-world-item className="world-bridge" opacity={faded ? 0.18 : 1} aria-label={`${label(item)}, ${b.count} method pair${b.count === 1 ? '' : 's'}`} {...press(item)}>
              <title>{label(item)}: {b.count} method pairs</title>
              <path d={b.deck} fill="#0b0e14" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d={b.towers} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
              <path d={b.cable} fill="none" stroke={ink} strokeWidth="1.5" />
              <path d={b.hangers} fill="none" stroke={ink} strokeWidth="1" strokeOpacity="0.7" />
              {b.lanterns.map((p, n) => <circle key={n} cx={fixed(p[0])} cy={fixed(p[1])} r="4.5" fill={ORANGE} />)}
            </g>
          })}
          {Object.keys(data.triples).map((key) => {
            const item = `t:${key}`, on = chosen.has(item), isLive = live.triples.has(key), strong = model.triples.get(key)!.size >= 2
            const path = key.split('|').map((id) => { const s = world.sites.find((site) => site.id === id)!; return `${s.x},${s.y}` }).join('L')
            return <path key={item} data-world-item className="ring-triangle" d={`M${path}Z`} fill={ORANGE} stroke={ORANGE}
              fillOpacity={on ? 0.3 : isLive ? (selection.length ? 0.14 : 0) : 0} strokeOpacity={on ? 1 : isLive ? (selection.length ? 0.6 : strong ? 0.3 : 0.12) : 0.04} strokeWidth={on ? 2.5 : 1}
              aria-label={`${label(item)}, three routes`} {...press(item)}><title>{label(item)}</title></path>
          })}
          {world.chords.map((c) => {
            const item = `e:${c.key}`, on = chosen.has(item), isLive = live.edges.has(c.key)
            return <g key={item}>
              <path d={c.d} fill="none" strokeLinecap="round" stroke={on ? ORANGE : c.cross ? CHALK : land[c.family].light} strokeDasharray={c.cross || on ? undefined : '6 5'}
                strokeWidth={1.2 + Math.min(c.n, 5) * 0.8 + (on ? 2.4 : 0)} strokeOpacity={on ? 1 : isLive ? (selection.length ? 0.92 : c.n >= 2 ? 0.55 : 0.22) : 0.08} />
              <path d={c.d} data-world-item fill="none" stroke="transparent" strokeWidth="12" className="ring-hit" aria-label={`${label(item)}, ${c.n} theorem${c.n === 1 ? '' : 's'}`} {...press(item)}>
                <title>{label(item)}: {c.n} theorem{c.n === 1 ? '' : 's'}</title>
              </path>
            </g>
          })}
          {world.sites.map((s) => {
            const item = `v:${s.id}`, on = chosen.has(item), faded = selection.length > 0 && !live.methods.has(s.id) && !on, l = world.labels.get(s.id), seen = explored.has(s.id), r = world.radius(s.use)
            return <g key={item} data-world-item className="world-site" opacity={faded ? 0.28 : 1} aria-label={`${s.short}, ${s.use} theorem${s.use === 1 ? '' : 's'}`} {...press(item)}>
              <title>{model.names.get(s.id)?.label}</title>
              {on && <circle cx={s.x} cy={s.y} r={r + 7} fill="none" stroke={ORANGE} strokeWidth="2" strokeOpacity="0.8" />}
              <circle cx={s.x} cy={s.y} r={r} fill="#0b0e14" stroke={on ? ORANGE : land[s.family].light} strokeWidth={on ? 4 : 2.4} />
              {seen && <circle cx={s.x} cy={s.y} r={Math.max(2.4, r * 0.4)} fill={ORANGE} />}
              {l && <text className="world-label" x={fixed(l.x)} y={fixed(l.y)} textAnchor={l.anchor}>{s.short}</text>}
            </g>
          })}
          {world.islands.map((i) => {
            const item = `i:${i.family}`, on = chosen.has(item), faded = selection.length > 0 && !live.islands.has(i.family) && !on
            return <g key={item} data-world-item className="world-island-name" opacity={faded ? 0.3 : 1} aria-label={`${familyName[i.family]} island`} {...press(item)}>
              <text x={fixed(i.cx)} y={fixed(i.top - 14)} textAnchor="middle" style={{ fill: on ? ORANGE : land[i.family].light }}>{familyName[i.family].toUpperCase()}</text>
            </g>
          })}
        </g>
        <text className="world-title" x={W / 2} y="64" textAnchor="middle">The World of Proof</text>
      </svg>
      <div className="world-pill" aria-live="polite">{explored.size} / {world.sites.length} explored</div>
      <div className="world-zoom" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoomAt(1.4)} aria-label="Zoom in" disabled={view.k >= 3.5}>+</button>
        <button type="button" onClick={() => zoomAt(1 / 1.4)} aria-label="Zoom out" disabled={view.k <= 1}>−</button>
        <button type="button" onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="Reset view" disabled={view.k === 1}>⌂</button>
      </div>
    </div>
    <ResultsPanel sel={sel} model={model} catalog={catalog} results={results} onOpenEntry={onOpenEntry}
      hint="Each island is a domain of method, and methods that appear in the same theorems sit closer together. A dashed road inside an island, or a lane on a bridge between islands, is a chord: two methods that distinguish two routes of one theorem. Orange constellations are three rival routes. Click a bridge or an island name to select it as a whole; the counter tracks the methods you have picked. Hold Ctrl or Cmd and scroll to zoom." />
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
