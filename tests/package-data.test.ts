import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { COMPLETE_GENERATED_DOCUMENT } from '../src/data-profile.js';
import { stringifyRules } from '../src/json.js';
import { renderNoticeText, UNOFFICIAL_NOTICE_STATEMENTS } from '../src/notices.js';
import {
  PackageDataError,
  packageRulesDocument,
  packageRulesSource,
  writePackagedRules,
} from '../src/package-data.js';
import { parseRules } from '../src/parser.js';
import { WIZARDS_RULES_PAGE } from '../src/source.js';

const fixturePath = fileURLToPath(new URL('./fixtures/synthetic-cr.txt', import.meta.url));
const fixture = await readFile(fixturePath, 'utf8');
const sourceUrl = 'https://media.wizards.com/2099/downloads/MagicCompRules.txt';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('parse vs package-data', () => {
  it('parse does not mark local JSON as a distributable artifact', () => {
    const document = parseRules(fixture, { sourceUrl, sourceSha256: 'a'.repeat(64) });
    expect(document.metadata.dataProfile).toBeUndefined();
    expect(document.metadata.notices).toBeUndefined();
  });
});

describe('packageRulesSource', () => {
  it('requires an explicit permitted profile and attaches notices and provenance', () => {
    expect(() => packageRulesSource(fixture, { profile: '', sourceUrl })).toThrow(PackageDataError);
    expect(() => packageRulesSource(fixture, { profile: 'metadata-only', sourceUrl })).toThrow(
      /unpermitted data profile/,
    );

    const document = packageRulesSource(fixture, {
      profile: COMPLETE_GENERATED_DOCUMENT,
      sourceUrl,
    });

    expect(document.version).toBe('0.2.0');
    expect(document.metadata.dataProfile).toBe(COMPLETE_GENERATED_DOCUMENT);
    expect(document.metadata.sourceUrl).toBe(sourceUrl);
    expect(document.metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(document.metadata.effectiveDate).toBe('January 1, 2099');
    expect(document.metadata.notices).toEqual({
      unofficial: true,
      freeUseOnly: true,
      commercialUsePermitted: false,
      statements: [...UNOFFICIAL_NOTICE_STATEMENTS],
      officialSourcePage: WIZARDS_RULES_PAGE,
    });
    expect(document.metadata.provenance).toMatchObject({
      provider: 'wizards-of-the-coast',
      document: 'magic-comprehensive-rules',
      effectiveDate: 'January 1, 2099',
      sourceUrl,
    });
    expect(stringifyRules(document)).toBe(stringifyRules(document));
    expect(stringifyRules(document)).not.toMatch(/\/Users\/|\/tmp\/|synthetic-cr/);
  });

  it('refuses invalid source URLs and failed validation', () => {
    expect(() =>
      packageRulesSource(fixture, {
        profile: COMPLETE_GENERATED_DOCUMENT,
        sourceUrl: 'https://example.test/MagicCompRules.txt',
      }),
    ).toThrow(/official Wizards/);

    expect(() =>
      packageRulesSource(
        fixture.replace('100.2. A multiline', 'not understood\n\n100.2. A multiline'),
        {
          profile: COMPLETE_GENERATED_DOCUMENT,
          sourceUrl,
        },
      ),
    ).toThrow(/validation failed/);
  });

  it('refuses to package a parsed document that is missing provenance', () => {
    const document = parseRules(fixture);
    expect(() =>
      packageRulesDocument(document, { profile: COMPLETE_GENERATED_DOCUMENT, sourceUrl }),
    ).toThrow(/source SHA-256/);
  });
});

describe('writePackagedRules', () => {
  it('keeps NOTICE.md synchronized with the generated notice text', async () => {
    const notice = await readFile(fileURLToPath(new URL('../NOTICE.md', import.meta.url)), 'utf8');
    expect(notice).toBe(renderNoticeText());
  });

  it('writes JSON and NOTICE sidecar and refuses artifacts without a profile', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mtg-rules-package-data-'));
    tempDirs.push(dir);
    const jsonPath = join(dir, 'rules.json');
    const noticePath = join(dir, 'NOTICE.txt');
    const document = packageRulesSource(fixture, {
      profile: COMPLETE_GENERATED_DOCUMENT,
      sourceUrl,
    });

    await writePackagedRules(document, { jsonPath, noticePath });

    const written = JSON.parse(await readFile(jsonPath, 'utf8')) as ReturnType<
      typeof packageRulesSource
    >;
    expect(written.metadata.dataProfile).toBe(COMPLETE_GENERATED_DOCUMENT);
    expect(written.metadata.notices?.unofficial).toBe(true);
    expect(written.metadata.notices?.freeUseOnly).toBe(true);
    expect(await readFile(noticePath, 'utf8')).toBe(renderNoticeText());

    await expect(writePackagedRules(parseRules(fixture), { jsonPath, noticePath })).rejects.toThrow(
      /without an explicit data profile/,
    );
  });
});
