import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCheck, ChevronDown, CircleHelp, Download, FilePlus2, FileUp, GitFork, History, ListTree, LoaderCircle, Network, Redo2, Save, Search, Sparkles, Table2, Undo2, Upload } from 'lucide-react'
import type { DraftMeta } from '../storage'

export type View = 'tree' | 'table' | 'issues'

interface Props {
  title: string
  onTitleChange: (title: string) => void
  onTitleCommit: () => void
  view: View
  onView: (view: View) => void
  issueCount: number
  canUndo: boolean
  canRedo: boolean
  undoLabel?: string
  redoLabel?: string
  onUndo: () => void
  onRedo: () => void
  onSearch: () => void
  saveState: 'saved' | 'pending' | 'error'
  meta: DraftMeta
  onRetrySave: () => void
  onHelp: () => void
  review: { on: boolean; verified: number; total: number }
  onToggleReview: () => void
  file: {
    onNew: () => void
    onOpenGedcom: () => void
    onSaveGedcom: () => void
    onDownloadBackup: () => void
    onOpenBackup: () => void
    onSnapshots: () => void
    onDemo: (count: number) => void
  }
}

export function TopBar(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape) }
  }, [menuOpen])
  const item = (label: string, icon: React.ReactNode, action: () => void, hint?: string) =>
    <button role="menuitem" onClick={() => { setMenuOpen(false); action() }}>{icon}{label}{hint && <kbd>{hint}</kbd>}</button>
  const exportedAt = props.meta.exportedAt ? new Date(props.meta.exportedAt) : undefined

  return <header className="topbar">
    <span className="brand" title="Родные — редактор родословной"><span className="brand-mark"><GitFork size={15} /></span></span>
    <input className="title-input" value={props.title} aria-label="Название дерева" onChange={(event) => props.onTitleChange(event.target.value)} onBlur={props.onTitleCommit}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur() }} />
    <nav className="view-tabs" aria-label="Режим">
      <button aria-pressed={props.view === 'tree'} onClick={() => props.onView('tree')} title="Дерево"><Network size={15} /><span className="label">Дерево</span></button>
      <button aria-pressed={props.view === 'table'} onClick={() => props.onView('table')} title="Таблица"><Table2 size={15} /><span className="label">Таблица</span></button>
      <button aria-pressed={props.view === 'issues'} onClick={() => props.onView('issues')} title="Замечания: возможные ошибки в данных"><ListTree size={15} /><span className="label">Замечания</span>{props.issueCount > 0 && <span className="badge">{props.issueCount > 999 ? '999+' : props.issueCount}</span>}</button>
    </nav>
    <button className="review-toggle" aria-pressed={props.review.on} onClick={props.onToggleReview} title="Режим проверки: непроверенные люди подсвечены красным. Пробел — отметить выбранного проверенным или снять отметку.">
      <CheckCheck size={15} />
      {props.review.on ? <>
        <span data-testid="review-progress">{props.review.verified.toLocaleString('ru')} из {props.review.total.toLocaleString('ru')}</span>
        <span className="review-progress" aria-hidden="true"><span style={{ width: `${props.review.total ? props.review.verified / props.review.total * 100 : 0}%` }} /></span>
      </> : <span className="label">Режим проверки</span>}
    </button>
    <span className="spacer" />
    <button className="search-trigger" onClick={props.onSearch} aria-label="Найти человека"><Search size={15} /><span>Найти человека…</span><kbd>Ctrl K</kbd></button>
    <span className="toolbar-divider" />
    <button className="icon-btn" onClick={props.onUndo} disabled={!props.canUndo} aria-label="Отменить" title={props.undoLabel ? `Отменить: ${props.undoLabel} (Ctrl+Z)` : 'Отменить (Ctrl+Z)'}><Undo2 size={17} /></button>
    <button className="icon-btn" onClick={props.onRedo} disabled={!props.canRedo} aria-label="Повторить" title={props.redoLabel ? `Повторить: ${props.redoLabel} (Ctrl+Shift+Z)` : 'Повторить (Ctrl+Shift+Z)'}><Redo2 size={17} /></button>
    <span className="toolbar-divider" />
    {props.saveState === 'error'
      ? <button className="save-status error" data-testid="save-status" onClick={props.onRetrySave} title="Повторить сохранение"><AlertTriangle size={14} /><span>Ошибка сохранения — повторить</span></button>
      : <span className={`save-status ${props.saveState === 'saved' && props.meta.changedSinceExport ? 'unexported' : ''}`} data-testid="save-status" role="status"
        title={props.meta.changedSinceExport ? 'Изменения сохранены в браузере, но ещё не выгружены в файл. Сохраните GEDCOM (Ctrl+S), чтобы иметь копию вне браузера.' : exportedAt ? `Файл выгружен ${exportedAt.toLocaleString('ru')}` : ''}>
        {props.saveState === 'pending' ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}
        <span>{props.saveState === 'pending' ? 'Сохранение…' : props.meta.changedSinceExport ? 'Сохранено в браузере' : 'Сохранено и выгружено'}</span>
      </span>}
    <div className="menu-wrap" ref={menuRef}>
      <button className="btn btn-secondary" onClick={() => setMenuOpen(!menuOpen)} aria-haspopup="menu" aria-expanded={menuOpen}>Файл<ChevronDown size={14} /></button>
      {menuOpen && <div className="menu" role="menu">
        {item('Сохранить GEDCOM', <Save size={16} />, props.file.onSaveGedcom, 'Ctrl S')}
        {item('Открыть GEDCOM…', <FileUp size={16} />, props.file.onOpenGedcom)}
        {item('Новое дерево', <FilePlus2 size={16} />, props.file.onNew)}
        <hr />
        {item('Скачать резервную копию', <Download size={16} />, props.file.onDownloadBackup)}
        {item('Открыть резервную копию…', <Upload size={16} />, props.file.onOpenBackup)}
        {item('Автосохранённые версии…', <History size={16} />, props.file.onSnapshots)}
        <hr />
        <div className="menu-label">Примеры</div>
        {item('Демо: 100 человек', <Sparkles size={16} />, () => props.file.onDemo(100))}
        {item('Демо: 1 000 человек', <Sparkles size={16} />, () => props.file.onDemo(1000))}
        {item('Демо: 3 000 человек', <Sparkles size={16} />, () => props.file.onDemo(3000))}
        <hr />
        <div className="menu-note">Дерево автоматически сохраняется в этом браузере. Регулярно сохраняйте GEDCOM или резервную копию — это ваша копия вне браузера.</div>
      </div>}
    </div>
    <button className="icon-btn" onClick={props.onHelp} aria-label="Клавиши и справка" title="Клавиши и справка (?)"><CircleHelp size={18} /></button>
  </header>
}
