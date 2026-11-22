import { describe, expect, it } from 'vitest';
import type { ArticleMeta } from '../src/schemas/article';
import {
  LEGAL_STAGES,
} from '../src/schemas/article';
import {
  articleModifiedAt,
  describeLeadPenalty,
  describeLootTotals,
  formatLiveUpdateStamp,
  formatReceiptFineRatio,
  formatStageFineRatio,
  formatStageStatus,
  isPendingStage,
  isResolvedStage,
  penaltyLabel,
  stageFineRatio,
} from '../src/utils/format';

type Stage = ArticleMeta['legal_stage'];

function makeCase(
  legal_stage: Stage,
  overrides: Partial<ArticleMeta['financials']> = {},
): Pick<ArticleMeta, 'legal_stage' | 'financials'> {
  return {
    legal_stage,
    financials: {
      amount_usd: 318_000_000,
      amount_display: '£251M (~$318M)',
      fine_usd: null,
      fine_display: 'Pending Trial',
      fine_ratio_pct: 100,
      prison_months: null,
      prison_display: 'Pending Trial',
      admitted_guilt: null,
      ...overrides,
    },
  };
}

const PENDING: Stage[] = ['investigation', 'civil_complaint', 'indicted', 'arrested', 'interim_order', 'appeal'];
const RESOLVED: Stage[] = ['settlement', 'regulatory_order', 'sentenced', 'dpa'];
const BANNED_PENDING = /\b(GUILTY|CONVICTED|FRAUDSTER|LOOT|SETTLEMENT|SETTLED)\b/i;

describe('stage groups', () => {
  it('classifies every legal stage exactly once (resolved / pending / other)', () => {
    for (const stage of LEGAL_STAGES) {
      expect(isResolvedStage(stage) && isPendingStage(stage)).toBe(false);
    }
    expect(PENDING.every(isPendingStage)).toBe(true);
    expect(RESOLVED.every(isResolvedStage)).toBe(true);
    expect(isResolvedStage('guilty_plea')).toBe(false);
    expect(isPendingStage('guilty_plea')).toBe(false);
  });
});

describe('describeLeadPenalty (front-page lead box, F1)', () => {
  it('never says CIVIL SETTLEMENT or % OF LOOT for a pending criminal case', () => {
    for (const stage of PENDING) {
      const box = describeLeadPenalty(makeCase(stage));
      const text = Object.values(box).join(' ');
      expect(text).not.toMatch(BANNED_PENDING);
      expect(text).not.toMatch(/%/);
      expect(box.eyebrow).toBe('CASE STATUS');
      expect(box.figure).toBe('£251M (~$318M)');
    }
  });

  it('keeps the presumption of innocence visible for charged defendants', () => {
    const box = describeLeadPenalty(makeCase('indicted'));
    expect(box.subLead).toBe('CHARGED · PRESUMED INNOCENT');
    expect(box.delta).toBe('ALLEGED');
    expect(describeLeadPenalty(makeCase('interim_order')).delta).toBe('AT ISSUE');
    expect(describeLeadPenalty(makeCase('interim_order')).subLead).toBe('INTERIM ORDER · CONTESTED');
  });

  it('shows the ratio only for resolved stages, and "loot" only when guilt is established', () => {
    const settled = describeLeadPenalty(
      makeCase('settlement', { fine_display: '$1.21B', fine_ratio_pct: 24.2, admitted_guilt: false }),
    );
    expect(settled.eyebrow).toBe('PENALTY RATIO');
    expect(settled.delta).toBe('24.2% OF SUM AT ISSUE');
    expect(settled.figure).toBe('$1.21B');

    const sentenced = describeLeadPenalty(makeCase('sentenced', { fine_ratio_pct: 11.18 }));
    expect(sentenced.delta).toBe('11.2% OF LOOT');

    const admitted = describeLeadPenalty(makeCase('settlement', { fine_ratio_pct: 5, admitted_guilt: true }));
    expect(admitted.delta).toBe('5.0% OF LOOT');
  });

  it('falls back to the actual stage, never a hard-coded "CIVIL SETTLEMENT"', () => {
    expect(describeLeadPenalty(makeCase('dpa', { fine_ratio_pct: null })).delta).toBe('DEFERRED PROSECUTION');
    expect(describeLeadPenalty(makeCase('regulatory_order', { fine_ratio_pct: null })).delta).toBe(
      'REGULATORY ORDER',
    );
    expect(describeLeadPenalty(makeCase('convicted')).delta).toBe('AWAITING SENTENCE');
    expect(describeLeadPenalty(makeCase('guilty_plea')).subLead).toBe('GUILTY PLEA · AWAITING SENTENCE');
  });
});

