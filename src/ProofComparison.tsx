import { useEffect, useId, useMemo, useState } from 'react'
import { ExternalLink, GitBranch } from 'lucide-react'
import { MathText } from './MathText'
import type { MathlibDeclaration, ProofComparison as Comparison } from './proofComparisonTypes'
import './proof-comparison.css'

const sourceKey = (declaration: MathlibDeclaration) => `${declaration.path}:${declaration.line}`
const tokenPattern = /[\p{L}_][\p{L}\p{N}_']*(?:\.[\p{L}_][\p{L}\p{N}_']*)*/gu

type Dependency = { declaration: MathlibDeclaration }

function Paragraphs({ text }: { text: string }) {
  return <div className="proof-comparison-prose">{text.split(/\n\s*\n/).map((paragraph, index) =>
    <p key={index}><MathText text={paragraph} /></p>)}</div>
}

// Resolve names conservatively: ambiguous short names are never linked.
function resolveToken(word: string, dependencies: Map<string, Dependency>) {
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
  return { dependency, start, end: dependencies.has(word) ? word.length : base.length }
}

function referencedDeclarations(declaration: MathlibDeclaration, dependencies: Map<string, Dependency>) {
  const found = new Map<string, Dependency>()
  // Comments describe the proof but do not establish a Lean dependency.
  const code = declaration.code.replace(/\/-[\s\S]*?-\//g, '').replace(/--[^\n]*/g, '')
  for (const match of code.matchAll(tokenPattern)) {
    const { dependency } = resolveToken(match[0], dependencies)
    if (dependency && sourceKey(dependency.declaration) !== sourceKey(declaration)) {
      found.set(sourceKey(dependency.declaration), dependency)
    }
    // Dot notation can contain both a referenced receiver and a referenced lemma.
    const pieces = match[0].split('.')
    for (let i = 1; i < pieces.length; i += 1) {
      const receiver = dependencies.get(pieces.slice(0, i).join('.'))
      if (receiver && sourceKey(receiver.declaration) !== sourceKey(declaration)) {
        found.set(sourceKey(receiver.declaration), receiver)
      }
    }
  }
  return [...found.values()]
}

function LinkedCode({ declaration, dependencies, onNavigate }: {
  declaration: MathlibDeclaration; dependencies: Map<string, Dependency>; onNavigate: (dependency: Dependency) => void
}) {
  const nodes: React.ReactNode[] = []
  let cursor = 0
  for (const match of declaration.code.matchAll(tokenPattern)) {
    const position = match.index
    nodes.push(declaration.code.slice(cursor, position))
    const word = match[0]
    const { dependency, start, end } = resolveToken(word, dependencies)
    if (dependency && sourceKey(dependency.declaration) !== sourceKey(declaration)) {
      nodes.push(word.slice(0, start))
      const target = dependency
      nodes.push(<button key={`${position}-${word}`} className="proof-code-reference" type="button"
        title={`View ${target.declaration.symbol}`} onClick={() => onNavigate(target)}>{word.slice(start, end)}</button>)
      nodes.push(word.slice(end))
    } else nodes.push(word)
    cursor = position + word.length
  }
  nodes.push(declaration.code.slice(cursor))
  return <pre className="proof-comparison-code"><code>{nodes}</code></pre>
}

function MathlibReader({ comparison }: { comparison: Comparison }) {
  const componentId = useId().replace(/:/g, '')
  const sources = useMemo(() => [...comparison.mathlibCore, ...comparison.mathlibSupporting], [comparison])
  const main = sources.find((declaration) => declaration.symbol === comparison.mathlibMain)!
  const [current, setCurrent] = useState(sourceKey(main))
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
      const dependency = { declaration }
      add(declaration.symbol, dependency)
      add(declaration.symbol.split('.').at(-1)!, dependency)
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
  }, [sources])

  // The proof is a sequence of original declarations: theorem, argument steps,
  // then the remaining available supporting declarations.
  const ordered = useMemo(() => {
    const steps = comparison.mathlibProofSteps.map((symbol) => sources.find((declaration) => declaration.symbol === symbol)!)
    const byKey = new Map([main, ...steps, ...sources].map((declaration) => [sourceKey(declaration), declaration]))
    return [...byKey.values()]
  }, [comparison, sources, main])
  const positions = useMemo(() => new Map(ordered.map((declaration, index) => [sourceKey(declaration), index])), [ordered])
  const edges = useMemo(() => ordered.flatMap((declaration) =>
    referencedDeclarations(declaration, dependencies).map(({ declaration: target }) => ({
      from: sourceKey(declaration), to: sourceKey(target),
    }))), [ordered, dependencies])
  const layout = useMemo(() => {
    const result = new Map<string, number>()
    const graphOrder: string[] = []
    // Disconnected excerpts remain separate nodes; no artificial edge is added.
    for (const declaration of ordered) {
      const key = sourceKey(declaration)
      if (result.has(key)) continue
      result.set(key, 0)
      const queue = [key]
      for (let i = 0; i < queue.length; i += 1) {
        graphOrder.push(queue[i])
        for (const edge of edges.filter((item) => item.from === queue[i])) {
          if (!result.has(edge.to)) { result.set(edge.to, Math.min((result.get(queue[i]) ?? 0) + 1, 5)); queue.push(edge.to) }
        }
      }
    }
    return { depths: result, graphPositions: new Map(graphOrder.map((key, index) => [key, index])) }
  }, [ordered, edges])
  const point = (key: string) => ({ x: 12 + 14 * (layout.depths.get(key) ?? 0), y: 31 + 76 * layout.graphPositions.get(key)! })
  const graphHeight = ordered.length * 76 + 6
  const declarationId = (declaration: MathlibDeclaration) => `${componentId}-declaration-${positions.get(sourceKey(declaration))}`

  function navigate({ declaration }: Dependency) {
    setCurrent(sourceKey(declaration))
    const element = document.getElementById(declarationId(declaration))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    element?.focus({ preventScroll: true })
  }

  return <div className="mathlib-reader">
    <div className="mathlib-reader-layout">
      <div className="mathlib-reader-code" aria-label="Mathlib proof and declarations">
        {ordered.map((declaration, index) => <section key={sourceKey(declaration)} id={declarationId(declaration)} tabIndex={-1}
          className={`mathlib-proof-declaration${current === sourceKey(declaration) ? ' is-current' : ''}`}>
          <div className="mathlib-code-heading">
            <div className="mathlib-code-title"><span>{index === 0 ? 'The theorem' : 'Proof declaration'}</span><strong>{declaration.symbol}</strong></div>
            <a href={declaration.url} target="_blank" rel="noreferrer">Source <ExternalLink size={13} aria-hidden="true" /></a>
          </div>
          {declaration.role !== 'Main declaration or directly used specialization' && <p className="mathlib-code-description">{declaration.role}</p>}
          <LinkedCode declaration={declaration} dependencies={dependencies} onNavigate={navigate} />
        </section>)}
      </div>
      <aside className="mathlib-map" aria-label="Mathlib dependency graph">
        <div className="mathlib-map-heading"><div><span className="mathlib-map-eyebrow">Explore the argument</span><h4>Proof graph</h4></div><GitBranch size={19} aria-hidden="true" /></div>
        <p className="mathlib-map-intro">Follow references between available declarations. Select a node to find it in the proof.</p>
        <div className="mathlib-network" style={{ height: graphHeight }} role="group" aria-label="Proof declarations and their references">
          <svg className="mathlib-network-edges" viewBox={`0 0 260 ${graphHeight}`} preserveAspectRatio="none" aria-hidden="true">
            <defs><marker id={`${componentId}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>
            {edges.map(({ from, to }) => {
              const start = point(from), end = point(to)
              const bend = Math.max(start.x, end.x) + 10
              return <path key={`${from}-${to}`} d={`M ${start.x} ${start.y} C ${bend} ${start.y}, ${bend} ${end.y}, ${end.x} ${end.y}`} markerEnd={`url(#${componentId}-arrow)`} />
            })}
          </svg>
          {ordered.map((declaration) => {
            const key = sourceKey(declaration), pos = point(key)
            return <button key={key} type="button" className={`mathlib-network-node${key === current ? ' is-active' : ''}`}
              style={{ top: pos.y - 19, left: `${pos.x / 260 * 100}%` }} onClick={() => navigate({ declaration })}
              aria-current={key === current ? 'location' : undefined} title={`${declaration.symbol} — ${declaration.role}`}>
              <span className="mathlib-network-dot" /><span className="mathlib-network-label"><strong>{declaration.symbol}</strong>
                <small>{key === sourceKey(main) ? 'The theorem' : declaration.role}</small></span>
            </button>
          })}
        </div>
      </aside>
    </div>
  </div>
}

