import { MapPin } from 'lucide-react'
import { MathText } from './MathText'

export type Reference = { label: string; url: string; sourceId: string; sourceLabel: string; sourceType: string; locator?: string }
export type SourceRecord = { id: string; label: string; description: string; references: Reference[] }
export type Route = { id: string; title: string; proofSketch: string; sketchStatus: 'source-extracted' | 'assistant-reconstruction' | 'reference-located' | 'not-extracted'; references: Reference[]; proofImages?: { src: string; caption?: string }[] }
export type Entry = { id: number; name: string; statement: string; description: string; routes: Route[]; level: string; areas: string[]; sourceIds: string[] }
export type Catalog = { entryCount: number; approachRecordCount: number; entries: Entry[]; sources: Record<string, SourceRecord> }

const displayTitles: Record<number, string> = {
  2: String.raw`Irrationality of \(\sqrt{2}\)`,
  5: String.raw`Sum of first \(n\) integers: \(1+\cdots+n=\frac{n(n+1)}{2}\)`,
  6: String.raw`Sum of first \(n\) odd integers is \(n^2\)`,
  7: 'Binomial theorem',
  8: String.raw`Arithmetic mean \(\ge\) geometric mean (finite positive case)`,
  13: String.raw`Euclid's lemma: prime \(p\) dividing \(ab\) divides \(a\) or \(b\)`,
  17: String.raw`Euclidean algorithm terminates and computes \(\gcd(a,b)\)`,
  20: String.raw`Infinitude of rational numbers in every real interval (density of \(\mathbb{Q}\))`,
  21: String.raw`Irrationality of \(\sqrt{p}\) for prime \(p\)`,
  24: String.raw`Euler's polyhedron formula \(V-E+F=2\) (convex polyhedra/planar graphs)`,
  25: String.raw`There are irrational numbers / \(\mathbb{R}\) is uncountable`,
  30: String.raw`Bolzano–Weierstrass theorem in \(\mathbb{R}^n\)`,
  31: String.raw`Heine–Borel theorem in \(\mathbb{R}^n\)`,
  36: String.raw`Basel sum \(\sum_{n=1}^{\infty}\frac1{n^2}=\frac{\pi^2}{6}\)`,
  37: String.raw`Euler identity \(e^{i\pi}+1=0\) / Euler formula`,
  42: String.raw`Dimension formula \(\dim(U+W)+\dim(U\cap W)=\dim U+\dim W\)`,
  48: String.raw`Fermat's two-square theorem (prime \(p\equiv1\pmod 4\))`,
  55: String.raw`Cayley's formula: \(n^{n-2}\) labeled trees`,
  99: String.raw`Stirling's formula \(n!\sim\sqrt{2\pi n}(n/e)^n\)`,
  106: String.raw`Cyclotomic polynomial \(\Phi_n(x)\) is irreducible over \(\mathbb{Q}\)`,
  107: String.raw`Catalan number formula \(C_n=\frac{1}{n+1}\binom{2n}{n}\)`,
  112: String.raw`Wallis product for \(\pi\)`,
  120: String.raw`Minkowski inequality for \(L^p\) norms`,
  129: String.raw`Carathéodory's theorem for convex hulls in \(\mathbb{R}^d\)`,
}

export function displayTitle(entry: Entry) { return displayTitles[entry.id] ?? entry.name }
const displayRouteTitles: Record<string, string> = {
  '5-r3': String.raw`count pairs \((i,j)\) with \(i\le j\)`,
  '6-r2': String.raw`induction using \((n+1)^2-n^2=2n+1\)`,
  '9-r1': String.raw`Minimize the nonnegative quadratic \(\|x-ty\|^2\)`,
  '59-r1': String.raw`Minimal-counterexample vertex of degree \(\le 5\) plus recoloring`,
}
export function displayRouteTitle(route: Route) { return displayRouteTitles[route.id] ?? route.title }

