import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeRollup,
  isRetracted,
  loadRollupInputs,
  newestEditionDate,
  PENDING_STAGES,
  recomputeRollupFile,
  RESOLVED_STAGES,
} from '../scripts/lib/rollup.mjs';
import * as schema from '../src/schemas/article';
import {
  clearArticleCache,
  computeRollupFromArticles,
  loadAllArticles,
  loadAllArticlesIncludingRetracted,
  loadAllEditions,
  loadArticleBySlug,
  loadRollupStats,
} from '../src/loaders/articles';

const REPO = process.cwd();

type Art = {
  slug: string;
  legal_stage: string;
  edition: string;
  edition_date?: string;
  slap_on_wrist_score?: number | null;
  retracted?: unknown;
  financials: { amount_usd: number | null; fine_usd: number | null; prison_months: number | null };
};

function art(slug: string, legal_stage: string, amount: number | null, fine: number | null, extra: Partial<Art> = {}): Art {
  return {
    slug,
    legal_stage,
    edition: 'us',
    edition_date: '2026-11-19',
    slap_on_wrist_score: null,
    financials: { amount_usd: amount, fine_usd: fine, prison_months: null },
    ...extra,
  };
}

const FIXTURE: Art[] = [
  art('settled', 'settlement', 1000, 100, { slap_on_wrist_score: 80, financials: { amount_usd: 1000, fine_usd: 100, prison_months: 0 } }),
  art('sentenced', 'sentenced', 500, 500, { edition: 'london', slap_on_wrist_score: 20, financials: { amount_usd: 500, fine_usd: 500, prison_months: 60 } }),
  art('indicted-frozen', 'indicted', 2000, 300, { edition: 'europe' }),
  art('interim-escrow', 'interim_order', 400, 400, { edition: 'india' }),
  art('convicted', 'convicted', 50, null),
  art('acquitted', 'acquitted', 9999, 9999),
  art('withdrawn', 'settlement', 1_000_000, 1_000_000, { retracted: { date: '2026-11-21', note: 'Retracted: misidentified party.' }, slap_on_wrist_score: 99 }),
];

describe('computeRollup semantics', () => {
  const r = computeRollup(FIXTURE, { editions: [{ edition_date: '2026-11-19' }, { edition_date: '2026-11-22' }] });

  it('counts fines only from resolved, non-retracted cases', () => {
    expect(r.total_fines_usd).toBe(600);
    expect(r.avg_fine_ratio_pct).toBe(40); // 600 / 1500
  });

  it('reports frozen/escrowed money in unresolved cases separately', () => {
    expect(r.total_frozen_usd).toBe(700);
    expect(r.regions.europe.total_frozen_usd).toBe(300);
    expect(r.regions.europe.total_fines_usd).toBe(0);
    expect(r.regions.india.avg_fine_ratio_pct).toBeNull();
  });

  it('splits resolved vs alleged loot; cleared cases add no money', () => {
    expect(r.total_loot_resolved_usd).toBe(1500);
    expect(r.total_loot_alleged_usd).toBe(2450);
    expect(r.total_loot_usd).toBe(3950);
    expect(r.regions.global.total_loot_usd).toBe(3950);
  });

  it('excludes retracted articles from every total and count', () => {
    expect(r.total_cases).toBe(6);
    expect(r.retracted_cases).toBe(1);
    expect(r.resolved_cases).toBe(2);
    expect(r.unresolved_cases).toBe(4);
    expect(r.avg_slap_on_wrist_score).toBe(50);
    expect(r.zero_prison_cases).toBe(1);
    expect(r.regions.us.case_count).toBe(3);
    expect(isRetracted(FIXTURE[6])).toBe(true);
    expect(isRetracted(FIXTURE[0])).toBe(false);
  });

  it('takes edition_date from the newest dated edition, not article dates', () => {
    const withFutureArticle = [...FIXTURE, art('late', 'indicted', 1, null, { edition_date: '2026-12-01' })];
    expect(computeRollup(withFutureArticle, { editions: ['2026-11-22', '2026-11-19'] }).edition_date).toBe('2026-11-22');
    expect(newestEditionDate([{ edition_date: 'latest' }, { edition_date: '2026-11-19' }])).toBe('2026-11-19');
  });

  it('is deterministic regardless of input order', () => {
    const shuffled = [...FIXTURE].reverse();
    const a = computeRollup(FIXTURE, { editions: ['2026-11-22'] });
    const b = computeRollup(shuffled, { editions: ['2026-11-22'] });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a).not.toHaveProperty('as_of');
  });

  it('rejects malformed inputs and duplicate slugs', () => {
    expect(() => computeRollup([...FIXTURE, art('settled', 'dpa', 1, 1)])).toThrow(/duplicate slug/);
    expect(() => computeRollup([art('neg', 'settlement', -5, 1)])).toThrow(/amount_usd/);
    expect(() => computeRollup([art('bad', 'settled_out_of_court', 1, 1)])).toThrow(/legal_stage/);
  });

  it('keeps stage groups in sync with the schema exports when present', () => {
    expect([...RESOLVED_STAGES, ...PENDING_STAGES].every((s) => (schema.LEGAL_STAGES as readonly string[]).includes(s))).toBe(true);
    const s = schema as Record<string, unknown>;
    if (Array.isArray(s.RESOLVED_STAGES)) expect([...(s.RESOLVED_STAGES as string[])].sort()).toEqual([...RESOLVED_STAGES].sort());
    if (Array.isArray(s.PENDING_STAGES)) expect([...(s.PENDING_STAGES as string[])].sort()).toEqual([...PENDING_STAGES].sort());
  });
});

