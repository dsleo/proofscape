import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, MapPin, Search } from 'lucide-react'
import { MathText } from './MathText'

type Reference = { label: string; url: string; sourceId: string; sourceLabel: string; sourceType: string; locator?: string }
type SourceRecord = { id: string; label: string; description: string; references: Reference[] }
type Route = { id: string; title: string; proofSketch: string; sketchStatus: 'source-extracted' | 'assistant-reconstruction' | 'reference-located' | 'not-extracted'; references: Reference[]; proofImages?: { src: string; caption?: string }[] }
type Entry = { id: number; name: string; statement: string; description: string; routes: Route[]; level: string; areas: string[]; sourceIds: string[] }
type Catalog = { entryCount: number; approachRecordCount: number; entries: Entry[]; sources: Record<string, SourceRecord> }

const catalogUrl = `${import.meta.env.BASE_URL}data/collection/historical-proof-catalog.json`
const fieldOptions = ['Algebra', 'Analysis', 'Combinatorics', 'Geometry', 'Logic & foundations', 'Number theory', 'Probability', 'Topology']
const levelOptions = ['School', 'Undergraduate', 'Graduate']
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

function displayTitle(entry: Entry) { return displayTitles[entry.id] ?? entry.name }
const displayRouteTitles: Record<string, string> = {
  '5-r3': String.raw`count pairs \((i,j)\) with \(i\le j\)`,
  '6-r2': String.raw`induction using \((n+1)^2-n^2=2n+1\)`,
  '9-r1': String.raw`Minimize the nonnegative quadratic \(\|x-ty\|^2\)`,
  '59-r1': String.raw`Minimal-counterexample vertex of degree \(\le 5\) plus recoloring`,
}
function displayRouteTitle(route: Route) { return displayRouteTitles[route.id] ?? route.title }

