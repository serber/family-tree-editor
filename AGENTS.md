# Family tree editor — agent instructions

Read `docs/CONTINUE_PROMPT.md`, `docs/PLAN.md`, and `docs/STATUS.md` before making changes.

- Write documentation, agent instructions, and continuation prompts in English. Keep the product UI in Russian.
- Stack: React, TypeScript, Vite, React Flow. Target document size: 2,000–3,000 people.
- Keep the entire genealogy accessible on one canvas. Do not require users to hide branches.
- Keep people/families independent of React Flow objects and layout coordinates.
- GEDCOM editing must preserve unknown tags and unsupported data. Do not claim lossless export without fixture-based round-trip verification.
- Do not upload genealogy data or add telemetry without a user request.
- Do not add a server, accounts, or collaborative editing without a corresponding task.
- Run expensive layout and file parsing in a Worker. Text edits must not recompute layout.
- Run type checks, a production build, and tests appropriate to the change. Measure performance instead of assuming it.
- Update `docs/STATUS.md` after each milestone with completed work, actual checks, limitations, and the next concrete step.
- Do not commit or deploy unless requested.
