import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'mtg-rules-package-'));
let tarball;

try {
  const { stdout } = await exec('npm', ['pack', '--json'], { cwd: root });
  const result = JSON.parse(stdout);
  tarball = result[0]?.filename;
  if (!tarball) throw new Error('npm pack did not report a tarball.');

  const packagePath = join(root, tarball);
  const metadata = result[0];
  const files = metadata.files.map((file) => file.path);
  const forbidden = files.filter((file) =>
    /MagicCompRules|rules\.json|\.rules\.txt|\.cr\.txt|\.env|secret|credential|WIZARDS_PERMISSION|v0\.1\.1\.md|v012\.md/i.test(
      file,
    ),
  );
  const allowedRoots = ['dist/', 'schema/', 'LICENSE', 'README.md', 'package.json', 'CHANGELOG.md'];
  const unexpected = files.filter(
    (file) => !allowedRoots.some((root) => file === root || file.startsWith(root)),
  );
  if (forbidden.length > 0) throw new Error(`Forbidden package files: ${forbidden.join(', ')}`);
  if (unexpected.length > 0) throw new Error(`Unexpected package files: ${unexpected.join(', ')}`);

  await exec('npm', ['init', '-y'], { cwd: temp, maxBuffer: 1024 * 1024 });
  await exec('npm', ['install', packagePath, 'typescript'], { cwd: temp, maxBuffer: 1024 * 1024 });
  await writeFile(
    join(temp, 'consumer.mjs'),
    `import { isRuleId, parseRules, validateRules } from 'mtg-rules';\n\nif (!isRuleId('704.5f')) throw new Error('Public export failed');\nconst document = parseRules('Magic: The Gathering Comprehensive Rules\\n\\nThese rules are effective as of January 1, 2099.\\n\\nIntroduction\\n\\nContents\\n\\n1. Game Concepts\\nCredits\\n\\n1. Game Concepts\\n\\n100. General\\n\\n100.1. Test\\n\\nGlossary\\n\\nAbility\\n\\nDefinition\\n\\nCredits\\n\\nCredit\\n');\nif (!document.rules['100.1']) throw new Error('Parser import failed');\nif (typeof validateRules(document).valid !== 'boolean') throw new Error('Validator import failed');\n`,
  );
  await writeFile(
    join(temp, 'consumer.ts'),
    `import { diffRules, getRule, isRuleId, parseRules, validateRules } from 'mtg-rules';\nconst source = '';\nconst document = parseRules(source);\nconst rule = getRule(document, '704.5f');\nconst valid: boolean = validateRules(document).valid;\nconst diff = diffRules(document, document);\nconst id: boolean = isRuleId('704.5f');\nvoid rule; void valid; void diff; void id;\n`,
  );
  await writeFile(
    join(temp, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
      },
      include: ['consumer.ts'],
    }),
  );
  await exec(process.execPath, [join(temp, 'consumer.mjs')], { cwd: temp });
  await exec(
    process.execPath,
    [join(temp, 'node_modules/typescript/bin/tsc'), '--project', join(temp, 'tsconfig.json')],
    { cwd: temp },
  );
  const { stdout: version } = await exec(process.execPath, [
    join(temp, 'node_modules/mtg-rules/dist/cli.js'),
    '--version',
  ]);
  if (version.trim() !== '0.1.2') throw new Error(`Unexpected CLI version: ${version}`);

  console.log(
    `Package check passed: ${files.length} package files; consumer import and CLI verified.`,
  );
} finally {
  if (tarball) await rm(join(root, tarball), { force: true });
  await rm(temp, { recursive: true, force: true });
}
