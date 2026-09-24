# Rodnye — family tree editor

Local-first browser GEDCOM editor. Goal: a complete genealogy of 2,000–3,000 people on one canvas, where any person is easy to find and edit. The user finds existing genealogy apps overloaded or slow — keep the UI simple.

Current state and next step: `docs/STATUS.md`. Roadmap: `docs/PLAN.md`. GEDCOM contract: `docs/GEDCOM_SUPPORT.md`.

## Commands

```sh
npm run dev                                  # Vite on http://127.0.0.1:5173
npm run build                                # tsc -b + vite build (the type check)
npm test                                     # Vitest, src/**/*.test.ts
npx vitest run src/gedcom                    # one folder
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e   # Playwright via installed Chrome; starts its own dev server
npx playwright test -g "3000"                # one e2e test by title
```

No linter or formatter is configured.

## Architecture

| Path | Role |
| --- | --- |
| `src/model/` | `TreeDocument` (people/families projection), search, relatives, demo generator, undo reducer |
| `src/gedcom/` | Line-tree parser, source-patching exporter, Worker + client |
| `src/layout/` | Dagre layout, run in a Worker; family junction nodes |
| `src/components/` | `TreeCanvas` (React Flow, LOD, minimap), `PersonPanel` (form, relatives) |
| `src/App.tsx` | Document lifecycle, workers, autosave, search, shell |
| `src/storage.ts` | IndexedDB draft (`idb-keyval`), JSON backup, draft validation |
| `tests/` | Playwright workflows; `tests/fixtures/*.ged` are synthetic |

Export works by diffing: `exportGedcom` reimports the original `tree.gedcom.text`, compares that baseline projection with the current people, and patches only changed lines. It deliberately throws on structural changes (added/removed people, family edits, SEX). Do not remove those guards without implementing source-preserving structural export.

## Invariants

- **Graph, not tree.** A person can be in several families; shared ancestors and repeated marriages are valid. Ancestry cycles are rejected on import.
- **Model ≠ renderer.** People/families never hold coordinates or React Flow objects. Positions live in a separate `Positions` map.
- **One canvas.** Every person must be reachable without collapsing or hiding branches.
- **Workers.** GEDCOM parsing/export and layout run in Web Workers. Text edits must not trigger relayout — layout depends only on `tree.id` and `tree.families`.
- **GEDCOM preservation.** Keep unknown tags, extra names/events, citations, and original values. Unchanged input must export byte-identical. Before changing GEDCOM behavior, read `docs/GEDCOM_SUPPORT.md`, add a fixture, and add an exact-output test. Never call export "lossless" beyond what fixtures prove.
- **Transactional replace.** Imports/restores validate fully before replacing the current document, and never discard unapplied form edits without confirmation.
- **Privacy.** No network calls with genealogy data, no telemetry, no remote fonts/assets. No server, accounts, or collaboration unless the user asks.

## Conventions

- UI text in Russian; code, comments, docs, and commit messages in English.
- Existing code is written in dense one-line style. Match it when editing nearby, but don't compress new logic to the point of hurting readability.
- User-facing errors are Russian `Error` messages thrown from model/gedcom code and shown via `notice`.

## Workflow

- After changes: `npm run build` and `npm test`. When UI behavior changes, also run the e2e suite.
- Performance: measure, don't assume. Record machine, browser, dataset, and method. Keep functional checks ("3,000 cards render") separate from FPS or latency claims.
- When a milestone is complete, update `docs/STATUS.md`: what was done, the checks you actually ran, limitations, and the exact next step.
- Do not commit, push, or deploy unless asked.
