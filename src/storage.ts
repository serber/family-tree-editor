import { get, set } from 'idb-keyval'
import { isTreeDocument, type Positions, type TreeDocument } from './model/tree'

export interface Draft { version: 1; tree: TreeDocument; positions: Positions; savedAt: string }
const KEY = 'rodnye:draft:v1'

export async function loadDraft(): Promise<Draft | undefined> {
  const value: unknown = await get(KEY)
  if (value === undefined) return undefined
  return parseDraft(value)
}

export function parseDraft(value: unknown): Draft {
  const draft = value as Draft
  if (!draft || draft.version !== 1 || !isTreeDocument(draft.tree) || !draft.positions ||
    typeof draft.positions !== 'object' || Array.isArray(draft.positions) ||
    !Object.values(draft.positions).every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))) {
    throw new Error('Сохранённый черновик имеет неподдерживаемый формат. Он оставлен без изменений.')
  }
  return draft
}

export function saveDraft(tree: TreeDocument, positions: Positions): Promise<void> {
  return set(KEY, { version: 1, tree, positions, savedAt: new Date().toISOString() } satisfies Draft)
}

export function downloadDraft(tree: TreeDocument, positions: Positions): void {
  const draft: Draft = { version: 1, tree, positions, savedAt: new Date().toISOString() }
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `rodnye-${tree.id}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
