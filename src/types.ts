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

export interface ClassificationStats {
  read: number;
  classified: number;
  meaningful: number;
  byType: Record<LineClassification, number>;
  unclassified: Array<{ line: number; text: string; reason: string }>;
}

export interface RulesDocument {
  version: '0.1.0';
  metadata: {
    effectiveDate: string;
    sourceUrl?: string;
    sourceSha256?: string;
  };
  introduction: string[];
  sections: Record<string, RulesSection>;
  rules: Record<string, Rule>;
  glossary: Record<string, GlossaryEntry>;
  credits: string[];
  classification: ClassificationStats;
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
  passed: boolean;
  issues: ValidationIssue[];
  stats: {
    linesRead: number;
    linesClassified: number;
    meaningfulLines: number;
    unclassifiedMeaningfulLines: number;
    ruleCount: number;
    sectionCount: number;
    glossaryCount: number;
  };
}
