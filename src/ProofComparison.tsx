import { useId, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { MathText } from './MathText'
import { dataUrl } from './collection'
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
    // Lean often applies an implication with `.mp` or `.mpr`, or reverses it with `.symm`.
    const base = word.replace(/\.(?:mp|mpr|symm)$/, '')
    const direct = dependencies.get(word)
    const dependency = direct ?? (base !== word ? dependencies.get(base) : undefined)
    const label = direct ? word : base
    if (dependency && sourceKey(dependency.declaration) !== current) {
      nodes.push(<button key={`${position}-${word}`} className="proof-code-reference" type="button"
        title={`Open ${dependency.declaration.symbol} in this proof`} onClick={() => onNavigate(dependency)}>{label}</button>)
      nodes.push(word.slice(label.length))
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
  const [supportOpen, setSupportOpen] = useState(false)
  const [selectedSource, setSelectedSource] = useState('')
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
      const namespace = declaration.path.startsWith('Mathlib/Data/Rat/') ? 'Rat'
        : declaration.path.startsWith('Mathlib/Algebra/Ring/Int/') ? 'Int'
        : declaration.path.startsWith('Mathlib/LinearAlgebra/Matrix/') ? 'Matrix'
        : declaration.path.includes('/Symmetric/NewtonIdentities.lean') ? 'NewtonIdentities'
        : ''
      if (namespace && !declaration.symbol.includes('.')) add(`${namespace}.${declaration.symbol}`, dependency)
    }
    return new Map([...candidates].filter((entry): entry is [string, Dependency] => entry[1] !== null))
  }, [sources, anchors])

  function navigate(dependency: Dependency) {
    setSupportOpen(true)
    setSelectedSource(sourceKey(dependency.declaration))
    window.requestAnimationFrame(() => {
      const element = document.getElementById(dependency.anchor)
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      element?.focus({ preventScroll: true })
    })
  }

  function declarationView(declaration: MathlibDeclaration) {
    const key = sourceKey(declaration)
    return <Declaration key={key} declaration={declaration} anchor={anchors.get(key)!} selected={selectedSource === key}
      dependencies={dependencies} onNavigate={navigate} />
  }

  const attributions = [...new Map(sources.map((item) => [item.path, item.attribution])).entries()]
  return <div className="proof-comparison" aria-label="Mathlib and alternative proof comparison">
    {showStatement && <div className="proof-comparison-statement"><span>Statement in this comparison</span><MathText text={comparison.statement} /></div>}
    {comparison.scope && <p className="proof-comparison-scope">{comparison.scope}</p>}
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route A</span><h3>Informal proof</h3><Paragraphs text={comparison.proofA} /></section>
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route B</span><h3>Informal proof</h3><Paragraphs text={comparison.proofB} /></section>
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route A</span><h3>Mathlib proof</h3>
      <p className="proof-comparison-help">These are the Mathlib declarations that carry the argument. Select an underlined name in the code to open its definition below. The excerpts use Mathlib’s surrounding definitions and earlier lemmas.</p>
      {comparison.mathlibCore.map(declarationView)}
      {comparison.mathlibSupporting.length > 0 && <details className="proof-comparison-support" open={supportOpen} onToggle={(event) => setSupportOpen(event.currentTarget.open)}>
        <summary>{comparison.mathlibSupporting.length} further supporting declarations</summary>{comparison.mathlibSupporting.map(declarationView)}
      </details>}
      <details className="proof-comparison-attributions"><summary>Source authors and license notices</summary>
        {attributions.map(([path, attribution]) => <p key={path}><strong>{path}</strong><br />{attribution}</p>)}
        <a href={dataUrl('MATHLIB-LICENSE.txt')} target="_blank" rel="noreferrer">Mathlib license <ExternalLink size={12} aria-hidden="true" /></a>
      </details>
    </section>
    <section className="proof-comparison-section"><span className="proof-comparison-kicker">Route B</span><h3>Formal proof sketch</h3>
      <p className="proof-comparison-help">Lean-style pseudocode, not a compiled proof. <code>sorry</code> marks a remaining proof obligation; names and notation are illustrative.</p>
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
