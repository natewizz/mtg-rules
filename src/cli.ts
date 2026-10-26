#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { diffRules } from './diff.js';
import { parseTournamentRules, stringifyTournamentRules } from './mtr-parser.js';
import { getRule, hashText, parseRules } from './parser.js';
import { stringifyRules } from './json.js';
import { PackageDataError, packageRulesSource, writePackagedRules } from './package-data.js';
import { fetchRules, SourceError } from './source.js';
import { validateRules } from './validator.js';
import type { RulesDocument, ValidationReport } from './types.js';
import { PACKAGE_VERSION } from './version.js';

const VERSION = PACKAGE_VERSION;
const program = new Command();

program
  .name('mtg-rules')
  .description('Parse and validate official MTG Comprehensive Rules and Tournament Rules data.')
  .showSuggestionAfterError()
  .version(VERSION);

program
  .command('fetch')
  .description('Discover and fetch the current official Wizards TXT file.')
  .addHelpText('after', '\nExample:\n  $ mtg-rules fetch -o MagicCompRules.txt\n')
  .requiredOption('-o, --output <path>', 'local output path')
  .action(async ({ output }: { output: string }) => {
    const source = await fetchRules();
    await writeFile(output, source.text, 'utf8');
    console.log(`Fetched ${source.url}`);
    console.log(`SHA-256: ${source.sha256}`);
    console.log(`Wrote local source: ${output}`);
  });

async function parseInput(path: string, sourceUrl?: string): Promise<RulesDocument> {
  const text = await readTextFile(path);
  return parseRules(text, {
    ...(sourceUrl ? { sourceUrl } : {}),
    sourceSha256: hashText(text),
  });
}

async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read rules file: ${path} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

async function loadDocument(path: string): Promise<RulesDocument> {
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text) as RulesDocument;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Could not parse generated rules JSON: ${path}`);
    }
    throw new Error(
      `Could not read generated rules JSON: ${path} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

program
  .command('package-data')
  .description('Write an approved generated-JSON artifact with required unofficial notices.')
  .addHelpText(
    'after',
    '\nExamples:\n  $ mtg-rules package-data MagicCompRules.txt -o output/rules.json --profile complete-generated-document --source-url https://media.wizards.com/2026/downloads/MagicCompRules.txt\n  $ mtg-rules package-data --fetch -o output/rules.json --profile complete-generated-document\n',
  )
  .argument('[input]', 'local TXT file (required unless --fetch)')
  .requiredOption('-o, --output <path>', 'JSON output path for the approved artifact')
  .requiredOption('--profile <name>', 'data profile; must be complete-generated-document')
  .option('--fetch', 'fetch the current official source instead of reading a local file')
  .option('--source-url <url>', 'official Wizards source URL recorded in provenance')
  .option('--notice-output <path>', 'NOTICE.txt path (defaults to NOTICE.txt beside the JSON)')
  .action(
    async (
      input: string | undefined,
      options: {
        output: string;
        profile: string;
        fetch?: boolean;
        sourceUrl?: string;
        noticeOutput?: string;
      },
    ) => {
      if (options.fetch && input) {
        throw new PackageDataError('Provide a local TXT file or --fetch, not both.');
      }
      if (!options.fetch && !input) {
        throw new PackageDataError('Provide a local TXT file or --fetch.');
      }

      let sourceText: string;
      let sourceUrl = options.sourceUrl;
      let sourceSha256: string;

      if (options.fetch) {
        const source = await fetchRules();
        sourceText = source.text;
        sourceUrl = source.url;
        sourceSha256 = source.sha256;
      } else {
        sourceText = await readTextFile(input as string);
        sourceSha256 = hashText(sourceText);
      }

      if (!sourceUrl) {
        throw new PackageDataError(
          'package-data requires --source-url or --fetch so provenance can be recorded.',
        );
      }

      const document = packageRulesSource(sourceText, {
        profile: options.profile,
        sourceUrl,
        sourceSha256,
      });
      const noticePath = options.noticeOutput ?? join(dirname(options.output), 'NOTICE.txt');
      await writePackagedRules(document, { jsonPath: options.output, noticePath });
      console.log(`Profile: ${document.metadata.dataProfile}`);
      console.log(`Effective date: ${document.metadata.effectiveDate}`);
      console.log(`Source: ${document.metadata.sourceUrl}`);
      console.log(`SHA-256: ${document.metadata.sourceSha256}`);
      console.log(`Wrote ${options.output}`);
      console.log(`Wrote ${noticePath}`);
    },
  );

program
  .command('parse')
  .description('Parse a local official TXT file into deterministic JSON.')
  .addHelpText('after', '\nExample:\n  $ mtg-rules parse MagicCompRules.txt -o rules.json\n')
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
  .command('parse-mtr')
  .description('Parse a Magic Tournament Rules text extract into deterministic JSON.')
  .addHelpText(
    'after',
    '\nExample:\n  $ mtg-rules parse-mtr mtr.txt -o mtr.json --source-sha256 <pdf-sha256>\n',
  )
  .argument('<input>', 'text extracted from the tournament rules PDF')
  .requiredOption('-o, --output <path>', 'local JSON output path')
  .option('--source-url <url>', 'official source page recorded in provenance')
  .option('--source-sha256 <hash>', 'SHA-256 of the source PDF')
  .option(
    '--link <url>',
    'external URL to record; repeat for each PDF link that is not written out in the text',
    (value: string, previous: string[]) => {
      previous.push(value);
      return previous;
    },
    [] as string[],
  )
  .action(
    async (
      input: string,
      options: { output: string; sourceUrl?: string; sourceSha256?: string; link: string[] },
    ) => {
      if (options.sourceSha256 && !/^[a-f0-9]{64}$/.test(options.sourceSha256)) {
        throw new Error('--source-sha256 must be 64 lowercase hex characters.');
      }
      const document = parseTournamentRules(await readTextFile(input), {
        ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
        ...(options.sourceSha256 ? { sourceSha256: options.sourceSha256 } : {}),
        externalLinks: options.link,
      });
      await writeFile(options.output, stringifyTournamentRules(document), 'utf8');
      const ruleCount = Object.keys(document.rules).length;
      console.log(`Wrote ${options.output}`);
      console.log(`Effective date: ${document.metadata.effectiveDate || '(missing)'}`);
      console.log(`Sections: ${Object.keys(document.sections).length}`);
      console.log(`Rules: ${ruleCount}`);
      console.log(
        `Appendices: ${Object.keys(document.rules).filter((id) => id.startsWith('Appendix ')).length}`,
      );
      if (!document.metadata.effectiveDate || document.classification.unclassified.length > 0) {
        for (const item of document.classification.unclassified) console.error(`- ${item}`);
        console.error('Tournament rules parse failed.');
        process.exitCode = 1;
      }
    },
  );

program
  .command('validate')
  .description('Validate a local official TXT file without writing generated rules JSON.')
  .addHelpText('after', '\nExample:\n  $ mtg-rules validate MagicCompRules.txt --json\n')
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
  .addHelpText('after', '\nExample:\n  $ mtg-rules doctor MagicCompRules.txt\n')
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
  .addHelpText('after', '\nExample:\n  $ mtg-rules rule 704.5f --from rules.json\n')
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
  .addHelpText('after', '\nExample:\n  $ mtg-rules diff old.json new.json\n')
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
    const errors = report.diagnostics.filter((item) => item.severity === 'error').length;
    console.error(
      `Validation failed: ${errors} error(s). Run with --json for structured diagnostics.`,
    );
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
  else if (error instanceof PackageDataError) console.error(error.message);
  else console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
