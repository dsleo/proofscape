type P = [number, number]

export type Terrain = {
  minor: string
  major: string
  rivers: { bank: string; water: string }[]
  mountains: string
  hatch: string
  trees: string
  ink: string
  sage: string
  ripples: P[][]
}

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

const smoothstep = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

// ---- hand-drawn glyphs ---------------------------------------------------------------------------------------------
function peak(x: number, y: number, s: number, rnd: () => number) {
  const w = s * 1.15, h = s
  const jag = () => (rnd() - 0.5) * s * 0.12
  const pts: P[] = [[x - w, y], [x - w * 0.55, y - h * 0.5 + jag()], [x - w * 0.3, y - h * 0.42 + jag()], [x + w * 0.02, y - h], [x + w * 0.32, y - h * 0.52 + jag()], [x + w * 0.58, y - h * 0.64 + jag()], [x + w, y]]
  const outline = pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])},${f(p[1])}`).join('')
  let hatch = ''
  for (let i = 3; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], steps = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.4))
    for (let k = 1; k < steps; k++) {
      const u = k / steps, sx = a[0] + (b[0] - a[0]) * u, sy = a[1] + (b[1] - a[1]) * u
      hatch += `M${f(sx)},${f(sy)}l${f(s * 0.17)},${f(Math.min(s * 0.5, (y - sy) * 0.8))}`
    }
  }
  return { outline: `${outline}`, hatch, base: `M${f(x - w * 1.05)},${f(y)}H${f(x + w * 1.05)}` }
}

function conifer(x: number, y: number, s: number) {
  return `M${f(x)},${f(y)}V${f(y - 3 * s)}M${f(x - 3.4 * s)},${f(y - 2.4 * s)}L${f(x)},${f(y - 8 * s)}L${f(x + 3.4 * s)},${f(y - 2.4 * s)}M${f(x - 2.8 * s)},${f(y - 5.2 * s)}L${f(x)},${f(y - 10.5 * s)}L${f(x + 2.8 * s)},${f(y - 5.2 * s)}`
}
function leafy(x: number, y: number, s: number) {
  return `M${f(x)},${f(y)}V${f(y - 3 * s)}M${f(x - 3.4 * s)},${f(y - 5 * s)}a${3.4 * s},${3.2 * s} 0 1,1 ${6.8 * s},0a${2.4 * s},${2.4 * s} 0 0,1 ${-2 * s},${3 * s}H${f(x - 1.4 * s)}a${2.4 * s},${2.4 * s} 0 0,1 ${-2 * s},${-3 * s}`
}


// ---- one landmark family per domain, drawn in the same thin ink ------------------------------------------------------
const mill = (x: number, y: number, s: number) => `M${f(x - 5 * s)},${f(y)}L${f(x - 3.4 * s)},${f(y - 11 * s)}H${f(x + 3.4 * s)}L${f(x + 5 * s)},${f(y)}ZM${f(x)},${f(y - 11 * s)}L${f(x - 11 * s)},${f(y - 19 * s)}M${f(x)},${f(y - 11 * s)}L${f(x + 11 * s)},${f(y - 19 * s)}M${f(x)},${f(y - 11 * s)}L${f(x - 9 * s)},${f(y - 2 * s)}M${f(x)},${f(y - 11 * s)}L${f(x + 9 * s)},${f(y - 3 * s)}`
const crystals = (x: number, y: number, s: number) => [[0, 0, 1], [-9, 4, 0.7], [8, 3, 0.8]].map(([dx, dy, k]) => `M${f(x + dx * s)},${f(y + dy * s)}l${f(-4 * k * s)},${f(-6 * k * s)}l${f(4 * k * s)},${f(-12 * k * s)}l${f(4 * k * s)},${f(12 * k * s)}l${f(-4 * k * s)},${f(6 * k * s)}ZM${f(x + dx * s)},${f(y + dy * s)}V${f(y + (dy - 18) * s * k)}`).join('')
const obelisk = (x: number, y: number, s: number) => `M${f(x - 3 * s)},${f(y)}L${f(x - 2 * s)},${f(y - 20 * s)}L${f(x)},${f(y - 25 * s)}L${f(x + 2 * s)},${f(y - 20 * s)}L${f(x + 3 * s)},${f(y)}ZM${f(x - 6 * s)},${f(y)}H${f(x + 6 * s)}M${f(x)},${f(y - 25 * s)}V${f(y)}`
const fields = (x: number, y: number, s: number) => [[-13, 0], [0, -3], [13, 0]].map(([dx, dy]) => {
  const ax = x + dx * s, ay = y + dy * s
  let d = `M${f(ax - 6 * s)},${f(ay)}l${f(12 * s)},${f(-3 * s)}l${f(2 * s)},${f(9 * s)}l${f(-12 * s)},${f(3 * s)}Z`
  for (let i = 1; i < 4; i++) d += `M${f(ax - 6 * s + i * 3 * s)},${f(ay - i * 0.7 * s)}l${f(0.5 * s)},${f(11 * s)}`
  return d
}).join('')
const terraces = (x: number, y: number, s: number) => [0, 1, 2, 3].map((i) => `M${f(x - (24 - i * 5) * s)},${f(y - i * 5 * s)}Q${f(x)},${f(y - (14 + i * 5) * s)} ${f(x + (24 - i * 5) * s)},${f(y - i * 5 * s)}`).join('')
const lighthouse = (x: number, y: number, s: number) => `M${f(x - 6 * s)},${f(y)}L${f(x - 3.5 * s)},${f(y - 24 * s)}H${f(x + 3.5 * s)}L${f(x + 6 * s)},${f(y)}ZM${f(x - 5 * s)},${f(y - 24 * s)}H${f(x + 5 * s)}M${f(x - 3 * s)},${f(y - 24 * s)}L${f(x)},${f(y - 31 * s)}L${f(x + 3 * s)},${f(y - 24 * s)}M${f(x + 5 * s)},${f(y - 26 * s)}L${f(x + 22 * s)},${f(y - 32 * s)}M${f(x + 5 * s)},${f(y - 26 * s)}L${f(x + 22 * s)},${f(y - 20 * s)}`
const landmark: Record<string, [(x: number, y: number, s: number) => string, number]> = {
  analytic: [mill, 3], algebraic: [crystals, 4], geometric: [obelisk, 4], discrete: [fields, 4], recursion: [terraces, 3], logic: [lighthouse, 2],
}

/** A heightfield-driven pen-and-ink landscape for one island. */
export function terrain(family: string, ring: P[], centre: P, sites: P[], rnd: () => number): Terrain {
  const g = 7
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
  const x0 = Math.floor(Math.min(...xs) - 8), y0 = Math.floor(Math.min(...ys) - 8)
  const nx = Math.ceil((Math.max(...xs) - x0 + 16) / g) + 1, ny = Math.ceil((Math.max(...ys) - y0 + 16) / g) + 1
  const node = (i: number, j: number): P => [x0 + i * g, y0 + j * g]
  const ins = new Uint8Array(nx * ny), dist = new Float32Array(nx * ny)
  let maxD = 1
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = node(i, j)
    if (!inside(p, ring)) continue
    ins[j * nx + i] = 1
    let d = 1e9
    for (const q of ring) d = Math.min(d, Math.hypot(q[0] - p[0], q[1] - p[1]))
    dist[j * nx + i] = d
    if (d > maxD) maxD = d
  }
  const table = Array.from({ length: 36 * 36 }, () => rnd())
  const vn = (x: number, y: number) => {
    const gx = Math.floor(x), gy = Math.floor(y), tx = smoothstep(x - gx), ty = smoothstep(y - gy)
    const at = (a: number, b: number) => table[(((b % 36) + 36) % 36) * 36 + (((a % 36) + 36) % 36)]
    return (at(gx, gy) * (1 - tx) + at(gx + 1, gy) * tx) * (1 - ty) + (at(gx, gy + 1) * (1 - tx) + at(gx + 1, gy + 1) * tx) * ty
  }
  const crest = Math.max(1, Math.round(polygonArea(ring) / 26000)) + (family === 'analytic' || family === 'geometric' ? 1 : 0)
  const peaks: { p: P; a: number; s: number }[] = []
  const cands: P[] = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (ins[j * nx + i] && dist[j * nx + i] > maxD * 0.42) cands.push(node(i, j))
  for (let k = 0; k < crest && cands.length; k++) {
    for (let t = 0; t < 60; t++) {
      const p = cands[Math.floor(rnd() * cands.length)]
      if (peaks.every((q) => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) > 80)) { peaks.push({ p, a: 0.55 + rnd() * 0.45, s: 34 + rnd() * 26 }); break }
    }
  }
  if (!peaks.length) peaks.push({ p: centre, a: 0.8, s: 50 })
  const hv = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i
    if (!ins[k]) continue
    const [x, y] = node(i, j)
    let h = 0.46 * smoothstep(dist[k] / (maxD * 0.85))
    for (const q of peaks) h += q.a * 0.62 * Math.exp(-((x - q.p[0]) ** 2 + (y - q.p[1]) ** 2) / (2 * q.s * q.s))
    h += 0.16 * (vn(x / 34, y / 34) - 0.5) + 0.07 * (vn(x / 13, y / 13) - 0.5)
    hv[k] = Math.max(0.001, Math.min(1, h))
  }
  // contour lines by marching squares
  const minor: string[] = [], major: string[] = []
  const levels = Array.from({ length: 13 }, (_, i) => 0.06 + i * 0.07)
  levels.forEach((L, li) => {
    const out: string[] = []
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const tl = hv[j * nx + i], tr = hv[j * nx + i + 1], br = hv[(j + 1) * nx + i + 1], bl = hv[(j + 1) * nx + i]
      const c = (tl > L ? 8 : 0) + (tr > L ? 4 : 0) + (br > L ? 2 : 0) + (bl > L ? 1 : 0)
      if (c === 0 || c === 15) continue
      const [px, py] = node(i, j)
      const top = (): P => [px + ((L - tl) / (tr - tl)) * g, py]
      const right = (): P => [px + g, py + ((L - tr) / (br - tr)) * g]
      const bottom = (): P => [px + ((L - bl) / (br - bl)) * g, py + g]
      const left = (): P => [px, py + ((L - tl) / (bl - tl)) * g]
      const seg = (a: P, b: P) => out.push(`M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`)
      switch (c) {
        case 1: case 14: seg(left(), bottom()); break
        case 2: case 13: seg(bottom(), right()); break
        case 3: case 12: seg(left(), right()); break
        case 4: case 11: seg(top(), right()); break
        case 5: seg(top(), right()); seg(left(), bottom()); break
        case 6: case 9: seg(top(), bottom()); break
        case 7: case 8: seg(top(), left()); break
        case 10: seg(top(), left()); seg(bottom(), right()); break
      }
    }
    ;(li % 3 === 2 ? major : minor).push(out.join(''))
  })
  // rivers: steepest descent from the highest crests
  const rivers: { bank: string; water: string }[] = []
  const sources = [...peaks].sort((a, b) => b.a - a.a).slice(0, family === 'analytic' ? 2 : 1)
  for (const src of sources) {
    let i = Math.round((src.p[0] - x0) / g), j = Math.round((src.p[1] - y0) / g)
    const pts: P[] = [node(i, j)]
    for (let step = 0; step < 220; step++) {
      let best = hv[j * nx + i], bi = i, bj = j
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di, nj = j + dj
        if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue
        const v = hv[nj * nx + ni] + (rnd() - 0.5) * 0.012
        if (v < best) { best = v; bi = ni; bj = nj }
      }
      if (bi === i && bj === j) break
      i = bi; j = bj
      pts.push(node(i, j))
      if (!ins[j * nx + i]) break
    }
    if (pts.length < 6) continue
    const line = (off: number) => pts.map((p, n) => {
      const a = pts[Math.max(0, n - 1)], b = pts[Math.min(pts.length - 1, n + 1)]
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
      return [p[0] - (dy / l) * off, p[1] + (dx / l) * off] as P
    })
    const path = (pp: P[]) => {
      let d = `M${f(pp[0][0])},${f(pp[0][1])}`
      for (let n = 1; n < pp.length - 1; n++) { const e: P = [(pp[n][0] + pp[n + 1][0]) / 2, (pp[n][1] + pp[n + 1][1]) / 2]; d += `Q${f(pp[n][0])},${f(pp[n][1])} ${f(e[0])},${f(e[1])}` }
      return d
    }
    rivers.push({ bank: `${path(line(1.7))}${path(line(-1.7))}`, water: path(line(0)) })
  }
  // mountains
  let outline = '', hatch = ''
  for (const q of peaks) {
    const group: [number, number, number][] = [[q.p[0], q.p[1] + 10, 18 + q.a * 16], [q.p[0] - 24, q.p[1] + 17, 11 + q.a * 7], [q.p[0] + 26, q.p[1] + 18, 10 + q.a * 6]]
    for (const [x, y, s] of group) {
      const m = peak(x, y, s, rnd)
      outline += m.outline + m.base
      hatch += m.hatch
    }
  }
  // forests in the foothills, away from sites and crests
  let trees = '', ink = ''
  const taken: P[] = [...sites, ...peaks.map((q) => q.p)]
  const clusters = Math.round(polygonArea(ring) / 2300)
  for (let c = 0, tries = 0; c < clusters && tries < 700; tries++) {
    const p = node(Math.floor(rnd() * nx), Math.floor(rnd() * ny))
    const k = Math.round((p[1] - y0) / g) * nx + Math.round((p[0] - x0) / g)
    if (!ins[k] || dist[k] < 18 || hv[k] < 0.12 || hv[k] > 0.62) continue
    if (taken.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 40)) continue
    taken.push(p)
    c++
    const n = 3 + Math.floor(rnd() * 4)
    for (let t = 0; t < n; t++) {
      const x = p[0] + (rnd() - 0.5) * 30, y = p[1] + (rnd() - 0.5) * 22
      if (!inside([x, y], ring)) continue
      trees += (rnd() < 0.78 ? conifer : leafy)(x, y, 0.85 + rnd() * 0.45)
    }
  }
  const [glyph, want] = landmark[family] ?? landmark.analytic
  for (let m = 0, tries = 0; m < want && tries < 600; tries++) {
    const p = node(Math.floor(rnd() * nx), Math.floor(rnd() * ny))
    const k = Math.round((p[1] - y0) / g) * nx + Math.round((p[0] - x0) / g)
    if (!ins[k] || dist[k] < 24 || hv[k] > 0.7) continue
    if (taken.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 46)) continue
    taken.push(p)
    ink += glyph(p[0], p[1], 0.95 + rnd() * 0.35)
    m++
  }
  const r0 = Math.sqrt(polygonArea(ring) / Math.PI)
  const ripples = [1 + 9 / r0, 1 + 20 / r0].map((k) => ring.map(([x, y]): P => [centre[0] + (x - centre[0]) * k, centre[1] + (y - centre[1]) * k]))
  return { minor: minor.join(''), major: major.join(''), rivers, mountains: outline, hatch, trees, ink, sage: '', ripples }
}
