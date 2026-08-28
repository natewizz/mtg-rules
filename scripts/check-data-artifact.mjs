import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: npm run check:data-artifact -- ./output/data-release/rules.json');
  process.exit(1);
}

const noticePath = process.argv[3] ?? join(dirname(jsonPath), 'NOTICE.txt');
const moduleUrl = pathToFileURL(join(process.cwd(), 'dist/package-data.js')).href;
const { inspectPackagedArtifact } = await import(moduleUrl);

const jsonText = await readFile(jsonPath, 'utf8');
const noticeText = await readFile(noticePath, 'utf8');
const summary = inspectPackagedArtifact(jsonText, noticeText);
console.log(JSON.stringify(summary, null, 2));
console.log('Data artifact check passed.');
