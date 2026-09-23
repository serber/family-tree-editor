# Implementation plan

## Milestone 1 — runnable prototype and scale check

- Scaffold React/TypeScript/Vite and a React Flow canvas.
- Introduce a renderer-independent person/family model with stable IDs.
- Generate deterministic 100-, 1,000-, and 3,000-person demo genealogies, including repeated marriages.
- Run layout in a Worker; display family junctions, pan/zoom, a minimap, and fit-all.
- Add zoom-dependent detail, search, focus-person, and a side panel for names, dates, and notes.
- Add undo/redo and local draft autosave with visible errors and backup download/restore.
- Verify the model, production build, browser workflows, and the 3,000-person case. Record limitations and measured timings.

Acceptance: a reproducible runnable prototype; any demo person can be found and edited; applied edits and positions survive reload; undo/redo works. This milestone does not yet provide GEDCOM file support.

## Milestone 2 — preserve data through GEDCOM import/export

- Create focused 5.5.1 and 7 fixtures covering multiple names, marriages, parent families, adoption, unknown tags, sources, cross-references, multiline text, and approximate dates.
- Evaluate parsers by license, extension retention, encoding handling, and serialization. If necessary, implement an independent lossless syntax-tree layer.
- Keep original records, structure order, levels, and unknown subtrees. Map UI edits back to specific structures rather than rebuilding a GEDCOM file from supported fields alone.
- Detect the version and encoding. Reject unsupported encodings explicitly before replacing the current document.
- Import in a Worker with progress/error reporting and diagnostics for broken references.
- Replace documents transactionally, protecting the current draft and unapplied form edits.
- Provide an initial serializer now so preservation can be tested before broader editing is added.

Acceptance: unchanged round-trips preserve all fixture data; editing one supported field preserves unrelated records and structures. Validate output independently when a suitable validator is available.

## Milestone 3 — complete editing workflows

- Add people, parents, children, and partners; link an existing person.
- Manage several families per person and biological/adoptive relationships. Prevent newly introduced ancestry cycles.
- Preview the effects of deletions and relationship changes; undo each operation atomically.
- Support multiple names, events, notes, and citations without crowding the default UI.
- Export in the original GEDCOM version, with explicit handling of changes that cannot be represented.
- Store canvas positions separately from standard genealogy data.

Acceptance: open → edit → add a relative → export → reopen, without losing unrelated data.

## Milestone 4 — genealogy layout and performance

- Exercise shared ancestors, repeated marriages, disconnected components, uneven generations, and malformed ancestry cycles from imports.
- Improve spouse placement and family-line routing. Keep manual positions during text edits.
- Test real 2,000–3,000-person files and deliberately difficult synthetic graphs.
- Measure import/layout times, search, edit latency, pan, and zoom. Aspirational targets: no sustained UI freezes, ordinary search/edit feedback within 100 ms, and at least 30 FPS navigation on an agreed device. These are targets, not current guarantees.
- Consider another renderer only after profiling and attempting React Flow optimizations.

## Milestone 5 — everyday reliability

- Improve keyboard access, accessibility, and narrow-screen panels.
- Add robust recovery, draft backups, and unambiguous save status.
- Verify browser compatibility and privacy; document static deployment and user workflows.
- Consider offline/PWA behavior after persistence stabilizes. Publishing requires a separate request.
