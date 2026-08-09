import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { request } from 'node:https';

export const WIZARDS_RULES_PAGE = 'https://magic.wizards.com/en/rules';

export interface RulesSource {
  url: string;
  text: string;
  sha256: string;
}

function get(url: string): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { headers: { 'User-Agent': 'mtg-rules/0.1 (+https://github.com)' } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
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

export async function discoverRulesUrl(pageUrl = WIZARDS_RULES_PAGE): Promise<string> {
  const response = await get(pageUrl);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Wizards rules page returned HTTP ${response.statusCode}`);
  }

  const links = [...response.body.matchAll(/href=["']([^"']+\.txt(?:\?[^"']*)?)["']/gi)].map(
    (match) => match[1],
  );
  const absolute = links
    .filter((link): link is string => Boolean(link))
    .map((link) => new URL(link, pageUrl).toString());
  const candidate = absolute.find((url) => /MagicCompRules/i.test(url));
  if (!candidate) throw new Error('Could not find an official Comprehensive Rules TXT link.');
  return candidate;
}

export async function fetchRules(url?: string): Promise<RulesSource> {
  const sourceUrl = url ?? (await discoverRulesUrl());
  const response = await get(sourceUrl);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Rules TXT returned HTTP ${response.statusCode}`);
  }
  const text = response.body;
  return {
    url: sourceUrl,
    text,
    sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
  };
}

export async function writeRulesSource(path: string, source: RulesSource): Promise<void> {
  await writeFile(path, source.text, 'utf8');
}
