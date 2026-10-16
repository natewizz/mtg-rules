import { getRule, searchGlossary, searchRules, validateViewerDocument } from './search.mjs';

const statusEl = document.querySelector('#status');
const searchEl = document.querySelector('#search');
const resultsEl = document.querySelector('#results');
const detailEl = document.querySelector('#detail');
const noticesEl = document.querySelector('#notices');
const formEl = document.querySelector('#lookup');
const brandEl = document.querySelector('.brand');
const tryButtons = [...document.querySelectorAll('[data-query]')];
const sectionButtons = [...document.querySelectorAll('.tabs button')];

let documentData;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status-error', isError);
}

function renderNotices(rulesDocument) {
  const statements = rulesDocument.metadata.notices?.statements ?? [];
  const sourceUrl = rulesDocument.metadata.sourceUrl || 'https://magic.wizards.com/en/rules';
  const groups =
    statements.length === 6
      ? [
          { label: 'Fan content', lines: statements.slice(0, 2) },
          { label: 'Copyright', lines: statements.slice(2, 3) },
          { label: 'Use', lines: statements.slice(3) },
        ]
      : [{ label: 'Fan content', lines: statements }];
  const prose = groups
    .map(
      (group) => `<section>
        <h3>${escapeHtml(group.label)}</h3>
        <div>${group.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>
      </section>`,
    )
    .join('');
  noticesEl.innerHTML = `<h2>Notices</h2>${prose}
    <section>
      <h3>Edition</h3>
      <dl>
        <div><dt>Version</dt><dd>${escapeHtml(rulesDocument.version || 'unknown')}</dd></div>
        <div><dt>Effective</dt><dd>${escapeHtml(rulesDocument.metadata.effectiveDate || 'unknown')}</dd></div>
        <div><dt>Source</dt><dd><a href="${escapeAttr(sourceUrl)}">${escapeHtml(sourceName(sourceUrl))}</a></dd></div>
        <div><dt>Rules</dt><dd><a href="https://magic.wizards.com/en/rules">magic.wizards.com/en/rules</a></dd></div>
        <div><dt>Code</dt><dd><a href="https://github.com/natewizz/mtg-rules">github.com/natewizz/mtg-rules</a>. Original parser and tooling code is MIT-licensed. MIT does not apply to Wizards-owned text.</dd></div>
      </dl>
    </section>`;
}

