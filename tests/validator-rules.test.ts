/**
 * Legal / scoring / schema rules (FINDINGS V1, V2, V9) exercised end-to-end through
 * validateContent() on hostile temp-dir fixtures.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ArticleMetaSchema,
  PENDING_STAGES,
  RESOLVED_STAGES,
  SOURCE_LICENSE_RE,
  computeFineRatioPct,
  findBannedTerms,
} from '../src/schemas/article';
import { article, expectError, makeMeta, runFixture, type Fixture } from './validator-fixture';

function makePending(fx: Fixture, n = 1, stage = 'indicted') {
  const a = article(fx, n);
  a.meta.legal_stage = stage;
  a.meta.slap_on_wrist_score = null;
  delete a.meta.score_provenance;
  a.meta.financials = {
    ...a.meta.financials,
    fine_usd: null,
    fine_ratio_pct: null,
    prison_months: null,
    admitted_guilt: null,
  };
  a.meta.headline = 'Executive Charged in Alleged Investor Scheme';
  a.meta.eyebrow = 'INDICTMENT';
  fx.paintRefs[a.meta.slug].toySubtext = 'INDICTED · PRESUMED INNOCENT';
  fx.paintRefs[a.meta.slug].toyText = '$10M ALLEGED';
}

describe('validator baseline', () => {
  it('accepts the clean base fixture with zero errors and zero warnings', async () => {
    const r = await runFixture();
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats.articles).toBe(9);
  });

  it('accepts a correctly worded pending story', async () => {
    const r = await runFixture((fx) => makePending(fx));
    expect(r.errors).toEqual([]);
  });

  it('imports the real schemas instead of keeping hand-copied duplicates (V2)', async () => {
    const src = await fs.readFile(
      path.join(process.cwd(), 'scripts', 'validate-content.mjs'),
      'utf-8'
    );
    expect(src).toContain("from '../src/schemas/article.ts'");
    expect(src).toContain("from '../src/utils/sanitize.ts'");
    expect(src).not.toMatch(/z\.object\(/);
    expect(src).not.toMatch(/from 'zod'/);
  });
});

describe('presumption of innocence & banned terms (V1)', () => {
  it('rejects "GUILTY: Convicted Fraudster Behind Bars" on an indicted story', async () => {
    const r = await runFixture((fx) => {
      makePending(fx);
      article(fx).meta.headline = 'GUILTY: Convicted Fraudster Behind Bars';
    });
    expectError(
      r,
      'headline uses banned term(s)',
      'GUILTY',
      'CONVICTED',
      'FRAUDSTER',
      'BEHIND BARS'
    );
  });

  it('rejects banned terms in deck, eyebrow, caption and live_updates', async () => {
    const r = await runFixture((fx) => {
      makePending(fx, 1, 'arrested');
      const m = article(fx).meta;
      m.deck = 'The crook was led away.';
      m.eyebrow = 'CONVICT WATCH';
      m.interactive_art_spec.caption = 'Mugshot of the accused';
      m.live_updates = [{ text: 'Seen in handcuffs outside court', ago: '1h' }];
    });
    expectError(
      r,
      'deck uses banned term(s) CROOK',
      'eyebrow uses banned term(s) CONVICTED/CONVICT',
      'interactive_art_spec.caption uses banned term(s) MUGSHOT',
      'live_updates[0].text uses banned term(s) HANDCUFFS'
    );
  });

  it('rejects toyText GUILTY and a mugshot/handcuffs alt in paint-refs on a pending story', async () => {
    const r = await runFixture((fx) => {
      makePending(fx, 1, 'civil_complaint');
      const slug = article(fx).meta.slug;
      fx.paintRefs[slug].toyText = 'GUILTY';
      fx.paintRefs[slug].alt = 'Mugshot of the defendant in handcuffs behind prison bars';
    });
    expectError(
      r,
      'paint-refs toyText uses banned term(s) GUILTY',
      'paint-refs alt uses banned term(s)',
      'MUGSHOT',
      'HANDCUFFS',
      'PRISON BARS'
    );
  });

  it('applies the regime to every pending stage', async () => {
    for (const stage of PENDING_STAGES) {
      expect(findBannedTerms('Fraudster', stage, null), stage).toContain('FRAUDSTER');
    }
    expect(findBannedTerms('Fraudster', 'sentenced', true)).toEqual([]);
    expect(findBannedTerms('Fraudster', 'acquitted', null)).toContain('FRAUDSTER');
  });

  it('does not flag "pleaded not guilty" or adjectival "criminal charges"', () => {
    expect(
      findBannedTerms('Defendants pleaded not guilty to criminal charges', 'indicted', null)
    ).toEqual([]);
    expect(findBannedTerms('A criminal complaint was unsealed', 'indicted', null)).toEqual([]);
    expect(findBannedTerms('Branded a criminal.', 'indicted', null)).toContain('CRIMINAL (label)');
    expect(findBannedTerms('Career criminals', 'indicted', null)).toContain('CRIMINAL (label)');
  });

  it('rejects "CONVICTED… Admits Guilt" on a settlement with admitted_guilt false', async () => {
    const r = await runFixture((fx) => {
      const m = article(fx).meta;
      m.legal_stage = 'settlement';
      m.financials.admitted_guilt = false;
      m.financials.prison_months = 0;
      m.headline = 'CONVICTED Bank Admits Guilt, Pays $1M';
    });
    expectError(
      r,
      'headline uses banned term(s)',
      'CONVICTED/CONVICT',
      'ADMITS GUILT',
      'without admitted_guilt'
    );
  });

  it('rejects "pleaded guilty" on a DPA without admission but allows it when admitted_guilt is true', async () => {
    const bad = await runFixture((fx) => {
      const m = article(fx).meta;
      m.legal_stage = 'dpa';
      m.financials.admitted_guilt = null;
      m.deck = 'The company pleaded guilty and confessed.';
    });
    expectError(bad, 'deck uses banned term(s)', 'PLEADED GUILTY', 'CONFESSES');

    const ok = await runFixture((fx) => {
      const m = article(fx).meta;
      m.legal_stage = 'dpa';
      m.financials.admitted_guilt = true;
      m.deck = 'The company admitted guilt in a statement of facts.';
    });
    expect(ok.errors).toEqual([]);
  });

  it('rejects admitted_guilt: true on a pending stage', async () => {
    const r = await runFixture((fx) => {
      makePending(fx);
      article(fx).meta.financials.admitted_guilt = true;
    });
    expectError(r, 'financials.admitted_guilt must not be true on pending stage "indicted"');
  });
});

describe('slap-on-the-wrist score rules (V1)', () => {
  it('rejects a score on an indicted story and on a civil complaint', async () => {
    const r = await runFixture((fx) => {
      makePending(fx, 1, 'indicted');
      article(fx, 1).meta.slap_on_wrist_score = 99;
      makePending(fx, 2, 'civil_complaint');
      article(fx, 2).meta.slap_on_wrist_score = 12;
    });
    expectError(
      r,
      'slap_on_wrist_score must be null on unresolved stage "indicted" (got 99)',
      'slap_on_wrist_score must be null on unresolved stage "civil_complaint" (got 12)'
    );
  });

  it('rejects scores on adjudicated-but-unsentenced and exonerated stages', async () => {
    for (const stage of ['guilty_plea', 'convicted', 'dismissed', 'acquitted']) {
      const r = await runFixture((fx) => {
        const m = article(fx).meta;
        m.legal_stage = stage;
        m.financials.fine_ratio_pct = null;
        m.financials.fine_usd = null;
        m.headline = 'Case update';
      });
      expectError(r, `slap_on_wrist_score must be null on unresolved stage "${stage}"`);
    }
  });

  it('rejects a fractional score (42.7) and a score above 100', async () => {
    const frac = await runFixture((fx) => {
      article(fx).meta.slap_on_wrist_score = 42.7;
    });
    expectError(frac, 'slap_on_wrist_score: Expected integer');
    const big = await runFixture((fx) => {
      article(fx).meta.slap_on_wrist_score = 101;
    });
    expectError(big, 'slap_on_wrist_score');
  });

  it('only warns for a null score on a resolved stage (pending judge run)', async () => {
    const r = await runFixture((fx) => {
      article(fx).meta.slap_on_wrist_score = null;
      delete article(fx).meta.score_provenance;
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('null on resolved stage "sentenced"'))).toBe(true);
  });

  it('errors on provenance without a score and warns on a score without provenance', async () => {
    const r = await runFixture((fx) => {
      makePending(fx);
      article(fx).meta.score_provenance = {
        model: 'gemini-2.5-pro',
        prompt_sha256: 'b'.repeat(64),
        judged_at: '2026-11-20T10:00:00Z',
      };
      delete article(fx, 2).meta.score_provenance;
    });
    expectError(r, 'score_provenance is present but slap_on_wrist_score is null');
    expect(r.warnings.some((w) => w.includes('case-2') && w.includes('no score_provenance'))).toBe(
      true
    );
  });

  it('validates score_provenance shape (sha256 hex, ISO datetime, integer components)', async () => {
    const r = await runFixture((fx) => {
      article(fx).meta.score_provenance = {
        model: 'x',
        prompt_sha256: 'not-a-hash',
        judged_at: 'yesterday',
        components: { leniency: 1.5 },
      };
    });
    expectError(
      r,
      'score_provenance.prompt_sha256',
      'score_provenance.judged_at',
      'score_provenance.components.leniency'
    );
  });

  it('exports the stage groups from the schema module', () => {
    expect([...RESOLVED_STAGES]).toEqual(['settlement', 'regulatory_order', 'sentenced', 'dpa']);
    expect(PENDING_STAGES).toContain('interim_order');
    expect(PENDING_STAGES).toContain('appeal');
  });
});

describe('fine ratio rule', () => {
  it('requires fine_ratio_pct null on pending stages (frozen money is not a fine)', async () => {
    const r = await runFixture((fx) => {
      makePending(fx, 1, 'interim_order');
      article(fx).meta.financials.fine_usd = 5_000_000;
      article(fx).meta.financials.fine_ratio_pct = 100;
    });
    expectError(r, 'fine_ratio_pct must be null on pending stage "interim_order"');
  });

  it('rejects a stored ratio that disagrees with fine_usd/amount_usd (Javice-style 100 vs 164.3)', async () => {
    const r = await runFixture((fx) => {
      const f = article(fx).meta.financials;
      f.amount_usd = 175_000_000;
      f.fine_usd = 287_500_000;
      f.fine_ratio_pct = 100;
    });
    expectError(r, 'fine_ratio_pct (100) disagrees with fine_usd/amount_usd×100 = 164.3');
  });

  it('accepts ratios within ±0.15 of the exact value and ratios above 100', async () => {
    const r = await runFixture((fx) => {
      const a = article(fx, 1).meta.financials;
      a.amount_usd = 2_250_000_000;
      a.fine_usd = 21_500_000;
      a.fine_ratio_pct = 0.915; // exact 0.9556
      const b = article(fx, 2).meta.financials;
      b.amount_usd = 175_000_000;
      b.fine_usd = 287_500_000;
      b.fine_ratio_pct = 164.3;
    });
    expect(r.errors).toEqual([]);
    expect(computeFineRatioPct(287_500_000, 175_000_000)).toBe(164.3);
    expect(computeFineRatioPct(1, 0)).toBeNull();
  });

  it('rejects a null ratio on a resolved stage when it is computable', async () => {
    const r = await runFixture((fx) => {
      article(fx).meta.financials.fine_ratio_pct = null;
    });
    expectError(r, 'fine_ratio_pct is null but fine_usd/amount_usd×100 = 10');
  });
});

describe('opinion monochrome rule (V1)', () => {
  it('rejects an opinion piece with verdict-crimson palette and newsprint theme', async () => {
    const r = await runFixture((fx) => {
      const a = article(fx);
      a.meta.template = 'opinion';
      a.meta.interactive_art_spec.theme = 'newsprint';
      fx.paintRefs[a.meta.slug].paletteMood = 'verdict-crimson';
    });
    expectError(
      r,
      'template "opinion" requires interactive_art_spec.theme "monochrome"',
      'template "opinion" requires paint-refs paletteMood "monochrome-noir" (got "verdict-crimson")'
    );
  });

  it('accepts a correctly monochrome opinion piece', async () => {
    const r = await runFixture((fx) => {
      const a = article(fx);
      a.meta.template = 'opinion';
      a.meta.interactive_art_spec.theme = 'monochrome';
      fx.paintRefs[a.meta.slug].paletteMood = 'monochrome-noir';
    });
    expect(r.errors).toEqual([]);
  });
});

describe('strict schemas, dates, money and licences (V1/V2)', () => {
  it('rejects unparseable and impossible publish_date values', async () => {
    for (const bad of [
      'not-a-date',
      '2026-02-30T06:00:00-05:00',
      '2026-11-20T06:00:00',
      '11/20/2026',
    ]) {
      const r = await runFixture((fx) => {
        article(fx).meta.publish_date = bad;
      });
      expectError(r, 'publish_date');
    }
  });

  it('rejects non-ISO sources[].date, corrections[].date and edition_date', async () => {
    const r = await runFixture((fx) => {
      const m = article(fx).meta;
      m.sources[0].date = 'Nov 19, 2026';
      m.corrections = [{ date: 'last week', note: 'Fixed a typo.' }];
      article(fx, 2).meta.edition_date = '2026-13-01';
    });
    expectError(r, 'sources.0.date', 'corrections.0.date', 'edition_date');
  });

  it('rejects negative prison_months / amounts / fines / ratios', async () => {
    const r = await runFixture((fx) => {
      article(fx, 1).meta.financials.prison_months = -12;
      article(fx, 2).meta.financials.amount_usd = -1;
      article(fx, 3).meta.financials.fine_usd = -5;
      article(fx, 4).meta.financials.fine_ratio_pct = -3;
    });
    expectError(
      r,
      'financials.prison_months',
      'financials.amount_usd',
      'financials.fine_usd',
      'financials.fine_ratio_pct'
    );
  });

  it('rejects unknown / misspelled keys at every level', async () => {
    const r = await runFixture((fx) => {
      article(fx, 1).meta.slap_on_wrist_scroe = 10;
      article(fx, 2).meta.financials.fine_ratio = 10;
      article(fx, 3).meta.sources[0].urll = 'x';
      article(fx, 4).meta.interactive_art_spec.palette = 'x';
      fx.paintRefs['case-5'].toytext = 'typo';
      fx.paintRefs['case-6'].focalPoint.w = 0.1;
    });
    expectError(
      r,
      "case-1/meta.json: (root): Unrecognized key(s) in object: 'slap_on_wrist_scroe'",
      "financials: Unrecognized key(s) in object: 'fine_ratio'",
      "sources.0: Unrecognized key(s) in object: 'urll'",
      "interactive_art_spec: Unrecognized key(s) in object: 'palette'",
      "case-5: Unrecognized key(s) in object: 'toytext'",
      'case-6.focalPoint: Unrecognized key(s)'
    );
  });

  it('rejects non-open sourceLicense values and accepts the allowlist', async () => {
    const r = await runFixture((fx) => {
      fx.paintRefs['case-1'].sourceLicense = 'All Rights Reserved — Getty';
    });
    expectError(r, 'case-1.sourceLicense');

    for (const bad of [
      'CC BY-NC 4.0',
      'CC BY-ND 2.0',
      'Getty Images',
      'Fair use',
      'CC BY-NC-SA 4.0',
      '',
    ]) {
      expect(SOURCE_LICENSE_RE.test(bad), bad).toBe(false);
    }
    for (const good of [
      'Public Domain',
      'CC0',
      'CC0 1.0',
      'CC BY 2.0',
      'CC BY 4.0',
      'CC BY-SA 3.0',
      'CC BY-SA 3.0 IGO',
      'OGL 3',
      'OGL v3.0',
      'GODL-India',
    ]) {
      expect(SOURCE_LICENSE_RE.test(good), good).toBe(true);
    }
  });

  it('accepts the new optional contract fields (updated_at, retracted, secondary, score_provenance)', () => {
    const base = {
      ...makeMeta(1),
      updated_at: '2026-11-21',
      retracted: { date: '2026-11-21', note: 'Retracted: misidentified defendant.' },
    };
    base.sources.push({
      title: 'Press report',
      agency: 'Newspaper',
      url: 'https://www.example-news.com/story/1',
      date: '2026-11-19',
      secondary: true,
    });
    expect(ArticleMetaSchema.safeParse(base).success).toBe(true);
  });
});

describe('retraction tombstones (V9)', () => {
  it('keeps a retracted article valid, excuses its missing paint-ref, and excludes it from the rollup count', async () => {
    const r = await runFixture((fx) => {
      const a = article(fx, 9);
      a.meta.retracted = { date: '2026-11-21', note: 'Retracted after the filing was withdrawn.' };
      delete fx.paintRefs[a.meta.slug];
      delete fx.jpegs[a.meta.slug];
      fx.rollup.total_cases = 8;
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('retracted article "case-9" has no paint-ref'))).toBe(
      true
    );
  });

  it('rejects a retraction dated before publication, in the future, or with a too-short note', async () => {
    const r = await runFixture((fx) => {
      article(fx, 1).meta.retracted = { date: '2026-11-01', note: 'Retracted after review.' };
      article(fx, 2).meta.retracted = { date: '2027-01-01', note: 'Retracted after review.' };
      article(fx, 3).meta.retracted = { date: '2026-11-21', note: 'short' };
      fx.rollup.total_cases = 6;
    });
    expectError(
      r,
      'retracted.date (2026-11-01) is before publish_date',
      'retracted.date 2027-01-01 is in the future',
      'retracted.note'
    );
  });
});
