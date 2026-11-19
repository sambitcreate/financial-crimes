import { z } from 'zod';

export const ART_ARCHETYPES = [
  'shell-network',
  'scale-of-impunity',
  'redacted-dossier',
  'pump-dump-ticker',
  'ponzi-pyramid',
  'offshore-flight-map',
  'editorial-vignette',
  'penalty-wheel',
] as const;

export const ArtArchetypeSchema = z.enum(ART_ARCHETYPES);
export type ArtArchetype = z.infer<typeof ArtArchetypeSchema>;

export const ART_ACCENTS = ['crimson', 'slate', 'gold', 'sage'] as const;
export const ArtAccentSchema = z.enum(ART_ACCENTS);
export type ArtAccent = z.infer<typeof ArtAccentSchema>;

export const ART_THEMES = ['newsprint', 'monochrome'] as const;
export const ArtThemeSchema = z.enum(ART_THEMES);
export type ArtTheme = z.infer<typeof ArtThemeSchema>;

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

export const JurisdictionSchema = z.object({
  country_iso: z.string().min(2).max(10),
  venue: z.string().min(1),
});
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;

export const LiveUpdateSchema = z.object({
  text: z.string().min(1),
  ago: z.string().min(1),
});
export type LiveUpdate = z.infer<typeof LiveUpdateSchema>;

export const FinancialsSchema = z.object({
  amount_usd: z.number().nullable(),
  amount_display: z.string().min(1),
  fine_usd: z.number().nullable(),
  fine_display: z.string().min(1),
  fine_ratio_pct: z.number().nullable(),
  prison_months: z.number().nullable(),
  prison_display: z.string().min(1),
  admitted_guilt: z.boolean().nullable(),
});
export type Financials = z.infer<typeof FinancialsSchema>;

export const StreetCrimeCompareSchema = z.object({
  exec_summary: z.string().min(1),
  street_equivalent: z.string().min(1),
  street_sentence: z.string().min(1),
});
export type StreetCrimeCompare = z.infer<typeof StreetCrimeCompareSchema>;

export const SourceCitationSchema = z.object({
  title: z.string().min(1),
  agency: z.string().min(1),
  url: z.string().url(),
  date: z.string().min(1),
});
export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const InteractiveArtSpecSchema = z.object({
  archetype: ArtArchetypeSchema,
  accent: ArtAccentSchema,
  theme: ArtThemeSchema.optional(),
  caption: z.string().min(1),
  credit: z.string().optional(),
  data: z.record(z.string(), z.any()),
});
export type InteractiveArtSpec = z.infer<typeof InteractiveArtSpecSchema>;

export const ArticleMetaSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
  publish_date: z.string().min(1),
  edition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'edition_date must be YYYY-MM-DD'),
  city: z.string().min(1),
  edition: z.string().min(1),
  jurisdiction: JurisdictionSchema,
  category: z.string().min(1),
  agencies: z.array(z.string().min(1)).min(1),
  docket_number: z.string().nullable(),
  legal_stage: z.string().min(1),
  template: ArticleTemplateSchema,
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  deck: z.string().min(1),
  byline: z.string().min(1),
  dateline: z.string().min(1),
  read_time_min: z.number().int().positive(),
  comment_count: z.number().int().nonnegative(),
  layout_slot: LayoutSlotSchema,
  live_updates: z.array(LiveUpdateSchema).optional(),
  financials: FinancialsSchema,
  slap_on_wrist_score: z.number().min(0).max(100).nullable(),
  street_crime_compare: StreetCrimeCompareSchema,
  sources: z.array(SourceCitationSchema).min(1),
  interactive_art_spec: InteractiveArtSpecSchema,
  status: z.literal('published'),
});

export type ArticleMeta = z.infer<typeof ArticleMetaSchema>;

export interface ArticleRecord extends ArticleMeta {
  bodyHtml: string;
  url: string;
  contentDir: string;
}

export const EditionSlotsSchema = z.object({
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
});
export type EditionSlots = z.infer<typeof EditionSlotsSchema>;

export const EditionManifestSchema = z.object({
  edition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'edition_date must be YYYY-MM-DD'),
  volume: z.string().min(1),
  display_date: z.string().min(1),
  tagline: z.string().optional(),
  published_at: z.string().optional(),
  slots: EditionSlotsSchema,
  article_slugs: z.array(z.string().min(1)).optional(),
});
export type EditionManifest = z.infer<typeof EditionManifestSchema>;

export const RegionalRollupSchema = z.object({
  label: z.string().min(1),
  case_count: z.number().int().nonnegative(),
  total_loot_usd: z.number().nonnegative(),
  total_loot_display: z.string().min(1),
  total_fines_usd: z.number().nonnegative(),
  total_fines_display: z.string().min(1),
  avg_fine_ratio_pct: z.number().nonnegative().nullable(),
});
export type RegionalRollup = z.infer<typeof RegionalRollupSchema>;

export const RollupStatsSchema = z.object({
  as_of: z.string().min(1),
  edition_date: z.string().min(1),
  total_cases: z.number().int().nonnegative(),
  total_loot_usd: z.number().nonnegative(),
  total_loot_display: z.string().min(1),
  total_fines_usd: z.number().nonnegative(),
  total_fines_display: z.string().min(1),
  avg_fine_ratio_pct: z.number().nonnegative(),
  avg_slap_on_wrist_score: z.number().min(0).max(100),
  zero_prison_cases: z.number().int().nonnegative(),
  regions: z.record(z.string(), RegionalRollupSchema),
});
export type RollupStats = z.infer<typeof RollupStatsSchema>;
