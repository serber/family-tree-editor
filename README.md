# Родные / Rodnye

A local-first family tree editor prototype. The target is a complete genealogy of up to 3,000 people on one editable canvas.

The UI is in Russian. Project documentation and agent instructions are in English.

**Current scope:** synthetic demo trees, JSON drafts, and source-preserving GEDCOM 5.5.1/7 import/export for supported fields. Person creation and relationship editing are planned, not implemented. See [GEDCOM support](docs/GEDCOM_SUPPORT.md) for exact limits.

## Run

Use Node.js 22.12+ (Node 24 LTS recommended) and npm. Dependencies are pinned by `package-lock.json`.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173`.

```sh
npm run build
npm run preview
npm test
```

For browser tests, install Playwright's Chromium once:

```sh
npx playwright install chromium
npm run test:e2e
```

An already installed Google Chrome can be used instead:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

The browser suite starts a local Vite server on port 5173. It tests editing, undo/redo, persistence, JSON backups, unsaved-form protection, all 3,000 people, and GEDCOM import → edit → export → reimport. It writes screenshots, failure traces, and a performance attachment to ignored test output directories. The large-tree check is a functional test, not a complete rendering benchmark.

## Use the prototype

- Open a `.ged` file with **Открыть GEDCOM**, or start with a demo. GEDCOM files are parsed locally in a Worker before the current document is replaced.
- For imported documents, use **Сохранить GEDCOM** to download the original file with supported applied edits. Unapplied form changes must be applied first.
- Choose a 100-, 1,000-, or 3,000-person synthetic tree in the left sidebar. Replacing the current draft requires confirmation.
- Search by name, surname, ID, or birth-date text. Search is case-insensitive and treats Russian е/ё equivalently.
- Select a card, edit its fields, and press **Применить изменения**. Unapplied form changes are protected when switching cards.
- Use the toolbar arrows to undo or redo applied person edits (up to 100 operations during the current session).
- Drag cards to adjust positions, or use **Всё дерево** to see the whole graph. Position changes are saved but are not part of undo history yet.
- Open the **···** menu to download a JSON backup with **Скачать копию** or restore it with **Открыть черновик**. Backups include applied edits, original GEDCOM source, and positions, not unapplied form changes. JSON restore accepts files up to 100 MiB.

One draft is autosaved in IndexedDB for this browser origin. Switching demos replaces it after confirmation. Clearing site data removes the saved draft. A JSON download is an independent backup. No genealogy data is sent to a server; no remote fonts, analytics, or external assets are loaded.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/model/` | Person/family projection, deterministic demo data, search, relationships, undo/redo |
| `src/gedcom/` | Source-preserving parser, minimal export patches, import/export Worker |
| `src/layout/` | Dagre layout in a module Worker; people connect through explicit family junctions |
| `src/components/TreeCanvas.tsx` | React Flow integration, level of detail, minimap, canvas controls |
| `src/components/PersonPanel.tsx` | Person form and relative navigation |
| `src/App.tsx` | Document lifecycle, worker orchestration, autosave, search, app shell |
| `src/storage.ts` | Validated versioned drafts, IndexedDB, JSON backups |
| `tests/` | Playwright user workflows and 3,000-person smoke test |

The model is intentionally independent of the renderer. It is an editable projection, **not** a complete GEDCOM model. Imported documents retain the entire original source alongside it; export patches only supported changed fields. Do not discard GEDCOM records that the UI cannot display. The source-preservation contract, encoding limits, and known unsupported cases are documented in [GEDCOM support](docs/GEDCOM_SUPPORT.md).

Dagre provides the initial layered layout. It does not yet guarantee genealogy-specific spouse adjacency or optimized routing for every family structure. An explicit family node represents each union, including repeated marriages.

## Continue development

See [the implementation plan](docs/PLAN.md) and [the current status](docs/STATUS.md). Agent instructions are in [CLAUDE.md](CLAUDE.md); `AGENTS.md` points there.
