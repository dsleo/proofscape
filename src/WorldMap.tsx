import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Catalog } from './historicalShared'
import { familyName, fixed, MethodList, ResultsPanel, SelectionBar, useMethodData, useMethodSelection, useResultsRef } from './methodShared'
import type { MethodData, MethodModel } from './methodShared'
import { MathText } from './MathText'
import { terrain } from './worldTerrain'
import './world.css'

type P = [number, number]
type Anchor = 'start' | 'end' | 'middle'

type Hue = { land: string; halo: string; light: string; dark: string; peak: string }
type Theme = {
  id: string; name: string; sea: string; paper: string; ink: string; accent: string; trail: string; water: string; wisp: string
  hue: (family: string) => Hue
  tree: (h: Hue) => string; hatchInk: (h: Hue) => string
  clouds: boolean; ripples: boolean; shade: number; treeFill: number; coast: number; label: { fill: string; halo: (h: Hue) => string }; grain: number
}
// Ink: the pencil-and-wash cream of the app's landscape illustration, one colour for every island.
const inkWash: Record<string, string> = { analytic: '#f0f4e6', algebraic: '#f7ece4', geometric: '#f2f1e2', discrete: '#f7f2d9', logic: '#f6eedb' }
const ink: Hue = { land: '#faf7ee', halo: '#ebe6d8', light: '#c4ccbb', dark: '#4a5446', peak: '#f4f1e5' }
// Colour: flat, saturated continents on a pale sea, after the Langlands illustrations, one hue per domain.
const colours: Record<string, Hue> = {
  analytic: { land: '#4a78dc', halo: '#cfd9f3', light: '#8fb0ee', dark: '#233f94', peak: '#8fb0ee' },
  algebraic: { land: '#e8664f', halo: '#f5cdc5', light: '#f4a090', dark: '#a8321f', peak: '#f4a090' },
  geometric: { land: '#2fb39b', halo: '#c5eae1', light: '#85d9c6', dark: '#157564', peak: '#85d9c6' },
  discrete: { land: '#62ad4e', halo: '#d5ebd0', light: '#a3d894', dark: '#2f7326', peak: '#a3d894' },
  logic: { land: '#9168cc', halo: '#ded2f2', light: '#bc9bea', dark: '#5a3597', peak: '#bc9bea' },
}
const themes: Theme[] = [
  { id: 'ink', name: 'Ink', sea: '#f2efe7', paper: '#fbf8f0', ink: '#3b4438', accent: '#ae6b1f', trail: '#8a5a2b', water: '#bdd0d4', wisp: '#dcd6c6', hue: (f) => ({ ...ink, land: inkWash[f] ?? ink.land }), tree: () => '#f9f6ec', hatchInk: (h) => h.dark, clouds: false, ripples: true, shade: 0.1, treeFill: 0, coast: 1.5, label: { fill: '#2d352b', halo: () => '#f2efe7' }, grain: 0.07 },
  { id: 'colour', name: 'Colour', sea: '#ebe6ee', paper: '#fffdf5', ink: '#2b2a3a', accent: '#ffd23f', trail: '#ffffff', water: '#e4f3f7', wisp: '#ffffff', hue: (f) => colours[f], tree: (h) => h.dark, hatchInk: () => '#ffffff', clouds: true, ripples: false, shade: 0.35, treeFill: 0.6, coast: 0, label: { fill: '#ffffff', halo: (h) => h.dark }, grain: 0.16 },
]
const THEME_KEY = 'proofscape.world.theme'
const MAX_ZOOM = 8, MARGIN = 90
const ROUTE_COLOURS = ['#ae6b1f', '#2f6f73', '#7a4a73', '#5f7a2f', '#8a3b3b']
const DRAWER = 460

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

