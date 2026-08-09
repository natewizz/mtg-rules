#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { getRule, hashText, parseRules } from './parser.js';
import { stringifyRules } from './json.js';
import { discoverRulesUrl, fetchRules } from './source.js';
import { validateRules } from './validator.js';

const program = new Command();
program
  .name('mtg-rules')
  .description('Parse and validate official MTG Comprehensive Rules data.')
  .version('0.1.0');

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

async function parseInput(path: string) {
  const text = await readFile(path, 'utf8');
  return parseRules(text, { sourceSha256: hashText(text) });
}

program
  .command('parse')
  .description('Parse a local official TXT file into deterministic JSON.')
  .argument('<input>', 'local TXT file')
  .requiredOption('-o, --output <path>', 'local JSON output path')
  .action(async (input: string, { output }: { output: string }) => {
    const document = await parseInput(input);
    const report = validateRules(document);
    await writeFile(output, stringifyRules(document), 'utf8');
    console.log(`Wrote ${output}`);
    printReport(report);
    if (!report.passed) process.exitCode = 1;
  });

program
  .command('validate')
  .description('Validate a local official TXT file without writing rules JSON.')
  .argument('<input>', 'local TXT file')
  .action(async (input: string) => {
    const document = await parseInput(input);
    const report = validateRules(document);
    printReport(report);
    if (!report.passed) process.exitCode = 1;
  });

program
  .command('rule')
  .description('Print a rule from a locally generated rules JSON file.')
  .argument('<id>', 'rule ID, e.g. 704.5f')
  .requiredOption('--from <path>', 'local rules JSON path')
  .action(async (id: string, { from }: { from: string }) => {
    const document = JSON.parse(await readFile(from, 'utf8'));
    const rule = getRule(document, id);
    if (!rule) {
      console.error(`Rule not found: ${id}`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(rule, null, 2));
  });

function printReport(report: ReturnType<typeof validateRules>): void {
  console.log(`Lines read: ${report.stats.linesRead}`);
  console.log(`Lines classified: ${report.stats.linesClassified}`);
  console.log(`Meaningful lines: ${report.stats.meaningfulLines}`);
  console.log(`Unclassified meaningful lines: ${report.stats.unclassifiedMeaningfulLines}`);
  console.log(`Rules: ${report.stats.ruleCount}`);
  console.log(`Sections: ${report.stats.sectionCount}`);
  console.log(`Glossary entries: ${report.stats.glossaryCount}`);
  if (report.passed) console.log('Validation passed.');
  else {
    console.error(`Validation failed with ${report.issues.length} issue(s).`);
    for (const issue of report.issues.slice(0, 20)) {
      console.error(`- ${issue.code}: ${issue.message}`);
    }
    if (report.issues.length > 20) console.error(`...and ${report.issues.length - 20} more.`);
  }
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js')) {
  program.parseAsync().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
