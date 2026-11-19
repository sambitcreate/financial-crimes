import type { HSL, PaletteMood } from './types';

/**
 * The Financial Crimes editorial oil palette — rich New Yorker / NYT Magazine
 * broadsheet oils: deep legal carmine, sovereign bullion, subpoena Prussian cobalt,
 * intaglio currency green, courtroom walnut ochre, warm printer's lampblack,
 * and aged cotton rag newsprint.
 */
export const FC_OIL = {
  verdictCrimson: [355, 68, 41],
  bullionGold: [41, 74, 50],
  subpoenaCobalt: [213, 52, 37],
  banknoteEmerald: [154, 42, 32],
  courtroomOchre: [30, 56, 46],
  pressBlack: [28, 12, 11],
  newsprintCream: [39, 34, 93],
  charcoalShadow: [218, 16, 17],
  scandalRose: [348, 48, 56],
  editorialSlate: [210, 26, 44],
} as const satisfies Record<string, HSL>;

export interface MoodProfile {
  /** Primary editorial accent pigment (stamps, highlights, dramatic touches). */
  accent: HSL;
  /** Secondary warm/cool balancing glaze. */
  midtone: HSL;
  /** Deep shadow glaze blended gently into outer vignette & dark planes. */
  shadow: HSL;
  /** Warm paper/highlight glaze for light planes. */
  paper: HSL;
  /** Saturation multiplier applied to reference pixels during editorial grading. */
  satBoost: number;
  /** Subtle glaze strength for edge vignette (0..0.3). */
  vignetteStrength: number;
}

export const MOOD_PROFILES: Record<PaletteMood, MoodProfile> = {
  'verdict-crimson': {
    accent: FC_OIL.verdictCrimson,
    midtone: FC_OIL.courtroomOchre,
    shadow: [350, 26, 15],
    paper: FC_OIL.newsprintCream,
    satBoost: 1.18,
    vignetteStrength: 0.22,
  },
  'bullion-gold': {
    accent: FC_OIL.bullionGold,
    midtone: FC_OIL.courtroomOchre,
    shadow: [32, 24, 15],
    paper: [42, 42, 92],
    satBoost: 1.2,
    vignetteStrength: 0.2,
  },
  'subpoena-cobalt': {
    accent: FC_OIL.subpoenaCobalt,
    midtone: FC_OIL.editorialSlate,
    shadow: FC_OIL.charcoalShadow,
    paper: [40, 28, 93],
    satBoost: 1.16,
    vignetteStrength: 0.22,
  },
  'banknote-emerald': {
    accent: FC_OIL.banknoteEmerald,
    midtone: FC_OIL.bullionGold,
    shadow: [164, 24, 14],
    paper: [44, 30, 92],
    satBoost: 1.17,
    vignetteStrength: 0.2,
  },
  'courtroom-ochre': {
    accent: FC_OIL.courtroomOchre,
    midtone: FC_OIL.scandalRose,
    shadow: [26, 26, 15],
    paper: [38, 38, 92],
    satBoost: 1.18,
    vignetteStrength: 0.21,
  },
  'monochrome-noir': {
    accent: FC_OIL.verdictCrimson,
    midtone: FC_OIL.editorialSlate,
    shadow: FC_OIL.pressBlack,
    paper: [38, 22, 93],
    satBoost: 0.15,
    vignetteStrength: 0.24,
  },
};

export function resolveMoodProfile(mood?: PaletteMood): MoodProfile {
  if (mood && mood in MOOD_PROFILES) {
    return MOOD_PROFILES[mood];
  }
  return MOOD_PROFILES['verdict-crimson'];
}

export function accentToMood(accent?: string, theme?: string): PaletteMood {
  if (theme === 'monochrome') return 'monochrome-noir';
  switch (accent) {
    case 'gold':
      return 'bullion-gold';
    case 'slate':
      return 'subpoena-cobalt';
    case 'sage':
      return 'banknote-emerald';
    case 'crimson':
    default:
      return 'verdict-crimson';
  }
}