describe('stage-aware fine ratios (F3)', () => {
  it('hides stored ratios on pending stages (frozen/escrowed money is not a fine)', () => {
    const janeStreet = makeCase('interim_order', { fine_ratio_pct: 100, fine_usd: 553_000_000 });
    expect(stageFineRatio(janeStreet)).toBeNull();
    expect(formatStageFineRatio(janeStreet)).toBe('Pending');
    expect(formatStageFineRatio(janeStreet, '—')).toBe('—');
    expect(formatReceiptFineRatio(janeStreet)).toBe('PENDING — NO PENALTY IMPOSED');
  });

  it('formats resolved ratios and labels the cleared stages', () => {
    expect(formatStageFineRatio(makeCase('settlement', { fine_ratio_pct: 24.2 }))).toBe('24.20%');
    expect(formatReceiptFineRatio(makeCase('dpa', { fine_ratio_pct: null }))).toBe('NOT COMPUTED');
    expect(formatReceiptFineRatio(makeCase('acquitted'))).toBe('NONE — NO PENALTY');
  });

  it('labels the fine_display column honestly', () => {
    expect(penaltyLabel('settlement')).toBe('FINE');
    expect(penaltyLabel('indicted')).toBe('STATUS');
    expect(penaltyLabel('interim_order', 'long')).toBe('PENALTY STATUS');
    expect(penaltyLabel('sentenced', 'long')).toBe('PENALTY');
  });

  it('gives every pending stage a presumption-of-innocence status line', () => {
    for (const stage of PENDING) {
      expect(formatStageStatus(stage)).not.toMatch(BANNED_PENDING);
    }
    expect(formatStageStatus('arrested')).toBe('ARRESTED · PRESUMED INNOCENT');
    expect(formatStageStatus('settlement')).toBe('SETTLEMENT');
  });
});

describe('live-update timestamps (F2)', () => {
  it('drops frozen relative strings instead of rendering fake recency', () => {
    expect(formatLiveUpdateStamp('18m ago')).toBeNull();
    expect(formatLiveUpdateStamp('2h ago')).toBeNull();
    expect(formatLiveUpdateStamp('')).toBeNull();
    expect(formatLiveUpdateStamp(undefined)).toBeNull();
    expect(formatLiveUpdateStamp('2026-13-45T99:00:00Z')).toBeNull();
  });

  it('renders real ISO timestamps as absolute AP times', () => {
    expect(formatLiveUpdateStamp('2026-11-22T07:00:00-05:00')).toBe('Nov. 22, 2026 · 7:00 a.m. ET');
    expect(formatLiveUpdateStamp('2026-11-22')).toBe('Nov. 22, 2026');
  });

  it('prefers a valid updated_at for the modified stamp', () => {
    expect(articleModifiedAt({ publish_date: '2026-11-19T06:00:00-05:00' })).toBe('2026-11-19T06:00:00-05:00');
    expect(
      articleModifiedAt({ publish_date: '2026-11-19T06:00:00-05:00', updated_at: '2026-11-21T09:30:00-05:00' }),
    ).toBe('2026-11-21T09:30:00-05:00');
    expect(articleModifiedAt({ publish_date: '2026-11-19', updated_at: 'not-a-date' })).toBe('2026-11-19');
  });
});

describe('describeLootTotals (masthead / drawer ticker)', () => {
  const combined = {
    total_loot_usd: 59_372_945_000,
    total_loot_display: '$59.37B',
    total_fines_usd: 6_668_030_000,
    avg_fine_ratio_pct: 11.23,
  };

  it('labels a combined total as alleged + adjudicated, never "looted"', () => {
    const t = describeLootTotals(combined);
    expect(t.label).toBe('ALLEGED + ADJUDICATED');
    expect(t.value).toBe('$59.4B');
    expect(t.ratioPct).toBe(11.23);
    expect(`${t.label} ${t.description}`).not.toMatch(/LOOTED/i);
  });

  it('uses the resolved split when the rollup provides it', () => {
    const t = describeLootTotals({
      ...combined,
      total_loot_resolved_usd: 56_791_430_000,
      total_loot_resolved_display: '$56.79B',
      total_loot_alleged_usd: 2_581_515_000,
      total_loot_alleged_display: '$2.58B',
    });
    expect(t.label).toBe('RESOLVED');
    expect(t.value).toBe('$56.8B');
    expect(t.ratioPct).toBeCloseTo(11.74, 2);
    expect(t.description).toContain('alleged in pending cases');
  });
});
