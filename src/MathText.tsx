import katex from 'katex'
import 'katex/dist/katex.min.css'

const DELIMITERS = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$])+?(?<!\\)\$)/g
const PROOFWIKI_MACROS: Record<string, string> = {
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\R': '\\mathbb{R}',
  '\\C': '\\mathbb{C}',
  '\\paren': '\\left(#1\\right)',
  '\\map': '#1\\left(#2\\right)',
  '\\d': '\\mathrm{d}',
  '\\rd': '\\,\\mathrm{d}',
  '\\size': '\\left\\lvert #1\\right\\rvert',
  '\\norm': '\\left\\lVert #1\\right\\rVert',
  '\\leadstoandfrom': '\\Longleftrightarrow',
  '\\cmod': '\\left\\lvert #1\\right\\rvert',
  '\\laptrans': '\\mathcal{L}\\left[#1\\right]',
  '\\invlaptrans': '\\mathcal{L}^{-1}\\left[#1\\right]',
  '\\sqbrk': '\\left[#1\\right]',
  '\\tuple': '\\left(#1\\right)',
  '\\degrees': '^\\circ',
  '\\expect': '\\mathbb{E}\\left[#1\\right]',
  '\\arcsec': '\\operatorname{arcsec}',
  '\\arccsc': '\\operatorname{arccsc}',
  '\\arccot': '\\operatorname{arccot}',
  '\\arcoth': '\\operatorname{arccoth}',
  '\\artanh': '\\operatorname{artanh}',
  '\\csch': '\\operatorname{csch}',
  '\\sech': '\\operatorname{sech}',
  '\\eqclass': '\\left[#1\\right]_{#2}',
  '\\innerprod': '\\left\\langle #1,#2\\right\\rangle',
  '\\divides': '\\mid',
  '\\intlimits': '\\int_{#2}^{#3} #1',
  '\\bigintlimits': '\\displaystyle\\int_{#2}^{#3} #1',
  '\\floor': '\\left\\lfloor #1\\right\\rfloor',
  '\\ceiling': '\\left\\lceil #1\\right\\rceil',
  '\\O': '\\varnothing',
  '\\OO': '\\mathcal{O}',
  '\\RR': '\\mathcal{R}',
  '\\CC': '\\mathcal{C}',
  '\\FF': '\\mathcal{F}',
  '\\BB': '\\mathcal{B}',
  '\\DD': '\\mathcal{D}',
  '\\TT': '\\mathcal{T}',
  '\\HH': '\\mathcal{H}',
  '\\SS': '\\mathcal{S}',
  '\\T': '\\mathsf{T}',
  '\\LL': '\\mathcal{L}',
  '\\AA': '\\mathcal{A}',
  '\\relcomp': '#1\\setminus #2',
  '\\closedint': '\\left[#1,#2\\right]',
  '\\openint': '\\left(#1,#2\\right)',
  '\\card': '\\left\\lvert #1\\right\\rvert',
  '\\sequence': '\\left(#1\\right)',
  '\\symdif': '\\mathbin{\\triangle}',
  '\\order': '\\operatorname{ord}',
  '\\sgn': '\\operatorname{sgn}',
  '\\leftparen': '\\lparen',
  '\\rightparen': '\\rparen',
  '\\Si': '\\operatorname{Si}',
  '\\Li': '\\operatorname{Li}',
  '\\Orb': '\\operatorname{Orb}',
  '\\Area': '\\operatorname{Area}',
  '\\powerset': '\\mathcal{P}\\left(#1\\right)',
  '\\lcm': '\\operatorname{lcm}',
  '\\Img': '\\operatorname{Im}',
  '\\polar': '\\operatorname{polar}\\left(#1\\right)',
  '\\GF': '\\operatorname{GF}',
  '\\Res': '\\operatorname{Res}_{#2}\\left(#1\\right)',
  '\\family': '\\left(#1\\right)',
  '\\index': '\\left[#1:#2\\right]',
  '\\inj': '\\hookrightarrow',
  '\\bszero': '\\mathbf{0}',
  '\\cis': '\\cos #1 + i\\sin #1',
  '\\span': '\\operatorname{span}\\left(#1\\right)',
  '\\erf': '\\operatorname{erf}',
  '\\erfc': '\\operatorname{erfc}',
  '\\ds': '\\displaystyle',
  '\\adj': '\\operatorname{adj}',
  '\\arsinh': '\\operatorname{arsinh}',
  '\\valueat': '\\left.#1\\right\\rvert_{#2}',
  '\\bigvalueat': '\\left.#1\\right\\rvert_{#2}',
  '\\var': '\\operatorname{Var}',
  '\\pr': '\\operatorname{pr}',
  '\\struct': '\\left\\langle #1\\right\\rangle',
  '\\F': '\\bot',
  '\\cl': '\\operatorname{cl}\\left(#1\\right)',
  '\\On': '\\operatorname{On}',
  '\\Int': '\\operatorname{Int}',
  '\\Stab': '\\operatorname{Stab}',
  '\\gen': '\\left\\langle #1\\right\\rangle',
  '\\ideal': '\\mathfrak{#1}',
  '\\Dom': '\\operatorname{Dom}',
  '\\Arg': '\\operatorname{Arg}',
  '\\leftset': '\\lbrace',
  '\\rightset': '\\rbrace',
  '\\conjclass': '\\left[#1\\right]',
  '\\refl': '\\operatorname{refl}',
  '\\Char': '\\operatorname{char}',
  '\\Preimg': '\\operatorname{Preimage}',
  '\\cont': '\\operatorname{cont}',
  '\\Ci': '\\operatorname{Ci}',
  '\\Dic': '\\operatorname{Dic}',
  '\\hointr': '\\oint',
  '\\hointl': '\\oint',
  '\\qedhere': '\\square',
  '\\qed': '\\square',
  '\\overarc': '\\widehat{#1}',
  '\\iddots': '\\ddots',
  '\\Poisson': '\\operatorname{Poisson}',
  '\\Gaussian': '\\operatorname{Gaussian}',
  '\\Binomial': '\\operatorname{Binomial}',
  '\\noindent': '',
  '\\hfill': '\\quad',
  '\\medskip': '\\quad',
  '\\bigskip': '\\quad',
  '\\smallskip': '\\quad',
  '\\item': '\\bullet\\quad',
  '\\label': '\\phantom{#1}',
  '\\ref': '\\text{#1}',
  '\\eqref': '\\text{(#1)}',
  '\\j': 'j',
}

