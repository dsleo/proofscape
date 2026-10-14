import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Catalog } from './historicalShared'
import { familyName, fixed, MethodList, ResultsPanel, SelectionBar, useMethodData, useMethodSelection, useResultsRef } from './methodShared'
import type { MethodData, MethodModel } from './methodShared'
import { terrain } from './worldTerrain'
import './world.css'

type P = [number, number]
type Anchor = 'start' | 'end' | 'middle'

// Flat, saturated continents on a pale sea, after the Langlands illustrations: one hue per domain of method.
const palette: Record<string, { land: string; halo: string; light: string; dark: string }> = {
  analytic: { land: '#4a78dc', halo: '#cfd9f3', light: '#8fb0ee', dark: '#233f94' },
  algebraic: { land: '#e8664f', halo: '#f5cdc5', light: '#f4a090', dark: '#a8321f' },
  geometric: { land: '#2fb39b', halo: '#c5eae1', light: '#85d9c6', dark: '#157564' },
  discrete: { land: '#62ad4e', halo: '#d5ebd0', light: '#a3d894', dark: '#2f7326' },
  recursion: { land: '#eba73e', halo: '#f7e3b9', light: '#f6c97c', dark: '#a8681a' },
  logic: { land: '#9168cc', halo: '#ded2f2', light: '#bc9bea', dark: '#5a3597' },
}
const SEA = '#ebe6ee', PAPER = '#fffdf5', INK = '#2b2a3a', GOLD = '#ffd23f', KEY = 'proofscape.world.explored'
const MAX_ZOOM = 8, MARGIN = 90

const fade = (k: number, a: number, b: number) => Math.max(0, Math.min(1, (k - a) / (b - a)))

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

function smooth(points: P[]) {
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points[points.length - 1], points[0])
  let d = `M${fixed(start[0])},${fixed(start[1])}`
  points.forEach((p, i) => { const e = mid(p, points[(i + 1) % points.length]); d += `Q${fixed(p[0])},${fixed(p[1])} ${fixed(e[0])},${fixed(e[1])}` })
  return `${d}Z`
}