const explicitMathDelimiter = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$])+?(?<!\\)\$)/g
const superscriptMap: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁿ': 'n', 'ⁱ': 'i', '⁺': '+', '⁻': '-', '⁽': '(', '⁾': ')', '′': String.raw`\prime`, '″': String.raw`\prime\prime`, 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z' }
const subscriptMap: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ᵢ': 'i', 'ⱼ': 'j', 'ₙ': 'n', 'ₖ': 'k', 'ₘ': 'm', 'ₚ': 'p', 'ₛ': 's', 'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ₗ': 'l', 'ₒ': 'o', 'ᵣ': 'r', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x' }
const greekMap: Record<string, string> = { 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\epsilon', 'ϵ': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'φ': '\\phi', 'ϕ': '\\varphi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega', 'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\prod', 'Σ': '\\sum', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega' }
const mathSymbolMap: Record<string, string> = { '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '√': '\\sqrt', '∞': '\\infty', '≤': '\\le', '≥': '\\ge', '≠': '\\ne', '≈': '\\approx', '≡': '\\equiv', '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup', '∩': '\\cap', '→': '\\to', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow', '∂': '\\partial', '∇': '\\nabla', '×': '\\times', '·': '\\cdot', '−': '-', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℝ': '\\mathbb{R}', 'ℂ': '\\mathbb{C}', '𝔽': '\\mathbb{F}' }

function convertUnicodeMath(value: string) {
  return value
    .replace(/‖([^‖]+)‖/g, String.raw`\lVert $1\rVert`)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁺⁻⁽⁾′″ᵃᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]+/g, (part) => `^{${[...part].map((char) => superscriptMap[char]).join('')}}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉ᵢⱼₙₖₘₚₛₐₑₕₗₒᵣₜᵤᵥₓ]+/g, (part) => `_{${[...part].map((char) => subscriptMap[char]).join('')}}`)
    .replace(/[αβγδεϵζηθικλμνξπρστυφϕχψωΓΔΘΛΞΠΣΦΨΩ∑∏∫√∞≤≥≠≈≡∈∉⊂⊆∪∩→↔⇒⇔∂∇×·−ℕℤℚℝℂ𝔽]/g, (char) => {
      const command = greekMap[char] ?? mathSymbolMap[char] ?? char
      return /^\\[A-Za-z]+$/.test(command) ? `${command} ` : command
    })
}

function mathCue(value: string) {
  return /^\(?[\p{L}\p{N}]{1,2}\)?\/\(?[\p{L}\p{N}]{1,2}\)?$/u.test(value)
    || /^[\p{L}\p{N}]{1,3}-[\p{L}\p{N}]{1,3}$/u.test(value)
    || /[=+*^_<>≤≥≠≈≡∈∉→↔⇒⇔∑Σ∏Π∫√∞∂∇×·−′″⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱᵃᵇᶜᵈᵉᶠᵍʰʲᵏˡᵐᵒᵖʳˢᵗᵘᵛʷˣʸᶻ₀₁₂₃₄₅₆₇₈₉ᵢⱼₙₖₘₚₛₐₑₕₗₒᵣₜᵤᵥₓα-ωΑ-Ωℕℤℚℝℂ𝔽‖]/u.test(value)
    || /\b(?:[A-Za-z]{1,6}|C)\([^()]+\)/.test(value)
}

function mathOperand(value: string) {
  const core = value.replace(/[.,;:!?]+$/, '')
  return core.length > 0 && core.length <= 24 && /^[\p{L}\p{N}_{}()[\],.^+*/|\\-]+$/u.test(core)
}

function renderMathRun(value: string) {
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

function autoFormatPlainMath(value: string) {
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

function formatProofMath(value: string) {
  return value.split(explicitMathDelimiter).map((part) => part.startsWith(String.raw`\(`) || part.startsWith(String.raw`\[`) || part.startsWith('$$') || (part.startsWith('$') && part.endsWith('$')) ? part : autoFormatPlainMath(part)).join('')
}

function ProofMathText({ text }: { text: string }) { return <MathText text={formatProofMath(text)} /> }

function levelMatches(entry: Entry, selected: string) {
  const text = entry.level.toLowerCase()
  if (!selected) return true
  return selected === 'School' ? text.includes('school') : selected === 'Undergraduate' ? text.includes('undergraduate') : text.includes('graduate')
}

function SourceCitation({ reference, prefix = 'Source:' }: { reference: Reference; prefix?: string }) {
  return <div className="historical-route-source">
    <span>{prefix} <a href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></span>
    {reference.locator && <details className="historical-source-info">
      <summary aria-label={`Show source location for ${reference.label}`} title="Show source location"><MapPin size={12} strokeWidth={1.6} aria-hidden="true" /></summary>
      <div className="historical-source-popover"><strong>Location</strong><p>{reference.locator}</p></div>
    </details>}
  </div>
}

function RelatedSourceLinks({ sourceIds, sources }: { sourceIds: string[]; sources: Record<string, SourceRecord> }) {
  const reference = sourceIds.flatMap((sourceId) => sources[sourceId]?.references ?? [])[0]
  if (!reference) return null
  return <SourceCitation reference={reference} prefix="Related source:" />
}

function primaryReference(route: Route) {
  return route.references.at(-1)
}

function ProofExcerpt({ route }: { route: Route }) {
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

export default function HistoricalResults() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [field, setField] = useState('')
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    document.title = 'Historical results — Proofscape'
    fetch(catalogUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Historical catalog request failed (${response.status}).`)
      return response.json() as Promise<Catalog>
    }).then(setCatalog).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'The historical catalog could not be loaded.'))
  }, [])

  const filtered = useMemo(() => {
    if (!catalog) return []
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return catalog.entries.filter((entry) => {
      if (field && !entry.areas.includes(field)) return false
      if (!levelMatches(entry, level)) return false
      const routeText = entry.routes.map((route) => `${route.title} ${route.proofSketch} ${route.references.map((reference) => `${reference.label} ${reference.sourceLabel} ${reference.locator ?? ''}`).join(' ')}`).join(' ')
      const text = `${entry.name} ${entry.statement} ${entry.level} ${entry.areas.join(' ')} ${routeText}`.toLocaleLowerCase()
      return terms.every((term) => text.includes(term))
    })
  }, [catalog, field, level, query])

  useEffect(() => { setPage(1) }, [query, field, level])

  function clearFilters() { setQuery(''); setField(''); setLevel('') }

  return <section className="historical-view" id="collection-results" role="tabpanel" aria-labelledby="historical-tab" aria-label="Historical results with multiple proof approaches">
    <header className="historical-intro">
      <p className="historical-eyebrow">CURATED RESEARCH INDEX · {catalog?.entryCount ?? '—'} RESULTS · {catalog?.approachRecordCount ?? '—'} APPROACHES</p>
      <h1>Course-level results, different ways in.</h1>
      <p>This catalog collects central results taught from secondary school through graduate courses and records distinct proof approaches. It excludes contest problems and isolated exercises.</p>
    </header>

    <div className="historical-controls" aria-label="Search and filter historical results">
      <label className="historical-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search theorem, field, approach, or source</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a result, approach, or source…" /></label>
      <label><span>Field</span><select value={field} onChange={(event) => setField(event.target.value)}><option value="">All fields</option>{fieldOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
      <label><span>Course level</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">All levels</option>{levelOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    </div>

    {(query || field || level) && <div className="historical-count" aria-live="polite"><span>{filtered.length} matching results</span><button type="button" onClick={clearFilters}>Clear filters</button></div>}

    {error ? <div className="collection-offline" role="alert">The historical results are unavailable. {error}</div> : <div className="historical-list">
      {filtered.slice(page - 1, page).map((entry) => <article className="historical-entry" key={entry.id}>
        <div className="historical-entry-number">{String(entry.id).padStart(3, '0')}</div>
        <div className="historical-entry-main">
          <header><h2><MathText text={displayTitle(entry)} /></h2></header>
          <div className="historical-statement"><span className="historical-statement-label">Statement</span><MathText text={entry.statement} /></div>
          <details className="historical-approaches">
            <summary>Proof approaches ({entry.routes.length})</summary>
            <ol className="historical-routes">{entry.routes.map((route) => <li key={route.id}>
              <details className="historical-approach">
                <summary><ProofMathText text={displayRouteTitle(route)} /></summary>
                <div className="historical-approach-content">
                  <ProofExcerpt route={route} />
                  {primaryReference(route) ? <SourceCitation reference={primaryReference(route)!} /> : <RelatedSourceLinks sourceIds={entry.sourceIds} sources={catalog?.sources ?? {}} />}
                </div>
              </details>
            </li>)}</ol>
          </details>
        </div>
      </article>)}
      {catalog && filtered.length === 0 && <div className="collection-empty">No results match these filters. Try a broader search.</div>}
    </div>}

    {catalog && filtered.length > 0 && <nav className="historical-pagination" aria-label="Historical results pagination"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>← Previous</button><span>{page} / {filtered.length}</span><button type="button" onClick={() => setPage((current) => Math.min(filtered.length, current + 1))} disabled={page >= filtered.length}>Next →</button></nav>}
    {catalog && <details className="historical-source-register"><summary>Full source register <span>{Object.keys(catalog.sources).length} catalog-wide records</span></summary>
      <p>The full source register is the bibliography for the whole index: theorem sources, books and papers, plus discovery leads such as community discussions and datasets. Not every register item supports a specific approach; direct route citations appear with that approach above.</p>
      {Object.values(catalog.sources).map((source) => <section key={source.id}>
        <h3>{source.id} · {source.label}</h3><p>{source.description}</p>
        {source.references.map((reference) => <article className="historical-reference" key={reference.url}>
          <a href={reference.url} target="_blank" rel="noreferrer">{reference.label} <ExternalLink size={12} aria-hidden="true" /></a>
          {reference.locator && <p className="historical-locator">{reference.locator}</p>}
        </article>)}
      </section>)}
    </details>}
    <p className="historical-sources-note">Approach citations and proof sketches are kept together so each route can be checked against its own source. The source register remains a catalog-wide bibliography and discovery trail.</p>
  </section>
}
