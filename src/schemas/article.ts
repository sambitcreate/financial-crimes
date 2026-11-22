import { z } from 'zod';
// NOTE: explicit `.ts` extension so this module can be imported directly by Node's native
// type stripping (scripts/validate-content.mjs) as well as by Astro/Vite/Vitest.
import { isSafeHttpsUrl } from '../utils/sanitize.ts';

// ---------------------------------------------------------------------------
// ISO-8601 date helpers (calendar-checked: rejects 2026-02-30, "not-a-date", etc.)
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,9})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isRealCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

/** Strict `YYYY-MM-DD` with a real calendar day. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE_RE.exec(value);
  return !!m && isRealCalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Strict ISO-8601 datetime with an explicit offset (`Z` or `±HH:MM`). */
export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_DATETIME_RE.exec(value);
  return (
    !!m &&
    isRealCalendarDate(Number(m[1]), Number(m[2]), Number(m[3])) &&
    Number.isFinite(Date.parse(value))
  );
}

export const IsoDateSchema = z.string().refine(isIsoDate, 'Must be an ISO date (YYYY-MM-DD)');
export const IsoDateTimeSchema = z
  .string()
  .refine(
    isIsoDateTime,
    'Must be an ISO-8601 datetime with offset (e.g. 2026-11-22T07:00:00-05:00)'
  );
export const IsoDateOrDateTimeSchema = z
  .string()
  .refine(
    (v) => isIsoDate(v) || isIsoDateTime(v),
    'Must be an ISO date (YYYY-MM-DD) or ISO-8601 datetime with offset'
  );

const NonNegativeMoney = z.number().finite().nonnegative();

export const HttpsUrlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .refine(isSafeHttpsUrl, 'URL must use the https:// protocol');

export const LEGAL_STAGES = [
  'investigation',
  'civil_complaint',
  'indicted',
  'arrested',
  'interim_order',
  'guilty_plea',
  'convicted',
  'sentenced',
  'settlement',
  'regulatory_order',
  'dpa',
  'appeal',
  'dismissed',
  'acquitted',
] as const;

export const LegalStageSchema = z.enum(LEGAL_STAGES);
export type LegalStage = z.infer<typeof LegalStageSchema>;

/** Resolved stages: the only stages that receive a Slap-on-the-Wrist score (integer 0..100). */
export const RESOLVED_STAGES = [
  'settlement',
  'regulatory_order',
  'sentenced',
  'dpa',
] as const satisfies readonly LegalStage[];
/** Pending / contested stages: presumption of innocence applies; score and fine ratio must be null. */
export const PENDING_STAGES = [
  'investigation',
  'civil_complaint',
  'indicted',
  'arrested',
  'interim_order',
  'appeal',
] as const satisfies readonly LegalStage[];
/** Resolved without admission unless `admitted_guilt === true`. */
export const SETTLEMENT_TYPE_STAGES = [
  'settlement',
  'regulatory_order',
  'dpa',
] as const satisfies readonly LegalStage[];
/** Cases that ended without a finding of guilt. */
export const EXONERATED_STAGES = [
  'dismissed',
  'acquitted',
] as const satisfies readonly LegalStage[];

const RESOLVED_STAGE_SET = new Set<string>(RESOLVED_STAGES);
const PENDING_STAGE_SET = new Set<string>(PENDING_STAGES);
const SETTLEMENT_TYPE_STAGE_SET = new Set<string>(SETTLEMENT_TYPE_STAGES);
const EXONERATED_STAGE_SET = new Set<string>(EXONERATED_STAGES);

export const isResolvedStage = (stage: string): boolean => RESOLVED_STAGE_SET.has(stage);
export const isPendingStage = (stage: string): boolean => PENDING_STAGE_SET.has(stage);
export const isSettlementTypeStage = (stage: string): boolean =>
  SETTLEMENT_TYPE_STAGE_SET.has(stage);
export const isExoneratedStage = (stage: string): boolean => EXONERATED_STAGE_SET.has(stage);

export const ART_ACCENTS = ['crimson', 'slate', 'gold', 'sage'] as const;
export const ArtAccentSchema = z.enum(ART_ACCENTS);
export type ArtAccent = z.infer<typeof ArtAccentSchema>;

