# ADR 0002: Generated output is deterministic

- **Status:** Accepted
- **Version:** v0.1.1

## Decision

Parsing and serializing the same source version must produce byte-for-byte identical deterministic output.

## Consequences

- Volatile retrieval timestamps are not included in the canonical document.
- Source URL, effective date, and source hash are provenance fields only.
- Object keys are serialized in deterministic order.
- Rule IDs are ordered with the shared canonical comparator where ordering is generated.
- Deterministic output can be hashed and compared locally.
