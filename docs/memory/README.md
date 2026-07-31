# WorkManager — agent working memory (snapshot)

These are the AI assistant's accumulated **working-memory notes** for WorkManager —
architecture decisions, operational facts, "do-not-relearn" findings, and the
shipped-work history. They're kept here as a private, in-repo backup of that
context so it travels with the code.

**Secrets are scrubbed.** Credential values are replaced with `‹redacted›`
pointers — the real values live only in environment config on the box, never in
this repo.

| File | Covers |
|---|---|
| `project-workmanager.md` | Main memory: architecture, stack, test/E2E baseline, PR history, operational facts. |

These are point-in-time notes, not live state — verify against current code
before relying on any file:line citation. Operational source of truth remains the
code and `README.md`.
