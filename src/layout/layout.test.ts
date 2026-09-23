import { expect, it } from 'vitest'
import { createDemo } from '../model/demo'
import { layoutTree } from './layout'
import { CARD_HEIGHT, CARD_WIDTH, familyNodeId } from './geometry'

it('places every person and union, with parents above children and no overlapping person cards', () => {
  const tree = createDemo(100)
  const { positions } = layoutTree(tree)
  expect(Object.keys(positions)).toHaveLength(100 + Object.keys(tree.families).length)
  for (const family of Object.values(tree.families)) {
    for (const parent of family.partnerIds) expect(positions[parent].y + CARD_HEIGHT).toBeLessThan(positions[familyNodeId(family.id)].y)
    for (const child of family.childIds) expect(positions[familyNodeId(family.id)].y).toBeLessThan(positions[child].y)
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
