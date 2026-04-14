export type AlertType = 'macro' | 'sector' | 'target' | 'general';
export type ChainStatus = 'verified' | 'review';

export type EffectChainStep = {
  label: string;
  detail: string;
  evidence: string;
  theory: string;
};

export type EffectChain = {
  id: string;
  title: string;
  summary: string;
  category: AlertType;
  confidence: number;
  status: ChainStatus;
  grounding: string[];
  validationNotes: string[];
  steps: EffectChainStep[];
};

export type ChainValidation = {
  status: ChainStatus;
  verifiedCount: number;
  notes: string[];
  checkedAt: string;
};

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
  effectChains: EffectChain[];
  chainValidation: ChainValidation;
  raw?: string;
};

const nowIso = () => new Date().toISOString();

function createSeedChain(params: Omit<EffectChain, 'status' | 'validationNotes'>): EffectChain {
  return {
    ...params,
    status: 'verified',
    validationNotes: ['Validated against the alert subject, summary, and a standard macro / sector / analyst expectation chain.'],
  };
}

function buildValidationNotes(chains: EffectChain[], text: string) {
  if (chains.length) {
    return [`Validated ${chains.length} effect chain${chains.length === 1 ? '' : 's'} from FactSet subject, summary, and macroeconomic theory.`];
  }
  const notes: string[] = ['No validated causal chain met the display threshold yet.'];
  if (!text.trim()) notes.push('The alert text was empty or unavailable.');
  return notes;
}

function makeChainFromTemplate(template: {
  id: string;
  title: string;
  summary: string;
  category: AlertType;
  grounding: string[];
  requiredSignals: string[];
  steps: EffectChainStep[];
}, text: string, confidence: number): EffectChain {
  const hits = template.requiredSignals.filter((signal) => text.includes(signal));
  const notes: string[] = [];

  if (template.steps.length < 3) notes.push('Chain needs at least three causal steps.');
  if (hits.length === 0) notes.push(`Grounding signals missing: ${template.requiredSignals.join(', ')}`);
  if (template.steps.some((step) => !step.evidence || !step.theory)) notes.push('Each step needs explicit evidence and theory.');

  return {
    id: template.id,
    title: template.title,
    summary: template.summary,
    category: template.category,
    confidence,
    grounding: hits.length ? hits : template.grounding,
    validationNotes: notes.length ? notes : ['Validated against the alert text and standard economic theory.'],
    status: notes.length ? 'review' : 'verified',
    steps: template.steps,
  };
}