const explicitMathDelimiter = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$])+?(?<!\\)\$)/g
const superscriptMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁿ': 'n', 'ⁱ': 'i', '⁺': '+', '⁻': '-', '⁽': '(', '⁾': ')', '′': String.raw`\prime`, '″': String.raw`\prime\prime`, 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z' }
const subscriptMap: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ᵢ': 'i', 'ⱼ': 'j', 'ₙ': 'n', 'ₖ': 'k', 'ₘ': 'm', 'ₚ': 'p', 'ₛ': 's', 'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ₗ': 'l', 'ₒ': 'o', 'ᵣ': 'r', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x' }
const greekMap: Record<string, string> = { 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\epsilon', 'ϵ': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'φ': '\\phi', 'ϕ': '\\varphi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega', 'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\prod', 'Σ': '\\sum', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega' }
const mathSymbolMap: Record<string, string> = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '√': '\\sqrt', '∞': '\\infty', '≤': '\\le', '≥': '\\ge', '≠': '\\ne', '≈': '\\approx', '≡': '\\equiv', '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup', '∩': '\\cap', '→': '\\to', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow', '∂': '\\partial', '∇': '\\nabla', '×': '\\times', '·': '\\cdot', '−': '-', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℝ': '\\mathbb{R}', 'ℂ': '\\mathbb{C}', '𝔽': '\\mathbb{F}' }

