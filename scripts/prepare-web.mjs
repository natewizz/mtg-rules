import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_RELEASE_URL =
  'https://github.com/natewizz/mtg-rules/releases/download/v0.2.0-data.1/rules.json';

const destination = join(process.cwd(), 'web', 'rules.json');
const temporary = `${destination}.tmp`;

const response = await fetch(DATA_RELEASE_URL, {
  headers: { 'user-agent': 'mtg-rules-prepare-web' },
  redirect: 'follow',
});

if (!response.ok) {
  console.error(`Could not download ${DATA_RELEASE_URL} (HTTP ${response.status}).`);
  process.exit(1);
}

const text = await response.text();
let document;
try {
  document = JSON.parse(text);
} catch {
  console.error('The release asset is not valid JSON.');
  process.exit(1);
}

const metadata = document?.metadata;
const notices = metadata?.notices;
const ruleCount = document?.rules ? Object.keys(document.rules).length : 0;

if (
  metadata?.dataProfile !== 'complete-generated-document' ||
  notices?.unofficial !== true ||
  notices?.freeUseOnly !== true ||
  notices?.commercialUsePermitted !== false ||
  !Array.isArray(notices?.statements) ||
  notices.statements.length === 0 ||
  typeof metadata?.effectiveDate !== 'string' ||
  !metadata.effectiveDate ||
  typeof metadata?.sourceUrl !== 'string' ||
  !metadata.sourceUrl.startsWith('https://') ||
  ruleCount === 0
) {
  console.error('The release asset is missing the required profile, notices, or rules.');
  process.exit(1);
}

await writeFile(temporary, text);
await rename(temporary, destination);

console.log(
  `Wrote web/rules.json from ${DATA_RELEASE_URL} (${metadata.effectiveDate}, ${ruleCount} rules). The file stays gitignored.`,
);
