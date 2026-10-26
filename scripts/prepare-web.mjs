import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const RELEASE_TAG = 'v0.2.0-data.2';
const REPO = 'natewizz/mtg-rules';
const token = process.env.MTG_RULES_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';

const ASSETS = [
  {
    name: 'rules.json',
    profile: 'complete-generated-document',
    unit: 'rules',
  },
  {
    name: 'mtr.json',
    profile: 'complete-generated-tournament-rules',
    unit: 'sections',
  },
];

let releaseBody;

for (const asset of ASSETS) {
  const text = await downloadAsset(asset.name);
  const summary = inspect(text, asset);
  const destination = join(process.cwd(), 'web', asset.name);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, destination);
  console.log(
    `Wrote web/${asset.name} from ${RELEASE_TAG} (${summary.effectiveDate}, ${summary.ruleCount} ${asset.unit}). The file stays gitignored.`,
  );
}

function inspect(text, asset) {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    console.error(`The ${asset.name} release asset is not valid JSON.`);
    process.exit(1);
  }

  const metadata = document?.metadata;
  const notices = metadata?.notices;
  const ruleCount = document?.rules ? Object.keys(document.rules).length : 0;

  if (
    metadata?.dataProfile !== asset.profile ||
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
    console.error(
      `The ${asset.name} release asset is missing the required profile, notices, or rules.`,
    );
    process.exit(1);
  }

  return { effectiveDate: metadata.effectiveDate, ruleCount };
}

async function downloadAsset(name) {
  if (token) return downloadPrivateAsset(name);

  const url = `https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${name}`;
  const response = await fetch(url, {
    headers: { 'user-agent': 'mtg-rules-prepare-web' },
    redirect: 'follow',
  });
  if (!response.ok) {
    console.error(
      `Could not download ${url} (HTTP ${response.status}). A private release needs MTG_RULES_GITHUB_TOKEN.`,
    );
    process.exit(1);
  }
  return response.text();
}

async function downloadPrivateAsset(name) {
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'mtg-rules-prepare-web',
    'x-github-api-version': '2022-11-28',
  };
  if (!releaseBody) {
    const release = await fetch(
      `https://api.github.com/repos/${REPO}/releases/tags/${RELEASE_TAG}`,
      { headers },
    );
    if (!release.ok) {
      console.error(`Could not read release ${RELEASE_TAG} (HTTP ${release.status}).`);
      process.exit(1);
    }
    releaseBody = await release.json();
  }

  const asset = (releaseBody.assets ?? []).find((item) => item.name === name);
  if (!asset?.url) {
    console.error(`Release ${RELEASE_TAG} has no ${name} asset.`);
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
    console.error(`Could not download ${name} (HTTP ${file.status}).`);
    process.exit(1);
  }
  return file.text();
}
