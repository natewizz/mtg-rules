export type LineClassification =
  | 'metadata'
  | 'introduction'
  | 'contents'
  | 'section'
  | 'rule'
  | 'continuation'
  | 'example'
  | 'glossary'
  | 'glossary-entry'
  | 'credits'
  | 'blank';

export interface Rule {
  id: string;
  text: string;
  examples: string[];
  hash: string;
}

export interface GlossaryEntry {
  term: string;
  text: string;
}

export interface RulesSection {
  id: string;
  title: string;
}

export interface SourceProvenance {
  provider: 'wizards-of-the-coast';
  document: 'magic-comprehensive-rules';
  effectiveDate: string;
  sourceUrl?: string;
  sha256?: string;
}

export interface ClassificationStats {
  read: number;
  classified: number;
  meaningful: number;
  byType: Record<LineClassification, number>;
  unclassified: Array<{ line: number; text: string; reason: string }>;
}

export interface RulesDocument {
  version: '0.1.0' | '0.1.1' | '0.1.2';
  metadata: {
    effectiveDate: string;
    sourceUrl?: string;
    sourceSha256?: string;
    provenance?: SourceProvenance;
  };
  introduction: string[];
  sections: Record<string, RulesSection>;
  rules: Record<string, Rule>;
  glossary: Record<string, GlossaryEntry>;
  credits: string[];
  classification: ClassificationStats;
}

export type DiagnosticCode =
  | 'UNCLASSIFIED_LINE'
  | 'DUPLICATE_RULE_ID'
  | 'INVALID_RULE_ID'
  | 'ORPHAN_RULE'
  | 'MISSING_EFFECTIVE_DATE'
  | 'MISSING_SECTIONS'
  | 'MISSING_GLOSSARY'
  | 'MISSING_CREDITS'
  | 'INVALID_RULE_ORDER'
  | 'UNEXPECTED_DOCUMENT_REGION'
  | 'SOURCE_FETCH_FAILED'
  | 'SOURCE_LINK_NOT_FOUND';

export interface Diagnostic {
  code: DiagnosticCode;
  message: string;
  severity: 'error' | 'warning';
  line?: number;
  ruleId?: string;
  expectedParent?: string;
}

export interface ValidationIssue {
  code:
    | 'missing-effective-date'
    | 'invalid-rule-id'
    | 'duplicate-rule-id'
    | 'orphan-subrule'
    | 'unclassified-line'
    | 'missing-sections'
    | 'missing-glossary'
    | 'missing-credits'
    | 'nondeterministic';
  message: string;
  line?: number;
  ruleId?: string;
}

export interface ValidationReport {
  valid: boolean;
  passed: boolean;
  diagnostics: Diagnostic[];
  issues: ValidationIssue[];
  stats: {
    linesRead: number;
    linesClassified: number;
    meaningfulLines: number;
    unclassifiedMeaningfulLines: number;
    duplicateRuleIds: number;
    orphanRules: number;
    ruleCount: number;
    sectionCount: number;
    glossaryCount: number;
    exampleCount: number;
  };
}

export interface RulesDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged?: string[];
  oldSource?: SourceProvenance;
  newSource?: SourceProvenance;
}
