import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '..');

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FONT_FILES = [
  path.join(ROOT_DIR, 'node_modules/source-serif/OTF/SourceSerif4Display-Bold.otf'),
  path.join(ROOT_DIR, 'node_modules/source-serif/OTF/SourceSerif4Display-Regular.otf'),
  path.join(ROOT_DIR, 'node_modules/source-serif/OTF/SourceSerif4-Regular.otf'),
  path.join(ROOT_DIR, 'node_modules/source-serif/OTF/SourceSerif4-It.otf'),
  path.join(ROOT_DIR, 'node_modules/source-sans/OTF/SourceSans3-Bold.otf'),
  path.join(ROOT_DIR, 'node_modules/source-sans/OTF/SourceSans3-Semibold.otf'),
  path.join(ROOT_DIR, 'node_modules/source-sans/OTF/SourceSans3-Regular.otf'),
  path.join(ROOT_DIR, 'node_modules/source-code-pro/OTF/SourceCodePro-Bold.otf'),
  path.join(ROOT_DIR, 'node_modules/source-code-pro/OTF/SourceCodePro-Semibold.otf'),
  path.join(ROOT_DIR, 'node_modules/source-code-pro/OTF/SourceCodePro-Regular.otf'),
];

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
];

/**
 * Strict XML escaping for SVG text nodes and attribute values.
 */
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Proportional glyph width estimator for Source Serif 4 Display Bold,
 * expressed as a fraction of font-size (em units).
 */
function estimateSerifCharEm(ch) {
  if (ch === ' ') return 0.25;
  if ('ilIjtfr.,:;\'‘’|!'.includes(ch)) return 0.32;
  if ('()[]{}“”"'.includes(ch)) return 0.38;
  if ('-–/\\'.includes(ch)) return 0.36;
  if (ch === '—') return 0.92;
  if ('mwMW'.includes(ch)) return 0.84;
  if ('ABCDEFGHKNOPQRSTUVXYZ'.includes(ch)) return 0.68;
  if ('0123456789$£€₹%'.includes(ch)) return 0.56;
  return 0.51;
}

function estimateSerifWidthPx(str, fontSize) {
  let em = 0;
  for (const ch of str) {
    em += estimateSerifCharEm(ch);
  }
  return em * fontSize;
}

/**
 * Word-wraps a headline to fit within maxWidthPx and maxLines, appending a clean
 * ellipsis (…) on the final line if the headline exceeds maxLines.
 */
export function wrapHeadlineLines(text, { fontSize, maxWidthPx, maxLines = 4 }) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return { lines: [''], truncated: false };

  const words = clean.split(' ');
  const lines = [];
  let current = '';
  let truncated = false;

  const pushSplitLongWord = (word) => {
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (chunk && estimateSerifWidthPx(next, fontSize) > maxWidthPx) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    return chunk;
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (estimateSerifWidthPx(candidate, fontSize) <= maxWidthPx) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      if (estimateSerifWidthPx(word, fontSize) > maxWidthPx) {
        current = pushSplitLongWord(word);
      } else {
        current = word;
      }
    } else {
      current = pushSplitLongWord(word);
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    truncated = true;
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1].replace(/[\s,.;:–—-]+$/u, '');
    while (last.length > 1 && estimateSerifWidthPx(`${last}…`, fontSize) > maxWidthPx) {
      const lastSpace = last.lastIndexOf(' ');
      if (lastSpace > 4) {
        last = last.slice(0, lastSpace).replace(/[\s,.;:–—-]+$/u, '');
      } else {
        last = last.slice(0, -1).replace(/[\s,.;:–—-]+$/u, '');
      }
    }
    kept[maxLines - 1] = `${last}…`;
    return { lines: kept, truncated };
  }

  return { lines, truncated };
}

/**
 * Selects the optimal display font size and wraps the headline into 1..4 lines.
 */
