import { isRecognizedDate, yearOf } from './dates'
import { buildIndex, fullName, normalizeSearch, type TreeDocument, type TreeIndex } from './tree'

// Consistency checks that help catch transcription mistakes. They never block editing.

export type IssueKind = 'noName' | 'noSex' | 'isolated' | 'badDate' | 'deathBeforeBirth' | 'parentTooYoung' | 'parentTooOld' | 'bornAfterParentDeath' | 'duplicate'
export interface Issue { kind: IssueKind; personId: string; relatedId?: string; message: string }

export const issueTitles: Record<IssueKind, string> = {
  noName: 'Без имени',
  noSex: 'Не указан пол',
  isolated: 'Без родственных связей',
  badDate: 'Нераспознанная дата',
  deathBeforeBirth: 'Смерть раньше рождения',
  parentTooYoung: 'Слишком молодой родитель',
  parentTooOld: 'Слишком пожилой родитель',
  bornAfterParentDeath: 'Рождение после смерти родителя',
  duplicate: 'Возможный дубликат',
}

export function findIssues(tree: TreeDocument, index: TreeIndex = buildIndex(tree)): Issue[] {
  const issues: Issue[] = []
  const people = Object.values(tree.people)
  const many = people.length > 1
  for (const person of people) {
    const name = fullName(person)
    if (!person.givenName && !person.surname) issues.push({ kind: 'noName', personId: person.id, message: 'Не заполнены имя и фамилия' })
    if (person.sex === 'U') issues.push({ kind: 'noSex', personId: person.id, message: `${name}: пол не указан` })
    if (many && !index.asChild.has(person.id) && !index.asPartner.has(person.id)) issues.push({ kind: 'isolated', personId: person.id, message: `${name} не связан(а) ни с кем в дереве` })
    for (const [label, value] of [['рождения', person.birthDate], ['смерти', person.deathDate]] as const) {
      if (!isRecognizedDate(value)) issues.push({ kind: 'badDate', personId: person.id, message: `${name}: дата ${label} «${value}» не распознана и будет сохранена как текст` })
    }
    const birth = yearOf(person.birthDate)
    const death = yearOf(person.deathDate)
    if (birth !== undefined && death !== undefined && death < birth) issues.push({ kind: 'deathBeforeBirth', personId: person.id, message: `${name}: смерть (${death}) раньше рождения (${birth})` })
  }
  for (const family of Object.values(tree.families)) for (const childId of family.childIds) {
    const child = tree.people[childId]
    const childBirth = yearOf(child.birthDate)
    if (childBirth === undefined) continue
    for (const parentId of family.partnerIds) {
      const parent = tree.people[parentId]
      const parentBirth = yearOf(parent.birthDate)
      const parentDeath = yearOf(parent.deathDate)
      const age = parentBirth === undefined ? undefined : childBirth - parentBirth
      if (age !== undefined && age < 13) issues.push({ kind: 'parentTooYoung', personId: childId, relatedId: parentId, message: `${fullName(parent)} — родитель в ${age} лет (${fullName(child)}, ${childBirth})` })
      if (age !== undefined && age > (parent.sex === 'F' ? 55 : 80)) issues.push({ kind: 'parentTooOld', personId: childId, relatedId: parentId, message: `${fullName(parent)} — родитель в ${age} лет (${fullName(child)}, ${childBirth})` })
      if (parentDeath !== undefined && childBirth > parentDeath + (parent.sex === 'M' ? 1 : 0)) issues.push({ kind: 'bornAfterParentDeath', personId: childId, relatedId: parentId, message: `${fullName(child)} родился(ась) в ${childBirth}, после смерти ${fullName(parent)} (${parentDeath})` })
    }
  }
  const byName = new Map<string, string[]>()
  for (const person of people) {
    if (!person.givenName || !person.surname) continue
    const key = normalizeSearch(`${person.surname} ${person.givenName} ${person.patronymic}`)
    byName.set(key, [...(byName.get(key) ?? []), person.id])
  }
  for (const ids of byName.values()) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = tree.people[ids[i]]
    const b = tree.people[ids[j]]
    const yearA = yearOf(a.birthDate)
    const yearB = yearOf(b.birthDate)
    const sameParents = (index.asChild.get(a.id) ?? []).some((id) => (index.asChild.get(b.id) ?? []).includes(id))
    if ((yearA !== undefined && yearA === yearB) || sameParents || (yearA === undefined && yearB === undefined && !index.asChild.has(a.id) && !index.asChild.has(b.id))) {
      issues.push({ kind: 'duplicate', personId: a.id, relatedId: b.id, message: `${fullName(a)} и ${fullName(b)} могут быть одним человеком` })
    }
  }
  return issues
}
