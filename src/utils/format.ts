import type { ArticleMeta } from '../schemas/article';

const AP_MONTHS = [
  'Jan.',
  'Feb.',
  'March',
  'April',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
] as const;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface ParsedEtParts {
  year: number;
  monthIndex: number;
  day: number;
  hour24?: number;
  minute?: number;
}

function parseEditorialParts(input: string): ParsedEtParts | null {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;

  const dateOnly = DATE_ONLY_RE.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const monthIndex = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
    return { year, monthIndex, day };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(parsed);
  const readNum = (type: Intl.DateTimeFormatPartTypes): number | undefined => {
    const found = parts.find((p) => p.type === type)?.value;
    return found !== undefined ? Number(found) : undefined;
  };

  const year = readNum('year');
  const month = readNum('month');
  const day = readNum('day');
  const hour24 = readNum('hour');
  const minute = readNum('minute');

  if (!year || !month || !day) return null;
  return {
    year,
    monthIndex: month - 1,
    day,
    hour24: hour24 === 24 ? 0 : hour24,
    minute,
  };
}

/**
 * AP / broadsheet full date: "Nov. 19, 2026" or "March 5, 2026".
 * Never leaks raw ISO timestamps.
 */
const USD_UNITS: [number, 'B' | 'M' | 'K'][] = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/**
 * "$59.0B" / "$412M" style money. Rounds before choosing the unit so 999,950 reads "$1.0M",
 * never "$1000K". `digits` overrides decimals per unit.
 */