export function layoutHeadline(headline, maxWidthPx = 1060) {
  const shortAttempt = wrapHeadlineLines(headline, { fontSize: 52, maxWidthPx, maxLines: 2 });
  if (!shortAttempt.truncated && shortAttempt.lines.length <= 2) {
    return { lines: shortAttempt.lines, fontSize: 52, lineHeight: 62, truncated: false };
  }

  const mediumAttempt = wrapHeadlineLines(headline, { fontSize: 47, maxWidthPx, maxLines: 3 });
  if (!mediumAttempt.truncated && mediumAttempt.lines.length <= 3) {
    return { lines: mediumAttempt.lines, fontSize: 47, lineHeight: 57, truncated: false };
  }

  const compactAttempt = wrapHeadlineLines(headline, { fontSize: 41, maxWidthPx, maxLines: 4 });
  return {
    lines: compactAttempt.lines,
    fontSize: 41,
    lineHeight: 50,
    truncated: compactAttempt.truncated,
  };
}

/**
 * Wraps a monospace ledger metric value into 1..2 lines sized to fit within a single
 * 240px ledger cell with zero overlap or clipping.
 */
export function layoutMetricValue(rawValue, maxWidthPx = 236) {
  const clean = String(rawValue ?? 'Pending').replace(/\s+/g, ' ').trim() || 'Pending';

  // Source Code Pro Bold has a fixed advance of ~0.60 * fontSize.
  const measureMono = (str, size) => str.length * size * 0.6;

  if (measureMono(clean, 21) <= maxWidthPx) {
    return { lines: [clean], fontSize: 21, lineHeight: 26 };
  }
  if (measureMono(clean, 18) <= maxWidthPx) {
    return { lines: [clean], fontSize: 18, lineHeight: 23 };
  }

  const fontSize = 15.5;
  const maxChars = Math.floor(maxWidthPx / (fontSize * 0.6));
  const words = clean.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars - 1) + '…');
      current = '';
    }
  }
  if (current) lines.push(current);

  if (lines.length > 2) {
    const kept = lines.slice(0, 2);
    let second = kept[1];
    if (second.length >= maxChars) {
      second = second.slice(0, maxChars - 1);
    }
    second = second.replace(/[\s,.;:–—(-]+$/u, '');
    kept[1] = `${second}…`;
    return { lines: kept, fontSize, lineHeight: 21 };
  }

  if (lines.length === 2 && lines[1].length > maxChars) {
    lines[1] = `${lines[1].slice(0, maxChars - 1).replace(/[\s,.;:–—(-]+$/u, '')}…`;
  }

  return { lines, fontSize, lineHeight: 21 };
}

function formatApDate(iso) {
  const trimmed = String(iso ?? '').trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]) - 1;
    const d = Number(dateOnly[3]);
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return `${AP_MONTHS[m]} ${d}, ${y}`;
    }
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(parsed);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  if (!year || !month || !day) return '';
  return `${AP_MONTHS[month - 1]} ${day}, ${year}`;
}

function formatFineRatioCard(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) {
    return 'Pending';
  }
  return `${Number(pct).toFixed(2)}%`;
}

function truncateText(text, maxChars) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = (lastSpace > Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice)
    .replace(/[\s,.;:·/–—(-]+$/u, '');
  return `${trimmed}…`;
}

/**
 * Builds the 1200x630 museum-grade broadsheet clipping SVG for a single article.
 * Opinion articles use strict monochrome noir styling (#121212 / #333333 / #faf8f4).
 */
