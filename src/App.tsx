import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpRight, Check, ChevronRight, CircleHelp, GitFork, Leaf, LoaderCircle, Redo2, Search, ShieldCheck, Undo2, Users, X } from 'lucide-react'
import { TreeCanvas } from './components/TreeCanvas'
import { PersonPanel } from './components/PersonPanel'
import { createDemo } from './model/demo'
import { editorReducer } from './model/history'
import { fullName, searchPeople, type Positions } from './model/tree'
import { CARD_HEIGHT, CARD_WIDTH, familyNodeId } from './layout/geometry'
import type { LayoutResult } from './layout/layout'
import { downloadDraft, loadDraft, parseDraft, saveDraft, type Draft } from './storage'
import { readGedcom, writeGedcom } from './gedcom/client'

export default function App() {
  const [boot, setBoot] = useState<{ draft?: Draft; error?: string; ready: boolean }>({ ready: false })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    loadDraft().then((draft) => { if (active) setBoot({ ready: true, draft }) }).catch((error: unknown) => {
      if (active) setBoot({ ready: false, error: error instanceof Error ? error.message : 'Не удалось прочитать локальное хранилище.' })
    })
    return () => { active = false }
  }, [retry])
  if (boot.error) return <div className="startup-state"><ShieldCheck size={32} /><h1>Не удалось открыть черновик</h1><p>{boot.error}</p><p>Существующее сохранение не перезаписано. Проверьте доступ браузера к локальному хранилищу.</p><button className="primary-button" onClick={() => { setBoot({ ready: false }); setRetry((value) => value + 1) }}>Попробовать снова</button></div>
  if (!boot.ready) return <div className="startup-state"><LoaderCircle className="spin" /><p>Открываем родословную…</p></div>
  return <ReactFlowProvider><Editor initialDraft={boot.draft} /></ReactFlowProvider>
}