export function convertUnicodeMath(value: string) {
  return value
    .replace(/‖([^‖]+)‖/g, String.raw`\lVert $1\rVert`)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁺⁻⁽⁾′″ᵃᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]+/g, (part) => `^{${[...part].map((char) => superscriptMap[char]).join('')}}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉ᵢⱼₙₖₘₚₛₐₑₕₗₒᵣₜᵤᵥₓ]+/g, (part) => `_{${[...part].map((char) => subscriptMap[char]).join('')}}`)
    .replace(/[αβγδεϵζηθικλμνξπρστυφϕχψωΓΔΘΛΞΠΣΦΨΩ∑∏∫√∞≤≥≠≈≡∈∉⊂⊆∪∩→↔⇒⇔∂∇×·−ℕℤℚℝℂ𝔽]/g, (char) => {
      const command = greekMap[char] ?? mathSymbolMap[char] ?? char
      return /^\\[A-Za-z]+$/.test(command) ? `${command} ` : command
    })
}

export function mathCue(value: string) {
  return /^\(?[\p{L}\p{N}]{1,2}\)?\/\(?[\p{L}\p{N}]{1,2}\)?$/u.test(value)
    || /^[\p{L}\p{N}]{1,3}-[\p{L}\p{N}]{1,3}$/u.test(value)
    || /[=+*^_<>≤≥≠≈≡∈∉→↔⇒⇔∑Σ∏Π∫√∞∂∇×·−′″⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱᵃᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ₀₁₂₃₄₅₆₇₈₉ᵢⱼₙₖₘₚₛₐₑₕₗₒᵣₜᵤᵥₓα-ωΑ-Ωℕℤℚℝℂ𝔽‖]/u.test(value)
    || /\b(?:[A-Za-z]{1,6}|C)\([^()]+\)/.test(value)
}

export function mathOperand(value: string) {
  const core = value.replace(/[.,;:!?]+$/, '')
  return core.length > 0 && core.length <= 24 && /^[\p{L}\p{N}_{}()[\],.^+*/|\\-]+$/u.test(core)
}

export function renderMathRun(value: string) {
  const punctuation = value.match(/[.,;:!?]+$/)?.[0] ?? ''
  const core = punctuation ? value.slice(0, -punctuation.length) : value
  let math = convertUnicodeMath(core)
    .replace(/<->/g, String.raw`\leftrightarrow`)
    .replace(/->/g, String.raw`\to`)
    .replace(/=>/g, String.raw`\Rightarrow`)
    .replace(/!=/g, String.raw`\ne`)
    .replace(/<=/g, String.raw`\le`)
    .replace(/>=/g, String.raw`\ge`)
    .replace(/\bC\(([^,()]+),\s*([^()]+)\)/g, String.raw`\binom{$1}{$2}`)
    .replace(/(?<!\\)\b(log|ln|sin|cos|tan|exp|det|tr|gcd|lcm|dim|rank|ker|im)\b/g, String.raw`\$1`)
  if (/^\\(?:sum|prod|int)$/.test(math)) math = `${math} `
  return String.raw`\(${math}\)` + punctuation
}

export function autoFormatPlainMath(value: string) {
  const pieces = value.split(/(\s+)/)
  const tokenIndices = pieces.map((piece, index) => piece && !/^\s+$/.test(piece) ? index : -1).filter((index) => index >= 0)
  const ranges: { start: number; end: number }[] = []

  for (let position = 1; position < tokenIndices.length - 1; position += 1) {
    const index = tokenIndices[position]
    const token = pieces[index].replace(/[.,;:!?]+$/, '')
    if (!/^(?:[=+*/<>≤≥≠≈≡∈∉→↔⇒⇔−-])+$/.test(token)) continue
    let startPosition = position - 1
    let endPosition = position + 1
    if (!mathOperand(pieces[tokenIndices[startPosition]]) || !mathOperand(pieces[tokenIndices[endPosition]])) continue
    while (startPosition >= 2 && /^(?:[=+*/<>≤≥≠≈≡∈∉→↔⇒⇔−-])+$/.test(pieces[tokenIndices[startPosition - 1]].replace(/[.,;:!?]+$/, '')) && mathOperand(pieces[tokenIndices[startPosition - 2]])) startPosition -= 2
    while (endPosition + 2 < tokenIndices.length && /^(?:[=+*/<>≤≥≠≈≡∈∉→↔⇒⇔−-])+$/.test(pieces[tokenIndices[endPosition + 1]].replace(/[.,;:!?]+$/, '')) && mathOperand(pieces[tokenIndices[endPosition + 2]])) endPosition += 2
    ranges.push({ start: tokenIndices[startPosition], end: tokenIndices[endPosition] })
  }

  for (const index of tokenIndices) {
    if (mathCue(pieces[index])) ranges.push({ start: index, end: index })
  }
  ranges.sort((left, right) => left.start - right.start || left.end - right.end)
  const merged: { start: number; end: number }[] = []
  for (const range of ranges) {
    const previous = merged.at(-1)
    if (previous && range.start <= previous.end + 2) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }

  let cursor = 0
  let output = ''
  for (const range of merged) {
    output += pieces.slice(cursor, range.start).join('')
    const source = pieces.slice(range.start, range.end + 1).join('')
    output += renderMathRun(source)
    cursor = range.end + 1
  }
  return output + pieces.slice(cursor).join('')
}

export function formatProofMath(value: string) {
  return value.split(explicitMathDelimiter).map((part) => part.startsWith(String.raw`\(`) || part.startsWith(String.raw`\[`) || part.startsWith('$$') || (part.startsWith('$') && part.endsWith('$')) ? part : autoFormatPlainMath(part)).join('')
}

export function ProofMathText({ text }: { text: string }) { return <MathText text={formatProofMath(text)} /> }

export function SourceCitation({ reference, prefix = 'Source:' }: { reference: Reference; prefix?: string }) {
  return <div className="historical-route-source">
    <span>{prefix} <a href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></span>
    {reference.locator && <details className="historical-source-info">
      <summary aria-label={`Show source location for ${reference.label}`} title="Show source location"><MapPin size={12} strokeWidth={1.6} aria-hidden="true" /></summary>
      <div className="historical-source-popover"><strong>Location</strong><p>{reference.locator}</p></div>
    </details>}
  </div>
}

export function RelatedSourceLinks({ sourceIds, sources }: { sourceIds: string[]; sources: Record<string, SourceRecord> }) {
  const reference = sourceIds.flatMap((sourceId) => sources[sourceId]?.references ?? [])[0]
  if (!reference) return null
  return <SourceCitation reference={reference} prefix="Related source:" />
}

export function primaryReference(route: Route) {
  return route.references.at(-1)
}

export function ProofExcerpt({ route }: { route: Route }) {
  const images = route.proofImages ?? []
  const fromSource = route.sketchStatus === 'source-extracted'
  return <>
    {route.proofSketch && <div className="historical-sketch"><strong>{fromSource ? 'Proof sketch (from reading the cited proof):' : 'Proof sketch (reconstruction, not taken from a source):'}</strong> <ProofMathText text={route.proofSketch} /></div>}
    {images.length > 0 && <details className="historical-excerpt">
      <summary>View source page excerpt{images.length === 1 ? '' : 's'}</summary>
      {images.map((image) => <figure key={image.src}><img src={`${import.meta.env.BASE_URL}${image.src}`} alt={image.caption ?? `Excerpt of the proof for ${route.title}`} loading="lazy" style={{ maxWidth: '100%', height: 'auto', background: '#fff' }} />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}
    </details>}
  </>
}