export function buildOgCardSvg(article) {
  const isOpinion = article.template === 'opinion';
  const score =
    typeof article.slap_on_wrist_score === 'number' && !Number.isNaN(article.slap_on_wrist_score)
      ? Math.round(article.slap_on_wrist_score)
      : null;
  const isHighSlap = score !== null && score >= 70;

  // Color tokens — strict monochrome noir for opinion articles (zero crimson/color accents)
  const bgPaper = '#faf8f4';
  const inkPrimary = '#121212';
  const inkSecondary = isOpinion ? '#333333' : '#4a4a4a';
  const inkMuted = isOpinion ? '#333333' : '#5a5a5a';
  const ruleLight = isOpinion ? '#333333' : '#d5d0c5';
  const accentEyebrow = isOpinion ? '#121212' : '#a62626';
  const ratioColor =
    !isOpinion && article.financials?.fine_ratio_pct !== null && article.financials?.fine_ratio_pct !== undefined
      ? '#a62626'
      : inkPrimary;

  // Badge text & palette — NEVER emits GUILTY / CONVICTED / FRAUDSTER
  const badgeText = score !== null ? `SLAP ${score}/100` : 'PENDING';
  let badgeFill = bgPaper;
  let badgeStroke = inkPrimary;
  let badgeTextFill = inkPrimary;

  if (isOpinion) {
    if (isHighSlap) {
      badgeFill = '#121212';
      badgeStroke = '#121212';
      badgeTextFill = '#faf8f4';
    } else if (score !== null) {
      badgeFill = '#faf8f4';
      badgeStroke = '#121212';
      badgeTextFill = '#121212';
    } else {
      badgeFill = '#faf8f4';
      badgeStroke = '#333333';
      badgeTextFill = '#333333';
    }
  } else if (isHighSlap) {
    badgeFill = '#a62626';
    badgeStroke = '#a62626';
    badgeTextFill = '#faf8f4';
  } else if (score !== null) {
    badgeFill = '#f2efe8';
    badgeStroke = '#121212';
    badgeTextFill = '#121212';
  } else {
    badgeFill = '#f2efe8';
    badgeStroke = '#5a5a5a';
    badgeTextFill = '#333333';
  }

  // Compute badge box width cleanly from monospace text length
  const badgeWidth = Math.max(122, Math.round(badgeText.length * 10.2 + 34));
  const badgeX = 1140 - badgeWidth;
  const badgeY = 132;
  const badgeH = 34;

  // Eyebrow: bureau/category + agencies, constrained so it never nears the badge
  const primaryEyebrow = isOpinion
    ? 'OPINION'
    : String(article.eyebrow || article.city || 'DISPATCH').trim().toUpperCase();

  const cityUpper = String(article.city ?? '').trim().toUpperCase();
  const agencyList = Array.isArray(article.agencies)
    ? article.agencies.map((a) => String(a).trim()).filter(Boolean)
    : [];
  const metaParts = [];
  if (cityUpper && !primaryEyebrow.includes(cityUpper)) {
    metaParts.push(cityUpper);
  }
  if (agencyList.length > 0) {
    metaParts.push(agencyList.slice(0, 3).join(' / ').toUpperCase());
  }
  const maxSecondaryChars = Math.max(20, 62 - primaryEyebrow.length);
  const secondaryEyebrow = metaParts.length > 0 ? truncateText(metaParts.join('  ·  '), maxSecondaryChars) : '';

  // Headline layout
  const headlineLeftX = isOpinion ? 80 : 60;
  const headlineMaxWidth = isOpinion ? 1044 : 1066;
  const headlineLayout = layoutHeadline(article.headline, headlineMaxWidth);

  // Vertically balance headline block in the central band (y=194..398)
  const blockHeight = (headlineLayout.lines.length - 1) * headlineLayout.lineHeight + headlineLayout.fontSize;
  const bandTop = 192;
  const bandBottom = 398;
  const firstBaselineY = Math.round(bandTop + (bandBottom - bandTop - blockHeight) / 2 + headlineLayout.fontSize * 0.82);

  const headlineTspans = headlineLayout.lines
    .map((line, idx) => {
      const y = firstBaselineY + idx * headlineLayout.lineHeight;
      return `<text x="${headlineLeftX}" y="${y}" font-family="Source Serif 4 Display" font-weight="700" font-size="${headlineLayout.fontSize}" fill="${inkPrimary}" letter-spacing="-0.4">${escapeXml(line)}</text>`;
    })
    .join('\n    ');

  // Subtle opinion monochrome left rule beside headline
  const opinionBar = isOpinion
    ? `<rect x="60" y="${firstBaselineY - Math.round(headlineLayout.fontSize * 0.78)}" width="4" height="${Math.round(blockHeight + 4)}" fill="#121212" />`
    : '';

  // Dateline / attribution line cleanly above the bottom ledger rule
  const bylineClean = String(article.byline ?? '').replace(/^By\s+/i, '').trim();
  const formattedDate = formatApDate(article.publish_date || article.edition_date);
  const metaLineParts = [];
  if (bylineClean) metaLineParts.push(`By ${bylineClean}`);
  if (formattedDate) metaLineParts.push(formattedDate);
  if (article.docket_number) metaLineParts.push(article.docket_number);
  const datelineText = truncateText(metaLineParts.join('  ·  '), 112);

  // 4-metric bottom ledger strip
  const financials = article.financials ?? {};
  const metrics = [
    {
      label: 'ALLEGED SCALE',
      value: financials.amount_display || 'Undisclosed',
      color: inkPrimary,
    },
    {
      label: 'PENALTY',
      value: financials.fine_display || 'Pending',
      color: inkPrimary,
    },
    {
      label: 'FINE / SCALE',
      value: formatFineRatioCard(financials.fine_ratio_pct),
      color: ratioColor,
    },
    {
      label: 'CUSTODY',
      value: financials.prison_display || 'Pending',
      color: inkPrimary,
    },
  ];

  const colWidth = 270;
  const ledgerStripSvg = metrics
    .map((metric, idx) => {
      const colX = 60 + idx * colWidth;
      const textX = idx === 0 ? colX : colX + 18;
      const cellMaxWidth = idx === 0 ? colWidth - 28 : colWidth - 38;
      const laidOut = layoutMetricValue(metric.value, cellMaxWidth);
      const valStartY = laidOut.lines.length === 1 ? 536 : 526;

      const valueNodes = laidOut.lines
        .map((line, lineIdx) => {
          const y = valStartY + lineIdx * laidOut.lineHeight;
          return `<text x="${textX}" y="${y}" font-family="Source Code Pro" font-weight="700" font-size="${laidOut.fontSize}" fill="${metric.color}">${escapeXml(line)}</text>`;
        })
        .join('\n      ');

      const divider =
        idx > 0
          ? `<line x1="${colX}" y1="472" x2="${colX}" y2="572" stroke="${ruleLight}" stroke-width="1" />`
          : '';

      return `${divider}
      <text x="${textX}" y="492" font-family="Source Sans 3" font-weight="700" font-size="12" fill="${inkMuted}" letter-spacing="1.5">${escapeXml(metric.label)}</text>
      ${valueNodes}`;
    })
    .join('\n    ');

  const secondaryEyebrowTspan = secondaryEyebrow
    ? `<tspan dx="10" font-weight="600" font-size="14" fill="${inkSecondary}" letter-spacing="1.4">${escapeXml(`·  ${secondaryEyebrow}`)}</tspan>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${bgPaper}" />

  <!-- Outer Broadsheet Press Frame -->
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="${inkPrimary}" stroke-width="1.5" />

  <!-- Nameplate Band -->
  <text x="60" y="82" font-family="Source Serif 4 Display" font-weight="700" font-size="26" fill="${inkPrimary}" letter-spacing="2.4">THE FINANCIAL CRIMES</text>
  <text x="1140" y="80" text-anchor="end" font-family="Source Code Pro" font-weight="600" font-size="14" fill="${inkSecondary}" letter-spacing="1.6">FINANCIALCRIMES.FYI</text>

  <!-- Double Press Rule -->
  <line x1="60" y1="100" x2="1140" y2="100" stroke="${inkPrimary}" stroke-width="2.5" />
  <line x1="60" y1="106" x2="1140" y2="106" stroke="${inkPrimary}" stroke-width="1" />

  <!-- Bureau / Agencies Eyebrow + Slap / Pending Badge -->
  <text x="60" y="154" font-family="Source Sans 3" font-weight="700" font-size="15" fill="${accentEyebrow}" letter-spacing="1.8">${escapeXml(primaryEyebrow)}${secondaryEyebrowTspan}</text>

  <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeH}" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="1.5" />
  <text x="${badgeX + badgeWidth / 2}" y="${badgeY + 22}" text-anchor="middle" font-family="Source Code Pro" font-weight="700" font-size="14.5" fill="${badgeTextFill}" letter-spacing="0.9">${escapeXml(badgeText)}</text>

  <!-- Headline -->
  ${opinionBar}
  ${headlineTspans}

  <!-- Byline & Dateline -->
  ${datelineText ? `<text x="60" y="430" font-family="Source Serif 4" font-style="italic" font-size="17" fill="${inkSecondary}">${escapeXml(datelineText)}</text>` : ''}

  <!-- Ledger Double Press Rule -->
  <line x1="60" y1="452" x2="1140" y2="452" stroke="${inkPrimary}" stroke-width="2" />
  <line x1="60" y1="457" x2="1140" y2="457" stroke="${inkPrimary}" stroke-width="0.75" />

  <!-- 4-Metric Bottom Ledger Strip -->
  ${ledgerStripSvg}
</svg>`;
}

