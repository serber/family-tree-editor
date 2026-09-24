import { expect, it } from 'vitest'
import { createDemo } from '../model/demo'
import { addChild, addPartner, addPerson } from '../model/ops'
import { layoutInput, layoutTree, PARTNER_GAP } from './layout'
import { CARD_HEIGHT, CARD_WIDTH, familyNodeId } from './geometry'

it('places every person and union, parents above children, spouses side by side, without overlaps', () => {
  const tree = createDemo(300)
  const { positions } = layoutTree(layoutInput(tree))
  expect(Object.keys(positions)).toHaveLength(300 + Object.keys(tree.families).length)
  for (const family of Object.values(tree.families)) {
    const junction = positions[familyNodeId(family.id)]
    for (const parent of family.partnerIds) expect(positions[parent].y).toBeLessThan(junction.y)
    for (const child of family.childIds) expect(junction.y).toBeLessThan(positions[child].y)
    if (family.partnerIds.length === 2) {
      const [a, b] = family.partnerIds.map((id) => positions[id])
      expect(a.y).toBe(b.y)
      expect(Math.abs(a.x - b.x)).toBe(CARD_WIDTH + PARTNER_GAP)
      // The junction lies on the marriage line in the gap between the two cards.
      expect(junction.y).toBeGreaterThan(a.y)
      expect(junction.y).toBeLessThan(a.y + CARD_HEIGHT)
      expect(junction.x).toBeGreaterThan(Math.min(a.x, b.x) + CARD_WIDTH - 1)
      expect(junction.x).toBeLessThan(Math.max(a.x, b.x))
    }
  }
  const cards = Object.keys(tree.people).map((id) => positions[id])
  for (let i = 0; i < cards.length; i++) {
    expect(Number.isFinite(cards[i].x) && Number.isFinite(cards[i].y)).toBe(true)
    for (let j = i + 1; j < cards.length; j++) {
      const overlap = Math.abs(cards[i].x - cards[j].x) < CARD_WIDTH && Math.abs(cards[i].y - cards[j].y) < CARD_HEIGHT
      expect(overlap).toBe(false)
    }
  }
})

it('puts a person with two spouses between them', () => {
  let result = addPerson(createDemo(2), { givenName: 'Центр' })
  const centre = result.personId!
  result = addPartner(result.tree, centre)
  const first = result.personId!
  result = addPartner(result.tree, centre)
  const second = result.personId!
  const { positions } = layoutTree(layoutInput(result.tree))
  const xs = [first, centre, second].map((id) => positions[id].x)
  expect(Math.min(xs[0], xs[2])).toBeLessThan(xs[1])
  expect(Math.max(xs[0], xs[2])).toBeGreaterThan(xs[1])
})

it.each([100, 1000, 3000])('draws siblings left to right in their recorded order (%i people)', (count) => {
  const tree = createDemo(count)
  const { positions } = layoutTree(layoutInput(tree))
  for (const family of Object.values(tree.families)) {
    const xs = family.childIds.map((id) => positions[id].x)
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  }
})

it('keeps the order in which children were added, including married children', () => {
  let result = addPerson(createDemo(2), { givenName: 'Отец', sex: 'M' })
  const father = result.personId!
  result = addPartner(result.tree, father)
  const children: string[] = []
  for (const sex of ['F', 'F', 'M', 'M'] as const) { result = addChild(result.tree, father, sex); children.push(result.personId!) }
  // Marry the first and last child so their blocks are wider and pulled by spouses.
  result = addPartner(result.tree, children[0])
  result = addPartner(result.tree, children[3])
  const { positions } = layoutTree(layoutInput(result.tree))
  const xs = children.map((id) => positions[id].x)
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
})
