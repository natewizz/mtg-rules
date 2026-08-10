import { readFile } from 'node:fs/promises';
import { getRule } from 'mtg-rules';

type RulesDocument = Parameters<typeof getRule>[0];
const input = process.argv[2];
const id = process.argv[3] ?? '704.5f';

if (!input) {
  console.error('Usage: npm run example:lookup -- ./rules.json 704.5f');
  process.exit(1);
}

const document = JSON.parse(await readFile(input, 'utf8')) as RulesDocument;
const rule = getRule(document, id);
if (!rule) {
  console.error(`Rule not found: ${id}`);
  process.exit(1);
}

console.log(rule);