export const ART_THEMES = ['newsprint', 'monochrome'] as const;
export const ArtThemeSchema = z.enum(ART_THEMES);
export type ArtTheme = z.infer<typeof ArtThemeSchema>;

export const PALETTE_MOODS = [
  'verdict-crimson',
  'bullion-gold',
  'subpoena-cobalt',
  'banknote-emerald',
  'courtroom-ochre',
  'monochrome-noir',
] as const;
export const PaletteMoodSchema = z.enum(PALETTE_MOODS);

export const TOY_KINDS = [
  'stamp',
  'coins',
  'redaction',
  'crash-line',
  'envelopes',
  'gavel-ripple',
] as const;
export const ToyKindSchema = z.enum(TOY_KINDS);

export const LAYOUT_SLOTS = [
  'lead-hero',
  'lead-live',
  'lead-right',
  'lead-grid',
  'secondary-1',
  'secondary-2',
  'rail-feature',
  'rail-mini',
  'rail-opinion',
  'ledger',
] as const;

export const LayoutSlotSchema = z.enum(LAYOUT_SLOTS);
export type LayoutSlot = z.infer<typeof LayoutSlotSchema>;

export const ArticleTemplateSchema = z.enum(['news', 'opinion']);
export type ArticleTemplate = z.infer<typeof ArticleTemplateSchema>;

export const JurisdictionSchema = z
  .object({
    country_iso: z.string().min(2).max(10),
    venue: z.string().min(1),
  })
  .strict();
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export const LiveUpdateSchema = z
  .object({
    text: z.string().min(1),
    ago: z.string().min(1),
  })
  .strict();
export type LiveUpdate = z.infer<typeof LiveUpdateSchema>;

export const CorrectionEntrySchema = z
  .object({
    date: IsoDateOrDateTimeSchema,
    note: z.string().min(1),
    type: z.enum(['correction', 'clarification', 'update']).optional(),
  })
  .strict();
export type CorrectionEntry = z.infer<typeof CorrectionEntrySchema>;

export const FinancialsSchema = z
  .object({
    amount_usd: NonNegativeMoney.nullable(),
    amount_display: z.string().min(1),
    fine_usd: NonNegativeMoney.nullable(),
    fine_display: z.string().min(1),
    fine_ratio_pct: z.number().finite().nonnegative().nullable(),
    prison_months: z.number().finite().nonnegative().nullable(),
    prison_display: z.string().min(1),
    admitted_guilt: z.boolean().nullable(),
  })
  .strict();
export type Financials = z.infer<typeof FinancialsSchema>;

export const StreetCrimeCompareSchema = z
  .object({
    exec_summary: z.string().min(1),
    street_equivalent: z.string().min(1),
    street_sentence: z.string().min(1),
  })
  .strict();
export type StreetCrimeCompare = z.infer<typeof StreetCrimeCompareSchema>;

export const SourceCitationSchema = z
  .object({
    title: z.string().min(1),
    agency: z.string().min(1),
    url: HttpsUrlSchema,
    date: IsoDateSchema,
    /**
     * Marks a non-official (press / secondary) citation. Only secondary sources may use hosts
     * outside the official-domain allowlist, and every article needs >= 1 non-secondary source.
     */
    secondary: z.boolean().optional(),
  })
  .strict();
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const InteractiveArtSpecSchema = z
  .object({
    accent: ArtAccentSchema,
    theme: ArtThemeSchema.optional(),
    caption: z.string().min(1),
    credit: z.string().optional(),
  })
  .strict();
export type InteractiveArtSpec = z.infer<typeof InteractiveArtSpecSchema>;

export const ScoreProvenanceSchema = z
  .object({
    model: z.string().min(1),
    prompt_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/, 'prompt_sha256 must be 64 lowercase hex chars'),
    judged_at: IsoDateTimeSchema,
    components: z.record(z.string(), z.number().int()).optional(),
    rationale: z.string().optional(),
  })
  .strict();
export type ScoreProvenance = z.infer<typeof ScoreProvenanceSchema>;