for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const command = `\\${letter}${letter}`
  PROOFWIKI_MACROS[command] ??= `\\mathcal{${letter}}`
}

type TableauStep = { number: string; rule: string; formula: string; context: string; references: string; note: string }
type EquationRow = Record<string, string>
type EquationBlockData = { title: string; rows: EquationRow[] }
type MathSegment = { kind: 'text'; text: string } | { kind: 'equations'; block: EquationBlockData }

function splitTemplateFields(source: string) {
  const result: string[] = []
  let templateDepth = 0
  let linkDepth = 0
  let start = 0
  for (let index = 0; index < source.length;) {
    const pair = source.slice(index, index + 2)
    if (pair === '{{') { templateDepth += 1; index += 2; continue }
    if (pair === '}}') { templateDepth = Math.max(0, templateDepth - 1); index += 2; continue }
    if (pair === '[[') { linkDepth += 1; index += 2; continue }
    if (pair === ']]') { linkDepth = Math.max(0, linkDepth - 1); index += 2; continue }
    if (source[index] === '|' && templateDepth === 0 && linkDepth === 0) {
      result.push(source.slice(start, index).trim())
      start = index + 1
    }
    index += 1
  }
  result.push(source.slice(start).trim())
  return result
}

function findTemplateEnd(source: string, start: number) {
  let depth = 0
  for (let index = start; index < source.length - 1;) {
    const pair = source.slice(index, index + 2)
    if (pair === '{{') { depth += 1; index += 2; continue }
    if (pair === '}}') {
      depth -= 1
      index += 2
      if (depth === 0) return index
      continue
    }
    index += 1
  }
  return -1
}

