import type { Family, Person, TreeDocument } from './tree'

const maleNames = ['Александр', 'Михаил', 'Иван', 'Николай', 'Андрей', 'Алексей', 'Пётр', 'Сергей', 'Дмитрий', 'Виктор']
const femaleNames = ['Анна', 'Мария', 'Елена', 'Софья', 'Вера', 'Наталья', 'Ольга', 'Татьяна', 'Ирина', 'Екатерина']
const surnames = ['Леснов', 'Волков', 'Соколов', 'Морозов', 'Белов', 'Орлов', 'Лебедев', 'Тихонов', 'Романов', 'Зайцев']

export function createDemo(count = 100): TreeDocument {
  if (!Number.isInteger(count) || count < 2 || count > 3000) throw new Error('Размер демо: от 2 до 3 000 человек.')
  const people: Record<string, Person> = {}
  const families: Record<string, Family> = {}
  let personCount = 0
  let familyCount = 0
  function addPerson(generation: number, surnameIndex: number, sex?: 'M' | 'F'): string {
    const index = personCount++
    const actualSex = sex ?? (index % 2 === 0 ? 'M' : 'F')
    const id = `I${String(index + 1).padStart(4, '0')}`
    const year = 1800 + generation * 27 + index % 7
    people[id] = {
      id,
      givenName: (actualSex === 'M' ? maleNames : femaleNames)[Math.floor(index / 2) % 10],
      surname: surnames[surnameIndex % surnames.length] + (actualSex === 'F' ? 'а' : ''),
      birthDate: String(year),
      deathDate: year + 72 < 2026 ? String(year + 65 + index % 12) : '',
      note: index === 0 ? 'Вымышленная родословная для знакомства с редактором. Все люди и события созданы автоматически.' : '',
      sex: actualSex,
    }
    return id
  }
  const root = addPerson(0, 0, 'M')
  const queue = [{ id: root, generation: 0, surnameIndex: 0 }]
  for (let cursor = 0; cursor < queue.length && personCount < count; cursor++) {
    const current = queue[cursor]
    const marriages = cursor > 0 && cursor % 11 === 0 ? 2 : 1
    for (let marriage = 0; marriage < marriages && personCount < count; marriage++) {
      const spouse = addPerson(current.generation, cursor + marriage + 1, people[current.id].sex === 'M' ? 'F' : 'M')
      const family: Family = { id: `F${++familyCount}`, partnerIds: [current.id, spouse], childIds: [] }
      const childCount = marriage === 0 ? 2 + (cursor % 2) : 1
      for (let child = 0; child < childCount && personCount < count; child++) {
        const id = addPerson(current.generation + 1, current.surnameIndex)
        family.childIds.push(id)
        queue.push({ id, generation: current.generation + 1, surnameIndex: current.surnameIndex })
      }
      families[family.id] = family
    }
  }
  return { schemaVersion: 1, id: `demo-${count}`, title: 'Семья Лесновых', people, families }
}
