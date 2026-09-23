import type { Person, TreeDocument } from '../model/tree'
import { child, importGedcomText, nameParts, parseGedcom, payload, pointer } from './parser'
import type { GedcomLine, ParsedGedcom } from './types'

const editableFields = ['givenName', 'surname', 'birthDate', 'deathDate', 'note'] as const
const encode = (value: string, version: ParsedGedcom['version']) => version === '5.5.1' ? value.replaceAll('@', '@@') : value.startsWith('@') ? '@' + value : value

/** Conservative UTF-8 line budget also fits the GEDCOM 5.5.1 255-character limit. */
function splitBytes(value: string, budget: number): string[] {
  const result: string[] = []
  let current = ''
  let bytes = 0
  const encoder = new TextEncoder()
  for (const character of value) {
    const size = encoder.encode(character).length
    if (bytes + size > budget) { result.push(current); current = ''; bytes = 0 }
    current += character
    bytes += size
  }
  result.push(current)
  return result
}

function renderPayload(level: number, tag: string, value: string, version: ParsedGedcom['version']): string[] {
  const result: string[] = []
  value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n').forEach((paragraph, index) => {
    const lineTag = index === 0 ? tag : 'CONT'
    const lineLevel = index === 0 ? level : level + 1
    const prefix = `${lineLevel} ${lineTag}`
    const escaped = encode(paragraph, version)
    const chunks = version === '5.5.1' ? splitBytes(escaped, 235) : [escaped]
    result.push(prefix + (chunks[0] ? ` ${chunks[0]}` : ''))
    chunks.slice(1).forEach((chunk) => result.push(`${level + 1} CONC ${chunk}`))
  })
  return result
}

export function exportGedcom(tree: TreeDocument): string {
  if (!tree.gedcom) throw new Error('Экспорт GEDCOM доступен для открытого .ged-файла. Демо можно сохранить как черновик JSON.')
  const source = tree.gedcom
  const baseline = importGedcomText(source.text, source.fileName)
  const parsed = parseGedcom(source.text)
  const originalIds = Object.keys(baseline.people)
  if (Object.keys(tree.people).length !== originalIds.length || originalIds.some((id) => !Object.hasOwn(tree.people, id))) throw new Error('Экспорт добавленных или удалённых людей ещё не реализован.')
  if (JSON.stringify(tree.families) !== JSON.stringify(baseline.families)) throw new Error('Экспорт изменений семейных связей ещё не реализован.')
  const replace = new Map<number, string[]>()
  const insert = new Map<number, string[]>()

  function append(parent: GedcomLine, newLines: string[]) {
    let index = parent.index + 1
    while (index < parsed.lines.length && parsed.lines[index].level > parent.level) index++
    insert.set(index, [...(insert.get(index) ?? []), ...newLines])
  }

  function update(node: GedcomLine, value: string) {
    const continuations = node.children.filter((line) => line.tag === 'CONT' || line.tag === 'CONC')
    if (continuations.some((line) => line.children.length > 0)) throw new Error(`Строка ${node.index + 1}: нестандартная вложенность продолжения текста. Это поле пока нельзя изменить без потери данных.`)
    for (const line of continuations) replace.set(line.index, [])
    const hasOtherChildren = node.children.some((line) => line.tag !== 'CONT' && line.tag !== 'CONC')
    replace.set(node.index, value || hasOtherChildren ? renderPayload(node.level, node.tag, value, parsed.version) : [])
  }

  function updateDate(record: GedcomLine, tag: 'BIRT' | 'DEAT', value: string) {
    const event = child(record, tag)
    const date = child(event, 'DATE')
    if (date) {
      update(date, value)
      if (!value && date.children.length === 0 && event!.children.length === 1 && !event!.value) replace.set(event!.index, [`${event!.level} ${tag} Y`])
    } else if (value && event) append(event, renderPayload(2, 'DATE', value, parsed.version))
    else if (value) append(record, [`1 ${tag}`, ...renderPayload(2, 'DATE', value, parsed.version)])
  }

  function updateName(record: GedcomLine, original: Person, current: Person) {
    const name = child(record, 'NAME')
    if (!name) {
      append(record, renderPayload(1, 'NAME', `${current.givenName} /${current.surname}/`.trim(), parsed.version))
      return
    }
    const rawName = payload(name, parsed.version)
    const slashCount = [...rawName].filter((character) => character === '/').length
    if (slashCount !== 0 && slashCount !== 2) throw new Error(`Имя @${record.xref}@ имеет нестандартные разделители. Его нельзя безопасно изменить в этой версии.`)
    const parts = nameParts(rawName)
    function substitute(text: string, before: string, after: string): string {
      if (before === after) return text
      if (!before) return text + after
      if (!text.includes(before)) throw new Error(`У @${record.xref}@ поля NAME и GIVN/SURN расходятся. Сначала исправьте их в исходной программе.`)
      return text.replace(before, () => after)
    }
    const given = substitute(parts.before, original.givenName, current.givenName)
    const surname = substitute(parts.surname, original.surname, current.surname)
    const nextName = parts.hasSlashes ? `${given}/${surname}/${parts.after}` : surname ? `${given.trimEnd()} /${surname}/` : given
    update(name, nextName || '//')
    for (const [tag, key] of [['GIVN', 'givenName'], ['SURN', 'surname']] as const) {
      const structured = child(name, tag)
      if (structured && original[key] !== current[key]) update(structured, current[key])
    }
  }

  for (const id of originalIds) {
    const original = baseline.people[id]
    const current = tree.people[id]
    if (current.sex !== original.sex) throw new Error('Экспорт изменения поля SEX пока не реализован.')
    const changed = editableFields.filter((key) => original[key] !== current[key])
    if (!changed.length) continue
    for (const key of changed) {
      const value = current[key]
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) throw new Error('Поле содержит недопустимые управляющие символы.')
      if (key !== 'note' && /[\r\n]/.test(value)) throw new Error('Имя и дата должны занимать одну строку.')
      if ((key === 'givenName' || key === 'surname') && value.includes('/')) throw new Error('Символ / зарезервирован в GEDCOM для границ фамилии.')
    }
    const record = parsed.recordsById.get(id)!
    if (changed.includes('givenName') || changed.includes('surname')) updateName(record, original, current)
    if (changed.includes('birthDate')) updateDate(record, 'BIRT', current.birthDate)
    if (changed.includes('deathDate')) updateDate(record, 'DEAT', current.deathDate)
    if (changed.includes('note')) {
      const note = record.children.find((line) => line.tag === 'NOTE' && !pointer(line.value))
      if (note) update(note, current.note)
      else if (current.note) append(record, renderPayload(1, 'NOTE', current.note, parsed.version))
    }
  }
  if (!replace.size && !insert.size) return source.text
  let output = parsed.bom
  for (const line of parsed.lines) {
    const added = insert.get(line.index)
    if (added) output += added.join(parsed.ending) + parsed.ending
    const replacement = replace.get(line.index)
    output += replacement ? replacement.length ? replacement.join(parsed.ending) + line.ending : '' : line.raw + line.ending
  }
  if (parsed.encoding === 'ASCII' && /[^\x00-\x7F]/.test(output.slice(parsed.bom.length))) throw new Error('Новые символы не помещаются в исходную кодировку ASCII. Откройте версию этого GEDCOM в UTF-8 или сохраните правки в JSON-черновик.')
  return output
}
