import { importGedcomBytes } from './parser'
import { exportGedcom } from './serializer'
import type { TreeDocument } from '../model/tree'

type Request = { operation: 'import'; bytes: ArrayBuffer; fileName: string } | { operation: 'export'; tree: TreeDocument }

self.onmessage = (event: MessageEvent<Request>) => {
  try {
    self.postMessage(event.data.operation === 'import'
      ? { ok: true, tree: importGedcomBytes(event.data.bytes, event.data.fileName) }
      : { ok: true, text: exportGedcom(event.data.tree) })
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Не удалось обработать GEDCOM.' })
  }
}
