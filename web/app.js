import { getRule, searchGlossary, searchRules, validateViewerDocument } from './search.mjs';

const DEFAULT_RELEASE =
  'https://github.com/natewizz/mtg-rules/releases/download/v0.2.0-data.1/rules.json';

const statusEl = document.querySelector('#status');
const searchEl = document.querySelector('#search');
const resultsEl = document.querySelector('#results');
const detailEl = document.querySelector('#detail');
const noticesEl = document.querySelector('#notices');
const fileEl = document.querySelector('#file');
const loadLocalEl = document.querySelector('#load-local');

let documentData;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status-error', isError);
}

function renderNotices(rulesDocument) {
  const notices = rulesDocument.metadata.notices;
  const statements = (notices?.statements ?? [])
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
  noticesEl.innerHTML = `${statements}
    <p>Effective date: ${escapeHtml(rulesDocument.metadata.effectiveDate || 'unknown')}</p>
    <p>Source: <a href="${escapeAttr(rulesDocument.metadata.sourceUrl || 'https://magic.wizards.com/en/rules')}">${escapeHtml(rulesDocument.metadata.sourceUrl || 'https://magic.wizards.com/en/rules')}</a></p>
    <p>Official Comprehensive Rules: <a href="https://magic.wizards.com/en/rules">magic.wizards.com/en/rules</a></p>
    <p>Original mtg-rules code is MIT-licensed. MIT does not apply to Wizards-owned text.</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}

function showRule(rule) {
  if (!rule) {
    detailEl.innerHTML = '<p>Rule not found.</p>';
    return;
  }
  window.location.hash = rule.id;
  const examples = rule.examples.length
    ? `<h4>Examples</h4><ul class="examples">${rule.examples.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  detailEl.innerHTML = `<h3>${escapeHtml(rule.id)}</h3><p>${escapeHtml(rule.text)}</p>${examples}`;
}

function renderResults(query) {
  if (!documentData) return;
  const rules = searchRules(documentData, query);
  const glossary = searchGlossary(documentData, query);
  resultsEl.replaceChildren();

  for (const rule of rules) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${rule.id} ${rule.text.slice(0, 88)}`;
    button.addEventListener('click', () => showRule(rule));
    item.append(button);
    resultsEl.append(item);
  }

  for (const entry of glossary) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Glossary: ${entry.term}`;
    button.addEventListener('click', () => {
      window.location.hash = '';
      detailEl.innerHTML = `<h3>${escapeHtml(entry.term)}</h3><p>${escapeHtml(entry.text)}</p>`;
    });
    item.append(button);
    resultsEl.append(item);
  }

  const exact = getRule(documentData, query.trim());
  if (exact) showRule(exact);
  else if (rules.length === 1) showRule(rules[0]);
}

async function loadFromObject(value, label) {
  const parsed = validateViewerDocument(value);
  documentData = parsed;
  searchEl.disabled = false;
  renderNotices(parsed);
  const count = Object.keys(parsed.rules).length;
  setStatus(
    `Loaded ${label}: ${parsed.metadata.effectiveDate}, ${count} rules. Unofficial, free to use only.`,
  );
  const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (hashId && parsed.rules[hashId]) {
    searchEl.value = hashId;
    renderResults(hashId);
  }
}

async function loadJson(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  await loadFromObject(value, label);
}

async function loadUrl(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${label} (HTTP ${response.status}).`);
  await loadJson(await response.text(), label);
}

loadLocalEl.addEventListener('click', async () => {
  try {
    await loadUrl('./rules.json', './rules.json');
  } catch (error) {
    try {
      await loadUrl(DEFAULT_RELEASE, 'GitHub pre-release');
    } catch {
      setStatus(
        `${error instanceof Error ? error.message : String(error)} GitHub release downloads are often blocked in the browser; open the JSON file instead.`,
        true,
      );
    }
  }
});

fileEl.addEventListener('change', async () => {
  const file = fileEl.files?.[0];
  if (!file) return;
  try {
    await loadJson(await file.text(), file.name);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
});

searchEl.addEventListener('input', () => {
  renderResults(searchEl.value);
});

window.addEventListener('hashchange', () => {
  if (!documentData) return;
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (id && documentData.rules[id]) {
    searchEl.value = id;
    showRule(documentData.rules[id]);
  }
});

try {
  await loadUrl('./rules.json', './rules.json');
} catch {
  setStatus(
    'No local rules.json. Open a packaged JSON file from the GitHub pre-release, or click Load ./rules.json to retry.',
  );
}
