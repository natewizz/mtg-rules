import { compareRuleIds, isRuleId, parentRuleId } from './rule-id.js';
import type { Diagnostic, RulesDocument, ValidationIssue, ValidationReport } from './types.js';

export function validateRules(document: RulesDocument): ValidationReport {
  const diagnostics: Diagnostic[] = [];
  const add = (diagnostic: Diagnostic): void => {
    diagnostics.push(diagnostic);
  };

  if (!document.metadata.effectiveDate) {
    add({
      code: 'MISSING_EFFECTIVE_DATE',
      message: 'No effective date was detected.',
      severity: 'error',
    });
  }

  if (Object.keys(document.sections).length === 0) {
    add({
      code: 'MISSING_SECTIONS',
      message: 'No numbered sections were parsed.',
      severity: 'error',
    });
  }

  if (Object.keys(document.glossary).length === 0) {
    add({
      code: 'MISSING_GLOSSARY',
      message: 'No glossary entries were parsed.',
      severity: 'error',
    });
  }

  if (document.credits.length === 0) {
    add({ code: 'MISSING_CREDITS', message: 'No credits were parsed.', severity: 'error' });
  }

  for (const item of document.classification.unclassified) {
    const isDuplicate = item.reason.startsWith('duplicate rule ID');
    const isMalformed = item.reason.includes('malformed rule');
    add({
      code: isDuplicate
        ? 'DUPLICATE_RULE_ID'
        : isMalformed
          ? 'INVALID_RULE_ID'
          : 'UNCLASSIFIED_LINE',
      message: `${item.reason}: ${item.text}`,
      severity: 'error',
      line: item.line,
    });
  }

  const ids = Object.keys(document.rules);
  const sortedIds = [...ids].sort(compareRuleIds);
  if (ids.some((id, index) => id !== sortedIds[index])) {
    add({
      code: 'INVALID_RULE_ORDER',
      message: 'Rules are not in canonical rule-ID order.',
      severity: 'warning',
    });
  }

  let orphanRules = 0;
  for (const id of ids) {
    if (!isRuleId(id) || id === '') {
      add({
        code: 'INVALID_RULE_ID',
        message: `Invalid rule ID: ${id}`,
        severity: 'error',
        ruleId: id,
      });
      continue;
    }

    const parent = parentRuleId(id);
    if (parent && !document.rules[parent]) {
      orphanRules += 1;
      add({
        code: 'ORPHAN_RULE',
        message: `Rule ${id} has no parsed parent rule ${parent}.`,
        severity: 'error',
        ruleId: id,
        expectedParent: parent,
      });
    }
  }

  const duplicateRuleIds = diagnostics.filter((item) => item.code === 'DUPLICATE_RULE_ID').length;
  const unclassifiedMeaningfulLines = diagnostics.filter(
    (item) => item.code === 'UNCLASSIFIED_LINE',
  ).length;
  const exampleCount = Object.values(document.rules).reduce(
    (count, rule) => count + rule.examples.length,
    0,
  );

  const stats = {
    linesRead: document.classification.read,
    linesClassified: document.classification.classified,
    meaningfulLines: document.classification.meaningful,
    unclassifiedMeaningfulLines,
    duplicateRuleIds,
    orphanRules,
    ruleCount: ids.length,
    sectionCount: Object.keys(document.sections).length,
    glossaryCount: Object.keys(document.glossary).length,
    exampleCount,
  };
  const valid = diagnostics.every((item) => item.severity !== 'error');
  const legacyCode: Record<Diagnostic['code'], ValidationIssue['code']> = {
    UNCLASSIFIED_LINE: 'unclassified-line',
    DUPLICATE_RULE_ID: 'duplicate-rule-id',
    INVALID_RULE_ID: 'invalid-rule-id',
    ORPHAN_RULE: 'orphan-subrule',
    MISSING_EFFECTIVE_DATE: 'missing-effective-date',
    MISSING_SECTIONS: 'missing-sections',
    MISSING_GLOSSARY: 'missing-glossary',
    MISSING_CREDITS: 'missing-credits',
    INVALID_RULE_ORDER: 'nondeterministic',
    UNEXPECTED_DOCUMENT_REGION: 'unclassified-line',
    SOURCE_FETCH_FAILED: 'unclassified-line',
    SOURCE_LINK_NOT_FOUND: 'unclassified-line',
  };
  const issues: ValidationIssue[] = diagnostics.map((item) => ({
    code: legacyCode[item.code],
    message: item.message,
    ...(item.line === undefined ? {} : { line: item.line }),
    ...(item.ruleId === undefined ? {} : { ruleId: item.ruleId }),
  }));

  return { valid, passed: valid, diagnostics, issues, stats };
}
