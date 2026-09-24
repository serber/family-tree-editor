# Родные / Rodnye

A local-first family tree editor for entering and editing large genealogies (up to ~3,000 people) on one canvas and saving them as GEDCOM. It is built for transcribing a paper family tree: relatives are added directly on the tree, Russian patronymics, surname forms, and dates are filled in automatically, and consistency checks catch transcription mistakes.

The UI is in Russian. Documentation and agent instructions are in English. All data stays in the browser; nothing is uploaded.

## Run

Use Node.js 22.12+ (Node 24 LTS recommended) and npm. Dependencies are pinned by `package-lock.json`.

```sh
npm ci
npm run dev        # http://127.0.0.1:5173
npm run build
npm test
```

Browser tests use Playwright's Chromium (`npx playwright install chromium`) or an installed Chrome:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

The suite starts a local Vite server on port 5173. It covers entering a family from scratch, keyboard shortcuts, undo/redo, reload persistence, linking and merging people, review mode, backups and automatic versions, a 3,000-person tree with timing measurements, and GEDCOM import → edit → export → reimport.

## Using the editor

**Starting.** Start a new tree, open a `.ged` file, or try a 100-person fictional demo. GEDCOM files are parsed in a Worker; the current tree is replaced only after the file is validated.

**Adding people.** Select a card: buttons around it add a father, mother, brother, sister, son, daughter, or spouse. The new person is selected and the name field is focused. Suggestions are filled in from relatives:
- a child gets the father's surname in the right gender form (Иванов → Иванова) and a patronymic from his name (Пётр → Петрович/Петровна);
- a father's given name is guessed from the child's patronymic;
- a wife gets the husband's surname; «урождённая» is a separate field.

**Connecting branches.** «Выбрать из дерева» links someone who is already in the tree as a parent, spouse, child, or sibling, so branches entered separately can meet. Links that would make someone their own ancestor are refused. «Объединить с дубликатом» merges a person entered twice.

**Dates** are typed in Russian: `1900`, `ок. 1900`, `12.03.1900`, `март 1900`, `до 1917`, `после 1945`, `между 1890 и 1895`, `1890–1895`, `5 мая 1880 ст. ст.`. The field shows how the input was understood and stores a valid GEDCOM date.

**Navigating.** `Ctrl+K` searches by name, year, or place and shows parentage («сын Петра и Анны») to tell namesakes apart. Arrow keys move to parents, children, and neighbours; `Alt+←/→` goes back and forward. The selected person's ancestors and descendants are highlighted («Линия»). The layout keeps spouses side by side and keeps the selected card in place when the tree is rearranged. «Таблица» lists everyone; «Замечания» lists likely mistakes (possible duplicates, impossible dates, people without links, unrecognized dates, GEDCOM warnings).

**Verifying a tree.** For a tree that came from another source (for example, a GEDCOM produced by AI from a photo of a paper tree), turn on «Режим проверки». Unchecked people get a red border, checked ones a green ✓, and the mini-map shows progress in the same colors. `Space` marks the selected person as checked (or unmarks). Marking never moves the selection; «Следующий» in the panel goes to the nearest unchecked relative when you want it. The top bar shows «N из M»; the table can filter unchecked people. Marks are saved with the draft and backups but are not written to GEDCOM.

**Keyboard** (press `?` for the full list; letters work in any layout): О father, М mother, П spouse, С son, Д daughter, Б brother, Shift+Б sister, Enter edit, Delete remove, Esc deselect, 0 whole tree, 1 center selected, Ctrl+Z / Ctrl+Shift+Z undo/redo, Ctrl+S save GEDCOM.

**Saving.** Every change is saved automatically in the browser (IndexedDB). The browser is asked to keep this storage persistent, and a snapshot is taken every 10 minutes of work and before a tree is replaced («Файл → Автосохранённые версии»). This is not a backup outside the browser: use **Ctrl+S** (GEDCOM) or «Скачать резервную копию» (JSON) regularly. The status in the top bar shows when there are changes that have not been downloaded.

**GEDCOM.** New trees are saved as GEDCOM 5.5.1 UTF-8. For imported files, only what you changed is rewritten; unknown tags, sources, and other records are kept. See [GEDCOM support](docs/GEDCOM_SUPPORT.md) for exact guarantees and limits.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/model/` | Document schema, structural operations, Russian names and dates, undo history, consistency checks |
| `src/gedcom/` | Source-preserving parser and exporter, skeleton for new trees, import/export Worker |
| `src/layout/` | Couple-block layered layout (dagre) in a Worker |
| `src/components/` | Canvas, person panel, search palette, table and checks views, top bar, dialogs |
| `src/App.tsx` | Editor state, autosave, shortcuts, document lifecycle |
| `src/storage.ts` | IndexedDB draft and snapshots, downloads |
| `tests/` | Playwright workflows |

The model is independent of the renderer and is an editable projection, not a complete GEDCOM model. Imported documents keep the original source; export patches it.

## Continue development

See [the plan](docs/PLAN.md) and [the current status](docs/STATUS.md). Agent instructions are in [CLAUDE.md](CLAUDE.md); `AGENTS.md` points there.