function templateAt(source: string, start: number) {
  if (source.slice(start, start + 2) !== '{{') return null
  const end = findTemplateEnd(source, start)
  if (end < 0) return null
  const raw = source.slice(start, end)
  const parts = splitTemplateFields(raw.slice(2, -2))
  return { name: (parts[0] ?? '').toLowerCase(), parts, end }
}

function parseEquationRow(parts: string[]) {
  const row: EquationRow = {}
  for (const part of parts.slice(1)) {
    const splitAt = part.indexOf('=')
    if (splitAt < 0) continue
    const name = part.slice(0, splitAt).trim().toLowerCase()
    if (!/^[a-z]+$/.test(name)) continue
    row[name] = part.slice(splitAt + 1).trim()
  }
  return row
}

function equationBlockAt(source: string, start: number) {
  const opening = templateAt(source, start)
  if (!opening || opening.name !== 'begin-eqn') return null
  const block: EquationBlockData = { title: '', rows: [] }
  let cursor = opening.end
  while (cursor < source.length) {
    const next = source.indexOf('{{', cursor)
    if (next < 0) return null
    const template = templateAt(source, next)
    if (!template) return null
    cursor = template.end
    if (template.name === 'end-eqn') return block.rows.length ? { block, end: cursor } : null
    if (template.name === 'eqn') block.rows.push(parseEquationRow(template.parts))
    if (template.name === 'eqn-title') block.title = template.parts.slice(1).join(' | ').trim()
  }
  return null
}

function mathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = []
  const openingPattern = /\{\{\s*begin-eqn\s*\}\}/ig
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = openingPattern.exec(text))) {
    const equationBlock = equationBlockAt(text, match.index)
    if (!equationBlock) continue
    if (match.index > cursor) segments.push({ kind: 'text', text: text.slice(cursor, match.index) })
    segments.push({ kind: 'equations', block: equationBlock.block })
    cursor = equationBlock.end
    openingPattern.lastIndex = cursor
  }
  if (!segments.length) return [{ kind: 'text', text }]
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

function plainWikiText(source: string): string {
  let result = ''
  for (let index = 0; index < source.length;) {
    const pair = source.slice(index, index + 2)
    if (pair === '{{') {
      const template = templateAt(source, index)
      if (template) {
        const visible = template.parts.slice(1).find((part) => part && !/^[a-z_-]+\s*=/.test(part)) ?? ''
        result += template.name === '!' ? '|' : plainWikiText(visible)
        index = template.end
        continue
      }
    }
    if (pair === '[[') {
      const close = source.indexOf(']]', index + 2)
      if (close >= 0) {
        const link = source.slice(index + 2, close)
        const pieces = splitTemplateFields(link)
        result += plainWikiText(pieces[pieces.length - 1] ?? '')
        index = close + 2
        continue
      }
    }
    result += source[index]
    index += 1
  }
  return result.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, ' ').replace(/'{2,5}/g, '').replace(/\s+/g, ' ').trim()
}

