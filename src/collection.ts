export type Kind = 'informal' | 'formal'

export type Item = {
  id: string
  kind: Kind
  dataset: string
  title: string | null
  statement: string
  source_id: string | null
  categories: string[]
  n_proofs: number
  record_file: string
}

export type SourceCount = { kind: Kind; dataset: string; count: number }
export type CollectionIndex = {
  version: number
  sources: SourceCount[]
}

export type InformalProof = {
  proof_id: string
  text: string
  content_type: string
  origin: string
  source_url: string | null
  technique?: string | null
  method_cluster?: { id: string; name: string; defining_approach: string }
  method_fingerprint?: { primary_approach: string | null; secondary_techniques: string[] }
}

export type InformalRecord = {
  id: string
  dataset: string
  statement: string
  source_id: string
  source_url: string | null
  answer: string | null
  proofs: InformalProof[]
  source_metadata?: { method_clustering?: { status: string; cluster_count: number | null; judge: string | null } }
}

export type FormalProof = { code: string; main_theorem_proof_code: string | null; main_theorem_split_valid: boolean; validation_status: string }
export type FormalRecord = {
  id: string
  dataset: string
  problem: string
  formal_statement: string
  source_id: string
  human_proof: FormalProof
  prover_proof: FormalProof
}
export type RecordDetail = InformalRecord | FormalRecord

const collectionBase = `${import.meta.env.BASE_URL}data/collection/`

// One request per file, however many parts of the page ask for it; a failed request may be tried again.
const downloads = new Map<string, Promise<unknown>>()
export function cachedJson<T>(url: string): Promise<T> {
  let download = downloads.get(url)
  if (!download) {
    download = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Request for ${url.split('/').pop()} failed (${response.status}).`)
      return response.json()
    }).catch((error) => { downloads.delete(url); throw error })
    downloads.set(url, download)
  }
  return download as Promise<T>
}

export const dataUrl = (name: string) => `${collectionBase}${name}`
export const loadIndex = () => cachedJson<CollectionIndex>(dataUrl('index.json'))
/** The statements of one source (a dataset name from the index). */
export const loadItems = (dataset: string) => cachedJson<{ items: Item[] }>(dataUrl(`index-${dataset}.json`)).then((part) => part.items)

export async function loadRecord(recordFile: string, signal?: AbortSignal): Promise<RecordDetail> {
  const path = `${collectionBase}records/${recordFile}`
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error(`Proof record request failed (${response.status}).`)
  if (!('DecompressionStream' in globalThis)) throw new Error('This browser cannot open the compressed proof record. Try a current version of your browser.')
  const stream = response.body?.pipeThrough(new DecompressionStream('gzip'))
  if (!stream) throw new Error('The proof record response was empty.')
  return JSON.parse(await new Response(stream).text()) as RecordDetail
}