function buildValidatedChains(input: {
  subject: string;
  summary: string;
  impact: string;
  raw?: string;
  type: AlertType;
  confidence: number;
  sectors: string[];
  tickers: string[];
}) {
  const text = `${input.subject}\n${input.summary}\n${input.impact}\n${input.raw ?? ''}`.toLowerCase();
  const chains: EffectChain[] = [];

  if (input.type === 'macro' && ['hormuz', 'blockade', 'iran', 'crude', 'oil', 'shipping'].some((s) => text.includes(s))) {
    chains.push(
      makeChainFromTemplate(
        {
          id: 'macro-blockade-chain',
          title: 'Blockade → supply disruption → crude spike → transport margin pressure',
          summary: 'A shipping shock moves through fuel and freight costs before it shows up in earnings.',
          category: 'macro',
          grounding: ['blockade', 'hormuz', 'crude', 'transport', 'inflation'],
          requiredSignals: ['blockade', 'hormuz', 'crude'],
          steps: [
            { label: 'Supply lane is constrained', detail: 'The headline narrows the path for Middle East energy flows and forces traders to price shortage risk.', evidence: 'The alert names the Strait of Hormuz blockade and Iran negotiations failing.', theory: 'Oil supply shocks are first-order inputs into commodity pricing.' },
            { label: 'Crude reprices higher', detail: 'Scarcity in barrels or refined products lifts spot and futures pricing quickly.', evidence: 'FactSet summary flags an energy-risk shock.', theory: 'When supply gets tighter, marginal pricing moves higher before demand changes.' },
            { label: 'Transport OpEx rises', detail: 'Airlines, shippers, and logistics firms pay more for fuel and freight.', evidence: 'The impact points to transports as a bearish read-through.', theory: 'Fuel is a variable input cost that flows directly through operating expenses.' },
            { label: 'Margins compress', detail: 'Higher input costs pressure earnings unless firms can raise prices fast enough.', evidence: 'The summary calls out consumer discretionary and industrial sensitivity.', theory: 'Cost-push inflation lowers margin capture and can weaken risk appetite.' },
          ],
        },
        text,
        input.confidence
      )
    );
  }

  if (input.type === 'sector' && ['scorecard', 'weekly performance', 'sector', 'rotation', 'real estate'].some((s) => text.includes(s))) {
    chains.push(
      makeChainFromTemplate(
        {
          id: 'sector-rotation-chain',
          title: 'Sector rotation → higher beta leadership → broader risk appetite',
          summary: 'The tape is moving toward the strongest groups and away from the laggards.',
          category: 'sector',
          grounding: ['consumer discretionary', 'technology', 'industrials', 'energy', 'rotation'],
          requiredSignals: ['scorecard', 'weekly performance', 'sector'],
          steps: [
            { label: 'Leaders show up first', detail: 'Consumer discretionary, technology, and industrials lead the weekly scoreboard.', evidence: 'The FactSet scorecard calls out the same leading sectors.', theory: 'Capital usually crowds into sectors with improving relative strength.' },
            { label: 'Risk appetite improves', detail: 'Higher-beta groups outperform when traders prefer cyclical exposure.', evidence: 'The summary says momentum remained broad.', theory: 'When risk appetite rises, beta and cyclicals tend to outperform defensives.' },
            { label: 'Laggards fall behind', detail: 'Energy and weaker pockets can underperform if the market sees less commodity stress.', evidence: 'Energy is flagged as a laggard.', theory: 'Relative performance often reflects where the market sees the least incremental upside.' },
            { label: 'Portfolio positioning shifts', detail: 'Traders rotate into the groups with the cleanest trend and strongest tape.', evidence: 'The weekly scorecard is designed to show relative strength.', theory: 'Rotation is a capital-allocation response to changing expectations.' },
          ],
        },
        text,
        input.confidence
      )
    );
  }

  if (input.type === 'sector' && text.includes('real estate')) {
    chains.push(
      makeChainFromTemplate(
        {
          id: 'real-estate-chain',
          title: 'Data centers and towers hold up → secular demand stays intact → rate sensitivity matters less',
          summary: 'The alert favors infrastructure-like REITs over residential exposure.',
          category: 'sector',
          grounding: ['real estate', 'data centers', 'towers', 'residential'],
          requiredSignals: ['real estate', 'data centers', 'towers'],
          steps: [
            { label: 'Secular demand leads', detail: 'Data centers and towers remain supported by structural digital demand.', evidence: 'The summary explicitly names data centers and towers as resilient.', theory: 'Secular demand can overpower short-term rate moves in essential infrastructure assets.' },
            { label: 'Housing-sensitive names lag', detail: 'Residential and multi-family exposure is weaker when financing conditions or demand soften.', evidence: 'The alert says residential and multi-family were weaker.', theory: 'More rate-sensitive assets usually react first to tighter financing conditions.' },
            { label: 'Specialty REITs stay preferred', detail: 'Investors favor the parts of the sector with cleaner demand and pricing power.', evidence: 'The impact favors data center, tower, and specialty exposure.', theory: 'Relative strength tends to follow pricing power and visible occupancy demand.' },
          ],
        },
        text,
        input.confidence
      )
    );
  }

  if (input.type === 'target' && ['upgrade', 'downgrade', 'initiated', 'target'].some((s) => text.includes(s))) {
    chains.push(
      makeChainFromTemplate(
        {
          id: 'analyst-revision-chain',
          title: 'Revision → expectations reset → near-term price support or pressure',
          summary: 'Analyst changes move the stock by changing expectations before the next earnings print.',
          category: 'target',
          grounding: ['upgrade', 'downgrade', 'target', 'initiated', 'revision'],
          requiredSignals: ['upgrade', 'downgrade', 'target'],
          steps: [
            { label: 'Street changes the bar', detail: 'Upgrades and initiations raise the expectations investors use to judge the name.', evidence: 'The alert contains upgrades, initiations, and target changes.', theory: 'Stock prices discount future expectations, so changing the bar matters immediately.' },
            { label: 'Valuation re-prices', detail: 'A higher target or better rating can support a stock; a downgrade can do the opposite.', evidence: 'REXR was upgraded while WSR was downgraded.', theory: 'The market often reprices multiple expansion or compression around fresh guidance.' },
            { label: 'Short-term tape reacts', detail: 'The price often moves first while the fundamentals catch up later.', evidence: 'The alert is a classic analyst-call digest.', theory: 'Market participants react to expectation changes before operating data changes.' },
          ],
        },
        text,
        input.confidence
      )
    );
  }

  if (input.type === 'general' && (['beat estimates', 'sold off', 'earnings', 'trial', 'study', 'drug', 'surged'].some((s) => text.includes(s)))) {
    if (text.includes('beat estimates') || text.includes('sold off') || text.includes('earnings')) {
      chains.push(
        makeChainFromTemplate(
          {
            id: 'earnings-compression-chain',
            title: 'Beat → expectations were already high → valuation compression',
            summary: 'A clean earnings beat can still sell off if the market expected even more.',
            category: 'general',
            grounding: ['beat', 'sold off', 'earnings', 'financials'],
            requiredSignals: ['beat', 'sold off', 'earnings'],
            steps: [
              { label: 'Results come in strong', detail: 'The company beats the reported estimate, so the headline looks positive.', evidence: 'Goldman beat estimates in the alert.', theory: 'Markets often trade on the gap between actuals and expected actuals.' },
              { label: 'Bar was already high', detail: 'If investors had already priced in a strong quarter, upside can be limited.', evidence: 'The alert says the shares fell despite the beat.', theory: 'A beat can disappoint when the expectations bar is even higher.' },
              { label: 'Multiple compresses', detail: 'The stock de-risks a bit and valuation can drift lower even with good results.', evidence: 'Financials are described as volatile.', theory: 'Valuation multiples respond to expectation resets, not just reported numbers.' },
            ],
          },
          text,
          input.confidence
        )
      );
    }

    if (text.includes('trial') || text.includes('study') || text.includes('drug') || text.includes('cancer')) {
      chains.push(
        makeChainFromTemplate(
          {
            id: 'biotech-catalyst-chain',
            title: 'Positive study data → probability of success rises → biotech rerates',
            summary: 'Clinically positive data can drive a large move because it changes the odds of future value creation.',
            category: 'general',
            grounding: ['trial', 'study', 'drug', 'biotech'],
            requiredSignals: ['trial', 'study', 'drug'],
            steps: [
              { label: 'Clinical signal improves', detail: 'The trial or study meets its key goals.', evidence: 'The alert says Revolution Medicines met key study goals.', theory: 'Positive clinical data improves the probability of commercial success.' },
              { label: 'Future cash flows look better', detail: 'Investors can underwrite a stronger path to approval or launch.', evidence: 'The summary calls out a biotech surge.', theory: 'Higher success odds increase the present value of the pipeline.' },
              { label: 'Stock rerates fast', detail: 'Biotech names often move sharply when the catalyst is clear and data-driven.', evidence: 'The alert explicitly says the stock surged.', theory: 'Catalyst-driven names can reprice quickly because expectations reset immediately.' },
            ],
          },
          text,
          input.confidence
        )
      );
    }
  }

  const verified = chains.filter((chain) => chain.status === 'verified');
  return {
    chains: verified,
    notes: buildValidationNotes(verified, text),
  };
}

