import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const RELEASE_TAG = 'v0.2.0-data.1';
const REPO = 'natewizz/mtg-rules';
const PUBLIC_URL = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/rules.json`;
const token = process.env.MTG_RULES_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';

const destination = join(process.cwd(), 'web', 'rules.json');
const temporary = `${destination}.tmp`;

const text = await downloadRules();
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
  `Wrote web/rules.json from ${RELEASE_TAG} (${metadata.effectiveDate}, ${ruleCount} rules). The file stays gitignored.`,
);

async function downloadRules() {
  if (token) return downloadPrivateAsset();

  const response = await fetch(PUBLIC_URL, {
    headers: { 'user-agent': 'mtg-rules-prepare-web' },
    redirect: 'follow',
  });
  if (!response.ok) {
    console.error(
      `Could not download ${PUBLIC_URL} (HTTP ${response.status}). A private release needs MTG_RULES_GITHUB_TOKEN.`,
    );
    process.exit(1);
  }
  return response.text();
}

async function downloadPrivateAsset() {
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'mtg-rules-prepare-web',
    'x-github-api-version': '2022-11-28',
  };
  const release = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${RELEASE_TAG}`, {
    headers,
  });
  if (!release.ok) {
    console.error(`Could not read release ${RELEASE_TAG} (HTTP ${release.status}).`);
    process.exit(1);
  }

  const body = await release.json();
  const asset = (body.assets ?? []).find((item) => item.name === 'rules.json');
  if (!asset?.url) {
    console.error(`Release ${RELEASE_TAG} has no rules.json asset.`);
    process.exit(1);
  }

  const file = await fetch(asset.url, {
    headers: {
      ...headers,
      accept: 'application/octet-stream',
    },
    redirect: 'follow',
  });
  if (!file.ok) {
    console.error(`Could not download rules.json (HTTP ${file.status}).`);
    process.exit(1);
  }
  return file.text();
}