function tableauParts(text: string) {
  const tokens: Array<{ name: string; parts: string[]; start: number; end: number }> = []
  for (let cursor = 0; cursor < text.length;) {
    const start = text.indexOf('{{', cursor)
    if (start < 0) break
    const template = templateAt(text, start)
    if (!template) {
      cursor = start + 2
      continue
    }
    tokens.push({ ...template, start })
    cursor = template.end
  }

  const start = tokens.findIndex((token) => token.name === 'begintableau')
  if (start < 0) return null
  const end = tokens.findIndex((token, index) => index > start && token.name === 'endtableau')
  if (end < 0) return null

  const startToken = tokens[start]
  const endToken = tokens[end]
  const goal = startToken.parts.slice(1).join('|').trim()
  const steps: TableauStep[] = []
  for (const token of tokens.slice(start + 1, end)) {
    const [rawRule, ...args] = token.parts
    const rule = rawRule?.trim()
    if (!rule || /^(qed|begintableau|endtableau)$/i.test(rule)) continue

    let number = args[0] ?? String(steps.length + 1)
    let formula = ''
    let context = ''
    let references = ''
    let note = ''
    if (rule.toLowerCase() === 'tableauline') {
      const numberMatch = number.match(/(?:n\s*=\s*)?(\d+)/i)
      number = numberMatch?.[1] ?? number
      formula = args.slice(1).join('|')
    } else if (/^(premise|assumption)$/i.test(rule)) {
      formula = args[1] ?? ''
    } else if (/^noncontradiction$/i.test(rule)) {
      context = args[1] ?? ''
      formula = '\\bot'
      references = args.slice(2, 4).filter(Boolean).join(', ')
      note = args[4] ?? ''
    } else {
      context = args[1] ?? ''
      formula = args[2] ?? ''
      const extra = args.slice(3)
      references = extra.filter((value) => /^(?:\d+\s*,\s*)*\d+$/.test(value)).join(', ')
      note = extra.filter((value) => !/^(?:\d+\s*,\s*)*\d+$/.test(value)).join(' · ')
    }
    steps.push({ number, rule: rule.replace(/([a-z])([A-Z])/g, '$1 $2'), formula, context, references, note })
  }

  const trailing = text.slice(endToken.end)
    .replace(/\s*\{\{\s*qed\s*\}\}\s*/ig, ' ')
    .trim()
  return {
    before: text.slice(0, startToken.start),
    goal,
    steps,
    qed: /qed/i.test(endToken.parts.slice(1).join('|')) || tokens.slice(end + 1).some((token) => token.name === 'qed'),
    after: trailing,
  }
}

