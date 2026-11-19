import type {
  AccessibleTableData,
  ArtArchetype,
  DossierExcerpt,
  DossierIcon,
  InteractiveArtSpec,
  MapRoute,
  MapWaypoint,
  PenaltyComparison,
  PonziTier,
  ShellEdge,
  ShellNode,
  TickerEvent,
  TickerPoint,
  VignetteHotspot,
  VignetteScene,
} from './types';

function asObj(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

function asStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  return fallback;
}

function asNum(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function resolveArchetype(raw?: string): ArtArchetype {
  const known: ArtArchetype[] = [
    'shell-network',
    'scale-of-impunity',
    'redacted-dossier',
    'pump-dump-ticker',
    'ponzi-pyramid',
    'offshore-flight-map',
    'editorial-vignette',
    'penalty-wheel',
  ];
  if (raw && (known as string[]).includes(raw)) {
    return raw as ArtArchetype;
  }
  return 'redacted-dossier';
}

// 1. SHELL NETWORK
export interface NormalizedShellNetwork {
  title: string;
  subtitle: string;
  nodes: ShellNode[];
  edges: ShellEdge[];
}

export function normalizeShellNetwork(spec: InteractiveArtSpec): NormalizedShellNetwork {
  const d = asObj(spec.data);
  const rawNodes = Array.isArray(d.nodes) ? d.nodes : Array.isArray(d.entities) ? d.entities : [];
  const rawEdges = Array.isArray(d.edges)
    ? d.edges
    : Array.isArray(d.flows)
      ? d.flows
      : Array.isArray(d.links)
        ? d.links
        : [];

  let nodes: ShellNode[] = rawNodes
    .map((item, idx) => {
      const o = asObj(item);
      const id = asStr(o.id, `n${idx + 1}`);
      const label = asStr(o.label ?? o.name, `Entity ${idx + 1}`);
      return {
        id,
        label,
        role: asStr(o.role ?? o.type ?? o.subtitle, ''),
        amount: asStr(o.amount ?? o.value, ''),
        jurisdiction: asStr(o.jurisdiction ?? o.city ?? o.country, ''),
        kind: (asStr(o.kind, 'shell') as ShellNode['kind']) || 'shell',
        note: asStr(o.note ?? o.detail ?? o.filing, ''),
        x: typeof o.x === 'number' ? o.x : undefined,
        y: typeof o.y === 'number' ? o.y : undefined,
      };
    })
    .filter((n) => n.label.length > 0);

  let edges: ShellEdge[] = rawEdges
    .map((item) => {
      const o = asObj(item);
      return {
        from: asStr(o.from ?? o.source),
        to: asStr(o.to ?? o.target),
        amount: asStr(o.amount ?? o.value, ''),
        label: asStr(o.label ?? o.desc, ''),
        note: asStr(o.note ?? o.detail, ''),
        dashed: Boolean(o.dashed),
      };
    })
    .filter((e) => e.from && e.to);

  if (nodes.length < 2) {
    nodes = [
      { id: 'src', label: 'Source Capital', role: 'Origin', amount: '$150M', jurisdiction: 'New York', kind: 'source', note: 'Initial institutional or retail inflow per docket.' },
      { id: 'mid1', label: 'Intermediary LLC', role: 'Conduit', amount: '$92M', jurisdiction: 'Delaware', kind: 'shell', note: 'Pass-through entity with no operating staff.' },
      { id: 'mid2', label: 'Offshore Holdings Ltd.', role: 'Shell', amount: '$58M', jurisdiction: 'Cayman Is.', kind: 'shell', note: 'Nominee director account flagged in filings.' },
      { id: 'dst1', label: 'Private Real Estate', role: 'Asset', amount: '$42M', jurisdiction: 'Miami / Gurugram', kind: 'asset', note: 'Luxury property acquired via third-party trust.' },
      { id: 'dst2', label: 'Executive Accounts', role: 'Beneficiary', amount: '$16M', jurisdiction: 'Zurich', kind: 'person', note: 'Discretionary disbursements cited by prosecutors.' },
    ];
    edges = [
      { from: 'src', to: 'mid1', amount: '$92M', label: 'Wire Tranche A' },
      { from: 'src', to: 'mid2', amount: '$58M', label: 'Advisory Fee' },
      { from: 'mid1', to: 'dst1', amount: '$42M', label: 'Escrow Diversion' },
      { from: 'mid2', to: 'dst2', amount: '$16M', label: 'Shell Distribution', dashed: true },
      { from: 'mid1', to: 'mid2', amount: '$24M', label: 'Inter-Co Loan', dashed: true },
    ];
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  if (edges.length === 0 && nodes.length >= 2) {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id, amount: nodes[i + 1].amount || '' });
    }
  }

  return {
    title: asStr(d.title, 'Tracing the Flow of Funds'),
    subtitle: asStr(d.subtitle, 'Click or drag entities to inspect upstream & downstream filing links'),
    nodes,
    edges,
  };
}

