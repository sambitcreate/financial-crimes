import { describe, expect, it } from 'vitest';
import {
  OG_HEIGHT,
  OG_WIDTH,
  buildOgCardSvg,
  escapeXml,
  layoutHeadline,
  layoutMetricValue,
  renderOgCardPng,
  wrapHeadlineLines,
} from '../scripts/generate-og-cards.mjs';

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'acme-bank-laundering-settlement',
    template: 'news',
    eyebrow: 'BANKING',
    city: 'Washington',
    agencies: ['FinCEN', 'OCC', 'OFAC'],
    headline: 'Acme Bank Settles Laundering Lapses With $1.2 Billion Discounted Fine',
    byline: 'By The Banking Desk',
    publish_date: '2026-11-19T12:00:00Z',
    edition_date: '2026-11-19',
    docket_number: 'Treasury Release sb0657',
    legal_stage: 'settlement',
    slap_on_wrist_score: 77,
    financials: {
      amount_usd: 5000000000,
      amount_display: '$5.0B+',
      fine_usd: 1210000000,
      fine_display: '$1.21B',
      fine_ratio_pct: 24.2,
      prison_months: 0,
      prison_display: '0 Days (0 Execs Charged)',
      admitted_guilt: false,
    },
    ...overrides,
  };
}

describe('OG card SVG generation & escaping', () => {
  it('escapes XML special characters safely', () => {
    expect(escapeXml(`A & B <tag> "quoted" 'single'`)).toBe(
      'A &amp; B &lt;tag&gt; &quot;quoted&quot; &#39;single&#39;'
    );
  });

  it('generates a 1200x630 broadsheet SVG with nameplate, double rules, and 4-metric ledger strip', () => {
    const svg = buildOgCardSvg(makeArticle());
    expect(svg).toContain(`width="${OG_WIDTH}" height="${OG_HEIGHT}"`);
    expect(svg).toContain('fill="#faf8f4"');
    expect(svg).toContain('THE FINANCIAL CRIMES');
    expect(svg).toContain('FINANCIALCRIMES.FYI');
    expect(svg).toContain('ALLEGED SCALE');
    expect(svg).toContain('PENALTY');
    expect(svg).toContain('FINE / SCALE');
    expect(svg).toContain('CUSTODY');
    expect(svg).toContain('$5.0B+');
    expect(svg).toContain('$1.21B');
    expect(svg).toContain('24.20%');
    expect(svg).toContain('0 Days (0 Execs Charged)');
  });

  it('escapes dangerous XML characters in article metadata', () => {
    const svg = buildOgCardSvg(
      makeArticle({
        headline: 'R&D Firm <Script> Accused in "Opaque" & Unregistered Deal',
        eyebrow: 'M&A',
        agencies: ['SEC & DOJ'],
      })
    );
    expect(svg).toContain('R&amp;D Firm &lt;Script&gt;');
    expect(svg).toContain('&quot;Opaque&quot;');
    expect(svg).toContain('M&amp;A');
    expect(svg).not.toContain('<Script>');
  });

  it('wraps long headlines into 3-4 lines and appends clean ellipsis if extremely long', () => {
    const medium = layoutHeadline(
      'S.E.C. Accuses Eight Rotating Colorado Shell Firms of Printing Fake S.E.C. Certificates in $37.4 Million Crypto Scheme'
    );
    expect(medium.lines.length).toBeGreaterThanOrEqual(3);
    expect(medium.lines.length).toBeLessThanOrEqual(4);
    expect(medium.truncated).toBe(false);

    const veryLong = wrapHeadlineLines(
      'Global Investment Conglomerate Faces Sweeping Multi-Jurisdictional Inquiry Over Decades of Alleged Offshore Shell Transfers, Synthetic Derivatives Concealment, Accounting Irregularities, and Systematic Supervisory Breakdowns Across Four Continents',
      { fontSize: 44, maxWidthPx: 1000, maxLines: 4 }
    );
    expect(veryLong.lines).toHaveLength(4);
    expect(veryLong.truncated).toBe(true);
    expect(veryLong.lines[3].endsWith('…')).toBe(true);
  });

  it('wraps long ledger metric strings cleanly within 2 lines', () => {
    const wrapped = layoutMetricValue('4 Yrs 8 Mos Prison (Confiscation Pending)', 232);
    expect(wrapped.lines.length).toBeLessThanOrEqual(2);
    expect(wrapped.lines.join(' ')).toContain('4 Yrs 8 Mos');
  });
});

