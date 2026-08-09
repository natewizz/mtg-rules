#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { diffRules } from './diff.js';
import { getRule, hashText, parseRules } from './parser.js';
import { stringifyRules } from './json.js';
import { discoverRulesUrl, fetchRules, SourceError } from './source.js';
import { validateRules } from './validator.js';
import type { RulesDocument, ValidationReport } from './types.js';

const VERSION = '0.1.1';
const program = new Command();

program
  .name('mtg-rules')
  .description('Parse and validate official MTG Comprehensive Rules data.')
  .version(VERSION);

program
  .command('fetch')
  .description('Discover and fetch the current official Wizards TXT file.')
  .requiredOption('-o, --output <path>', 'local output path')
  .action(async ({ output }: { output: string }) => {
    const source = await fetchRules();
    await writeFile(output, source.text, 'utf8');
    console.log(`Fetched ${source.url}`);
    console.log(`SHA-256: ${source.sha256}`);
    console.log(`Wrote local source: ${output}`);
  });

async function parseInput(path: string, sourceUrl?: string): Promise<RulesDocument> {
  const text = await readFile(path, 'utf8');
  return parseRules(text, {
    ...(sourceUrl ? { sourceUrl } : {}),
    sourceSha256: hashText(text),
  });
}

function loadDocument(path: string): Promise<RulesDocument> {
  return readFile(path, 'utf8').then((text) => JSON.parse(text) as RulesDocument);
}

program
  .command('parse')
  .description('Parse a local official TXT file into deterministic JSON.')
  .argument('<input>', 'local TXT file')
  .requiredOption('-o, --output <path>', 'local JSON output path')
  .option('--source-url <url>', 'official source URL to record in provenance')
  .action(async (input: string, options: { output: string; sourceUrl?: string }) => {
    const document = await parseInput(input, options.sourceUrl);
    const report = validateRules(document);
    await writeFile(options.output, stringifyRules(document), 'utf8');
    console.log(`Wrote ${options.output}`);
    printReport(report);
    if (!report.valid) process.exitCode = 1;
  });

program
  .command('validate')
  .description('Validate a local official TXT file without writing generated rules JSON.')
  .argument('<input>', 'local TXT file')
  .option('--source-url <url>', 'official source URL to record in provenance')
  .option('--json', 'print deterministic machine-readable diagnostics')
  .action(async (input: string, options: { sourceUrl?: string; json?: boolean }) => {
    const report = validateRules(await parseInput(input, options.sourceUrl));
    if (options.json) console.log(JSON.stringify(toJsonReport(report), null, 2));
    else printReport(report);
    if (!report.valid) process.exitCode = 1;
  });

program
  .command('doctor')
  .description('Check whether a local source is fully understood by this parser version.')
  .argument('<input>', 'local TXT file')
  .option('--source-url <url>', 'official source URL to record in provenance')
  .option('--json', 'print a deterministic machine-readable report')
  .action(async (input: string, options: { sourceUrl?: string; json?: boolean }) => {
    const document = await parseInput(input, options.sourceUrl);
    const report = validateRules(document);
    if (options.json) {
      console.log(
        JSON.stringify(
          { version: VERSION, document: summarize(document), ...toJsonReport(report) },
          null,
          2,
        ),
      );
    } else {
      console.log(`mtg-rules ${VERSION}\n`);
      console.log('Source');
      console.log(`  Effective date       ${document.metadata.effectiveDate || 'not detected'}`);
      console.log(`  SHA-256              ${document.metadata.sourceSha256 ?? 'not recorded'}`);
      console.log(`  Source URL           ${document.metadata.sourceUrl ?? 'not recorded'}`);
      console.log('\nParsing');
      console.log(`  Sections             ${report.stats.sectionCount}`);
      console.log(`  Rules                ${report.stats.ruleCount}`);
      console.log(`  Glossary entries     ${report.stats.glossaryCount}`);
      console.log(`  Examples             ${report.stats.exampleCount}`);
      console.log('\nValidation');
      console.log(`  Duplicate IDs        ${report.stats.duplicateRuleIds}`);
      console.log(`  Orphan rules         ${report.stats.orphanRules}`);
      console.log(`  Unclassified lines   ${report.stats.unclassifiedMeaningfulLines}`);
      console.log('\nResult');
      console.log(
        report.valid
          ? '  ✓ Source is fully understood by this parser'
          : '  ✗ Source is not fully understood by this parser',
      );
      if (!report.valid) printDiagnostics(report);
    }
    if (!report.valid) process.exitCode = 1;
  });

