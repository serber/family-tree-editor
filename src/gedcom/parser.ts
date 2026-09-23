import type { Family, Person, TreeDocument } from '../model/tree'
import type { GedcomLine, ParsedGedcom } from './types'

export const child = (node: GedcomLine | undefined, tag: string): GedcomLine | undefined => node?.children.find((entry) => entry.tag === tag)
export const pointer = (value: string): string | undefined => /^@([^@\s]+)@$/.exec(value)?.[1]

export function payload(node: GedcomLine | undefined, version: ParsedGedcom['version']): string {
  if (!node) return ''
  const decode = (value: string) => version === '7.0' && value.startsWith('@@') ? value.slice(1) : value
  let result = decode(node.value)
  for (const line of node.children) {
    if (line.tag === 'CONT') result += '\n' + decode(line.value)
    if (line.tag === 'CONC') result += decode(line.value)
  }
  return version === '5.5.1' ? result.replaceAll('@@', '@') : result
}

export function parseGedcom(text: string): ParsedGedcom {
  if (text.includes('\u0000')) throw new Error('Файл содержит нулевые символы. UTF-16 пока не поддерживается; нужен GEDCOM в UTF-8.')
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : ''
  const body = bom ? text.slice(1) : text
  const physical = body.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter((line) => line.length > 0) ?? []
  const lines: GedcomLine[] = []
  const records: GedcomLine[] = []
  const recordsById = new Map<string, GedcomLine>()
  const stack: GedcomLine[] = []
  for (const [index, physicalLine] of physical.entries()) {
    const ending = /(?:\r\n|\r|\n)$/.exec(physicalLine)?.[0] ?? ''
    const raw = ending ? physicalLine.slice(0, -ending.length) : physicalLine
    const match = /^(\d+) (?:@([^@\s]+)@ )?([A-Za-z0-9_]+)(?: (.*))?$/.exec(raw)
    if (!match) throw new Error(`Строка ${index + 1}: не удалось прочитать структуру GEDCOM.`)
    const level = Number(match[1])
    if (level > 99 || (level > 0 && !stack[level - 1])) throw new Error(`Строка ${index + 1}: нарушена вложенность уровней GEDCOM.`)
    const node: GedcomLine = { index, raw, ending, level, xref: match[2], tag: match[3], value: match[4] ?? '', children: [] }
    if (level === 0) records.push(node)
    else {
      node.parent = stack[level - 1]
      node.parent.children.push(node)
    }
    stack.length = level
    stack.push(node)
    lines.push(node)
    if (node.xref) {
      if (level !== 0) throw new Error(`Строка ${index + 1}: идентификатор записи разрешён только на уровне 0.`)
      if (recordsById.has(node.xref)) throw new Error(`Повторяется идентификатор @${node.xref}@. Текущий черновик не изменён.`)
      recordsById.set(node.xref, node)
    }
  }
  if (records[0]?.tag !== 'HEAD' || records.at(-1)?.tag !== 'TRLR') throw new Error('GEDCOM должен начинаться с 0 HEAD и заканчиваться 0 TRLR.')
  if (records.filter((record) => record.tag === 'HEAD').length !== 1 || records.filter((record) => record.tag === 'TRLR').length !== 1) throw new Error('В файле повторяется заголовок или завершающая запись GEDCOM.')
  const declaredVersion = child(child(records[0], 'GEDC'), 'VERS')?.value
  const version = declaredVersion === '5.5.1' ? '5.5.1' : /^7\.0(?:\.\d+)?$/.test(declaredVersion ?? '') ? '7.0' : undefined
  if (!version) throw new Error(`Версия GEDCOM ${declaredVersion ?? 'не указана'} не поддерживается. Нужна 5.5.1 или 7.0.`)
  const charset = child(records[0], 'CHAR')?.value.toUpperCase()
  if (charset && charset !== 'UTF-8' && charset !== 'ASCII') throw new Error(`Кодировка ${charset} пока не поддерживается. Экспортируйте исходный файл в UTF-8.`)
  if (version === '5.5.1' && !charset) throw new Error('В GEDCOM 5.5.1 не указана кодировка CHAR. Укажите UTF-8 при экспорте из исходной программы.')
  if (version === '7.0' && charset === 'ASCII') throw new Error('GEDCOM 7 должен использовать UTF-8.')
  const encoding = charset === 'ASCII' ? 'ASCII' : 'UTF-8'
  if (encoding === 'ASCII' && /[^\x00-\x7F]/.test(body)) throw new Error('Файл объявлен как ASCII, но содержит символы вне ASCII. Проверьте его кодировку.')
  return { lines, records, recordsById, version, encoding, bom, ending: lines.find((line) => line.ending)?.ending ?? '\n' }
}

export function nameParts(value: string): { before: string; surname: string; after: string; hasSlashes: boolean } {
  const match = /^(.*?)\/([^/]*)\/(.*)$/s.exec(value)
  return match ? { before: match[1], surname: match[2], after: match[3], hasSlashes: true } : { before: value, surname: '', after: '', hasSlashes: false }
}