// 2. SCALE OF IMPUNITY
export interface NormalizedScale {
  title: string;
  subtitle: string;
  lootLabel: string;
  lootDisplay: string;
  lootUsd: number;
  fineLabel: string;
  fineDisplay: string;
  fineUsd: number;
  ratioPct: number;
  ratioDisplay: string;
  stampText: string;
  streetLabel: string;
  streetAmountDisplay: string;
  streetSentenceDisplay: string;
  execSentenceDisplay: string;
  showRoundingGrid: boolean;
}

export function normalizeScaleOfImpunity(spec: InteractiveArtSpec): NormalizedScale {
  const d = asObj(spec.data);
  const lootUsd = Math.max(1, asNum(d.lootUsd ?? d.loot_usd ?? d.amount_usd, 2_250_000_000));
  const fineUsd = Math.max(0, asNum(d.fineUsd ?? d.fine_usd, 21_500_000));
  const computedPct = lootUsd > 0 ? (fineUsd / lootUsd) * 100 : 0;
  const ratioPct = asNum(d.gridRatioPct ?? d.ratioPct ?? d.fine_ratio_pct, computedPct);
  const street = asObj(d.streetComparison ?? d.street_crime_compare);

  return {
    title: asStr(d.title, 'The Ledger of Disproportion'),
    subtitle: asStr(d.subtitle, 'Comparing alleged illicit volume against civil penalty assessed'),
    lootLabel: asStr(d.lootLabel ?? d.loot_label, 'Alleged Harm / Volume'),
    lootDisplay: asStr(d.lootDisplay ?? d.loot_display, formatShortUsd(lootUsd)),
    lootUsd,
    fineLabel: asStr(d.fineLabel ?? d.fine_label, 'Penalty / Restitution'),
    fineDisplay: asStr(d.fineDisplay ?? d.fine_display, formatShortUsd(fineUsd)),
    fineUsd,
    ratioPct: Number.isFinite(ratioPct) ? Math.max(0, ratioPct) : 0,
    ratioDisplay: asStr(
      d.ratioDisplay ?? d.ratio_display,
      ratioPct < 10 ? `${ratioPct.toFixed(2)}% OF LOOT` : `${ratioPct.toFixed(1)}% OF LOOT`
    ),
    stampText: asStr(
      d.stampText ?? d.stamp_text,
      ratioPct < 2 ? 'ROUNDING ERROR' : ratioPct < 15 ? 'COST OF BUSINESS' : 'SETTLED'
    ),
    streetLabel: asStr(street.label ?? street.street_equivalent, 'Median Retail Register Theft'),
    streetAmountDisplay: asStr(street.amountDisplay, '$1,800'),
    streetSentenceDisplay: asStr(street.sentenceDisplay ?? street.street_sentence, '18–36 Months Felony Prison'),
    execSentenceDisplay: asStr(street.execSentenceDisplay ?? street.exec_summary, '0 Executives Charged'),
    showRoundingGrid: ratioPct > 0 && ratioPct <= 5,
  };
}

// 3. REDACTED DOSSIER
export interface NormalizedDossier {
  exhibitLabel: string;
  docketNumber: string;
  subject: string;
  subtitle: string;
  icon: DossierIcon;
  stamp: string;
  excerpts: DossierExcerpt[];
}

const VALID_ICONS: DossierIcon[] = [
  'briefcase',
  'shredder',
  'vault',
  'gavel',
  'skyscraper',
  'yacht',
  'jet',
  'chip',
  'bank',
  'scales',
];

