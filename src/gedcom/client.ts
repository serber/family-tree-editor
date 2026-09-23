import type { TreeDocument } from '../model/tree'

type Request = { operation: 'import'; bytes: ArrayBuffer; fileName: string } | { operation: 'export'; tree: TreeDocument }

function runWorker<T>(request: Request): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./gedcom.worker.ts', import.meta.url), { type: 'module' })
    const cleanup = () => { clearTimeout(timer); worker.terminate() }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Обработка GEDCOM заняла больше минуты. Текущий черновик не изменён.')) }, 60_000)
    worker.onmessage = (event: MessageEvent<T & { ok: boolean; error?: string }>) => {
      cleanup()
      if (event.data.ok) resolve(event.data)
      else reject(new Error(event.data.error))
    }
    worker.onerror = () => { cleanup(); reject(new Error('Не удалось запустить обработку GEDCOM. Текущий черновик не изменён.')) }
    worker.postMessage(request, request.operation === 'import' ? [request.bytes] : [])
  })
}

export async function readGedcom(file: File): Promise<TreeDocument> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Максимальный размер GEDCOM — 20 МБ.')
  const result = await runWorker<{ tree: TreeDocument }>({ operation: 'import', bytes: await file.arrayBuffer(), fileName: file.name })
  return result.tree
}

export async function writeGedcom(tree: TreeDocument): Promise<void> {
  const result = await runWorker<{ text: string }>({ operation: 'export', tree })
  const url = URL.createObjectURL(new Blob([result.text], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = (tree.gedcom?.fileName ?? 'family.ged').replace(/\.ged$/i, '') + '-edited.ged'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
