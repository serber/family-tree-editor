# Project status

Updated: 2026-09-24.

## Current milestone

Milestone 3 (complete editing workflows) is done, and the product was redesigned around the user's actual task: transcribing a tangled ~1,000-person paper tree into GEDCOM. Milestone 4 (layout and performance) is partly done. See `docs/PLAN.md`.

## Added 2026-09-24 (later): review mode and card colors

The user generated a ~1,000-person GEDCOM from a photo of the paper tree with an AI and needs to verify every person.
- «Режим проверки» (top bar): unchecked cards have a red border and «!», checked cards a green ✓; the zoomed-out view and the mini-map are colored the same way; progress «N из M» with a bar.
- Person panel review bar: «Проверено» / «Снять» and a separate «Следующий» (go to the nearest unchecked relative by family links). Marking never moves the selection — navigation stays under the user's control (user request). Shortcut: `Space` toggles the mark. Marks are undoable.
- Table: status dot and filter (all / unchecked / checked).
- Marks live in `TreeDocument.verified` (ID → time), saved with the draft/snapshots/backups, removed when a person is deleted or merged away, never exported to GEDCOM, and never trigger relayout.
- Cards are filled by sex (blue/pink/grey) in light and dark themes.
- Siblings are drawn left to right exactly in their recorded order (dagre order constraints between sibling blocks). Before, the layout reordered children in ~1–10% of families. The editor shows the data as is; a wrong order is fixed in the data. Tests: 100% on 100/1,000/3,000 demos and on married children. In randomly tangled stress graphs, siblings pushed to different generation rows by cross-generation marriages cannot be ordered on one line.
- The data-checks tab was renamed «Замечания» to avoid confusion with review mode. React Flow attribution is visible again (top-right), as its license terms request.
- Checks: `npm run build` passed; `npm test` 101 passed; e2e 11 tests passed twice in a row (`--repeat-each 2`, 22/22), including a review-mode test that verifies the GEDCOM export is unchanged by marks.

## Completed in this milestone

**Model and GEDCOM**
- Schema 2 document: patronymic, birth surname, sex, birth/death places, marriage date/place; every document has a GEDCOM source (new trees get a 5.5.1 skeleton); monotonic ID counters so deleted IDs are never reused. Schema-1 drafts are migrated.
- Pure structural operations (`src/model/ops.ts`): add father/mother/spouse/son/daughter/brother/sister, link existing people as parent/spouse/child/sibling, unlink, delete, merge duplicates, cycle prevention.
- Russian helpers: patronymic from father's name and back (exception table + ~120 common names), surname gender forms, genitive for «сын Ивана и Анны», Russian ↔ GEDCOM dates including qualifiers, ranges, periods, and Julian calendar.
- Structural GEDCOM export: new/deleted records, pointer cleanup, two-sided link reconciliation limited to changed relationships, new fields patched in place.
- Snapshot undo/redo (300 steps) with coalescing of typing into one step.
- Consistency checks: possible duplicates, death before birth, parent too young/old, birth after a parent's death, unrecognized dates, isolated people, no name, unknown sex.

**Interface**
- Welcome screen: new tree, open GEDCOM, demo.
- Canvas: couple-block layout (spouses always adjacent, marriage line with a junction, stepped lines to children), "+" buttons on the selected card, lineage highlighting with toggle, level of detail by zoom, minimap, view anchored on the selected card across relayouts, reveal/center/fit commands.
- Person panel: fields save as you type; date fields show the parsed result; patronymic suggestion; relatives grouped by parents, each marriage with its children, siblings; add/link/unlink everywhere; merge and delete with undo toast; back/forward navigation.
- Ctrl+K palette: ranked people search with parentage and places, commands, pick mode for linking and merging.
- Table view (virtualized, sortable, filter) and «Проверка» view (grouped issues, GEDCOM warnings, merge button for duplicates).
- Keyboard shortcuts independent of layout (physical keys of О/М/П/С/Д/Б), spatial arrow navigation, help dialog.
- Autosave to IndexedDB, `navigator.storage.persist()`, rolling snapshots (every 10 minutes and before replacement; 12 kept, 3 for sources over 2 MB), "not downloaded" status, confirmation only when undownloaded work would be replaced.
- Light and dark themes via CSS tokens; system fonts only.

## Verification (2026-09-24)

- `npm run build`: passed (strict TypeScript + production build). Vite warns that the main chunk is 524 kB (165 kB gzip).
- `npm test`: 100 tests passed in 4 files: model operations, merge, history, checks, migration, names/dates (with round trips), layout (spouse adjacency, no overlaps), GEDCOM preservation, and structural export with exact expected output. Includes a 1,000-person export → import round trip.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: 10 tests passed (11 after review mode); the full suite also passed 3 times in a row (`--repeat-each 3`, 30/30).
- Screenshots of the welcome screen, data entry, search, table, checks, 3,000-person tree, and dark theme were inspected.
- Measured (3,000-person demo, e2e test "loads 3,000 people…"): layout 355 ms in the Worker; 1.1–1.3 s from choosing the demo to a rendered canvas; keystroke-to-paint in the name field median 38 ms, max 53–57 ms; selecting a card 111–118 ms (Playwright click to panel update); search → reveal 520 ms, which includes a 350 ms pan animation. Layout benchmark in Node: 1,000 people 162 ms, 3,000 people 552 ms.
- Environment: macOS arm64, Node 24.14.1, headless Chrome 153, 1440×1000 viewport, Vite dev server, no CPU throttling. Synthetic data only; no FPS measurement.

Bugs found and fixed during this work: partners were placed ~1,200 px apart on average by plain dagre (fixed with couple blocks); viewport commands produced NaN transforms while the canvas was hidden behind another view (now deferred until visible); shortcuts stopped working when focus stayed on a hidden file input.

## Known limitations

- No real user GEDCOM file or real paper-tree transcription session has been tested. GEDCOM `5.5`, CP1251/ANSI, ANSEL, and UTF-16 are rejected.
- Only the projected fields are editable. Other events, sources, media, shared notes, and adoption details are preserved but not shown. Deleting or merging removes the deleted person's whole record, including such data.
- Very broad generations make the tree extremely wide (the 3,000 demo is ~300,000 px wide); the minimap is then nearly empty. Children are shown in recorded order, not sorted by birth date, and cannot yet be reordered in the UI.
- Pedigree collapse and cousin marriages are supported by the model, but the layout may draw long crossing lines.
- A person with three or more spouses: the third spouse is not adjacent, and that marriage line crosses a card.
- One working tree per browser. Snapshots live in the same browser storage as the draft.
- Undo history does not survive reload (the draft and snapshots do).
- JSON backup parsing runs on the main thread.
- Narrow screens: the panel overlays the canvas; no dedicated mobile layout.

## Next concrete step

Test with real data: the user's AI-generated GEDCOM (~1,000 people) from the paper-tree photo. Then:

1. Import it; record parse failures (encoding, version, malformed lines typical of AI output) and decide on CP1251/`5.5` support with fixtures.
2. Walk through part of it in review mode; note what slows verification (e.g. needing to see the photo side by side, per-field marks, comments on doubtful people).
3. Enter 50–100 people from the paper tree in a timed session; note every extra click or unclear step and fix the top issues.
4. Profile pan/zoom on a 1,000-person real tree and decide whether children ordering and generation-width reduction are needed.

## Resume

Read `CLAUDE.md`, then this file, then `git status` and `git log`. Continue from the next concrete step.
