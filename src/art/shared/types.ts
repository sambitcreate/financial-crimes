export type ArtArchetype =
  | 'shell-network'
  | 'scale-of-impunity'
  | 'redacted-dossier'
  | 'pump-dump-ticker'
  | 'ponzi-pyramid'
  | 'offshore-flight-map'
  | 'editorial-vignette'
  | 'penalty-wheel';

export type ArtAccent = 'crimson' | 'slate' | 'gold' | 'sage';
export type ArtTheme = 'newsprint' | 'monochrome';
export type ArtMode = 'hero' | 'inline' | 'thumb';
export type ArtAspect = '4/5' | '16/9' | '16/10' | '1/1' | '4/3';

export interface InteractiveArtSpec {
  archetype: ArtArchetype | string;
  accent?: ArtAccent | string;
  theme?: ArtTheme;
  caption?: string;
  credit?: string;
  data?: Record<string, unknown>;
}

export interface MountOptions {
  seed: string;
  mode: ArtMode;
  aspect?: ArtAspect;
  reducedMotion: boolean;
  signal: AbortSignal;
}

export interface ArchetypeModule {
  mount: (container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions) => void;
}

export interface AccessibleTableData {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface ShellNode {
  id: string;
  label: string;
  role?: string;
  amount?: string;
  jurisdiction?: string;
  kind?: 'source' | 'shell' | 'intermediary' | 'asset' | 'regulator' | 'person' | 'bank';
  note?: string;
  x?: number;
  y?: number;
}

export interface ShellEdge {
  from: string;
  to: string;
  amount?: string;
  label?: string;
  note?: string;
  dashed?: boolean;
}

export interface DossierExcerpt {
  label?: string;
  prefix?: string;
  redacted: string;
  suffix?: string;
  note?: string;
}

export type DossierIcon =
  | 'briefcase'
  | 'shredder'
  | 'vault'
  | 'gavel'
  | 'skyscraper'
  | 'yacht'
  | 'jet'
  | 'chip'
  | 'bank'
  | 'scales';

export interface TickerPoint {
  label: string;
  value: number;
  volume?: number;
}

export interface TickerEvent {
  index: number;
  label: string;
  detail?: string;
  kind?: 'pump' | 'sell' | 'warning' | 'enforcement';
}

export interface PonziTier {
  label: string;
  count?: string;
  inflow: string;
  payout: string;
  note?: string;
}

export interface MapWaypoint {
  id: string;
  label: string;
  lat: number;
  lon: number;
  role?: string;
  amount?: string;
  status?: string;
}

export interface MapRoute {
  from: string;
  to: string;
  amount?: string;
  label?: string;
  loop?: boolean;
}

export type VignetteScene =
  | 'marina_yacht'
  | 'boardroom_shredder'
  | 'server_vault'
  | 'courthouse'
  | 'trading_desk'
  | 'matryoshka';

export interface VignetteHotspot {
  id?: string;
  x?: number;
  y?: number;
  title: string;
  figure?: string;
  note: string;
}

export interface PenaltyComparison {
  id: string;
  label: string;
  value: string;
  detail: string;
  score?: number;
}
