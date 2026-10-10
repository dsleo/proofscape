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

export function MathText({ text }: { text: string }) {
  // ProofWiki prefixes some TeX statements with a colon before the math delimiter.
  const normalizedText = text.replace(/^(\s*):(?=\$|\\\[|\\\()/, '$1')
  return <>{normalizedText.split(DELIMITERS).map((part, index) => {
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
