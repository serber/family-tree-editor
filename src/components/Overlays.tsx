import { useEffect, useState, type ReactNode } from 'react'
import { FileUp, GitFork, History, LoaderCircle, ShieldCheck, Sparkles, UserPlus } from 'lucide-react'
import { listSnapshots, type Snapshot } from '../storage'

export interface ConfirmRequest { title: string; message: ReactNode; confirmLabel: string; danger?: boolean; resolve: (ok: boolean) => void }
export interface ChoiceRequest { title: string; message?: string; options: { id: string; label: string; detail?: string }[]; resolve: (id: string | null) => void }

export function ConfirmDialog({ request }: { request: ConfirmRequest }) {
  const close = (ok: boolean) => request.resolve(ok)
  return <div className="overlay" onMouseDown={() => close(false)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(false) } }}>
    <div className="dialog" role="alertdialog" aria-modal="true" aria-label={request.title} onMouseDown={(event) => event.stopPropagation()}>
      <h2>{request.title}</h2>
      <div>{typeof request.message === 'string' ? <p>{request.message}</p> : request.message}</div>
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={() => close(false)}>Отмена</button>
        <button className={`btn ${request.danger ? 'btn-secondary btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>{request.confirmLabel}</button>
      </div>
    </div>
  </div>
}

export function ChoiceDialog({ request }: { request: ChoiceRequest }) {
  return <div className="overlay" onMouseDown={() => request.resolve(null)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); request.resolve(null) } }}>
    <div className="dialog" role="dialog" aria-modal="true" aria-label={request.title} onMouseDown={(event) => event.stopPropagation()}>
      <h2>{request.title}</h2>
      {request.message && <p>{request.message}</p>}
      <div className="choice-list">
        {request.options.map((option, position) => <button key={option.id} autoFocus={position === 0} onClick={() => request.resolve(option.id)}>
          <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
        </button>)}
      </div>
      <div className="dialog-actions"><button className="btn btn-secondary" onClick={() => request.resolve(null)}>Отмена</button></div>
    </div>
  </div>
}

export interface ToastState { message: string; undo?: boolean; error?: boolean; nonce: number }

export function Toast({ toast, onUndo, onClose }: { toast: ToastState; onUndo: () => void; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.error ? 8000 : 5000)
    return () => clearTimeout(timer)
  }, [toast.nonce, toast.error, onClose])
  return <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>
    <span>{toast.message}</span>
    {toast.undo && <button onClick={() => { onUndo(); onClose() }}>Отменить</button>}
    <button onClick={onClose} aria-label="Закрыть уведомление">✕</button>
  </div>
}

const shortcuts: [string, string[]][] = [
  ['Поиск человека и команды', ['Ctrl', 'K']], ['Сохранить GEDCOM', ['Ctrl', 'S']],
  ['Отменить', ['Ctrl', 'Z']], ['Повторить', ['Ctrl', 'Shift', 'Z']],
  ['Добавить отца', ['О']], ['Добавить мать', ['М']],
  ['Добавить сына', ['С']], ['Добавить дочь', ['Д']],
  ['Добавить супруга', ['П']], ['Добавить брата / сестру', ['Б', '⇧Б']],
  ['Перейти к родителю / ребёнку', ['↑', '↓']], ['Соседняя карточка', ['←', '→']],
  ['Назад / вперёд по истории', ['Alt', '←', '→']], ['Редактировать имя', ['Enter']],
  ['Показать выбранного', ['1']], ['Всё дерево', ['0']],
  ['Удалить человека', ['Delete']], ['Снять выбор / закрыть', ['Esc']],
  ['Режим проверки: отметить / снять', ['Пробел']],
]

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return <div className="overlay" onMouseDown={onClose} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="dialog shortcuts" role="dialog" aria-label="Клавиши" onMouseDown={(event) => event.stopPropagation()}>
      <h2>Быстрая работа с клавиатуры</h2>
      <p>Буквы работают в любой раскладке, когда курсор не в поле ввода. Колесо мыши или тачпад двигает дерево, Ctrl + колесо или щипок — масштаб.</p>
      <div className="shortcut-grid">
        {shortcuts.map(([label, keys]) => <div key={label}><span>{label}</span><span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span></div>)}
      </div>
      <div className="dialog-actions"><button className="btn btn-primary" autoFocus onClick={onClose}>Понятно</button></div>
    </div>
  </div>
}

export function SnapshotsDialog({ onRestore, onClose }: { onRestore: (snapshot: Snapshot) => void; onClose: () => void }) {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)
  useEffect(() => { listSnapshots().then(setSnapshots).catch(() => setSnapshots([])) }, [])
  return <div className="overlay" onMouseDown={onClose} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="dialog" role="dialog" aria-label="Автосохранённые версии" onMouseDown={(event) => event.stopPropagation()}>
      <h2>Автосохранённые версии</h2>
      <p>Каждые 10 минут работы и перед заменой дерева сохраняется копия в этом браузере. Восстановление заменит текущее дерево (его копия тоже сохранится).</p>
      {!snapshots ? <LoaderCircle className="spin" /> : !snapshots.length ? <p className="muted">Версий пока нет.</p> :
        <div className="choice-list" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {snapshots.map((snapshot) => <button key={snapshot.savedAt} onClick={() => onRestore(snapshot)}>
            <History size={16} />
            <span><strong>{snapshot.title}</strong><small>{new Date(snapshot.savedAt).toLocaleString('ru')} · {snapshot.people.toLocaleString('ru')} чел.</small></span>
          </button>)}
        </div>}
      <div className="dialog-actions"><button className="btn btn-secondary" onClick={onClose}>Закрыть</button></div>
    </div>
  </div>
}

export function Welcome({ onNew, onOpen, onDemo }: { onNew: () => void; onOpen: () => void; onDemo: () => void }) {
  return <div className="welcome">
    <div className="welcome-card">
      <span className="brand"><span className="brand-mark"><GitFork size={16} /></span>Родные</span>
      <h1>Перенесите семейное дерево в цифру</h1>
      <p>Добавляйте людей прямо на дереве: родители, супруги, дети — в один клик или одной клавишей. Отчества, фамилии и даты подставляются сами, а результат сохраняется в GEDCOM, который понимают все генеалогические программы.</p>
      <div className="welcome-actions">
        <button className="welcome-option primary" onClick={onNew}><UserPlus size={22} /><span><strong>Начать новое дерево</strong><small>С себя или с самого старшего известного предка</small></span></button>
        <button className="welcome-option" onClick={onOpen}><FileUp size={22} /><span><strong>Открыть файл GEDCOM</strong><small>.ged из MyHeritage, Gramps, Ancestry, «Древа жизни» и др.</small></span></button>
        <button className="welcome-option" onClick={onDemo}><Sparkles size={22} /><span><strong>Посмотреть на примере</strong><small>Вымышленная семья из 100 человек</small></span></button>
      </div>
      <div className="welcome-foot"><ShieldCheck size={15} />Всё хранится только в этом браузере. Ничего не отправляется в интернет.</div>
    </div>
  </div>
}
