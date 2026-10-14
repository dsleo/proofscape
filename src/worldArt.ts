type P = [number, number]
export type Chalk = { d: string; tone: 'line' | 'faint' | 'accent' | 'tint' | 'dots' }

const f = (n: number) => n.toFixed(1)

function inside(p: P, poly: P[]) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export function polygonArea(poly: P[]) {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1])
  return Math.abs(a / 2)
}

// ---- single motifs: each returns path data drawn around (x, y) -----------------------------------------------------
const conifer = (x: number, y: number, s: number) => `M${f(x)},${f(y + 7 * s)}V${f(y + 3 * s)}M${f(x - 6 * s)},${f(y + 3 * s)}L${f(x)},${f(y - 7 * s)}L${f(x + 6 * s)},${f(y + 3 * s)}ZM${f(x - 4.5 * s)},${f(y - 2 * s)}L${f(x)},${f(y - 11 * s)}L${f(x + 4.5 * s)},${f(y - 2 * s)}Z`
const roundTree = (x: number, y: number, s: number) => `M${f(x)},${f(y + 7 * s)}V${f(y + 1 * s)}M${f(x - 5 * s)},${f(y - 3 * s)}a${5 * s},${5 * s} 0 1,0 ${10 * s},0a${5 * s},${5 * s} 0 1,0 ${-10 * s},0`
const mountain = (x: number, y: number, s: number) => {
  let hatch = ''
  for (let i = 1; i <= 4; i++) hatch += `M${f(x + s * 0.45 + i * s * 0.12)},${f(y - s * 1.35 + i * s * 0.32)}l${f(s * 0.2)},${f(s * 0.28)}`
  return `M${f(x - s)},${f(y)}L${f(x - s * 0.35)},${f(y - s * 1.1)}L${f(x + s * 0.05)},${f(y - s * 0.7)}L${f(x + s * 0.5)},${f(y - s * 1.4)}L${f(x + s * 1.05)},${f(y)}Z${hatch}`
}
const hill = (x: number, y: number, s: number) => `M${f(x - 14 * s)},${f(y)}Q${f(x)},${f(y - 16 * s)} ${f(x + 14 * s)},${f(y)}M${f(x + 4 * s)},${f(y - 8 * s)}l${f(4 * s)},${f(5 * s)}M${f(x + 8 * s)},${f(y - 5 * s)}l${f(3 * s)},${f(4 * s)}`
const wave = (x: number, y: number, s: number) => `M${f(x - 16 * s)},${f(y)}q${f(8 * s)},${f(-9 * s)} ${f(16 * s)},0t${f(16 * s)},0M${f(x - 10 * s)},${f(y + 7 * s)}q${f(8 * s)},${f(-9 * s)} ${f(16 * s)},0t${f(12 * s)},0`
const cube = (x: number, y: number, s: number) => `M${f(x)},${f(y - 11 * s)}L${f(x + 10 * s)},${f(y - 5 * s)}V${f(y + 6 * s)}L${f(x)},${f(y + 12 * s)}L${f(x - 10 * s)},${f(y + 6 * s)}V${f(y - 5 * s)}ZM${f(x - 10 * s)},${f(y - 5 * s)}L${f(x)},${f(y + 1 * s)}L${f(x + 10 * s)},${f(y - 5 * s)}M${f(x)},${f(y + 1 * s)}V${f(y + 12 * s)}`
const crystal = (x: number, y: number, s: number) => `M${f(x)},${f(y - 15 * s)}L${f(x + 7 * s)},${f(y - 6 * s)}V${f(y + 7 * s)}L${f(x)},${f(y + 12 * s)}L${f(x - 7 * s)},${f(y + 7 * s)}V${f(y - 6 * s)}ZM${f(x - 7 * s)},${f(y - 6 * s)}L${f(x)},${f(y - 1 * s)}L${f(x + 7 * s)},${f(y - 6 * s)}M${f(x)},${f(y - 1 * s)}V${f(y + 12 * s)}M${f(x)},${f(y - 15 * s)}L${f(x)},${f(y - 1 * s)}`
const octahedron = (x: number, y: number, s: number) => `M${f(x)},${f(y - 13 * s)}L${f(x + 10 * s)},${f(y)}L${f(x)},${f(y + 13 * s)}L${f(x - 10 * s)},${f(y)}ZM${f(x - 10 * s)},${f(y)}H${f(x + 10 * s)}M${f(x)},${f(y - 13 * s)}L${f(x + 4 * s)},${f(y)}L${f(x)},${f(y + 13 * s)}`
const triangle = (x: number, y: number, s: number) => `M${f(x - 13 * s)},${f(y + 9 * s)}H${f(x + 13 * s)}L${f(x)},${f(y - 12 * s)}ZM${f(x)},${f(y - 12 * s)}V${f(y + 9 * s)}M${f(x)},${f(y + 9 * s)}h${f(3 * s)}v${f(-3 * s)}`
const compass = (x: number, y: number, s: number) => `M${f(x - 15 * s)},${f(y + 6 * s)}A${15 * s},${15 * s} 0 0 1 ${f(x + 15 * s)},${f(y + 6 * s)}M${f(x)},${f(y + 6 * s)}L${f(x + 9 * s)},${f(y - 6 * s)}M${f(x - 15 * s)},${f(y + 6 * s)}H${f(x + 15 * s)}`
const dice = (x: number, y: number, s: number) => `${cube(x, y, s)}M${f(x - 3 * s)},${f(y - 5 * s)}h0.1M${f(x + 3 * s)},${f(y - 5 * s)}h0.1M${f(x)},${f(y - 8 * s)}h0.1M${f(x)},${f(y - 3 * s)}h0.1`
const grid = (x: number, y: number, s: number) => {
  let d = ''
  for (let i = 0; i < 4; i++) d += `M${f(x - 12 * s)},${f(y - 12 * s + i * 8 * s)}h${f(24 * s)}M${f(x - 12 * s + i * 8 * s)},${f(y - 12 * s)}v${f(24 * s)}`
  return d
}
const stones = (x: number, y: number, s: number) => [[-14, 3], [-5, -2], [4, 3], [13, -1]].map(([dx, dy]) => `M${f(x + (dx - 4) * s)},${f(y + dy * s)}a${4 * s},${2 * s} 0 1,0 ${8 * s},0a${4 * s},${2 * s} 0 1,0 ${-8 * s},0`).join('')
const stairs = (x: number, y: number, s: number) => { let d = `M${f(x - 18 * s)},${f(y + 12 * s)}`; for (let i = 0; i < 5; i++) d += `h${f(7 * s)}v${f(-5 * s)}`; return d }
const spiral = (x: number, y: number, s: number) => {
  let d = ''
  for (let i = 0; i <= 40; i++) { const a = i * 0.45, r = (1.2 + i * 0.32) * s; d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)}` }
  return d
}
const monolith = (x: number, y: number, s: number) => `M${f(x - 4 * s)},${f(y + 10 * s)}L${f(x + 4 * s)},${f(y + 6 * s)}V${f(y - 20 * s)}L${f(x - 4 * s)},${f(y - 16 * s)}ZM${f(x - 4 * s)},${f(y - 16 * s)}L${f(x)},${f(y - 20 * s)}L${f(x + 4 * s)},${f(y - 20 * s)}`
const lighthouse = (x: number, y: number, s: number) => `M${f(x - 6 * s)},${f(y + 18 * s)}L${f(x - 3.5 * s)},${f(y - 10 * s)}H${f(x + 3.5 * s)}L${f(x + 6 * s)},${f(y + 18 * s)}ZM${f(x - 5 * s)},${f(y - 10 * s)}H${f(x + 5 * s)}M${f(x - 3 * s)},${f(y - 10 * s)}L${f(x)},${f(y - 17 * s)}L${f(x + 3 * s)},${f(y - 10 * s)}`
const beam = (x: number, y: number, s: number) => `M${f(x + 5 * s)},${f(y - 11 * s)}L${f(x + 44 * s)},${f(y - 24 * s)}M${f(x + 5 * s)},${f(y - 11 * s)}L${f(x + 44 * s)},${f(y - 2 * s)}`
const river = (pts: P[]) => {
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`
  for (let i = 1; i < pts.length - 1; i++) { const e = mid(pts[i], pts[i + 1]); d += `Q${f(pts[i][0])},${f(pts[i][1])} ${f(e[0])},${f(e[1])}` }
  const last = pts[pts.length - 1]
  return `${d}L${f(last[0])},${f(last[1])}`
}

