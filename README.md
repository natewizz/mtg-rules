# mtg-rules

`mtg-rules` is a small open-source developer utility that turns the official Magic: The Gathering Comprehensive Rules TXT published by Wizards of the Coast into trustworthy, structured, machine-readable data.

## Version

This repository currently implements **v0.1.0**.

The v0.1 promise is:

> Given an official Wizards Comprehensive Rules TXT file, reliably parse it into structured JSON with stable rule IDs and validate that no meaningful source content was silently lost.

## Licensing and source-data policy

The complete Comprehensive Rules text is copyrighted by Wizards of the Coast. Until explicit redistribution permission is received, this repository does **not** contain:

- the official Wizards TXT file;
- generated JSON containing the complete official rules text; or
- a bundled copy or mirror of the source data.

The CLI fetches the current TXT from the official Wizards rules page, or accepts a local file supplied by the user. Fetched source and generated output should remain local. Synthetic fixtures in `tests/fixtures/` are original test material.

## Requirements

- Node.js 22+
- npm

## Install and test

```bash
npm install
npm test
npm run build
npm run lint
```

## CLI

Fetch the current official source. This writes only to the path you choose:

```bash
npx tsx src/cli.ts fetch -o /tmp/MagicCompRules.txt
```

Parse a local source file into deterministic JSON. Keep the output local:

```bash
npx tsx src/cli.ts parse /tmp/MagicCompRules.txt -o /tmp/rules.json
```

Validate without writing generated rules JSON:

```bash
npx tsx src/cli.ts validate /tmp/MagicCompRules.txt
```

Inspect a rule from local generated JSON:

```bash
npx tsx src/cli.ts rule 704.5f --from /tmp/rules.json
```

The installed CLI is also available after building:

```bash
npm run build
node dist/cli.js validate /tmp/MagicCompRules.txt
```

## Programmatic API

```ts
import { getRule, parseRules, validateRules } from 'mtg-rules';

const document = parseRules(sourceText, {
  sourceUrl: 'https://media.wizards.com/.../MagicCompRules.txt',
});

const report = validateRules(document);
const rule = getRule(document, '704.5f');
```

## Parser guarantees

The parser is deliberately conservative. It handles the observed official document regions:

- effective-date metadata and introduction;
- contents/navigation material;
- numbered sections and numbered rules;
- lettered subrules and multiline continuations;
- `Example:` blocks, including consecutive examples;
- glossary entries and multiline definitions; and
- credits/legal end matter.

Whitespace normalization includes non-breaking spaces used on blank lines and Unicode line separators present inside some source paragraphs.

Every source line is classified. Unknown meaningful lines are reported as validation issues rather than silently dropped. Validation also checks effective date, rule ID shape, parent relationships, sections, glossary, credits, and unclassified meaningful lines.

Rule lookup is flat and canonical:

```ts
document.rules['704.5f'];
```

Each rule receives a SHA-256 hash of its normalized rule text. The canonical JSON serializer sorts object keys to make output deterministic.

## Integration test

The live Wizards integration test is opt-in so ordinary test runs do not depend on the network:

```bash
MTG_RULES_INTEGRATION=1 npm test
```

Or use a previously downloaded local source:

```bash
MTG_RULES_SOURCE=/tmp/MagicCompRules.txt npm test
```

If Wizards changes the source format in a meaningful way, the integration test is expected to fail until the parser is updated.

## v0.1 non-goals

This version does not provide historical storage, diffs, a website, an HTTP API, React components, semantic interpretation, card interaction logic, keyword semantics, AI features, npm publishing, or automatic update releases.
