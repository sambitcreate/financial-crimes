import type { APIRoute } from 'astro';
import { loadAllArticles } from '../loaders/articles';
import { getPaintRefLookup } from '../painting/refs-loader';
import { buildCreditEntries, CREDITS_PAGE_SIZE } from '../utils/ledger';

export const GET: APIRoute = async () => {
  const [articles, { manifest }] = await Promise.all([loadAllArticles(), getPaintRefLookup()]);
  const entries = buildCreditEntries(articles, manifest);

  const payload = {
    generated_at: new Date().toISOString(),
    total: entries.length,
    page_size: CREDITS_PAGE_SIZE,
    entries,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
