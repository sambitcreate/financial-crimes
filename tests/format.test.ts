import { describe, expect, it } from 'vitest';
import type { ArticleMeta } from '../src/schemas/article';
import {
  formatBroadsheetDate,
  formatDatelineTimestamp,
  formatFineRatio,
  formatGuiltAdmission,
  formatLegalStage,
  formatShortDate,
  formatUsdShort,
} from '../src/utils/format';

function makeCase(
  legal_stage: ArticleMeta['legal_stage'],
  admitted_guilt: boolean | null
): Pick<ArticleMeta, 'legal_stage' | 'financials'> {
  return {
    legal_stage,
    financials: {
      amount_usd: 100_000_000,
      amount_display: '$100M',
      fine_usd: 10_000_000,
      fine_display: '$10M',
      fine_ratio_pct: 10,
      prison_months: 0,
      prison_display: '0 Days',
      admitted_guilt,
    },
  };
}

describe('date formatting helpers', () => {
  it('formats AP broadsheet dates from date-only and ISO timestamps', () => {
    expect(formatBroadsheetDate('2026-11-19')).toBe('Nov. 19, 2026');
    expect(formatBroadsheetDate('2026-03-05')).toBe('March 5, 2026');
    expect(formatBroadsheetDate('2026-09-01')).toBe('Sept. 1, 2026');
    expect(formatBroadsheetDate('2026-11-19T07:00:00-05:00')).toBe('Nov. 19, 2026');
  });

  it('formats compact short dates', () => {
    expect(formatShortDate('2026-11-19')).toBe('Nov. 19');
    expect(formatShortDate('2026-04-12')).toBe('April 12');
    expect(formatShortDate('2026-11-19T07:00:00-05:00')).toBe('Nov. 19');
  });

  it('formats ET dateline timestamps', () => {
    expect(formatDatelineTimestamp('2026-11-19T07:00:00-05:00')).toBe(
      'Nov. 19, 2026 · 7:00 a.m. ET'
    );
    expect(formatDatelineTimestamp('2026-11-19')).toBe('Nov. 19, 2026');
  });
});

describe('formatGuiltAdmission & formatLegalStage', () => {
  it('distinguishes civil admission vs neither-admit-nor-deny settlement', () => {
    expect(formatGuiltAdmission(makeCase('settlement', true))).toBe(
      'YES (CIVIL ADMISSION · 0 CRIMINAL)'
    );
    expect(formatGuiltAdmission(makeCase('settlement', false))).toBe(
      'NO (NEITHER ADMITTED NOR DENIED)'
    );
    expect(formatGuiltAdmission(makeCase('settlement', null))).toBe(
      'SETTLED (0 CRIMINAL CHARGES)'
    );
  });

  it('distinguishes trial conviction from guilty plea', () => {
    expect(formatGuiltAdmission(makeCase('convicted', false))).toBe('NO (CONVICTED AT TRIAL)');
    expect(formatGuiltAdmission(makeCase('sentenced', false))).toBe('NO (CONVICTED AT TRIAL)');
    expect(formatGuiltAdmission(makeCase('sentenced', true))).toBe('YES (GUILTY PLEA)');
    expect(formatGuiltAdmission(makeCase('guilty_plea', true))).toBe('YES (GUILTY PLEA)');
  });

  it('handles DPA, regulatory order, interim order, and pending stages', () => {
    expect(formatGuiltAdmission(makeCase('dpa', true))).toBe('YES (DPA FACTS · 0 PRISON)');
    expect(formatGuiltAdmission(makeCase('dpa', false))).toBe('NO (DEFERRED PROSECUTION)');
    expect(formatGuiltAdmission(makeCase('regulatory_order', false))).toBe(
      'NO (REGULATORY ORDER · 0 CRIMINAL)'
    );
    expect(formatGuiltAdmission(makeCase('interim_order', false))).toBe(
      'CONTESTED (INTERIM ORDER)'
    );
    expect(formatGuiltAdmission(makeCase('indicted', null))).toBe('CONTESTED (PRESUMED INNOCENT)');
    expect(formatGuiltAdmission(makeCase('arrested', null))).toBe('CONTESTED (PRESUMED INNOCENT)');
    expect(formatGuiltAdmission(makeCase('investigation', null))).toBe(
      'CONTESTED (PRESUMED INNOCENT)'
    );
  });

  it('formats human-readable legal stage labels', () => {
    expect(formatLegalStage('interim_order')).toBe('INTERIM ORDER');
    expect(formatLegalStage('dpa')).toBe('DEFERRED PROSECUTION');
    expect(formatLegalStage('regulatory_order')).toBe('REGULATORY ORDER');
    expect(formatLegalStage('guilty_plea')).toBe('GUILTY PLEA');
  });
});

describe('formatUsdShort & formatFineRatio', () => {
  it('formats billions, millions, thousands, and boundary rollovers cleanly', () => {
    expect(formatUsdShort(58_981_545_000)).toBe('$59.0B');
    expect(formatUsdShort(58_981_545_000, { B: 2 })).toBe('$58.98B');
    expect(formatUsdShort(412_000_000)).toBe('$412.0M');
    expect(formatUsdShort(999_950)).toBe('$1.0M');
    expect(formatUsdShort(25_000)).toBe('$25K');
    expect(formatUsdShort(500)).toBe('$1K');
    expect(formatUsdShort(499)).toBe('$499');
    expect(formatUsdShort(-1_500_000)).toBe('-$1.5M');
    expect(formatUsdShort(Number.NaN)).toBe('$0');
  });

  it('formats fine ratio percentage with fallback', () => {
    expect(formatFineRatio(12.76)).toBe('12.76%');
    expect(formatFineRatio(null)).toBe('Pending');
  });
});
