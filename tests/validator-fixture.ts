/**
 * Builds a throwaway content tree (temp dir) for exercising scripts/validate-content.mjs
 * against hostile fixtures. Not a test file itself (vitest only picks up *.test.ts).
 */
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateContent } from '../scripts/validate-content.mjs';

export const FIXTURE_NOW = '2026-11-22T12:00:00Z';
export const EDITION_DATE = '2026-11-20';

const REAL_JPEG_DIR = path.join(process.cwd(), 'public', 'paint-refs');
const sampleJpegName = (() => {
  const names = readFileSync(path.join(process.cwd(), 'content', 'paint-refs.json'), 'utf-8');
  return Object.keys(JSON.parse(names))[0];
})();
/** A real, contract-compliant reference JPEG from the repo. */
export const VALID_JPEG: Buffer = readFileSync(path.join(REAL_JPEG_DIR, `${sampleJpegName}.jpg`));

export const SLOT_ORDER = [
  'lead_hero',
  'lead_live',
  'lead_right',
  'lead_grid',
  'secondary_1',
  'secondary_2',
  'rail_feature',
  'rail_mini',
  'rail_opinion',
] as const;

export type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ArticleFixture {
  /** Path under content/articles, e.g. "2026/11". */
  dir: string;
  meta: Json;
  body: string;
}

export interface Fixture {
  articles: ArticleFixture[];
  paintRefs: Record<string, Json>;
  jpegs: Record<string, Buffer>;
  editions: Record<string, Json | string>;
  rollup: Json | null;
  extraFiles: Record<string, string | Buffer>;
}

export const BODY_HTML = [
  '<p class="fc-lead"><span class="fc-dateline">NEW YORK —</span> Federal prosecutors announced the sentence on Thursday after a lengthy trial in the Southern District.</p>',
  '<h2>The Docket</h2>',
  '<p>According to the filing, the scheme diverted investor money into personal accounts over several years, the government said in its release.</p>',
].join('\n');

export function makeMeta(n: number, overrides: Json = {}): Json {
  const slug = `case-${n}`;
  return {
    id: `fc-test-${String(n).padStart(3, '0')}`,
    slug,
    publish_date: '2026-11-20T06:00:00-05:00',
    edition_date: EDITION_DATE,
    city: 'New York',
    edition: 'U.S.',
    jurisdiction: { country_iso: 'US', venue: 'S.D.N.Y.' },
    category: 'Securities Fraud',
    agencies: ['DOJ'],
    docket_number: '1:26-cr-00001',
    legal_stage: 'sentenced',
    template: 'news',
    eyebrow: 'SENTENCING',
    headline: `Executive ${n} Receives Sentence in Investor Scheme`,
    deck: 'A federal judge imposed the sentence after trial.',
    byline: 'The Docket Desk',
    dateline: 'NEW YORK',
    read_time_min: 3,
    layout_slot: 'ledger',
    financials: {
      amount_usd: 10_000_000,
      amount_display: '$10M',
      fine_usd: 1_000_000,
      fine_display: '$1M',
      fine_ratio_pct: 10,
      prison_months: 24,
      prison_display: '24 months',
      admitted_guilt: true,
    },
    slap_on_wrist_score: 40,
    score_provenance: {
      model: 'gemini-2.5-pro',
      prompt_sha256: 'a'.repeat(64),
      judged_at: '2026-11-20T10:00:00Z',
    },
    street_crime_compare: {
      exec_summary: 'Two years.',
      street_equivalent: 'Shoplifting',
      street_sentence: 'Comparable',
    },
    sources: [
      {
        title: 'Executive sentenced',
        agency: 'DOJ',
        url: `https://www.justice.gov/usao-sdny/pr/executive-${n}-sentenced`,
        date: '2026-11-19',
      },
    ],
    interactive_art_spec: { accent: 'crimson', theme: 'newsprint', caption: `Caption ${n}` },
    status: 'published',
    ...overrides,
  };
}