const quad = (a: P, c: P, b: P, n = 14): P[] => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n
  return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]] as P
})
const polyline = (pts: P[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${fixed(p[0])},${fixed(p[1])}`).join('')
const disc = (x: number, y: number, r: number) => `M${fixed(x - r)},${fixed(y)}a${fixed(r)},${fixed(r)} 0 1,0 ${fixed(2 * r)},0a${fixed(r)},${fixed(r)} 0 1,0 ${fixed(-2 * r)},0Z`
function waypoints(pts: P[], every = 72): P[] {
  const out: P[] = []
  let run = every / 2
  for (let i = 1; i < pts.length; i++) {
    run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (run >= every) { out.push(pts[i]); run = 0 }
  }
  return out
}

/** A banner with folded tails, centred on the origin: island names and the map title. */
function Ribbon({ text, size, ink = INK, tail = '#d9d2e0', color = INK }: { text: string; size: number; ink?: string; tail?: string; color?: string }) {
  const w = text.length * size * 0.72 + size * 1.8, h = size * 1.75, t = size * 1.5, d = h * 0.24, n = size * 0.6
  const side = (s: 1 | -1) => `M${s * w / 2 - s * 4},${-h / 2 + d}H${s * (w / 2 + t)}L${s * (w / 2 + t - n)},${d}L${s * (w / 2 + t)},${h / 2 + d}H${s * w / 2 - s * 4}Z`
  return <g>
    <path d={side(-1)} fill={tail} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
    <path d={side(1)} fill={tail} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={PAPER} stroke={ink} strokeWidth="1.5" />
    <text className="world-ribbon" y={size * 0.34} textAnchor="middle" fontSize={size} style={{ fill: color }}>{text}</text>
  </g>
}

function readExplored() {
  try { return new Set<string>(JSON.parse(window.localStorage.getItem(KEY) ?? '[]')) } catch { return new Set<string>() }
}

function WorldBody({ data, model, catalog, onOpenEntry }: { data: MethodData; model: MethodModel; catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const sel = useMethodSelection(data, model)
  const results = useResultsRef()
  const [W, H] = data.world.size ?? [1000, 720]
  const stage = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState({ w: 1200, h: 760 })
  const [view, setView] = useState({ k: 1, x: 0, y: 0, glide: false })
  const [explored, setExplored] = useState(readExplored)
  const [hint, setHint] = useState(true)
  const [measured, setMeasured] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const seen = useRef(0)
  const { selection, live, chosen, label, press } = sel

  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => { setBox({ w: Math.max(320, node.clientWidth), h: Math.max(420, node.clientHeight) }); setMeasured(true) }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [])

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
    const radius = (use: number) => 6 + Math.min(use, 14) * 0.7
    const islands = Object.entries(data.world.islands).map(([family, boxed]) => {
      const mine = sites.filter((s) => s.family === family)
      const pts = mine.map((s): P => [s.x, s.y])
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
      let h = hull(pts)
      if (h.length < 3) h = [[cx - 30, cy], [cx + 30, cy], [cx, cy - 30], [cx, cy + 30]]
      const pad = pts.length < 6 ? 78 : 62, rnd = seeded(family), ring: P[] = []
      h.forEach((p, i) => {
        const q = h[(i + 1) % h.length], steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 16))
        for (let t = 0; t < steps; t++) {
          const u = t / steps, x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, e = pad + (rnd() * 2 - 1) * 12
          ring.push([x + (dx / d) * e, y + (dy / d) * e])
        }
      })
      const land = terrain(family, ring, [cx, cy], pts, seeded(`${family}-terrain`))
      const art = seeded(`${family}-islets`)
      let islets = '', specks = ''
      for (let n = 0; n < 12; n++) {
        const p = ring[Math.floor(art() * ring.length)], dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1, out = 26 + art() * 52
        const x = p[0] + (dx / d) * out, y = p[1] + (dy / d) * out
        islets += `${disc(x, y, 5 + art() * 11)}${disc(x + (art() - 0.5) * 22, y + (art() - 0.5) * 16, 3 + art() * 6)}`
        if (n % 2) specks += disc(p[0] + (dx / d) * (8 + art() * 14), p[1] + (dy / d) * (8 + art() * 14), 3 + art() * 6)
      }
      return { family, cx: boxed.x, cy: boxed.y, r: boxed.r, top: Math.min(...ring.map((p) => p[1])), bottom: Math.max(...ring.map((p) => p[1])), path: smooth(ring), halo: smooth(land.ripples[1]), islets, specks, land }
    })
    const byFamily = new Map(islands.map((i) => [i.family, i]))
    const siteOf = new Map(sites.map((s) => [s.id, s]))
    const lanes = new Map<string, P[]>()
    const bridges = [...model.bridges.entries()].map(([key, chordKeys]) => {
      const [fa, fb] = key.split('|'), A = byFamily.get(fa)!, B = byFamily.get(fb)!
      const dx = B.cx - A.cx, dy = B.cy - A.cy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux
      const bx = A.cx + ux * A.r * 0.96, by = A.cy + uy * A.r * 0.96, ex = B.cx - ux * B.r * 0.96, ey = B.cy - uy * B.r * 0.96
      const total = chordKeys.reduce((sum, k) => sum + (model.pairs.get(k)?.size ?? 0), 0)
      const dw = Math.max(9, Math.min(24, 7 + total * 0.4)), m = chordKeys.length, pitch = Math.min(6, (dw - 3) / Math.max(1, m - 1))
      chordKeys.forEach((k, idx) => {
        const off = (idx - (m - 1) / 2) * pitch
        let [a, b] = k.split('|').map((id) => siteOf.get(id)!)
        if (a.family !== fa) [a, b] = [b, a]
        const ha: P = [bx + px * off, by + py * off], hb: P = [ex + px * off, ey + py * off]
        lanes.set(k, [...quad([a.x, a.y], [ha[0] - ux * 38, ha[1] - uy * 38], ha, 10), ...quad(hb, [hb[0] + ux * 38, hb[1] + uy * 38], [b.x, b.y], 10)])
      })
      const hw = dw / 2
      const deck = `M${fixed(bx + px * hw)},${fixed(by + py * hw)}L${fixed(ex + px * hw)},${fixed(ey + py * hw)}L${fixed(ex - px * hw)},${fixed(ey - py * hw)}L${fixed(bx - px * hw)},${fixed(by - py * hw)}Z`
      const at = (t: number): P => [bx + (ex - bx) * t, by + (ey - by) * t]
      const [t1, t2] = [0.2, 0.8], th = Math.min(74, 26 + L * 0.06 + dw)
      const T1 = at(t1), T2 = at(t2), top1: P = [T1[0], T1[1] - th], top2: P = [T2[0], T2[1] - th]
      const midX = (top1[0] + top2[0]) / 2, midY = (top1[1] + top2[1]) / 2 + 38
      const cable = `M${fixed(bx)},${fixed(by - 2)}L${fixed(top1[0])},${fixed(top1[1])}Q${fixed(midX)},${fixed(midY)} ${fixed(top2[0])},${fixed(top2[1])}L${fixed(ex)},${fixed(ey - 2)}`
      let hangers = ''
      for (let i = 1; i <= 9; i++) {
        const u = i / 10, x = top1[0] + (top2[0] - top1[0]) * u
        const cy = (1 - u) * (1 - u) * top1[1] + 2 * (1 - u) * u * midY + u * u * top2[1]
        hangers += `M${fixed(x)},${fixed(cy)}V${fixed(at(t1 + (t2 - t1) * u)[1])}`
      }
      const towers = [[T1, top1], [T2, top2]].map(([base, top]) => `M${fixed(base[0])},${fixed(base[1])}L${fixed(top[0])},${fixed(top[1])}`).join('')
      const cloud = seeded(key)
      let clouds = ''
      for (let n = 0; n < Math.max(5, Math.round(L / 46)); n++) {
        const [x, y] = at(0.08 + (0.84 * n) / Math.max(1, Math.round(L / 46) - 1))
        clouds += disc(x + (cloud() - 0.5) * 18, y + 8 + (cloud() - 0.5) * 22, 14 + cloud() * 14)
      }
      const [mx, my] = at(0.5)
      return { key, deck, cable, hangers, towers, clouds, mid: [mx, my - th * 0.35] as P, count: m }
    })
    const chords = Object.keys(data.pairs).map((key) => {
      const [a, b] = key.split('|').map((id) => siteOf.get(id)!)
      let pts = lanes.get(key)
      if (!pts) {
        const home = byFamily.get(a.family)!, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, vx = mx - home.cx, vy = my - home.cy, vl = Math.hypot(vx, vy) || 1
        pts = quad([a.x, a.y], [mx + (vx / vl) * 18, my + (vy / vl) * 18], [b.x, b.y], 16)
      }
      return { key, d: polyline(pts), dots: waypoints(pts), cross: lanes.has(key), n: model.pairs.get(key)!.size }
    })
    const placed: number[][] = sites.map((s) => { const r = radius(s.use); return [s.x - r, s.y - r, s.x + r, s.y + r] })
    const labels = new Map<string, { x: number; y: number; anchor: Anchor }>()
    const overlap = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
    for (const s of [...sites].sort((a, b) => b.use - a.use)) {
      const r = radius(s.use), w = s.short.length * 9.6 + 12, h = 24
      const options: { x: number; y: number; anchor: Anchor; box: number[] }[] = [
        { x: s.x + r + 6, y: s.y + 7, anchor: 'start', box: [s.x + r + 6, s.y - 15, s.x + r + 6 + w, s.y + 9] },
        { x: s.x - r - 6, y: s.y + 7, anchor: 'end', box: [s.x - r - 6 - w, s.y - 15, s.x - r - 6, s.y + 9] },
        { x: s.x, y: s.y - r - 8, anchor: 'middle', box: [s.x - w / 2, s.y - r - 8 - h + 5, s.x + w / 2, s.y - r - 8 + 5] },
        { x: s.x, y: s.y + r + 22, anchor: 'middle', box: [s.x - w / 2, s.y + r + 4, s.x + w / 2, s.y + r + 4 + h] },
      ]
      for (const option of options) {
        const own = [s.x - r, s.y - r, s.x + r, s.y + r]
        if (option.box[0] > 20 && option.box[2] < W - 20 && !placed.some((b) => b.join() !== own.join() && overlap(option.box, b))) {
          placed.push(option.box); labels.set(s.id, option); break
        }
      }
    }
    const sea = seeded('sea')
    let wisps = '', puffs = ''
    for (let tries = 0, n = 0; tries < 600 && n < 70; tries++) {
      const x = 30 + sea() * (W - 60), y = 30 + sea() * (H - 60)
      if (islands.some((i) => Math.hypot(i.cx - x, i.cy - y) < i.r + 50)) continue
      n++
      const w = 14 + sea() * 26
      if (n % 7 === 0) puffs += `${disc(x, y, 9 + sea() * 8)}${disc(x + 14, y + 4, 7 + sea() * 7)}${disc(x - 13, y + 5, 6 + sea() * 6)}`
      else wisps += `M${fixed(x)},${fixed(y)}q${fixed(w / 2)},-5 ${fixed(w)},0q${fixed(-w / 2)},4 ${fixed(-w)},0Z`
    }
    const x0 = Math.min(...islands.map((i) => i.cx - i.r)) - 70, x1 = Math.max(...islands.map((i) => i.cx + i.r)) + 70
    const y0 = Math.min(...islands.map((i) => i.top)) - 130, y1 = Math.max(...islands.map((i) => i.bottom)) + 90
    return { sites, islands, bridges, chords, labels, radius, wisps, puffs, bounds: { x0, y0, w: x1 - x0, h: y1 - y0 } }
  }, [data, model, W, H])

  const { x0: bx, y0: by, w: bw, h: bh } = world.bounds
  const fit = Math.min(box.w / bw, box.h / bh) * 0.98
  // where the map sits when it is centred, and where it ends up once panned and kept on screen
  const centred = (s: number) => ({ cx: (box.w - bw * s) / 2 - bx * s, cy: (box.h - bh * s) / 2 - by * s })
  const geometry = (k: number, x: number, y: number) => {
    const s = fit * k, c = centred(s)
    const axis = (extent: number, size: number, pan: number, home: number) => size <= extent ? home : Math.min(MARGIN, Math.max(extent - size - MARGIN, home + pan))
    return { s, tx: axis(box.w, bw * s, x, c.cx), ty: axis(box.h, bh * s, y, c.cy), cx: c.cx, cy: c.cy }
  }
  const { s: scale, tx, ty } = geometry(view.k, view.x, view.y)
  const k = view.k

  function zoomTo(nextK: number, px: number, py: number, glide: boolean) {
    setHint(false)
    setView((v) => {
      const cur = geometry(v.k, v.x, v.y)
      const kk = Math.min(MAX_ZOOM, Math.max(1, nextK))
      const s = fit * kk, wx = (px - cur.tx) / cur.s, wy = (py - cur.ty) / cur.s
      const c = centred(s)
      return { k: kk, x: px - wx * s - c.cx, y: py - wy * s - c.cy, glide }
    })
  }
  function flyTo(wx: number, wy: number, span: number) {
    const kk = Math.min(MAX_ZOOM, Math.max(1, Math.min(box.w, box.h) / (span * fit)))
    const s = fit * kk
    const c = centred(s)
    setView({ k: kk, x: box.w / 2 - wx * s - c.cx, y: box.h / 2 - wy * s - c.cy, glide: true })
  }

  useEffect(() => {
    const node = svg.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      zoomTo(view.k * (event.deltaY < 0 ? 1.18 : 1 / 1.18), event.clientX - rect.left, event.clientY - rect.top, false)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  // selecting a whole island or bridge carries the view there
  useEffect(() => {
    if (!measured) return
    if (selection.length > seen.current) {
      const last = selection[selection.length - 1]
      if (last.startsWith('i:')) {
        const island = world.islands.find((i) => i.family === last.slice(2))
        if (island) flyTo(island.cx, island.cy, island.r * 2.6)
      } else if (last.startsWith('b:')) {
        const [a, b] = last.slice(2).split(/[|~]/).map((f) => world.islands.find((i) => i.family === f))
        if (a && b) flyTo((a.cx + b.cx) / 2, (a.cy + b.cy) / 2, Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy)) + 380)
      }
    }
    seen.current = selection.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, measured])

  function down(event: ReactPointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest('[data-world-item]') || view.k === 1) return
    drag.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y
    drag.current = { x: event.clientX, y: event.clientY }
    setView((v) => {
      const cur = geometry(v.k, v.x, v.y)
      return { ...v, x: cur.tx + dx - cur.cx, y: cur.ty + dy - cur.cy, glide: false }
    })
  }

  // progressive detail: what is shown depends on how far in the view is
  const siteFloor = k < 1.35 ? 6 : k < 2 ? 3 : k < 3 ? 2 : 1
  const labelFloor = k < 1.35 ? 9 : k < 2 ? 5 : k < 3 ? 3 : 1
  const tone = (k: number) => 1 / Math.pow(Math.max(1, k), 0.55)
  const lettering = tone(k)
  const dim = selection.length > 0

  return <section className="ring-view world-view" aria-label="A world of proof methods and the theorems they prove">
    <SelectionBar sel={sel} results={results} lead={`${data.theorems.filter((theorem) => theorem.usableRoutes >= 1).length} theorems, ${data.vocabulary.techniques.length} methods, ${data.ring.families.length} islands. Zoom in to discover more; click a method, a trail, a bridge or an island name.`} />
    <div className="world-frame" ref={stage}>
      <svg ref={svg} className="world-svg" width={box.w} height={box.h} role="group" aria-label="A map of islands of proof methods joined by bridges"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest('[data-world-item]')) return
          const rect = event.currentTarget.getBoundingClientRect()
          zoomTo(view.k * 2, event.clientX - rect.left, event.clientY - rect.top, true)
        }}
        style={{ '--k': k } as React.CSSProperties}>
        <rect width={box.w} height={box.h} fill={SEA} />
        <g className="world-camera" style={{ transform: `translate(${fixed(tx)}px, ${fixed(ty)}px) scale(${scale.toFixed(4)})`, transition: view.glide ? 'transform .6s cubic-bezier(.2,.7,.2,1)' : 'none' }}>
          <g pointerEvents="none">
            <path d={world.wisps} fill="#fff" fillOpacity="0.75" />
            <path d={world.puffs} fill="#fff" fillOpacity="0.8" />
            {world.islands.map((i) => {
              const c = palette[i.family]
              return <g key={i.family}>
                <path d={i.halo} fill={c.halo} fillOpacity="0.75" />
                <path d={i.islets} fill={c.halo} fillOpacity="0.9" />
                <path d={i.specks} fill={c.light} fillOpacity="0.9" />
                <path d={i.path} fill={c.dark} fillOpacity="0.35" transform="translate(0 7)" />
                <path d={i.path} fill={c.land} />
                <path className="world-minor" d={i.land.minor} fill="none" stroke={c.light} strokeWidth="0.9" strokeLinecap="round" />
                <path className="world-major" d={i.land.major} fill="none" stroke={c.dark} strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
                {i.land.rivers.map((r, n) => <path key={n} className="world-river" d={r.water} fill="none" stroke="#e4f3f7" strokeWidth="4" strokeLinecap="round" />)}
                <path className="world-trees" d={i.land.trees} fill={c.dark} fillOpacity="0.6" stroke={c.dark} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d={i.land.mountains} fill={c.light} stroke={c.dark} strokeWidth="1.3" strokeLinejoin="round" />
                <path d={i.land.hatch} fill="none" stroke={c.dark} strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round" />
                <path d={i.land.ink} fill="#fff" fillOpacity="0.9" stroke={c.dark} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={i.path} fill="none" stroke={c.light} strokeWidth="2" strokeLinejoin="round" />
              </g>
            })}
          </g>
          {world.bridges.map((b) => {
            const item = `b:${b.key}`, on = chosen.has(item), faded = dim && !live.bridges.has(b.key) && !on
            const ink = on ? '#c4631a' : INK
            return <g key={b.key} data-world-item className="world-bridge" opacity={faded ? 0.22 : 1} aria-label={`${label(item)}, ${b.count} method pair${b.count === 1 ? '' : 's'}`} {...press(item)}>
              <title>{label(item)}: {b.count} method pairs</title>
              <path d={b.clouds} fill="#fff" fillOpacity="0.95" />
              <path d={b.deck} fill={PAPER} stroke={PAPER} strokeWidth="7" strokeLinejoin="round" />
              <path d={b.deck} fill={on ? '#ffe9b0' : PAPER} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
              <g opacity={fade(k, 1.35, 2.1)}>
                <path d={b.towers} fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
                <path d={b.cable} fill="none" stroke={ink} strokeWidth="1.6" />
                <path d={b.hangers} fill="none" stroke={ink} strokeWidth="1" strokeOpacity="0.75" />
              </g>
              <g className="world-count" opacity={1 - fade(k, 2.2, 3)} style={{ transform: `translate(${fixed(b.mid[0])}px, ${fixed(b.mid[1])}px) scale(${lettering.toFixed(3)})` }}>
                <circle r="14" fill={PAPER} stroke={ink} strokeWidth="1.4" />
                <text y="5" textAnchor="middle">{b.count}</text>
              </g>
            </g>
          })}
          {Object.keys(data.triples).map((key) => {
            const item = `t:${key}`, on = chosen.has(item), isLive = live.triples.has(key), strong = model.triples.get(key)!.size >= 2
            const path = key.split('|').map((id) => { const s = world.sites.find((site) => site.id === id)!; return `${s.x},${s.y}` }).join('L')
            const base = dim ? (isLive ? 0.55 * fade(k, 1.6, 2.6) : 0) : fade(k, 2.6, 3.6) * (strong ? 0.6 : 0.3)
            return <path key={item} data-world-item className="ring-triangle" d={`M${path}Z`} fill={GOLD} stroke={on ? INK : '#fff'} strokeDasharray="4 6" strokeLinecap="round"
              fillOpacity={on ? 0.3 : 0} strokeOpacity={on ? 1 : base} strokeWidth={on ? 2.6 : 1.4} pointerEvents={on || base > 0.1 ? undefined : 'none'}
              aria-label={`${label(item)}, three routes`} {...press(item)}><title>{label(item)}</title></path>
          })}
          {world.chords.map((c) => {
            const item = `e:${c.key}`, on = chosen.has(item), isLive = live.edges.has(c.key)
            const reveal = dim ? (isLive ? (c.n >= 2 || on ? 0.95 : fade(k, 2, 3) * 0.8) : 0) : c.n >= 3 ? fade(k, 1.5, 2.3) * 0.8 : c.n >= 2 ? fade(k, 2.3, 3.1) * 0.75 : fade(k, 3.2, 4) * 0.6
            const op = on ? 1 : reveal
            return <g key={item} opacity={op > 0 || on ? 1 : 0} pointerEvents={op > 0.08 || on ? undefined : 'none'}>
              {on && <path d={c.d} fill="none" stroke={INK} strokeWidth="6.4" strokeLinecap="round" strokeLinejoin="round" />}
              <path d={c.d} fill="none" strokeLinecap="round" stroke={on ? GOLD : '#fff'} strokeDasharray={on ? undefined : '8 6'} strokeWidth={on ? 3.6 : 1.4 + Math.min(c.n, 4) * 0.45} strokeOpacity={on ? 1 : op} />
              {(on || op > 0.5) && c.dots.map((p, n) => <circle key={n} cx={fixed(p[0])} cy={fixed(p[1])} r="4" fill="#fff" stroke={on ? INK : INK} strokeOpacity={on ? 1 : op} strokeWidth="1.4" />)}
              <path d={c.d} data-world-item fill="none" stroke="transparent" strokeWidth="14" className="ring-hit" aria-label={`${label(item)}, ${c.n} theorem${c.n === 1 ? '' : 's'}`} {...press(item)}>
                <title>{label(item)}: {c.n} theorem{c.n === 1 ? '' : 's'}</title>
              </path>
            </g>
          })}
          {world.sites.map((s) => {
            const item = `v:${s.id}`, on = chosen.has(item), isLive = live.methods.has(s.id)
            const shown = on || (dim ? isLive : s.use >= siteFloor), showLabel = on || (dim ? isLive && s.use >= labelFloor : s.use >= labelFloor)
            const l = world.labels.get(s.id), been = explored.has(s.id), r = world.radius(s.use), c = palette[s.family]
            return <g key={item} data-world-item className="world-site" opacity={shown ? (dim && !isLive && !on ? 0.3 : 1) : 0} pointerEvents={shown ? undefined : 'none'}
              aria-label={`${s.short}, ${s.use} theorem${s.use === 1 ? '' : 's'}`} {...press(item)}>
              <title>{model.names.get(s.id)?.label}</title>
              {on && <circle cx={s.x} cy={s.y} r={r + 9} fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="4 4" />}
              <circle cx={s.x} cy={s.y} r={r} fill={PAPER} stroke={on ? INK : c.dark} strokeWidth={on ? 3 : 2} />
              <circle cx={s.x} cy={s.y} r={Math.max(2.4, r * 0.4)} fill={been ? GOLD : c.dark} stroke={been ? INK : 'none'} strokeWidth="1" />
              {l && showLabel && <text className="world-label" x={fixed(l.x)} y={fixed(l.y)} textAnchor={l.anchor} style={{ stroke: c.dark, fontSize: `${(20 * lettering).toFixed(1)}px` }}>{s.short}</text>}
            </g>
          })}
          {world.islands.map((i) => {
            const item = `i:${i.family}`, on = chosen.has(item), faded = dim && !live.islands.has(i.family) && !on
            const away = world.bridges.reduce((sum, b) => {
              const [fa, fb] = b.key.split('|')
              if (fa !== i.family && fb !== i.family) return sum
              const other = world.islands.find((o) => o.family === (fa === i.family ? fb : fa))!
              return sum + Math.sign(other.cy - i.cy)
            }, 0)
            const below = away > 0 ? false : away < 0 ? true : i.cy > H / 2, c = palette[i.family]
            return <g key={item} data-world-item className="world-island-name" opacity={faded ? 0.4 : 1} aria-label={`${familyName[i.family]} island`} {...press(item)}
              transform={`translate(${fixed(i.cx)} ${fixed(below ? i.bottom + 34 : i.top - 26)}) scale(${(tone(k) ** 1.1).toFixed(3)})`}>
              <Ribbon text={familyName[i.family].toUpperCase()} size={21} color={on ? '#c4631a' : c.dark} ink={c.dark} tail={c.halo} />
            </g>
          })}
        </g>
        <g pointerEvents="none" opacity={1 - fade(k, 1.3, 2)} transform={`translate(${box.w / 2} 44)`}><Ribbon text="THE WORLD OF PROOF" size={24} /></g>
        <g pointerEvents="none" transform={`translate(${box.w - 74} ${box.h - 132})`}>
          <circle r="36" fill={PAPER} fillOpacity="0.8" stroke={INK} strokeWidth="1.2" />
          <path d="M0,-46L8,0L0,46L-8,0Z" fill={INK} /><path d="M-46,0L0,-7L46,0L0,7Z" fill="none" stroke={INK} strokeWidth="1.2" />
          <text y="-54" textAnchor="middle" className="world-compass">N</text>
        </g>
      </svg>
      <div className="world-pill" aria-live="polite">{explored.size} / {world.sites.length} methods explored</div>
      {hint && <div className="world-hint">Ctrl/⌘ + scroll, or double-click, to zoom in and discover more</div>}
      <div className="world-zoom" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoomTo(k * 1.6, box.w / 2, box.h / 2, true)} aria-label="Zoom in" disabled={k >= MAX_ZOOM}>+</button>
        <button type="button" onClick={() => zoomTo(k / 1.6, box.w / 2, box.h / 2, true)} aria-label="Zoom out" disabled={k <= 1}>−</button>
        <button type="button" onClick={() => setView({ k: 1, x: 0, y: 0, glide: true })} aria-label="Reset view" disabled={k === 1}>⌂</button>
      </div>
    </div>
    <ResultsPanel sel={sel} model={model} catalog={catalog} results={results} onOpenEntry={onOpenEntry}
      hint="Each island is a domain of method, and methods that appear in the same theorems sit closer together. Zoom in to reveal more methods, their names, and the trails between them. A trail inside an island, or a lane on a bridge between islands, is a chord: two methods that distinguish two routes of one theorem. Click a bridge or an island name to select it as a whole; the counter tracks the methods you have picked." />
    <MethodList data={data} model={model} sel={sel} />
    <p className="ring-note">Bridge numbers count the method pairs that cross; dot size is the number of theorems using the method. Methods are tagged by two independent reviewers from the proof sketches, so they are inferred, not source-verified. Routes judged duplicate, dependent or incomplete are left out.</p>
  </section>
}

export default function WorldMap({ catalog, onOpenEntry }: { catalog: Catalog; onOpenEntry: (id: number) => void }) {
  const { data, model, error } = useMethodData()
  if (error) return <div className="collection-offline" role="alert">The world map is unavailable. {error}</div>
  if (!data || !model) return <div className="ring-loading" aria-live="polite">Loading the method index…</div>
  return <WorldBody data={data} model={model} catalog={catalog} onOpenEntry={onOpenEntry} />
}