export default function ProofComparison({ comparison, showStatement = false }: { comparison: Comparison; showStatement?: boolean }) {
  const componentId = useId().replace(/:/g, '')
  const [route, setRoute] = useState<'A' | 'B'>('A')
  useEffect(() => { setRoute('A') }, [comparison.id])

  function routeKey(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = route === 'A' ? 'B' : 'A'
    setRoute(next)
    document.getElementById(`${componentId}-tab-${next}`)?.focus()
  }

  return <div className="proof-comparison" aria-label="Mathlib and alternative proof comparison">
    {showStatement && <div className="proof-comparison-statement"><span>Statement in this comparison</span><MathText text={comparison.statement} /></div>}
    <section className="proof-comparison-section" aria-label="Difficulty comparison">
      <div className="proof-comparison-evidence"><p>{comparison.evidence}</p>
        {comparison.evidenceLinks.length > 0 && <p>{comparison.evidenceLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} <ExternalLink size={12} aria-hidden="true" /></a>)}</p>}
      </div>
    </section>
    <div className="route-picker"><span className="route-picker-label">Proof approach</span>
      <div className={`route-tabs route-${route.toLowerCase()}`} role="tablist" aria-label="Proof approach">
        <span className="route-tabs-indicator" aria-hidden="true" />
        {(['A', 'B'] as const).map((choice) => <button key={choice} id={`${componentId}-tab-${choice}`} type="button" role="tab"
          aria-selected={route === choice} aria-controls={`${componentId}-panel-${choice}`} tabIndex={route === choice ? 0 : -1}
          onKeyDown={routeKey} onClick={() => setRoute(choice)}>{choice === 'A' ? 'Mathlib Route' : 'Alternative Route'}</button>)}
      </div>
    </div>
    {(['A', 'B'] as const).map((choice) => <section key={choice} id={`${componentId}-panel-${choice}`} role="tabpanel"
      aria-labelledby={`${componentId}-tab-${choice}`} className="proof-route-panel" hidden={route !== choice}>
      {route === choice && <>
        <h3>Informal proof</h3><Paragraphs text={choice === 'A' ? comparison.proofA : comparison.proofB} />
        <div className="proof-comparison-formal"><h3>{choice === 'A' ? 'Formal Proof from Mathlib' : comparison.formalProofVerified ? 'Formal proof' : 'Formal proof sketch'}</h3>
          {choice === 'A' ? <>
            {comparison.scope && <p className="proof-comparison-scope"><MathText text={comparison.scope} /></p>}
            <MathlibReader key={comparison.id} comparison={comparison} />
          </> : <>
            {comparison.formalProofScope && <p className="proof-comparison-scope"><MathText text={comparison.formalProofScope} /></p>}
            <pre className="proof-comparison-code proof-sketch"><code>{comparison.formalSketch}</code></pre>
          </>}
        </div>
      </>}
    </section>)}
  </div>
}