export function personFromRecord(record: GedcomLine, parsed: ParsedGedcom): Person {
  const name = child(record, 'NAME')
  const parts = nameParts(payload(name, parsed.version))
  const inlineNote = record.children.find((entry) => entry.tag === 'NOTE' && !pointer(entry.value))
  const sex = child(record, 'SEX')?.value
  return {
    id: record.xref!,
    givenName: child(name, 'GIVN') ? payload(child(name, 'GIVN'), parsed.version) : parts.before.trim(),
    surname: child(name, 'SURN') ? payload(child(name, 'SURN'), parsed.version) : parts.surname.trim(),
    birthDate: payload(child(child(record, 'BIRT'), 'DATE'), parsed.version),
    deathDate: payload(child(child(record, 'DEAT'), 'DATE'), parsed.version),
    note: payload(inlineNote, parsed.version),
    sex: sex === 'M' || sex === 'F' ? sex : 'U',
  }
}

function assertAcyclic(people: Record<string, Person>, families: Record<string, Family>) {
  const children = new Map(Object.keys(people).map((id) => [id, new Set<string>()]))
  const indegree = new Map(Object.keys(people).map((id) => [id, 0]))
  for (const family of Object.values(families)) for (const parent of family.partnerIds) for (const id of family.childIds) {
    const edges = children.get(parent)!
    if (!edges.has(id)) { edges.add(id); indegree.set(id, indegree.get(id)! + 1) }
  }
  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id)
  for (let cursor = 0; cursor < queue.length; cursor++) for (const id of children.get(queue[cursor])!) {
    indegree.set(id, indegree.get(id)! - 1)
    if (indegree.get(id) === 0) queue.push(id)
  }
  if (queue.length !== Object.keys(people).length) throw new Error('Обнаружен цикл родительства: человек оказывается собственным предком. Исправьте связи в исходном файле перед импортом.')
}

export function importGedcomText(text: string, fileName = 'family.ged'): TreeDocument {
  const parsed = parseGedcom(text)
  const people: Record<string, Person> = Object.create(null)
  const families: Record<string, Family> = Object.create(null)
  const warnings: string[] = []
  const warn = (message: string) => { if (warnings.length < 100) warnings.push(message) }
  for (const record of parsed.records) if (record.tag === 'INDI') {
    if (!record.xref) throw new Error(`Строка ${record.index + 1}: у человека нет идентификатора.`)
    people[record.xref] = personFromRecord(record, parsed)
  }
  if (!Object.keys(people).length) throw new Error('В файле нет записей людей INDI.')
  if (Object.keys(people).length > 3000) throw new Error('В этой версии можно открыть не более 3 000 человек.')
  for (const line of parsed.lines) {
    const target = pointer(line.value)
    if (target && target !== 'VOID' && !parsed.recordsById.has(target)) warn(`Строка ${line.index + 1}: ссылка @${target}@ не найдена; исходная строка сохранена.`)
  }
  for (const record of parsed.records) if (record.tag === 'FAM') {
    if (!record.xref) throw new Error(`Строка ${record.index + 1}: у семьи нет идентификатора.`)
    const resolvePeople = (tags: string[]) => [...new Set(record.children.filter((entry) => tags.includes(entry.tag)).flatMap((entry) => {
      const id = pointer(entry.value)
      if (id && people[id]) return [id]
      warn(`Семья @${record.xref}@: связь ${entry.tag} ${entry.value} не показана; исходная строка сохранена.`)
      return []
    }))]
    families[record.xref] = { id: record.xref, partnerIds: resolvePeople(['HUSB', 'WIFE']), childIds: resolvePeople(['CHIL']) }
    if (people[`family:${record.xref}`]) throw new Error('Идентификатор человека конфликтует со служебным узлом семьи; этот файл пока не поддерживается.')
  }
  for (const record of parsed.records) if (record.tag === 'INDI') {
    for (const entry of record.children.filter((node) => node.tag === 'FAMC' || node.tag === 'FAMS')) {
      const family = families[pointer(entry.value) ?? '']
      if (family && !(entry.tag === 'FAMC' ? family.childIds : family.partnerIds).includes(record.xref!)) warn(`@${record.xref}@: ${entry.tag} ${entry.value} не подтверждена записью семьи. Проверьте исходные связи.`)
    }
  }
  assertAcyclic(people, families)
  return {
    schemaVersion: 1,
    id: `gedcom-${crypto.randomUUID()}`,
    title: fileName.replace(/\.ged$/i, '') || 'Родословная',
    people, families,
    gedcom: { text, fileName, version: parsed.version, encoding: parsed.encoding, warnings },
  }
}

export function importGedcomBytes(bytes: ArrayBuffer, fileName: string): TreeDocument {
  const raw = new Uint8Array(bytes)
  if (raw.byteLength > 20 * 1024 * 1024) throw new Error('Максимальный размер GEDCOM — 20 МБ.')
  if ((raw[0] === 0xFF && raw[1] === 0xFE) || (raw[0] === 0xFE && raw[1] === 0xFF)) throw new Error('UTF-16 пока не поддерживается. Экспортируйте GEDCOM в UTF-8.')
  const preview = new TextDecoder('latin1').decode(raw.subarray(0, 16_384))
  const declared = /(?:^|[\r\n])1 CHAR ([^\r\n]+)/.exec(preview)?.[1].toUpperCase()
  if (declared && !['UTF-8', 'ASCII'].includes(declared)) throw new Error(`Кодировка ${declared} пока не поддерживается. Экспортируйте исходный файл в UTF-8.`)
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }
  catch { throw new Error('Файл не является корректным UTF-8. Другие кодировки пока не поддерживаются.') }
  return importGedcomText(text, fileName)
}
