import { fixed } from './methodShared'
import type { MethodData, MethodModel } from './methodShared'
import { terrain } from './worldTerrain'
import { disc, hull, polyline, quad, seeded, smooth, waypoints, within } from './worldShared'
import type { P } from './worldShared'

/**
 * Everything about the map that depends only on the data: islands with their terrain, the bridges
 * between them, the chords, the sub-domain names and the frame the whole thing fits in.
 */
export function buildWorld(data: MethodData, model: MethodModel, W: number, H: number) {
    const sites = data.ring.techniques.map((id) => {
      const [x, y] = data.world.sites[id]
      return { id, x, y, family: model.names.get(id)!.family, short: model.names.get(id)!.short, use: model.uses.get(id) ?? 0 }
    })
    const siteHeight = new Map<string, number>()
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
      mine.forEach((s, n) => siteHeight.set(s.id, land.siteH[n]))
      return { family, cx: boxed.x, cy: boxed.y, r: boxed.r, top: Math.min(...ring.map((p) => p[1])), bottom: Math.max(...ring.map((p) => p[1])), path: smooth(ring), halo: smooth(land.ripples[1]), near: smooth(land.ripples[0]), ring, ox: cx, oy: cy, land, flood: land.flood, below: false, treeD: land.trees.map((t) => t.d).join(''), treeH: land.trees.map((t) => t.hatch).join('') }
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
    return { sites, islands, groups, bridges, chords, radius, markFont, siteHeight, wisps, bounds: { x0, y0, w: x1 - x0, h: y1 - y0 } }
}

export type World = ReturnType<typeof buildWorld>
