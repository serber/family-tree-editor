import { useEffect, useMemo, useRef } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Combine, Crosshair, Link2, Plus, Trash2, Undo2, X } from 'lucide-react'
import { Field, DateInput, Segmented, TextInput } from './fields'
import { fatherNameFromPatronymic, patronymicFrom } from '../model/names'
import { fullName, initials, lifespan, parentageLabel, relativesOf, type Family, type Person, type PersonFields, type Sex, type TreeDocument, type TreeIndex } from '../model/tree'
import type { AddAction } from './TreeCanvas'

export type LinkKind = 'parent' | 'partner' | 'child' | 'sibling'

export interface InspectorProps {
  tree: TreeDocument
  index: TreeIndex
  person: Person
  focusRequest: { id: string; nonce: number } | null
  onFocusHandled: () => void
  canBack: boolean
  canForward: boolean
  onBack: () => void
  onForward: () => void
  onChange: (fields: Partial<PersonFields>, coalesceKey?: string) => void
  onCommit: () => void
  onFamilyChange: (familyId: string, fields: Partial<Pick<Family, 'marriageDate' | 'marriagePlace'>>, coalesceKey?: string) => void
  onAdd: (action: AddAction, familyId?: string) => void
  onLink: (kind: LinkKind, familyId?: string) => void
  onUnlink: (kind: LinkKind, otherId: string) => void
  onSelect: (id: string) => void
  onCenter: () => void
  onDelete: () => void
  onMerge: () => void
  onClose: () => void
  /** Review mode: when this person was verified (undefined = not yet); null when review mode is off. */
  review: { verifiedAt?: string } | null
  onVerify: (verified: boolean) => void
  onNextUnverified: () => void
  suggestions: { surnames: string[]; maleNames: string[]; femaleNames: string[]; places: string[] }
}

