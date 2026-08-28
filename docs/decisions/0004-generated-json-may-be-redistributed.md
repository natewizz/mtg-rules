# ADR 0004: Generated JSON may be redistributed under a named data profile

- **Status:** Accepted
- **Version:** v0.2.0

## Decision

Wizards of the Coast has permitted redistribution of generated machine-readable Comprehensive Rules JSON for free, unofficial use. `mtg-rules` therefore supports one explicit data profile:

`complete-generated-document`

That profile includes structured rule text, examples, glossary text, credits, metadata, hashes, source URL, and effective date. It does **not** include the original Wizards TXT.

Local `parse` remains a local workflow. Only `package-data` may emit a distributable artifact, and only when:

- the profile is explicit and permitted;
- validation passes;
- source URL, source SHA-256, and effective date are present;
- required unofficial / free-use notices are attached; and
- the artifact contains no local paths or secret-like values.

The original TXT is still fetched at runtime or supplied locally. Generated full JSON is a release artifact, not a Git-tracked source file. The MIT license applies to original code only, not to Wizards-owned rules text.

## Consequences

- Packaged JSON and its NOTICE sidecar must travel together.
- npm packages continue to ship code and schema, not full rules JSON.
- The supported public distribution channel is a manual GitHub **pre-release** asset. See `docs/data-release.md`.
- A hosted website or API is still out of scope until separately implemented.
- Future paid access to rules data is not permitted. Maintenance donations or sponsorships may be added later without charging for the data.
