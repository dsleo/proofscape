export type MathlibDeclaration = {
  symbol: string
  path: string
  line: number
  url: string
  code: string
  attribution: string
  role: string
}

export type ProofComparison = {
  id: string
  name: string
  statement: string
  scope: string
  proofA: string
  proofB: string
  formalSketch: string
  mathlibCore: MathlibDeclaration[]
  mathlibSupporting: MathlibDeclaration[]
  evidenceStatus: string
  evidence: string
  evidenceLinks: { label: string; url: string }[]
  historicalId: number | null
}

export type ProofComparisons = { version: number; revision: string; records: ProofComparison[] }
