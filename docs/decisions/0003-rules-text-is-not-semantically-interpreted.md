# ADR 0003: Rules text is not semantically interpreted

- **Status:** Accepted
- **Version:** v0.1.1

## Decision

`mtg-rules` structures and validates the Comprehensive Rules but does not attempt to understand gameplay semantics.

## Consequences

- Creatures, state-based actions, zones, replacement effects, and other concepts remain source text from the parser's perspective.
- The project does not infer gameplay behavior.
- Rule hashes compare normalized text, not meaning.
- Diffs report added, removed, changed, and unchanged IDs without semantic rename detection.