describe('OG card badges, opinion monochrome mode, and libel guardrails', () => {
  it('renders crimson SLAP badge when news score >= 70', () => {
    const svg = buildOgCardSvg(makeArticle({ slap_on_wrist_score: 88 }));
    expect(svg).toContain('SLAP 88/100');
    expect(svg).toContain('fill="#a62626"');
  });

  it('renders non-crimson SLAP badge when news score < 70', () => {
    const svg = buildOgCardSvg(makeArticle({ slap_on_wrist_score: 36 }));
    expect(svg).toContain('SLAP 36/100');
    // Badge itself uses neutral newsprint fill rather than crimson fill
    expect(svg).toContain('fill="#f2efe8" stroke="#121212"');
  });

  it('renders PENDING badge and never emits GUILTY/CONVICTED/FRAUDSTER for pending stages', () => {
    const svg = buildOgCardSvg(
      makeArticle({
        legal_stage: 'indicted',
        slap_on_wrist_score: null,
        headline: 'Executives Indicted in Alleged $600 Million Currency Scheme',
        financials: {
          amount_usd: 600000000,
          amount_display: '~$600M',
          fine_usd: null,
          fine_display: 'Pending Trial',
          fine_ratio_pct: null,
          prison_months: null,
          prison_display: 'Pending Trial',
          admitted_guilt: null,
        },
      })
    );
    expect(svg).toContain('>PENDING<');
    expect(svg).not.toMatch(/\b(GUILTY|CONVICTED|FRAUDSTER)\b/i);
  });

  it('enforces strict monochrome noir styling for opinion articles (zero crimson/color accents)', () => {
    const svg = buildOgCardSvg(
      makeArticle({
        template: 'opinion',
        eyebrow: 'OPINION',
        slap_on_wrist_score: 93,
      })
    );
    expect(svg).toContain('OPINION');
    expect(svg).toContain('SLAP 93/100');
    expect(svg).toContain('fill="#121212"');
    expect(svg).toContain('fill="#faf8f4"');
    // Zero crimson or colored hex accents permitted in opinion cards
    expect(svg).not.toContain('#a62626');
    expect(svg).not.toContain('#d0021b');
    expect(svg).not.toContain('#2b4c6f');
    expect(svg).not.toContain('#b5892e');
  });
});

describe('OG card PNG rasterization', () => {
  it('renders a valid 1200x630 PNG with valid magic bytes and IHDR dimensions for news and opinion cards', () => {
    const newsPng = renderOgCardPng(
      makeArticle({
        financials: {
          amount_usd: 553000000,
          amount_display: '₹4,843.57 Cr (~$553M)',
          fine_usd: 553000000,
          fine_display: '₹4,843.57 Cr Impounded',
          fine_ratio_pct: 100,
          prison_months: 0,
          prison_display: 'Civil Appeal Active',
          admitted_guilt: null,
        },
        slap_on_wrist_score: null,
        legal_stage: 'interim_order',
      })
    );
    const opinionPng = renderOgCardPng(
      makeArticle({
        template: 'opinion',
        eyebrow: 'OPINION',
        slap_on_wrist_score: 93,
      })
    );

    for (const png of [newsPng, opinionPng]) {
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
      // IHDR chunk starts at byte 12; width at 16..19, height at 20..23 (big-endian uint32)
      expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
      expect(png.readUInt32BE(16)).toBe(OG_WIDTH);
      expect(png.readUInt32BE(20)).toBe(OG_HEIGHT);
      // Rendered typography produces a rich PNG well above blank-canvas size
      expect(png.length).toBeGreaterThan(15_000);
    }
  });
});
