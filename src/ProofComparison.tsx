import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, X } from 'lucide-react'
import { MathText } from './MathText'
import type { MathlibDeclaration, ProofComparison as Comparison } from './proofComparisonTypes'
import './proof-comparison.css'

const sourceKey = (declaration: MathlibDeclaration) => `${declaration.path}:${declaration.line}`

function Paragraphs({ text }: { text: string }) {
  return <div className="proof-comparison-prose">{text.split(/\n\s*\n/).map((paragraph, index) =>
    <p key={index}><MathText text={paragraph} /></p>)}</div>
}

type Dependency = { declaration: MathlibDeclaration; anchor: string }
const tokenPattern = /[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*/g

/** Code is rendered as text and buttons, never as interpreted HTML. */
function LinkedCode({ code, current, dependencies, onNavigate }: {
  code: string; current: string; dependencies: Map<string, Dependency>; onNavigate: (dependency: Dependency) => void
}) {
  const nodes: React.ReactNode[] = []
  let cursor = 0
  for (const match of code.matchAll(tokenPattern)) {
    const position = match.index
    nodes.push(code.slice(cursor, position))
    const word = match[0]
    // Lean's dot notation may prefix a lemma with a local receiver or append `.mpr`.
    const base = word.replace(/\.(?:mp|mpr|symm)$/, '')
    let start = 0
    let dependency = dependencies.get(word) ?? (base !== word ? dependencies.get(base) : undefined)
    if (!dependency && (/^[a-z_]/.test(base) || base === 'Nat.prime_two.irrational_sqrt')) {
      const pieces = base.split('.')
      for (let i = 1; i < pieces.length && !dependency; i += 1) {
        const suffix = pieces.slice(i).join('.')
        const candidate = dependencies.get(suffix)
        if (candidate) { dependency = candidate; start = base.length - suffix.length }
      }
    }
    const end = dependencies.has(word) ? word.length : base.length
    if (dependency && sourceKey(dependency.declaration) !== current) {
      nodes.push(word.slice(0, start))
      const target = dependency
      nodes.push(<button key={`${position}-${word}`} className="proof-code-reference" type="button"
        title={`Open ${target.declaration.symbol} in this proof`} onClick={() => onNavigate(target)}>{word.slice(start, end)}</button>)
      nodes.push(word.slice(end))
    } else nodes.push(word)
    cursor = position + word.length
  }
  nodes.push(code.slice(cursor))
  return <pre className="proof-comparison-code"><code>{nodes}</code></pre>
}

function Declaration({ declaration, anchor, selected, dependencies, onNavigate }: {
  declaration: MathlibDeclaration; anchor: string; selected: boolean
  dependencies: Map<string, Dependency>; onNavigate: (dependency: Dependency) => void
}) {
  return <section id={anchor} tabIndex={-1} className={`proof-declaration${selected ? ' is-target' : ''}`}>
    <div className="proof-declaration-heading"><strong>{declaration.symbol}</strong>
      <a href={declaration.url} target="_blank" rel="noreferrer">Mathlib source <ExternalLink size={12} aria-hidden="true" /></a></div>
    <p className="proof-declaration-role">{declaration.role}</p>
    <LinkedCode code={declaration.code} current={sourceKey(declaration)} dependencies={dependencies} onNavigate={onNavigate} />
  </section>
}

export default function ProofComparison({ comparison, showStatement = false }: { comparison: Comparison; showStatement?: boolean }) {
  const componentId = useId().replace(/:/g, '')
  const [history, setHistory] = useState<Dependency[]>([])
  const selected = history.at(-1)
  const sources = useMemo(() => [...comparison.mathlibCore, ...comparison.mathlibSupporting], [comparison])
  const anchors = useMemo(() => new Map(sources.map((declaration, index) =>
    [sourceKey(declaration), `proof-source-${componentId}-${index}`])), [sources, componentId])
  const dependencies = useMemo(() => {
    const candidates = new Map<string, Dependency | null>()
    function add(name: string, dependency: Dependency) {
      if (!candidates.has(name)) candidates.set(name, dependency)
      else {
        const existing = candidates.get(name)
        if (existing && sourceKey(existing.declaration) !== sourceKey(dependency.declaration)) candidates.set(name, null)
      }
    }
    for (const declaration of sources) {
      const dependency = { declaration, anchor: anchors.get(sourceKey(declaration))! }
      add(declaration.symbol, dependency)
      add(declaration.symbol.split('.').at(-1)!, dependency)
      // These namespaces are taken from the corresponding source modules.
      const namespace = declaration.path === 'Mathlib/Analysis/Fourier/Inversion.lean' ? 'Real'
        : declaration.path.startsWith('Mathlib/Data/Rat/') ? 'Rat'
        : declaration.path.startsWith('Mathlib/Algebra/Ring/Int/') ? 'Int'
        : declaration.path.startsWith('Mathlib/LinearAlgebra/Matrix/') ? 'Matrix'
        : declaration.path.startsWith('Mathlib/GroupTheory/Coset/') ? 'Subgroup'
        : declaration.path.includes('/Symmetric/NewtonIdentities.lean') ? 'NewtonIdentities'
        : ''
      if (namespace && !declaration.symbol.includes('.')) add(`${namespace}.${declaration.symbol}`, dependency)
    }
    return new Map([...candidates].filter((entry): entry is [string, Dependency] => entry[1] !== null))
  }, [sources, anchors])

  const main = sources.find((declaration) => declaration.symbol === comparison.mathlibMain)!

  useEffect(() => {
    if (!selected) return
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(selected.anchor)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      element?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
      element?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selected])

  function navigate(dependency: Dependency) {
    if (sourceKey(dependency.declaration) === sourceKey(main)) { closeDependency(); return }
    setHistory((current) => [...current, dependency])
  }

  function closeDependency() {
    setHistory([])
    window.requestAnimationFrame(() => document.getElementById(anchors.get(sourceKey(main))!)?.focus({ preventScroll: true }))
  }

  function declarationView(declaration: MathlibDeclaration, selected = false) {
    const key = sourceKey(declaration)
    return <Declaration key={key} declaration={declaration} anchor={anchors.get(key)!} selected={selected}
      dependencies={dependencies} onNavigate={navigate} />
  }

  return <div className="proof-comparison" aria-label="Mathlib and alternative proof comparison">
    {showStatement && <div className="proof-comparison-statement"><span>Statement in this comparison</span><MathText text={comparison.statement} /></div>}
    {comparison.scope && <p className="proof-comparison-scope">{comparison.scope}</p>}
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route A</span><h3>Informal proof</h3><Paragraphs text={comparison.proofA} /></section>
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route A</span><h3>Formal Proof from Mathlib</h3>
      <p className="proof-comparison-help">Select an underlined name to see its Mathlib definition. The proof uses Mathlib’s surrounding definitions and earlier lemmas.</p>
      {declarationView(main)}
      {(() => {
        // Some displayed statements combine separately stated Mathlib theorems.
        const parts: Record<string, { symbol: string; label: string }> = {
          'original-10': { symbol: "fixedPoint_unique'", label: 'Uniqueness of the fixed point' },
          'catalog-60': { symbol: 'tendstoInMeasure_of_tendsto_ae', label: 'Almost-sure convergence implies convergence in measure' },
          'catalog-8': { symbol: 'geom_mean_eq_arith_mean_weighted_iff_of_pos', label: 'Equality case' },
        }
        const part = parts[comparison.id]
        const dependency = part ? dependencies.get(part.symbol) : undefined
        return dependency ? <p className="proof-related-theorem">Also used for this statement: <button type="button" className="proof-code-reference" onClick={() => navigate(dependency)}>{part.label}</button></p> : null
      })()}
      {selected && <div className="proof-dependency" aria-label="Selected Mathlib dependency">
        <div className="proof-dependency-controls">
          <span>Selected dependency</span>
          <div>{history.length > 1 && <button type="button" aria-label="Previous dependency" title="Previous dependency" onClick={() => setHistory((current) => current.slice(0, -1))}><ArrowLeft size={16} aria-hidden="true" /></button>}
            <button type="button" aria-label="Close dependency" title="Close dependency" onClick={closeDependency}><X size={16} aria-hidden="true" /></button></div>
        </div>
        {declarationView(selected.declaration, true)}
      </div>}
    </section>
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route B</span><h3>Informal proof</h3><Paragraphs text={comparison.proofB} /></section>
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route B</span><h3>Formal proof sketch</h3>
      <pre className="proof-comparison-code"><code>{comparison.formalSketch}</code></pre>
    </section>
    <section className="proof-comparison-section"><h3>Difficulty comparison</h3>
      <div className="proof-comparison-evidence"><strong>{comparison.evidenceStatus}</strong><p>{comparison.evidence}</p>
        {comparison.evidenceLinks.length > 0 && <p>{comparison.evidenceLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ExternalLink size={12} aria-hidden="true" /></a>)}</p>}
      </div>
      <p className="proof-comparison-help">A fair test would implement both routes for the same statement and hypotheses, then compare their dependencies and the effort required to complete them.</p>
    </section>
  </div>
}