const within = (p: P, poly: P[]) => {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
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
function Ribbon({ text, size, paper, ink, tail, color }: { text: string; size: number; paper: string; ink: string; tail: string; color: string }) {
  const w = text.length * size * 0.72 + size * 1.8, h = size * 1.75, t = size * 1.5, d = h * 0.24, n = size * 0.6
  const side = (s: 1 | -1) => `M${s * w / 2 - s * 4},${-h / 2 + d}H${s * (w / 2 + t)}L${s * (w / 2 + t - n)},${d}L${s * (w / 2 + t)},${h / 2 + d}H${s * w / 2 - s * 4}Z`
  return <g>
    <path d={side(-1)} fill={tail} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
    <path d={side(1)} fill={tail} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={paper} stroke={ink} strokeWidth="1.5" />
    <text className="world-ribbon" y={size * 0.34} textAnchor="middle" fontSize={size} style={{ fill: color }}>{text}</text>
  </g>
}

function WorldBody({ data, model, catalog, onOpenEntry, onClose }: { data: MethodData; model: MethodModel; catalog: Catalog; onOpenEntry: (id: number) => void; onClose?: () => void }) {
  const sel = useMethodSelection(data, model)
  const results = useResultsRef()
  const [W, H] = data.world.size ?? [1000, 720]
  const stage = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState({ w: 1200, h: 760 })
  // the camera lives in a ref and is applied straight to the DOM, so panning and zooming never wait for React;
  // only the zoom level, rounded to a twelfth, is state: it decides which details are drawn
  const viewRef = useRef({ k: 1, x: 0, y: 0, glide: false })
  const camera = useRef<SVGGElement>(null)
  const settle = useRef(0)
  const [lod, setLod] = useState(1)
  const [info, setInfo] = useState<{ item: string; x: number; y: number } | null>(null)
  const [hint, setHint] = useState(true)
  const [measured, setMeasured] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [hoverSite, setHoverSite] = useState<string | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const travel = useRef(0)
  const [themeId, setThemeId] = useState(() => { try { return window.localStorage.getItem(THEME_KEY) ?? 'ink' } catch { return 'ink' } })
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const { paper: PAPER, ink: INK, accent: GOLD, sea: SEA } = theme
  const drag = useRef<{ x: number; y: number } | null>(null)
  const seen = useRef(0)
  const { selection, live, chosen, label } = sel
  // one click shows a short note over the item; a double click (or the note's button) selects it and lists its theorems
  const choose = (item: string) => ({
    tabIndex: 0, role: 'button' as const,
    onClick: (event: React.MouseEvent) => {
      const rect = stage.current?.getBoundingClientRect()
      setInfo({ item, x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) })
    },
    onDoubleClick: () => { setInfo(null); sel.toggle(item) },
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setInfo(null); sel.toggle(item) } },
  })
  const clearAll = () => { setInfo(null); setDrawer(false); setFocus(null); setSearchOpen(false); if (selection.length) sel.clear() }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setInfo(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [])

  useEffect(() => { if (selection.length > 0) setDrawer(true) }, [selection.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => { setBox({ w: Math.max(320, node.clientWidth), h: Math.max(420, node.clientHeight) }); setMeasured(true) }
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [])

  const world = useMemo(() => {
    const sites = data.ring.techniques.map((id) => {
      const [x, y] = data.world.sites[id]
      return { id, x, y, family: model.names.get(id)!.family, short: model.names.get(id)!.short, use: model.uses.get(id) ?? 0 }
    })
    const radius = (use: number) => 12 + Math.min(use, 14) * 0.7
    // the symbol that stands for a method is as large as its mark allows, and always fits inside it
    const markFont = (s: { use: number; id: string }) => Math.min(1.7 * radius(s.use), (2.1 * radius(s.use)) / (Math.max(1, [...(model.names.get(s.id)?.glyph ?? '•')].length) * 0.6))
    const islands = Object.entries(data.world.islands).map(([family, boxed]) => {
      const mine = sites.filter((s) => s.family === family)
      const pts = mine.map((s): P => [s.x, s.y])
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
      let h = hull(pts)
      if (h.length < 3) h = [[cx - 30, cy], [cx + 30, cy], [cx, cy - 30], [cx, cy + 30]]
      const pad = pts.length < 6 ? 100 : 86, rnd = seeded(family), ring: P[] = []
      h.forEach((p, i) => {
        const q = h[(i + 1) % h.length], steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 16))
        for (let t = 0; t < steps; t++) {
          const u = t / steps, x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, e = pad + (rnd() * 2 - 1) * 12
          ring.push([x + (dx / d) * e, y + (dy / d) * e])
        }
      })
      const land = terrain(family, ring, [cx, cy], pts, seeded(`${family}-terrain`))
      return { family, cx: boxed.x, cy: boxed.y, r: boxed.r, top: Math.min(...ring.map((p) => p[1])), bottom: Math.max(...ring.map((p) => p[1])), path: smooth(ring), halo: smooth(land.ripples[1]), near: smooth(land.ripples[0]), ring, ox: cx, oy: cy, land, below: false, treeD: land.trees.map((t) => t.d).join(''), treeH: land.trees.map((t) => t.hatch).join('') }
    })
    // an island's name goes on the side away from most of its bridges
    for (const island of islands) {
      let away = 0
      for (const key of model.bridges.keys()) {
        const [fa, fb] = key.split('|')
        if (fa !== island.family && fb !== island.family) continue
        const other = islands.find((o) => o.family === (fa === island.family ? fb : fa))
        if (other) away += Math.sign(other.cy - island.cy)
      }
      island.below = away > 0 ? false : away < 0 ? true : island.cy > H / 2
    }
    const byFamily = new Map(islands.map((i) => [i.family, i]))
    const siteOf = new Map(sites.map((s) => [s.id, s]))
    const lanes = new Map<string, P[]>()
    const bridges = [...model.bridges.entries()].map(([key, chordKeys]) => {
      const [fa, fb] = key.split('|'), A = byFamily.get(fa)!, B = byFamily.get(fb)!
      const dx = B.ox - A.ox, dy = B.oy - A.oy, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux
      // walk out from each island's middle until the shoreline, then step back onto land: the bridge always lands
      const shore = (island: typeof A, vx: number, vy: number): P => {
        let t = 0
        while (t < 1000 && within([island.ox + vx * t, island.oy + vy * t], island.ring)) t += 2
        return [island.ox + vx * (t - 7), island.oy + vy * (t - 7)]
      }
      const [bx, by] = shore(A, ux, uy), [ex, ey] = shore(B, -ux, -uy)
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
      const piers = [[bx, by], [ex, ey]].map(([x, y]) => `M${fixed(x + px * (hw + 6))},${fixed(y + py * (hw + 6))}L${fixed(x - px * (hw + 6))},${fixed(y - py * (hw + 6))}`).join('')
      return { key, fa, fb, route: `M${fixed(bx)},${fixed(by)}L${fixed(ex)},${fixed(ey)}`, deck, cable, hangers, towers, clouds, piers, mid: [mx, my - th * 0.5] as P, count: m }
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
    const groups = data.vocabulary.groups.map((g) => {
      const mine = sites.filter((site) => model.names.get(site.id)?.group === g.id)
      const top = mine.reduce((m, p) => (p.y < m.y ? p : m), mine[0])
      return { ...g, n: mine.length, x: mine.reduce((a, p) => a + p.x, 0) / mine.length, y: Math.min(...mine.map((p) => p.y)) - 26 - (top ? 0 : 0) }
    }).filter((g) => g.n > 0)
    const sea = seeded('sea')
    let wisps = ''
    for (let tries = 0, n = 0; tries < 600 && n < 70; tries++) {
      const x = 30 + sea() * (W - 60), y = 30 + sea() * (H - 60)
      if (islands.some((i) => Math.hypot(i.cx - x, i.cy - y) < i.r + 50)) continue
      n++
      const w = 14 + sea() * 26
      wisps += `M${fixed(x)},${fixed(y)}q${fixed(w / 2)},-5 ${fixed(w)},0q${fixed(-w / 2)},4 ${fixed(-w)},0Z`
    }
    const x0 = Math.min(...islands.map((i) => i.cx - i.r)) - 40, x1 = Math.max(...islands.map((i) => i.cx + i.r)) + 40
    const y0 = Math.min(...islands.map((i) => i.top)) - 90, y1 = Math.max(...islands.map((i) => i.bottom)) + 70
    return { sites, islands, groups, bridges, chords, radius, markFont, wisps, bounds: { x0, y0, w: x1 - x0, h: y1 - y0 } }
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
  const k = lod
  const scale = fit * lod
  const rested = geometry(viewRef.current.k, viewRef.current.x, viewRef.current.y)
  function paint(next: { k: number; x: number; y: number; glide: boolean }) {
    viewRef.current = next
    const g = geometry(next.k, next.x, next.y)
    const node = camera.current
    if (node) {
      node.style.transition = next.glide ? 'transform .6s cubic-bezier(.2,.7,.2,1)' : 'none'
      node.style.transform = `translate(${g.tx.toFixed(1)}px, ${g.ty.toFixed(1)}px) scale(${g.s.toFixed(4)})`
    }
    setTip(null)
    const root = svg.current
    if (root) {
      root.style.setProperty('--k', next.k.toFixed(3))
      // while the picture is moving, drop the decorative texture: it is what costs a frame, and nobody reads it in motion
      root.classList.add('moving')
      window.clearTimeout(settle.current)
      settle.current = window.setTimeout(() => root.classList.remove('moving'), next.glide ? 700 : 140)
    }
    startTransition(() => setLod(Math.round(next.k * 12) / 12))
  }
  // keep the picture where it was when the window changes size
  useEffect(() => { paint({ ...viewRef.current, glide: false }) }, [box.w, box.h, bw, bh]) // eslint-disable-line react-hooks/exhaustive-deps

  // zoom by a factor about a screen point: used by the wheel, trackpad pinch and the buttons
  function zoomTo(nextK: number | ((current: number) => number), px: number, py: number, glide: boolean) {
    setHint(false)
    const v = viewRef.current
    const cur = geometry(v.k, v.x, v.y)
    const kk = Math.min(MAX_ZOOM, Math.max(1, typeof nextK === 'function' ? nextK(v.k) : nextK))
    if (kk === v.k) return
    const s = fit * kk, wx = (px - cur.tx) / cur.s, wy = (py - cur.ty) / cur.s
    const c = centred(s)
    paint({ k: kk, x: px - wx * s - c.cx, y: py - wy * s - c.cy, glide })
  }
  // carry the view to a world point so that a span of `span` fills the part of the window the drawer leaves free
  function flyTo(wx: number, wy: number, span: number, inset = 0, left = 0) {
    const free = box.w - inset - left
    const kk = Math.min(MAX_ZOOM, Math.max(1, Math.min(free, box.h) / (span * fit)))
    const s = fit * kk
    const c = centred(s)
    paint({ k: kk, x: left + free / 2 - wx * s - c.cx, y: box.h / 2 - wy * s - c.cy, glide: true })
  }
  const drawerInset = box.w > 760 ? Math.min(DRAWER, box.w * 0.5) : 0

  // wheel and trackpad: a two-finger scroll or a pinch zooms about the pointer (the map fills the window, so there is no page to scroll)
  useEffect(() => {
    const node = svg.current
    if (!node) return
    const at = (event: MouseEvent) => { const rect = node.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top] as const }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      const [x, y] = at(event)
      const factor = Math.exp(-Math.max(-120, Math.min(120, event.deltaY * lines)) * (event.ctrlKey ? 0.012 : 0.004))
      zoomTo((current) => current * factor, x, y, false)
    }
    // Safari reports a pinch as gesture events instead of ctrl+wheel
    let last = 1
    const onGestureStart = (event: Event) => { event.preventDefault(); last = 1 }
    const onGesture = (event: Event) => {
      event.preventDefault()
      const g = event as unknown as MouseEvent & { scale: number }
      const [x, y] = at(g)
      const ratio = g.scale / last
      last = g.scale
      zoomTo((current) => current * ratio, x, y, false)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    node.addEventListener('gesturestart', onGestureStart)
    node.addEventListener('gesturechange', onGesture)
    return () => {
      node.removeEventListener('wheel', onWheel)
      node.removeEventListener('gesturestart', onGestureStart)
      node.removeEventListener('gesturechange', onGesture)
    }
  })

  // selecting a whole island or bridge carries the view there
  useEffect(() => {
    if (!measured) return
    if (selection.length > seen.current) {
      const last = selection[selection.length - 1]
      if (last.startsWith('i:')) {
        const island = world.islands.find((i) => i.family === last.slice(2))
        if (island) flyTo(island.cx, island.cy, island.r * 2.6, drawerInset)
      } else if (last.startsWith('b:')) {
        const [a, b] = last.slice(2).split(/[|~]/).map((f) => world.islands.find((i) => i.family === f))
        if (a && b) flyTo((a.cx + b.cx) / 2, (a.cy + b.cy) / 2, Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy)) + 380, drawerInset)
      }
    }
    seen.current = selection.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, measured])

  function down(event: ReactPointerEvent<SVGSVGElement>) {
    travel.current = 0
    if ((event.target as Element).closest('[data-world-item]') || viewRef.current.k === 1) return
    drag.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y
    travel.current += Math.abs(dx) + Math.abs(dy)
    drag.current = { x: event.clientX, y: event.clientY }
    const v = viewRef.current
    const cur = geometry(v.k, v.x, v.y)
    paint({ ...v, x: cur.tx + dx - cur.cx, y: cur.ty + dy - cur.cy, glide: false })
  }

  // progressive detail: what is shown depends on how far in the view is
  const siteFloor = k < 1.35 ? 6 : k < 2 ? 3 : k < 3 ? 2 : 1
  const tone = (k: number) => 1 / Math.pow(Math.max(1, k), 0.55)
  const lettering = tone(k)
  const dim = selection.length > 0
  // an island or a bridge on its own selects hundreds of chords: keep to the strong ones until the view is close
  const broad = selection.length > 0 && selection.every((item) => 'ib'.includes(item[0]))
  const groupName = useMemo(() => new Map(data.vocabulary.groups.map((g) => [g.id, g.label])), [data])
  const siteById = useMemo(() => new Map(world.sites.map((site) => [site.id, site])), [world])
  // a few methods per island are named at rest ("anchors"); the rest are named when you hover, select or zoom right in
  const anchorRank = useMemo(() => {
    const rank = new Map<string, number>()
    for (const island of world.islands) world.sites.filter((s) => s.family === island.family).sort((a, b) => b.use - a.use).forEach((s, n) => rank.set(s.id, n))
    return rank
  }, [world])
  const anchorsFor = (zoom: number) => (zoom >= 5.5 ? 99 : zoom >= 1.5 ? 3 : 1)
  // method names are placed once per zoom tier, with the type size that tier will really show, so none lands on a dot, a name or a ribbon
  const TIERS = [1, 1.5, 2.2, 3.3, 4.5, 6]
  const tier = TIERS.filter((t) => lod >= t - 0.001).length - 1
  const labelAt = useMemo(() => {
    const tk = TIERS[tier], font = Math.min(25, 16.5 / (fit * tk))
    const quota = anchorsFor(tk)
    const h = font * 1.3, charW = font * 0.56
    // up close the marks stop growing with the map (they keep to ~46 px on screen) so that names can sit beside them
    const shrink = (use: number) => Math.min(1, 46 / (2 * world.radius(use) * fit * tk))
    const boxes: number[][] = world.sites.map((s) => { const r = world.radius(s.use) * shrink(s.use) + 3; return [s.x - r, s.y - r, s.x + r, s.y + r] })
    const gfont = Math.min(17, 12.5 / (fit * tk)), rs = (1 / Math.pow(Math.max(1, tk), 0.55)) ** 1.1
    for (const g of world.groups) { const hw = g.label.length * gfont * 0.29; boxes.push([g.x - hw, g.y - gfont, g.x + hw, g.y + gfont * 0.4]) }
    for (const i of world.islands) { const hw = ((familyName[i.family].length * 21 * 0.72 + 38) / 2 + 32) * rs, y = i.below ? i.bottom + 34 : i.top - 26; boxes.push([i.cx - hw, y - 24 * rs, i.cx + hw, y + 30 * rs]) }
    const hit = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
    const out = new Map<string, { x: number; y: number; anchor: Anchor }>()
    const ordered = [...world.sites].sort((a, b) => Number((anchorRank.get(b.id) ?? 99) < quota) - Number((anchorRank.get(a.id) ?? 99) < quota) || b.use - a.use)
    ordered.forEach((s) => {
      const r = world.radius(s.use) * shrink(s.use), w = s.short.length * charW + 10, g = 4
      const own = [s.x - r - 3, s.y - r - 3, s.x + r + 3, s.y + r + 3]
      const spots: { x: number; y: number; anchor: Anchor; box: number[] }[] = [
        { x: s.x + r + g, y: s.y + font * 0.32, anchor: 'start', box: [s.x + r + g, s.y - h / 2, s.x + r + g + w, s.y + h / 2] },
        { x: s.x - r - g, y: s.y + font * 0.32, anchor: 'end', box: [s.x - r - g - w, s.y - h / 2, s.x - r - g, s.y + h / 2] },
        { x: s.x, y: s.y - r - g - 2, anchor: 'middle', box: [s.x - w / 2, s.y - r - g - h, s.x + w / 2, s.y - r - g] },
        { x: s.x, y: s.y + r + g + font * 0.9, anchor: 'middle', box: [s.x - w / 2, s.y + r + g, s.x + w / 2, s.y + r + g + h] },
        { x: s.x + r * 0.7 + g, y: s.y - r * 0.7 - g, anchor: 'start', box: [s.x + r * 0.7 + g, s.y - r * 0.7 - g - h, s.x + r * 0.7 + g + w, s.y - r * 0.7 - g] },
        { x: s.x - r * 0.7 - g, y: s.y - r * 0.7 - g, anchor: 'end', box: [s.x - r * 0.7 - g - w, s.y - r * 0.7 - g - h, s.x - r * 0.7 - g, s.y - r * 0.7 - g] },
        { x: s.x + r * 0.7 + g, y: s.y + r * 0.7 + g + font * 0.9, anchor: 'start', box: [s.x + r * 0.7 + g, s.y + r * 0.7 + g, s.x + r * 0.7 + g + w, s.y + r * 0.7 + g + h] },
        { x: s.x - r * 0.7 - g, y: s.y + r * 0.7 + g + font * 0.9, anchor: 'end', box: [s.x - r * 0.7 - g - w, s.y + r * 0.7 + g, s.x - r * 0.7 - g, s.y + r * 0.7 + g + h] },
        // second ring, when the first is taken
        { x: s.x, y: s.y - r - g - h * 1.1, anchor: 'middle', box: [s.x - w / 2, s.y - r - g - h * 2.1, s.x + w / 2, s.y - r - g - h * 1.1] },
        { x: s.x, y: s.y + r + g + h * 1.1 + font * 0.9, anchor: 'middle', box: [s.x - w / 2, s.y + r + g + h * 1.1, s.x + w / 2, s.y + r + g + h * 2.1] },
        { x: s.x + r + g, y: s.y + h * 1.0 + font * 0.32, anchor: 'start', box: [s.x + r + g, s.y + h * 0.5, s.x + r + g + w, s.y + h * 1.5] },
        { x: s.x - r - g, y: s.y + h * 1.0 + font * 0.32, anchor: 'end', box: [s.x - r - g - w, s.y + h * 0.5, s.x - r - g, s.y + h * 1.5] },
        { x: s.x + r + g, y: s.y - h * 1.0 + font * 0.32, anchor: 'start', box: [s.x + r + g, s.y - h * 1.5, s.x + r + g + w, s.y - h * 0.5] },
        { x: s.x - r - g, y: s.y - h * 1.0 + font * 0.32, anchor: 'end', box: [s.x - r - g - w, s.y - h * 1.5, s.x - r - g, s.y - h * 0.5] },
      ]
      for (const spot of spots) {
        if (spot.box[0] > 10 && spot.box[2] < W - 10 && !boxes.some((b) => b.join() !== own.join() && hit(spot.box, b))) {
          boxes.push(spot.box)
          out.set(s.id, spot)
          break
        }
      }
    })
    return out
  }, [world, fit, tier, anchorRank, W]) // eslint-disable-line react-hooks/exhaustive-deps
  // hovering a method previews the methods it is paired with
  const partners = useMemo(() => {
    if (!hoverSite) return null
    const sites = new Set([hoverSite]), keys = new Set<string>()
    for (const key of Object.keys(data.pairs)) {
      const [a, b] = key.split('|')
      if (a === hoverSite || b === hoverSite) { sites.add(a); sites.add(b); keys.add(key) }
    }
    return { sites, keys }
  }, [hoverSite, data])
  // a theorem on its own: each usable route is a zone over the methods it uses
  const focusTheorem = focus === null ? null : data.theorems.find((t) => t.id === focus) ?? null
  const routes = useMemo(() => {
    if (!focusTheorem) return []
    return focusTheorem.routes.filter((r) => !r.excluded && r.techniques.some((id) => siteById.has(id))).map((r, n) => {
      const ids = r.techniques.filter((id) => siteById.has(id))
      const pts = ids.map((id): P => [siteById.get(id)!.x, siteById.get(id)!.y])
      const h = pts.length >= 3 ? hull(pts) : pts
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
      const blob = h.length === 1 ? `M${fixed(h[0][0])},${fixed(h[0][1])}l0.1,0` : `${polyline(h)}${h.length > 2 ? 'Z' : ''}`
      const chain = polyline([...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]))
      return { id: r.id, title: r.title, ids, letter: String.fromCharCode(65 + n), color: ROUTE_COLOURS[n % ROUTE_COLOURS.length], blob, chain, at: [cx, cy] as P }
    })
  }, [focusTheorem, siteById])
  const focusColour = useMemo(() => {
    const m = new Map<string, string>()
    routes.forEach((r) => r.ids.forEach((id) => { if (!m.has(id)) m.set(id, r.color) }))
    return m
  }, [routes])
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return null
    const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const methods = data.ring.techniques.map((id) => model.names.get(id)!).filter((t) => `${t.label} ${t.short} ${t.gloss}`.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.short.toLowerCase().startsWith(q)) - Number(!b.short.toLowerCase().startsWith(q)) || (model.uses.get(b.id) ?? 0) - (model.uses.get(a.id) ?? 0)).slice(0, 6)
    const theorems = data.theorems.filter((t) => t.usableRoutes > 0 && plain(t.name).includes(plain(q))).slice(0, 6)
    return { methods, theorems }
  }, [query, data, model])
  function pickMethod(id: string) {
    const site = siteById.get(id)
    if (!site) return
    setQuery(''); setSearchOpen(false); setFocus(null); setHint(false)
    flyTo(site.x, site.y, Math.min(box.w, box.h) / (3.4 * fit))
    setInfo({ item: `v:${id}`, x: box.w / 2, y: box.h / 2 })
  }
  function pickTheorem(id: number) {
    const theorem = data.theorems.find((t) => t.id === id)
    if (!theorem) return
    const pts = theorem.routes.filter((r) => !r.excluded).flatMap((r) => r.techniques).map((m) => siteById.get(m)).filter((p): p is NonNullable<typeof p> => !!p)
    setQuery(''); setSearchOpen(false); setInfo(null); setFocus(id); setHint(false)
    if (pts.length) {
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
      flyTo((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.25 + 160, 0, box.w > 760 ? 360 : 0)
    }
  }

  const card = useMemo(() => {
    if (!info) return null
    const kind = info.item[0], key = info.item.slice(2)
    const holds = (id: number) => kind === 'v' ? model.used.get(id)?.has(key) : kind === 'i' ? model.islandsOf.get(id)?.has(key) : kind === 'b' ? model.bridgesOf.get(id)?.has(key) : (kind === 'e' ? model.pairs : model.triples).get(key)?.has(id)
    const theorems = data.theorems.filter((t) => holds(t.id))
    const nameOf = (id: string) => model.names.get(id)
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
    if (kind === 'v') {
      const t = nameOf(key)
      return { title: `${t?.glyph ?? ''} ${t?.label ?? key}`.trim(), sub: `${familyName[t?.family ?? '']} › ${groupName.get(t?.group ?? '') ?? ''} · used in ${plural(theorems.length, 'theorem')}`, body: t?.gloss ?? '', theorems }
    }
    if (kind === 'i') {
      const mine = (model.byFamily.get(key) ?? []).slice().sort((a, b) => (model.uses.get(b) ?? 0) - (model.uses.get(a) ?? 0))
      return { title: `${familyName[key]} island`, sub: `${plural(mine.length, 'method')} · ${plural(theorems.length, 'theorem')}`, body: `Most used: ${mine.slice(0, 4).map((id) => nameOf(id)?.short).join(', ')}.`, theorems }
    }
    if (kind === 'b') {
      const pairs = (model.bridges.get(key) ?? []).slice().sort((a, b) => (model.pairs.get(b)?.size ?? 0) - (model.pairs.get(a)?.size ?? 0))
      const named = pairs.slice(0, 3).map((p) => p.split('|').map((id) => nameOf(id)?.short).join(' + ')).join('; ')
      return { title: `${key.split('|').map((f) => familyName[f]).join(' ⇄ ')} bridge`, sub: `${plural(pairs.length, 'method pair')} · ${plural(theorems.length, 'theorem')}`, body: `Strongest: ${named}.`, theorems }
    }
    const names = key.split('|').map((id) => nameOf(id)?.label ?? id)
    return { title: names.join(' + '), sub: `${kind === 'e' ? 'Two' : 'Three'} rival routes in ${plural(theorems.length, 'theorem')}`, body: '', theorems }
  }, [info, data, model, groupName])

  // trees overlap properly only when they are big enough to see: one merged path before that
  const close = lod >= 1.85
  const landLayer = useMemo(() => (
        <g pointerEvents="none">
            <path className="world-texture" d={world.wisps} fill={theme.wisp} fillOpacity="0.8" />
                        {world.islands.map((i) => {
              const c = theme.hue(i.family)
              return <g key={i.family}>
                {theme.ripples ? <>
                  <path className="world-texture" d={i.halo} fill="none" stroke={c.dark} strokeOpacity="0.35" strokeWidth="1.1" strokeDasharray="9 9" />
                  <path d={i.near} fill="none" stroke={c.dark} strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="14 6" />
                  <path className="world-texture" d={i.path} fill="url(#w-hatch)" opacity="0.5" transform="translate(5 6)" />
                </> : <>
                  <path d={i.halo} fill={c.halo} fillOpacity="0.75" />
                  <path d={i.path} fill={c.dark} fillOpacity={theme.shade} transform="translate(0 7)" />
                </>}
                <path d={i.path} fill={c.land} />
                <path className="world-texture" d={i.path} fill="url(#w-tuft)" opacity={theme.ripples ? 0.55 : 0.14} />
                <path className="world-minor" d={i.land.minor} fill="none" stroke={c.light} strokeWidth="0.9" strokeLinecap="round" />
                <path className="world-major" d={i.land.major} fill="none" stroke={c.dark} strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round" />
                <path d={i.land.lakes} fill={theme.water} stroke={c.dark} strokeOpacity="0.7" strokeWidth="1" />
                {i.land.rivers.map((r, n) => <path key={n} className="world-river" d={r.water} fill="none" stroke={theme.water} strokeWidth="4" strokeLinecap="round" />)}
                <path d={i.land.fields} fill="none" stroke={c.dark} strokeOpacity="0.65" strokeWidth="0.8" strokeLinejoin="round" />
                <path d={i.land.squares} fill="none" stroke={c.dark} strokeOpacity="0.7" strokeWidth="0.9" strokeLinejoin="round" />
                <path d={i.land.dunes} fill="none" stroke={c.dark} strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
                <path d={i.land.spirals} fill="none" stroke={c.dark} strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
                {close
                  ? i.land.trees.map((t, n) => <path key={n} d={t.d} fill={theme.tree(c)} stroke={c.dark} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />)
                  : <path d={i.treeD} fill={theme.tree(c)} stroke={c.dark} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />}
                <path className="world-texture" d={i.treeH} fill="none" stroke={theme.hatchInk(c)} strokeOpacity="0.7" strokeWidth="0.8" strokeLinecap="round" />
                <path d={i.land.mountains} fill={c.peak} stroke={c.dark} strokeWidth="1.3" strokeLinejoin="round" />
                <path d={i.land.hatch} fill="none" stroke={c.dark} strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round" />
                <path d={i.land.ink} fill={theme.paper} fillOpacity="0.92" stroke={c.dark} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={i.path} fill="none" stroke={theme.coast ? c.dark : c.light} strokeWidth={theme.coast || 2} strokeLinejoin="round" />
              </g>
            })}
          </g>
  ), [world, theme, close])

  // what a method dot and its lettering look like right now: one place, so dots and names always agree
  const siteState = (s: (typeof world.sites)[number]) => {
    const item = `v:${s.id}`, on = chosen.has(item), isLive = live.methods.has(s.id)
    const inFocus = focusColour.has(s.id), near = partners?.sites.has(s.id) ?? false, noted = info?.item === item
    const shown = focus !== null || on || noted || (partners ? near : dim ? isLive : s.use >= siteFloor)
    const anchored = (anchorRank.get(s.id) ?? 99) < anchorsFor(lod)
    const specific = selection.some((item) => 'vet'.includes(item[0]))
    const showLabel = focus !== null ? inFocus : on || noted ? true : partners ? near : dim ? isLive && (specific || anchored) : anchored
    const faint = focus !== null ? !inFocus : partners ? !near : dim && !isLive && !on
    return { item, on, noted, shown, showLabel, faint, inFocus }
  }

  return <section data-theme={theme.id} className={`world-page${drawer ? ' world-open' : ''}`} style={{ '--grain': theme.grain, background: SEA } as React.CSSProperties} aria-label="A world of proof methods and the theorems they prove">
    <div className="world-stage" ref={stage}>
      <svg ref={svg} className="world-svg" width={box.w} height={box.h} role="group" aria-label="A map of islands of proof methods joined by bridges"
        onClick={(event) => { if (travel.current < 4 && !(event.target as Element).closest('[data-world-item]')) clearAll() }}
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest('[data-world-item]')) return
          const rect = event.currentTarget.getBoundingClientRect()
          zoomTo((current) => current * 2, event.clientX - rect.left, event.clientY - rect.top, true)
        }}
        >
        <defs>
          <pattern id="w-tuft" width="38" height="30" patternUnits="userSpaceOnUse">
            <path d="M5,9l2.5,-5l2.5,5M23,24l2.5,-5l2.5,5M30,8l2,-4l2,4M14,19l2,-4l2,4" fill="none" stroke={INK} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
          </pattern>
          <pattern id="w-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <path d="M0,0V5" stroke={INK} strokeWidth="1" />
          </pattern>
          {world.islands.map((i) => <radialGradient key={i.family} id={`w-clear-${i.family}`}>
            <stop offset="0" stopColor={theme.hue(i.family).land} stopOpacity="0.96" />
            <stop offset="0.62" stopColor={theme.hue(i.family).land} stopOpacity="0.9" />
            <stop offset="1" stopColor={theme.hue(i.family).land} stopOpacity="0" />
          </radialGradient>)}
        </defs>
        <rect width={box.w} height={box.h} fill={SEA} />
        <g className="world-camera" ref={camera} style={{ transform: `translate(${rested.tx.toFixed(1)}px, ${rested.ty.toFixed(1)}px) scale(${rested.s.toFixed(4)})` }}>
          {landLayer}
          {world.bridges.map((b) => {
            const shown = chosen.has(`b:${b.key}`) || (dim ? live.bridges.has(b.key) : hover !== null && (b.fa === hover || b.fb === hover)) ? 1 : fade(k, 1.3, 1.9)
            return <g key={`pier-${b.key}`} pointerEvents="none">
              <path d={b.route} fill="none" stroke={INK} strokeWidth="1.3" strokeDasharray="2 9" strokeLinecap="round" opacity={(1 - shown) * 0.55} />
              <path d={b.piers} fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" opacity="0.85" />
            </g>
          })}
          {world.bridges.map((b) => {
            const item = `b:${b.key}`, on = chosen.has(item), involved = hover !== null && (b.fa === hover || b.fb === hover)
            // bridges are revealed where they matter: on selection, on hover, and once the view is close enough to give them room
            const near = fade(k, 1.3, 1.9)
            const shown = on ? 1 : dim ? (live.bridges.has(b.key) ? 1 : near * 0.22) : Math.max(near, involved ? 1 : 0)
            const ink = on ? GOLD : INK
            return <g key={b.key} data-world-item className="world-bridge" opacity={shown} pointerEvents={shown > 0.15 ? undefined : 'none'} aria-label={`${label(item)}, ${b.count} method pair${b.count === 1 ? '' : 's'}`} {...choose(item)}>
              <title>{label(item)}: {b.count} method pairs</title>
              {theme.clouds && <path d={b.clouds} fill="#fff" fillOpacity="0.95" />}
              <path d={b.deck} fill={PAPER} stroke={PAPER} strokeWidth="7" strokeLinejoin="round" />
              <path d={b.deck} fill={PAPER} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
              <g opacity={fade(k, 1.7, 2.4)}>
                <path d={b.towers} fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
                <path d={b.cable} fill="none" stroke={ink} strokeWidth="1.6" />
                <path d={b.hangers} fill="none" stroke={ink} strokeWidth="1" strokeOpacity="0.75" />
              </g>
              <text className="world-count" x={fixed(b.mid[0])} y={fixed(b.mid[1])} textAnchor="middle" style={{ fontSize: `${(17 * lettering).toFixed(1)}px`, stroke: SEA }} opacity={1 - fade(k, 2.4, 3.2)}>{b.count}</text>
            </g>
          })}
          {Object.keys(data.triples).map((key) => {
            const item = `t:${key}`, on = chosen.has(item), isLive = live.triples.has(key)
            const base = focus !== null ? 0 : dim ? (isLive ? 0.55 * fade(k, 1.6, 2.6) : 0) : 0
            if (!on && base < 0.02) return null
            const path = key.split('|').map((id) => { const s = siteById.get(id)!; return `${s.x},${s.y}` }).join('L')
            return <path key={item} data-world-item className="ring-triangle" d={`M${path}Z`} fill={GOLD} stroke={on ? INK : theme.trail} strokeDasharray="4 6" strokeLinecap="round"
              fillOpacity={on ? 0.3 : 0} strokeOpacity={on ? 1 : base} strokeWidth={on ? 2.6 : 1.4} pointerEvents={on || base > 0.1 ? undefined : 'none'}
              aria-label={`${label(item)}, three routes`} {...choose(item)}><title>{label(item)}</title></path>
          })}
          {world.chords.map((c) => {
            const item = `e:${c.key}`, on = chosen.has(item), isLive = live.edges.has(c.key)
            const strong = c.n >= 3 ? 0.9 : c.n >= 2 ? (broad ? fade(k, 2.2, 3) * 0.8 : 0.9) : broad ? fade(k, 3.2, 4) * 0.7 : fade(k, 2, 3) * 0.8
            const reveal = focus !== null ? 0 : partners ? (partners.keys.has(c.key) ? 0.95 : 0) : dim ? (isLive ? strong : 0) : 0
            const op = on ? 1 : reveal
            if (!on && op < 0.03) return null
            return <g key={item} opacity={op > 0 || on ? 1 : 0} pointerEvents={op > 0.08 || on ? undefined : 'none'}>
              {on && <path d={c.d} fill="none" stroke={theme.id === 'ink' ? PAPER : INK} strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
              <path d={c.d} fill="none" strokeLinecap="round" stroke={on ? GOLD : theme.trail} strokeDasharray={on ? undefined : '7 5'} strokeWidth={on ? 3.2 : 1.2 + Math.min(c.n, 4) * 0.4} vectorEffect="non-scaling-stroke" strokeOpacity={on ? 1 : op} />
              <path d={c.d} data-world-item fill="none" stroke="transparent" strokeWidth="14" className="ring-hit" aria-label={`${label(item)}, ${c.n} theorem${c.n === 1 ? '' : 's'}`} {...choose(item)}>
                <title>{label(item)}: {c.n} theorem{c.n === 1 ? '' : 's'}</title>
              </path>
            </g>
          })}
          {world.groups.map((g) => {
            const c = theme.hue(g.family), show = focus !== null ? 0 : (dim ? 0.35 : 1) * fade(k, 1.3, 1.9)
            return show > 0.02 ? <text key={g.id} className="world-group" x={fixed(g.x)} y={fixed(g.y)} textAnchor="middle" opacity={show} pointerEvents="none"
              style={{ fill: c.dark, stroke: theme.label.halo(c), fontSize: `${Math.min(17, 12.5 / scale).toFixed(1)}px` }}>{g.label}</text> : null
          })}
          {routes.map((r) => <g key={r.id} pointerEvents="none">
            <g opacity="0.2"><path d={r.blob} fill={r.color} stroke={r.color} strokeWidth="34" strokeLinejoin="round" strokeLinecap="round" /></g>
            <path d={r.chain} fill="none" stroke={r.color} strokeWidth="2.4" strokeDasharray="7 6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          </g>)}
          {world.sites.map((s) => {
            const { shown, faint } = siteState(s)
            if (!shown) return null
            const rc = world.radius(s.use) * Math.min(1, 46 / (2 * world.radius(s.use) * scale)) * 1.7
            return <circle key={`clear-${s.id}`} cx={s.x} cy={s.y} r={rc.toFixed(1)} fill={`url(#w-clear-${s.family})`} pointerEvents="none" opacity={faint ? 0.3 : 1} />
          })}
          {world.sites.map((s) => {
            const { item, on, noted, shown, faint } = siteState(s), shrunk = Math.min(1, 46 / (2 * world.radius(s.use) * scale)), r = world.radius(s.use) * shrunk, c = theme.hue(s.family)
            return <g key={item} data-world-item className="world-site" onPointerEnter={() => { const g = geometry(viewRef.current.k, viewRef.current.x, viewRef.current.y); setTip({ id: s.id, x: g.tx + s.x * g.s, y: g.ty + (s.y - r) * g.s }); startTransition(() => setHoverSite(s.id)) }} onPointerLeave={() => { setTip(null); startTransition(() => setHoverSite(null)) }} opacity={shown ? (faint ? (focus !== null ? 0.1 : 0.25) : 1) : 0} pointerEvents={shown ? undefined : 'none'}
              aria-label={`${s.short}, ${s.use} theorem${s.use === 1 ? '' : 's'}`} {...choose(item)}>
              {(on || noted) && <circle cx={s.x} cy={s.y} r={r + 7} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="4 4" />}
              <circle cx={s.x} cy={s.y} r={r} fill="transparent" />
              <text className="world-glyph" x={s.x} y={s.y} dy="0.34em" textAnchor="middle"
                style={{ fontSize: `${(world.markFont(s) * shrunk).toFixed(1)}px`, fill: theme.id === 'ink' ? c.dark : theme.label.fill, stroke: focusColour.get(s.id) ?? theme.label.halo(c), strokeWidth: focusColour.has(s.id) ? 7 : 5 }}>{model.names.get(s.id)?.glyph ?? '•'}</text>
            </g>
          })}
          {routes.map((r) => <g key={`badge-${r.id}`} pointerEvents="none" transform={`translate(${fixed(r.at[0])} ${fixed(r.at[1] - 34)}) scale(${lettering.toFixed(3)})`}>
            <rect x="-13" y="-13" width="26" height="26" rx="4" fill={PAPER} stroke={r.color} strokeWidth="2" />
            <text y="6" textAnchor="middle" className="world-badge" style={{ fill: r.color }}>{r.letter}</text>
          </g>)}
          {world.sites.map((s) => {
            const { shown, showLabel, faint } = siteState(s), l = labelAt.get(s.id), c = theme.hue(s.family)
            return l && shown && showLabel ? <text key={`name-${s.id}`} data-world-item className="world-label" x={fixed(l.x)} y={fixed(l.y)} textAnchor={l.anchor} opacity={faint ? (focus !== null ? 0.1 : 0.3) : 1} {...choose(`v:${s.id}`)}
              style={{ fill: theme.label.fill, stroke: theme.label.halo(c), fontSize: `${Math.min(25, 16.5 / scale).toFixed(1)}px` }}>{s.short}</text> : null
          })}
          {world.islands.map((i) => {
            const item = `i:${i.family}`, on = chosen.has(item), faded = dim && !live.islands.has(i.family) && !on
            const below = i.below, c = theme.hue(i.family)
            return <g key={item} data-world-item className="world-island-name" onPointerEnter={() => startTransition(() => setHover(i.family))} onPointerLeave={() => startTransition(() => setHover(null))} opacity={faded ? 0.4 : 1} aria-label={`${familyName[i.family]} island`} {...choose(item)}
              transform={`translate(${fixed(i.cx)} ${fixed(below ? i.bottom + 34 : i.top - 26)}) scale(${(tone(k) ** 1.1).toFixed(3)})`}>
              <Ribbon text={familyName[i.family].toUpperCase()} size={21} paper={PAPER} color={on ? GOLD : c.dark} ink={c.dark} tail={c.halo} />
            </g>
          })}
        </g>
      </svg>
      {tip && (() => {
        const t = model.names.get(tip.id), c = theme.hue(t?.family ?? 'analytic'), below = tip.y < 84
        return <div className="world-tip" style={{ left: Math.min(Math.max(tip.x, 110), box.w - 110), top: below ? tip.y + 34 : tip.y - 8, transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)', borderColor: c.dark, background: PAPER, color: INK }}>
          <strong><span className="world-tip-glyph">{t?.glyph}</span> {t?.label}</strong>
          <span>{familyName[t?.family ?? '']} › {groupName.get(t?.group ?? '')} · {model.uses.get(tip.id) ?? 0} theorem{(model.uses.get(tip.id) ?? 0) === 1 ? '' : 's'}</span>
        </div>
      })()}
      {info && card && <div className="world-info" role="dialog" aria-label={card.title} style={{ left: Math.min(Math.max(8, info.x + 14), box.w - drawerInset * (drawer ? 1 : 0) - 336), top: Math.min(Math.max(72, info.y + 14), box.h - 260) }}>
        <button type="button" className="world-info-close" onClick={() => setInfo(null)} aria-label="Close">×</button>
        <strong>{card.title}</strong>
        <span className="world-info-sub">{card.sub}</span>
        {card.body && <p>{card.body}</p>}
        {card.theorems.length > 0 && <ul>
          {card.theorems.slice(0, 3).map((t) => <li key={t.id}><button type="button" className="world-info-theorem" title="Show this theorem's routes on the map" onClick={() => pickTheorem(t.id)}><MathText text={t.name} /></button></li>)}
          {card.theorems.length > 3 && <li className="world-info-more">and {card.theorems.length - 3} more</li>}
        </ul>}
        <button type="button" className="world-info-open" onClick={() => { const item = info.item; setInfo(null); sel.toggle(item) }}>{chosen.has(info.item) ? 'Remove from selection' : `List the theorem${card.theorems.length === 1 ? '' : 's'}`}</button>
        <span className="world-info-tip">or double-click it · click a theorem to see its routes</span>
      </div>}
      {focusTheorem && <div className="world-theorem">
        <button type="button" className="world-info-close" onClick={() => setFocus(null)} aria-label="Close">×</button>
        <strong><MathText text={focusTheorem.name} /></strong>
        <span className="world-info-sub">{routes.length} proof route{routes.length === 1 ? '' : 's'}, each over the methods it uses</span>
        <ol>
          {routes.map((r) => <li key={r.id} style={{ borderLeftColor: r.color }}>
            <b style={{ color: r.color }}>{r.letter}</b> <span><MathText text={r.title} /></span>
            <em>{r.ids.map((id) => model.names.get(id)?.short).join(' + ')}</em>
          </li>)}
        </ol>
        <button type="button" className="world-info-open" onClick={() => onOpenEntry(focusTheorem.id)}>Open the theorem</button>
      </div>}
      {hint && <div className="world-hint">Click for a quick note, double-click to list theorems · scroll or pinch to zoom, drag to move</div>}
      <div className="world-controls">
        <div className="world-switch" role="group" aria-label="Map style">
          {themes.map((t) => <button type="button" key={t.id} aria-pressed={t.id === theme.id} onClick={() => { setThemeId(t.id); try { window.localStorage.setItem(THEME_KEY, t.id) } catch { /* private mode */ } }}>{t.name}</button>)}
        </div>
        <div className="world-zoom" role="group" aria-label="Map zoom">
          <button type="button" onClick={() => zoomTo(k * 1.6, box.w / 2, box.h / 2, true)} aria-label="Zoom in" disabled={k >= MAX_ZOOM}>+</button>
          <button type="button" onClick={() => zoomTo(k / 1.6, box.w / 2, box.h / 2, true)} aria-label="Zoom out" disabled={k <= 1}>−</button>
          <button type="button" onClick={() => paint({ k: 1, x: 0, y: 0, glide: true })} aria-label="Reset view" disabled={k === 1}>⌂</button>
        </div>
      </div>
    </div>
    <div className="world-hud">
      {onClose && <button type="button" className="world-back" onClick={onClose}>← Course results</button>}
      <div className="world-search">
        <input type="search" value={query} placeholder="Find a method or a theorem" aria-label="Find a method or a theorem on the map" autoComplete="off"
          onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setSearchOpen(false); (event.target as HTMLInputElement).blur() }
            if (event.key === 'Enter' && found) { if (found.methods[0]) pickMethod(found.methods[0].id); else if (found.theorems[0]) pickTheorem(found.theorems[0].id) }
          }} />
        {searchOpen && found && <div className="world-found" role="listbox">
          {found.methods.length === 0 && found.theorems.length === 0 && <p>No match.</p>}
          {found.methods.length > 0 && <span className="world-found-head">Methods</span>}
          {found.methods.map((t) => <button type="button" key={t.id} role="option" aria-selected="false" onClick={() => pickMethod(t.id)}><span><b className="world-found-glyph">{t.glyph}</b> {t.label}</span><em>{familyName[t.family]} › {groupName.get(t.group ?? '')}</em></button>)}
          {found.theorems.length > 0 && <span className="world-found-head">Theorems</span>}
          {found.theorems.map((t) => <button type="button" key={t.id} role="option" aria-selected="false" onClick={() => pickTheorem(t.id)}><MathText text={t.name} /></button>)}
        </div>}
      </div>
      <SelectionBar sel={sel} results={results} lead="" />
      <button type="button" className="world-toggle" aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>{drawer ? 'Hide theorems' : 'Theorems & methods'}</button>
    </div>
    <aside className="world-drawer" hidden={!drawer} aria-label="Theorems and methods">
      <ResultsPanel sel={sel} model={model} catalog={catalog} results={results} onOpenEntry={onOpenEntry}
        hint="Each island is a domain of method, and methods that appear in the same theorems sit closer together. Zoom in to reveal more methods, their names, and the trails between them. A trail inside an island, or a lane on a bridge between islands, is a chord: two methods that distinguish two routes of one theorem. Click anything for a short note; double-click it to list its theorems. Click an empty spot to start over." />
      <MethodList data={data} model={model} sel={sel} />
      <p className="ring-note">Bridge numbers count the method pairs that cross; dot size is the number of theorems using the method. Methods are tagged by two independent reviewers from the proof sketches, so they are inferred, not source-verified. Routes judged duplicate, dependent or incomplete are left out.</p>
    </aside>
  </section>
}

export default function WorldMap({ catalog, onOpenEntry, onClose }: { catalog: Catalog; onOpenEntry: (id: number) => void; onClose?: () => void }) {
  const { data, model, error } = useMethodData()
  if (error) return <div className="collection-offline" role="alert">The world map is unavailable. {error}</div>
  if (!data || !model) return <div className="ring-loading" aria-live="polite">Loading the method index…</div>
  return <WorldBody data={data} model={model} catalog={catalog} onOpenEntry={onOpenEntry} onClose={onClose} />
}
