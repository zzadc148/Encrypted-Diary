import type { DiaryRecord, SearchResult } from './models';

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function tokenizeQuery(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildSnippet(content: string, query: string): string {
  const normalizedContent = content.replace(/\s+/g, ' ').trim();
  if (!normalizedContent) {
    return '';
  }

  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return normalizedContent.slice(0, 120);
  }

  const lowerContent = normalizedContent.toLowerCase();
  const matches = tokens
    .map((token) => lowerContent.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  const matchIndex = matches[0];

  if (matchIndex === undefined) {
    return normalizedContent.slice(0, 120);
  }

  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(normalizedContent.length, matchIndex + 90);
  const snippet = normalizedContent.slice(start, end);
  return start > 0 ? `...${snippet}` : snippet;
}

export function searchDiaries(records: DiaryRecord[], query: string): SearchResult[] {
  const tokens = tokenizeQuery(query);

  return records
    .map((record) => {
      const title = normalizeText(record.title);
      const content = normalizeText(record.content);
      const titleHits = tokens.filter((token) => title.includes(token)).length;
      const contentHits = tokens.filter((token) => content.includes(token)).length;
      const score = titleHits * 3 + contentHits;

      return {
        ...record,
        score,
        snippet: buildSnippet(record.content, query),
      };
    })
    .filter((record) => tokens.length === 0 || record.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
}

