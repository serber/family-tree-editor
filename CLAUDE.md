# Rodnye — family tree editor

Local-first browser GEDCOM editor. Primary use case: the user is transcribing a tangled paper family tree of ~1,000 people into GEDCOM (partly via an AI-generated GEDCOM from a photo, which must then be verified person by person), so fast data entry, navigation in a large graph, and data safety come first. Target scale is 2,000–3,000 people on one canvas. Existing genealogy apps feel overloaded or slow to the user — keep the UI simple.

Current state and next step: `docs/STATUS.md`. Roadmap: `docs/PLAN.md`. GEDCOM contract: `docs/GEDCOM_SUPPORT.md`.

## Commands

```sh
npm run dev                                  # Vite on http://127.0.0.1:5173
npm run build                                # tsc -b + vite build (the type check)
npm test                                     # Vitest, src/**/*.test.ts
npx vitest run src/gedcom                    # one folder
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e   # Playwright via installed Chrome; starts its own dev server
PLAYWRIGHT_CHANNEL=chrome npx playwright test -g "3,000"   # one e2e test by title
```

No linter or formatter is configured.

## Architecture

| Path | Role |
| --- | --- |
| `src/model/tree.ts` | `TreeDocument` schema 2 (people/families projection + GEDCOM source + ID counters), relationship index, lineage, search, validation, v1 migration |
| `src/model/ops.ts` | Pure structural edits: add/link/unlink relatives, delete, merge duplicates, cycle checks, ID allocation, review marks and next-unverified traversal |
| `src/model/names.ts`, `dates.ts` | Russian patronymics, surname gender forms, genitive; Russian ↔ GEDCOM dates |
| `src/model/history.ts` | Snapshot undo/redo with coalescing of consecutive edits to one field |
| `src/model/issues.ts` | Consistency checks shown in «Замечания» (dates, duplicates, isolated people) |
| `src/gedcom/` | Line-tree parser, source-patching exporter (fields + structure), skeleton for new trees, Worker + client |
| `src/layout/` | Couple-block layout on dagre, in a Worker; family junction nodes |
| `src/components/` | `TreeCanvas` (React Flow, LOD, "+" actions), `Inspector` (person panel), `CommandPalette`, `Views` (table, checks), `TopBar`, `Overlays` (dialogs, toast, welcome) |
| `src/App.tsx` | Boot/welcome, editor state, autosave, keyboard shortcuts, document replacement |
| `src/hooks.ts` | `useLayout` (persistent Worker), `isTyping` |
| `src/storage.ts` | IndexedDB draft + rolling snapshots, persistent-storage request, downloads |
| `tests/` | Playwright workflows; `tests/fixtures/*.ged` are synthetic |

Export diffs the document against a re-import of `tree.gedcom.text` and patches only what changed: field payloads, link lines on both sides, removed records (plus pointers to them), and new records before `TRLR`. New trees start from a generated 5.5.1 skeleton, so there is one export path.

## Invariants

- **Graph, not tree.** A person can be in several families; shared ancestors and repeated marriages are valid. Ancestry cycles are rejected on import and by every linking operation.
- **Model ≠ renderer.** People/families never hold coordinates or React Flow objects. Positions come from the layout Worker.
- **One canvas, automatic layout.** Every person is reachable without collapsing branches. There is no manual card dragging; spouses are always adjacent (couple blocks).
- **Workers.** GEDCOM parsing/export and layout run in Web Workers. Layout depends only on the structure key (person IDs + family links), never on names, dates, places, or titles.
- **GEDCOM preservation.** Keep unknown tags and unrelated records. Unchanged input must export byte-identical, and only changed relationships are reconciled. Before changing GEDCOM behavior, read `docs/GEDCOM_SUPPORT.md`, add a fixture, and add an exact-output test. Never call export "lossless" beyond what fixtures prove.
- **Review marks stay out of GEDCOM.** `TreeDocument.verified` lives in the draft, snapshots, and JSON backups only; it must not affect export or layout.
- **IDs never reused.** Allocate new IDs only through `idAllocator` (document counters), never from the current key set.
- **Safe replacement.** Imports/restores validate fully first; replacing a document with undownloaded changes asks for confirmation and always takes a snapshot.
- **Privacy.** No network calls with genealogy data, no telemetry, no remote fonts/assets. No server, accounts, or collaboration unless the user asks.

## Conventions

- UI text in Russian; code, comments, docs, and commit messages in English.
- Code is fairly dense (long single-line JSX and expressions). Match nearby style, but keep new logic readable.
- Model operations throw Russian `Error` messages; the UI shows them in a toast. Reversible destructive actions (delete, unlink, merge) use an undo toast instead of a confirmation.
- Name suggestions (patronymic, surname forms) are prefilled but always editable; never overwrite a value the user typed.
- The user stays in control of navigation: an action such as marking a person as checked must not move the selection by itself. Offer navigation as a separate explicit button. (Selecting a newly created relative is the one exception — it is the target of the action.)

## Workflow

- After changes: `npm run build` and `npm test`. When UI behavior changes, also run the e2e suite.
- Look at the result in a browser (Playwright screenshot or `/run`) for visual changes.
- Performance: measure, don't assume. The 3,000-person e2e test prints timings (layout, search, selection, keystroke latency). Record machine, browser, dataset, and method; keep functional checks separate from FPS claims.
- When a milestone is complete, update `docs/STATUS.md`: what was done, the checks you actually ran, limitations, and the exact next step.
- Do not commit, push, or deploy unless asked.
