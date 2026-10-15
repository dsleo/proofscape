import { familyName } from './methodShared'
import type { Anchor } from './worldShared'
import type { World } from './worldLayout'

/** Zoom levels at which method names are placed afresh, with the type size that level will really show. */
export const TIERS = [1, 1.5, 2.2, 3.3, 4.5, 6]

/** A few methods per island are named at rest ("anchors"); the rest are named on hover, selection or deep zoom. */
export const anchorsFor = (zoom: number) => (zoom >= 5.5 ? 99 : zoom >= 1.5 ? 3 : 1)

/**
 * Pick a spot for every method's name at zoom `tk`: beside its mark, clear of every mark, sub-domain
 * title and island ribbon. Anchors are placed first, so they win the best spots.
 */
export function placeLabels(world: World, fit: number, tk: number, anchorRank: Map<string, number>, W: number) {
  const font = Math.min(25, 16.5 / (fit * tk))
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
}
