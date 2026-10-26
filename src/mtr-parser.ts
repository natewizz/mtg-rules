import { hashText } from './parser.js';

export const MTR_DOCUMENT_VERSION = '0.1.0' as const;
export const MTR_DATA_PROFILE = 'complete-generated-tournament-rules' as const;
export const MTR_SOURCE_PAGE = 'https://wpn.wizards.com/en/rules-documents';

const PAGE_MARKER = /^---PAGE (\d+)---$/;
const EFFECTIVE_DATE = /^Effective\s+(.+?)\.?$/;
const MAJOR_HEADING = /^(\d{1,2})\.\s{2,}([A-Z][^.]*)$/;
const SUBSECTION = /^(\d{1,2}\.\d+)\s+([A-Z][^.]*)$/;
const APPENDIX = /^Appendix ([A-Z])[—–-]\s*(.+)$/;
const BULLET = /^•\s+\S/;
const NUMBERED_ITEM = /^\d+\.\s+\S/;
const CHANGELOG_ITEM = /^\d+\.\d+:\s+\S/;
const DATE_HEADING =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/;
const TOC_LEADER = /\.{4,}/;
const URL_IN_TEXT = /https?:\/\/[^\s)]+/g;

/**
 * Appendix C prints two worked equations as images, so the PDF text layer stops at
 * "match-win percentage is:". These paragraphs are the figure text from the
 * February 27, 2026 edition. They attach only when that exact example is present.
 */
const FIGURE_TEXT: ReadonlyArray<readonly [string, string]> = [
  [
    'and 6–1–1, so her opponents’ match-win percentage is:',
    [
      '(12/24 + 21/24 + 4/15 + 10/21 + 18/24 + 16/24 + 13/24 + 19/24) / 8 opponents',
      'Translated to the decimal system, this equation is:',
      '(0.50 + 0.88 + 0.33 (raised from 0.27) + 0.48 + 0.75 + 0.67 + 0.54 + 0.79) / 8',
      'With the individual match-win percentages added together, this equation becomes:',
      '4.94 / 8',
      'This player’s opponents’ match-win percentage is 0.62.',
    ].join('\n\n'),
  ],
  [
    'and 6–1–1, so his opponents’ match-win percentage is:',
    [
      '(0.88 + 0.33 (raised from 0.27) + 0.48 + 0.75 + 0.67 + 0.54 + 0.79) / 7',
      'With the individual match-win percentages added together, this equation becomes:',
      '4.44 / 7',
      'This player’s opponents’ match-win percentage is 0.63.',
    ].join('\n\n'),
  ],
];

export interface TournamentRule {
  id: string;
  title: string;
  section: string;
  text: string;
  examples: string[];
  hash: string;
  links?: string[];
}

export interface TournamentSection {
  id: string;
  title: string;
}

export interface TournamentNotices {
  unofficial: true;
  freeUseOnly: true;
  commercialUsePermitted: false;
  statements: string[];
  officialSourcePage: string;
}

export interface TournamentRulesDocument {
  version: typeof MTR_DOCUMENT_VERSION;
  metadata: {
    title: string;
    effectiveDate: string;
    sourceUrl: string;
    sourceSha256: string;
    dataProfile: typeof MTR_DATA_PROFILE;
    externalLinks: string[];
    provenance: {
      provider: 'wizards-of-the-coast';
      document: 'magic-tournament-rules';
      effectiveDate: string;
      sourceUrl: string;
      sha256: string;
    };
    notices: TournamentNotices;
  };
  introduction: string[];
  sections: Record<string, TournamentSection>;
  rules: Record<string, TournamentRule>;
  credits: string[];
  classification: {
    unclassified: string[];
  };
}

export interface ParseTournamentRulesOptions {
  sourceUrl?: string;
  sourceSha256?: string;
  externalLinks?: string[];
}

const NOTICE_STATEMENTS = [
  'This project is unofficial Fan Content. It is not approved, endorsed, or affiliated with Wizards of the Coast LLC.',
  'Magic: The Gathering and related names and marks are trademarks of Wizards of the Coast LLC.',
  'The Magic Tournament Rules text is copyrighted by Wizards of the Coast. Portions of the materials used are property of Wizards of the Coast. © Wizards of the Coast LLC.',
  'This generated JSON is a structural, machine-readable representation of the official Magic Tournament Rules. It does not interpret, modify, or replace the official rules.',
  'The generated rules data may be used only for free, noncommercial purposes. It may not be sold, paywalled, or otherwise monetized.',
  'Optional maintenance support such as donations, sponsorships, or Patreon may be used to keep this project running, without charging for access to the rules data.',
] as const;

function cleanLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/([A-Za-z])`$/g, '$1')
    .replace(/([A-Za-z])(https?:\/\/)/g, '$1 $2');
}

function isListStart(line: string): boolean {
  return (
    BULLET.test(line) ||
    NUMBERED_ITEM.test(line) ||
    CHANGELOG_ITEM.test(line) ||
    DATE_HEADING.test(line)
  );
}

function endsSentence(line: string): boolean {
  return /[.!?…]["”’']?$/.test(line);
}

function shouldJoin(previous: string, next: string): boolean {
  if (previous.endsWith('-')) return true;
  if (/^[a-z(]/.test(next)) return true;
  // A single leftover token ("Airbender", "list.") continues a wrapped line.
  // A new row or heading is either spaced or starts with a digit, so it stays separate.
  if (!/\s/.test(next) && !/^\d/.test(next) && !endsSentence(previous) && !previous.endsWith(':')) {
    return true;
  }
  if (previous.endsWith(':')) return false;
  if (previous.length >= 108) return true;
  if (previous.length >= 90 && !endsSentence(previous)) return true;
  return false;
}

function joinLines(lines: string[]): string {
  let text = '';
  for (const line of lines) {
    if (!text) text = line;
    else if (text.endsWith('-')) text += line;
    else text += ` ${line}`;
  }
  return text.replace(/[ \t]+/g, ' ').trim();
}

function prepareLines(sourceText: string): { lines: string[]; effectiveDate?: string } {
  const normalized = sourceText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n');
  const lines: string[] = [];
  let effectiveDate: string | undefined;
  let pendingPageNumber: string | undefined;
  let inBody = false;

  for (const rawLine of normalized.split('\n')) {
    const page = rawLine.trim().match(PAGE_MARKER);
    if (page) {
      pendingPageNumber = page[1];
      continue;
    }
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (pendingPageNumber) {
      const pageNumber = pendingPageNumber;
      pendingPageNumber = undefined;
      if (line === pageNumber) continue;
    }
    if (!inBody) {
      const dated = line.match(EFFECTIVE_DATE);
      if (dated) effectiveDate = dated[1]?.replace(/\.$/, '').trim();
      if (line === 'Introduction') {
        inBody = true;
        lines.push(line);
      }
      continue;
    }
    if (TOC_LEADER.test(line)) continue;
    lines.push(line);
  }

  return effectiveDate === undefined ? { lines } : { lines, effectiveDate };
}

interface RawBlock {
  kind: 'major' | 'subsection' | 'appendix' | 'text';
  text: string;
  id?: string;
  title?: string;
}

function headingBlock(line: string): RawBlock | undefined {
  const major = line.match(MAJOR_HEADING);
  if (major?.[1] && major[2]) {
    return { kind: 'major', text: line, id: major[1], title: cleanTitle(major[2]) };
  }
  const subsection = line.match(SUBSECTION);
  if (subsection?.[1] && subsection[2]) {
    return {
      kind: 'subsection',
      text: line,
      id: subsection[1],
      title: cleanTitle(subsection[2]),
    };
  }
  const appendix = line.match(APPENDIX);
  if (appendix?.[1] && appendix[2]) {
    return {
      kind: 'appendix',
      text: line,
      id: `Appendix ${appendix[1]}`,
      title: cleanTitle(appendix[2]),
    };
  }
  return undefined;
}

function groupBlocks(lines: string[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let current: string[] = [];
  const flush = (): void => {
    if (current.length > 0) blocks.push({ kind: 'text', text: joinLines(current) });
    current = [];
  };

  for (const line of lines) {
    const heading = headingBlock(line);
    if (heading) {
      flush();
      blocks.push(heading);
      continue;
    }
    if (current.length === 0) {
      current.push(line);
      continue;
    }
    if (isListStart(line) || !shouldJoin(current[current.length - 1] ?? '', line)) {
      flush();
      current.push(line);
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
}

function isListItem(text: string): boolean {
  return BULLET.test(text) || NUMBERED_ITEM.test(text);
}

function renderParts(parts: string[]): string {
  const chunks: string[] = [];
  let list: string[] = [];
  const flushList = (): void => {
    if (list.length === 0) return;
    chunks.push(list.join('\n'));
    list = [];
  };
  for (const part of parts) {
    if (isListItem(part)) list.push(part);
    else {
      flushList();
      chunks.push(part);
    }
  }
  flushList();
  return chunks.join('\n\n');
}

function restoreFigureText(text: string): string {
  let restored = text;
  for (const [marker, figure] of FIGURE_TEXT) {
    if (!restored.includes(marker) || restored.includes(figure)) continue;
    restored = restored.replace(marker, `${marker}\n\n${figure}`);
  }
  return restored;
}

function isCreditsLine(text: string): boolean {
  return text.startsWith('All trademarks') || text.startsWith('©');
}

function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}

function compareMtrIds(left: string, right: string): number {
  const rank = (id: string): [number, number, number] => {
    const appendix = id.match(/^Appendix ([A-Z])$/);
    if (appendix?.[1]) return [1, appendix[1].charCodeAt(0), -1];
    const numeric = id.match(/^(\d+)(?:\.(\d+))?$/);
    if (numeric?.[1])
      return [0, Number(numeric[1]), numeric[2] === undefined ? -1 : Number(numeric[2])];
    return [2, 0, 0];
  };
  const a = rank(left);
  const b = rank(right);
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function sortValue(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortValue(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) =>
          parentKey === 'rules' || parentKey === 'sections'
            ? compareMtrIds(a, b)
            : a.localeCompare(b),
        )
        .map(([key, entry]) => [key, sortValue(entry, key)]),
    );
  }
  return value;
}

export function stringifyTournamentRules(document: TournamentRulesDocument): string {
  return `${JSON.stringify(sortValue(document), null, 2)}\n`;
}

function collectUrls(text: string): string[] {
  return (text.match(URL_IN_TEXT) ?? []).map((url) => url.replace(/[.,;]+$/, ''));
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.filter((url) => /^https?:\/\//.test(url)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function getTournamentRule(
  document: TournamentRulesDocument,
  id: string,
): TournamentRule | undefined {
  return document.rules[id];
}

export function parseTournamentRules(
  sourceText: string,
  options: ParseTournamentRulesOptions = {},
): TournamentRulesDocument {
  const prepared = prepareLines(sourceText);
  const blocks = groupBlocks(prepared.lines);
  const sections: Record<string, TournamentSection> = {};
  const rules: Record<string, TournamentRule> = {};
  const introduction: string[] = [];
  const credits: string[] = [];
  const unclassified: string[] = [];

  let mode: 'introduction' | 'body' | 'credits' = 'introduction';
  let sectionId = '';
  let current: { id: string; title: string; section: string; parts: string[] } | undefined;

  const flushRule = (): void => {
    if (!current) return;
    if (rules[current.id]) {
      unclassified.push(`duplicate section ${current.id}`);
      current = undefined;
      return;
    }
    const text = restoreFigureText(renderParts(current.parts));
    rules[current.id] = {
      id: current.id,
      title: current.title,
      section: current.section,
      text,
      examples: [],
      hash: hashText(text),
    };
    current = undefined;
  };

  for (const block of blocks) {
    if (block.text === 'Introduction') continue;
    if (
      block.kind === 'text' &&
      (mode === 'credits' || (mode === 'body' && isCreditsLine(block.text)))
    ) {
      flushRule();
      mode = 'credits';
      credits.push(block.text);
      continue;
    }

    if (block.kind === 'major' && block.id && block.title) {
      flushRule();
      mode = 'body';
      sectionId = block.id;
      sections[sectionId] = { id: sectionId, title: block.title };
      continue;
    }

    if (block.kind === 'subsection' && block.id && block.title) {
      flushRule();
      mode = 'body';
      const parent = block.id.split('.')[0] ?? '';
      if (!sections[parent]) unclassified.push(`missing parent section for ${block.id}`);
      current = { id: block.id, title: block.title, section: parent, parts: [] };
      continue;
    }

    if (block.kind === 'appendix' && block.id && block.title) {
      flushRule();
      mode = 'body';
      current = { id: block.id, title: block.title, section: 'appendix', parts: [] };
      continue;
    }

    if (mode === 'introduction') {
      introduction.push(block.text);
      continue;
    }
    if (current) current.parts.push(block.text);
    else unclassified.push(block.text);
  }
  flushRule();

  const sourceUrl = options.sourceUrl ?? MTR_SOURCE_PAGE;
  const effectiveDate = prepared.effectiveDate ?? '';
  const bodyText = [
    ...introduction,
    ...Object.values(rules).map((rule) => rule.text),
    ...credits,
  ].join('\n');
  const annotationLinks = options.externalLinks ?? [];
  const externalLinks = uniqueUrls([...collectUrls(bodyText), ...annotationLinks]);
  const linksMissingFromText = annotationLinks.filter((url) => !bodyText.includes(url));
  if (linksMissingFromText.length > 0) {
    for (const rule of Object.values(rules)) {
      if (rule.text.includes('Click here')) rule.links = [...linksMissingFromText];
    }
  }

  const sourceSha256 = options.sourceSha256 ?? hashText(sourceText);
  return {
    version: MTR_DOCUMENT_VERSION,
    metadata: {
      title: 'Magic: The Gathering Tournament Rules',
      effectiveDate,
      sourceUrl,
      sourceSha256,
      dataProfile: MTR_DATA_PROFILE,
      externalLinks,
      provenance: {
        provider: 'wizards-of-the-coast',
        document: 'magic-tournament-rules',
        effectiveDate,
        sourceUrl,
        sha256: sourceSha256,
      },
      notices: {
        unofficial: true,
        freeUseOnly: true,
        commercialUsePermitted: false,
        statements: [...NOTICE_STATEMENTS],
        officialSourcePage: MTR_SOURCE_PAGE,
      },
    },
    introduction,
    sections,
    rules,
    credits,
    classification: { unclassified },
  };
}
