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
  ga4Body,
  gscBody,
  normalizeGa4Rows,
  normalizeGscRows,
  validateManifest,
  validatePeriod,
} from './coletar-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
];

const GA4_REPORTS = {
  eventos: { dimensions: ['eventName'], metrics: ['eventCount'], orderMetric: 'eventCount' },
  paginas: {
    dimensions: ['pagePath'],
    metrics: ['screenPageViews', 'activeUsers'],
    orderMetric: 'screenPageViews',
  },
  entrada: {
    dimensions: ['landingPage', 'sessionDefaultChannelGroup'],
    metrics: ['sessions', 'engagedSessions'],
    orderMetric: 'sessions',
  },
};

async function post(url, token, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function collectApp(entry, period, token) {
  const gscUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(entry.gscSite)}/searchAnalytics/query`;
  const gsc = {};
  for (const [name, dims] of [
    ['paginas', ['page']],
    ['consultas', ['query', 'page']],
  ]) {
    const json = await post(gscUrl, token, gscBody(entry, period, dims));
    gsc[name] = normalizeGscRows(json.rows, dims);
  }
  const ga4Url = `https://analyticsdata.googleapis.com/v1beta/properties/${entry.ga4Property}:runReport`;
  const ga4 = {};
  for (const [name, spec] of Object.entries(GA4_REPORTS)) {
    const json = await post(ga4Url, token, ga4Body(entry, period, spec));
    ga4[name] = normalizeGa4Rows(json, spec.orderMetric);
  }
  return { app: entry.app, host: entry.host, gsc, ga4 };
}

const { values } = parseArgs({
  options: {
    start: { type: 'string' },
    end: { type: 'string' },
    app: { type: 'string' },
    manifest: { type: 'string', default: join(HERE, 'apps.json') },
  },
});

const period = validatePeriod(values.start, values.end);
const manifest = validateManifest(JSON.parse(readFileSync(values.manifest, 'utf8')));
const entries = values.app ? manifest.filter((e) => e.app === values.app) : manifest;
if (entries.length === 0) throw new Error(`App "${values.app}" não está no manifesto.`);

const keyFile =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  resolve(homedir(), '.config', 'artificio', 'ga-gsc-leitura.json');
const auth = new GoogleAuth({ keyFilename: keyFile, scopes: SCOPES });
const token = await auth.getAccessToken();
if (!token) throw new Error('Sem token de acesso.');

const apps = [];
for (const entry of entries) apps.push(await collectApp(entry, period, token));
process.stdout.write(`${JSON.stringify({ period, apps }, null, 2)}\n`);