export function normalizeRedactedDossier(spec: InteractiveArtSpec): NormalizedDossier {
  const d = asObj(spec.data);
  const iconRaw = asStr(d.icon, 'briefcase') as DossierIcon;
  const icon: DossierIcon = VALID_ICONS.includes(iconRaw) ? iconRaw : 'briefcase';
  const rawExcerpts = Array.isArray(d.excerpts)
    ? d.excerpts
    : Array.isArray(d.redactions)
      ? d.redactions
      : Array.isArray(d.quotes)
        ? d.quotes
        : [];

  let excerpts: DossierExcerpt[] = rawExcerpts
    .map((item, idx) => {
      const o = asObj(item);
      return {
        label: asStr(o.label, `ITEM 0${idx + 1}`),
        prefix: asStr(o.prefix, ''),
        redacted: asStr(o.redacted ?? o.text ?? o.quote, ''),
        suffix: asStr(o.suffix, ''),
        note: asStr(o.note ?? o.source ?? o.annotation, 'Public court filing excerpt'),
      };
    })
    .filter((e) => e.redacted.length > 0);

  if (excerpts.length === 0) {
    excerpts = [
      {
        label: 'FILING § 14(a)',
        prefix: 'Respondent resolved the enforcement action ',
        redacted: 'without admitting or denying the findings in the Order',
        suffix: '.',
        note: 'Standard civil settlement clause in regulatory consent orders.',
      },
      {
        label: 'EXHIBIT B',
        prefix: 'Internal records reflected ',
        redacted: 'repeated compliance alerts deferred for twelve months',
        suffix: ' prior to disclosure.',
        note: 'Cited in primary enforcement docket.',
      },
      {
        label: 'SCHEDULE C',
        prefix: 'Total executive criminal indictments filed: ',
        redacted: 'ZERO INDIVIDUALS CHARGED',
        suffix: '.',
        note: 'Corporate penalty paid solely from shareholder treasury.',
      },
    ];
  }

  return {
    exhibitLabel: asStr(d.exhibitLabel ?? d.exhibit_label, 'EXHIBIT A // PUBLIC DOCKET'),
    docketNumber: asStr(d.docketNumber ?? d.docket_number, 'DOCKET NO. 26-CV-0419'),
    subject: asStr(d.subject ?? d.title, 'Sealed Filing Excerpts'),
    subtitle: asStr(d.subtitle, 'Hover or click ink redaction bars to declassify public record'),
    icon,
    stamp: asStr(d.stamp, 'UNSEALED'),
    excerpts: excerpts.slice(0, 5),
  };
}

// 4. PUMP-DUMP TICKER
export interface NormalizedTicker {
  title: string;
  ticker: string;
  currency: string;
  unit: string;
  drawdownLabel: string;
  points: TickerPoint[];
  events: TickerEvent[];
  peakIndex: number;
  troughIndex: number;
}

