import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import { fullName, initials, lifespan, parentageLabel, searchPeople, type Person, type TreeDocument, type TreeIndex } from '../model/tree'

export interface PaletteCommand { id: string; label: string; hint?: string; icon: ReactNode; run: () => void; keywords?: string }

interface Props {
  tree: TreeDocument
  index: TreeIndex
  title?: string
  placeholder?: string
  commands?: PaletteCommand[]
  /** Pick mode: only these people can be chosen; returns the chosen ID. */
  filter?: (person: Person) => boolean
  recentIds?: string[]
  onPick: (id: string) => void
  onClose: () => void
}

type Item = { kind: 'person'; person: Person } | { kind: 'command'; command: PaletteCommand }

export function CommandPalette({ tree, index, title, placeholder = 'Имя, фамилия, год или место…', commands = [], filter, recentIds = [], onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const people = query.trim()
      ? searchPeople(tree.people, query, 200).filter((person) => !filter || filter(person)).slice(0, 50)
      : recentIds.map((id) => tree.people[id]).filter((person): person is Person => !!person && (!filter || filter(person))).slice(0, 8)
    const normalized = query.trim().toLocaleLowerCase('ru')
    const matchingCommands = commands.filter((command) => !normalized || `${command.label} ${command.keywords ?? ''}`.toLocaleLowerCase('ru').includes(normalized))
    return [...people.map((person) => ({ kind: 'person' as const, person })), ...matchingCommands.map((command) => ({ kind: 'command' as const, command }))]
  }, [query, tree.people, filter, recentIds, commands])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (item: Item | undefined) => {
    if (!item) return
    if (item.kind === 'person') onPick(item.person.id)
    else { onClose(); item.command.run() }
  }
  const peopleCount = items.filter((item) => item.kind === 'person').length
  const firstCommand = items.findIndex((item) => item.kind === 'command')

  return <div className="overlay" onMouseDown={onClose}>
    <div className="palette" role="dialog" aria-label={title ?? 'Поиск'} onMouseDown={(event) => event.stopPropagation()}>
      {title && <div className="palette-title">{title}</div>}
      <div className="palette-input">
        <Search size={18} />
        <input autoFocus value={query} placeholder={placeholder} aria-label="Поиск" role="combobox" aria-expanded="true" aria-controls="palette-list"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(value + 1, items.length - 1)) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)) }
            else if (event.key === 'Enter') { event.preventDefault(); choose(items[active]) }
            else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
          }} />
      </div>
      <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
        {peopleCount > 0 && <div className="palette-group">{query.trim() ? `Люди · ${peopleCount}${peopleCount === 50 ? '+' : ''}` : 'Недавние'}</div>}
        {items.map((item, position) => <div key={item.kind === 'person' ? item.person.id : item.command.id}>
          {position === firstCommand && <div className="palette-group">Команды</div>}
          <button className="palette-item" role="option" data-index={position} aria-selected={position === active}
            onMouseMove={() => setActive(position)} onClick={() => choose(item)}>
            {item.kind === 'person' ? <>
              <span className={`avatar sm sex-${item.person.sex}`}>{initials(item.person)}</span>
              <span className="palette-item-text">
                <strong>{fullName(item.person)}</strong>
                <small>{[lifespan(item.person), parentageLabel(tree, item.person.id, index), item.person.birthPlace].filter(Boolean).join(' · ') || 'Нет сведений'}</small>
              </span>
            </> : <>
              <span className="icon">{item.command.icon}</span>
              <span className="palette-item-text"><strong>{item.command.label}</strong></span>
              {item.command.hint && <kbd>{item.command.hint}</kbd>}
            </>}
            {position === active && <CornerDownLeft size={14} color="var(--text-3)" />}
          </button>
        </div>)}
        {!items.length && <div className="palette-empty">{query.trim() ? 'Никого не нашли. Попробуйте часть фамилии, имени или год рождения.' : 'Начните вводить имя.'}</div>}
      </div>
      <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбор</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Esc</kbd> закрыть</span></div>
    </div>
  </div>
}