type Motif = (x: number, y: number, s: number) => string
const kit: Record<string, { motifs: [Motif, number, 'line' | 'faint'][]; density: number }> = {
  analytic: { motifs: [[mountain, 3, 'line'], [hill, 4, 'line'], [conifer, 5, 'line'], [wave, 4, 'faint'], [roundTree, 3, 'line']], density: 1 },
  algebraic: { motifs: [[crystal, 6, 'line'], [octahedron, 2, 'line'], [roundTree, 1, 'line'], [grid, 1, 'faint']], density: 0.9 },
  geometric: { motifs: [[cube, 3, 'line'], [octahedron, 2, 'line'], [triangle, 3, 'line'], [compass, 2, 'faint'], [conifer, 2, 'line']], density: 0.9 },
  discrete: { motifs: [[dice, 4, 'line'], [grid, 2, 'faint'], [stones, 3, 'faint'], [roundTree, 2, 'line']], density: 0.9 },
  recursion: { motifs: [[stairs, 4, 'line'], [spiral, 2, 'faint'], [conifer, 3, 'line'], [hill, 2, 'line']], density: 1.2 },
  logic: { motifs: [[monolith, 3, 'line'], [hill, 2, 'line'], [conifer, 2, 'line'], [stones, 1, 'faint']], density: 1.4 },
}