export function normalizePumpDumpTicker(spec: InteractiveArtSpec): NormalizedTicker {
  const d = asObj(spec.data);
  const rawPoints = Array.isArray(d.points) ? d.points : Array.isArray(d.series) ? d.series : [];
  let points: TickerPoint[] = rawPoints
    .map((item, idx) => {
      if (typeof item === 'number') return { label: `T+${idx}`, value: item };
      const o = asObj(item);
      return {
        label: asStr(o.label ?? o.time ?? o.date, `T+${idx}`),
        value: asNum(o.value ?? o.price ?? o.y, 100),
        volume: typeof o.volume === 'number' ? o.volume : undefined,
      };
    })
    .filter((p) => Number.isFinite(p.value));

  if (points.length < 4) {
    points = [
      { label: '09:15', value: 100 },
      { label: '09:45', value: 104 },
      { label: '10:30', value: 112 },
      { label: '11:15', value: 126 },
      { label: '12:00', value: 138 },
      { label: '12:45', value: 145 },
      { label: '13:30', value: 141 },
      { label: '14:15', value: 118 },
      { label: '14:45', value: 94 },
      { label: '15:15', value: 82 },
      { label: '15:30', value: 78 },
    ];
  }

  let autoPeak = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].value > points[autoPeak].value) autoPeak = i;
  }
  let autoTrough = autoPeak;
  for (let i = autoPeak; i < points.length; i++) {
    if (points[i].value < points[autoTrough].value) autoTrough = i;
  }

  const peakIndex = Math.max(0, Math.min(points.length - 1, Math.round(asNum(d.peakIndex, autoPeak))));
  const troughIndex = Math.max(peakIndex, Math.min(points.length - 1, Math.round(asNum(d.troughIndex, autoTrough))));

  const rawEvents = Array.isArray(d.events) ? d.events : Array.isArray(d.annotations) ? d.annotations : [];
  let events: TickerEvent[] = rawEvents.map((item) => {
    const o = asObj(item);
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(asNum(o.index, peakIndex))));
    return {
      index: idx,
      label: asStr(o.label ?? o.title, 'Key Filing Date'),
      detail: asStr(o.detail ?? o.note, ''),
      kind: (asStr(o.kind, 'sell') as TickerEvent['kind']) || 'sell',
    };
  });

  if (events.length === 0) {
    events = [
      { index: Math.max(1, Math.floor(peakIndex * 0.5)), label: 'Aggressive Buying', detail: 'Accumulation phase noted in regulatory order.', kind: 'pump' },
      { index: peakIndex, label: 'Peak / Insider Exit', detail: 'Positions unwound prior to public disclosure.', kind: 'sell' },
      { index: troughIndex, label: 'Drawdown Floor', detail: 'Retail counterparties absorb sharp repricing.', kind: 'enforcement' },
    ];
  }

  const peakVal = points[peakIndex]?.value || 1;
  const troughVal = points[troughIndex]?.value || peakVal;
  const dropPct = peakVal > 0 ? ((troughVal - peakVal) / peakVal) * 100 : 0;

  return {
    title: asStr(d.title, 'Intraday Price & Unwind Profile'),
    ticker: asStr(d.ticker ?? d.symbol, 'INDEX'),
    currency: asStr(d.currency, '$'),
    unit: asStr(d.unit, ''),
    drawdownLabel: asStr(d.drawdownLabel, `${dropPct.toFixed(1)}% DRAWDOWN`),
    points,
    events,
    peakIndex,
    troughIndex,
  };
}

// 5. PONZI PYRAMID
export interface NormalizedPonzi {
  title: string;
  promisedReturn: string;
  totalRaised: string;
  collapseStamp: string;
  tiers: PonziTier[];
}

export function normalizePonziPyramid(spec: InteractiveArtSpec): NormalizedPonzi {
  const d = asObj(spec.data);
  const rawTiers = Array.isArray(d.tiers) ? d.tiers : Array.isArray(d.levels) ? d.levels : [];
  let tiers: PonziTier[] = rawTiers.map((item, idx) => {
    const o = asObj(item);
    return {
      label: asStr(o.label ?? o.name, `Tier ${idx + 1}`),
      count: asStr(o.count ?? o.investors, ''),
      inflow: asStr(o.inflow, '$0'),
      payout: asStr(o.payout, '$0'),
      note: asStr(o.note ?? o.detail, ''),
    };
  });

  if (tiers.length < 3) {
    tiers = [
      { label: 'Founders & Promoters', count: '2 Principals', inflow: '$0', payout: '$48M Fees', note: 'Luxury disbursements & management draws' },
      { label: 'Early Seed Insiders', count: '45 Accounts', inflow: '$22M', payout: '$64M Paid', note: 'Paid from subsequent investor deposits' },
      { label: 'Mid-Stage Retail', count: '480 Accounts', inflow: '$148M', payout: '$31M Paper', note: 'Statements showed fabricated 6%/mo gains' },
      { label: 'Late-Stage Deposits', count: '1,600+ Accounts', inflow: '$430M', payout: '$0 Returned', note: 'Redemption requests frozen upon liquidity crunch' },
    ];
  }

  return {
    title: asStr(d.title, 'Anatomy of a Liquidity Collapse'),
    promisedReturn: asStr(d.promisedReturn ?? d.promised_return, '6%+ MONTHLY PROMISED'),
    totalRaised: asStr(d.totalRaised ?? d.total_raised, '$600M RAISED'),
    collapseStamp: asStr(d.collapseStamp ?? d.stamp, 'WITHDRAWALS PAUSED'),
    tiers: tiers.slice(0, 5),
  };
}

// 6. OFFSHORE FLIGHT MAP
export interface NormalizedFlightMap {
  title: string;
  subtitle: string;
  region: 'world' | 'europe' | 'americas' | 'asia' | 'transatlantic';
  waypoints: MapWaypoint[];
  routes: MapRoute[];
}

