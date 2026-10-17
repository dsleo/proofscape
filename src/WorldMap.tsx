import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Catalog } from './historicalShared'
import { familyName, fixed, MethodList, ResultsPanel, SelectionBar, useMethodData, useMethodSelection, useResultsRef } from './methodShared'
import type { MethodData, MethodModel } from './methodShared'
import { MathText } from './MathText'
import LandLayer from './WorldLand'
import Ribbon from './WorldRibbon'
import { buildWorld } from './worldLayout'
import { anchorsFor, placeLabels, TIERS } from './worldLabels'
import { fade, hull, polyline } from './worldShared'
import type { P } from './worldShared'
import { themes } from './worldTheme'
import './world.css'


const MAX_ZOOM = 8
// how far past the window's edge the map may be dragged, as a share of the window: enough that any point can be brought to the middle
const OVERSCROLL = 0.62
const TOP_BAR = 64 // the strip the top bar covers
const TOP_BAR_PHONE = 120 // two rows of buttons
const PHONE = 760, PHONE_HOME = 1.9 // below this width the map opens zoomed in, so that names and marks can be read and touched
const ROUTE_COLOURS = ['#ae6b1f', '#2f6f73', '#7a4a73', '#5f7a2f', '#8a3b3b']
const DRAWER = 460
// the rising sea (Grothendieck, Récoltes et Semailles): the water climbs the islands' own contours
const SEA_RISE = 14000, SEA_HOLD = 4200, SEA_EBB = 7000, SEA_TOP = 1.05


// the address bar describes where you are: theorem, method, selection, and the spot on the map
function setParam(name: string, value: string | null) {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  window.history.replaceState(null, '', url)
}