/** Retraction tombstone: the article stays in the tree but renders a retraction notice. */
export const RetractionSchema = z
  .object({
    date: IsoDateSchema,
    note: z.string().min(10),
  })
  .strict();
export type Retraction = z.infer<typeof RetractionSchema>;

export const ArticleMetaSchema = z
  .object({
    id: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
    publish_date: IsoDateOrDateTimeSchema,
    edition_date: IsoDateSchema,
    city: z.string().min(1),
    edition: z.string().min(1),
    jurisdiction: JurisdictionSchema,
    category: z.string().min(1),
    agencies: z.array(z.string().min(1)).min(1),
    docket_number: z.string().nullable(),
    legal_stage: LegalStageSchema,
    template: ArticleTemplateSchema,
    eyebrow: z.string().min(1),
    headline: z.string().min(1),
    deck: z.string().min(1),
    byline: z.string().min(1),
    dateline: z.string().min(1),
    read_time_min: z.number().int().positive(),
    layout_slot: LayoutSlotSchema,
    live_updates: z.array(LiveUpdateSchema).optional(),
    corrections: z.array(CorrectionEntrySchema).optional(),
    financials: FinancialsSchema,
    slap_on_wrist_score: z.number().int().min(0).max(100).nullable(),
    score_provenance: ScoreProvenanceSchema.optional(),
    street_crime_compare: StreetCrimeCompareSchema,
    sources: z.array(SourceCitationSchema).min(1),
    interactive_art_spec: InteractiveArtSpecSchema,
    status: z.literal('published'),
    updated_at: IsoDateOrDateTimeSchema.optional(),
    retracted: RetractionSchema.optional(),
  })
  .strict();

export type ArticleMeta = z.infer<typeof ArticleMetaSchema>;

export interface ArticleRecord extends ArticleMeta {
  bodyHtml: string;
  url: string;
  contentDir: string;
}

/**
 * Allowed reference-image licences: Public Domain, CC0, CC BY *, CC BY-SA *, OGL *, GODL-India.
 * (CC BY-NC / -ND / "All Rights Reserved" / agency wire licences are rejected.)
 */
export const SOURCE_LICENSE_RE =
  /^(?:Public Domain|CC0(?: 1\.0)?|CC BY(?:-SA)? \d(?:\.\d)?(?: [A-Za-z]{2,13})?|OGL(?: v?\d(?:\.\d)?)?|GODL-India)$/;

export const SourceLicenseSchema = z
  .string()
  .regex(
    SOURCE_LICENSE_RE,
    'sourceLicense must be one of: Public Domain, CC0, CC BY <ver>, CC BY-SA <ver>, OGL <ver>, GODL-India'
  );

export const PaintRefEntrySchema = z
  .object({
    refImage: z
      .string()
      .min(1)
      .regex(/^\/paint-refs\/[a-z0-9-]+\.jpg$/, 'refImage must be /paint-refs/<slug>.jpg'),
    subject: z.string().min(1),
    sourceUrl: HttpsUrlSchema,
    sourceLicense: SourceLicenseSchema,
    isPortrait: z.boolean(),
    focalPoint: z
      .object({
        u: z.number().min(0).max(1),
        v: z.number().min(0).max(1),
      })
      .strict(),
    paletteMood: PaletteMoodSchema,
    toyKind: ToyKindSchema,
    toyText: z.string().min(1),
    toySubtext: z.string().min(1),
    alt: z.string().min(1),
  })
  .strict();
export type PaintRefEntry = z.infer<typeof PaintRefEntrySchema>;

export const PaintRefsManifestSchema = z.record(
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'paint-ref key must be lowercase kebab-case'),
  PaintRefEntrySchema
);
export type PaintRefsManifest = z.infer<typeof PaintRefsManifestSchema>;

