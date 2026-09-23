import { createContext, memo, useCallback, useContext, useEffect, useMemo } from 'react'
import {
  Background, BackgroundVariant, Handle, MiniMap, Panel, Position, ReactFlow,
  useNodesState, useReactFlow, useStore,
  type Edge, type Node, type NodeProps, type ReactFlowState,
} from '@xyflow/react'
import { Focus, Minus, Plus } from 'lucide-react'
import { CARD_HEIGHT, CARD_WIDTH, familyNodeId } from '../layout/geometry'
import { fullName, type Person, type Positions, type TreeDocument } from '../model/tree'

type PersonNodeType = Node<{ person: Person }, 'person'>
type JunctionNodeType = Node<Record<string, never>, 'family'>
type TreeNode = PersonNodeType | JunctionNodeType
type Detail = 'overview' | 'compact' | 'full'
const DetailContext = createContext<Detail>('full')
const selectDetail = (state: ReactFlowState): Detail => state.transform[2] < 0.22 ? 'overview' : state.transform[2] < 0.55 ? 'compact' : 'full'
const selectZoom = (state: ReactFlowState) => Math.round(state.transform[2] * 100)

const PersonNode = memo(function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const detail = useContext(DetailContext)
  const person = data.person
  return (
    <div className={`person-card sex-${person.sex} detail-${detail} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      {detail !== 'overview' && <>
        {detail === 'full' && <span className="person-avatar">{person.givenName.slice(0, 1)}{person.surname.slice(0, 1)}</span>}
        <div className="person-copy">
          <div className="person-name">{person.givenName || 'Без имени'}<br /><strong>{person.surname}</strong></div>
          <div className="person-dates">{person.birthDate || '?'}{person.deathDate ? ` — ${person.deathDate}` : ' —'}</div>
        </div>
      </>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

const FamilyNode = memo(function FamilyNode() {
  return <div className="family-junction"><Handle type="target" position={Position.Top} /><Handle type="source" position={Position.Bottom} /></div>
})
const nodeTypes = { person: PersonNode, family: FamilyNode }
const edgeOptions = { type: 'smoothstep', selectable: false, focusable: false, interactionWidth: 0, style: { stroke: '#a7b6ad', strokeWidth: 1.4 } }
const miniColor = (node: Node) => node.type === 'family' ? '#b7c7be' : node.selected ? '#2a775b' : '#a2b7a9'
const fitOptions = { padding: 0.12, minZoom: 0.001, maxZoom: 1 }

function ViewControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const zoom = useStore(selectZoom)
  return <Panel position="bottom-center" className="canvas-controls">
    <button onClick={() => zoomOut({ duration: 180 })} aria-label="Уменьшить"><Minus size={17} /></button>
    <span>{zoom < 1 ? '<1' : zoom}%</span>
    <button onClick={() => zoomIn({ duration: 180 })} aria-label="Увеличить"><Plus size={17} /></button>
    <i />
    <button onClick={() => fitView({ ...fitOptions, duration: 300 })} className="fit-button"><Focus size={16} />Всё дерево</button>
  </Panel>
}

interface Props {
  tree: TreeDocument
  positions: Positions
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, point: { x: number; y: number }) => void
}

export function TreeCanvas({ tree, positions, selectedId, onSelect, onMove }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<TreeNode>([])
  const detail = useStore(selectDetail)

  useEffect(() => {
    setNodes((previous) => {
      const oldById = new Map(previous.map((node) => [node.id, node]))
      const next: TreeNode[] = Object.values(tree.people).map((person) => {
        const old = oldById.get(person.id) as PersonNodeType | undefined
        const position = positions[person.id] ?? { x: 0, y: 0 }
        const selected = person.id === selectedId
        if (old && old.data.person === person && old.selected === selected && old.position.x === position.x && old.position.y === position.y) return old
        return {
          id: person.id, type: 'person', position, data: { person }, selected,
          width: CARD_WIDTH, height: CARD_HEIGHT,
          ariaLabel: fullName(person),
        }
      })
      Object.values(tree.families).forEach((family) => {
        const id = familyNodeId(family.id)
        const old = oldById.get(id)
        const position = positions[id] ?? { x: 0, y: 0 }
        next.push(old ? { ...old, position } : { id, type: 'family', position, data: {}, width: 10, height: 10, selectable: false, draggable: false, focusable: false })
      })
      return next
    })
  }, [tree.people, tree.families, positions, selectedId, setNodes])

  const edges = useMemo<Edge[]>(() => Object.values(tree.families).flatMap((family) => {
    const junction = familyNodeId(family.id)
    return [
      ...family.partnerIds.map((id) => ({ id: `${family.id}:partner:${id}`, source: id, target: junction })),
      ...family.childIds.map((id) => ({ id: `${family.id}:child:${id}`, source: junction, target: id })),
    ]
  }), [tree.families])

  const handleSelect = useCallback((_event: unknown, node: TreeNode) => {
    if (node.type === 'person') onSelect(node.id)
  }, [onSelect])

  return <DetailContext.Provider value={detail}>
    <ReactFlow<TreeNode>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultEdgeOptions={edgeOptions}
      onNodesChange={onNodesChange} onNodeClick={handleSelect}
      onNodeDoubleClick={handleSelect}
      onNodeDragStop={(_event, node) => onMove(node.id, node.position)}
      onKeyDown={(event) => {
        const id = (event.target as HTMLElement).closest('.react-flow__node-person')?.getAttribute('data-id')
        if (event.key === 'Enter' && id) onSelect(id)
      }}
      onPaneClick={() => onSelect(null)}
      minZoom={0.001} maxZoom={2} fitView fitViewOptions={fitOptions}
      nodesConnectable={false} edgesReconnectable={false} edgesFocusable={false}
      deleteKeyCode={null} multiSelectionKeyCode={null} onlyRenderVisibleElements
      zoomOnDoubleClick={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd4cc" />
      <Panel position="top-left" className="canvas-caption"><span className="live-dot" />Всё дерево <span>·</span> {Object.keys(tree.people).length.toLocaleString('ru')} человек</Panel>
      <Panel position="bottom-left" className="canvas-hint">Перетаскивайте полотно · Колёсико для масштаба</Panel>
      <MiniMap nodeColor={miniColor} nodeStrokeWidth={0} maskColor="rgba(247, 249, 245, 0.75)" pannable zoomable ariaLabel="Мини-карта дерева" />
      <ViewControls />
    </ReactFlow>
  </DetailContext.Provider>
}