export function makePaintRef(slug: string, overrides: Json = {}): Json {
  return {
    refImage: `/paint-refs/${slug}.jpg`,
    subject: 'Federal courthouse, Manhattan',
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${slug}.jpg`,
    sourceLicense: 'CC BY-SA 4.0',
    isPortrait: false,
    focalPoint: { u: 0.5, v: 0.4 },
    paletteMood: 'courtroom-ochre',
    toyKind: 'stamp',
    toyText: '24 MOS',
    toySubtext: 'SENTENCED',
    alt: 'Impressionist oil painting of a courthouse facade.',
    ...overrides,
  };
}

export function makeEdition(slugs: string[], date = EDITION_DATE): Json {
  const [a, b, c, d, e, f, g, h, i, ...rest] = slugs;
  return {
    edition_date: date,
    volume: 'Vol. I, No. 9',
    display_date: 'Friday, November 20, 2026',
    tagline: 'All the Crimes Fit to Fine.',
    published_at: `${date}T07:00:00-05:00`,
    slots: {
      lead_hero: a,
      lead_live: b,
      lead_right: c,
      lead_grid: [d],
      secondary_1: e,
      secondary_2: f,
      rail_feature: g,
      rail_mini: [h],
      rail_opinion: [i],
      ledger: rest,
    },
    article_slugs: [...slugs],
  };
}

export function baseFixture(count = 9): Fixture {
  const articles: ArticleFixture[] = [];
  const paintRefs: Record<string, Json> = {};
  const jpegs: Record<string, Buffer> = {};
  for (let n = 1; n <= count; n++) {
    const meta = makeMeta(n);
    articles.push({ dir: '2026/11', meta, body: BODY_HTML });
    paintRefs[meta.slug] = makePaintRef(meta.slug);
    jpegs[meta.slug] = VALID_JPEG;
  }
  const slugs = articles.map((a) => a.meta.slug);
  const edition = makeEdition(slugs);
  return {
    articles,
    paintRefs,
    jpegs,
    editions: { [`${EDITION_DATE}.json`]: edition, 'latest.json': structuredClone(edition) },
    rollup: {
      as_of: '2026-11-20T11:00:00.000Z',
      edition_date: EDITION_DATE,
      total_cases: count,
      total_loot_usd: 90_000_000,
      total_loot_display: '$90M',
      total_fines_usd: 9_000_000,
      total_fines_display: '$9M',
      avg_fine_ratio_pct: 10,
      avg_slap_on_wrist_score: 40,
      zero_prison_cases: 0,
      regions: {},
    },
    extraFiles: {},
  };
}

export async function writeFixture(fx: Fixture): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fc-validator-'));
  const write = async (rel: string, data: string | Buffer) => {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  };
  for (const a of fx.articles) {
    const dir = `content/articles/${a.dir}/${a.meta.slug}`;
    await write(`${dir}/meta.json`, JSON.stringify(a.meta, null, 2));
    await write(`${dir}/body.html`, a.body);
  }
  await write('content/paint-refs.json', JSON.stringify(fx.paintRefs, null, 2));
  for (const [slug, buf] of Object.entries(fx.jpegs)) {
    await write(`public/paint-refs/${slug}.jpg`, buf);
  }
  await fs.mkdir(path.join(root, 'content/editions'), { recursive: true });
  for (const [name, data] of Object.entries(fx.editions)) {
    await write(
      `content/editions/${name}`,
      typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    );
  }
  if (fx.rollup)
    await write('content/ledger/rollup-stats.json', JSON.stringify(fx.rollup, null, 2));
  for (const [rel, data] of Object.entries(fx.extraFiles)) await write(rel, data);
  return root;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  stats: { articles: number; paintRefs: number; editions: number };
}

/** Builds the base fixture, applies `mutate`, writes it, and validates it. */
export async function runFixture(
  mutate: (fx: Fixture) => void = () => {},
  opts: { now?: string | Date | null } = {}
): Promise<ValidationResult> {
  const fx = baseFixture();
  mutate(fx);
  const root = await writeFixture(fx);
  try {
    return await validateContent({ root, now: opts.now === undefined ? FIXTURE_NOW : opts.now });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

export function article(fx: Fixture, n = 1): ArticleFixture {
  return fx.articles[n - 1];
}

/** Rewrites both the dated edition and latest.json identically. */
export function setEdition(fx: Fixture, edition: Json) {
  fx.editions[`${EDITION_DATE}.json`] = edition;
  fx.editions['latest.json'] = structuredClone(edition);
}

export function expectError(result: ValidationResult, ...needles: string[]): void {
  for (const needle of needles) {
    if (!result.errors.some((e) => e.includes(needle))) {
      throw new Error(
        `Expected an error containing ${JSON.stringify(needle)}; got:\n  ${result.errors.join('\n  ') || '(no errors)'}`
      );
    }
  }
}
