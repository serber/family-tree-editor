# GEDCOM support and preservation contract

## Supported input

- GEDCOM 5.5.1 with an explicit `CHAR UTF-8` or `CHAR ASCII` header.
- GEDCOM 7.0 with UTF-8. A UTF-8 BOM is accepted and retained.
- LF, CRLF, and CR line endings, including a missing final line ending.
- Up to 3,000 people and 20 MiB per GEDCOM file.

ANSEL, UTF-16, other legacy encodings, GEDZIP, and other GEDCOM versions are explicitly rejected. Invalid UTF-8 is rejected rather than decoded with replacement characters. This avoids corrupting names during import.

## Storage and export strategy

`TreeDocument.gedcom.text` contains the complete original decoded text. The renderer uses a separate people/families projection. The source is included in IndexedDB drafts and JSON backups.

The parser builds a line tree with original raw lines, line endings, cross-reference IDs, levels, tags, payloads, and children. Import uses that tree to project the supported fields. Export reparses the original source and compares its projected fields with the current people. It patches the affected line payloads and leaves unrelated raw lines unchanged.

An unchanged supported input is returned exactly. Unit fixtures verify byte equality after UTF-8 encoding, including BOM, line endings, and trailing-newline behavior. Edited-field tests compare complete output files against expected minimal modifications. These are tested guarantees for the supplied fixtures, not certification of compatibility with every producer.

A small local parser is used because the immediate requirement is retaining physical source text and making minimal edits. It is not a complete GEDCOM semantic validator. No third-party GEDCOM parser or external validator has been integrated yet.

## Editable projection

| UI field | Source structure | Behavior |
| --- | --- | --- |
| Given name | First `INDI.NAME`, optional `GIVN` | Update the relevant name portion and the existing structured field; preserve prefix/suffix and other name records |
| Surname | First `INDI.NAME`, optional `SURN` | Update the relevant surname portion and the existing structured field |
| Birth date | First `INDI.BIRT.DATE` | Preserve raw date strings; leave event places and citations untouched |
| Death date | First `INDI.DEAT.DATE` | Same; clearing the only event date preserves the event fact with `Y` |
| Note | First inline `INDI.NOTE` | Edit payload/continuations while retaining citations and other children; shared note pointers remain unchanged |

Missing supported structures are inserted when a value is added. Unchanged additional names, events, notes, sources, media references, adoption metadata, and extensions stay in the source. They do not yet have full editing interfaces.

GEDCOM 5.5.1 note output escapes at-signs and uses `CONT`/`CONC` with a conservative UTF-8 line budget. Text is split before escaping, so `@@` never spans two lines, and `CONC` breaks avoid spaces at line edges. GEDCOM 7 output uses `CONT` and version-specific leading-at-sign escaping. Empty lines in notes are preserved.

Structured `GIVN`/`SURN` values are replaced in `NAME` only as a whole word. If they are missing from `NAME`, match only part of a word, or appear more than once, the rewrite is refused. ASCII sources cannot be exported with new non-ASCII characters; the applied edit is still available in the local/JSON draft. Implicit encoding conversion is intentionally absent.

## References and malformed data

Family cards/lines derive from `FAM.HUSB`, `FAM.WIFE`, and `FAM.CHIL`. These tags do not impose a person's displayed sex; `INDI.SEX` controls the prototype card style. Repeated marriages and shared ancestors are allowed.

Missing references and inconsistent reverse `FAMC`/`FAMS` links generate visible warnings. Missing people are omitted from the display, but the original link lines remain in exports. Diagnostics are capped at 100 displayed messages.

Duplicate cross-reference IDs, invalid line nesting, missing header/trailer, and cycles in the projected parent-child graph are rejected before replacing the current document. A validated import still requires confirmation before replacing the existing draft. Cancelling or failing import leaves the current draft unchanged.

## Current limitations

- No full GEDCOM semantic validation, date/calendar validation, or independent external-validator run yet. Dates are raw GEDCOM strings; use GEDCOM forms such as `ABT 1900` when editing.
- No export of new/deleted people, changed family relationships, or changed sex values. The exporter rejects those unsupported projection changes rather than silently omitting them.
- Shared notes, multiple names, adoption details, citations, and media have source preservation but incomplete UI representation.
- Manually moved cards are stored in JSON/IndexedDB, not injected into GEDCOM as proprietary tags.
- Header producer metadata and change timestamps are left untouched.
- No real user-provided files have been tested in this session. Fixtures are synthetic and authored in this repository.
- Broken source links are preserved with warnings; exporting them does not repair them.

## Specification references

- [FamilySearch GEDCOM 7 specification](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html): hierarchical lines, continuation pseudo-structures, version-specific escaping, and record structures.
- [GEDCOM 5.5.1 specification](https://gedcom.io/specifications/ged551.pdf): legacy structure and character-set declarations.

The implementation intentionally exposes a limited editable projection. Before extending it, add a fixture and an exact preservation test for the new structure.
