import type { RulesDocument, ValidationIssue, ValidationReport } from './types.js';

const RULE_ID = /^\d+(?:\.\d+)+(?:[a-z]+)?$/;

function parentId(id: string): string | undefined {
  const match = id.match(/^(\d+(?:\.\d+)+)[a-z]+$/);
  return match?.[1];
}

export function validateRules(document: RulesDocument): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (!document.metadata.effectiveDate) {
    issues.push({ code: 'missing-effective-date', message: 'No effective date was detected.' });
  }

  if (Object.keys(document.sections).length === 0) {
    issues.push({ code: 'missing-sections', message: 'No numbered sections were parsed.' });
  }

  if (Object.keys(document.glossary).length === 0) {
    issues.push({ code: 'missing-glossary', message: 'No glossary entries were parsed.' });
  }

  if (document.credits.length === 0) {
    issues.push({ code: 'missing-credits', message: 'No credits were parsed.' });
  }

  for (const item of document.classification.unclassified) {
    const code = item.reason.startsWith('duplicate rule ID')
      ? 'duplicate-rule-id'
      : item.reason.includes('malformed rule')
        ? 'invalid-rule-id'
        : 'unclassified-line';
    issues.push({
      code,
      message: `${item.reason}: ${item.text}`,
      line: item.line,
    });
  }

  const ids = Object.keys(document.rules);
  for (const id of ids) {
    if (!RULE_ID.test(id)) {
      issues.push({ code: 'invalid-rule-id', message: `Invalid rule ID: ${id}`, ruleId: id });
    }

    const parent = parentId(id);
    if (parent && !document.rules[parent]) {
      issues.push({
        code: 'orphan-subrule',
        message: `Rule ${id} has no parsed parent rule ${parent}.`,
        ruleId: id,
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    stats: {
      linesRead: document.classification.read,
      linesClassified: document.classification.classified,
      meaningfulLines: document.classification.meaningful,
      unclassifiedMeaningfulLines: document.classification.unclassified.length,
      ruleCount: ids.length,
      sectionCount: Object.keys(document.sections).length,
      glossaryCount: Object.keys(document.glossary).length,
    },
  };
}
