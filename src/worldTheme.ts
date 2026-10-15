export type Hue = { land: string; halo: string; light: string; dark: string; peak: string }
export type Theme = {
  id: string; name: string; sea: string; paper: string; ink: string; accent: string; trail: string; water: string; wisp: string
  hue: (family: string) => Hue
  tree: (h: Hue) => string; hatchInk: (h: Hue) => string
  clouds: boolean; ripples: boolean; shade: number; treeFill: number; coast: number; label: { fill: string; halo: (h: Hue) => string }; grain: number
}
// Ink: the pencil-and-wash cream of the app's landscape illustration, one colour for every island.
const inkWash: Record<string, string> = { analytic: '#f0f4e6', algebraic: '#f7ece4', geometric: '#f2f1e2', discrete: '#f7f2d9', logic: '#f6eedb' }
const ink: Hue = { land: '#faf7ee', halo: '#ebe6d8', light: '#c4ccbb', dark: '#4a5446', peak: '#f4f1e5' }
export const themes: Theme[] = [
  { id: 'ink', name: 'Ink', sea: '#f2efe7', paper: '#fbf8f0', ink: '#3b4438', accent: '#ae6b1f', trail: '#8a5a2b', water: '#bdd0d4', wisp: '#dcd6c6', hue: (f) => ({ ...ink, land: inkWash[f] ?? ink.land }), tree: () => '#f9f6ec', hatchInk: (h) => h.dark, clouds: false, ripples: true, shade: 0.1, treeFill: 0, coast: 1.5, label: { fill: '#2d352b', halo: () => '#f2efe7' }, grain: 0.07 },
]
