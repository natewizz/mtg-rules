import { createHash } from 'node:crypto';
import type {
  ClassificationStats,
  LineClassification,
  Rule,
  RulesDocument,
  RulesSection,
  GlossaryEntry,
} from './types.js';

const EFFECTIVE_DATE = /These rules are effective as of (.+?)\./i;
const RULE_ID = /^(\d+(?:\.\d+)+(?:[a-z]+)?)\.?\s+(.+)$/;
const NUMBERED_HEADING = /^(\d+)\.\s+(.+)$/;
const EXAMPLE = /^Example:\s*(.*)$/i;

const CLASSIFICATIONS: LineClassification[] = [
  'metadata',
  'introduction',
  'contents',
  'section',
  'rule',
  'continuation',
  'example',
  'glossary',
  'glossary-entry',
  'credits',
  'blank',
];

function emptyCounts(): Record<LineClassification, number> {
  return Object.fromEntries(CLASSIFICATIONS.map((kind) => [kind, 0])) as Record<
    LineClassification,
    number
  >;
}

function normalizeSource(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n');
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function isIndented(line: string): boolean {
  return /^\s/.test(line) && !isBlank(line);
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isMalformedRuleCandidate(line: string): boolean {
  return /^\d[\d.a-z]*\s/i.test(line) && !NUMBERED_HEADING.test(line);
}

export function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function parseRules(
  sourceText: string,
  options: { sourceUrl?: string; sourceSha256?: string } = {},
): RulesDocument {
  const lines = normalizeSource(sourceText).split('\n');
  const sections: Record<string, RulesSection> = {};
  const rules: Record<string, Rule> = {};
  const glossary: Record<string, GlossaryEntry> = {};
  const introduction: string[] = [];
  const credits: string[] = [];
  const unclassified: ClassificationStats['unclassified'] = [];
  const byType = emptyCounts();
  const seenRuleIds = new Set<string>();

  let effectiveDate: string | undefined;
  let phase: 'preamble' | 'introduction' | 'contents' | 'rules' | 'glossary' | 'credits' =
    'preamble';
  let currentRule: Rule | undefined;
  let currentExampleIndex: number | undefined;
  let currentGlossary: GlossaryEntry | undefined;
  let glossaryAfterBlank = false;
  let contentsCreditsSeen = false;

  const classify = (kind: LineClassification): void => {
    byType[kind] += 1;
  };

  const addUnclassified = (lineNumber: number, line: string, reason: string): void => {
    unclassified.push({ line: lineNumber, text: cleanText(line), reason });
  };

  const addRule = (id: string, text: string, lineNumber: number): void => {
    if (seenRuleIds.has(id)) {
      addUnclassified(lineNumber, text, `duplicate rule ID ${id}`);
      return;
    }
    seenRuleIds.add(id);
    const clean = cleanText(text);
    const rule: Rule = { id, text: clean, examples: [], hash: hashText(clean) };
    rules[id] = rule;
    currentRule = rule;
    currentExampleIndex = undefined;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    const lineNumber = index + 1;

    if (isBlank(line)) {
      classify('blank');
      currentExampleIndex = undefined;
      if (phase === 'glossary') glossaryAfterBlank = true;
      continue;
    }

    if (phase === 'preamble') {
      classify(trimmed === 'Introduction' ? 'introduction' : 'metadata');
      const dateMatch = trimmed.match(EFFECTIVE_DATE);
      if (dateMatch && !effectiveDate) effectiveDate = dateMatch[1];
      if (trimmed === 'Introduction') phase = 'introduction';
      continue;
    }

    if (phase === 'introduction') {
      if (trimmed === 'Contents') {
        classify('contents');
        phase = 'contents';
      } else {
        classify('introduction');
        introduction.push(cleanText(trimmed));
      }
      continue;
    }

    if (phase === 'contents') {
      classify('contents');
      if (trimmed === 'Credits') contentsCreditsSeen = true;
      else if (contentsCreditsSeen) {
        const heading = trimmed.match(NUMBERED_HEADING);
        if (heading) {
          const id = heading[1];
          const title = heading[2];
          if (id && title) {
            phase = 'rules';
            sections[id] = { id, title };
          }
        }
      }
      continue;
    }

    if (phase === 'rules') {
      if (trimmed === 'Glossary') {
        classify('glossary');
        phase = 'glossary';
        currentRule = undefined;
        continue;
      }
      if (trimmed === 'Credits') {
        classify('credits');
        phase = 'credits';
        currentRule = undefined;
        continue;
      }

      const heading = trimmed.match(NUMBERED_HEADING);
      if (heading) {
        const id = heading[1];
        const title = heading[2];
        if (!id || !title) {
          addUnclassified(lineNumber, line, 'malformed numbered heading');
          continue;
        }
        classify('section');
        sections[id] = { id, title };
        currentRule = undefined;
        currentExampleIndex = undefined;
        continue;
      }

      const ruleMatch = trimmed.match(RULE_ID);
      const ruleId = ruleMatch?.[1];
      const ruleText = ruleMatch?.[2];
      if (ruleId && ruleText) {
        classify('rule');
        addRule(ruleId, ruleText, lineNumber);
        continue;
      }

      const exampleMatch = trimmed.match(EXAMPLE);
      if (exampleMatch && currentRule) {
        classify('example');
        currentRule.examples.push(cleanText(exampleMatch[1] ?? ''));
        currentExampleIndex = currentRule.examples.length - 1;
        continue;
      }

      if (isIndented(line) && currentRule) {
        classify('continuation');
        if (currentExampleIndex !== undefined) {
          const existing = currentRule.examples[currentExampleIndex] ?? '';
          currentRule.examples[currentExampleIndex] = cleanText(`${existing} ${trimmed}`);
        } else {
          currentRule.text = cleanText(`${currentRule.text} ${trimmed}`);
          currentRule.hash = hashText(currentRule.text);
        }
        continue;
      }

      addUnclassified(
        lineNumber,
        line,
        isMalformedRuleCandidate(trimmed)
          ? 'malformed rule or numbered heading'
          : 'unknown meaningful line in numbered rules',
      );
      continue;
    }

    if (phase === 'glossary') {
      if (trimmed === 'Credits') {
        classify('credits');
        phase = 'credits';
        currentGlossary = undefined;
        continue;
      }

      const startsNewEntry =
        !currentGlossary ||
        (glossaryAfterBlank && Boolean(currentGlossary.text) && !isIndented(line));

      if (startsNewEntry) {
        classify('glossary-entry');
        currentGlossary = { term: cleanText(trimmed), text: '' };
        glossary[currentGlossary.term] = currentGlossary;
      } else {
        classify(currentGlossary?.text ? 'continuation' : 'glossary-entry');
        if (currentGlossary) currentGlossary.text = cleanText(`${currentGlossary.text} ${trimmed}`);
      }
      glossaryAfterBlank = false;
      continue;
    }

    classify('credits');
    credits.push(cleanText(trimmed));
    const dateMatch = trimmed.match(EFFECTIVE_DATE);
    if (dateMatch && !effectiveDate) effectiveDate = dateMatch[1];
  }

  const classification: ClassificationStats = {
    read: lines.length,
    classified: lines.length - unclassified.length,
    meaningful: lines.filter((line) => !isBlank(line)).length,
    byType,
    unclassified,
  };

  return {
    version: '0.1.0',
    metadata: {
      ...(effectiveDate ? { effectiveDate } : { effectiveDate: '' }),
      ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
      ...(options.sourceSha256 ? { sourceSha256: options.sourceSha256 } : {}),
    },
    introduction,
    sections,
    rules,
    glossary,
    credits,
    classification,
  };
}

export function getRule(document: RulesDocument, id: string): Rule | undefined {
  return document.rules[id];
}
