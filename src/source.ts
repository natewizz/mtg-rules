import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import type { Diagnostic } from './types.js';
import { PACKAGE_VERSION } from './version.js';

export const WIZARDS_RULES_PAGE = 'https://magic.wizards.com/en/rules';
const WIZARDS_HOSTS = new Set(['magic.wizards.com', 'media.wizards.com']);

export interface RulesSource {
  url: string;
  text: string;
  sha256: string;
}

export class SourceError extends Error {
  constructor(
    message: string,
    public readonly diagnostic: Diagnostic,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

function get(url: string): Promise<{
  statusCode: number;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        headers: {
          'User-Agent': `mtg-rules/${PACKAGE_VERSION} (+https://github.com/natewizz/mtg-rules)`,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(60_000, () => req.destroy(new Error(`Request timed out: ${url}`)));
    req.end();
  });
}

function assertWizardsUrl(
  value: string,
  code: 'SOURCE_FETCH_FAILED' | 'SOURCE_LINK_NOT_FOUND',
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SourceError(`Invalid source URL: ${value}`, {
      code,
      message: `Invalid source URL: ${value}`,
      severity: 'error',
    });
  }
  if (url.protocol !== 'https:' || !WIZARDS_HOSTS.has(url.hostname)) {
    throw new SourceError(`Source must be hosted by Wizards of the Coast: ${value}`, {
      code,
      message: `Source must be hosted by Wizards of the Coast: ${value}`,
      severity: 'error',
    });
  }
  return url;
}

export function discoverRulesUrlFromHtml(html: string, pageUrl = WIZARDS_RULES_PAGE): string {
  let page: URL;
  try {
    page = assertWizardsUrl(pageUrl, 'SOURCE_LINK_NOT_FOUND');
  } catch (error) {
    throw error;
  }

  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((link): link is string => Boolean(link))
    .map((link) => {
      try {
        return new URL(link, page).toString();
      } catch {
        return undefined;
      }
    })
    .filter((link): link is string => Boolean(link));

  const candidates = links.filter((link) => {
    const url = new URL(link);
    return (
      WIZARDS_HOSTS.has(url.hostname) &&
      url.pathname.toLowerCase().endsWith('.txt') &&
      /magiccomprules/i.test(url.pathname)
    );
  });
  const candidate = candidates[0];
  if (!candidate) {
    throw new SourceError('Could not find an official Comprehensive Rules TXT link.', {
      code: 'SOURCE_LINK_NOT_FOUND',
      message: 'Could not find an official Comprehensive Rules TXT link.',
      severity: 'error',
    });
  }
  return candidate;
}

export async function discoverRulesUrl(pageUrl = WIZARDS_RULES_PAGE): Promise<string> {
  const page = assertWizardsUrl(pageUrl, 'SOURCE_LINK_NOT_FOUND');
  let response: Awaited<ReturnType<typeof get>>;
  try {
    response = await get(page.toString());
  } catch (error) {
    throw new SourceError(`Could not fetch Wizards rules page: ${String(error)}`, {
      code: 'SOURCE_FETCH_FAILED',
      message: `Could not fetch Wizards rules page: ${String(error)}`,
      severity: 'error',
    });
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new SourceError(`Wizards rules page returned HTTP ${response.statusCode}`, {
      code: 'SOURCE_FETCH_FAILED',
      message: `Wizards rules page returned HTTP ${response.statusCode}`,
      severity: 'error',
    });
  }
  return discoverRulesUrlFromHtml(response.body, page.toString());
}

export async function fetchRules(url?: string): Promise<RulesSource> {
  const sourceUrl = url ?? (await discoverRulesUrl());
  const source = assertWizardsUrl(sourceUrl, 'SOURCE_FETCH_FAILED');
  let response: Awaited<ReturnType<typeof get>>;
  try {
    response = await get(source.toString());
  } catch (error) {
    throw new SourceError(`Could not fetch rules TXT: ${String(error)}`, {
      code: 'SOURCE_FETCH_FAILED',
      message: `Could not fetch rules TXT: ${String(error)}`,
      severity: 'error',
    });
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new SourceError(`Rules TXT returned HTTP ${response.statusCode}`, {
      code: 'SOURCE_FETCH_FAILED',
      message: `Rules TXT returned HTTP ${response.statusCode}`,
      severity: 'error',
    });
  }
  const text = response.body;
  return {
    url: source.toString(),
    text,
    sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
  };
}

export async function writeRulesSource(path: string, source: RulesSource): Promise<void> {
  await writeFile(path, source.text, 'utf8');
}
