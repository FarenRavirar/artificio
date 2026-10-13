// Funções puras do coletor SEO (spec 105 T3.1). Sem rede e sem relógio: o que
// entra aqui é o que torna a saída reproduzível, então é o que o teste cobre.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Período fechado: as duas pontas são datas ISO e `end` é anterior a hoje. */
export function validatePeriod(start, end, today = new Date()) {
  if (!DATE.test(start ?? '') || !DATE.test(end ?? '')) {
    throw new Error('Informe --start e --end no formato YYYY-MM-DD.');
  }
  if (start > end) throw new Error('--start depois de --end.');
  const todayIso = today.toISOString().slice(0, 10);
  if (end >= todayIso) {
    throw new Error(`Período aberto: --end (${end}) precisa ser anterior a hoje (${todayIso}).`);
  }
  return { start, end };
}

export function validateManifest(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Manifesto vazio ou não é uma lista.');
  }
  const seen = new Set();
  for (const e of entries) {
    for (const k of ['app', 'host', 'hostName', 'gscSite', 'ga4Property']) {
      if (typeof e?.[k] !== 'string' || e[k] === '') {
        throw new Error(`Manifesto: campo "${k}" ausente em ${JSON.stringify(e)}.`);
      }
    }
    if (!/^\d+$/.test(e.ga4Property)) {
      throw new Error(`Manifesto: ga4Property de "${e.app}" precisa ser numérico, não o G-….`);
    }
    if (seen.has(e.app)) throw new Error(`Manifesto: app duplicado "${e.app}".`);
    seen.add(e.app);
  }
  return entries;
}

/** Corpo de `searchAnalytics.query`: período fechado, dados finais, filtro por host. */
export function gscBody(entry, { start, end }, dimensions) {
  return {
    startDate: start,
    endDate: end,
    dimensions,
    dimensionFilterGroups: [
      {
        groupType: 'and',
        filters: [{ dimension: 'page', operator: 'contains', expression: entry.host }],
      },
    ],
    dataState: 'final',
    type: 'web',
    rowLimit: 25000,
    startRow: 0,
  };
}

/** Corpo de `runReport`: filtra o host (os apps dividem a property) e ordena. */
export function ga4Body(entry, { start, end }, { dimensions, metrics, orderMetric }) {
  return {
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    dimensionFilter: {
      filter: {
        fieldName: 'hostName',
        stringFilter: { matchType: 'EXACT', value: entry.hostName },
      },
    },
    orderBys: [{ metric: { metricName: orderMetric }, desc: true }],
    limit: 10000,
  };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const keyOf = (row, dims) => dims.map((d) => row[d]).join('\u0000');

/** Linhas do GSC em forma estável: a API só ordena por cliques, o resto fica por conta daqui. */
export function normalizeGscRows(rows = [], dimensions) {
  return rows
    .map((r) => ({
      ...Object.fromEntries(dimensions.map((d, i) => [d, r.keys[i]])),
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Number(r.ctr.toFixed(4)),
      position: Number(r.position.toFixed(1)),
    }))
    .sort(
      (a, b) =>
        b.clicks - a.clicks ||
        b.impressions - a.impressions ||
        cmp(keyOf(a, dimensions), keyOf(b, dimensions)),
    );
}

/** Linhas do GA4 em forma estável; métrica vira número e o desempate é pelas dimensões. */
export function normalizeGa4Rows(report, orderMetric) {
  const dims = (report.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (report.metricHeaders ?? []).map((h) => h.name);
  return (report.rows ?? [])
    .map((r) => ({
      ...Object.fromEntries(dims.map((d, i) => [d, r.dimensionValues[i].value])),
      ...Object.fromEntries(mets.map((m, i) => [m, Number(r.metricValues[i].value)])),
    }))
    .sort((a, b) => b[orderMetric] - a[orderMetric] || cmp(keyOf(a, dims), keyOf(b, dims)));
}
