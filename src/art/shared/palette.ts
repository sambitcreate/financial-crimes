import type { ArtAccent, ArtAspect, ArtTheme } from './types';

export interface EditorialPalette {
  theme: ArtTheme;
  accentName: ArtAccent;
  paper: string;
  paperAlt: string;
  paperCard: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  inkFaint: string;
  rule: string;
  ruleLight: string;
  accent: string;
  accentSoft: string;
  accentWash: string;
  crimson: string;
  slate: string;
  gold: string;
  sage: string;
  brass: string;
  brassLight: string;
}

const ACCENT_MAP: Record<ArtAccent, { main: string; soft: string; wash: string }> = {
  crimson: {
    main: '#a62626',
    soft: '#c25252',
    wash: 'rgba(166, 38, 38, 0.11)',
  },
  slate: {
    main: '#2b4c6f',
    soft: '#527396',
    wash: 'rgba(43, 76, 111, 0.11)',
  },
  gold: {
    main: '#b5892e',
    soft: '#cba34f',
    wash: 'rgba(181, 137, 46, 0.13)',
  },
  sage: {
    main: '#3d6b59',
    soft: '#628d7b',
    wash: 'rgba(61, 107, 89, 0.12)',
  },
};

export function resolveAccent(accent?: string): ArtAccent {
  if (accent === 'crimson' || accent === 'slate' || accent === 'gold' || accent === 'sage') {
    return accent;
  }
  return 'crimson';
}

export function getPalette(accentInput?: string, themeInput?: ArtTheme): EditorialPalette {
  const theme: ArtTheme = themeInput === 'monochrome' ? 'monochrome' : 'newsprint';
  const accentName = resolveAccent(accentInput);
  const a = ACCENT_MAP[accentName];

  if (theme === 'monochrome') {
    return {
      theme,
      accentName,
      paper: '#f7f7f5',
      paperAlt: '#ededeb',
      paperCard: '#ffffff',
      ink: '#121212',
      inkSoft: '#2d2d2d',
      inkMuted: '#595959',
      inkFaint: '#969696',
      rule: '#121212',
      ruleLight: '#d2d2ce',
      accent: '#121212',
      accentSoft: '#454545',
      accentWash: 'rgba(18, 18, 18, 0.08)',
      crimson: '#121212',
      slate: '#2f2f2f',
      gold: '#525252',
      sage: '#3c3c3c',
      brass: '#303030',
      brassLight: '#8a8a8a',
    };
  }

  return {
    theme,
    accentName,
    paper: '#f6f3ec',
    paperAlt: '#ece7db',
    paperCard: '#fbf9f4',
    ink: '#121212',
    inkSoft: '#2a2824',
    inkMuted: '#5e594f',
    inkFaint: '#9b9485',
    rule: '#1d1b18',
    ruleLight: '#d5cebe',
    accent: a.main,
    accentSoft: a.soft,
    accentWash: a.wash,
    crimson: '#a62626',
    slate: '#2b4c6f',
    gold: '#b5892e',
    sage: '#3d6b59',
    brass: '#9d7628',
    brassLight: '#cfb06b',
  };
}

export function getViewBox(aspect: ArtAspect = '16/9'): { width: number; height: number } {
  switch (aspect) {
    case '4/5':
      return { width: 640, height: 800 };
    case '16/10':
      return { width: 960, height: 600 };
    case '1/1':
      return { width: 640, height: 640 };
    case '4/3':
      return { width: 800, height: 600 };
    case '16/9':
    default:
      return { width: 960, height: 540 };
  }
}

export const EDITORIAL_FONTS = {
  serif: "'Newsreader', 'Source Serif 4', Georgia, serif",
  sans: "'Libre Franklin', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  blackletter: "'UnifrakturMaguntia', 'Chomsky', Georgia, serif",
};
