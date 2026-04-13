"use client";

import { useEffect, useMemo, useState } from 'react';
import type { FactSetAlert } from '@/lib/factset';

type AlertsResponse = { updatedAt: string; alerts: FactSetAlert[] };

const tabs = ['all', 'macro', 'sector', 'target', 'general'] as const;
type Tab = (typeof tabs)[number];

type SectorPoint = {
  name: string;
  count: number;
  score: number;
  confidence: number;
};

type TimelinePoint = {
  label: string;
  sortKey: number;
  alerts: number;
  macro: number;
  target: number;
  sector: number;
  general: number;
  confidence: number;
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

function shortDay(ts: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ts));
}

function typeLabel(type: FactSetAlert['type']) {
  if (type === 'macro') return 'Macro driver';
  if (type === 'sector') return 'Sector tape';
  if (type === 'target') return 'Analyst target';
  return 'Market note';
}

function biasTone(bias: FactSetAlert['marketBias']) {
  if (bias === 'risk-on') return 'up';
  if (bias === 'risk-off') return 'down';
  return 'flat';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashHue(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return 195 + (hash % 95);
}

function TrendSparkline({ points }: { points: TimelinePoint[] }) {
  const width = 640;
  const height = 220;
  const padding = 20;

  const chart = useMemo(() => {
    const maxAlerts = Math.max(1, ...points.map((p) => p.alerts));
    const maxConfidence = Math.max(1, ...points.map((p) => p.confidence));
    const maxMacro = Math.max(1, ...points.map((p) => p.macro));
    const maxTarget = Math.max(1, ...points.map((p) => p.target));
    const maxSector = Math.max(1, ...points.map((p) => p.sector));

    const scale = (value: number, max: number) => padding + (height - padding * 2) * (1 - value / max);
    const xAt = (index: number) => padding + (width - padding * 2) * (index / Math.max(1, points.length - 1));

    const build = (selector: (p: TimelinePoint) => number, max: number) =>
      points.map((point, index) => `${xAt(index)},${scale(selector(point), max)}`).join(' ');

    return {
      alerts: build((p) => p.alerts, maxAlerts),
      confidence: build((p) => p.confidence, maxConfidence),
      macro: build((p) => p.macro, maxMacro),
      target: build((p) => p.target, maxTarget),
      sector: build((p) => p.sector, maxSector),
      gridX: Array.from({ length: 6 }, (_, i) => padding + ((width - padding * 2) / 5) * i),
      gridY: Array.from({ length: 5 }, (_, i) => padding + ((height - padding * 2) / 4) * i),
    };
  }, [points]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="trend-chart" aria-label="Trend lines for the live FactSet feed">
      {chart.gridY.map((y) => <line key={y} x1={padding} x2={width - padding} y1={y} y2={y} className="chart-grid" />)}
      {chart.gridX.map((x) => <line key={x} y1={padding} y2={height - padding} x1={x} x2={x} className="chart-grid subtle" />)}
      <polyline points={chart.alerts} className="trend-line trend-alerts" />
      <polyline points={chart.macro} className="trend-line trend-macro" />
      <polyline points={chart.target} className="trend-line trend-target" />
      <polyline points={chart.sector} className="trend-line trend-sector" />
      <polyline points={chart.confidence} className="trend-line trend-confidence" />
      {points.map((point, index) => {
        const x = padding + ((width - padding * 2) * index) / Math.max(1, points.length - 1);
        const y = height - padding - clamp(point.confidence, 0, 10) * 14;
        return <circle key={`${point.label}-${index}`} cx={x} cy={y} r={2.5} className="trend-dot" />;
      })}
    </svg>
  );
}

function MiniHeatCell({ name, score, confidence }: SectorPoint) {
  const value = clamp(score, -1, 1);
  const intensity = Math.abs(value);
  const hue = value >= 0 ? 165 : 350;
  const bg = `linear-gradient(180deg, hsla(${hue}, 85%, ${42 + intensity * 8}%, ${0.25 + intensity * 0.5}), hsla(${hue}, 85%, ${38 + intensity * 6}%, ${0.18 + intensity * 0.25}))`;
  const glow = `0 0 ${intensity * 20 + 6}px hsla(${hue}, 85%, 58%, ${0.25 + intensity * 0.25})`;
  return (
    <div className="heat-cell" style={{ background: bg, boxShadow: glow }}>
      <div className="heat-name">{name}</div>
      <div className="heat-score">{score > 0 ? '+' : ''}{score.toFixed(2)}%</div>
      <div className="heat-meta">{Math.round(confidence * 100)}% conviction</div>
    </div>
  );
}

function AlertCard({ item }: { item: FactSetAlert }) {
  return (
    <article className="card alert-card">
      <div className="card-head">
        <div>
          <div className={`badge ${item.type}`}>{typeLabel(item.type)}</div>
          <h3>{item.subject}</h3>
        </div>
        <div className="small">{fmt(item.receivedAt)}</div>
      </div>
      <p>{item.summary}</p>
      <div className="pill-row">
        {item.tickers.slice(0, 5).map((ticker) => <span key={ticker} className="pill">{ticker}</span>)}
        {item.sectors.slice(0, 4).map((sectorName) => <span key={sectorName} className="pill">{sectorName}</span>)}
      </div>
      <div className="statline"><strong>Impact</strong><span>{item.impact}</span></div>
      <div className="statline"><strong>Confidence</strong><span>{Math.round(item.confidence * 100)}%</span></div>
      <div className="tone-line">
        <span className={`tone-dot ${biasTone(item.marketBias)}`} />
        <span>{item.marketBias === 'risk-on' ? 'Risk-on' : item.marketBias === 'risk-off' ? 'Risk-off' : 'Mixed'} reading</span>
      </div>
    </article>
  );
}

export default function Page() {
  const [alerts, setAlerts] = useState<FactSetAlert[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [updatedAt, setUpdatedAt] = useState('');
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling'>('connecting');

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
      const data = JSON.parse(event.data) as AlertsResponse;
      apply(data);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      const tabOk = tab === 'all' || a.type === tab;
      const queryOk = !q || [a.subject, a.summary, a.impact, a.tickers.join(' '), a.sectors.join(' ')].join(' ').toLowerCase().includes(q);
      return tabOk && queryOk;
    });
  }, [alerts, query, tab]);

  const macro = alerts.find((a) => a.type === 'macro');
  const sector = alerts.find((a) => a.type === 'sector');
  const target = alerts.find((a) => a.type === 'target');

  const sectors = useMemo<SectorPoint[]>(() => {
    const map = new Map<string, { score: number; confidence: number; count: number }>();
    for (const alert of alerts) {
      const score = alert.marketBias === 'risk-on' ? 1 : alert.marketBias === 'risk-off' ? -1 : 0.25;
      for (const s of alert.sectors) {
        const current = map.get(s) ?? { score: 0, confidence: 0, count: 0 };
        current.score += score * alert.confidence;
        current.confidence += alert.confidence;
        current.count += 1;
        map.set(s, current);
      }
    }

    const results = Array.from(map.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      score: data.score / Math.max(1, data.count),
      confidence: data.confidence / Math.max(1, data.count),
    }));

    const fallback = [
      { name: 'Energy', score: -0.74, confidence: 0.98, count: 2 },
      { name: 'Consumer Discretionary', score: 0.61, confidence: 0.96, count: 2 },
      { name: 'Information Technology', score: 0.48, confidence: 0.94, count: 2 },
      { name: 'Industrials', score: 0.39, confidence: 0.92, count: 2 },
      { name: 'Real Estate', score: 0.22, confidence: 0.94, count: 3 },
      { name: 'Healthcare', score: 0.13, confidence: 0.88, count: 1 },
    ];

    return (results.length ? results : fallback)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 8);
  }, [alerts]);

  const timeline = useMemo<TimelinePoint[]>(() => {
    const buckets = new Map<string, TimelinePoint>();
    for (const alert of alerts) {
      const d = new Date(alert.receivedAt);
      const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
      const current = buckets.get(label) ?? { label, sortKey: d.getTime(), alerts: 0, macro: 0, target: 0, sector: 0, general: 0, confidence: 0 };
      current.alerts += 1;
      current.confidence += alert.confidence;
      if (alert.type !== 'general') current[alert.type] += 1;
      else current.general += 1;
      buckets.set(label, current);
    }

    const list = Array.from(buckets.values())
      .sort((a, b) => a.sortKey - b.sortKey);

    if (list.length >= 2) return list.slice(-8);

    return [
      { label: 'Mon', sortKey: 1, alerts: 2, macro: 1, target: 1, sector: 0, general: 0, confidence: 1.8 },
      { label: 'Tue', sortKey: 2, alerts: 3, macro: 1, target: 1, sector: 1, general: 0, confidence: 2.6 },
      { label: 'Wed', sortKey: 3, alerts: 2, macro: 0, target: 1, sector: 1, general: 0, confidence: 1.9 },
      { label: 'Thu', sortKey: 4, alerts: 4, macro: 1, target: 1, sector: 2, general: 0, confidence: 3.3 },
      { label: 'Fri', sortKey: 5, alerts: 3, macro: 1, target: 1, sector: 1, general: 0, confidence: 2.7 },
    ];
  }, [alerts]);

  const volume = timeline.reduce((sum, point) => sum + point.alerts, 0);
  const avgConfidence = alerts.length ? alerts.reduce((sum, a) => sum + a.confidence, 0) / alerts.length : 0;
  const liveBadge = connection === 'live' ? 'Live' : connection === 'polling' ? 'Polling fallback' : 'Connecting';

  const topTickers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const alert of alerts) {
      for (const ticker of alert.tickers) counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [alerts]);

  const signalSummary = [
    { label: 'Macro', value: macro ? macro.subject : 'Awaiting shock headline', tone: macro?.marketBias ?? 'mixed' },
    { label: 'Sector', value: sector ? sector.subject : 'Awaiting sector tape', tone: sector?.marketBias ?? 'mixed' },
    { label: 'Analyst', value: target ? target.subject : 'Awaiting target revision', tone: target?.marketBias ?? 'mixed' },
  ] as const;

  return (
    <main className="shell">
      <section className="hero">
        <div className="topbar">
          <div>
            <div className="kicker">FactSet email ingestion dashboard</div>
            <h1 className="title">A cleaner market command center for live FactSet alerts.</h1>
            <p className="sub">
              Faster scanning, better hierarchy, and richer visuals: trend lines for incoming alert volume, sector heatmaps for relative strength,
              and a priority feed that keeps the newest market-moving emails front and center. Updates still arrive in real time through the SSE stream.
            </p>
          </div>
          <div className="chips">
            <span className="chip">Source: FactSet Alerts</span>
            <span className="chip">Delivery: SSE + serverless ingest</span>
            <span className="chip">State: {liveBadge}</span>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric">
            <div className="label">Live alerts</div>
            <div className="value">{alerts.length}</div>
            <div className="delta up">{volume} total items in the timeline</div>
          </div>
          <div className="metric">
            <div className="label">Average conviction</div>
            <div className="value">{Math.round(avgConfidence * 100)}%</div>
            <div className={`delta ${avgConfidence > 0.9 ? 'up' : 'flat'}`}>normalized across all incoming alerts</div>
          </div>
          <div className="metric">
            <div className="label">Market bias</div>
            <div className="value">{macro?.marketBias === 'risk-off' ? 'Risk-off' : macro?.marketBias === 'risk-on' ? 'Risk-on' : 'Mixed'}</div>
            <div className={`delta ${biasTone(macro?.marketBias ?? 'mixed')}`}>{macro?.subject ?? 'Waiting for the next macro alert'}</div>
          </div>
          <div className="metric">
            <div className="label">Updated</div>
            <div className="value">{updatedAt ? shortDay(updatedAt) : 'Now'}</div>
            <div className="delta up">{updatedAt ? fmt(updatedAt) : 'Listening to the stream'}</div>
          </div>
        </div>
      </section>

      <div className="grid cols-main">
        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Trend lines</h2>
              <p className="panel-sub">Alert volume, sector intensity, and confidence over recent ingestions.</p>
            </div>
            <div className="legend-row">
              <span><i className="legend alerts" /> Alerts</span>
              <span><i className="legend macro" /> Macro</span>
              <span><i className="legend target" /> Target</span>
              <span><i className="legend sector" /> Sector</span>
              <span><i className="legend confidence" /> Confidence</span>
            </div>
          </div>
          <div className="panel-bd chart-panel">
            <TrendSparkline points={timeline} />
            <div className="timeline-labels">
              {timeline.map((point) => <span key={point.label}>{point.label}</span>)}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Sector heatmap</h2>
              <p className="panel-sub">Relative heat from the alerts being ingested right now.</p>
            </div>
          </div>
          <div className="panel-bd heatmap-grid">
            {sectors.map((sectorPoint) => <MiniHeatCell key={sectorPoint.name} {...sectorPoint} />)}
          </div>
        </section>
      </div>

      <div className="grid cols-main three-col">
        <section className="panel spotlight">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Priority insights</h2>
              <p className="panel-sub">The three highest-priority lanes from the current feed.</p>
            </div>
          </div>
          <div className="panel-bd spotlight-grid">
            {signalSummary.map((item) => (
              <div key={item.label} className="spot-card">
                <div className={`badge ${item.label.toLowerCase()}`}>{item.label}</div>
                <h3>{item.value}</h3>
                <div className={`spot-tone ${biasTone(item.tone)}`}>{item.tone === 'risk-on' ? 'Risk-on' : item.tone === 'risk-off' ? 'Risk-off' : 'Mixed'}</div>
              </div>
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
                  : ['WTI', 'XLE', 'REXR', 'JAN', 'SNDA', 'WSR'].map((ticker) => (
                      <span key={ticker} className="ticker-chip"><strong>{ticker}</strong><em>0</em></span>
                    ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Realtime status</h2>
              <p className="panel-sub">The stream stays live; polling only activates if SSE drops.</p>
            </div>
          </div>
          <div className="panel-bd">
            <div className="status-stack">
              <div className="status-row"><strong>Transport</strong><span>{liveBadge}</span></div>
              <div className="status-row"><strong>Source</strong><span>FactSet Alerts ingest route</span></div>
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

      <div className="grid cols-feed">
        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Live feed</h2>
              <p className="panel-sub">Newest FactSet items first with search and type filters.</p>
            </div>
          </div>
          <div className="panel-bd">
            <input className="searchbar" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickers, sectors, headlines, or keywords" />
            <div style={{ height: 12 }} />
            <div className="tabs">
              {tabs.map((t) => (
                <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                  {t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ height: 16 }} />
            <div className="feed">
              {filtered.map((item) => <AlertCard key={item.id} item={item} />)}
              {filtered.length === 0 && <div className="card"><p>No alerts matched the current search.</p></div>}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">How it reads incoming mail</h2>
              <p className="panel-sub">A cleaner explanation of the live classification rules.</p>
            </div>
          </div>
          <div className="panel-bd rules-grid">
            <div className="rule-card"><div className="badge macro">Macro</div><p>Detect Hormuz, blockade, Iran, oil, and shipping terms; mark as a broad risk-off shock.</p></div>
            <div className="rule-card"><div className="badge sector">Sector</div><p>Recognize sector scorecards, rotation summaries, and relative strength / laggard language.</p></div>
            <div className="rule-card"><div className="badge target">Analyst</div><p>Capture upgrades, downgrades, targets, and initiations, then tie them to the affected tickers.</p></div>
            <div className="rule-card"><div className="badge general">Realtime</div><p>Ingested alerts are streamed through the serverless endpoint and pushed to the UI without refresh.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}
