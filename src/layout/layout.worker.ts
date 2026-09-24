import { layoutTree, type LayoutInput } from './layout'

self.onmessage = (event: MessageEvent<{ requestId: number; input: LayoutInput }>) => {
  const { requestId, input } = event.data
  try {
    self.postMessage({ requestId, ok: true, ...layoutTree(input) })
  } catch (error) {
    self.postMessage({ requestId, ok: false, error: error instanceof Error ? error.message : 'Не удалось разместить дерево.' })
  }
}