function MathFormula({ value, displayStyle = false }: { value: string; displayStyle?: boolean }) {
  const math = displayStyle ? `\\displaystyle ${value}` : value
  const source = /\\\(|\\\[|\$/.test(value) ? value : `\\(${math}\\)`
  return <MathText text={source} />
}

const EQUATION_COLUMNS = ['n', 'k', 'lll', 'll', 'q', 'qq', 'lo', 'l', 'o', 'm', 'mo', 'ro', 'r', 'rr', 'rrr']
const EQUATION_LABELS: Record<string, string> = { d: 'Let', re: 'Recall', s: 'Suppose', c: 'Case', t: 'Then', r: 'Result', lhs: 'LHS', rhs: 'RHS' }

function EquationValue({ name, value }: { name: string; value: string }) {
  if (!value) return null
  if (name === 'n') return <span className="proofwiki-equation-number">({plainWikiText(value)})</span>
  if (name === 'k') return <span className="proofwiki-equation-keyword">{EQUATION_LABELS[value.toLowerCase()] ?? plainWikiText(value)}:</span>
  const mathValue = name === 'q' || name === 'qq' ? `${value}:` : value
  return <MathFormula value={mathValue} displayStyle />
}

function EquationComment({ value, className }: { value: string; className: string }) {
  const comment = plainWikiText(value)
  return comment ? <td className={className}><MathFragments text={comment} /></td> : <td className={`${className} empty`} />
}

function EquationBlock({ block }: { block: EquationBlockData }) {
  return <figure className="proofwiki-equation-block" aria-label="Aligned equation proof">
    {block.title && <figcaption className="proofwiki-equation-title"><MathFragments text={plainWikiText(block.title)} /></figcaption>}
    <div className="proofwiki-equation-scroll">
      <table className="proofwiki-equations"><tbody>
        {block.rows.map((row, index) => <tr key={`${index}-${row.n ?? ''}`}>
          {EQUATION_COLUMNS.map((name) => {
            let value = row[name]
            if (name === 'o' && !(name in row)) value = '='
            return <td className={`proofwiki-equation-cell proofwiki-equation-${name}`} key={name}>{value ? <EquationValue name={name} value={value} /> : null}</td>
          })}
          <EquationComment value={row.c ?? ''} className="proofwiki-equation-comment" />
          <EquationComment value={row.cc ?? ''} className="proofwiki-equation-comment proofwiki-equation-comment-extra" />
        </tr>)}
      </tbody></table>
    </div>
  </figure>
}

function Tableau({ goal, steps, qed }: { goal: string; steps: TableauStep[]; qed: boolean }) {
  return <section className="proofwiki-tableau" aria-label="ProofWiki tableau proof">
    <header className="proofwiki-tableau-heading"><span>Tableau proof</span>{qed && <span className="proofwiki-qed">QED</span>}</header>
    {goal && <div className="proofwiki-tableau-goal"><MathFormula value={goal} /></div>}
    <ol className="proofwiki-tableau-lines">
      {steps.map((step, index) => <li className={`proofwiki-tableau-line ${step.rule.toLowerCase()}`} key={`${step.number}-${index}`}>
        <span className="proofwiki-line-number">{step.number}</span>
        <div className="proofwiki-line-content">
          <div className="proofwiki-line-formula">{step.formula ? <MathFormula value={step.formula} /> : <span className="proofwiki-no-formula">—</span>}</div>
          <div className="proofwiki-line-rule">{step.rule}{step.context && <span>under {step.context}</span>}{step.references && <span>from {step.references}</span>}{step.note && <span>{step.note}</span>}</div>
        </div>
      </li>)}
    </ol>
  </section>
}

export function MathText({ text }: { text: string }) {
  // ProofWiki prefixes some TeX statements with a colon before the math delimiter.
  const hasQed = /\{\{\s*qed\s*\}\}/i.test(text)
  const normalizedText = text.replace(/^(\s*):(?=\$|\\\[|\\\()/, '$1').replace(/\{\{\s*qed\s*\}\}/ig, ' ∎ ')
  const tableau = tableauParts(normalizedText)
  if (tableau) return <>{tableau.before && <MathFragments text={tableau.before} />}<Tableau goal={tableau.goal} steps={tableau.steps} qed={tableau.qed || hasQed} />{tableau.after && <MathFragments text={tableau.after} />}</>
  return <MathFragments text={normalizedText} />
}

function MathFragments({ text }: { text: string }) {
  const segments = mathSegments(text)
  if (segments.length > 1 || segments[0]?.kind === 'equations') {
    return <>{segments.map((segment, index) => segment.kind === 'equations'
      ? <EquationBlock block={segment.block} key={`equation-${index}`} />
      : <MathDelimitedFragments text={segment.text} key={`text-${index}`} />)}</>
  }
  return <MathDelimitedFragments text={text} />
}

function MathDelimitedFragments({ text }: { text: string }) {
  return <>{text.split(DELIMITERS).map((part, index) => {
    const display = (part.startsWith('\\[') && part.endsWith('\\]')) || (part.startsWith('$$') && part.endsWith('$$'))
    const inline = (part.startsWith('\\(') && part.endsWith('\\)')) || (part.startsWith('$') && part.endsWith('$'))
    if (!display && !inline) return part
    const math = part.startsWith('\\') ? part.slice(2, -2) : display ? part.slice(2, -2) : part.slice(1, -1)
    try {
      const html = katex.renderToString(math, { displayMode: display, macros: PROOFWIKI_MACROS, throwOnError: false, trust: false })
      return <span className={display ? 'dataset-math-display' : 'dataset-math-inline'} key={index} dangerouslySetInnerHTML={{ __html: html }} />
    } catch {
      return part
    }
  })}</>
}