/** Chalk topography for one island: contours, a river or ridge line, and a few landmark motifs per domain. */
export function islandArt(family: string, ring: P[], centre: P, sites: P[], rnd: () => number): Chalk[] {
  const art: Chalk[] = []
  const around = (k: number, wobble: number) => ring.map(([x, y], i): P => {
    const dx = x - centre[0], dy = y - centre[1], w = 1 + Math.sin(i * 1.7 + k * 3) * wobble
    return [centre[0] + dx * k * w, centre[1] + dy * k * w]
  })
  ;[0.86, 0.66, 0.46].forEach((k) => {
    const pts = around(k, 0.045)
    art.push({ d: `${pts.map(([x, y], j) => `${j ? 'L' : 'M'}${f(x)},${f(y)}`).join('')}Z`, tone: 'tint' })
  })
  const bounds = (() => { const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] })()
  const area0 = polygonArea(ring)
  let dots = '', made = 0
  for (let tries = 0; tries < 4000 && made < Math.min(700, area0 / 240); tries++) {
    const q: P = [bounds[0] + rnd() * (bounds[1] - bounds[0]), bounds[2] + rnd() * (bounds[3] - bounds[2])]
    if (!inside(q, ring)) continue
    dots += `M${f(q[0])},${f(q[1])}h0.1`
    made++
  }
  art.push({ d: dots, tone: 'dots' })
  if (family === 'analytic') {
    const start: P = [centre[0] - 40, centre[1] + 10]
    const pts: P[] = [start]
    for (let i = 1; i <= 6; i++) pts.push([start[0] + i * 26 + (rnd() - 0.5) * 12, start[1] + Math.sin(i * 1.1) * 26 + i * 4])
    art.push({ d: river(pts), tone: 'accent' })
  }
  if (family === 'logic') {
    const [lx, ly] = [centre[0] + 18, centre[1] - 22]
    art.push({ d: lighthouse(lx, ly, 1.4), tone: 'line' }, { d: beam(lx, ly, 1.4), tone: 'accent' })
  }
  const taken: P[] = [...sites]
  const area = polygonArea(ring)
  const target = Math.max(9, Math.round((area / 2300) * kit[family].density))
  const bag: [Motif, 'line' | 'faint'][] = []
  kit[family].motifs.forEach(([m, w, tone]) => { for (let i = 0; i < w; i++) bag.push([m, tone]) })
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  let placed = 0
  for (let tries = 0; tries < 2500 && placed < target; tries++) {
    const p: P = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)]
    if (!inside(p, ring)) continue
    if (ring.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 20)) continue
    if (taken.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 36)) continue
    const [motif, tone] = bag[Math.floor(rnd() * bag.length)]
    const s = 1.05 + rnd() * 0.55
    art.push({ d: motif(p[0], p[1], s), tone })
    taken.push(p)
    placed++
  }
  return art
}

/** Dotted moon, in the style of the reference night scene. */
export function moon(cx: number, cy: number, r: number, count: number, rnd: () => number) {
  let d = ''
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, k = Math.sqrt(rnd()), rr = r * (0.55 + 0.45 * k)
    d += `M${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)}h0.1`
  }
  return d
}
