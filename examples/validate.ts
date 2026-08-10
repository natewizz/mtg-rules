import { readFile } from 'node:fs/promises';
import { parseRules, validateRules } from 'mtg-rules';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run example:validate -- ./MagicCompRules.txt');
  process.exit(1);
}

const document = parseRules(await readFile(input, 'utf8'));
const report = validateRules(document);
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