describe('recomputeRollupFile idempotency (temp repo)', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fc-rollup-'));
    for (const a of FIXTURE.slice(0, 4)) {
      const dir = path.join(root, 'content', 'articles', '2026', '11', a.slug);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(a));
    }
    await fs.mkdir(path.join(root, 'content', 'editions'), { recursive: true });
    await fs.writeFile(path.join(root, 'content', 'editions', '2026-11-22.json'), JSON.stringify({ edition_date: '2026-11-22' }));
    await fs.writeFile(path.join(root, 'content', 'editions', 'latest.json'), JSON.stringify({ edition_date: '2099-01-01' }));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('only bumps as_of when the computed body changes', async () => {
    const file = path.join(root, 'content', 'ledger', 'rollup-stats.json');
    const first = await recomputeRollupFile(root, { now: () => new Date('2026-11-22T00:00:00Z') });
    expect(first.changed).toBe(true);
    const bytes1 = await fs.readFile(file, 'utf-8');
    expect(JSON.parse(bytes1).as_of).toBe('2026-11-22T00:00:00.000Z');
    expect(JSON.parse(bytes1).edition_date).toBe('2026-11-22');

    const second = await recomputeRollupFile(root, { now: () => new Date('2030-01-01T00:00:00Z') });
    expect(second.changed).toBe(false);
    expect(await fs.readFile(file, 'utf-8')).toBe(bytes1);

    const metaFile = path.join(root, 'content', 'articles', '2026', '11', 'settled', 'meta.json');
    const meta = JSON.parse(await fs.readFile(metaFile, 'utf-8'));
    meta.financials.fine_usd = 250;
    await fs.writeFile(metaFile, JSON.stringify(meta));
    const third = await recomputeRollupFile(root, { now: () => new Date('2030-01-01T00:00:00Z') });
    expect(third.changed).toBe(true);
    expect(third.rollup.as_of).toBe('2030-01-01T00:00:00.000Z');
    expect(third.rollup.total_fines_usd).toBe(750);
  });

  it('validates inputs and edition filenames', async () => {
    await fs.writeFile(path.join(root, 'content', 'editions', '2026-11-23.json'), JSON.stringify({ edition_date: '2026-11-24' }));
    await expect(recomputeRollupFile(root)).rejects.toThrow(/does not match filename/);
    await fs.rm(path.join(root, 'content', 'editions', '2026-11-23.json'));
    const bad = path.join(root, 'content', 'articles', '2026', '11', 'settled', 'meta.json');
    await fs.writeFile(bad, '{ not json');
    await expect(recomputeRollupFile(root)).rejects.toThrow(/invalid JSON/);
  });
});

describe('real content parity', () => {
  beforeEach(() => clearArticleCache());

  it('content/ledger/rollup-stats.json equals computeRollup(real content) except as_of', async () => {
    const raw = JSON.parse(await fs.readFile(path.join(REPO, 'content', 'ledger', 'rollup-stats.json'), 'utf-8'));
    const { as_of: asOf, ...onDisk } = raw;
    expect(Number.isNaN(Date.parse(asOf))).toBe(false);
    const { articles, editions } = await loadRollupInputs(REPO);
    const computed = computeRollup(articles, { editions });
    expect(onDisk).toEqual(computed);
    expect(JSON.stringify(onDisk)).toBe(JSON.stringify(computed));
  });

  it('loader rollup matches the script rollup and uses the newest edition file', async () => {
    const [articles, editions, rollup] = await Promise.all([
      loadAllArticlesIncludingRetracted(),
      loadAllEditions(),
      loadRollupStats(),
    ]);
    const { articles: rawArticles, editions: rawEditions } = await loadRollupInputs(REPO);
    const { as_of: _a, ...fromLoader } = computeRollupFromArticles(articles, 'x', editions);
    expect(fromLoader).toEqual(computeRollup(rawArticles, { editions: rawEditions }));
    const newest = editions.map((e) => e.edition_date).sort().at(-1);
    expect(rollup.edition_date).toBe(newest);
    const disk = JSON.parse(await fs.readFile(path.join(REPO, 'content', 'ledger', 'rollup-stats.json'), 'utf-8'));
    expect(rollup.as_of).toBe(disk.as_of);
    expect(rollup.total_frozen_usd).toBe(disk.total_frozen_usd);
  });

  it('listing loader excludes retracted articles; slug lookup still returns everything', async () => {
    const [listed, all] = await Promise.all([loadAllArticles(), loadAllArticlesIncludingRetracted()]);
    expect(listed.every((a) => !isRetracted(a))).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(listed.length);
    const first = all[0];
    expect((await loadArticleBySlug(first.slug))?.slug).toBe(first.slug);
    expect(await loadArticleBySlug('no-such-slug')).toBeNull();
  });
});

describe('loader rejects duplicate slugs (V10)', () => {
  let root: string;
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (root) await fs.rm(root, { recursive: true, force: true });
  });

  it('throws instead of silently dropping one article', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'fc-dupe-'));
    const src = path.join(REPO, 'content', 'articles', '2026', '11', 'doj-innovage-pace-false-claims-settlement');
    for (const month of ['10', '11']) {
      const dir = path.join(root, 'content', 'articles', '2026', month, 'doj-innovage-pace-false-claims-settlement');
      await fs.mkdir(dir, { recursive: true });
      await fs.copyFile(path.join(src, 'meta.json'), path.join(dir, 'meta.json'));
      await fs.copyFile(path.join(src, 'body.html'), path.join(dir, 'body.html'));
    }
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    vi.resetModules();
    const fresh = await import('../src/loaders/articles');
    await expect(fresh.loadAllArticles()).rejects.toThrow(/Duplicate article slug/);
  });
});