export const EditionSlotsSchema = z
  .object({
    lead_hero: z.string().min(1),
    lead_live: z.string().min(1),
    lead_right: z.string().min(1),
    lead_grid: z.array(z.string().min(1)).min(1),
    secondary_1: z.string().min(1),
    secondary_2: z.string().min(1),
    rail_feature: z.string().min(1),
    rail_mini: z.array(z.string().min(1)).min(1),
    rail_opinion: z.array(z.string().min(1)).min(1),
    ledger: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type EditionSlots = z.infer<typeof EditionSlotsSchema>;

/** Every slug referenced by an edition's slots, in slot order (duplicates preserved). */
export function editionSlotSlugs(slots: EditionSlots): string[] {
  return [
    slots.lead_hero,
    slots.lead_live,
    slots.lead_right,
    ...slots.lead_grid,
    slots.secondary_1,
    slots.secondary_2,
    slots.rail_feature,
    ...slots.rail_mini,
    ...slots.rail_opinion,
    ...(slots.ledger ?? []),
  ];
}

export const EditionManifestSchema = z
  .object({
    edition_date: IsoDateSchema,
    volume: z.string().min(1),
    display_date: z.string().min(1),
    tagline: z.string().optional(),
    published_at: IsoDateTimeSchema.optional(),
    slots: EditionSlotsSchema,
    article_slugs: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type EditionManifest = z.infer<typeof EditionManifestSchema>;

export const RegionalRollupSchema = z
  .object({
    label: z.string().min(1),
    case_count: z.number().int().nonnegative(),
    total_loot_usd: NonNegativeMoney,
    total_loot_display: z.string().min(1),
    total_fines_usd: NonNegativeMoney,
    total_fines_display: z.string().min(1),
    avg_fine_ratio_pct: z.number().nonnegative().nullable(),
  })
  .passthrough();
export type RegionalRollup = z.infer<typeof RegionalRollupSchema>;

/**
 * Rollup is generated by scripts/recompute-rollup.mjs. It stays `.passthrough()` so new
 * generated fields survive the build-time loader without a schema bump.
 */
export const RollupStatsSchema = z
  .object({
    as_of: IsoDateTimeSchema,
    edition_date: IsoDateSchema,
    total_cases: z.number().int().nonnegative(),
    total_loot_usd: NonNegativeMoney,
    total_loot_display: z.string().min(1),
    total_fines_usd: NonNegativeMoney,
    total_fines_display: z.string().min(1),
    total_frozen_usd: NonNegativeMoney.optional(),
    total_frozen_display: z.string().min(1).optional(),
    avg_fine_ratio_pct: z.number().nonnegative(),
    avg_slap_on_wrist_score: z.number().min(0).max(100),
    zero_prison_cases: z.number().int().nonnegative(),
    regions: z.record(z.string(), RegionalRollupSchema),
  })
  .passthrough();
export type RollupStats = z.infer<typeof RollupStatsSchema>;

// ---------------------------------------------------------------------------
// Cross-field legal rules (AGENTS.md §2C, CONTRACTS.md). Pure functions called by
// scripts/validate-content.mjs. They are intentionally NOT baked into ArticleMetaSchema:
// the build-time loader enforces shape only, while the validator (run first by
// `npm run build`) fails the build with readable, per-field messages.
// ---------------------------------------------------------------------------

/** Labels that must never attach to a person whose case is pending, settled without admission, or exonerated. */
export const PRESUMPTION_BANNED_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: 'GUILTY', re: /\bguilty\b/i },
  { label: 'CONVICTED/CONVICT', re: /\bconvict(?:s|ed|ion|ions)?\b/i },
  { label: 'FRAUDSTER', re: /\bfraudsters?\b/i },
  { label: 'CROOK', re: /\bcrook(?:s|ed)?\b/i },
  // "criminal" used as a noun/label ("criminals", "a criminal", "career criminal", "…, criminal."),
  // not as an adjective ("criminal charges", "criminal complaint").
  {
    label: 'CRIMINAL (label)',
    re: /\bcriminals\b|\b(?:a|the|career|convicted|common|white-collar|master)\s+criminal\b(?!\s+[a-z])|\bcriminal\b(?=\s*(?:$|[.,;:!?)\]—–"'’”]))/i,
  },
  { label: 'BEHIND BARS', re: /\bbehind\s+bars\b/i },
  { label: 'PRISON BARS', re: /\bprison\s+bars\b/i },
  { label: 'HANDCUFFS', re: /\bhandcuff(?:s|ed|ing)?\b/i },
  { label: 'MUGSHOT', re: /\bmug\s?shots?\b/i },
];

/** Additional phrases banned on settlement / regulatory_order / dpa when admitted_guilt !== true. */
export const NO_ADMISSION_BANNED_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: 'ADMITS GUILT', re: /\badmit(?:s|ted|ting)?\s+(?:to\s+)?guilt\b/i },
  { label: 'PLEADED GUILTY', re: /\bple(?:a|d|ad|aded|ads)\s+guilty\b/i },
  { label: 'CONFESSES', re: /\bconfess(?:es|ed)?\b/i },
];

/** Neutralises phrases that contain banned words but state the opposite ("pleaded not guilty"). */
function stripNegatedPhrases(text: string): string {
  return text
    .replace(/\bnot\s+guilty\b/gi, ' ')
    .replace(/\bno\s+(?:admission|finding)\s+of\s+guilt\b/gi, ' ');
}

export type BannedTermRegime = 'pending' | 'no-admission' | 'exonerated';

/** Which banned-term regime (if any) applies to an article's stage + admission flag. */
export function bannedTermRegime(
  stage: string,
  admittedGuilt: boolean | null | undefined
): BannedTermRegime | null {
  if (isPendingStage(stage)) return 'pending';
  if (isExoneratedStage(stage)) return 'exonerated';
  if (isSettlementTypeStage(stage) && admittedGuilt !== true) return 'no-admission';
  return null;
}

/** Returns the labels of banned terms found in `text` under the regime implied by stage + admission. */
export function findBannedTerms(
  text: string,
  stage: string,
  admittedGuilt: boolean | null | undefined
): string[] {
  const regime = bannedTermRegime(stage, admittedGuilt);
  if (!regime || !text) return [];
  const haystack = stripNegatedPhrases(text);
  const patterns =
    regime === 'no-admission'
      ? [...PRESUMPTION_BANNED_PATTERNS, ...NO_ADMISSION_BANNED_PATTERNS]
      : PRESUMPTION_BANNED_PATTERNS;
  return patterns.filter(({ re }) => re.test(haystack)).map(({ label }) => label);
}

/** Max allowed |stored − fine_usd/amount_usd×100| in percentage points. */
export const FINE_RATIO_TOLERANCE_PCT = 0.15;

/** round(fine_usd / amount_usd × 100, 1), or null when not computable. */
export function computeFineRatioPct(
  fineUsd: number | null | undefined,
  amountUsd: number | null | undefined
): number | null {
  if (fineUsd == null || amountUsd == null || !(amountUsd > 0) || fineUsd < 0) return null;
  return Math.round((fineUsd / amountUsd) * 1000) / 10;
}

export interface RuleFindings {
  errors: string[];
  warnings: string[];
}

/** Article display fields that must respect presumption-of-innocence wording. */
export function articleDisplayFields(meta: ArticleMeta): Array<[string, string]> {
  const out: Array<[string, string]> = [
    ['headline', meta.headline],
    ['deck', meta.deck],
    ['eyebrow', meta.eyebrow],
    ['interactive_art_spec.caption', meta.interactive_art_spec.caption],
  ];
  if (meta.interactive_art_spec.credit) {
    out.push(['interactive_art_spec.credit', meta.interactive_art_spec.credit]);
  }
  for (const [i, u] of (meta.live_updates ?? []).entries()) {
    out.push([`live_updates[${i}].text`, u.text]);
  }
  return out;
}

/** Paint-ref display fields that must respect presumption-of-innocence wording. */
export function paintRefDisplayFields(entry: PaintRefEntry): Array<[string, string]> {
  return [
    ['toyText', entry.toyText],
    ['toySubtext', entry.toySubtext],
    ['alt', entry.alt],
    ['subject', entry.subject],
  ];
}

/**
 * Single-article legal / scoring rules (AGENTS.md §2C + CONTRACTS.md). Pass the article's
 * paint-ref entry to also enforce the opinion-monochrome rule and paint-ref wording.
 */
export function checkArticleRules(
  meta: ArticleMeta,
  paintRef?: PaintRefEntry | null
): RuleFindings {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stage = meta.legal_stage;
  const fin = meta.financials;
  const score = meta.slap_on_wrist_score;

  // Score <-> stage
  if (isResolvedStage(stage)) {
    if (score === null) {
      warnings.push(`slap_on_wrist_score is null on resolved stage "${stage}" (pending judge run)`);
    }
  } else if (score !== null) {
    errors.push(
      `slap_on_wrist_score must be null on unresolved stage "${stage}" (got ${score}); only ${RESOLVED_STAGES.join('/')} are scored`
    );
  }

  // Score provenance
  if (meta.score_provenance && score === null) {
    errors.push('score_provenance is present but slap_on_wrist_score is null');
  } else if (!meta.score_provenance && score !== null) {
    warnings.push(
      'slap_on_wrist_score has no score_provenance (legacy score predating provenance)'
    );
  }

  // admitted_guilt cannot be true while the case is pending
  if (isPendingStage(stage) && fin.admitted_guilt === true) {
    errors.push(`financials.admitted_guilt must not be true on pending stage "${stage}"`);
  }

  // Fine ratio
  if (isPendingStage(stage)) {
    if (fin.fine_ratio_pct !== null) {
      errors.push(
        `financials.fine_ratio_pct must be null on pending stage "${stage}" (got ${fin.fine_ratio_pct}); money frozen or at issue in a pending case is not a fine`
      );
    }
  } else {
    const exact =
      fin.fine_usd != null && fin.amount_usd != null && fin.amount_usd > 0
        ? (fin.fine_usd / fin.amount_usd) * 100
        : null;
    if (exact !== null) {
      const computed = computeFineRatioPct(fin.fine_usd, fin.amount_usd);
      if (isResolvedStage(stage) && fin.fine_ratio_pct === null) {
        errors.push(
          `financials.fine_ratio_pct is null but fine_usd/amount_usd×100 = ${computed} on resolved stage "${stage}"`
        );
      } else if (
        fin.fine_ratio_pct !== null &&
        Math.abs(fin.fine_ratio_pct - exact) > FINE_RATIO_TOLERANCE_PCT
      ) {
        errors.push(
          `financials.fine_ratio_pct (${fin.fine_ratio_pct}) disagrees with fine_usd/amount_usd×100 = ${computed} (tolerance ±${FINE_RATIO_TOLERANCE_PCT})`
        );
      }
    }
  }

  // Opinion monochrome rule
  if (meta.template === 'opinion') {
    if (meta.interactive_art_spec.theme !== 'monochrome') {
      errors.push('template "opinion" requires interactive_art_spec.theme "monochrome"');
    }
    if (paintRef && paintRef.paletteMood !== 'monochrome-noir') {
      errors.push(
        `template "opinion" requires paint-refs paletteMood "monochrome-noir" (got "${paintRef.paletteMood}")`
      );
    }
  }

  // Presumption of innocence / no-admission wording
  const regime = bannedTermRegime(stage, fin.admitted_guilt);
  if (regime) {
    const why =
      regime === 'pending'
        ? `pending stage "${stage}"`
        : regime === 'exonerated'
          ? `exonerated stage "${stage}"`
          : `stage "${stage}" without admitted_guilt: true`;
    for (const [field, text] of articleDisplayFields(meta)) {
      const hits = findBannedTerms(text, stage, fin.admitted_guilt);
      if (hits.length) errors.push(`${field} uses banned term(s) ${hits.join(', ')} on ${why}`);
    }
    if (paintRef) {
      for (const [field, text] of paintRefDisplayFields(paintRef)) {
        const hits = findBannedTerms(text, stage, fin.admitted_guilt);
        if (hits.length) {
          errors.push(`paint-refs ${field} uses banned term(s) ${hits.join(', ')} on ${why}`);
        }
      }
    }
  }

  // Retraction sanity
  if (meta.retracted) {
    const pubDay = meta.publish_date.slice(0, 10);
    if (meta.retracted.date < pubDay) {
      errors.push(`retracted.date (${meta.retracted.date}) is before publish_date (${pubDay})`);
    }
  }

  return { errors, warnings };
}
