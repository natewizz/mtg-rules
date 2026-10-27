import { lookupGlossaryTerm, lookupRule, searchDocument } from './tools.mjs';

const UNOFFICIAL =
  'Unofficial fan content. Returns official wording and does not judge card interactions.';

export async function registerLookupTools(
  modelContext,
  { rulesDocument = null, tournamentDocument = null, signal } = {},
) {
  if (!modelContext?.registerTool) return [];

  const tools = [
    ...(rulesDocument ? rulesTools(rulesDocument) : []),
    ...(tournamentDocument ? tournamentTools(tournamentDocument) : []),
  ];
  const options = signal ? { signal } : {};
  for (const tool of tools) await modelContext.registerTool(tool, options);
  return tools.map((tool) => tool.name);
}

function rulesTools(document) {
  return [
    {
      name: 'lookup-rule',
      title: 'Look up a Comprehensive Rules rule',
      description: `Return the Comprehensive Rules wording for one rule id, including examples. A keyword heading also includes its lettered subrules. ${UNOFFICIAL}`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Rule id, such as 704.5f or 702.19.' },
        },
        required: ['id'],
      },
      async execute({ id } = {}) {
        return lookupRule(document, id);
      },
    },
    {
      name: 'search-rules',
      title: 'Search the Comprehensive Rules',
      description: `Search the Comprehensive Rules by id, id prefix, or wording. Returns matching ids and short excerpts. ${UNOFFICIAL}`,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Rule id, prefix, or wording to find.' },
          limit: {
            type: 'integer',
            description: 'Maximum matches to return. Defaults to 20 and will not exceed 20.',
          },
        },
        required: ['query'],
      },
      async execute({ query, limit } = {}) {
        return searchDocument(document, query, limit);
      },
    },
    {
      name: 'lookup-glossary',
      title: 'Look up a glossary term',
      description: `Return the Comprehensive Rules glossary definition for an exact term. ${UNOFFICIAL}`,
      inputSchema: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Glossary term, such as Trample.' },
        },
        required: ['term'],
      },
      async execute({ term } = {}) {
        return lookupGlossaryTerm(document, term);
      },
    },
  ];
}

function tournamentTools(document) {
  return [
    {
      name: 'lookup-tournament-rule',
      title: 'Look up a Tournament Rules section',
      description: `Return one Magic Tournament Rules section by id, such as 2.12 or Appendix C. ${UNOFFICIAL}`,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Section id, such as 2.12 or Appendix C.' },
        },
        required: ['id'],
      },
      async execute({ id } = {}) {
        return lookupRule(document, id);
      },
    },
    {
      name: 'search-tournament-rules',
      title: 'Search the Tournament Rules',
      description: `Search the Magic Tournament Rules by section id, title, or wording. A numeric query matches that chapter only. ${UNOFFICIAL}`,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Section id, title, or wording to find.' },
          limit: {
            type: 'integer',
            description: 'Maximum matches to return. Defaults to 20 and will not exceed 20.',
          },
        },
        required: ['query'],
      },
      async execute({ query, limit } = {}) {
        return searchDocument(document, query, limit, { numericBoundary: true });
      },
    },
  ];
}