export function Inspector(props: InspectorProps) {
  const { tree, index, person, onChange, onCommit, onAdd, onLink, onUnlink, onSelect } = props
  const relatives = useMemo(() => relativesOf(tree, person.id, index), [tree, person.id, index])
  const givenRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const version = tree.gedcom.version

  useEffect(() => {
    if (props.focusRequest?.id !== person.id) return
    givenRef.current?.focus()
    givenRef.current?.select()
    props.onFocusHandled()
  }, [props.focusRequest, person.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const father = relatives.parents.map((id) => tree.people[id]).find((parent) => parent.sex === 'M')
  const suggestedPatronymic = father?.givenName && !person.patronymic ? patronymicFrom(father.givenName, person.sex) : ''
  const text = (key: keyof PersonFields & string, placeholder?: string, list?: string) => <TextInput
    name={key} value={person[key] as string} placeholder={placeholder} list={list}
    onChange={(value) => onChange({ [key]: value }, key)} onCommit={onCommit} />
  const parentageText = parentageLabel(tree, person.id, index)
  const hasFather = relatives.parentFamilies.some((family) => family.partnerIds.some((id) => tree.people[id].sex === 'M') || family.partnerIds.length >= 2)
  const hasMother = relatives.parentFamilies.some((family) => family.partnerIds.some((id) => tree.people[id].sex === 'F') || family.partnerIds.length >= 2)
  const childLabel = (sex: Sex) => sex === 'M' ? 'Сын' : sex === 'F' ? 'Дочь' : 'Ребёнок'

  return <aside className="inspector" aria-label="Карточка человека">
    <div className="inspector-head">
      <div className={`avatar sex-${person.sex}`}>{initials(person)}</div>
      <div className="inspector-title">
        <h2>{fullName(person)}</h2>
        <p>{[lifespan(person), parentageText].filter(Boolean).join(' · ') || 'Нет сведений'}</p>
      </div>
      <div className="inspector-head-actions">
        <button className="icon-btn sm" onClick={props.onBack} disabled={!props.canBack} aria-label="Назад" title="Назад (Alt+←)"><ChevronLeft size={16} /></button>
        <button className="icon-btn sm" onClick={props.onForward} disabled={!props.canForward} aria-label="Вперёд" title="Вперёд (Alt+→)"><ChevronRight size={16} /></button>
        <button className="icon-btn sm" onClick={props.onCenter} aria-label="Показать на дереве" title="Показать на дереве (1)"><Crosshair size={16} /></button>
        <button className="icon-btn sm" onClick={props.onClose} aria-label="Закрыть карточку" title="Закрыть (Esc)"><X size={16} /></button>
      </div>
    </div>

    {props.review && (props.review.verifiedAt
      ? <div className="verify-bar ok">
        <span className="status"><span className="status-dot ok" />Проверен<small>{new Date(props.review.verifiedAt).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span>
        <button className="btn btn-ghost btn-sm" onClick={() => props.onVerify(false)} title="Снять отметку (Пробел)"><Undo2 size={14} />Снять</button>
        <button className="btn btn-secondary btn-sm" onClick={props.onNextUnverified} title="Перейти к ближайшему непроверенному родственнику">Следующий<ArrowRight size={14} /></button>
      </div>
      : <div className="verify-bar todo">
        <span className="status"><span className="status-dot todo" />Не проверен</span>
        <button className="btn btn-ok btn-sm" onClick={() => props.onVerify(true)} title="Отметить проверенным (Пробел)"><Check size={14} />Проверено</button>
      </div>)}

    <div className="inspector-body">
      <section className="section">
        <Field label="Фамилия">{text('surname', 'Фамилия', 'dl-surnames')}</Field>
        <div className="grid-2">
          <Field label="Имя"><TextInput ref={givenRef} name="givenName" value={person.givenName} placeholder="Имя" list={person.sex === 'F' ? 'dl-female' : 'dl-male'} onChange={(value) => onChange({ givenName: value }, 'givenName')} onCommit={onCommit} /></Field>
          <Field label="Отчество" extra={suggestedPatronymic && <button type="button" className="suggestion" onClick={(event) => { event.preventDefault(); onChange({ patronymic: suggestedPatronymic }, 'patronymic'); onCommit() }} title="Подставить отчество по имени отца">{suggestedPatronymic}?</button>}>
            {text('patronymic', 'Отчество')}
          </Field>
        </div>
        {(person.sex !== 'M' || person.birthSurname) && <Field label={person.sex === "M" ? "Фамилия при рождении" : "Девичья фамилия (урождённая)"}>{text('birthSurname', 'Если отличается', 'dl-surnames')}</Field>}
        <div className="field" style={{ marginTop: 10 }}>
          <span className="field-label">Пол</span>
          <Segmented label="Пол" value={person.sex} onChange={(sex) => { onChange({ sex }); onCommit() }}
            options={[{ value: 'M', label: 'Мужской', className: 'male' }, { value: 'F', label: 'Женский', className: 'female' }, { value: 'U', label: 'Неизвестно' }]} />
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Рождение</h3>
        <div className="grid-2">
          <Field label="Дата"><DateInput name="birthDate" value={person.birthDate} version={version} onCommit={(value) => { onChange({ birthDate: value }); onCommit() }} /></Field>
          <Field label="Место">{text('birthPlace', 'Город, село', 'dl-places')}</Field>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Смерть</h3>
        <div className="grid-2">
          <Field label="Дата"><DateInput name="deathDate" value={person.deathDate} version={version} placeholder="если известна" onCommit={(value) => { onChange({ deathDate: value }); onCommit() }} /></Field>
          <Field label="Место">{text('deathPlace', 'Город, село', 'dl-places')}</Field>
        </div>
      </section>

      <section className="section">
        <Field label="Заметка"><TextInput name="note" multiline value={person.note} placeholder="Профессия, где жил, откуда сведения…" onChange={(value) => onChange({ note: value }, 'note')} onCommit={onCommit} /></Field>
      </section>

      <section className="section">
        <h3 className="section-title">Родители</h3>
        <div className="relative-list">
          {relatives.parents.map((id) => <RelativeRow key={id} person={tree.people[id]} onSelect={onSelect} onRemove={() => onUnlink('parent', id)} removeLabel="Отвязать родителя" />)}
        </div>
        {!relatives.parents.length && <p className="muted">Родители не указаны{person.patronymic && fatherNameFromPatronymic(person.patronymic) ? ` — отец, вероятно, ${fatherNameFromPatronymic(person.patronymic)}` : ''}.</p>}
        <div className="add-row">
          {!hasFather && <button className="btn btn-secondary btn-sm" onClick={() => onAdd('father')}><Plus size={14} />Отец</button>}
          {!hasMother && <button className="btn btn-secondary btn-sm" onClick={() => onAdd('mother')}><Plus size={14} />Мать</button>}
          {!(hasFather && hasMother) && <button className="btn btn-ghost btn-sm" onClick={() => onLink('parent')}><Link2 size={14} />Выбрать из дерева</button>}
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Браки и дети</h3>
        {relatives.partnerFamilies.map((family) => {
          const partnerId = family.partnerIds.find((id) => id !== person.id)
          return <div className="family-card" key={family.id}>
            <div className="family-card-head"><span>{partnerId ? (person.sex === 'F' ? 'Муж' : person.sex === 'M' ? 'Жена' : 'Супруг(а)') : 'Второй родитель не указан'}</span></div>
            {partnerId ? <RelativeRow person={tree.people[partnerId]} onSelect={onSelect} onRemove={() => onUnlink('partner', partnerId)} removeLabel="Отвязать супруга" />
              : <div className="add-row" style={{ marginTop: 2 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => onAdd('partner', family.id)}><Plus size={14} />{person.sex === 'F' ? 'Муж' : person.sex === 'M' ? 'Жена' : 'Супруг(а)'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onLink('partner', family.id)}><Link2 size={14} />Выбрать из дерева</button>
              </div>}
            {partnerId && <div className="grid-2" style={{ marginTop: 6 }}>
              <Field label="Дата брака"><DateInput value={family.marriageDate} version={version} placeholder="напр. 1921" onCommit={(value) => { props.onFamilyChange(family.id, { marriageDate: value }); onCommit() }} /></Field>
              <Field label="Место брака"><TextInput value={family.marriagePlace} list="dl-places" placeholder="Город, село" onChange={(value) => props.onFamilyChange(family.id, { marriagePlace: value }, `${family.id}:marriagePlace`)} onCommit={onCommit} /></Field>
            </div>}
            <div className="children-label">Дети{family.childIds.length ? ` · ${family.childIds.length}` : ''}</div>
            <div className="relative-list">
              {family.childIds.map((id) => <RelativeRow key={id} person={tree.people[id]} subtitle={childLabel(tree.people[id].sex)} onSelect={onSelect} onRemove={() => onUnlink('child', id)} removeLabel="Отвязать ребёнка" />)}
            </div>
            <div className="add-row">
              <button className="btn btn-secondary btn-sm" onClick={() => onAdd('son', family.id)}><Plus size={14} />Сын</button>
              <button className="btn btn-secondary btn-sm" onClick={() => onAdd('daughter', family.id)}><Plus size={14} />Дочь</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onLink('child', family.id)}><Link2 size={14} />Выбрать из дерева</button>
            </div>
          </div>
        })}
        {!relatives.partnerFamilies.length && <p className="muted">Браки и дети не указаны.</p>}
        <div className="add-row">
          <button className="btn btn-secondary btn-sm" onClick={() => onAdd('partner')}><Plus size={14} />{relatives.partnerFamilies.length ? 'Ещё брак' : person.sex === 'F' ? 'Муж' : person.sex === 'M' ? 'Жена' : 'Супруг(а)'}</button>
          {!relatives.partnerFamilies.length && <>
            <button className="btn btn-secondary btn-sm" onClick={() => onAdd('son')}><Plus size={14} />Сын</button>
            <button className="btn btn-secondary btn-sm" onClick={() => onAdd('daughter')}><Plus size={14} />Дочь</button>
          </>}
          <button className="btn btn-ghost btn-sm" onClick={() => onLink('partner')}><Link2 size={14} />Супруг из дерева</button>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Братья и сёстры</h3>
        <div className="relative-list">
          {relatives.siblings.map((id) => <RelativeRow key={id} person={tree.people[id]} subtitle={tree.people[id].sex === 'M' ? 'Брат' : tree.people[id].sex === 'F' ? 'Сестра' : undefined} onSelect={onSelect} onRemove={() => onUnlink('sibling', id)} removeLabel="Отвязать" />)}
        </div>
        {!relatives.siblings.length && <p className="muted">Не указаны.</p>}
        <div className="add-row">
          <button className="btn btn-secondary btn-sm" onClick={() => onAdd('brother')}><Plus size={14} />Брат</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onAdd('sister')}><Plus size={14} />Сестра</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onLink('sibling')}><Link2 size={14} />Выбрать из дерева</button>
        </div>
      </section>

      <div className="danger-zone">
        <span className="meta-id">ID в GEDCOM: {person.id}</span>
        <span style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={props.onMerge} title="Если этот человек внесён в дерево дважды"><Combine size={14} />Объединить с дубликатом</button>
          <button className="btn btn-danger btn-sm" onClick={props.onDelete}><Trash2 size={14} />Удалить</button>
        </span>
      </div>
    </div>
  </aside>
}

function RelativeRow({ person, subtitle, onSelect, onRemove, removeLabel }: { person: Person; subtitle?: string; onSelect: (id: string) => void; onRemove: () => void; removeLabel: string }) {
  const years = lifespan(person)
  return <div className="relative-row">
    <button className="relative-main" onClick={() => onSelect(person.id)}>
      <span className={`avatar sm sex-${person.sex}`}>{initials(person)}</span>
      <span style={{ minWidth: 0 }}><strong>{fullName(person)}</strong><small>{[subtitle, years].filter(Boolean).join(' · ') || ' '}</small></span>
    </button>
    <button className="icon-btn sm" onClick={onRemove} aria-label={removeLabel} title={removeLabel}><X size={14} /></button>
  </div>
}
