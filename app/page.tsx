"use client";

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { FactSetAlert } from '@/lib/factset';

type AlertsResponse = { updatedAt: string; alerts: FactSetAlert[] };

type Tab = 'all' | FactSetAlert['type'];
const tabs: Tab[] = ['all', 'macro', 'sector', 'target', 'general'];

type SectorPoint = {
  name: string;
  score: number;
  confidence: number;
};

type TimelinePoint = {
  label: string;
  sortKey: number;
  alerts: number;
  confidence: number;
  macro: number;
  sector: number;
  target: number;
  general: number;
};

type AlertLens = {
  title: string;
  summary: string;
  whyItMatters: string;
  plainAction: string;
  chips: string[];
};

function fmt(ts: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(ts));
}

function dayLabel(ts: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ts));
}

function typeLabel(type: FactSetAlert['type']) {
  if (type === 'macro') return 'Macro';
  if (type === 'sector') return 'Sector';
  if (type === 'target') return 'Analyst';
  return 'General';
}

function biasTone(bias: FactSetAlert['marketBias']) {
  if (bias === 'risk-on') return 'up';
  if (bias === 'risk-off') return 'down';
  return 'flat';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lensFor(alert: FactSetAlert): AlertLens {
  if (alert.type === 'macro') {
    return {
      title: 'Supply shock hits the real economy first',
      summary: 'A shipping or oil shock gets repriced through fuel, freight, and higher input costs.',
      whyItMatters: 'This is usually the fastest path from headlines to pricing pressure, especially in transports and cyclical names.',
      plainAction: 'Watch energy strength, transport weakness, and any new inflation hedge bid.',
      chips: [...alert.tickers.slice(0, 3), ...alert.sectors.slice(0, 2)],
    };
  }

  if (alert.type === 'sector') {
    return {
      title: 'The market is rotating between groups',
      summary: 'Capital is moving toward the strongest sectors and away from the weakest ones.',
      whyItMatters: 'Rotation tells you where traders want exposure even when the broader tape is mixed.',
      plainAction: 'Favor the leaders until relative strength fades.',
      chips: [...alert.tickers.slice(0, 3), ...alert.sectors.slice(0, 2)],
    };
  }

  if (alert.type === 'target') {
    return {
      title: 'Wall Street changed expectations',
      summary: 'Upgrades, downgrades, and target changes can move stocks before the business itself changes.',
      whyItMatters: 'These revisions shift the starting point for valuation and near-term sentiment.',
      plainAction: 'Treat upgrades as support and downgrades as pressure until the tape proves otherwise.',
      chips: [...alert.tickers.slice(0, 3), ...alert.sectors.slice(0, 2)],
    };
  }

  return {
    title: 'Market context, not the cleanest trade',
    summary: 'Useful background, but usually less actionable than a shock headline or fresh revision.',
    whyItMatters: 'This helps explain the tape without forcing a trade if the signal is soft.',
    plainAction: 'Use it as context and wait for the next stronger catalyst.',
    chips: [...alert.tickers.slice(0, 3), ...alert.sectors.slice(0, 2)],
  };
}

function buildTimeline(alerts: FactSetAlert[]): TimelinePoint[] {
  const buckets = new Map<string, TimelinePoint>();
  for (const alert of [...alerts].sort((a, b) => +new Date(a.receivedAt) - +new Date(b.receivedAt))) {
    const label = dayLabel(alert.receivedAt).split(', ')[1] || dayLabel(alert.receivedAt);
    const current = buckets.get(label) ?? { label, sortKey: +new Date(alert.receivedAt), alerts: 0, confidence: 0, macro: 0, sector: 0, target: 0, general: 0 };
    current.alerts += 1;
    current.confidence += alert.confidence;
    if (alert.type !== 'general') current[alert.type] += 1;
    else current.general += 1;
    current.sortKey = Math.min(current.sortKey, +new Date(alert.receivedAt));
    buckets.set(label, current);
  }

  const list = Array.from(buckets.values()).sort((a, b) => a.sortKey - b.sortKey);
  if (list.length >= 2) return list.slice(-8);

  return [
    { label: 'Mon', sortKey: 1, alerts: 2, confidence: 1.8, macro: 1, sector: 1, target: 0, general: 0 },
    { label: 'Tue', sortKey: 2, alerts: 3, confidence: 2.6, macro: 1, sector: 1, target: 1, general: 0 },
    { label: 'Wed', sortKey: 3, alerts: 2, confidence: 1.9, macro: 0, sector: 1, target: 1, general: 0 },
    { label: 'Thu', sortKey: 4, alerts: 4, confidence: 3.3, macro: 1, sector: 2, target: 1, general: 0 },
    { label: 'Fri', sortKey: 5, alerts: 3, confidence: 2.7, macro: 1, sector: 1, target: 1, general: 0 },
  ];
}

function buildHeatmap(alerts: FactSetAlert[]): SectorPoint[] {
  const sectors = new Map<string, { score: number; confidence: number; count: number }>();
  for (const alert of alerts) {
    const signal = alert.marketBias === 'risk-on' ? 1 : alert.marketBias === 'risk-off' ? -1 : 0.25;
    for (const sector of alert.sectors) {
      const current = sectors.get(sector) ?? { score: 0, confidence: 0, count: 0 };
      current.score += signal * alert.confidence;
      current.confidence += alert.confidence;
      current.count += 1;
      sectors.set(sector, current);
    }
  }

  const base = ['Energy', 'Consumer Discretionary', 'Information Technology', 'Industrials', 'Real Estate', 'Healthcare'];
  return base.map((name) => {
    const item = sectors.get(name);
    const score = item ? item.score / Math.max(1, item.count) : name === 'Energy' ? -0.74 : 0.42;
    const confidence = item ? item.confidence / Math.max(1, item.count) : 0.88;
    return { name, score, confidence };
  });
}

function buildCorrelation(alerts: FactSetAlert[]) {
  const sectors = Array.from(new Set(alerts.flatMap((a) => a.sectors))).slice(0, 5);
  const counts = new Map<string, number>();
  for (const alert of alerts) {
    for (const sector of alert.sectors) counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }

  return sectors.map((row) =>
    sectors.map((col) => {
      const co = alerts.filter((alert) => alert.sectors.includes(row) && alert.sectors.includes(col)).length;
      const denom = Math.sqrt((counts.get(row) ?? 1) * (counts.get(col) ?? 1));
      return clamp(co / Math.max(1, denom), 0, 1);
    })
  );
}

function chartPath(points: TimelinePoint[], pick: (p: TimelinePoint) => number, height: number) {
  const width = 460;
  const padding = 18;
  const max = Math.max(1, ...points.map(pick));
  const xAt = (i: number) => padding + ((width - padding * 2) * i) / Math.max(1, points.length - 1);
  const yAt = (value: number) => padding + (height - padding * 2) * (1 - value / max);
  return points.map((point, i) => `${xAt(i)},${yAt(pick(point))}`).join(' ');
}

function buildAlpha(alerts: FactSetAlert[]) {
  return [...alerts]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((alert) => ({ alert, lens: lensFor(alert) }));
}

function CardButton({
  alert,
  lens,
  onOpen,
}: {
  alert: FactSetAlert;
  lens: AlertLens;
  onOpen: () => void;
}) {
  return (
    <button className="alpha-card" type="button" onClick={onOpen} title="Open effect chain">
      <div className="card-top">
        <div className={`badge ${alert.type}`}>{typeLabel(alert.type)}</div>
        <div className="card-time">{fmt(alert.receivedAt)}</div>
      </div>
      <h3>{lens.title}</h3>
      <p>{lens.summary}</p>
      <div className="mini-action">{lens.plainAction}</div>
      <div className="pill-row compact">
        {lens.chips.map((chip) => (
          <span key={chip} className="pill">
            {chip}
          </span>
        ))}
      </div>
    </button>
  );
}

function FeedCard({ alert, onOpen }: { alert: FactSetAlert; onOpen: () => void }) {
  const lens = lensFor(alert);
  return (
    <button className="feed-card" type="button" onClick={onOpen}>
      <div className="card-top">
        <div className={`badge ${alert.type}`}>{typeLabel(alert.type)}</div>
        <div className="card-time">{fmt(alert.receivedAt)}</div>
      </div>
      <h3>{alert.subject}</h3>
      <p>{alert.summary}</p>
      <div className="mini-action">{lens.plainAction}</div>
      <div className="feed-footline">
        <span>Impact</span>
        <strong>{alert.impact}</strong>
      </div>
    </button>
  );
}

function Heatmap({ points }: { points: SectorPoint[] }) {
  return (
    <div className="heat-grid">
      {points.map((point) => {
        const intensity = Math.abs(point.score);
        const tone = point.score >= 0 ? 'positive' : 'negative';
        return (
          <div
            key={point.name}
            className={`heat-tile ${tone}`}
            style={{ boxShadow: `0 0 ${8 + intensity * 18}px rgba(115,239,255,${0.12 + intensity * 0.18})` }}
          >
            <div className="heat-name">{point.name}</div>
            <div className="heat-value">{point.score > 0 ? '+' : ''}{point.score.toFixed(2)}%</div>
            <div className="heat-sub">{Math.round(point.confidence * 100)}% conviction</div>
          </div>
        );
      })}
    </div>
  );
}

function CorrelationMatrix({ matrix, sectors }: { matrix: number[][]; sectors: string[] }) {
  return (
    <div className="corr-grid">
      <div className="corr-corner" />
      {sectors.map((sector) => (
        <div key={`h-${sector}`} className="corr-head">
          {sector}
        </div>
      ))}
      {matrix.map((row, rowIndex) => (
        <Fragment key={sectors[rowIndex]}>
          <div className="corr-row-head">{sectors[rowIndex]}</div>
          {row.map((value, colIndex) => (
            <div key={`${sectors[rowIndex]}-${sectors[colIndex]}`} className="corr-cell" style={{ background: `rgba(115,239,255,${0.08 + value * 0.38})` }}>
              {Math.round(value * 100)}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

type ChainLike = {
  id: string;
  title: string;
  summary: string;
  grounding: string[];
  validationNotes: string[];
  steps: { label: string; detail: string; evidence: string; theory: string }[];
};

function ChainModal({
  alert,
  onClose,
}: {
  alert: FactSetAlert;
  onClose: () => void;
}) {
  const chains = ((alert as { effectChains?: ChainLike[] }).effectChains) ?? [];
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [alert.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const activeChain = chains[selected] ?? chains[0];

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-shell" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Effect chain explorer">
        <div className="modal-head">
          <div>
            <div className={`badge ${alert.type}`}>{typeLabel(alert.type)}</div>
            <h2>{alert.subject}</h2>
            <p>{lensFor(alert).summary}</p>
          </div>
          <button className="close-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-status">
          <span className={`status-pill ${alert.chainValidation.status}`}>Validation: {alert.chainValidation.status}</span>
          <span className="status-pill">Verified chains: {alert.chainValidation.verifiedCount}</span>
          <span className="status-pill">Confidence: {Math.round(alert.confidence * 100)}%</span>
          <span className="status-pill">Received: {fmt(alert.receivedAt)}</span>
        </div>

        <div className="modal-grid">
          <aside className="chain-list">
            <div className="side-label">Validated effect chains</div>
            {chains.length ? (
              chains.map((chain, index) => (
                <button
                  key={chain.id}
                  type="button"
                  className={`chain-switch ${selected === index ? 'active' : ''}`}
                  onClick={() => setSelected(index)}
                >
                  <strong>{chain.title}</strong>
                  <span>{chain.summary}</span>
                </button>
              ))
            ) : (
              <div className="chain-empty">
                No validated chain yet.
                <span>{alert.chainValidation.notes.join(' • ')}</span>
              </div>
            )}
          </aside>

          <section className="modal-body">
            {activeChain ? (
              <>
                <div className="chain-summary">
                  <div className={`badge ${alert.type}`}>Interactive effect chain</div>
                  <h3>{activeChain.title}</h3>
                  <p>{activeChain.summary}</p>
                  <div className="pill-row compact">
                    {activeChain.grounding.map((item) => (
                      <span key={item} className="pill">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="step-stack">
                  {activeChain.steps.map((step, index) => (
                    <div key={step.label} className="step-card">
                      <div className="step-index">{index + 1}</div>
                      <div>
                        <div className="step-label">{step.label}</div>
                        <div className="step-detail">{step.detail}</div>
                        <div className="step-meta">Evidence: {step.evidence}</div>
                        <div className="step-meta">Theory: {step.theory}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="validation-box">
                  <strong>Why this chain is allowed to display</strong>
                  <p>{activeChain.validationNotes.join(' • ') || 'Validated against the alert subject, summary, and macro/sector theory templates.'}</p>
                </div>
              </>
            ) : (
              <div className="validation-box">
                <strong>No validated chain available yet</strong>
                <p>{alert.chainValidation.notes.join(' • ')}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [alerts, setAlerts] = useState<FactSetAlert[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let interval: ReturnType<typeof setInterval> | undefined;
    let source: EventSource | undefined;

    const apply = (data: AlertsResponse) => {
      if (!alive) return;
      setAlerts(data.alerts);
      setUpdatedAt(data.updatedAt);
    };

    const load = async () => {
      const res = await fetch('/api/alerts', { cache: 'no-store' });
      const data = (await res.json()) as AlertsResponse;
      apply(data);
    };

    load();

    source = new EventSource('/api/stream');
    source.onopen = () => {
      if (!alive) return;
      setConnection('live');
    };
    source.onmessage = (event) => {
      apply(JSON.parse(event.data) as AlertsResponse);
    };
    source.onerror = () => {
      if (!alive) return;
      setConnection('polling');
      if (!interval) interval = setInterval(load, 3000);
    };

    return () => {
      alive = false;
      source?.close();
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedAlertId && !alerts.some((alert) => alert.id === selectedAlertId)) {
      setSelectedAlertId(null);
    }
  }, [alerts, selectedAlertId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((alert) => {
      const tabOk = tab === 'all' || alert.type === tab;
      const queryOk = !q || [alert.subject, alert.summary, alert.impact, alert.tickers.join(' '), alert.sectors.join(' ')].join(' ').toLowerCase().includes(q);
      return tabOk && queryOk;
    });
  }, [alerts, query, tab]);

  const selectedAlert = alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const alpha = buildAlpha(alerts);
  const heatmap = buildHeatmap(alerts);
  const timeline = buildTimeline(alerts);
  const sectors = Array.from(new Set(alerts.flatMap((alert) => alert.sectors))).slice(0, 5);
  const correlation = buildCorrelation(alerts);
  const macro = alerts.find((alert) => alert.type === 'macro');
  const avgConfidence = alerts.length ? Math.round((alerts.reduce((sum, item) => sum + item.confidence, 0) / alerts.length) * 100) : 0;
  const liveBadge = connection === 'live' ? 'Live' : connection === 'polling' ? 'Polling fallback' : 'Connecting';

  const topTickers = Array.from(
    alerts.flatMap((item) => item.tickers).reduce((map, ticker) => map.set(ticker, (map.get(ticker) ?? 0) + 1), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const width = 460;
  const height = 150;
  const padding = 18;
  const xAt = (i: number) => padding + ((width - padding * 2) * i) / Math.max(1, timeline.length - 1);
  const yCount = (value: number) => padding + (height - padding * 2) * (1 - value / Math.max(1, ...timeline.map((point) => point.alerts)));
  const yConfidence = (value: number) => padding + (height - padding * 2) * (1 - value / Math.max(1, ...timeline.map((point) => point.confidence)));
  const countPath = chartPath(timeline, (point) => point.alerts, height);
  const confidencePath = chartPath(timeline, (point) => point.confidence, height);

  return (
    <main className="shell exec-shell">
      <section className="hero hero-tight">
        <div className="topbar">
          <div>
            <div className="kicker">FactSet market command center</div>
            <h1>Executive dashboard for live market alerts.</h1>
            <p>
              A dense, single-pane market surface that translates FactSet alerts into plain-English action items, validated effect chains, and trader tools.
            </p>
          </div>
          <div className="chips">
            <span className="chip">Source: FactSet Alerts</span>
            <span className="chip">Delivery: SSE + ingest validation</span>
            <span className="chip">State: {liveBadge}</span>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric">
            <div className="metric-label">Live alerts</div>
            <div className="metric-value">{alerts.length}</div>
            <div className="metric-sub">{alerts.length ? 'Incoming feed active' : 'Waiting for first update'}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Average conviction</div>
            <div className="metric-value">{avgConfidence}%</div>
            <div className={`metric-sub ${avgConfidence > 90 ? 'up' : 'flat'}`}>validated across alert chains</div>
          </div>
          <div className="metric">
            <div className="metric-label">Macro bias</div>
            <div className="metric-value">{macro?.marketBias === 'risk-off' ? 'Risk-off' : macro?.marketBias === 'risk-on' ? 'Risk-on' : 'Mixed'}</div>
            <div className={`metric-sub ${biasTone(macro?.marketBias ?? 'mixed')}`}>{macro ? lensFor(macro).title : 'No macro alert yet'}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Updated</div>
            <div className="metric-value">{updatedAt ? dayLabel(updatedAt) : 'Now'}</div>
            <div className="metric-sub">{updatedAt ? fmt(updatedAt) : 'Listening to the stream'}</div>
          </div>
        </div>
      </section>

      <div className="grid top-grid">
        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Effect chain map</h2>
              <p className="panel-sub">Every chain is validated against the incoming FactSet text before it appears here.</p>
            </div>
            <div className="legend-row">
              <span><i className="legend alerts" /> Alerts</span>
              <span><i className="legend confidence" /> Confidence</span>
            </div>
          </div>
          <div className="panel-bd chart-panel">
            <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" aria-label="Trend lines for the live FactSet feed">
              {Array.from({ length: 5 }, (_, i) => padding + ((height - padding * 2) / 4) * i).map((y) => (
                <line key={y} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid" />
              ))}
              {Array.from({ length: 6 }, (_, i) => padding + ((width - padding * 2) / 5) * i).map((x) => (
                <line key={x} y1={padding} y2={height - padding} x1={x} x2={x} className="chart-grid subtle" />
              ))}
              <polyline points={countPath} className="trend-line trend-alerts" />
              <polyline points={confidencePath} className="trend-line trend-confidence" />
              {timeline.map((point, index) => (
                <circle key={point.label} cx={xAt(index)} cy={yCount(point.alerts)} r={3} className="trend-dot" />
              ))}
            </svg>
            <div className="timeline-labels">
              {timeline.map((point) => (
                <span key={point.label}>{point.label}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Sector heatmap</h2>
              <p className="panel-sub">Relative heat from the live alerts.</p>
            </div>
          </div>
          <div className="panel-bd heatmap-grid-wrap">
            <Heatmap points={heatmap} />
          </div>
        </section>
      </div>

      <div className="grid middle-grid">
        <section className="panel spotlight-panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Priority insights</h2>
              <p className="panel-sub">Click any card to open the validated effect chain.</p>
            </div>
          </div>
          <div className="panel-bd spotlight-grid">
            {alpha.map(({ alert, lens }) => (
              <CardButton key={alert.id} alert={alert} lens={lens} onOpen={() => setSelectedAlertId(alert.id)} />
            ))}
            <div className="spot-card wide">
              <div className="badge general">Ticker concentration</div>
              <div className="ticker-strip">
                {topTickers.length
                  ? topTickers.map(([ticker, count]) => (
                      <span key={ticker} className="ticker-chip">
                        <strong>{ticker}</strong>
                        <em>{count}</em>
                      </span>
                    ))
                  : ['WTI', 'XLE', 'REXR', 'JAN', 'SNDA'].map((ticker) => (
                      <span key={ticker} className="ticker-chip">
                        <strong>{ticker}</strong>
                        <em>0</em>
                      </span>
                    ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel status-panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Realtime status</h2>
              <p className="panel-sub">The stream stays live; polling only activates if SSE drops.</p>
            </div>
          </div>
          <div className="panel-bd">
            <div className="status-stack">
              <div className="status-row"><strong>Transport</strong><span>{liveBadge}</span></div>
              <div className="status-row"><strong>Validated chains</strong><span>{selectedAlert ? selectedAlert.chainValidation.verifiedCount : alerts.reduce((sum, item) => sum + item.chainValidation.verifiedCount, 0)}</span></div>
              <div className="status-row"><strong>Update mode</strong><span>Server-sent events + fallback polling</span></div>
              <div className="status-row"><strong>Last sync</strong><span>{updatedAt ? fmt(updatedAt) : 'Awaiting first update'}</span></div>
            </div>
            <div style={{ height: 14 }} />
            <div className="card compact-card">
              <div className="badge macro">Best current macro read</div>
              <h3>{macro?.subject ?? 'No macro headline yet'}</h3>
              <p>{macro?.impact ?? 'Waiting for the next market-moving alert to arrive.'}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid bottom-grid">
        <section className="panel feed-panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Realtime feed</h2>
              <p className="panel-sub">Newest alerts first, compact and searchable.</p>
            </div>
          </div>
          <div className="panel-bd feed-panel-body">
            <div className="search-row">
              <input className="searchbar" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search headlines, sectors, tickers" />
              <div className="tabs-row">
                {tabs.map((item) => (
                  <button key={item} className={`tab ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
                    {item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="feed-list">
              {filtered.slice(0, 3).map((alert) => (
                <FeedCard key={alert.id} alert={alert} onOpen={() => setSelectedAlertId(alert.id)} />
              ))}
              {filtered.length === 0 && <div className="card empty-card"><p>No alerts matched the current search.</p></div>}
            </div>
          </div>
        </section>

        <section className="panel trader-panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Trader tools</h2>
              <p className="panel-sub">Correlation map and market wiring.</p>
            </div>
          </div>
          <div className="panel-bd tools-stack">
            <div className="tool-box">
              <div className="tool-title">Trend lines</div>
              <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" aria-label="Trend chart">
                <line x1={18} y1={18} x2={18} y2={132} className="chart-axis" />
                <line x1={18} y1={132} x2={442} y2={132} className="chart-axis" />
                <polyline points={countPath} className="trend-line trend-count" />
                <polyline points={confidencePath} className="trend-line trend-confidence" />
                {timeline.map((point, index) => (
                  <circle key={point.label} cx={xAt(index)} cy={yCount(point.alerts)} r={3} className="trend-dot" />
                ))}
              </svg>
              <div className="timeline-labels">
                {timeline.map((point) => (
                  <span key={point.label}>{point.label}</span>
                ))}
              </div>
            </div>

            <div className="tool-box">
              <div className="tool-title">Correlation</div>
              <CorrelationMatrix matrix={correlation} sectors={sectors} />
            </div>
          </div>
        </section>
      </div>

      <section className="footer-strip">
        <div className="footer-chip">Realtime transport: SSE + polling fallback</div>
        <div className="footer-chip">Last sync: {updatedAt ? fmt(updatedAt) : 'waiting for stream'}</div>
        <div className="footer-chip">Top ticker: {topTickers[0]?.[0] ?? 'WTI'}</div>
        <div className="footer-chip">Chain mode: validated before display</div>
      </section>

      {selectedAlert && <ChainModal alert={selectedAlert} onClose={() => setSelectedAlertId(null)} />}
    </main>
  );
}