program
  .command('rule')
  .description('Print a rule from a locally generated rules JSON file.')
  .argument('<id>', 'rule ID, e.g. 704.5f')
  .requiredOption('--from <path>', 'local rules JSON path')
  .action(async (id: string, { from }: { from: string }) => {
    const rule = getRule(await loadDocument(from), id);
    if (!rule) {
      console.error(`Rule not found: ${id}`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(rule, null, 2));
  });

program
  .command('diff')
  .description('Diff two local generated rules JSON documents by rule ID and hash.')
  .argument('<old>', 'older local rules JSON path')
  .argument('<new>', 'newer local rules JSON path')
  .option('--json', 'print deterministic machine-readable output')
  .action(async (oldPath: string, newPath: string, options: { json?: boolean }) => {
    const result = diffRules(await loadDocument(oldPath), await loadDocument(newPath));
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printDiff(result);
  });

function summarize(document: RulesDocument) {
  return {
    effectiveDate: document.metadata.effectiveDate,
    sourceUrl: document.metadata.sourceUrl,
    sourceSha256: document.metadata.sourceSha256,
    sections: Object.keys(document.sections).length,
    rules: Object.keys(document.rules).length,
    glossaryEntries: Object.keys(document.glossary).length,
  };
}

function toJsonReport(report: ValidationReport) {
  return {
    valid: report.valid,
    errors: report.diagnostics.filter((item) => item.severity === 'error'),
    warnings: report.diagnostics.filter((item) => item.severity === 'warning'),
    stats: report.stats,
  };
}

function printReport(report: ValidationReport): void {
  console.log(`Lines read: ${report.stats.linesRead}`);
  console.log(`Lines classified: ${report.stats.linesClassified}`);
  console.log(`Meaningful lines: ${report.stats.meaningfulLines}`);
  console.log(`Unclassified meaningful lines: ${report.stats.unclassifiedMeaningfulLines}`);
  console.log(`Rules: ${report.stats.ruleCount}`);
  console.log(`Sections: ${report.stats.sectionCount}`);
  console.log(`Glossary entries: ${report.stats.glossaryCount}`);
  console.log(`Examples: ${report.stats.exampleCount}`);
  if (report.valid) console.log('Validation passed.');
  else {
    console.error(`Validation failed with ${report.diagnostics.length} diagnostic(s).`);
    printDiagnostics(report);
  }
}

function printDiagnostics(report: ValidationReport): void {
  for (const diagnostic of report.diagnostics.slice(0, 20)) {
    const location = diagnostic.line ? ` line ${diagnostic.line}` : '';
    console.error(`- [${diagnostic.code}]${location}: ${diagnostic.message}`);
  }
  if (report.diagnostics.length > 20) {
    console.error(`...and ${report.diagnostics.length - 20} more.`);
  }
}

function printDiff(result: ReturnType<typeof diffRules>): void {
  const print = (label: string, marker: string, ids: string[]) => {
    if (ids.length === 0) return;
    console.log(label);
    for (const id of ids) console.log(`${marker} ${id}`);
    console.log();
  };
  print('Added', '+', result.added);
  print('Changed', '~', result.changed);
  print('Removed', '-', result.removed);
  if (result.added.length + result.changed.length + result.removed.length === 0) {
    console.log('No rule changes.');
  }
}

program.parseAsync().catch((error: unknown) => {
  if (error instanceof SourceError) console.error(`[${error.diagnostic.code}] ${error.message}`);
  else console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
