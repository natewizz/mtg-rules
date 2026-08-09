# Parser notes — v0.1.0

The parser was designed after inspecting the official Wizards TXT available from the rules landing page during bootstrap.

## Observed source structure

The current source contains:

1. title and effective-date metadata;
2. introduction;
3. contents/navigation material;
4. numbered sections and rule headings;
5. numbered rules, lettered subrules, examples, and continuations;
6. glossary entries and definitions; and
7. credits and legal end matter.

The contents includes a second `Credits` marker before the actual numbered-rule body. The parser uses the transition from that contents marker to a numbered heading to identify the beginning of the rules body. The actual `Glossary` and `Credits` markers then terminate the numbered-rule body.

## Whitespace and line endings

The source uses non-breaking spaces (`U+00A0`) on many blank lines. It also contains Unicode line separators (`U+2028`) inside some paragraphs. Parsing normalizes both ordinary line endings and Unicode line separators, and uses trimmed whitespace to identify blank lines.

## Continuations

Most rule text is on one source line. A small number of rule continuations are indented. Indented lines following a rule are appended to that rule. Indented lines following an `Example:` are appended to that example.

The glossary is separated by blank lines. A non-indented line after a completed glossary definition starts a new term; otherwise text is appended to the current definition.

## Conservative validation

Unknown meaningful lines in the numbered rules become validation issues. Duplicate rule IDs are not overwritten silently. The integration test is opt-in for normal local development but should be run against the current official source before a release.

This parser does not interpret rules semantically. It only preserves and structures source text.
