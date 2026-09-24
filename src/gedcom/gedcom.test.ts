import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importGedcomBytes, importGedcomText, parseGedcom } from './parser'
import { exportGedcom } from './serializer'

const fixture551 = readFileSync(new URL('../../tests/fixtures/family-551.ged', import.meta.url), 'utf8')
const fixture7 = readFileSync(new URL('../../tests/fixtures/family-7.ged', import.meta.url), 'utf8')
const bytes = (text: string) => new TextEncoder().encode(text).buffer

describe('source-preserving GEDCOM', () => {
  it.each([fixture551, fixture7, '\uFEFF' + fixture551.replaceAll('\n', '\r\n'), fixture7.replaceAll('\n', '\r').trimEnd()])('preserves an unchanged file byte-for-byte', (text) => {
    const tree = importGedcomBytes(bytes(text), 'fixture.ged')
    expect(exportGedcom(tree)).toBe(text)
    expect(new TextEncoder().encode(exportGedcom(tree))).toEqual(new TextEncoder().encode(text))
  })

  it('imports multiple marriages, adoption, names, and continuation text without discarding source data', () => {
    const tree = importGedcomText(fixture551)
    expect(Object.keys(tree.people)).toHaveLength(5)
    expect(Object.keys(tree.families)).toHaveLength(2)
    expect(tree.people.I1.givenName).toBe('John')
    expect(tree.people.I1.note).toBe('First line\nSecond line with me@example.com and more text\n\nLast line')
    expect(tree.gedcom?.text).toContain('2 PEDI adopted')
    expect(tree.gedcom?.warnings).toEqual([])
  })

  it('patches the first name and matching structured field while preserving every other line', () => {
    const tree = importGedcomText(fixture551)
    tree.people.I1.givenName = 'Albert'
    expect(exportGedcom(tree)).toBe(fixture551.replace('1 NAME Dr. John /Doe/ Jr.', '1 NAME Dr. Albert /Doe/ Jr.').replace('2 GIVN John', '2 GIVN Albert'))
    expect(importGedcomText(exportGedcom(tree)).people.I1.givenName).toBe('Albert')
  })

  it('patches a surname and birth date without modifying names, citations, or unsupported tags elsewhere', () => {
    const tree = importGedcomText(fixture7)
    tree.people.I1.surname = 'Орлов'
    tree.people.I1.birthDate = 'BET 1899 AND 1901'
    expect(exportGedcom(tree)).toBe(fixture7.replace('1 NAME Иван /Леснов/', '1 NAME Иван /Орлов/').replace('2 SURN Леснов', '2 SURN Орлов').replace('2 DATE ABT 1900', '2 DATE BET 1899 AND 1901'))
  })

  it.each([fixture551, fixture7])('rewrites note payload only, preserving note citations and shared records', (text) => {
    const tree = importGedcomText(text)
    const note = '@hello\n\nme@example.com\n' + 'Very long text with Кириллица and spaces. '.repeat(20)
    tree.people.I1.note = note
    const output = exportGedcom(tree)
    expect(importGedcomText(output).people.I1.note).toBe(note)
    expect(output).toContain('2 SOUR @S1@')
    const tail = text.slice(text.indexOf('0 @N1@'))
    expect(output).toContain(tail)
    if (tree.gedcom?.version === '5.5.1') {
      expect(output).toContain('2 CONC')
      for (const line of output.split('\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(255)
    } else {
      expect(output).toContain('1 NOTE @@hello')
      expect(output).not.toContain('2 CONC')
    }
  })

  it('adds missing supported structures and clears date values without erasing event facts or sources', () => {
    const tree = importGedcomText(fixture551)
    tree.people.I1.birthDate = ''
    tree.people.I1.deathDate = ''
    tree.people.I2.birthDate = '1902'
    tree.people.I2.note = 'New note'
    const output = exportGedcom(tree)
    const reimport = importGedcomText(output)
    expect(reimport.people.I1.birthDate).toBe('')
    expect(output).toContain('1 DEAT Y')
    expect(output).toContain('2 PLAC Lyon, France\n2 SOUR @S1@\n3 PAGE 42')
    expect(reimport.people.I2.birthDate).toBe('1902')
    expect(reimport.people.I2.note).toBe('New note')
  })

  it('keeps the original BOM and CRLF when editing', () => {
    const text = '\uFEFF' + fixture551.replaceAll('\n', '\r\n')
    const tree = importGedcomText(text)
    tree.people.I1.birthDate = '1901'
    expect(exportGedcom(tree)).toBe(text.replace('2 DATE ABT 1900', '2 DATE 1901'))
  })

  it('reports broken references without deleting them from the source', () => {
    const text = fixture7.replace('1 CHIL @I3@', '1 CHIL @MISSING@')
    const tree = importGedcomText(text)
    expect(tree.families.F1.childIds).toEqual([])
    expect(tree.gedcom?.warnings.length).toBeGreaterThan(0)
    expect(exportGedcom(tree)).toBe(text)
  })

  it('accepts shared ancestors and disconnected people without treating them as duplicate records', () => {
    const text = fixture7.replace('0 TRLR', '0 @F2@ FAM\n1 HUSB @I1@\n1 CHIL @I3@\n0 @I4@ INDI\n1 NAME Alone /Person/\n0 TRLR')
    const tree = importGedcomText(text)
    expect(Object.keys(tree.people)).toHaveLength(4)
    expect(tree.families.F2.childIds).toEqual(['I3'])
    expect(exportGedcom(tree)).toBe(text)
  })

  it('rejects duplicate IDs, invalid levels, ancestry cycles, and unsupported versions', () => {
    expect(() => importGedcomText(fixture7.replace('@I2@ INDI', '@I1@ INDI'))).toThrow('Повторяется')
    expect(() => parseGedcom(fixture7.replace('1 SEX M', '4 SEX M'))).toThrow('вложенность')
    expect(() => importGedcomText(fixture7.replace('1 CHIL @I3@', '1 CHIL @I1@'))).toThrow('цикл')
    expect(() => parseGedcom(fixture7.replace('2 VERS 7.0', '2 VERS 5.5'))).toThrow('не поддерживается')
  })

  it('rejects unsupported encodings and malformed UTF-8 before importing', () => {
    expect(() => importGedcomBytes(bytes(fixture551.replace('1 CHAR UTF-8', '1 CHAR ANSEL')), 'test.ged')).toThrow('ANSEL')
    expect(() => importGedcomBytes(new Uint8Array([0xff, 0xfe, 0]).buffer, 'test.ged')).toThrow('UTF-16')
    expect(() => importGedcomBytes(new Uint8Array([0x80]).buffer, 'test.ged')).toThrow('UTF-8')
  })

  it('refuses unsupported structural changes and ASCII-incompatible edits on export', () => {
    const tree = importGedcomText(fixture551.replace('1 CHAR UTF-8', '1 CHAR ASCII'))
    tree.people.I1.givenName = 'Иван'
    expect(() => exportGedcom(tree)).toThrow('ASCII')
    tree.people.I1.givenName = 'John'
    tree.families.F1.childIds = []
    expect(() => exportGedcom(tree)).toThrow('семейных связей')
  })

  it('replaces a structured given name only as a whole word in NAME', () => {
    const text = fixture7.replace('1 NAME Анна /Волкова/', '1 NAME Аннабелла Анна /Волкова/\n2 GIVN Анна')
    const tree = importGedcomText(text)
    tree.people.I2.givenName = 'Мария'
    expect(exportGedcom(tree)).toBe(text.replace('1 NAME Аннабелла Анна /Волкова/\n2 GIVN Анна', '1 NAME Аннабелла Мария /Волкова/\n2 GIVN Мария'))
  })

  it('refuses to rewrite a name when GIVN matches only part of a word or is ambiguous', () => {
    const partial = importGedcomText(fixture551.replace('2 GIVN John', '2 GIVN Jo'))
    partial.people.I1.givenName = 'Albert'
    expect(() => exportGedcom(partial)).toThrow('расходятся')
    const ambiguous = importGedcomText(fixture551.replace('1 NAME Dr. John /Doe/ Jr.', '1 NAME John John /Doe/ Jr.'))
    ambiguous.people.I1.givenName = 'Albert'
    expect(() => exportGedcom(ambiguous)).toThrow('расходятся')
  })

  it('never splits a 5.5.1 @@ escape or breaks next to a space in CONC lines', () => {
    const block = fixture551.slice(fixture551.indexOf('1 NOTE First line'), fixture551.indexOf('2 SOUR @S1@\n1 FAMS'))
    const tree = importGedcomText(fixture551)
    tree.people.I1.note = 'x'.repeat(234) + '@y'
    expect(exportGedcom(tree)).toBe(fixture551.replace(block, `1 NOTE ${'x'.repeat(234)}\n2 CONC @@y\n`))
    tree.people.I1.note = 'a'.repeat(234) + ' bc'
    expect(exportGedcom(tree)).toBe(fixture551.replace(block, `1 NOTE ${'a'.repeat(233)}\n2 CONC a bc\n`))
    expect(importGedcomText(exportGedcom(tree)).people.I1.note).toBe('a'.repeat(234) + ' bc')
  })

  it('refuses to rewrite inconsistent structured names instead of damaging their prefixes', () => {
    const tree = importGedcomText(fixture551.replace('2 GIVN John', '2 GIVN Unrelated'))
    tree.people.I1.givenName = 'Changed'
    expect(() => exportGedcom(tree)).toThrow('расходятся')
  })
})
