import { readFile } from 'node:fs/promises';
import { diffRules } from 'mtg-rules';

type RulesDocument = Parameters<typeof diffRules>[0];
const oldPath = process.argv[2];
const newPath = process.argv[3];

if (!oldPath || !newPath) {
  console.error('Usage: npm run example:diff -- ./old.json ./new.json');
  process.exit(1);
}

const oldDocument = JSON.parse(await readFile(oldPath, 'utf8')) as RulesDocument;
const newDocument = JSON.parse(await readFile(newPath, 'utf8')) as RulesDocument;
console.log(JSON.stringify(diffRules(oldDocument, newDocument), null, 2));