export function normalizeFlightMap(spec: InteractiveArtSpec): NormalizedFlightMap {
  const d = asObj(spec.data);
  const rawWps = Array.isArray(d.waypoints) ? d.waypoints : Array.isArray(d.cities) ? d.cities : [];
  const rawRoutes = Array.isArray(d.routes) ? d.routes : Array.isArray(d.arcs) ? d.arcs : [];

  let waypoints: MapWaypoint[] = rawWps
    .map((item, idx) => {
      const o = asObj(item);
      return {
        id: asStr(o.id, `wp${idx + 1}`),
        label: asStr(o.label ?? o.name ?? o.city, `Jurisdiction ${idx + 1}`),
        lat: asNum(o.lat, 40),
        lon: asNum(o.lon ?? o.lng, -10),
        role: asStr(o.role, 'Jurisdiction'),
        amount: asStr(o.amount, ''),
        status: asStr(o.status ?? o.note, 'Under active inquiry'),
      };
    })
    .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lon));

  let routes: MapRoute[] = rawRoutes
    .map((item) => {
      const o = asObj(item);
      return {
        from: asStr(o.from ?? o.source),
        to: asStr(o.to ?? o.target),
        amount: asStr(o.amount, ''),
        label: asStr(o.label, ''),
        loop: Boolean(o.loop),
      };
    })
    .filter((r) => r.from && r.to);

  if (waypoints.length < 2) {
    waypoints = [
      { id: 'lon', label: 'London', lat: 51.5, lon: -0.1, role: 'Origin Desk', amount: '€110M', status: 'Freezing Order' },
      { id: 'fra', label: 'Frankfurt', lat: 50.1, lon: 8.7, role: 'Clearing Hub', amount: '€145M', status: 'Raids Executed' },
      { id: 'mil', label: 'Milan', lat: 45.5, lon: 9.2, role: 'VAT Conduit', amount: '€98M', status: 'Detentions Active' },
      { id: 'lis', label: 'Lisbon', lat: 38.7, lon: -9.1, role: 'Buffer Shell', amount: '€57M', status: 'Assets Seized' },
    ];
    routes = [
      { from: 'lis', to: 'lon', amount: '€57M', label: 'Invoice Hop 1' },
      { from: 'lon', to: 'fra', amount: '€110M', label: 'Invoice Hop 2' },
      { from: 'fra', to: 'mil', amount: '€145M', label: 'VAT Refund Claim' },
      { from: 'mil', to: 'lis', amount: '€98M', label: 'Carousel Loop', loop: true },
    ];
  }

  const wpIds = new Set(waypoints.map((w) => w.id));
  routes = routes.filter((r) => wpIds.has(r.from) && wpIds.has(r.to));
  if (routes.length === 0 && waypoints.length >= 2) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      routes.push({ from: waypoints[i].id, to: waypoints[i + 1].id, amount: waypoints[i + 1].amount });
    }
  }

  const reg = asStr(d.region, 'world');
  const region: NormalizedFlightMap['region'] =
    reg === 'europe' || reg === 'americas' || reg === 'asia' || reg === 'transatlantic' ? reg : 'world';

  return {
    title: asStr(d.title, 'Cross-Border Enforcement & Transfer Map'),
    subtitle: asStr(d.subtitle, 'Click waypoints to inspect freezing orders & indictment status'),
    region,
    waypoints,
    routes,
  };
}

// 7. EDITORIAL VIGNETTE
export interface NormalizedVignette {
  title: string;
  subtitle: string;
  scene: VignetteScene;
  xrayLabel: string;
  hotspots: VignetteHotspot[];
}

const VALID_SCENES: VignetteScene[] = [
  'marina_yacht',
  'boardroom_shredder',
  'server_vault',
  'courthouse',
  'trading_desk',
  'matryoshka',
];

const DEFAULT_HOTSPOT_COORDS: Record<VignetteScene, Array<[number, number]>> = {
  marina_yacht: [[35, 58], [62, 46], [76, 68], [22, 72]],
  boardroom_shredder: [[30, 56], [56, 48], [74, 62], [44, 72]],
  server_vault: [[32, 48], [55, 52], [72, 62], [40, 72]],
  courthouse: [[50, 36], [30, 62], [70, 62], [50, 76]],
  trading_desk: [[32, 46], [56, 44], [74, 58], [46, 70]],
  matryoshka: [[22, 58], [39, 55], [56, 54], [74, 56]],
};

