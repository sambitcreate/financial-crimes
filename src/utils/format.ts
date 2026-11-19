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

  // A conviction is not an admission: only a plea counts as admitting guilt.
  if (stage === 'conviction' || stage === 'convicted' || stage === 'sentenced') {
    return admitted === true ? 'YES (GUILTY PLEA)' : 'NO (CONVICTED AT TRIAL)';
  }

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

export function formatComments(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
