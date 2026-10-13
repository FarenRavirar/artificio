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

/** Seleciona o app do manifesto. `--app=` (vazio) é pedido inválido, não "todos". */
export function selectEntries(manifest, app) {
  if (app === undefined) return manifest;
  const entries = manifest.filter((e) => e.app === app);
  if (entries.length === 0) throw new Error(`App "${app}" não está no manifesto.`);
  return entries;
}

/** Escapa metacaracteres do RE2 (sintaxe do `includingRegex` do Search Console). */
export function escapeRe2(text) {
  return text.replace(/[\\^$.|?*+()[\]{}]/g, String.raw`\$&`);
}

export const GSC_ROW_LIMIT = 25000;
export const GA4_PAGE_LIMIT = 10000;
/** Teto de requisições concorrentes por property na Data API do GA4. */
export const GA4_MAX_CONCURRENT = 10;

/**
 * Corpo de `searchAnalytics.query`: período fechado, dados finais, filtro por host.
 * O filtro é regex ancorado no início da URL: `contains` casaria página de outro host
 * que traga o host na query string (ex.: `?redirect=https://mesas…/`).
 */
export function gscBody(entry, { start, end }, dimensions, startRow = 0) {
  return {
    startDate: start,
    endDate: end,
    dimensions,
    dimensionFilterGroups: [
      {
        groupType: 'and',
        filters: [
          { dimension: 'page', operator: 'includingRegex', expression: `^${escapeRe2(entry.host)}` },
        ],
      },
    ],
    dataState: 'final',
    type: 'web',
    rowLimit: GSC_ROW_LIMIT,
    startRow,
  };
}

/** Corpo de `runReport`: filtra o host (os apps dividem a property) e ordena. */
export function ga4Body(entry, { start, end }, { dimensions, metrics, orderMetric }, offset = 0) {
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
    // Métrica primeiro, dimensões como desempate: sem ordem total, empates mudam de
    // página entre chamadas e a paginação por `offset` repete ou pula linhas.
    orderBys: [
      { metric: { metricName: orderMetric }, desc: true },
      ...dimensions.map((dimensionName) => ({ dimension: { dimensionName }, desc: false })),
    ],
    limit: GA4_PAGE_LIMIT,
    offset,
  };
}

/**
 * Semáforo: no máximo `max` tarefas ao mesmo tempo; as demais esperam a vez.
 * A Data API do GA4 limita requisições concorrentes por property.
 */
export function createLimiter(max) {
  let active = 0;
  const waiting = [];
  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };
  return async function run(task) {
    if (active >= max) await new Promise((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

function cmp(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
const keyOf = (row, dims) => dims.map((d) => row[d]).join('\u0000');

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function fail(where, what) {
  throw new Error(`Resposta fora do contrato (${where}): ${what}.`);
}

/** Linhas do GSC em forma estável: a API só ordena por cliques, o resto fica por conta daqui. */
export function normalizeGscRows(rows, dimensions) {
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) fail('GSC', '`rows` não é lista');
  return rows
    .map((r, n) => {
      if (!isRecord(r) || !Array.isArray(r.keys) || r.keys.length !== dimensions.length) {
        fail('GSC', `linha ${n} sem \`keys\` com ${dimensions.length} item(ns)`);
      }
      if (!r.keys.every((k) => typeof k === 'string')) fail('GSC', `linha ${n} com chave não textual`);
      for (const m of ['clicks', 'impressions', 'ctr', 'position']) {
        if (!isNum(r[m])) fail('GSC', `linha ${n} com \`${m}\` não numérico`);
      }
      return {
        ...Object.fromEntries(dimensions.map((d, i) => [d, r.keys[i]])),
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Number(r.ctr.toFixed(4)),
        position: Number(r.position.toFixed(1)),
      };
    })
    .sort(
      (a, b) =>
        b.clicks - a.clicks ||
        b.impressions - a.impressions ||
        cmp(keyOf(a, dimensions), keyOf(b, dimensions)),
    );
}

function headerNames(report, field) {
  const headers = report[field];
  if (!Array.isArray(headers) || headers.length === 0) fail('GA4', `\`${field}\` ausente`);
  return headers.map((h, n) => {
    if (!isRecord(h) || typeof h.name !== 'string') fail('GA4', `\`${field}\`[${n}] sem nome`);
    return h.name;
  });
}

function cellValues(row, field, size, n) {
  const cells = row[field];
  if (!Array.isArray(cells) || cells.length !== size) {
    fail('GA4', `linha ${n} com \`${field}\` de tamanho diferente do cabeçalho`);
  }
  return cells.map((c) => {
    if (!isRecord(c) || typeof c.value !== 'string') fail('GA4', `linha ${n} com célula sem \`value\``);
    return c.value;
  });
}

/** Linhas do GA4 em forma estável; métrica vira número e o desempate é pelas dimensões. */
export function normalizeGa4Rows(report, orderMetric) {
  if (!isRecord(report)) fail('GA4', 'relatório não é objeto');
  const dims = headerNames(report, 'dimensionHeaders');
  const mets = headerNames(report, 'metricHeaders');
  if (!mets.includes(orderMetric)) fail('GA4', `métrica de ordenação \`${orderMetric}\` ausente`);
  const rows = report.rows === undefined ? [] : report.rows;
  if (!Array.isArray(rows)) fail('GA4', '`rows` não é lista');
  return rows
    .map((r, n) => {
      if (!isRecord(r)) fail('GA4', `linha ${n} não é objeto`);
      const dv = cellValues(r, 'dimensionValues', dims.length, n);
      const mv = cellValues(r, 'metricValues', mets.length, n).map(Number);
      if (!mv.every(Number.isFinite)) fail('GA4', `linha ${n} com métrica não numérica`);
      return {
        ...Object.fromEntries(dims.map((d, i) => [d, dv[i]])),
        ...Object.fromEntries(mets.map((m, i) => [m, mv[i]])),
      };
    })
    .sort((a, b) => b[orderMetric] - a[orderMetric] || cmp(keyOf(a, dims), keyOf(b, dims)));
}

/**
 * Pagina `searchAnalytics.query`: avança `startRow` até uma página vir menor que o limite.
 * `fetchPage(startRow)` devolve o JSON da resposta; só as `rows` são juntadas.
 */
export async function collectGscRows(fetchPage) {
  const all = [];
  for (let startRow = 0; ; startRow += GSC_ROW_LIMIT) {
    const json = await fetchPage(startRow);
    if (!isRecord(json)) fail('GSC', 'resposta não é objeto');
    const rows = json.rows === undefined ? [] : json.rows;
    if (!Array.isArray(rows)) fail('GSC', '`rows` não é lista');
    all.push(...rows);
    if (rows.length < GSC_ROW_LIMIT) return all;
  }
}

/**
 * Pagina `runReport`: avança `offset` até cobrir `rowCount`. Devolve um relatório só,
 * com os cabeçalhos da primeira página e as linhas de todas.
 */
export async function collectGa4Report(fetchPage) {
  let first;
  const rows = [];
  for (let offset = 0; ; offset += GA4_PAGE_LIMIT) {
    const page = await fetchPage(offset);
    if (!isRecord(page)) fail('GA4', 'resposta não é objeto');
    first ??= page;
    const got = page.rows === undefined ? [] : page.rows;
    if (!Array.isArray(got)) fail('GA4', '`rows` não é lista');
    rows.push(...got);
    const total = page.rowCount ?? got.length;
    if (!isNum(total)) fail('GA4', '`rowCount` não numérico');
    if (got.length === 0 || offset + got.length >= total) break;
  }
  return { ...first, rows };
}
