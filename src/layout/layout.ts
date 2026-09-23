import { graphlib, layout } from '@dagrejs/dagre'
import type { Positions, TreeDocument } from '../model/tree'
import { CARD_HEIGHT, CARD_WIDTH, familyNodeId } from './geometry'

export interface LayoutResult { positions: Positions; durationMs: number }

export function layoutTree(tree: TreeDocument): LayoutResult {
  const start = performance.now()
  const graph = new graphlib.Graph()
  graph.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 45, marginx: 40, marginy: 40, ranker: 'longest-path' })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const person of Object.values(tree.people)) graph.setNode(person.id, { width: CARD_WIDTH, height: CARD_HEIGHT })
  for (const family of Object.values(tree.families)) {
    const junction = familyNodeId(family.id)
    graph.setNode(junction, { width: 10, height: 10 })
    family.partnerIds.forEach((id) => graph.setEdge(id, junction))
    family.childIds.forEach((id) => graph.setEdge(junction, id))
  }
  layout(graph)
  const positions: Positions = {}
  graph.nodes().forEach((id) => {
    const node = graph.node(id)
    positions[id] = { x: node.x - node.width / 2, y: node.y - node.height / 2 }
  })
  return { positions, durationMs: performance.now() - start }
}
