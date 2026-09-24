# Project status

Updated: 2026-09-24.

## Current milestone

Milestones 1 and 2 are complete for the documented prototype scope. Next: milestone 3, relative creation and relationship editing. GEDCOM support is intentionally limited; see `docs/GEDCOM_SUPPORT.md`.

## Completed

- React + TypeScript + Vite scaffold, React Flow canvas, Russian UI.
- Renderer-independent people/family model; deterministic 100/1,000/3,000-person demos with repeated marriages.
- Dagre layout in a Worker; family junctions, pan/zoom, minimap, fit-all, and zoom-dependent card detail.
- Person search, focus navigation, card editing, relative navigation, and 100-operation undo/redo.
- IndexedDB autosave, JSON backup/restore, persisted manual card positions, save-error UI, and unapplied-form protection.
- GEDCOM 5.5.1 UTF-8/ASCII and 7.0 UTF-8 import/export in a Worker, retaining original text and minimally patching supported edited fields.
- Exact preservation fixtures for extra names, repeated marriages, adoption, sources, shared notes, multiline text, unknown tags, BOM/line endings, and approximate date strings.
- Visible diagnostics for unresolved links; rejection of unsupported encodings, malformed structure, duplicate IDs, and ancestry cycles before document replacement.
- English documentation and agent instructions (`CLAUDE.md` is canonical; `AGENTS.md` points to it).

## Verification

- `npm run build`: passed (strict TypeScript + production Vite build).
- `npm test`: 28 tests passed across model/history, layout, and GEDCOM source preservation.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: 6 tests passed.
- Browser workflows cover edits, undo/redo, reload persistence, backup/restore, unapplied-edit protection, full 3,000-card rendering, search for I3000, and editing I3000 without recomputing layout. GEDCOM workflows also cover edit/reload/export/reimport, exact expected output, invalid/cancelled import, and preserving unresolved links on export.
- Screenshots were inspected. A delayed fit-all overriding search focus was found and fixed; regression assertions verify 100% zoom and the target card in the viewport.
- Latest large-demo run: 0.59 s layout inside the Worker; 1.937 s from choosing 3,000 people to the fit-all control and saved status. The second number includes rendering, a 400 ms autosave debounce, and IndexedDB persistence; it is not a pure rendering benchmark.
- Environment: macOS on arm64, Node 24.14.1, headless Google Chrome 153, 1440×1000 viewport, Vite dev server. No CPU throttling. One synthetic dataset; no general FPS/input-latency guarantee.

## Known limitations

- GEDCOM support is a tested subset, not complete specification compliance. No external semantic validator or real user dataset has been used. Date strings are preserved but not semantically validated; ANSEL/UTF-16 and GEDZIP are unsupported.
- The synthetic descendant-heavy layout is extremely wide at 3,000 people. Fit-all shows all cards but not readable labels. Search/focus and zoom work; genealogy-specific layout quality remains a separate milestone.
- Dagre does not guarantee ideal spouse adjacency or routing for arbitrary family graphs.
- Creation/deletion of people and relationship edits are not implemented.
- Undo history covers applied person fields only, not dragging, and does not survive reload.
- One autosaved document per browser origin; clearing site data removes it. JSON backups are independent.
- Accessibility and mobile layouts are preliminary. Other browsers and real-world GEDCOM datasets have not been tested. JSON draft parsing still runs on the main thread; GEDCOM processing and layout run in Workers.

## Review findings (2026-09-23)

Code review after the handover from Codex. Checks re-run on this date: `npm run build` passed, `npm test` 25/25, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` 6/6 (3,000-person layout 0.59 s in Worker).

Fixed bugs (2026-09-24; `npm run build`, `npm test` 28/28, e2e 6/6 re-run after the fix):

1. **Name corruption on export.** `substitute()` in `src/gedcom/serializer.ts` did a plain substring replace, so `GIVN Jo` + `NAME Dr. John` exported `Dr. Alberthn`. It now matches `GIVN`/`SURN` text only as a whole word (Unicode letters/digits as word characters), and refuses export if there is no match or more than one.
2. **CONC split inside `@@`.** GEDCOM 5.5.1 notes were split after escaping, so a line could end in a lone `@`. Text is now split before escaping, sizing `@` as 2 bytes, and breaks avoid landing next to a space.

Three exact-output tests cover these; each fails against the previous serializer.

Risks and cleanups:

- **Real-world input coverage.** GEDCOM `5.5`, `CHAR ANSI`/CP1251, and ANSEL are rejected. Russian genealogy software commonly produces these. Test real files before extending editing.
- **Stale restored positions.** `restoredPositions` in `App.tsx` is never cleared after initial load. Once structural edits exist, a family change whose node IDs are still covered would silently reapply the initial draft's positions and discard newer drags. Clear it after first use.
- **Large payloads.** The whole `TreeDocument`, including up to 20 MiB of `gedcom.text`, is posted to the layout Worker and written to IndexedDB on every debounced edit or drag. Send only IDs/families to layout; consider storing the source text separately from the frequently saved projection.
- **Family junction nodes** in `TreeCanvas` are recreated (`{ ...old, position }`) on every people/selection change. Reuse the old node when the position is unchanged.
- **Milestone 3 architecture.** Diff-against-reimported-baseline export cannot express structural edits (new INDI/FAM, link changes). Consider an explicit operation log or making the parsed line tree the editable source of truth before adding relatives.
- **Maintainability.** `App.tsx` is a 258-line component with very long lines; there is no ESLint/Prettier (an `eslint-disable` comment references a linter that is not installed).

## Next concrete step

Fix `restoredPositions` staleness (note: React StrictMode runs effects twice in dev, so clearing the ref inside the layout effect would discard restored positions on the second run — consume it outside the effect or key it by document). Then start milestone 3 with a single complete workflow: add a child to an existing family, undo/redo the operation, export, and reimport.

1. Extend history beyond person-field patches so a structural edit is one atomic operation.
2. Add collision-free GEDCOM ID allocation and source-preserving insertion of INDI/FAM relationships. The current exporter intentionally rejects structural changes; do not just remove that guard.
3. Add fixtures proving that new INDI/FAMC/CHIL links are reciprocal and unrelated source text is unchanged.
4. Update the UI with a compact add-child action and appropriate validation.
5. Verify layout after structural edits and ensure existing manual-position behavior is explicit.

Before claiming broader readiness, profile the wide 3,000-person layout and test a real GEDCOM file. See milestone 4 for layout/performance goals.

## Resume

Read `CLAUDE.md`, then this file, then `git status` and `git log`. Continue from the next concrete step.