export function formatUsdShort(
  value: number,
  digits: Partial<Record<'B' | 'M' | 'K', number>> = {},
): string {
  if (!Number.isFinite(value)) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const places = { B: 1, M: 1, K: 0, ...digits };
  for (let i = 0; i < USD_UNITS.length; i++) {
    const [size, unit] = USD_UNITS[i];
    const scaled = Number((abs / size).toFixed(places[unit]));
    if (scaled >= 1000 && i > 0) {
      const [biggerSize, biggerUnit] = USD_UNITS[i - 1];
      return `${sign}$${(abs / biggerSize).toFixed(places[biggerUnit])}${biggerUnit}`;
    }
    if (scaled >= 1) return `${sign}$${scaled.toFixed(places[unit])}${unit}`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function formatBroadsheetDate(iso: string): string {
  const parts = parseEditorialParts(iso);
  if (!parts) return iso;
  return `${AP_MONTHS[parts.monthIndex]} ${parts.day}, ${parts.year}`;
}

/**
 * Compact AP date for ledger rows & narrow columns: "Nov. 19" or "March 5".
 */
export function formatShortDate(iso: string): string {
  const parts = parseEditorialParts(iso);
  if (!parts) return iso;
  return `${AP_MONTHS[parts.monthIndex]} ${parts.day}`;
}

/**
 * Article byline dateline timestamp: "Nov. 19, 2026 · 7:00 a.m. ET".
 */
export function formatDatelineTimestamp(iso: string): string {
  const parts = parseEditorialParts(iso);
  if (!parts) return iso;

  const dateStr = `${AP_MONTHS[parts.monthIndex]} ${parts.day}, ${parts.year}`;
  if (parts.hour24 === undefined || parts.minute === undefined) {
    return dateStr;
  }

  const period = parts.hour24 >= 12 ? 'p.m.' : 'a.m.';
  const hour12 = parts.hour24 % 12 === 0 ? 12 : parts.hour24 % 12;
  const minPadded = String(parts.minute).padStart(2, '0');
  return `${dateStr} · ${hour12}:${minPadded} ${period} ET`;
}

/**
 * Clean human-readable docket status label (no snake_case underscores).
 */
export function formatLegalStage(stage: string): string {
  const key = String(stage ?? '').trim().toLowerCase();
  const labels: Record<string, string> = {
    settlement: 'SETTLEMENT',
    plea: 'GUILTY PLEA',
    guilty_plea: 'GUILTY PLEA',
    conviction: 'CRIMINAL CONVICTION',
    convicted: 'CRIMINAL CONVICTION',
    sentenced: 'SENTENCED',
    indictment: 'INDICTED',
    indicted: 'INDICTED',
    civil_complaint: 'CIVIL COMPLAINT',
    arrest: 'ARRESTED',
    arrested: 'ARRESTED',
    regulatory_order: 'REGULATORY ORDER',
    interim_order: 'INTERIM ORDER',
    dpa: 'DEFERRED PROSECUTION',
    investigation: 'UNDER INVESTIGATION',
    appeal: 'ON APPEAL',
    dismissed: 'CHARGES DISMISSED',
    acquitted: 'ACQUITTED',
  };
  return labels[key] ?? key.replace(/[_-]+/g, ' ').toUpperCase();
}

/**
 * Factually precise guilt / admission label for Crime Receipts and dockets.
 * Distinguishes criminal convictions & pleas from civil admissions,
 * neither-admit-nor-deny settlements, DPAs, and pending contested proceedings.
 */
export function formatGuiltAdmission(
  article: Pick<ArticleMeta, 'legal_stage' | 'financials'>
): string {
  const stage = String(article.legal_stage ?? '').trim().toLowerCase();
  const admitted = article.financials?.admitted_guilt ?? null;

  if (stage === 'plea' || stage === 'guilty_plea') {
    return 'YES (GUILTY PLEA)';
  }

  // A conviction is not an admission: only a plea counts as admitting guilt. "Convicted at
  // trial" is only claimed when the record says there was no admission (admitted_guilt false).
  if (stage === 'conviction' || stage === 'convicted' || stage === 'sentenced') {
    if (admitted === true) return 'YES (GUILTY PLEA)';
    if (admitted === false) return 'NO (CONVICTED AT TRIAL)';
    return stage === 'sentenced'
      ? 'SENTENCED (ADMISSION NOT RECORDED)'
      : 'CONVICTED (ADMISSION NOT RECORDED)';
  }

  if (stage === 'dismissed') return 'NO (CHARGES DISMISSED)';
  if (stage === 'acquitted') return 'NO (ACQUITTED)';

  if (stage === 'settlement') {
    if (admitted === true) return 'YES (CIVIL ADMISSION · 0 CRIMINAL)';
    if (admitted === false) return 'NO (NEITHER ADMITTED NOR DENIED)';
    return 'SETTLED (0 CRIMINAL CHARGES)';
  }

  if (stage === 'dpa') {
    if (admitted === true) return 'YES (DPA FACTS · 0 PRISON)';
    return 'NO (DEFERRED PROSECUTION)';
  }

  if (stage === 'regulatory_order') {
    if (admitted === true) return 'YES (CIVIL ADMISSION · 0 CRIMINAL)';
    return 'NO (REGULATORY ORDER · 0 CRIMINAL)';
  }

  if (stage === 'interim_order') {
    return 'CONTESTED (INTERIM ORDER)';
  }

  if (
    stage === 'indictment' ||
    stage === 'indicted' ||
    stage === 'civil_complaint' ||
    stage === 'arrest' ||
    stage === 'arrested' ||
    stage === 'investigation' ||
    stage === 'appeal'
  ) {
    return 'CONTESTED (PRESUMED INNOCENT)';
  }

  if (admitted === true) return 'YES (CIVIL ADMISSION · 0 CRIMINAL)';
  if (admitted === false) return 'NO (NEITHER ADMITTED NOR DENIED)';
  return 'CONTESTED (PRESUMED INNOCENT)';
}

export function formatFineRatio(pct: number | null, fallback = 'Pending'): string {
  if (pct === null || Number.isNaN(pct)) return fallback;
  return `${pct.toFixed(2)}%`;
}


/* ==========================================================================
   Stage-aware money language (presumption of innocence, AGENTS.md §2C).
   Contract: these stage groups mirror RESOLVED_STAGES / PENDING_STAGES in
   src/schemas/article.ts once that export lands.
   ========================================================================== */

const STAGE_ALIASES: Record<string, string> = {
  plea: 'guilty_plea',
  conviction: 'convicted',
  indictment: 'indicted',
  arrest: 'arrested',
};

export const RESOLVED_STAGE_KEYS = ['settlement', 'regulatory_order', 'sentenced', 'dpa'] as const;
export const PENDING_STAGE_KEYS = [
  'investigation',
  'civil_complaint',
  'indicted',
  'arrested',
  'interim_order',
  'appeal',
] as const;

function normalizeStage(stage: string | null | undefined): string {
  const key = String(stage ?? '').trim().toLowerCase();
  return STAGE_ALIASES[key] ?? key;
}

/** A penalty has actually been imposed (fine ratios and "loot" language are allowed). */
export function isResolvedStage(stage: string | null | undefined): boolean {
  return (RESOLVED_STAGE_KEYS as readonly string[]).includes(normalizeStage(stage));
}

/** Contested / pending: presumed innocent, no penalty imposed, money is "alleged" or "at issue". */
export function isPendingStage(stage: string | null | undefined): boolean {
  return (PENDING_STAGE_KEYS as readonly string[]).includes(normalizeStage(stage));
}

/**
 * Status line that keeps the presumption of innocence visible:
 * "CHARGED · PRESUMED INNOCENT", "INTERIM ORDER · CONTESTED", "SETTLEMENT".
 */
export function formatStageStatus(stage: string | null | undefined): string {
  switch (normalizeStage(stage)) {
    case 'indicted':
      return 'CHARGED · PRESUMED INNOCENT';
    case 'arrested':
      return 'ARRESTED · PRESUMED INNOCENT';
    case 'investigation':
      return 'UNDER INVESTIGATION · NOT CHARGED';
    case 'civil_complaint':
      return 'CIVIL COMPLAINT · ALLEGATIONS UNPROVEN';
    case 'interim_order':
      return 'INTERIM ORDER · CONTESTED';
    case 'appeal':
      return 'ON APPEAL · CONTESTED';
    case 'guilty_plea':
      return 'GUILTY PLEA · AWAITING SENTENCE';
    case 'convicted':
      return 'CONVICTED · AWAITING SENTENCE';
    default:
      return formatLegalStage(String(stage ?? ''));
  }
}

type StageFinancials = Pick<ArticleMeta, 'legal_stage' | 'financials'>;

/**
 * Label for the fine_display column. In pending cases that field holds frozen / seized sums or
 * "Pending Trial", which are not fines, so it reads "STATUS" (or "PENALTY STATUS").
 */
export function penaltyLabel(stage: string | null | undefined, variant: 'short' | 'long' = 'short'): string {
  if (isResolvedStage(stage)) return variant === 'short' ? 'FINE' : 'PENALTY';
  return variant === 'short' ? 'STATUS' : 'PENALTY STATUS';
}

/** The fine ratio, but only when a penalty was imposed. Frozen or escrowed sums are not fines. */
export function stageFineRatio(article: StageFinancials): number | null {
  if (!isResolvedStage(article.legal_stage)) return null;
  const pct = article.financials?.fine_ratio_pct;
  return typeof pct === 'number' && Number.isFinite(pct) ? pct : null;
}

/** Stage-aware formatFineRatio: pending / unresolved cases always read as the fallback. */
export function formatStageFineRatio(article: StageFinancials, fallback = 'Pending'): string {
  return formatFineRatio(stageFineRatio(article), fallback);
}

/** Receipt / docket row for the fine ratio, e.g. "PENDING — NO PENALTY IMPOSED". */
export function formatReceiptFineRatio(article: StageFinancials): string {
  const ratio = stageFineRatio(article);
  if (ratio !== null) return formatFineRatio(ratio);
  const stage = normalizeStage(article.legal_stage);
  if (stage === 'dismissed' || stage === 'acquitted') return 'NONE — NO PENALTY';
  if (isResolvedStage(stage)) return 'NOT COMPUTED';
  return 'PENDING — NO PENALTY IMPOSED';
}

export interface LeadPenaltySummary {
  eyebrow: string;
  figure: string;
  delta: string;
  subLead: string;
  subTail: string;
  ariaLabel: string;
}

/**
 * Front-page lead box. Resolved cases show the penalty against the sum at issue; everything
 * else shows the case status and the alleged amount (never "CIVIL SETTLEMENT" or "% OF LOOT").
 */
export function describeLeadPenalty(article: StageFinancials): LeadPenaltySummary {
  const f = article.financials;
  const stage = normalizeStage(article.legal_stage);

  if (isResolvedStage(stage)) {
    const ratio = stageFineRatio(article);
    const proven = stage === 'sentenced' || f.admitted_guilt === true;
    const delta =
      ratio !== null
        ? `${ratio.toFixed(1)}% OF ${proven ? 'LOOT' : 'SUM AT ISSUE'}`
        : formatLegalStage(stage);
    return {
      eyebrow: 'PENALTY RATIO',
      figure: f.fine_display,
      delta,
      subLead: `vs. ${f.amount_display}`,
      subTail: f.prison_display,
      ariaLabel: 'Lead case penalty ratio',
    };
  }

  const delta =
    stage === 'guilty_plea' || stage === 'convicted'
      ? 'AWAITING SENTENCE'
      : stage === 'interim_order' || stage === 'appeal'
        ? 'AT ISSUE'
        : 'ALLEGED';
  return {
    eyebrow: 'CASE STATUS',
    figure: f.amount_display,
    delta,
    subLead: formatStageStatus(stage),
    subTail: f.prison_display,
    ariaLabel: 'Lead case status',
  };
}

const ISO_STAMP_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Live-update timestamps: only a real ISO date/datetime is rendered (as an absolute AP
 * timestamp). Frozen relative strings like "18m ago" return null and are not shown.
 */
export function formatLiveUpdateStamp(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!ISO_STAMP_RE.test(value)) return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return formatDatelineTimestamp(value);
}

/** Last-modified stamp for a story: updated_at when present and parseable, else publish_date. */
export function articleModifiedAt(
  article: Pick<ArticleMeta, 'publish_date'> & { updated_at?: string | null },
): string {
  const updated = typeof article.updated_at === 'string' ? article.updated_at.trim() : '';
  return updated && !Number.isNaN(Date.parse(updated)) ? updated : article.publish_date;
}

export interface LootTotals {
  /** Short label for the ticker / pulse bar. */
  label: string;
  /** Formatted amount. */
  value: string;
  /** Full sentence for aria-label / title. */
  description: string;
  /** Fines as a share of the amount behind `value`, or null. */
  ratioPct: number | null;
}

export interface LootRollupLike {
  total_loot_usd: number;
  total_loot_display: string;
  total_fines_usd: number;
  avg_fine_ratio_pct?: number | null;
  total_loot_resolved_usd?: number | null;
  total_loot_resolved_display?: string | null;
  total_loot_alleged_usd?: number | null;
  total_loot_alleged_display?: string | null;
}

function compactUsd(usd: number, fallback: string): string {
  return usd >= 1e6 ? formatUsdShort(usd, { M: 0 }) : fallback;
}

/**
 * Honest site-wide "loot" figure. When the rollup splits resolved from alleged amounts
 * (total_loot_resolved_usd / total_loot_alleged_usd), the headline figure is the resolved-case
 * scale and the ratio is fines against it (matching avg_fine_ratio_pct in scripts/lib/rollup.mjs). Otherwise the combined total is labelled as
 * alleged + adjudicated, never as proven loot.
 */
export function describeLootTotals(rollup: LootRollupLike): LootTotals {
  const resolved = rollup.total_loot_resolved_usd;
  if (typeof resolved === 'number' && Number.isFinite(resolved)) {
    const value = compactUsd(resolved, rollup.total_loot_resolved_display ?? formatUsdShort(resolved));
    const alleged = rollup.total_loot_alleged_usd;
    const allegedText =
      typeof alleged === 'number' && Number.isFinite(alleged)
        ? `; a further ${compactUsd(alleged, rollup.total_loot_alleged_display ?? formatUsdShort(alleged))} is alleged in pending cases`
        : '';
    const ratioPct =
      resolved > 0 ? Number(((rollup.total_fines_usd / resolved) * 100).toFixed(2)) : null;
    return {
      // "Resolved", not "adjudicated": settlements and regulatory orders are not court findings
      label: 'RESOLVED',
      value,
      description: `${value} at issue in resolved cases${allegedText}`,
      ratioPct,
    };
  }
  const value = compactUsd(rollup.total_loot_usd, rollup.total_loot_display);
  const ratio = rollup.avg_fine_ratio_pct;
  return {
    label: 'ALLEGED + ADJUDICATED',
    value,
    description: `${value} at issue across alleged and adjudicated cases`,
    ratioPct: typeof ratio === 'number' && Number.isFinite(ratio) ? ratio : null,
  };
}