export function normalizeEditorialVignette(spec: InteractiveArtSpec): NormalizedVignette {
  const d = asObj(spec.data);
  const rawScene = asStr(d.scene, 'courthouse') as VignetteScene;
  const scene: VignetteScene = VALID_SCENES.includes(rawScene) ? rawScene : 'courthouse';
  const coords = DEFAULT_HOTSPOT_COORDS[scene];

  const rawHotspots = Array.isArray(d.hotspots) ? d.hotspots : Array.isArray(d.callouts) ? d.callouts : [];
  let hotspots: VignetteHotspot[] = rawHotspots.map((item, idx) => {
    const o = asObj(item);
    const fallbackCoord = coords[idx % coords.length];
    return {
      id: asStr(o.id, `h${idx + 1}`),
      x: typeof o.x === 'number' ? o.x : fallbackCoord[0],
      y: typeof o.y === 'number' ? o.y : fallbackCoord[1],
      title: asStr(o.title ?? o.label, `Exhibit Point ${idx + 1}`),
      figure: asStr(o.figure ?? o.amount, ''),
      note: asStr(o.note ?? o.detail, 'Referenced in primary court filings.'),
    };
  });

  if (hotspots.length === 0) {
    hotspots = [
      { id: 'h1', x: coords[0][0], y: coords[0][1], title: 'Primary Filing Asset', figure: '$42M', note: 'Identified in federal forfeiture schedule.' },
      { id: 'h2', x: coords[1][0], y: coords[1][1], title: 'Operational Facade', figure: '0% Automated', note: 'Internal records contradicted investor decks.' },
      { id: 'h3', x: coords[2][0], y: coords[2][1], title: 'Regulatory Intervention', figure: 'Sealed Docket', note: 'Court-ordered asset restraint & monitoring.' },
    ];
  }

  return {
    title: asStr(d.title, 'Forensic Scene Plate'),
    subtitle: asStr(d.subtitle, 'Select numbered pins to inspect primary-source filing annotations'),
    scene,
    xrayLabel: asStr(d.xrayLabel, scene === 'server_vault' ? 'Toggle X-Ray Inspection' : 'Cycle Exhibit Pins'),
    hotspots: hotspots.slice(0, 5),
  };
}

// 8. PENALTY WHEEL
export interface NormalizedPenaltyWheel {
  title: string;
  subtitle: string;
  score: number;
  verdict: string;
  fineDisplay: string;
  lootDisplay: string;
  comparisons: PenaltyComparison[];
}

export function normalizePenaltyWheel(spec: InteractiveArtSpec): NormalizedPenaltyWheel {
  const d = asObj(spec.data);
  const score = Math.max(0, Math.min(100, Math.round(asNum(d.score ?? d.slap_on_wrist_score, 84))));
  const autoVerdict =
    score >= 67 ? 'ROUNDING ERROR' : score >= 34 ? 'COST OF DOING BUSINESS' : 'ACTUAL DETERRENT';

  const rawComps = Array.isArray(d.comparisons) ? d.comparisons : Array.isArray(d.modes) ? d.modes : [];
  let comparisons: PenaltyComparison[] = rawComps.map((item, idx) => {
    const o = asObj(item);
    return {
      id: asStr(o.id, `m${idx + 1}`),
      label: asStr(o.label, `View ${idx + 1}`),
      value: asStr(o.value, `${score}/100`),
      detail: asStr(o.detail ?? o.note, ''),
      score: typeof o.score === 'number' ? Math.max(0, Math.min(100, o.score)) : undefined,
    };
  });

  if (comparisons.length === 0) {
    comparisons = [
      { id: 'pct', label: '% of Volume', value: asStr(d.fineDisplay, '$1.21B'), detail: 'Fine assessed relative to total flagged exposure.', score },
      { id: 'days', label: 'Days of Profit', value: '14 Days', detail: 'Equivalent share of annual corporate net income.', score: Math.min(100, score + 6) },
      { id: 'bundle', label: 'Bundle Credit', value: '$750M Off', detail: 'Inter-agency credit reducing stacked statutory penalties.', score: Math.max(10, score - 14) },
    ];
  }

  return {
    title: asStr(d.title, 'Slap-on-the-Wrist Pressure Gauge'),
    subtitle: asStr(d.subtitle, 'Deterministic deterrence index from primary settlement terms'),
    score,
    verdict: asStr(d.verdict, autoVerdict),
    fineDisplay: asStr(d.fineDisplay, '$1.21B'),
    lootDisplay: asStr(d.lootDisplay, '$5.0B+'),
    comparisons: comparisons.slice(0, 3),
  };
}