let verifiedFonts = false;
function ensureFontsPresent() {
  if (verifiedFonts) return;
  const missing = FONT_FILES.filter((f) => !fs.existsSync(f));
  if (missing.length > 0) {
    throw new Error(`Missing bundled OG card font files:\n${missing.join('\n')}`);
  }
  verifiedFonts = true;
}

/**
 * Renders an SVG string to a deterministic 1200x630 PNG buffer using explicit
 * bundled OFL font files (loadSystemFonts: false for macOS/Linux CI parity).
 */
export function renderSvgToPng(svg) {
  ensureFontsPresent();
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: OG_WIDTH,
    },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'Source Sans 3',
    },
  });
  return Buffer.from(resvg.render().asPng());
}

/**
 * Builds and renders the 1200x630 PNG buffer for a single article object.
 */
export function renderOgCardPng(article) {
  const svg = buildOgCardSvg(article);
  return renderSvgToPng(svg);
}

function walkMetaFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMetaFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name === 'meta.json') {
      acc.push(fullPath);
    }
  }
  return acc;
}

/**
 * Generates bespoke 1200x630 PNG OG cards for every article under content/articles/
 * and writes them to dist/og/<slug>.png.
 */
export function generateAllOgCards({
  contentDir = path.join(ROOT_DIR, 'content', 'articles'),
  outDir = path.join(ROOT_DIR, 'dist', 'og'),
} = {}) {
  ensureFontsPresent();
  const metaFiles = walkMetaFiles(contentDir);
  if (metaFiles.length === 0) {
    throw new Error(`No article meta.json files found under ${contentDir}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const generated = [];

  for (const metaPath of metaFiles) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!meta?.slug) {
      throw new Error(`Article meta missing slug: ${metaPath}`);
    }
    const png = renderOgCardPng(meta);
    const outPath = path.join(outDir, `${meta.slug}.png`);
    fs.writeFileSync(outPath, png);
    generated.push({ slug: meta.slug, outPath, bytes: png.length });
  }

  return generated;
}

const isMainModule =
  typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  const start = Date.now();
  const generated = generateAllOgCards();
  const elapsedMs = Date.now() - start;
  console.log(
    `[og-cards] Generated ${generated.length} broadsheet OG cards in dist/og/ (${elapsedMs}ms)`
  );
}