function WorldBody({ data, model, catalog, onOpenEntry, onClose, onLibrary }: { data: MethodData; model: MethodModel; catalog: Catalog; onOpenEntry: (id: number) => void; onClose?: () => void; onLibrary?: () => void }) {
  const sel = useMethodSelection(data, model)
  const results = useResultsRef()
  const [W, H] = data.world.size ?? [1000, 720]
  const stage = useRef<HTMLDivElement>(null)
  const boot = useRef(new URLSearchParams(window.location.search))
  const ready = useRef(false)
  const surface = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState({ w: 1200, h: 760 })
  // The camera lives in a ref and is applied straight to the DOM, so panning and zooming never wait for React;
  // only the zoom level, rounded to a twelfth, is state: it decides which details are drawn.
  // The whole drawing sits in one layer that the browser moves and scales on the GPU. The layer is rasterised at
  // `raster` (a scale) and only re-rasterised when the view has drifted well away from it, or has come to rest.
  const viewRef = useRef({ k: 1, x: 0, y: 0, glide: false })
  const raster = useRef(0)
  const settle = useRef(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const grip = useRef({ dragging: false, startX: 0, startY: 0, lastX: 0, lastY: 0, lastT: 0, vx: 0, vy: 0, pinch: 0 })
  const zoomAnim = useRef({ raf: 0, target: 1, px: 0, py: 0, t: 0 })
  const momentum = useRef(0)
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
  const [seaOn, setSeaOn] = useState(false)
  const page = useRef<HTMLElement>(null)
  const sea = useRef({ raf: 0, phase: 'idle' as 'idle' | 'rise' | 'hold' | 'ebb', level: 0, from: 0, t0: 0 })
  const [searchOpen, setSearchOpen] = useState(false)
  const [active, setActive] = useState(-1) // the highlighted match in the search list
  const travel = useRef(0)
  const theme = themes[0]
  const { paper: PAPER, ink: INK, accent: GOLD, sea: SEA } = theme
  const seen = useRef(0)
  const { selection, live, chosen, label } = sel
  const act = useRef({ pan: (_dx: number, _dy: number) => {}, zoom: (_factor: number) => {}, home: () => {} })
  // one click shows a short note over the item; a double click (or the note's button) selects it and lists its theorems
  const choose = (item: string, tabbable = true) => ({
    tabIndex: tabbable ? 0 : -1, role: 'button' as const,
    onClick: (event: React.MouseEvent) => {
      if (travel.current >= 4) return
      const rect = stage.current?.getBoundingClientRect()
      setInfo({ item, x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) })
    },
    onDoubleClick: () => { if (travel.current >= 4) return; setInfo(null); sel.toggle(item) },
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setInfo(null); sel.toggle(item) } },
  })
  const setSea = (level: number) => { sea.current.level = level; page.current?.style.setProperty('--sea', level.toFixed(3)) }
  const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
  function seaTick(now: number) {
    const s = sea.current, dt = now - s.t0
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (s.phase === 'rise') {
      const p = Math.min(1, dt / (calm ? 1200 : SEA_RISE))
      setSea(s.from + (SEA_TOP - s.from) * ease(p))
      if (p >= 1) { s.phase = 'hold'; s.t0 = now }
    } else if (s.phase === 'hold') {
      if (dt > SEA_HOLD) { s.phase = 'ebb'; s.from = s.level; s.t0 = now }
    } else if (s.phase === 'ebb') {
      const p = Math.min(1, dt / (calm ? 800 : SEA_EBB))
      setSea(s.from * (1 - ease(p)))
      if (p >= 1) { s.phase = 'idle'; setSea(0); setSeaOn(false); return }
    }
    s.raf = requestAnimationFrame(seaTick)
  }
  function startSea() {
    const s = sea.current
    if (s.phase !== 'idle') return
    setInfo(null); setTip(null); setSeaOn(true)
    s.phase = 'rise'; s.from = 0; s.t0 = performance.now()
    s.raf = requestAnimationFrame(seaTick)
  }
  function endSea() {
    const s = sea.current
    if (s.phase === 'rise' || s.phase === 'hold') { s.phase = 'ebb'; s.from = s.level; s.t0 = performance.now() }
  }
  const clearAll = () => {
    endSea(); setInfo(null); setDrawer(false); setFocus(null); setSearchOpen(false); if (selection.length) sel.clear() }
  useEffect(() => {
    // typing "sga" (or "sea") anywhere on the map lets the sea rise; Escape or a click on empty water lets it ebb
    let typed = ''
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setInfo(null); endSea(); return }
      const el = event.target as HTMLElement | null
      // the map answers the keyboard unless focus is in a field or a panel that has its own use for the keys
      if (!event.metaKey && !event.ctrlKey && !event.altKey && !(el instanceof Element && el.closest('input, textarea, select, [contenteditable], .world-drawer, .world-info, .world-theorem, [role=listbox]'))) {
        const moves: Record<string, [number, number]> = { ArrowLeft: [90, 0], ArrowRight: [-90, 0], ArrowUp: [0, 90], ArrowDown: [0, -90] }
        if (moves[event.key]) { event.preventDefault(); act.current.pan(...moves[event.key]); return }
        if (event.key === '+' || event.key === '=') { act.current.zoom(1.5); return }
        if (event.key === '-' || event.key === '_') { act.current.zoom(1 / 1.5); return }
        if (event.key === '0') { act.current.home(); return }
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1 || (el instanceof Element && el.closest('input, textarea, [contenteditable]'))) return
      typed = (typed + event.key.toLowerCase()).slice(-3)
      if (typed === 'sga' || typed === 'sea') { typed = ''; startSea() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(sea.current.raf) }
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

  const world = useMemo(() => buildWorld(data, model, W, H), [data, model, W, H])

  const { x0: bx, y0: by, w: bw, h: bh } = world.bounds
  const fit = Math.min(box.w / bw, box.h / bh) * 0.98
  // where the map sits when it is centred, and where it ends up once panned and kept on screen
  const centred = (s: number) => ({ cx: (box.w - bw * s) / 2 - bx * s, cy: (box.h - bh * s) / 2 - by * s })
  const geometry = (k: number, x: number, y: number) => {
    const s = fit * k, c = centred(s)
    const axis = (extent: number, size: number, pan: number, home: number) => {
      const room = extent * OVERSCROLL
      return size <= extent
        ? Math.min(home + room + (extent - size) / 2, Math.max(home - room - (extent - size) / 2, home + pan))
        : Math.min(room, Math.max(extent - size - room, home + pan))
    }
    return { s, tx: axis(box.w, bw * s, x, c.cx), ty: axis(box.h, bh * s, y, c.cy), cx: c.cx, cy: c.cy }
  }
  const k = lod
  const scale = fit * lod
  if (!raster.current) raster.current = fit
  const rested = geometry(viewRef.current.k, viewRef.current.x, viewRef.current.y)
  const layerTransform = (g: { s: number; tx: number; ty: number }) => `translate(${(g.tx + g.s * bx).toFixed(2)}px, ${(g.ty + g.s * by).toFixed(2)}px) scale(${(g.s / raster.current).toFixed(5)})`
  // draw the layer at scale `s`: size it for that scale, so the browser rasterises it crisp
  function rerasterise(s: number) {
    raster.current = s
    layer.current?.style.setProperty('width', `${bw * s}px`)
    layer.current?.style.setProperty('height', `${bh * s}px`)
    svg.current?.setAttribute('width', String(bw * s))
    svg.current?.setAttribute('height', String(bh * s))
  }
  function writeAt(g: { s: number; tx: number; ty: number }) {
    if (!ready.current) return
    const k = viewRef.current.k
    setParam('at', k <= 1.005 ? null : `${Math.round((box.w / 2 - g.tx) / g.s)},${Math.round((box.h / 2 - g.ty) / g.s)},${k.toFixed(2)}`)
  }
  function paint(next: { k: number; x: number; y: number; glide: boolean }) {
    viewRef.current = next
    const g = geometry(next.k, next.x, next.y)
    const drift = g.s / raster.current
    if (drift < 0.72 || drift > 1.4) rerasterise(g.s)
    const node = layer.current
    if (node) {
      node.style.transition = next.glide ? 'transform .6s cubic-bezier(.2,.7,.2,1)' : 'none'
      node.style.transform = layerTransform(g)
    }
    setTip(null)
    surface.current?.style.setProperty('--k', next.k.toFixed(3))
    // once the picture rests, redraw it exactly at its scale
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const now = geometry(viewRef.current.k, viewRef.current.x, viewRef.current.y)
      writeAt(now)
      if (Math.abs(now.s / raster.current - 1) > 0.03) { rerasterise(now.s); if (layer.current) { layer.current.style.transition = 'none'; layer.current.style.transform = layerTransform(now) } }
    }, next.glide ? 800 : 180)
    startTransition(() => setLod(Math.round(next.k * 12) / 12))
  }
  // keep the picture where it was when the window changes size
  useEffect(() => { paint({ ...viewRef.current, glide: false }) }, [box.w, box.h, bw, bh]) // eslint-disable-line react-hooks/exhaustive-deps

  // zoom by a factor about a screen point: used by the wheel, trackpad pinch and the buttons
  function zoomTo(nextK: number | ((current: number) => number), px: number, py: number, glide: boolean) {
    setHint(false)
    if (glide) stopMotion()
    const v = viewRef.current
    const cur = geometry(v.k, v.x, v.y)
    const kk = Math.min(MAX_ZOOM, Math.max(1, typeof nextK === 'function' ? nextK(v.k) : nextK))
    if (kk === v.k) return
    const s = fit * kk, wx = (px - cur.tx) / cur.s, wy = (py - cur.ty) / cur.s
    const c = centred(s)
    paint({ k: kk, x: px - wx * s - c.cx, y: py - wy * s - c.cy, glide })
  }
  function stopMotion() {
    cancelAnimationFrame(zoomAnim.current.raf); zoomAnim.current.raf = 0
    cancelAnimationFrame(momentum.current); momentum.current = 0
  }
  // carry the view to a world point so that a span of `span` fills the part of the window the drawer leaves free
  function flyTo(wx: number, wy: number, span: number, inset = 0, left = 0, top = 0, bottom = 0) {
    stopMotion()
    const free = box.w - inset - left, freeH = box.h - top - bottom
    const kk = Math.min(MAX_ZOOM, Math.max(1, Math.min(free, freeH) / (span * fit)))
    const s = fit * kk
    const c = centred(s)
    paint({ k: kk, x: left + free / 2 - wx * s - c.cx, y: top + freeH / 2 - wy * s - c.cy, glide: true })
  }
  const phone = box.w <= PHONE
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []) // a finger needs more room than a pointer
  const home = phone ? PHONE_HOME : 1
  const topBar = phone ? TOP_BAR_PHONE : TOP_BAR
  const drawerInset = phone ? 0 : Math.min(DRAWER, box.w * 0.5)
  const sheet = drawer && phone ? Math.round(box.h * 0.5) : 0 // on a phone the drawer is a sheet over the lower half

  // wheel and trackpad: a scroll or a pinch sets a zoom target about the pointer, and the camera eases toward it
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  function stepZoom(now: number) {
    const a = zoomAnim.current, current = viewRef.current.k
    const dt = Math.max(1, Math.min(50, now - a.t))
    a.t = now
    const next = calm() ? a.target : current + (a.target - current) * (1 - Math.exp(-dt / 90))
    const done = Math.abs(a.target - next) < a.target * 0.0015
    zoomTo(done ? a.target : next, a.px, a.py, false)
    a.raf = done ? 0 : requestAnimationFrame(stepZoom)
  }
  function nudgeZoom(factor: number, px: number, py: number) {
    const a = zoomAnim.current
    cancelAnimationFrame(momentum.current)
    a.target = Math.min(MAX_ZOOM, Math.max(1, (a.raf ? a.target : viewRef.current.k) * factor))
    a.px = px; a.py = py
    if (!a.raf) { a.t = performance.now(); a.raf = requestAnimationFrame(stepZoom) }
  }
  useEffect(() => {
    const node = surface.current
    if (!node) return
    const at = (event: MouseEvent) => { const rect = node.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top] as const }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
      const [x, y] = at(event)
      nudgeZoom(Math.exp(-Math.max(-120, Math.min(120, event.deltaY * lines)) * (event.ctrlKey ? 0.012 : 0.004)), x, y)
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
      nudgeZoom(ratio, x, y)
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

  useEffect(() => stopMotion, []) // eslint-disable-line react-hooks/exhaustive-deps

  // selecting a whole island or bridge carries the view there
  useEffect(() => {
    if (!measured) return
    if (selection.length > seen.current && !(boot.current.has('at') && !ready.current)) {
      const last = selection[selection.length - 1]
      if (last.startsWith('i:')) {
        const island = world.islands.find((i) => i.family === last.slice(2))
        if (island) flyTo(island.cx, island.cy, island.r * 2.6, drawerInset, 0, topBar, sheet)
      } else if (last.startsWith('b:')) {
        const [a, b] = last.slice(2).split(/[|~]/).map((f) => world.islands.find((i) => i.family === f))
        if (a && b) flyTo((a.cx + b.cx) / 2, (a.cy + b.cy) / 2, Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy)) + 380, drawerInset, 0, topBar, sheet)
      }
    }
    seen.current = selection.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, measured])

  // Pressing anywhere on the map (an island, a mark, open water) and dragging moves it; a press that hardly moves is a click.
  // Capture is taken only once the pointer has really moved, so clicks on marks and bridges are untouched.
  function panBy(dx: number, dy: number) {
    const v = viewRef.current
    const cur = geometry(v.k, v.x, v.y)
    paint({ ...v, x: cur.tx + dx - cur.cx, y: cur.ty + dy - cur.cy, glide: false })
  }
  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    stopMotion()
    const g = grip.current
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1) {
      travel.current = 0
      Object.assign(g, { dragging: false, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, lastT: performance.now(), vx: 0, vy: 0, pinch: 0 })
    } else {
      const [a, b] = [...pointers.current.values()]
      g.pinch = Math.hypot(a.x - b.x, a.y - b.y)
      travel.current = 99
    }
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const known = pointers.current.get(event.pointerId)
    if (!known) return
    known.x = event.clientX; known.y = event.clientY
    const g = grip.current
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = surface.current!.getBoundingClientRect()
      if (g.pinch > 0 && dist > 0) zoomTo((current) => current * (dist / g.pinch), (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, false)
      g.pinch = dist
      return
    }
    if (!g.dragging) {
      if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) < 4) return
      g.dragging = true
      surface.current?.setPointerCapture(event.pointerId)
    }
    const now = performance.now(), dx = event.clientX - g.lastX, dy = event.clientY - g.lastY, dt = Math.max(1, now - g.lastT)
    travel.current += Math.abs(dx) + Math.abs(dy)
    g.vx = 0.8 * (dx / dt) + 0.2 * g.vx; g.vy = 0.8 * (dy / dt) + 0.2 * g.vy
    Object.assign(g, { lastX: event.clientX, lastY: event.clientY, lastT: now })
    panBy(dx, dy)
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    const g = grip.current
    if (pointers.current.size === 1) { const [rest] = [...pointers.current.values()]; Object.assign(g, { dragging: true, lastX: rest.x, lastY: rest.y, lastT: performance.now(), vx: 0, vy: 0, pinch: 0 }); return }
    if (pointers.current.size > 0) return
    // let go with some speed: the map drifts on and settles
    if (g.dragging && !calm() && performance.now() - g.lastT < 90 && Math.hypot(g.vx, g.vy) > 0.15) {
      let vx = g.vx * 16, vy = g.vy * 16
      const drift = () => {
        vx *= 0.93; vy *= 0.93
        if (Math.hypot(vx, vy) < 0.4) { momentum.current = 0; return }
        panBy(vx, vy)
        momentum.current = requestAnimationFrame(drift)
      }
      momentum.current = requestAnimationFrame(drift)
    }
    g.dragging = false
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
  const anchorRank = useMemo(() => {
    const rank = new Map<string, number>()
    for (const island of world.islands) world.sites.filter((s) => s.family === island.family).sort((a, b) => b.use - a.use).forEach((s, n) => rank.set(s.id, n))
    return rank
  }, [world])
  // method names are placed once per zoom tier, with the type size that tier will really show
  const tier = TIERS.filter((t) => lod >= t - 0.001).length - 1
  const labelAt = useMemo(() => placeLabels(world, fit, TIERS[tier], anchorRank, W), [world, fit, tier, anchorRank, W])
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
  // the matches as one list, so that the arrow keys can walk it
  const options = useMemo(() => found ? [...found.methods.map((t) => ({ id: t.id, theorem: false })), ...found.theorems.map((t) => ({ id: String(t.id), theorem: true }))] : [], [found])
  const choosePick = (option: { id: string; theorem: boolean } | undefined) => { if (option) { if (option.theorem) pickTheorem(Number(option.id)); else pickMethod(option.id) } }
  function pickMethod(id: string) {
    const site = siteById.get(id)
    if (!site) return
    setQuery(''); setSearchOpen(false); setFocus(null); setHint(false)
    flyTo(site.x, site.y, Math.min(box.w, box.h) / (3.4 * fit), drawer ? drawerInset : 0, 0, topBar, sheet)
    // the note goes just under the method, which now sits in the middle of what the panels leave free
    setInfo({ item: `v:${id}`, x: (box.w - (drawer ? drawerInset : 0)) / 2, y: topBar + (box.h - topBar - sheet) / 2 })
  }
  function pickTheorem(id: number) {
    const theorem = data.theorems.find((t) => t.id === id)
    if (!theorem) return
    const pts = theorem.routes.filter((r) => !r.excluded).flatMap((r) => r.techniques).map((m) => siteById.get(m)).filter((p): p is NonNullable<typeof p> => !!p)
    setQuery(''); setSearchOpen(false); setInfo(null); setFocus(id); setHint(false)
    if (pts.length) {
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
      flyTo((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.25 + 420, drawer ? drawerInset : 0, phone ? 0 : 360, topBar, Math.max(sheet, phone ? Math.round(box.h * 0.4) + 56 : 0))
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

  // opening a link: put the map where the address says
  useEffect(() => {
    if (!measured || ready.current) return
    const p = boot.current
    const at = p.get('at')?.split(',').map(Number)
    const placed = !!at && at.length === 3 && at.every(Number.isFinite)
    if (placed) {
      const [wx, wy, kk] = at, z = Math.min(MAX_ZOOM, Math.max(1, kk)), s = fit * z, c = centred(s)
      paint({ k: z, x: box.w / 2 - wx * s - c.cx, y: box.h / 2 - wy * s - c.cy, glide: false })
    }
    if (!placed && home !== 1 && !p.get('theorem') && !p.get('method')) paint({ k: home, x: 0, y: 0, glide: false })
    const theorem = Number(p.get('theorem')), method = p.get('method')
    if (theorem && data.theorems.some((t) => t.id === theorem)) { if (placed) setFocus(theorem); else pickTheorem(theorem) }
    else if (method && siteById.has(method)) { if (placed) setInfo({ item: `v:${method}`, x: box.w / 2, y: box.h / 2 + 30 }); else pickMethod(method) }
    window.setTimeout(() => { ready.current = true }, 900)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured])
  useEffect(() => { if (ready.current) setParam('theorem', focus === null ? null : String(focus)) }, [focus])
  useEffect(() => { document.title = `${focusTheorem ? `${focusTheorem.name.replace(/\$/g, '')} — ` : 'Map of proof methods — '}Proofscape` }, [focusTheorem])
  useEffect(() => { if (ready.current) setParam('method', info?.item.startsWith('v:') ? info.item.slice(2) : null) }, [info])
  // the land itself answers a click like its name does
  const landHit = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d')
    return (wx: number, wy: number) => ctx ? world.islands.find((i) => ctx.isPointInPath(new Path2D(i.path), wx, wy)) : undefined
  }, [world])
  const sink = (id: string) => ({ '--h': (world.siteHeight.get(id) ?? 0.5) + 0.04 }) as React.CSSProperties
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

  act.current = { pan: (dx, dy) => panBy(dx, dy), zoom: (factor) => zoomTo((current) => current * factor, box.w / 2, box.h / 2, true), home: () => paint({ k: home, x: 0, y: 0, glide: true }) }
  return <section ref={page} data-theme={theme.id} className={`world-page${drawer ? ' world-open' : ''}`} style={{ '--grain': theme.grain, background: SEA } as React.CSSProperties} aria-label="A world of proof methods and the theorems they prove">
    <h1 className="sr-only">Proofscape: a map of proof methods</h1>
    <div className="world-hud">
      {onClose && <button type="button" className="world-back" onClick={onClose}>← <span className="world-long">Results list</span><span className="world-short">List</span></button>}
      {onLibrary && <button type="button" className="world-back" onClick={onLibrary}>Library</button>}
      <div className="world-search">
        <input type="search" role="combobox" aria-expanded={searchOpen && options.length > 0} aria-controls="world-found" aria-autocomplete="list" aria-activedescendant={active >= 0 ? `world-option-${active}` : undefined}
          value={query} placeholder="Find a method or a theorem" aria-label="Find a method or a theorem on the map" autoComplete="off"
          onChange={(event) => { if (event.target.value.trim().toLowerCase() === 'sga') { setQuery(''); setSearchOpen(false); startSea(); return } setQuery(event.target.value); setSearchOpen(true); setActive(-1) }} onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setSearchOpen(false); (event.target as HTMLInputElement).blur() }
            else if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); setSearchOpen(true); setActive((a) => (a + 1) % options.length) }
            else if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); setActive((a) => (a <= 0 ? options.length : a) - 1) }
            else if (event.key === 'Enter') choosePick(options[Math.max(0, active)])
          }} />
        {searchOpen && found && <div className="world-found" id="world-found" role="listbox" aria-label="Matches">
          {options.length === 0 && <p>No match.</p>}
          {found.methods.length > 0 && <span className="world-found-head">Methods</span>}
          {found.methods.map((t, n) => <button type="button" tabIndex={-1} key={t.id} id={`world-option-${n}`} role="option" aria-selected={active === n} onClick={() => pickMethod(t.id)}><span><b className="world-found-glyph">{t.glyph}</b> {t.label}</span><em>{familyName[t.family]} › {groupName.get(t.group ?? '')}</em></button>)}
          {found.theorems.length > 0 && <span className="world-found-head">Theorems</span>}
          {found.theorems.map((t, n) => <button type="button" tabIndex={-1} key={t.id} id={`world-option-${found.methods.length + n}`} role="option" aria-selected={active === found.methods.length + n} onClick={() => pickTheorem(t.id)}><MathText text={t.name} /></button>)}
        </div>}
      </div>
      <SelectionBar sel={sel} results={results} lead="" />
      <button type="button" className="world-toggle" aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>{drawer ? <>Hide<span className="world-long"> theorems</span></> : <><span className="world-long">Theorems &amp; methods</span><span className="world-short">Browse</span></>}</button>
    </div>
    <div className="world-stage" ref={stage}>
      <div className="world-surface" ref={surface}
        tabIndex={0} role="group" aria-label="The map. Arrow keys move it; plus and minus zoom; zero resets the view." aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0"
        onClick={(event) => {
          if (travel.current >= 4 || (event.target as Element).closest('[data-world-item]')) return
          const rect = event.currentTarget.getBoundingClientRect(), g = geometry(viewRef.current.k, viewRef.current.x, viewRef.current.y)
          const island = landHit((event.clientX - rect.left - g.tx) / g.s, (event.clientY - rect.top - g.ty) / g.s)
          if (island) { setHint(false); setInfo({ item: `i:${island.family}`, x: event.clientX - rect.left, y: event.clientY - rect.top }) } else clearAll()
        }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest('[data-world-item]')) return
          setInfo(null)
          const rect = event.currentTarget.getBoundingClientRect()
          zoomTo((current) => current * 2, event.clientX - rect.left, event.clientY - rect.top, true)
        }}>
      <div className="world-layer" ref={layer} style={{ width: bw * raster.current, height: bh * raster.current, transform: layerTransform(rested) }}>
      <svg ref={svg} className="world-svg" width={bw * raster.current} height={bh * raster.current} viewBox={`${bx} ${by} ${bw} ${bh}`} role="group" aria-label="A map of islands of proof methods joined by bridges">
        <defs>
          <pattern id="w-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <path d="M0,0V5" stroke={INK} strokeWidth="1" />
          </pattern>
          <filter id="w-goo" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="3.4" />
            <feComponentTransfer><feFuncA type="linear" slope="14" intercept="-6" /></feComponentTransfer>
          </filter>
          {world.islands.map((i) => <clipPath key={`clip-${i.family}`} id={`w-clip-${i.family}`}><path d={i.path} /></clipPath>)}
          {world.islands.map((i) => <radialGradient key={i.family} id={`w-clear-${i.family}`}>
            <stop offset="0" stopColor={theme.hue(i.family).land} stopOpacity="0.96" />
            <stop offset="0.62" stopColor={theme.hue(i.family).land} stopOpacity="0.9" />
            <stop offset="1" stopColor={theme.hue(i.family).land} stopOpacity="0" />
          </radialGradient>)}
        </defs>
        <g className="world-camera">
          <LandLayer world={world} theme={theme} close={close} />
          {seaOn && world.islands.map((i) => <g key={`flood-${i.family}`} clipPath={`url(#w-clip-${i.family})`} pointerEvents="none">
            <g filter="url(#w-goo)" fill={theme.id === 'ink' ? '#7fa3af' : '#4f8cc8'} fillOpacity="0.9">
              {i.flood.map((l) => <path key={l.level} className="world-sea-layer" style={{ '--lv': l.level } as React.CSSProperties} d={l.d} />)}
              <path className="world-sea-layer" style={{ '--lv': 1.0 } as React.CSSProperties} d={i.path} />
            </g>
          </g>)}
          <g className="world-sinkable" style={{ '--h': 0.42 } as React.CSSProperties}>
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
          </g>
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
          <g className="world-sinkable" style={{ '--h': 0.5 } as React.CSSProperties}>
          {world.groups.map((g) => {
            const c = theme.hue(g.family), show = focus !== null ? 0 : (dim ? 0.35 : 1) * fade(k, 1.3, 1.9)
            return show > 0.02 ? <text key={g.id} className="world-group" x={fixed(g.x)} y={fixed(g.y)} textAnchor="middle" opacity={show} pointerEvents="none"
              style={{ fill: c.dark, stroke: theme.label.halo(c), fontSize: `${Math.min(17, 12.5 / scale).toFixed(1)}px` }}>{g.label}</text> : null
          })}
          </g>
          {routes.map((r) => <g key={r.id} pointerEvents="none">
            <g opacity="0.2"><path d={r.blob} fill={r.color} stroke={r.color} strokeWidth="34" strokeLinejoin="round" strokeLinecap="round" /></g>
            <path d={r.chain} fill="none" stroke={r.color} strokeWidth="2.4" strokeDasharray="7 6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          </g>)}
          {world.sites.map((s) => {
            const { shown, faint } = siteState(s)
            if (!shown) return null
            const rc = world.radius(s.use) * Math.min(1, 46 / (2 * world.radius(s.use) * scale)) * 1.7
            return <g key={`clear-${s.id}`} className="world-sinkable" style={sink(s.id)}><circle cx={s.x} cy={s.y} r={rc.toFixed(1)} fill={`url(#w-clear-${s.family})`} pointerEvents="none" opacity={faint ? 0.3 : 1} /></g>
          })}
          {world.sites.map((s) => {
            const { item, on, noted, shown, faint } = siteState(s), shrunk = Math.min(1, 46 / (2 * world.radius(s.use) * scale)), r = world.radius(s.use) * shrunk, c = theme.hue(s.family)
            return <g key={item} className="world-sinkable" style={sink(s.id)}><g data-world-item className="world-site" onPointerEnter={() => { const g = geometry(viewRef.current.k, viewRef.current.x, viewRef.current.y); setTip({ id: s.id, x: g.tx + s.x * g.s, y: g.ty + (s.y - r) * g.s }); startTransition(() => setHoverSite(s.id)) }} onPointerLeave={() => { setTip(null); startTransition(() => setHoverSite(null)) }} opacity={shown ? (faint ? (focus !== null ? 0.1 : 0.25) : 1) : 0} pointerEvents={shown ? undefined : 'none'}
              aria-label={`${s.short}, ${s.use} theorem${s.use === 1 ? '' : 's'}`} {...choose(item, lod >= 2)}>
              {(on || noted) && <circle cx={s.x} cy={s.y} r={r + 7} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="4 4" />}
              <circle cx={s.x} cy={s.y} r={Math.max(r, coarse ? 16 / scale : 0)} fill="transparent" />
              <text className="world-glyph" x={s.x} y={s.y} dy="0.34em" textAnchor="middle"
                style={{ fontSize: `${(world.markFont(s) * shrunk).toFixed(1)}px`, fill: theme.id === 'ink' ? c.dark : theme.label.fill, stroke: focusColour.get(s.id) ?? theme.label.halo(c), strokeWidth: focusColour.has(s.id) ? 7 : 5 }}>{model.names.get(s.id)?.glyph ?? '•'}</text>
            </g>
            </g>
          })}
          {routes.map((r) => <g key={`badge-${r.id}`} pointerEvents="none" transform={`translate(${fixed(r.at[0])} ${fixed(r.at[1] - 34)}) scale(${lettering.toFixed(3)})`}>
            <rect x="-13" y="-13" width="26" height="26" rx="4" fill={PAPER} stroke={r.color} strokeWidth="2" />
            <text y="6" textAnchor="middle" className="world-badge" style={{ fill: r.color }}>{r.letter}</text>
          </g>)}
          {world.sites.map((s) => {
            const { shown, showLabel, faint } = siteState(s), l = labelAt.get(s.id), c = theme.hue(s.family)
            return l && shown && showLabel ? <g key={`name-${s.id}`} className="world-sinkable" style={sink(s.id)}><text data-world-item className="world-label" x={fixed(l.x)} y={fixed(l.y)} textAnchor={l.anchor} opacity={faint ? (focus !== null ? 0.1 : 0.3) : 1} {...choose(`v:${s.id}`, false)}
              style={{ fill: theme.label.fill, stroke: theme.label.halo(c), fontSize: `${Math.min(25, 16.5 / scale).toFixed(1)}px` }}>{s.short}</text></g> : null
          })}
          {world.islands.map((i) => {
            const item = `i:${i.family}`, on = chosen.has(item), faded = dim && !live.islands.has(i.family) && !on
            const below = i.below, c = theme.hue(i.family)
            return <g key={item} data-world-item className="world-island-name" onPointerEnter={() => startTransition(() => setHover(i.family))} onPointerLeave={() => startTransition(() => setHover(null))} opacity={faded ? 0.4 : 1} aria-label={`${familyName[i.family]} island`} {...choose(item)}
              transform={`translate(${fixed(i.cx)} ${fixed(below ? i.bottom + 34 : i.top - 26)}) scale(${((tone(k) ** 1.1) * (phone ? 2 : 1)).toFixed(3)})`}>
              <Ribbon text={familyName[i.family].toUpperCase()} size={21} paper={PAPER} color={on ? GOLD : c.dark} ink={c.dark} tail={c.halo} />
            </g>
          })}
        </g>
      </svg>
      </div>
      </div>
      <div className="world-deepen" aria-hidden="true" />
      {seaOn && <figure className="world-sea-quote" lang="fr">
        <blockquote>« La mer avance insensiblement et sans bruit… elle finit par entourer la substance rétive. »</blockquote>
        <figcaption>Alexandre Grothendieck, <i>Récoltes et Semailles</i></figcaption>
      </figure>}
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
      {hint && <div className="world-hint"><span className="world-hint-mouse">Click for a quick note, double-click to list theorems · scroll or pinch to zoom, drag to move</span><span className="world-hint-touch">Pinch to zoom, drag to move, tap an island or a mark</span></div>}
      <div className="world-controls">
        <div className="world-zoom" role="group" aria-label="Map zoom">
          <button type="button" onClick={() => zoomTo(k * 1.6, box.w / 2, box.h / 2, true)} aria-label="Zoom in" disabled={k >= MAX_ZOOM}>+</button>
          <button type="button" onClick={() => zoomTo(k / 1.6, box.w / 2, box.h / 2, true)} aria-label="Zoom out" disabled={k <= 1}>−</button>
          <button type="button" onClick={() => act.current.home()} aria-label="Reset view" disabled={Math.abs(k - home) < 0.01}>⌂</button>
        </div>
      </div>
    </div>
    <aside className="world-drawer" hidden={!drawer} aria-label="Theorems and methods">
      <ResultsPanel sel={sel} model={model} catalog={catalog} results={results} onOpenEntry={onOpenEntry}
        hint="Each island is a domain of method, and methods that appear in the same theorems sit closer together. Zoom in to reveal more methods, their names, and the trails between them. A trail inside an island, or a lane on a bridge between islands, is a chord: two methods that distinguish two routes of one theorem. Click anything for a short note; double-click it to list its theorems. Click an empty spot to start over." />
      <MethodList data={data} model={model} sel={sel} />
      <p className="ring-note">Bridge numbers count the method pairs that cross; dot size is the number of theorems using the method. Methods are tagged by two independent reviewers from the proof sketches, so they are inferred, not source-verified. Routes judged duplicate, dependent or incomplete are left out.</p>
    </aside>
  </section>
}

export default function WorldMap({ catalog, onOpenEntry, onClose, onLibrary }: { catalog: Catalog; onOpenEntry: (id: number) => void; onClose?: () => void; onLibrary?: () => void }) {
  const { data, model, error } = useMethodData()
  if (error) return <div className="collection-offline" role="alert">The world map is unavailable. {error}</div>
  if (!data || !model) return <div className="ring-loading" aria-live="polite">Loading the method index…</div>
  return <WorldBody data={data} model={model} catalog={catalog} onOpenEntry={onOpenEntry} onClose={onClose} onLibrary={onLibrary} />
}
