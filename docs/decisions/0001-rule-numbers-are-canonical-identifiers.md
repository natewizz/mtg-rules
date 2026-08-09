# ADR 0001: Rule numbers are canonical identifiers

- **Status:** Accepted
- **Version:** v0.1.1

## Decision

Wizards rule numbers, exactly as represented by the source, are the canonical `mtg-rules` identifiers.

## Consequences

- IDs remain strings such as `100`, `100.1`, and `704.5f`.
- No UUID or second identity scheme is introduced.
- Rule renumbering is represented as a removal and an addition.
- `mtg-rules` does not infer identity across renumbering.
- Rule parsing, parent lookup, ordering, validation, and diffing use the shared rule-ID utility.
