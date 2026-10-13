#!/usr/bin/env node
// Coletor SEO reproduzível (spec 105 T3.1, plan.md §5).
//
//   node scripts/seo/coletar.mjs --start 2026-09-13 --end 2026-10-10 [--app mesas]
//
// Lê `apps.json` (uma linha por app — nada de `if (app === 'mesas')`), consulta
// Search Console e GA4 por REST com a service account de leitura e escreve JSON
// no stdout. Período fechado e sem relógio na saída: duas execuções do mesmo
// período dão o mesmo texto. O snapshot NÃO é versionado.
//
// Credencial: GOOGLE_APPLICATION_CREDENTIALS, ou
// ~/.config/artificio/ga-gsc-leitura.json (T0.1, fora do repositório).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { GoogleAuth } from 'google-auth-library';
import {
  collectGa4Report,
  collectGscRows,
  ga4Body,
  gscBody,
  normalizeGa4Rows,
  normalizeGscRows,
  selectEntries,
  validateManifest,
  validatePeriod,
} from './coletar-lib.mjs';

// Manifesto fixo ao lado do script: caminho vindo de argumento é path traversal.
const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), 'apps.json');
const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
];

const GSC_REPORTS = [
  ['paginas', ['page']],
  ['consultas', ['query', 'page']],
];

const GA4_REPORTS = [
  ['eventos', { dimensions: ['eventName'], metrics: ['eventCount'], orderMetric: 'eventCount' }],
  [
    'paginas',
    {
      dimensions: ['pagePath'],
      metrics: ['screenPageViews', 'activeUsers'],
      orderMetric: 'screenPageViews',
    },
  ],
  [
    'entrada',
    {
      dimensions: ['landingPage', 'sessionDefaultChannelGroup'],
      metrics: ['sessions', 'engagedSessions'],
      orderMetric: 'sessions',
    },
  ],
];

async function post(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Os relatórios de um app e os apps entre si são independentes. `Promise.all` mantém a
// ordem da entrada, então a saída segue determinística.
async function collectApp(entry, period, token) {
  const gscUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(entry.gscSite)}/searchAnalytics/query`;
  const ga4Url = `https://analyticsdata.googleapis.com/v1beta/properties/${entry.ga4Property}:runReport`;

  const gscReports = await Promise.all(
    GSC_REPORTS.map(async ([, dims]) => {
      const rows = await collectGscRows((startRow) =>
        post(gscUrl, token, gscBody(entry, period, dims, startRow)),
      );
      return normalizeGscRows(rows, dims);
    }),
  );
  const ga4Reports = await Promise.all(
    GA4_REPORTS.map(async ([, spec]) => {
      const report = await collectGa4Report((offset) =>
        post(ga4Url, token, ga4Body(entry, period, spec, offset)),
      );
      return normalizeGa4Rows(report, spec.orderMetric);
    }),
  );
  return {
    app: entry.app,
    host: entry.host,
    gsc: Object.fromEntries(GSC_REPORTS.map(([name], i) => [name, gscReports[i]])),
    ga4: Object.fromEntries(GA4_REPORTS.map(([name], i) => [name, ga4Reports[i]])),
  };
}

const { values } = parseArgs({
  options: {
    start: { type: 'string' },
    end: { type: 'string' },
    app: { type: 'string' },
  },
});

const period = validatePeriod(values.start, values.end);
const manifest = validateManifest(JSON.parse(readFileSync(MANIFEST, 'utf8')));
const entries = selectEntries(manifest, values.app);

const keyFile =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  resolve(homedir(), '.config', 'artificio', 'ga-gsc-leitura.json');
const auth = new GoogleAuth({ keyFilename: keyFile, scopes: SCOPES });
const token = await auth.getAccessToken();
if (!token) throw new Error('Sem token de acesso.');

const apps = await Promise.all(entries.map((entry) => collectApp(entry, period, token)));
process.stdout.write(`${JSON.stringify({ period, apps }, null, 2)}\n`);