export function formatShortUsd(val: number): string {
  if (!Number.isFinite(val)) return '$0';
  const abs = Math.abs(val);
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

/**
 * Generates an accessible semantic table representation for any archetype spec.
 */
export function extractAccessibleTable(spec: InteractiveArtSpec): AccessibleTableData {
  const arch = resolveArchetype(spec.archetype);
  const caption = spec.caption || 'Editorial illustration underlying data';

  switch (arch) {
    case 'shell-network': {
      const n = normalizeShellNetwork(spec);
      return {
        caption,
        headers: ['Entity', 'Role', 'Jurisdiction', 'Amount', 'Filing Note'],
        rows: n.nodes.map((node) => [
          node.label,
          node.role || node.kind || 'Entity',
          node.jurisdiction || '—',
          node.amount || '—',
          node.note || '—',
        ]),
      };
    }
    case 'scale-of-impunity': {
      const s = normalizeScaleOfImpunity(spec);
      return {
        caption,
        headers: ['Metric', 'Value', 'Comparison Context'],
        rows: [
          [s.lootLabel, s.lootDisplay, 'Primary filing figure'],
          [s.fineLabel, s.fineDisplay, s.ratioDisplay],
          ['Executive Accountability', s.execSentenceDisplay, s.stampText],
          [s.streetLabel, s.streetAmountDisplay, s.streetSentenceDisplay],
        ],
      };
    }
    case 'redacted-dossier': {
      const r = normalizeRedactedDossier(spec);
      return {
        caption,
        headers: ['Reference', 'Public Filing Excerpt', 'Annotation'],
        rows: r.excerpts.map((e) => [
          e.label || r.exhibitLabel,
          `${e.prefix || ''}${e.redacted}${e.suffix || ''}`.trim(),
          e.note || '—',
        ]),
      };
    }
    case 'pump-dump-ticker': {
      const t = normalizePumpDumpTicker(spec);
      return {
        caption,
        headers: ['Time / Date', `${t.ticker} Level`, 'Event'],
        rows: t.points.map((pt, idx) => {
          const ev = t.events.find((e) => e.index === idx);
          return [
            pt.label,
            `${t.currency}${pt.value.toLocaleString()}${t.unit}`,
            ev ? `${ev.label}${ev.detail ? ` — ${ev.detail}` : ''}` : '—',
          ];
        }),
      };
    }
    case 'ponzi-pyramid': {
      const p = normalizePonziPyramid(spec);
      return {
        caption,
        headers: ['Tier', 'Participants', 'Inflow', 'Payout', 'Note'],
        rows: p.tiers.map((t) => [t.label, t.count || '—', t.inflow, t.payout, t.note || '—']),
      };
    }
    case 'offshore-flight-map': {
      const m = normalizeFlightMap(spec);
      return {
        caption,
        headers: ['Jurisdiction', 'Role', 'Amount', 'Enforcement Status'],
        rows: m.waypoints.map((w) => [w.label, w.role || '—', w.amount || '—', w.status || '—']),
      };
    }
    case 'editorial-vignette': {
      const v = normalizeEditorialVignette(spec);
      return {
        caption,
        headers: ['Pin', 'Feature', 'Figure', 'Filing Annotation'],
        rows: v.hotspots.map((h, i) => [`#${i + 1}`, h.title, h.figure || '—', h.note]),
      };
    }
    case 'penalty-wheel': {
      const w = normalizePenaltyWheel(spec);
      return {
        caption,
        headers: ['Measure', 'Reading', 'Context'],
        rows: [
          ['Slap-on-the-Wrist Index', `${w.score} / 100`, w.verdict],
          ['Penalty vs. Exposure', `${w.fineDisplay} vs. ${w.lootDisplay}`, w.subtitle],
          ...w.comparisons.map((c) => [c.label, c.value, c.detail]),
        ],
      };
    }
  }
}
