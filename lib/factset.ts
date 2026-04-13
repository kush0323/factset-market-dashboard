export type AlertType = 'macro' | 'sector' | 'target' | 'general';

export type FactSetAlert = {
  id: string;
  receivedAt: string;
  subject: string;
  source: string;
  type: AlertType;
  summary: string;
  impact: string;
  tickers: string[];
  sectors: string[];
  marketBias: 'risk-on' | 'risk-off' | 'mixed';
  confidence: number;
  raw?: string;
};

const seed: FactSetAlert[] = [
  {
    id: 'seed-hormuz-blockade',
    receivedAt: '2026-04-12T22:51:39Z',
    subject: 'Trump announces US naval blockade of Strait of Hormuz after negotiations fail',
    source: 'FactSet Alerts',
    type: 'macro',
    summary: 'US announced a naval blockade of the Strait of Hormuz after Iran talks failed, driving a sharp energy-risk shock.',
    impact: 'Bullish for energy, shipping disruption, and inflation hedges; bearish for transports, industrials, consumer discretionary, and rate-sensitive risk assets.',
    tickers: ['WTI', 'XLE', 'USO', 'XOP'],
    sectors: ['Energy', 'Industrials', 'Consumer Discretionary', 'Rates'],
    marketBias: 'risk-off',
    confidence: 0.98,
  },
  {
    id: 'seed-sector-scorecard',
    receivedAt: '2026-04-13T14:13:16Z',
    subject: 'StreetAccount Scorecard: Weekly performance of the S&P 500 sectors (ending 10-Apr)',
    source: 'FactSet Alerts',
    type: 'sector',
    summary: 'Weekly sector tape was led by consumer discretionary, communications services, technology, and industrials while energy lagged.',
    impact: 'Momentum remained broad, but energy underperformed on ceasefire optimism; semis, media, and retail led the rebound.',
    tickers: ['XLY', 'XLC', 'XLK', 'XLI', 'XLE', 'XLRE'],
    sectors: ['Consumer Discretionary', 'Communications Services', 'Information Technology', 'Industrials', 'Energy', 'Real Estate'],
    marketBias: 'mixed',
    confidence: 0.96,
  },
  {
    id: 'seed-real-estate-pre-market',
    receivedAt: '2026-04-13T13:10:47Z',
    subject: 'StreetAccount Sector Summary - Real Estate Pre Market',
    source: 'FactSet Alerts',
    type: 'sector',
    summary: 'Real estate underperformed last week; data centers and towers were resilient while residential and multi-family were weaker.',
    impact: 'Favors data center, tower, and specialty REIT exposure over residential and housing-sensitive names.',
    tickers: ['REXR', 'SBAC', 'COST', 'CSGP', 'SPG', 'WSR'],
    sectors: ['Real Estate', 'Data Centers', 'Towers', 'Residential', 'Retail'],
    marketBias: 'mixed',
    confidence: 0.92,
  },
  {
    id: 'seed-targets',
    receivedAt: '2026-04-13T13:10:47Z',
    subject: 'Analyst calls: upgrades, initiations, and target changes',
    source: 'FactSet Alerts',
    type: 'target',
    summary: 'Evercore upgraded REXR to outperform with target raised to 40; Cantor initiated JAN overweight target 27 and SNDA overweight target 36; B. Riley downgraded WSR to neutral with target raised to 19.',
    impact: 'Positive revision skew for self-storage, office/data-center adjacent, and specialty REITs; negative relative signal for WSR.',
    tickers: ['REXR', 'JAN', 'SNDA', 'WSR'],
    sectors: ['Real Estate'],
    marketBias: 'risk-on',
    confidence: 0.95,
  },
  {
    id: 'seed-top-midday',
    receivedAt: '2026-04-13T15:40:48Z',
    subject: 'Top Midday Stories: Goldman Shares Fall Despite Q1 Earnings Topping Estimates; Revolution\'s Pancreatic Cancer Drug Met Key Study Goals',
    source: 'FactSet Alerts',
    type: 'general',
    summary: 'Goldman beat estimates but sold off; Revolution Medicines surged on positive trial data; the tape remained focused on the Hormuz shock.',
    impact: 'Supports biotech winners, keeps financials volatile, and reinforces macro-driven intraday rotation.',
    tickers: ['GS', 'RVMD', 'GFL', 'FAST', 'MSFT'],
    sectors: ['Financials', 'Biotech', 'Industrials', 'Technology'],
    marketBias: 'mixed',
    confidence: 0.88,
  },
];

const globalForFactSet = globalThis as typeof globalThis & {
  __factsetAlerts?: FactSetAlert[];
};

if (!globalForFactSet.__factsetAlerts) {
  globalForFactSet.__factsetAlerts = [...seed].sort(
    (a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt)
  );
}

export function getAlerts() {
  return globalForFactSet.__factsetAlerts ?? [];
}

export function addAlert(alert: FactSetAlert) {
  const list = getAlerts();
  const next = [alert, ...list.filter((item) => item.id !== alert.id)]
    .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
  globalForFactSet.__factsetAlerts = next;
  return alert;
}

export function parseFactSetEmail(input: { subject?: string; raw?: string; from?: string; date?: string }): FactSetAlert {
  const subject = input.subject || 'FactSet Alert';
  const raw = input.raw || '';
  const text = `${subject}\n${raw}`;
  const lower = text.toLowerCase();
  const id = `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const receivedAt = input.date ? new Date(input.date).toISOString() : new Date().toISOString();
  const source = input.from || 'FactSet Alerts';

  const tickers = Array.from(new Set((text.match(/\b[A-Z]{1,5}(?:\.[A-Z])?-US\b/g) || []).map((s) => s.replace(/-US$/, ''))));
  const sectors = Array.from(new Set([
    lower.includes('real estate') ? 'Real Estate' : null,
    lower.includes('energy') ? 'Energy' : null,
    lower.includes('technology') || lower.includes('software') || lower.includes('ai') ? 'Technology' : null,
    lower.includes('financial') ? 'Financials' : null,
    lower.includes('health') ? 'Healthcare' : null,
    lower.includes('industrial') ? 'Industrials' : null,
  ].filter(Boolean) as string[]));

  let type: FactSetAlert['type'] = 'general';
  let impact = 'Monitor for cross-asset spillovers and relative strength/weakness.';
  let marketBias: FactSetAlert['marketBias'] = 'mixed';

  if (lower.includes('hormuz') || lower.includes('iran') || lower.includes('blockade')) {
    type = 'macro';
    impact = 'Macro shock: energy up, transport and consumer risk down, inflation hedges bid.';
    marketBias = 'risk-off';
  } else if (lower.includes('sector summary') || lower.includes('scorecard') || lower.includes('weekly performance')) {
    type = 'sector';
    impact = 'Sector rotation and relative strength snapshot.';
    marketBias = lower.includes('underperformed') ? 'mixed' : 'risk-on';
  } else if (lower.includes('target') || lower.includes('upgrade') || lower.includes('downgrade') || lower.includes('initiated')) {
    type = 'target';
    impact = 'Analyst revision / target change alert.';
    marketBias = lower.includes('downgrade') ? 'risk-off' : 'risk-on';
  }

  return {
    id,
    receivedAt,
    subject,
    source,
    type,
    summary: subject,
    impact,
    tickers,
    sectors,
    marketBias,
    confidence: type === 'macro' ? 0.97 : type === 'sector' ? 0.92 : 0.88,
    raw,
  };
}
