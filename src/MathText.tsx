import katex from 'katex'
import 'katex/dist/katex.min.css'

const DELIMITERS = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$])+?(?<!\\)\$)/g
const PROOFWIKI_MACROS = {
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\R': '\\mathbb{R}',
  '\\C': '\\mathbb{C}',
  '\\paren': '\\left(#1\\right)',
}

type TableauStep = { number: string; rule: string; formula: string; references: string }

function fields(token: string) {
  return token.slice(2, -2).split('|').map((part) => part.trim())
}

function tableauParts(text: string) {
  const tokens = [...text.matchAll(/\{\{[^{}]+\}\}/g)]
  const start = tokens.findIndex((token) => fields(token[0])[0]?.toLowerCase() === 'begintableau')
  if (start < 0) return null
  const end = tokens.findIndex((token, index) => index > start && fields(token[0])[0]?.toLowerCase() === 'endtableau')
  if (end < 0) return null

  const startToken = tokens[start]
  const endToken = tokens[end]
  if (startToken.index === undefined || endToken.index === undefined) return null
  const goal = fields(startToken[0]).slice(1).join('|').trim()
  const steps: TableauStep[] = []
  for (const token of tokens.slice(start + 1, end)) {
    const [rawRule, ...args] = fields(token[0])
    const rule = rawRule?.trim()
    if (!rule || /^(qed|begintableau|endtableau)$/i.test(rule)) continue

    let number = args[0] ?? String(steps.length + 1)
    let formula = ''
    let references = ''
    if (rule.toLowerCase() === 'tableauline') {
      const numberMatch = number.match(/(?:n\s*=\s*)?(\d+)/i)
      number = numberMatch?.[1] ?? number
      formula = args.slice(1).join('|')
    } else if (/^(premise|assumption)$/i.test(rule)) {
      formula = args[1] ?? ''
    } else {
      references = args[1] ?? ''
      formula = args[2] ?? ''
    }
    steps.push({ number, rule: rule.replace(/([a-z])([A-Z])/g, '$1 $2'), formula, references })
  }

  const trailing = text.slice(endToken.index + endToken[0].length)
    .replace(/\s*\{\{\s*qed\s*\}\}\s*/ig, ' ')
    .trim()
  return {
    before: text.slice(0, startToken.index),
    goal,
    steps,
    qed: /qed/i.test(fields(endToken[0]).slice(1).join('|')) || tokens.slice(end + 1).some((token) => fields(token[0])[0]?.toLowerCase() === 'qed'),
    after: trailing,
  }
}

function MathFormula({ value }: { value: string }) {
  const source = /\\\(|\\\[|\$/.test(value) ? value : `\\(${value}\\)`
  return <MathText text={source} />
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
          <div className="proofwiki-line-rule">{step.rule}{step.references && <span>from {step.references}</span>}</div>
        </div>
      </li>)}
    </ol>
  </section>
}

export function MathText({ text }: { text: string }) {
  // ProofWiki prefixes some TeX statements with a colon before the math delimiter.
  const normalizedText = text.replace(/^(\s*):(?=\$|\\\[|\\\()/, '$1')
  const tableau = tableauParts(normalizedText)
  if (tableau) return <>{tableau.before && <MathFragments text={tableau.before} />}<Tableau goal={tableau.goal} steps={tableau.steps} qed={tableau.qed} />{tableau.after && <MathFragments text={tableau.after} />}</>
  return <MathFragments text={normalizedText} />
}

function MathFragments({ text }: { text: string }) {
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
