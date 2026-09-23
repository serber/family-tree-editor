import { useMemo, useState } from 'react'
import { ArrowUpRight, Check, PencilLine, X } from 'lucide-react'
import { fullName, relativesOf, type Person, type PersonFields, type TreeDocument } from '../model/tree'

interface Props {
  person: Person
  tree: TreeDocument
  onSave: (fields: PersonFields) => void
  onSelect: (id: string) => void
  onClose: () => void
  onDirty: (dirty: boolean) => void
}

export function PersonPanel({ person, tree, onSave, onSelect, onClose, onDirty }: Props) {
  const [fields, setFields] = useState<PersonFields>({ givenName: person.givenName, surname: person.surname, birthDate: person.birthDate, deathDate: person.deathDate, note: person.note })
  const [saved, setSaved] = useState(false)
  const relatives = useMemo(() => relativesOf(tree, person.id), [tree, person.id])
  const dirty = Object.entries(fields).some(([key, value]) => value !== person[key as keyof PersonFields])
  function change(key: keyof PersonFields, value: string) {
    const next = { ...fields, [key]: value }
    setFields(next)
    setSaved(false)
    onDirty(Object.entries(next).some(([field, text]) => text !== person[field as keyof PersonFields]))
  }
  const groups = [ ['Родители', relatives.parents], ['Супруги', relatives.partners], ['Дети', relatives.children] ] as const
  return <aside className="person-panel" aria-label="Карточка человека">
    <div className="panel-heading"><span>КАРТОЧКА ЧЕЛОВЕКА</span><button className="icon-button" onClick={onClose} aria-label="Закрыть карточку"><X size={18} /></button></div>
    <div className={`profile-avatar sex-${person.sex}`}>{person.givenName.slice(0, 1)}{person.surname.slice(0, 1)}</div>
    <h2>{fullName(person)}</h2>
    <div className="profile-subtitle">{person.birthDate || 'Дата неизвестна'}{person.deathDate && ` — ${person.deathDate}`}<span>{person.id}</span></div>
    <div className="panel-section-title"><PencilLine size={15} />Основные сведения</div>
    {tree.gedcom && <p className="gedcom-field-note">Показаны первое имя, первые даты рождения и смерти и первая личная заметка. Остальные записи сохраняются при экспорте.</p>}
    <form onSubmit={(event) => { event.preventDefault(); onSave(fields); onDirty(false); setSaved(true) }}>
      <label>Имя<input value={fields.givenName} onChange={(event) => change('givenName', event.target.value)} maxLength={200} /></label>
      <label>Фамилия<input value={fields.surname} onChange={(event) => change('surname', event.target.value)} maxLength={200} /></label>
      <div className="date-fields">
        <label>Рождение<input value={fields.birthDate} onChange={(event) => change('birthDate', event.target.value)} placeholder={tree.gedcom ? 'ABT 1920' : 'Например, ок. 1920'} maxLength={120} /></label>
        <label>Смерть<input value={fields.deathDate} onChange={(event) => change('deathDate', event.target.value)} placeholder="Не указана" maxLength={120} /></label>
      </div>
      <label>Заметка<textarea value={fields.note} onChange={(event) => change('note', event.target.value)} rows={3} placeholder="История, которую хочется сохранить…" /></label>
      <button className="primary-button save-person" type="submit" disabled={!dirty}><Check size={16} />{saved && !dirty ? 'Изменения применены' : 'Применить изменения'}</button>
    </form>
    <div className="relatives-section">
      {groups.map(([label, ids]) => ids.length > 0 && <div className="relative-group" key={label}>
        <h3>{label}<span>{ids.length}</span></h3>
        {ids.map((id) => <button key={id} className="relative-button" onClick={() => onSelect(id)}><span>{fullName(tree.people[id])}</span><ArrowUpRight size={14} /></button>)}
      </div>)}
      {groups.every(([, ids]) => !ids.length) && <p className="muted">Родственные связи пока не указаны.</p>}
    </div>
  </aside>
}
