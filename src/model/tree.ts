import type { GedcomSource } from '../gedcom/types'

export interface Person {
  id: string
  givenName: string
  surname: string
  birthDate: string
  deathDate: string
  note: string
  sex: 'M' | 'F' | 'U'
}

export interface Family {
  id: string
  partnerIds: string[]
  childIds: string[]
}

// The editable projection is deliberately separate from the original GEDCOM.
// The source text is reparsed into a syntax tree when applying export patches.
export interface TreeDocument {
  schemaVersion: 1
  id: string
  title: string
  people: Record<string, Person>
  families: Record<string, Family>
  gedcom?: GedcomSource
}

export type PersonFields = Pick<Person, 'givenName' | 'surname' | 'birthDate' | 'deathDate' | 'note'>
export type Positions = Record<string, { x: number; y: number }>

export function fullName(person: Person): string {
  return `${person.givenName} ${person.surname}`.trim() || 'Без имени'
}

export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim()
}

export function searchPeople(people: Record<string, Person>, query: string): Person[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return Object.values(people).filter((person) => {
    const haystack = normalizeSearch(`${fullName(person)} ${person.id} ${person.birthDate}`)
    return terms.every((term) => haystack.includes(term))
  })
}

export function relativesOf(tree: TreeDocument, personId: string) {
  const parents = new Set<string>()
  const partners = new Set<string>()
  const children = new Set<string>()
  for (const family of Object.values(tree.families)) {
    if (family.childIds.includes(personId)) family.partnerIds.forEach((id) => parents.add(id))
    if (family.partnerIds.includes(personId)) {
      family.partnerIds.filter((id) => id !== personId).forEach((id) => partners.add(id))
      family.childIds.forEach((id) => children.add(id))
    }
  }
  return { parents: [...parents], partners: [...partners], children: [...children] }
}

export function isTreeDocument(value: unknown): value is TreeDocument {
  if (!value || typeof value !== 'object') return false
  const tree = value as TreeDocument
  if (tree.schemaVersion !== 1 || typeof tree.id !== 'string' || typeof tree.title !== 'string' ||
    !tree.people || typeof tree.people !== 'object' || !tree.families || typeof tree.families !== 'object' ||
    Array.isArray(tree.people) || Array.isArray(tree.families)) return false
  if (tree.gedcom && (typeof tree.gedcom.text !== 'string' || typeof tree.gedcom.fileName !== 'string' ||
    !['5.5.1', '7.0'].includes(tree.gedcom.version) || !['UTF-8', 'ASCII'].includes(tree.gedcom.encoding) ||
    !Array.isArray(tree.gedcom.warnings) || !tree.gedcom.warnings.every((warning) => typeof warning === 'string'))) return false
  return Object.entries(tree.people).every(([id, person]) => person && person.id === id &&
    ['givenName', 'surname', 'birthDate', 'deathDate', 'note'].every((key) => typeof person[key as keyof Person] === 'string') &&
    ['M', 'F', 'U'].includes(person.sex)) &&
    Object.entries(tree.families).every(([id, family]) => family && family.id === id &&
      Array.isArray(family.partnerIds) && Array.isArray(family.childIds) &&
      [...family.partnerIds, ...family.childIds].every((ref) => typeof ref === 'string' && Object.hasOwn(tree.people, ref)))
}