function sourceName(url) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return name || url;
  } catch {
    return url;
  }
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
    detailEl.hidden = false;
    detailEl.innerHTML = '<p>Rule not found.</p>';
    return;
  }
  const nextHash = `#${encodeURIComponent(rule.id)}`;
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
  const examples = rule.examples.length
    ? `<h3>Examples</h3><ul class="examples">${rule.examples.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  detailEl.hidden = false;
  detailEl.innerHTML = `<p class="rule-id">${escapeHtml(rule.id)}</p><p class="wording">${escapeHtml(rule.text)}</p>${examples}`;
  setBoard(sectionOf(rule.id));
}

function sectionOf(id) {
  const hundred = String(id).charAt(0);
  return hundred >= '1' && hundred <= '9' ? `${hundred}00` : '700';
}

function setBoard(section) {
  document.body.dataset.section = section;
  for (const tab of sectionButtons) {
    const open = tab.dataset.section === section;
    tab.classList.toggle('is-open', open);
    if (open) tab.setAttribute('aria-current', 'true');
    else tab.removeAttribute('aria-current');
  }
}

function showGlossary(entry) {
  window.location.hash = '';
  detailEl.hidden = false;
  detailEl.innerHTML = `<p class="rule-id">Glossary</p><h2>${escapeHtml(entry.term)}</h2><p class="wording">${escapeHtml(entry.text)}</p>`;
}

function renderResults(query) {
  if (!documentData) return;
  const trimmed = query.trim();
  resultsEl.replaceChildren();

  if (!trimmed) {
    detailEl.hidden = true;
    detailEl.replaceChildren();
    setBoard('700');
    return;
  }

  const rules = searchRules(documentData, trimmed);
  const glossary = searchGlossary(documentData, trimmed);

  for (const rule of rules) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<span class="hit-id">${escapeHtml(rule.id)}</span><span class="hit-text">${escapeHtml(rule.text.slice(0, 160))}</span>`;
    button.addEventListener('click', () => showRule(rule));
    item.append(button);
    resultsEl.append(item);
  }

  for (const entry of glossary) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<span class="hit-id">Glossary</span><span class="hit-text">${escapeHtml(entry.term)}</span>`;
    button.addEventListener('click', () => showGlossary(entry));
    item.append(button);
    resultsEl.append(item);
  }

  if (rules.length === 0 && glossary.length === 0) {
    detailEl.hidden = false;
    detailEl.innerHTML = '<p>No matching rule or glossary entry.</p>';
    return;
  }

  const exact = getRule(documentData, trimmed);
  if (exact) showRule(exact);
  else if (rules.length === 1) showRule(rules[0]);
  else {
    detailEl.hidden = true;
    detailEl.replaceChildren();
  }
}

function enableSearch() {
  searchEl.disabled = false;
  for (const button of tryButtons) button.disabled = false;
  for (const button of sectionButtons) button.disabled = false;
  searchEl.focus();
}

async function loadJson(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The rules file is not valid JSON.');
  }
  const parsed = validateViewerDocument(value);
  documentData = parsed;
  renderNotices(parsed);
  const count = Object.keys(parsed.rules).length;
  setStatus(
    `mtg-rules ${parsed.version}. Effective ${parsed.metadata.effectiveDate}. ${count.toLocaleString('en-US')} rules. Unofficial, free to use only.`,
  );
  enableSearch();

  const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (hashId && parsed.rules[hashId]) {
    searchEl.value = hashId;
    renderResults(hashId);
  }
  return label;
}

function showHome() {
  searchEl.value = '';
  renderResults('');
}

brandEl.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
    return;
  event.preventDefault();
  showHome();
  const home = new URL('./', location.href);
  home.search = '';
  home.hash = '';
  if (location.href !== home.href) history.pushState(null, '', home.href);
  searchEl.focus();
});

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  renderResults(searchEl.value);
});

searchEl.addEventListener('input', () => {
  renderResults(searchEl.value);
});

for (const button of tryButtons) {
  button.addEventListener('click', () => {
    searchEl.value = button.dataset.query ?? '';
    renderResults(searchEl.value);
    searchEl.focus();
  });
}

for (const button of sectionButtons) {
  button.addEventListener('click', () => {
    const section = button.dataset.section ?? '700';
    searchEl.value = '';
    setBoard(section);
    renderSection(section);
  });
}

function compareRuleIds(a, b) {
  const parts = (id) => {
    const match = String(id).match(/^(\d+)(?:\.(\d+))?([a-z]+)?$/);
    return match
      ? [Number(match[1]), match[2] === undefined ? -1 : Number(match[2]), match[3] ?? '']
      : [Number.MAX_SAFE_INTEGER, 0, String(id)];
  };
  const left = parts(a);
  const right = parts(b);
  return (
    left[0] - right[0] ||
    left[1] - right[1] ||
    (left[2] < right[2] ? -1 : left[2] > right[2] ? 1 : 0)
  );
}

function renderSection(section) {
  if (!documentData) return;
  const hundred = section.charAt(0);
  const matches = Object.values(documentData.rules)
    .filter((rule) => rule.id.charAt(0) === hundred)
    .sort((a, b) => compareRuleIds(a.id, b.id))
    .slice(0, 40);
  resultsEl.replaceChildren();
  for (const rule of matches) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<span class="hit-id">${escapeHtml(rule.id)}</span><span class="hit-text">${escapeHtml(rule.text.slice(0, 160))}</span>`;
    button.addEventListener('click', () => showRule(rule));
    item.append(button);
    resultsEl.append(item);
  }
  if (matches[0]) showRule(matches[0]);
  resultsEl.scrollTop = 0;
  requestAnimationFrame(() => {
    resultsEl.scrollTop = 0;
    document.querySelector('.reading')?.scrollIntoView({ block: 'start' });
  });
}

window.addEventListener('hashchange', () => {
  if (!documentData) return;
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (id && documentData.rules[id]) showRule(documentData.rules[id]);
  else if (!id) showHome();
});

window.addEventListener('popstate', () => {
  if (!documentData) return;
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (id && documentData.rules[id]) showRule(documentData.rules[id]);
  else showHome();
});

try {
  const response = await fetch('./rules.json');
  if (!response.ok) throw new Error(`Could not load rules.json (HTTP ${response.status}).`);
  await loadJson(await response.text(), './rules.json');
} catch (error) {
  setStatus(
    `${error instanceof Error ? error.message : String(error)} Run npm run prepare:web, then reload.`,
    true,
  );
}