function Editor({ initialDraft }: { initialDraft?: Draft }) {
  const [state, dispatch] = useReducer(editorReducer, initialDraft, (draft) => ({ tree: draft?.tree ?? createDemo(100), past: [], future: [] }))
  const tree = state.tree
  const [positions, setPositions] = useState<Positions>(initialDraft?.positions ?? {})
  const [layoutState, setLayoutState] = useState<{ busy: boolean; durationMs?: number; error?: string }>({ busy: true })
  const [layoutAttempt, setLayoutAttempt] = useState(0)
  const restoredPositions = useRef(initialDraft?.positions)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [panelDirty, setPanelDirty] = useState(false)
  const [saveState, setSaveState] = useState<'pending' | 'saved' | 'error'>('pending')
  const [saveAttempt, setSaveAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [fileOperation, setFileOperation] = useState<'import' | 'export' | null>(null)
  const saveQueue = useRef(Promise.resolve())
  const fileInput = useRef<HTMLInputElement>(null)
  const gedcomInput = useRef<HTMLInputElement>(null)
  const { setCenter } = useReactFlow()
  const peopleCount = Object.keys(tree.people).length
  const familyCount = Object.keys(tree.families).length
  const results = useMemo(() => searchPeople(tree.people, query), [tree.people, query])
  const selectedPerson = selectedId ? tree.people[selectedId] : undefined

  useEffect(() => {
    const saved = restoredPositions.current
    const requiredIds = [...Object.keys(tree.people), ...Object.keys(tree.families).map(familyNodeId)]
    if (saved && requiredIds.every((id) => saved[id])) {
      setPositions(saved)
      setLayoutState({ busy: false })
      return
    }
    setLayoutState({ busy: true })
    const worker = new Worker(new URL('./layout/layout.worker.ts', import.meta.url), { type: 'module' })
    const timeout = setTimeout(() => {
      worker.terminate()
      setLayoutState({ busy: false, error: 'Раскладка заняла больше минуты. Попробуйте меньший демопример.' })
    }, 60_000)
    worker.onmessage = (event: MessageEvent<LayoutResult & { ok: boolean; error?: string }>) => {
      clearTimeout(timeout)
      if (event.data.ok) {
        setPositions(event.data.positions)
        setLayoutState({ busy: false, durationMs: event.data.durationMs })
      } else setLayoutState({ busy: false, error: event.data.error })
      worker.terminate()
    }
    worker.onerror = () => {
      clearTimeout(timeout)
      setLayoutState({ busy: false, error: 'Не удалось рассчитать расположение. Повторите попытку.' })
      worker.terminate()
    }
    worker.postMessage(tree)
    return () => { clearTimeout(timeout); worker.terminate() }
    // People fields may change independently; only family structure triggers layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.id, tree.families, layoutAttempt])

  useEffect(() => {
    if (layoutState.busy || layoutState.error) return
    let active = true
    setSaveState('pending')
    const timer = setTimeout(() => {
      // Serial writes ensure a slow earlier save cannot replace a newer document.
      saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveDraft(tree, positions))
      saveQueue.current.then(() => { if (active) setSaveState('saved') }).catch(() => { if (active) setSaveState('error') })
    }, 400)
    return () => { active = false; clearTimeout(timer) }
  }, [tree, positions, layoutState.busy, layoutState.error, saveAttempt])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (panelDirty || saveState !== 'saved' || fileOperation) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [panelDirty, saveState, fileOperation])

  const leavePanel = useCallback(() => {
    if (panelDirty && !window.confirm('В карточке есть неприменённые изменения. Отменить их?')) return false
    setPanelDirty(false)
    return true
  }, [panelDirty])

  const selectPerson = useCallback((id: string | null) => {
    if (id === selectedId || !leavePanel()) return
    setSelectedId(id)
  }, [leavePanel, selectedId])

  const focusPerson = useCallback((id: string) => {
    if (id !== selectedId && !leavePanel()) return
    setSelectedId(id)
    const position = positions[id]
    if (position) void setCenter(position.x + CARD_WIDTH / 2, position.y + CARD_HEIGHT / 2, { zoom: 1, duration: 350 })
  }, [positions, setCenter, selectedId, leavePanel])

  const movePerson = useCallback((id: string, point: { x: number; y: number }) => setPositions((previous) => ({ ...previous, [id]: point })), [])

  function switchDemo(count: number) {
    if (!window.confirm('Открыть новое демодерево? Текущий локальный черновик будет заменён. При необходимости сначала скачайте его копию.')) return
    if (!leavePanel()) return
    restoredPositions.current = undefined
    setSelectedId(null)
    setQuery('')
    setPositions({})
    setSaveState('pending')
    setLayoutState({ busy: true })
    dispatch({ type: 'replace', tree: createDemo(count) })
  }

  async function openBackup(file: File) {
    setFileOperation('import')
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Черновик слишком большой: максимум 100 МБ.')
      const draft = parseDraft(JSON.parse(await file.text()))
      if (!window.confirm('Открыть этот черновик вместо текущего? Сохраните копию текущего дерева, если она нужна.')) return
      if (!leavePanel()) return
      restoredPositions.current = draft.positions
      setSelectedId(null)
      setQuery('')
      setPositions(draft.positions)
      setSaveState('pending')
      setLayoutState({ busy: true })
      dispatch({ type: 'replace', tree: draft.tree })
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось открыть черновик.') }
    finally { setFileOperation(null) }
  }

  async function openGedcom(file: File) {
    setFileOperation('import')
    try {
      const imported = await readGedcom(file)
      if (!window.confirm(`Открыть «${file.name}» (${Object.keys(imported.people).length} человек) вместо текущего дерева? Текущий черновик будет заменён. При необходимости сначала скачайте его копию.`)) return
      if (!leavePanel()) return
      restoredPositions.current = undefined
      setSelectedId(null)
      setQuery('')
      setNotice('')
      setPositions({})
      setSaveState('pending')
      setLayoutState({ busy: true })
      dispatch({ type: 'replace', tree: imported })
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось открыть GEDCOM.') }
    finally { setFileOperation(null) }
  }

  async function exportFile() {
    if (panelDirty) { setNotice('Сначала примените изменения в карточке, затем сохраните GEDCOM.'); return }
    setFileOperation('export')
    try { await writeGedcom(tree) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось сохранить GEDCOM.') }
    finally { setFileOperation(null) }
  }

  return <div className="app-shell">
    <header className="app-header" inert={!!fileOperation}>
      <a className="brand" href="./" onClick={(event) => event.preventDefault()}><span className="brand-mark"><GitFork size={24} /></span><span>родные<span className="brand-dot">.</span></span></a>
      <div className="header-breadcrumb"><span>Моя родословная</span><ChevronRight size={14} /><strong>{tree.title}</strong><span className="demo-badge">Прототип</span></div>
      <div className={`save-status status-${saveState}`} role="status" data-testid="save-status">{saveState === 'saved' ? <Check size={14} /> : saveState === 'pending' ? <LoaderCircle size={14} className="spin" /> : <X size={14} />}<span>{saveState === 'saved' ? 'Сохранено на устройстве' : saveState === 'pending' ? 'Сохранение…' : 'Ошибка сохранения'}</span></div>
      <button className="icon-button help-button" onClick={() => setShowHelp(!showHelp)} aria-label="О приложении"><CircleHelp size={19} /></button>
    </header>

    <aside className="sidebar" inert={!!fileOperation}>
      <div className="workspace-label">ВАША ИСТОРИЯ</div>
      <div className="active-nav"><GitFork size={17} />Семейное дерево<span>{peopleCount.toLocaleString('ru')}</span></div>
      <div className="sidebar-heading"><h1>Люди</h1><span>{peopleCount.toLocaleString('ru')}</span></div>
      <div className="search-box"><Search size={17} /><input aria-label="Поиск человека" placeholder="Имя, фамилия или ID" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={14} /></button>}</div>
      <div className="people-list">
        {query.trim() ? <>
          <div className="list-caption">Найдено: {results.length}{results.length > 60 ? ' · первые 60' : ''}</div>
          {results.slice(0, 60).map((person) => <button className={`person-list-item ${selectedId === person.id ? 'active' : ''}`} key={person.id} onClick={() => focusPerson(person.id)} disabled={layoutState.busy}>
            <span className={`list-avatar sex-${person.sex}`}>{person.givenName.slice(0, 1)}</span><span><strong>{fullName(person)}</strong><small>{person.birthDate || 'Дата неизвестна'} · {person.id}</small></span><ArrowUpRight size={14} />
          </button>)}
          {!results.length && <p className="empty-search">Никого не нашли. Попробуйте другую часть имени или идентификатор, например I0001.</p>}
        </> : <>
          <div className="list-caption">Начало истории</div>
          {Object.values(tree.people).slice(0, 8).map((person) => <button key={person.id} className={`person-list-item ${selectedId === person.id ? 'active' : ''}`} onClick={() => focusPerson(person.id)} disabled={layoutState.busy}>
            <span className={`list-avatar sex-${person.sex}`}>{person.givenName.slice(0, 1)}</span><span><strong>{fullName(person)}</strong><small>{person.birthDate} · {person.id}</small></span>
          </button>)}
          <p className="sidebar-tip">Каждый человек — часть истории.<br />Найдите его по имени или выберите карточку на дереве.</p>
        </>}
      </div>
      <div className="demo-section">
        <label htmlFor="demo-size">Демонстрационное дерево</label>
        <select id="demo-size" value={tree.id.startsWith('demo-') ? peopleCount : ''} onChange={(event) => switchDemo(Number(event.target.value))}>
          {tree.id.startsWith('demo-') && ![100, 1000, 3000].includes(peopleCount) && <option value={peopleCount}>{peopleCount} человек</option>}
          {!tree.id.startsWith('demo-') && <option value="">Открытый черновик</option>}
          <option value={100}>100 человек</option><option value={1000}>1 000 человек</option><option value={3000}>3 000 человек</option>
        </select>
        <p>{tree.gedcom ? `Открыт GEDCOM ${tree.gedcom.version}. Выбор демо заменит текущий файл.` : 'Вымышленные люди. Можно свободно редактировать.'}</p>
      </div>
      <div className="local-note"><ShieldCheck size={16} /><span>Данные остаются в браузере</span></div>
    </aside>

    <main className="main-workspace" inert={!!fileOperation}>
      <div className="workspace-toolbar">
        <div className="toolbar-title"><Leaf size={17} /><strong>{tree.title}</strong></div>
        <div className="toolbar-actions">
          <button className="icon-button" aria-label="Отменить изменение" title="Отменить изменение" disabled={!state.past.length} onClick={() => { if (leavePanel()) dispatch({ type: 'undo' }) }}><Undo2 size={18} /></button>
          <button className="icon-button" aria-label="Повторить изменение" title="Повторить изменение" disabled={!state.future.length} onClick={() => { if (leavePanel()) dispatch({ type: 'redo' }) }}><Redo2 size={18} /></button>
          <span className="toolbar-divider" />
          <button className="text-button" onClick={() => gedcomInput.current?.click()}><ArrowUpFromLine size={16} /><span>Открыть GEDCOM</span></button>
          {tree.gedcom && <button className="text-button gedcom-export" onClick={() => void exportFile()}><ArrowDownToLine size={16} /><span>Сохранить GEDCOM</span></button>}
          <details className="backup-menu"><summary aria-label="Меню черновика">···</summary><div>
            <button className="text-button" onClick={() => fileInput.current?.click()} title="Открыть локальный черновик JSON"><ArrowUpFromLine size={16} /><span>Открыть черновик</span></button>
            <button className="text-button" onClick={() => downloadDraft(tree, positions)} title="Скачать черновик в JSON; только применённые изменения"><ArrowDownToLine size={16} /><span>Скачать копию</span></button>
          </div></details>
          <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void openBackup(file); event.target.value = '' }} />
          <input ref={gedcomInput} type="file" accept=".ged" data-testid="gedcom-input" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void openGedcom(file); event.target.value = '' }} />
        </div>
      </div>
      {(notice || saveState === 'error') && <div className="notice" role="alert"><span>{notice || 'Не удалось сохранить черновик. Скачайте копию, чтобы не потерять изменения.'}</span>{saveState === 'error' && <button onClick={() => setSaveAttempt((value) => value + 1)}>Повторить сохранение</button>}{notice && <button onClick={() => setNotice('')} aria-label="Закрыть сообщение"><X size={15} /></button>}</div>}
      {showHelp && <div className="help-note"><strong>Редактор родословной · прототип</strong><p>Открывайте GEDCOM 5.5.1 (UTF-8 или ASCII) и 7.0 (UTF-8), редактируйте карточки и сохраняйте .ged. Дополнительные имена, источники и неизвестные теги сохраняются в исходном файле. Добавление людей и правка родственных связей ещё в разработке.</p><p>Нажмите на человека, измените сведения и примените их. Кнопки со стрелками отменяют и повторяют правки. Автосохранение хранит один черновик в этом браузере; очистка данных сайта удалит его. Независимую JSON-копию с расположением карточек можно скачать через меню «···».</p></div>}
      {!!tree.gedcom?.warnings.length && <details className="import-warnings"><summary>Замечания к исходному GEDCOM: {tree.gedcom.warnings.length}{tree.gedcom.warnings.length === 100 ? '+' : ''}</summary><ul>{tree.gedcom.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      <div className="workspace-body">
        <section className="canvas-area" aria-label="Полотно родословной">
          {layoutState.busy ? <div className="canvas-loading"><LoaderCircle className="spin" size={28} /><h2>Размещаем семейную историю</h2><p>{peopleCount.toLocaleString('ru')} человек · рассчитываем связи и поколения</p></div> : layoutState.error ? <div className="canvas-loading"><h2>Не удалось построить дерево</h2><p role="alert">{layoutState.error}</p><button className="primary-button" onClick={() => setLayoutAttempt((value) => value + 1)}>Повторить</button></div> : <TreeCanvas key={`${tree.id}:${layoutAttempt}`} tree={tree} positions={positions} selectedId={selectedId} onSelect={selectPerson} onMove={movePerson} />}
        </section>
        {selectedPerson ? <PersonPanel key={`${selectedPerson.id}:${state.past.length}:${state.future.length}`} person={selectedPerson} tree={tree} onSave={(fields) => dispatch({ type: 'edit', id: selectedPerson.id, fields })} onSelect={focusPerson} onClose={() => selectPerson(null)} onDirty={setPanelDirty} /> : <aside className="overview-panel">
          <span className="eyebrow">СЕМЕЙНЫЕ СВЯЗИ</span><div className="overview-art"><GitFork size={54} strokeWidth={1.2} /></div>
          <h2>Большая история.<br />Каждый человек важен.</h2><p>Всё дерево перед вами. Приблизьте нужную ветвь и выберите человека, чтобы узнать или дополнить его историю.</p>
          <div className="tree-stats"><div><Users size={17} /><strong>{peopleCount.toLocaleString('ru')}</strong><span>человек</span></div><div><GitFork size={17} /><strong>{familyCount.toLocaleString('ru')}</strong><span>семей</span></div></div>
          <button className="primary-button" disabled={layoutState.busy || !!layoutState.error} onClick={() => focusPerson(Object.keys(tree.people)[0])}>К первой карточке<ArrowUpRight size={17} /></button>
          <div className="overview-footnote"><span className="live-dot" /><span>{tree.gedcom ? `GEDCOM ${tree.gedcom.version} · ${tree.gedcom.encoding}` : 'Работаем с демодеревом'}<br /><small>{tree.gedcom ? 'Исходные записи сохранены' : 'Можно открыть свой файл .ged'}</small></span></div>
        </aside>}
      </div>
      <footer className="workspace-footer"><span><span className="live-dot" />Локальный черновик</span><span data-testid="layout-time">{layoutState.busy ? 'Раскладка…' : layoutState.durationMs !== undefined ? `Раскладка: ${(layoutState.durationMs / 1000).toFixed(2)} с` : 'Расположение восстановлено'}<span className="footer-separator">·</span>{peopleCount.toLocaleString('ru')} человек</span></footer>
    </main>
    {fileOperation && <div className="file-operation" role="status" aria-live="polite"><LoaderCircle className="spin" size={28} /><strong>{fileOperation === 'import' ? 'Читаем файл…' : 'Готовим GEDCOM…'}</strong><span>Обрабатываем данные на вашем устройстве</span></div>}
  </div>
}
