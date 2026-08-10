import { readFile } from 'node:fs/promises';
import { parseRules } from 'mtg-rules';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run example:parse -- ./MagicCompRules.txt');
  process.exit(1);
}

const source = await readFile(input, 'utf8');
const document = parseRules(source);

console.log({
  effectiveDate: document.metadata.effectiveDate,
  sections: Object.keys(document.sections).length,
  rules: Object.keys(document.rules).length,
  glossaryEntries: Object.keys(document.glossary).length,
});