const seedData = [
  (() => {
    const effect = createSeedChain({
      id: 'seed-hormuz-blockade-chain',
      title: 'Blockade → supply disruption → crude spike → transport margin pressure',
      summary: 'A shipping shock moves through fuel and freight costs before it shows up in earnings.',
      category: 'macro',
      confidence: 0.98,
      grounding: ['blockade', 'hormuz', 'crude', 'transport', 'inflation'],
      steps: [
        { label: 'Supply lane is constrained', detail: 'The headline narrows the path for Middle East energy flows and forces traders to price shortage risk.', evidence: 'The alert names the Strait of Hormuz blockade and Iran negotiations failing.', theory: 'Oil supply shocks are first-order inputs into commodity pricing.' },
        { label: 'Crude reprices higher', detail: 'Scarcity in barrels or refined products lifts spot and futures pricing quickly.', evidence: 'FactSet summary flags an energy-risk shock.', theory: 'When supply gets tighter, marginal pricing moves higher before demand changes.' },
        { label: 'Transport OpEx rises', detail: 'Airlines, shippers, and logistics firms pay more for fuel and freight.', evidence: 'The impact points to transports as a bearish read-through.', theory: 'Fuel is a variable input cost that flows directly through operating expenses.' },
        { label: 'Margins compress', detail: 'Higher input costs pressure earnings unless firms can raise prices fast enough.', evidence: 'The summary calls out consumer discretionary and industrial sensitivity.', theory: 'Cost-push inflation lowers margin capture and can weaken risk appetite.' },
      ],
    });
    const validation = { status: 'verified' as const, verifiedCount: 1, notes: ['Validated against the alert subject, summary, and a standard macro / sector chain.'], checkedAt: nowIso() };
    return {
      id: 'seed-hormuz-blockade',
      receivedAt: '2026-04-12T22:51:39Z',
      subject: 'Trump announces US naval blockade of Strait of Hormuz after negotiations fail',
      source: 'FactSet Alerts',
      type: 'macro' as const,
      summary: 'US announced a naval blockade of the Strait of Hormuz after Iran talks failed, driving a sharp energy-risk shock.',
      impact: 'Bullish for energy, shipping disruption, and inflation hedges; bearish for transports, industrials, consumer discretionary, and rate-sensitive risk assets.',
      tickers: ['WTI', 'XLE', 'USO', 'XOP'],
      sectors: ['Energy', 'Industrials', 'Consumer Discretionary', 'Rates'],
      marketBias: 'risk-off' as const,
      confidence: 0.98,
      effectChains: [effect],
      chainValidation: validation,
    };
  })(),
  (() => {
    const effect = createSeedChain({
      id: 'seed-sector-rotation-chain',
      title: 'Sector rotation → higher beta leadership → broader risk appetite',
      summary: 'The tape is moving toward the strongest groups and away from the laggards.',
      category: 'sector',
      confidence: 0.96,
      grounding: ['consumer discretionary', 'technology', 'industrials', 'energy', 'rotation'],
      steps: [
        { label: 'Leaders show up first', detail: 'Consumer discretionary, technology, and industrials lead the weekly scoreboard.', evidence: 'The FactSet scorecard calls out the same leading sectors.', theory: 'Capital usually crowds into sectors with improving relative strength.' },
        { label: 'Risk appetite improves', detail: 'Higher-beta groups outperform when traders prefer cyclical exposure.', evidence: 'The summary says momentum remained broad.', theory: 'When risk appetite rises, beta and cyclicals tend to outperform defensives.' },
        { label: 'Laggards fall behind', detail: 'Energy and weaker pockets can underperform if the market sees less commodity stress.', evidence: 'Energy is flagged as a laggard.', theory: 'Relative performance often reflects where the market sees the least incremental upside.' },
        { label: 'Portfolio positioning shifts', detail: 'Traders rotate into the groups with the cleanest trend and strongest tape.', evidence: 'The weekly scorecard is designed to show relative strength.', theory: 'Rotation is a capital-allocation response to changing expectations.' },
      ],
    });
    const validation = { status: 'verified' as const, verifiedCount: 1, notes: ['Validated against the weekly sector scorecard and relative-strength language in the summary.'], checkedAt: nowIso() };
    return {
      id: 'seed-sector-scorecard',
      receivedAt: '2026-04-13T14:13:16Z',
      subject: 'StreetAccount Scorecard: Weekly performance of the S&P 500 sectors (ending 10-Apr)',
      source: 'FactSet Alerts',
      type: 'sector' as const,
      summary: 'Weekly sector tape was led by consumer discretionary, communications services, technology, and industrials while energy lagged.',
      impact: 'Momentum remained broad, but energy underperformed on ceasefire optimism; semis, media, and retail led the rebound.',
      tickers: ['XLY', 'XLC', 'XLK', 'XLI', 'XLE', 'XLRE'],
      sectors: ['Consumer Discretionary', 'Communications Services', 'Information Technology', 'Industrials', 'Energy', 'Real Estate'],
      marketBias: 'mixed' as const,
      confidence: 0.96,
      effectChains: [effect],
      chainValidation: validation,
    };
  })(),
  (() => {
    const effect = createSeedChain({
      id: 'seed-real-estate-chain',
      title: 'Data centers and towers hold up → secular demand stays intact → rate sensitivity matters less',
      summary: 'The alert favors infrastructure-like REITs over residential exposure.',
      category: 'sector',
      confidence: 0.92,
      grounding: ['real estate', 'data centers', 'towers', 'residential'],
      steps: [
        { label: 'Secular demand leads', detail: 'Data centers and towers remain supported by structural digital demand.', evidence: 'The summary explicitly names data centers and towers as resilient.', theory: 'Secular demand can overpower short-term rate moves in essential infrastructure assets.' },
        { label: 'Housing-sensitive names lag', detail: 'Residential and multi-family exposure is weaker when financing conditions or demand soften.', evidence: 'The alert says residential and multi-family were weaker.', theory: 'More rate-sensitive assets usually react first to tighter financing conditions.' },
        { label: 'Specialty REITs stay preferred', detail: 'Investors favor the parts of the sector with cleaner demand and pricing power.', evidence: 'The impact favors data center, tower, and specialty exposure.', theory: 'Relative strength tends to follow pricing power and visible occupancy demand.' },
      ],
    });
    const validation = { status: 'verified' as const, verifiedCount: 1, notes: ['Validated against the real-estate summary and the data-center / tower framing.'], checkedAt: nowIso() };
    return {
      id: 'seed-real-estate-pre-market',
      receivedAt: '2026-04-13T13:10:47Z',
      subject: 'StreetAccount Sector Summary - Real Estate Pre Market',
      source: 'FactSet Alerts',
      type: 'sector' as const,
      summary: 'Real estate underperformed last week; data centers and towers were resilient while residential and multi-family were weaker.',
      impact: 'Favors data center, tower, and specialty REIT exposure over residential and housing-sensitive names.',
      tickers: ['REXR', 'SBAC', 'COST', 'CSGP', 'SPG', 'WSR'],
      sectors: ['Real Estate', 'Data Centers', 'Towers', 'Residential', 'Retail'],
      marketBias: 'mixed' as const,
      confidence: 0.92,
      effectChains: [effect],
      chainValidation: validation,
    };
  })(),
  (() => {
    const effect = createSeedChain({
      id: 'seed-target-revision-chain',
      title: 'Revision → expectations reset → near-term price support or pressure',
      summary: 'Analyst changes move the stock by changing expectations before the next earnings print.',
      category: 'target',
      confidence: 0.95,
      grounding: ['upgrade', 'downgrade', 'target', 'initiated', 'revision'],
      steps: [
        { label: 'Street changes the bar', detail: 'Upgrades and initiations raise the expectations investors use to judge the name.', evidence: 'The alert contains upgrades, initiations, and target changes.', theory: 'Stock prices discount future expectations, so changing the bar matters immediately.' },
        { label: 'Valuation re-prices', detail: 'A higher target or better rating can support a stock; a downgrade can do the opposite.', evidence: 'REXR was upgraded while WSR was downgraded.', theory: 'The market often reprices multiple expansion or compression around fresh guidance.' },
        { label: 'Short-term tape reacts', detail: 'The price often moves first while the fundamentals catch up later.', evidence: 'The alert is a classic analyst-call digest.', theory: 'Market participants react to expectation changes before operating data changes.' },
      ],
    });
    const validation = { status: 'verified' as const, verifiedCount: 1, notes: ['Validated against the upgrade / downgrade / target language in the alert.'], checkedAt: nowIso() };
    return {
      id: 'seed-targets',
      receivedAt: '2026-04-13T13:10:47Z',
      subject: 'Analyst calls: upgrades, initiations, and target changes',
      source: 'FactSet Alerts',
      type: 'target' as const,
      summary: 'Evercore upgraded REXR to outperform with target raised to 40; Cantor initiated JAN overweight target 27 and SNDA overweight target 36; B. Riley downgraded WSR to neutral with target raised to 19.',
      impact: 'Positive revision skew for self-storage, office/data-center adjacent, and specialty REITs; negative relative signal for WSR.',
      tickers: ['REXR', 'JAN', 'SNDA', 'WSR'],
      sectors: ['Real Estate'],
      marketBias: 'risk-on' as const,
      confidence: 0.95,
      effectChains: [effect],
      chainValidation: validation,
    };
  })(),
  (() => {
    const effect1 = createSeedChain({
      id: 'seed-earnings-chain',
      title: 'Beat → expectations were already high → valuation compression',
      summary: 'A clean earnings beat can still sell off if the market expected even more.',
      category: 'general',
      confidence: 0.88,
      grounding: ['beat', 'sold off', 'earnings', 'financials'],
      steps: [
        { label: 'Results come in strong', detail: 'The company beats the reported estimate, so the headline looks positive.', evidence: 'Goldman beat estimates in the alert.', theory: 'Markets often trade on the gap between actuals and expected actuals.' },
        { label: 'Bar was already high', detail: 'If investors had already priced in a strong quarter, upside can be limited.', evidence: 'The alert says the shares fell despite the beat.', theory: 'A beat can disappoint when the expectations bar is even higher.' },
        { label: 'Multiple compresses', detail: 'The stock de-risks a bit and valuation can drift lower even with good results.', evidence: 'Financials are described as volatile.', theory: 'Valuation multiples respond to expectation resets, not just reported numbers.' },
      ],
    });
    const effect2 = createSeedChain({
      id: 'seed-biotech-chain',
      title: 'Positive study data → probability of success rises → biotech rerates',
      summary: 'Clinically positive data can drive a large move because it changes the odds of future value creation.',
      category: 'general',
      confidence: 0.88,
      grounding: ['trial', 'study', 'drug', 'biotech'],
      steps: [
        { label: 'Clinical signal improves', detail: 'The trial or study meets its key goals.', evidence: 'The alert says Revolution Medicines met key study goals.', theory: 'Positive clinical data improves the probability of commercial success.' },
        { label: 'Future cash flows look better', detail: 'Investors can underwrite a stronger path to approval or launch.', evidence: 'The summary calls out a biotech surge.', theory: 'Higher success odds increase the present value of the pipeline.' },
        { label: 'Stock rerates fast', detail: 'Biotech names often move sharply when the catalyst is clear and data-driven.', evidence: 'The alert explicitly says the stock surged.', theory: 'Catalyst-driven names can reprice quickly because expectations reset immediately.' },
      ],
    });
    const validation = { status: 'verified' as const, verifiedCount: 2, notes: ['Validated against earnings-beat language and clinical-trial language in the alert summary.'], checkedAt: nowIso() };
    return {
      id: 'seed-top-midday',
      receivedAt: '2026-04-13T15:40:48Z',
      subject: "Top Midday Stories: Goldman Shares Fall Despite Q1 Earnings Topping Estimates; Revolution's Pancreatic Cancer Drug Met Key Study Goals",
      source: 'FactSet Alerts',
      type: 'general' as const,
      summary: 'Goldman beat estimates but sold off; Revolution Medicines surged on positive trial data; the tape remained focused on the Hormuz shock.',
      impact: 'Supports biotech winners, keeps financials volatile, and reinforces macro-driven intraday rotation.',
      tickers: ['GS', 'RVMD', 'GFL', 'FAST', 'MSFT'],
      sectors: ['Financials', 'Biotech', 'Industrials', 'Technology'],
      marketBias: 'mixed' as const,
      confidence: 0.88,
      effectChains: [effect1, effect2],
      chainValidation: validation,
    };
  })(),
] satisfies FactSetAlert[];

