"use client";

import { useEffect, useMemo, useState } from 'react';
import type { FactSetAlert } from '@/lib/factset';

type AlertsResponse = { updatedAt: string; alerts: FactSetAlert[] };

const tabs = ['all', 'macro', 'sector', 'target', 'general'] as const;

type Tab = (typeof tabs)[number];

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
      if (!interval) {
        interval = setInterval(load, 3000);
      }
    };

    return () => {
      alive = false;
      source?.close();
      if (interval) clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      const tabOk = tab === 'all' || a.type === tab;
      const q = query.trim().toLowerCase();
      const queryOk = !q || [a.subject, a.summary, a.impact, a.tickers.join(' '), a.sectors.join(' ')].join(' ').toLowerCase().includes(q);
      return tabOk && queryOk;
    });
  }, [alerts, query, tab]);

  const macro = alerts.find((a) => a.type === 'macro');
  const sector = alerts.find((a) => a.type === 'sector');
  const target = alerts.find((a) => a.type === 'target');

  const sectorRows = [
    { name: 'Energy', value: -4.07, tone: 'red' },
    { name: 'Consumer Discretionary', value: 5.81, tone: 'green' },
    { name: 'Information Technology', value: 4.81, tone: 'green' },
    { name: 'Industrials', value: 4.69, tone: 'green' },
    { name: 'Real Estate', value: 2.93, tone: 'gold' },
    { name: 'Healthcare', value: 0.36, tone: 'gold' },
  ] as const;

  return (
    <main className="shell">
      <section className="hero">
        <div className="topbar">
          <div>
            <div className="kicker">FactSet email ingestion dashboard</div>
            <h1 className="title">Real-time market tape, parsed from incoming FactSet alerts.</h1>
            <p className="sub">
              Macro shocks, sector rotation, and analyst target changes are normalized into one trading surface.
              New FactSet mail streams into the serverless ingest route and updates the UI immediately when a new alert lands.
            </p>
          </div>
          <div className="chips">
            <span className="chip">Source: FactSet Alerts</span>
            <span className="chip">Delivery: SSE + serverless ingest</span>
            <span className="chip">State: {connection === 'live' ? 'Live' : connection === 'polling' ? 'Polling fallback' : 'Connecting'}</span>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric">
            <div className="label">Latest pulse</div>
            <div className="value">{alerts.length}</div>
            <div className="delta up">normalized alerts in memory</div>
          </div>
          <div className="metric">
            <div className="label">Macro bias</div>
            <div className="value">{macro?.marketBias === 'risk-off' ? 'Risk-off' : macro?.marketBias === 'risk-on' ? 'Risk-on' : 'Mixed'}</div>
            <div className={`delta ${biasTone(macro?.marketBias ?? 'mixed')}`}>{macro?.subject ?? 'Waiting for macro alert'}</div>
          </div>
          <div className="metric">
            <div className="label">Sector leader</div>
            <div className="value">XLY</div>
            <div className="delta up">Consumer discretionary +5.81% weekly</div>
          </div>
          <div className="metric">
            <div className="label">Target alerts</div>
            <div className="value">{target ? target.tickers.length : 0}</div>
            <div className="delta up">analyst revisions detected</div>
          </div>
        </div>
      </section>

      <div className="grid cols-3">
        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Macro impact: Hormuz blockade</h2>
              <p className="panel-sub">Trading read-through from the most important FactSet macro alert.</p>
            </div>
          </div>
          <div className="panel-bd">
            <div className="card">
              <div className="badge macro">{macro ? typeLabel(macro.type) : 'Macro driver'}</div>
              <h3>{macro?.subject ?? 'No macro alert yet'}</h3>
              <p>{macro?.summary ?? 'Waiting for incoming FactSet alerts.'}</p>
              <div className="pill-row">
                {(macro?.tickers ?? ['WTI', 'XLE', 'USO']).map((x) => <span key={x} className="pill">{x}</span>)}
              </div>
              <div className="statline"><strong>Expected effect</strong><span>{macro?.impact ?? 'Energy up, transport down, inflation hedges bid'}</span></div>
              <div className="statline"><strong>Bias</strong><span>{macro?.marketBias?.toUpperCase() ?? 'RISK-OFF'}</span></div>
            </div>
            <div className="footer-note">The parser tags Hormuz / Iran / blockade language as a macro event and surfaces the cross-asset read-through automatically.</div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Sector sentiment</h2>
              <p className="panel-sub">Weekly scorecard plus real estate tape.</p>
            </div>
          </div>
          <div className="panel-bd heatmap">
            {sectorRows.map((row) => {
              const width = Math.min(100, Math.max(8, Math.abs(row.value) * 12));
              return (
                <div key={row.name} className="heat-row">
                  <strong>{row.name}</strong>
                  <div className="bar"><div className={`fill ${row.tone}`} style={{ width: `${width}%` }} /></div>
                  <div className={`right ${row.value < 0 ? 'delta down' : 'delta up'}`}>{row.value > 0 ? '+' : ''}{row.value.toFixed(2)}%</div>
                </div>
              );
            })}
            <div className="card">
              <div className="badge sector">{sector ? typeLabel(sector.type) : 'Sector tape'}</div>
              <h3>{sector?.subject ?? 'Sector tape waiting for refresh'}</h3>
              <p>{sector?.summary ?? 'Sector summary will populate as alerts arrive.'}</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Price target alerts</h2>
              <p className="panel-sub">Analyst revisions pulled from FactSet digest emails.</p>
            </div>
          </div>
          <div className="panel-bd feed">
            <div className="card">
              <div className="badge target">Analyst calls</div>
              <h3>{target?.subject ?? 'No target alert yet'}</h3>
              <p>{target?.summary ?? 'Waiting for target changes or initiations.'}</p>
              <div className="pill-row">
                {(target?.tickers ?? ['REXR', 'JAN', 'SNDA', 'WSR']).map((x) => <span key={x} className="pill">{x}</span>)}
              </div>
            </div>
            <div className="statline"><strong>Best setup</strong><span>REXR upgrade / target raised to 40</span></div>
            <div className="statline"><strong>Positive initiations</strong><span>JAN 27, SNDA 36</span></div>
            <div className="statline"><strong>Negative revision</strong><span>WSR downgraded to neutral</span></div>
          </div>
        </section>
      </div>

      <div className="grid cols-2">
        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Live feed</h2>
              <p className="panel-sub">Newest FactSet items first, with search and type filters.</p>
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
              {filtered.map((item) => (
                <article key={item.id} className="card">
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
                </article>
              ))}
              {filtered.length === 0 && <div className="card"><p>No alerts matched the current search.</p></div>}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hd">
            <div>
              <h2 className="panel-title">Parser behavior</h2>
              <p className="panel-sub">How incoming FactSet mail is normalized before it hits the UI.</p>
            </div>
          </div>
          <div className="panel-bd">
            <div className="split">
              <div className="card">
                <div className="badge macro">Macro rules</div>
                <p>Detect Hormuz, blockade, Iran, oil, and shipping terms; classify as a risk-off cross-asset shock.</p>
              </div>
              <div className="card">
                <div className="badge sector">Sector rules</div>
                <p>Extract weekly scorecards, subsector leaders/laggards, and any real estate or industry-specific sentiment.</p>
              </div>
              <div className="card">
                <div className="badge target">Target rules</div>
                <p>Capture upgrade/downgrade language plus raised/initiated target levels, then pin tickers to the alert card.</p>
              </div>
              <div className="card">
                <div className="badge general">Delivery</div>
                <p>Serverless ingest route accepts raw FactSet email text and streams the update to the frontend immediately.</p>
              </div>
            </div>
            <div className="footer-note">Last synced: {updatedAt ? fmt(updatedAt) : 'awaiting first fetch'}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
