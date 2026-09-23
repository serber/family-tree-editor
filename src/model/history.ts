import type { Person, PersonFields, TreeDocument } from './tree'

interface Edit { before: Person; after: Person }
export interface EditorState { tree: TreeDocument; past: Edit[]; future: Edit[] }
export type EditorAction =
  | { type: 'replace'; tree: TreeDocument }
  | { type: 'edit'; id: string; fields: PersonFields }
  | { type: 'undo' }
  | { type: 'redo' }

function withPerson(tree: TreeDocument, person: Person): TreeDocument {
  return { ...tree, people: { ...tree.people, [person.id]: person } }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'replace') return { tree: action.tree, past: [], future: [] }
  if (action.type === 'edit') {
    const before = state.tree.people[action.id]
    if (!before) return state
    const after = { ...before, ...action.fields }
    if (Object.keys(action.fields).every((key) => before[key as keyof Person] === after[key as keyof Person])) return state
    return { tree: withPerson(state.tree, after), past: [...state.past.slice(-99), { before, after }], future: [] }
  }
  if (action.type === 'undo') {
    const edit = state.past.at(-1)
    return edit ? { tree: withPerson(state.tree, edit.before), past: state.past.slice(0, -1), future: [...state.future, edit] } : state
  }
  const edit = state.future.at(-1)
  return edit ? { tree: withPerson(state.tree, edit.after), past: [...state.past, edit], future: state.future.slice(0, -1) } : state
}
