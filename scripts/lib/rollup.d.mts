export declare const RESOLVED_STAGES: readonly ['settlement', 'regulatory_order', 'sentenced', 'dpa'];
export declare const PENDING_STAGES: readonly [
  'investigation',
  'civil_complaint',
  'indicted',
  'arrested',
  'interim_order',
  'appeal',
];
export declare const ADJUDICATED_STAGES: readonly ['guilty_plea', 'convicted'];
export declare const CLEARED_STAGES: readonly ['dismissed', 'acquitted'];
export declare const ALL_STAGES: readonly string[];
export declare const REGION_LABELS: Readonly<Record<string, string>>;

export interface RollupRegion {
  label: string;
  case_count: number;
  resolved_case_count: number;
  total_loot_usd: number;
  total_loot_display: string;
  total_loot_resolved_usd: number;
  total_loot_resolved_display: string;
  total_loot_alleged_usd: number;
  total_loot_alleged_display: string;
  total_fines_usd: number;
  total_fines_display: string;
  total_frozen_usd: number;
  total_frozen_display: string;
  avg_fine_ratio_pct: number | null;
}

export interface RollupBody {
  edition_date: string;
  total_cases: number;
  resolved_cases: number;
  unresolved_cases: number;
  retracted_cases: number;
  total_loot_usd: number;
  total_loot_display: string;
  total_loot_resolved_usd: number;
  total_loot_resolved_display: string;
  total_loot_alleged_usd: number;
  total_loot_alleged_display: string;
  total_fines_usd: number;
  total_fines_display: string;
  total_frozen_usd: number;
  total_frozen_display: string;
  avg_fine_ratio_pct: number;
  avg_slap_on_wrist_score: number;
  zero_prison_cases: number;
  regions: Record<string, RollupRegion>;
}

export interface RollupFile extends RollupBody {
  as_of: string;
}

export interface RollupInputArticle {
  slug: string;
  legal_stage: string;
  edition: string;
  edition_date?: string;
  slap_on_wrist_score?: number | null;
  retracted?: unknown;
  financials: {
    amount_usd?: number | null;
    fine_usd?: number | null;
    prison_months?: number | null;
  };
}

export declare function formatRollupUsd(value: number): string;
export declare function aggregateRatioPct(fines: number, loot: number): number | null;
export declare function isRetracted(article: object | null | undefined): boolean;
export declare function isResolvedStage(stage: unknown): boolean;
export declare function assertRollupInput(article: unknown, label?: string): void;
export declare function newestEditionDate(
  editions?: ReadonlyArray<{ edition_date?: string } | string>
): string | null;
export declare function computeRollup(
  articles: ReadonlyArray<RollupInputArticle>,
  opts?: { editions?: ReadonlyArray<{ edition_date?: string } | string> }
): RollupBody;
export declare function loadRollupInputs(
  root?: string
): Promise<{ articles: RollupInputArticle[]; editions: Array<{ edition_date: string }> }>;
export declare function recomputeRollupFile(
  root?: string,
  opts?: { now?: () => Date }
): Promise<{ changed: boolean; rollup: RollupFile }>;
