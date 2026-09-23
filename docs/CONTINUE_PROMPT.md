# Continuation prompt

You are building a browser-based GEDCOM editor in this repository. The user wants a simple interface that can display a complete genealogy of 2,000–3,000 people and make any person's card easy to find and edit. Existing genealogy applications feel overloaded or slow to the user.

First read `AGENTS.md`, `docs/PLAN.md`, and `docs/STATUS.md`, then inspect the code and `git status`. Continue from the first unfinished step in STATUS. Preserve existing changes; do not scaffold the project again.

## Accepted decisions

1. React + TypeScript + Vite, with React Flow for the canvas and interactive cards.
2. One canvas for the whole genealogy, with pan/zoom, a minimap, fit-all, and person search. Cards simplify when zoomed out and show details when zoomed in. Branch collapsing must not be necessary to reach every person.
3. Selecting a person opens a side panel. The eventual editor needs person editing, relative creation, family-link management, undo/redo, autosave, and GEDCOM import/export.
4. People, families, source records, and GEDCOM structures must remain separate from coordinates and React Flow nodes. A person may belong to several families; shared ancestors are valid. The domain is a graph, not a strict tree.
5. Layout and expensive parsing belong in Web Workers. Editing a name must not trigger a full layout.
6. Start with a local browser application. Genealogy data stays on the device. No backend or accounts are needed yet.
7. Plan for GEDCOM 5.5.1 and 7. Preserve unknown tags and original values. Multiple names, approximate dates, adoption, repeated marriages, notes, and citations must not be silently flattened or lost.
8. Documentation and agent files must be in English. The product UI remains Russian.

## Working procedure

Work in small complete milestones. Briefly state the current milestone, implement it, and verify it. Run `npm run build`, relevant unit tests, and browser tests when UI behavior changes. Consult `README.md` for browser setup and commands. Before changing GEDCOM behavior, read `docs/GEDCOM_SUPPORT.md` and preserve its tested source-retention contract.

Do not claim that 3,000-person performance is proven merely because the generator produces that many records. Measure layout, navigation, and editing; record the machine/browser, dataset, and measurement method. Clearly separate functional checks from FPS or input-latency measurements.

At the end of a milestone, update STATUS with actual results, known limitations, and an exact next step so another session can resume without reconstructing the conversation. The user authorized starting development, not deployment or publishing.