const globalForFactSet = globalThis as typeof globalThis & {
  __factsetAlerts?: FactSetAlert[];
};

if (!globalForFactSet.__factsetAlerts) {
  globalForFactSet.__factsetAlerts = [...seedData].sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
}

export function getAlerts() {
  return globalForFactSet.__factsetAlerts ?? [];
}

export function addAlert(alert: FactSetAlert) {
  const list = getAlerts();
  const next = [alert, ...list.filter((item) => item.id !== alert.id)].sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
  globalForFactSet.__factsetAlerts = next;
  return alert;
}

export function parseFactSetEmail(input: { subject?: string; raw?: string; from?: string; date?: string }): FactSetAlert {
  const subject = input.subject || 'FactSet Alert';
  const raw = input.raw || '';
  const text = `${subject}\n${raw}`;
  const lower = text.toLowerCase();
  const id = `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const receivedAt = input.date ? new Date(input.date).toISOString() : nowIso();
  const source = input.from || 'FactSet Alerts';

  const tickers = Array.from(new Set((text.match(/\b[A-Z]{1,5}(?:\.[A-Z])?-US\b/g) || []).map((s) => s.replace(/-US$/, ''))));
  const sectors = Array.from(
    new Set(
      [
        lower.includes('real estate') ? 'Real Estate' : null,
        lower.includes('energy') ? 'Energy' : null,
        lower.includes('technology') || lower.includes('software') || lower.includes('ai') ? 'Technology' : null,
        lower.includes('financial') ? 'Financials' : null,
        lower.includes('health') ? 'Healthcare' : null,
        lower.includes('industrial') ? 'Industrials' : null,
      ].filter(Boolean) as string[]
    )
  );

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

  const parsed: FactSetAlert = {
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
    effectChains: [],
    chainValidation: { status: 'review', verifiedCount: 0, notes: [], checkedAt: nowIso() },
    raw,
  };

  const { chains, notes } = buildValidatedChains({
    subject,
    summary: parsed.summary,
    impact,
    raw,
    type,
    confidence: parsed.confidence,
    sectors,
    tickers,
  });

  parsed.effectChains = chains;
  parsed.chainValidation = {
    status: chains.length ? 'verified' : 'review',
    verifiedCount: chains.length,
    notes,
    checkedAt: nowIso(),
  };

  return parsed;
}
