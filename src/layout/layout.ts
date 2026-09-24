import { graphlib, layout } from '@dagrejs/dagre'
import type { Family, Positions, TreeDocument } from '../model/tree'
import { CARD_HEIGHT, CARD_WIDTH, JUNCTION_SIZE, familyNodeId } from './geometry'

/** Only structure is sent to the layout Worker: no names, dates, or GEDCOM source. */
export interface LayoutInput { personIds: string[]; families: Pick<Family, 'id' | 'partnerIds' | 'childIds'>[] }
export interface LayoutResult { positions: Positions; durationMs: number }

export const PARTNER_GAP = 28
const RANK_GAP = 44

export function layoutInput(tree: TreeDocument): LayoutInput {
  return {
    personIds: Object.keys(tree.people),
    families: Object.values(tree.families).map(({ id, partnerIds, childIds }) => ({ id, partnerIds, childIds })),
  }
}

/**
 * People connected by marriages form one horizontal block, ordered along the chain of unions
 * (a person with two spouses sits between them). Blocks are laid out in layers with dagre; each
 * union is a small junction node between its block and the children's blocks. Spouses are
 * therefore always adjacent, and shared ancestors or repeated marriages never duplicate a person.
 */
export function layoutTree(input: LayoutInput): LayoutResult {
  const start = performance.now()
  const blocks = buildBlocks(input)
  const blockOf = new Map<string, number>()
  blocks.forEach((members, index) => members.forEach((id) => blockOf.set(id, index)))

  const graph = new graphlib.Graph()
  graph.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: RANK_GAP, marginx: 40, marginy: 40, ranker: 'network-simplex' })
  graph.setDefaultEdgeLabel(() => ({}))
  blocks.forEach((members, index) => graph.setNode(`b${index}`, { width: blockWidth(members.length), height: CARD_HEIGHT }))
  for (const family of input.families) {
    const junction = familyNodeId(family.id)
    graph.setNode(junction, { width: JUNCTION_SIZE, height: JUNCTION_SIZE })
    const parentBlocks = new Set(family.partnerIds.map((id) => blockOf.get(id)!))
    parentBlocks.forEach((block) => graph.setEdge(`b${block}`, junction, { weight: 4, minlen: 1 }))
    const childBlocks = new Set(family.childIds.map((id) => blockOf.get(id)!))
    childBlocks.forEach((block) => { if (!parentBlocks.has(block)) graph.setEdge(junction, `b${block}`, { weight: 1, minlen: 1 }) })
  }
  // Siblings are drawn left to right in their recorded order (as entered / as in the GEDCOM file).
  const constraints: { left: string; right: string }[] = []
  for (const family of input.families) {
    const childBlocks = [...new Set(family.childIds.map((id) => blockOf.get(id)!))]
    for (let i = 1; i < childBlocks.length; i++) constraints.push({ left: `b${childBlocks[i - 1]}`, right: `b${childBlocks[i]}` })
  }
  layout(graph, { constraints })

  const positions: Positions = {}
  const place = (members: string[], node: { x: number; y: number }) => {
    const left = node.x - blockWidth(members.length) / 2
    members.forEach((id, offset) => { positions[id] = { x: left + offset * (CARD_WIDTH + PARTNER_GAP), y: node.y - CARD_HEIGHT / 2 } })
  }
  blocks.forEach((members, index) => place(members, graph.node(`b${index}`)))

  // A couple is drawn with each partner above their own parents when possible: swap two-person
  // blocks whose partners' parents lie in the opposite order.
  const parentX = new Map<string, number>()
  for (const family of input.families) {
    const junction = graph.node(familyNodeId(family.id))
    for (const id of family.childIds) parentX.set(id, junction.x)
  }
  blocks.forEach((members, index) => {
    if (members.length !== 2) return
    const [a, b] = members
    const ax = parentX.get(a)
    const bx = parentX.get(b)
    const centre = graph.node(`b${index}`).x
    const shouldSwap = ax !== undefined && bx !== undefined ? ax > bx : ax !== undefined ? ax > centre : bx !== undefined ? bx < centre : false
    if (shouldSwap) { members.reverse(); place(members, graph.node(`b${index}`)) }
  })

  // A couple's junction sits on the marriage line between the partners, at mid-card height;
  // a single parent's junction sits just below the card; a parentless sibling group keeps dagre's spot.
  for (const family of input.families) {
    const node = graph.node(familyNodeId(family.id))
    const partners = family.partnerIds.map((id) => positions[id])
    let x = node.x
    let y = node.y
    if (partners.length === 2) {
      x = (partners[0].x + partners[1].x) / 2 + CARD_WIDTH / 2
      y = partners[0].y + CARD_HEIGHT / 2
    } else if (partners.length === 1) {
      x = partners[0].x + CARD_WIDTH / 2
      y = partners[0].y + CARD_HEIGHT + 14
    }
    positions[familyNodeId(family.id)] = { x: x - JUNCTION_SIZE / 2, y: y - JUNCTION_SIZE / 2 }
  }
  return { positions, durationMs: performance.now() - start }
}

function blockWidth(size: number): number {
  return size * CARD_WIDTH + (size - 1) * PARTNER_GAP
}

/** Groups people connected by unions and orders each group along its chain of marriages. */
function buildBlocks(input: LayoutInput): string[][] {
  const partners = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    const list = partners.get(a)
    if (!list) partners.set(a, [b])
    else if (!list.includes(b)) list.push(b)
  }
  for (const family of input.families) {
    const [a, b] = family.partnerIds
    if (a && b) { link(a, b); link(b, a) }
  }
  const assigned = new Set<string>()
  const blocks: string[][] = []
  for (const id of input.personIds) {
    if (assigned.has(id)) continue
    // Collect the connected component, then walk it depth-first from an end of the chain.
    const component: string[] = []
    const stack = [id]
    const seen = new Set([id])
    while (stack.length) {
      const current = stack.pop()!
      component.push(current)
      for (const next of partners.get(current) ?? []) if (!seen.has(next)) { seen.add(next); stack.push(next) }
    }
    const startId = component.reduce((best, entry) => (partners.get(entry)?.length ?? 0) < (partners.get(best)?.length ?? 0) ? entry : best, component[0])
    const order: string[] = []
    const visited = new Set<string>()
    const walk = (current: string) => {
      visited.add(current)
      order.push(current)
      for (const next of partners.get(current) ?? []) if (!visited.has(next)) walk(next)
    }
    if (component.length > 2000) order.push(...component)
    else walk(startId)
    order.forEach((entry) => assigned.add(entry))
    blocks.push(order)
  }
  return blocks
}
