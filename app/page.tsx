"use client";

import { useEffect, useMemo, useState } from 'react';
import type { FactSetAlert } from '@/lib/factset';

type AlertsResponse = { updatedAt: string; alerts: FactSetAlert[] };

type Tab = 'all' | FactSetAlert['type'];
const tabs: Tab[] = ['all', 'macro', 'sector', 'target', 'general'];

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

function typeLabel(type: FactSetAlert['type']) {
  if (type === 'macro') return 'Macro';
  if (type === 'sector') return 'Sector';
  if (type === 'target') return 'Target';
  return 'General';
}

function biasTone(bias: FactSetAlert['marketBias']) {
  if (bias === 'risk-on') return 'up';
  if (bias === 'risk-off') return 'down';
  return 'flat';
}

export default function Page() {
  const [alerts, setAlerts] = useState<FactSetAlert[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    let alive = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    let stream: EventSource | undefined;

    const apply = (data: AlertsResponse) => {
      if (!alive) return;
      setAlerts(data.alerts);
      setUpdatedAt(data.updatedAt);
      setLoaded(true);
    };

    const load = async () => {
      try {
        const res = await fetch('/api/alerts', { cache: 'no-store' });
        if (!res.ok) return;
        apply((await res.json()) as AlertsResponse);
      } catch {
        // keep waiting for the live feed
      }
    };

    load();

    stream = new EventSource('/api/stream');
    stream.onopen = () => {
      if (alive) setConnection('live');
    };
    stream.onmessage = (event) => {
      try {
        apply(JSON.parse(event.data) as AlertsResponse);
      } catch {
        // ignore malformed frames
      }
    };
    stream.onerror = () => {
      if (!alive) return;
      setConnection('polling');
      if (!poll) poll = setInterval(load, 5000);
    };

    return () => {
      alive = false;
      stream?.close();
      if (poll) clearInterval(poll);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...alerts]
      .sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt))
      .filter((alert) => {
        const tabOk = tab === 'all' || alert.type === tab;
        const text = [alert.subject, alert.summary, alert.impact, alert.tickers.join(' '), alert.sectors.join(' ')]
          .join(' ')
          .toLowerCase();
        const queryOk = !q || text.includes(q);
        return tabOk && queryOk;
      });
  }, [alerts, query, tab]);

  const avgConfidence = loaded && alerts.length ? Math.round((alerts.reduce((sum, item) => sum + item.confidence, 0) / alerts.length) * 100) : 0;
  const liveState = connection === 'live' ? 'Live' : connection === 'polling' ? 'Polling' : 'Connecting';
  const topTickers = Array.from(
    alerts.flatMap((item) => item.tickers).reduce((map, ticker) => map.set(ticker, (map.get(ticker) ?? 0) + 1), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <main className="shell live-shell">
      <header className="hero live-hero">
        <div className="topbar">
          <div className="hero-copy">
            <div className="kicker">Live alerts</div>
            <h1>FactSet market feed</h1>
            <p>The page stays empty until the first /api/alerts response arrives, then updates only from live data.</p>
          </div>
          <div className="chips">
            <span className="chip">Source: /api/alerts</span>
            <span className="chip">Transport: /api/stream</span>
            <span className="chip">State: {liveState}</span>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-hd">
          <div>
            <h2 className="panel-title">Live snapshot</h2>
            <p className="panel-sub">No synthetic charts, no landing page placeholders, just the current feed.</p>
          </div>
        </div>
        <div className="panel-bd metric-grid">
          <div className="metric">
            <div className="metric-label">Alerts</div>
            <div className="metric-value">{loaded ? alerts.length : '—'}</div>
            <div className="metric-sub">{loaded ? 'Hydrated from the first API response' : 'Waiting for first update'}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Average confidence</div>
            <div className="metric-value">{loaded ? `${avgConfidence}%` : '—'}</div>
            <div className="metric-sub">{loaded ? 'Computed from live alerts' : 'Not available yet'}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Latest update</div>
            <div className="metric-value">{updatedAt ? fmt(updatedAt) : '—'}</div>
            <div className={`metric-sub ${loaded && alerts[0] ? biasTone(alerts[0].marketBias) : 'flat'}`}>
              {loaded ? 'Current feed time' : 'Awaiting first payload'}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Top ticker</div>
            <div className="metric-value">{topTickers[0]?.[0] ?? '—'}</div>
            <div className="metric-sub">{topTickers[0] ? `Seen ${topTickers[0][1]} times` : 'No ticker data yet'}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-hd">
          <div>
            <h2 className="panel-title">Feed controls</h2>
            <p className="panel-sub">Filter the live alerts once the feed hydrates.</p>
          </div>
        </div>
        <div className="panel-bd tools-row">
          <input
            className="searchbar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headlines, tickers, or sectors"
          />
          <div className="tabs-row">
            {tabs.map((item) => (
              <button key={item} className={`tab ${tab === item ? 'active' : ''}`} type="button" onClick={() => setTab(item)}>
                {item === 'all' ? 'All' : typeLabel(item)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel feed-panel">
        <div className="panel-hd">
          <div>
            <h2 className="panel-title">Live feed</h2>
            <p className="panel-sub">Newest alerts first.</p>
          </div>
          <div className="panel-sub">{updatedAt ? `Updated ${fmt(updatedAt)}` : 'No update yet'}</div>
        </div>
        <div className="panel-bd feed-list">
          {!loaded ? (
            <div className="empty-state">Waiting for the first /api/alerts response.</div>
          ) : filtered.length ? (
            filtered.map((alert) => (
              <article key={alert.id} className="feed-card">
                <div className="card-top">
                  <div className={`badge ${alert.type}`}>{typeLabel(alert.type)}</div>
                  <div className="card-time">{fmt(alert.receivedAt)}</div>
                </div>
                <h3>{alert.subject}</h3>
                <p>{alert.summary}</p>
                <p className="impact">{alert.impact}</p>
                <div className="pill-row">
                  {alert.tickers.slice(0, 4).map((ticker) => (
                    <span key={ticker} className="pill">
                      {ticker}
                    </span>
                  ))}
                  {alert.sectors.slice(0, 3).map((sector) => (
                    <span key={sector} className="pill">
                      {sector}
                    </span>
                  ))}
                  <span className={`pill tone ${biasTone(alert.marketBias)}`}>{alert.marketBias}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">No alerts match the current filter.</div>
          )}
        </div>
      </section>
    </main>
  );
}
