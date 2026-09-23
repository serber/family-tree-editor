import { describe, expect, it } from 'vitest'
import { createDemo } from './demo'
import { editorReducer } from './history'
import { isTreeDocument, relativesOf, searchPeople } from './tree'

describe('demo genealogy', () => {
  it.each([100, 1000, 3000])('creates exactly %i people with valid, acyclic family references', (count) => {
    const tree = createDemo(count)
    expect(Object.keys(tree.people)).toHaveLength(count)
    expect(isTreeDocument(tree)).toBe(true)
    const parentCount = new Map<string, number>()
    for (const family of Object.values(tree.families)) {
      expect(new Set([...family.partnerIds, ...family.childIds]).size).toBe(family.partnerIds.length + family.childIds.length)
      for (const parent of family.partnerIds) {
        parentCount.set(parent, (parentCount.get(parent) ?? 0) + 1)
        for (const child of family.childIds) {
          expect(Number(tree.people[parent].birthDate)).toBeLessThan(Number(tree.people[child].birthDate))
        }
      }
    }
    expect([...parentCount.values()].some((value) => value > 1)).toBe(true)
    expect(createDemo(count)).toEqual(tree)
  })

  it('finds Russian names regardless of word order, case, or ё/е', () => {
    const tree = createDemo(100)
    tree.people.I0001.givenName = 'Пётр'
    expect(searchPeople(tree.people, 'леснов ПЕТР').map((person) => person.id)).toContain('I0001')
    expect(searchPeople(tree.people, 'i0100')[0].id).toBe('I0100')
    expect(searchPeople(tree.people, '   ')).toEqual([])
  })

  it('collects both spouses and all children across repeated marriages', () => {
    const tree = createDemo(100)
    const counts = Object.values(tree.families).flatMap((family) => family.partnerIds)
    const id = counts.find((id, index) => counts.indexOf(id) !== index)!
    const families = Object.values(tree.families).filter((family) => family.partnerIds.includes(id))
    const relatives = relativesOf(tree, id)
    expect(relatives.partners).toHaveLength(2)
    expect(new Set(relatives.children)).toEqual(new Set(families.flatMap((family) => family.childIds)))
    expect(relatives.partners).not.toContain(id)
  })

  it('rejects malformed drafts and broken family references', () => {
    const tree = createDemo(100)
    tree.families.F1.childIds.push('missing-person')
    expect(isTreeDocument(tree)).toBe(false)
    expect(isTreeDocument({ schemaVersion: 1, people: [], families: [] })).toBe(false)
  })
})

describe('edit history', () => {
  it('undoes and redoes edits without changing family structure or unrelated people', () => {
    const tree = createDemo(100)
    const person = tree.people.I0001
    const fields = { givenName: 'Новое имя', surname: person.surname, birthDate: 'ABT 1800', deathDate: '', note: 'Note' }
    let state = editorReducer({ tree, past: [], future: [] }, { type: 'edit', id: person.id, fields })
    expect(state.tree.people.I0001.birthDate).toBe('ABT 1800')
    expect(state.tree.families).toBe(tree.families)
    expect(state.tree.people.I0002).toBe(tree.people.I0002)
    state = editorReducer(state, { type: 'undo' })
    expect(state.tree.people.I0001).toEqual(person)
    state = editorReducer(state, { type: 'redo' })
    expect(state.tree.people.I0001.givenName).toBe('Новое имя')
    state = editorReducer(state, { type: 'undo' })
    state = editorReducer(state, { type: 'edit', id: person.id, fields: { ...fields, givenName: 'Другая правка' } })
    expect(state.future).toHaveLength(0)
    expect(editorReducer(state, { type: 'redo' })).toBe(state)
  })
})
