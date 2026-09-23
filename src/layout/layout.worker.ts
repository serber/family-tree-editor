import { layoutTree } from './layout'
import type { TreeDocument } from '../model/tree'

self.onmessage = (event: MessageEvent<TreeDocument>) => {
  try {
    self.postMessage({ ok: true, ...layoutTree(event.data) })
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Не удалось разместить дерево.' })
  }
}
