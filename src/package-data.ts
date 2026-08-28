import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isPermittedDataProfile, type PermittedDataProfile } from './data-profile.js';
import { stringifyRules } from './json.js';
import { requiredNotices, renderNoticeText } from './notices.js';
import { hashText, parseRules } from './parser.js';
import { validateRules } from './validator.js';
import { DOCUMENT_VERSION } from './version.js';
import type { RulesDocument } from './types.js';

const LOCAL_PATH_OR_SECRET =
  /(?:\/Users\/|\/home\/|[A-Za-z]:\\|\.ssh\/|\bBEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY\b)/;

export class PackageDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageDataError';
  }
}

export function assertPermittedDataProfile(profile: string): PermittedDataProfile {
  if (!isPermittedDataProfile(profile)) {
    throw new PackageDataError(
      `Unknown or unpermitted data profile: ${profile}. Permitted: complete-generated-document`,
    );
  }
  return profile;
}

export function requireOfficialSourceUrl(value: string): string {
  if (!value) {
    throw new PackageDataError(
      'Cannot package data: an official Wizards source URL is required (--source-url or --fetch).',
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PackageDataError(`Invalid source URL: ${value}`);
  }
  if (
    url.protocol !== 'https:' ||
    (url.hostname !== 'magic.wizards.com' && url.hostname !== 'media.wizards.com')
  ) {
    throw new PackageDataError(`Source URL must be an official Wizards of the Coast URL: ${value}`);
  }
  return url.toString();
}

export function assertArtifactSafety(serialized: string): void {
  if (LOCAL_PATH_OR_SECRET.test(serialized)) {
    throw new PackageDataError(
      'Packaged artifact contains a local path or secret-like value and will not be written.',
    );
  }
}

export function packageRulesDocument(
  document: RulesDocument,
  options: { profile: string; sourceUrl?: string },
): RulesDocument {
  const profile = assertPermittedDataProfile(options.profile);
  const report = validateRules(document);
  if (!report.valid) {
    throw new PackageDataError(
      'Cannot package data: validation failed. Run mtg-rules validate or doctor first.',
    );
  }

  const sourceUrl = requireOfficialSourceUrl(
    options.sourceUrl ?? document.metadata.sourceUrl ?? '',
  );
  if (!document.metadata.effectiveDate) {
    throw new PackageDataError('Cannot package data: effective date is required.');
  }
  if (!document.metadata.sourceSha256) {
    throw new PackageDataError('Cannot package data: source SHA-256 is required.');
  }

  const notices = requiredNotices();
  return {
    ...document,
    version: DOCUMENT_VERSION,
    metadata: {
      ...document.metadata,
      sourceUrl,
      dataProfile: profile,
      notices,
      provenance: {
        provider: 'wizards-of-the-coast',
        document: 'magic-comprehensive-rules',
        effectiveDate: document.metadata.effectiveDate,
        sourceUrl,
        ...(document.metadata.sourceSha256 ? { sha256: document.metadata.sourceSha256 } : {}),
      },
    },
  };
}

export function packageRulesSource(
  sourceText: string,
  options: { profile: string; sourceUrl: string; sourceSha256?: string },
): RulesDocument {
  const sourceUrl = requireOfficialSourceUrl(options.sourceUrl);
  return packageRulesDocument(
    parseRules(sourceText, {
      sourceUrl,
      sourceSha256: options.sourceSha256 ?? hashText(sourceText),
    }),
    { profile: options.profile, sourceUrl },
  );
}

export async function writePackagedRules(
  document: RulesDocument,
  paths: { jsonPath: string; noticePath: string },
): Promise<void> {
  if (!document.metadata.dataProfile) {
    throw new PackageDataError(
      'Refusing to write a data artifact without an explicit data profile.',
    );
  }
  const json = stringifyRules(document);
  assertArtifactSafety(json);
  await mkdir(dirname(paths.jsonPath), { recursive: true });
  await mkdir(dirname(paths.noticePath), { recursive: true });
  await writeFile(paths.jsonPath, json, 'utf8');
  await writeFile(paths.noticePath, renderNoticeText(), 'utf8');
}
