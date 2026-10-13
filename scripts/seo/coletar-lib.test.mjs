import { describe, expect, it } from 'vitest';
import {
  ga4Body,
  gscBody,
  normalizeGa4Rows,
  normalizeGscRows,
  validateManifest,
  validatePeriod,
} from './coletar-lib.mjs';

const entry = {
  app: 'mesas',
  host: 'https://mesas.artificiorpg.com/',
  hostName: 'mesas.artificiorpg.com',
  gscSite: 'sc-domain:artificiorpg.com',
  ga4Property: '475307720',
};

describe('validatePeriod', () => {
  const today = new Date('2026-10-13T12:00:00Z');

  it('aceita período fechado', () => {
    expect(validatePeriod('2026-09-13', '2026-10-10', today)).toEqual({
      start: '2026-09-13',
      end: '2026-10-10',
    });
  });

  it('recusa período que inclui hoje', () => {
    expect(() => validatePeriod('2026-09-13', '2026-10-13', today)).toThrow(/aberto/);
  });

  it('recusa data fora do formato e intervalo invertido', () => {
    expect(() => validatePeriod('13/09/2026', '2026-10-10', today)).toThrow(/YYYY-MM-DD/);
    expect(() => validatePeriod('2026-10-10', '2026-09-13', today)).toThrow(/depois/);
  });
});

describe('validateManifest', () => {
  it('aceita entrada completa', () => {
    expect(validateManifest([entry])).toEqual([entry]);
  });

  it('recusa measurement id no lugar do id numérico', () => {
    expect(() => validateManifest([{ ...entry, ga4Property: 'G-43T3C6K6V6' }])).toThrow(/numérico/);
  });

  it('recusa app duplicado e campo ausente', () => {
    expect(() => validateManifest([entry, entry])).toThrow(/duplicado/);
    expect(() => validateManifest([{ ...entry, host: '' }])).toThrow(/host/);
  });
});

describe('corpos das requisições', () => {
  it('GSC: dados finais, filtro por host e período explícito', () => {
    const body = gscBody(entry, { start: '2026-09-13', end: '2026-10-10' }, ['page']);

    expect(body.dataState).toBe('final');
    expect(body.startDate).toBe('2026-09-13');
    expect(body.dimensionFilterGroups[0].filters[0]).toEqual({
      dimension: 'page',
      operator: 'contains',
      expression: 'https://mesas.artificiorpg.com/',
    });
  });

  it('GA4: filtra hostName, porque os apps dividem a property', () => {
    const body = ga4Body(
      entry,
      { start: '2026-09-13', end: '2026-10-10' },
      { dimensions: ['eventName'], metrics: ['eventCount'], orderMetric: 'eventCount' },
    );

    expect(body.dimensionFilter.filter.stringFilter.value).toBe('mesas.artificiorpg.com');
    expect(body.orderBys).toEqual([{ metric: { metricName: 'eventCount' }, desc: true }]);
  });
});

describe('normalização estável', () => {
  it('GSC: empate de cliques e impressões desempata pela chave', () => {
    const rows = [
      { keys: ['https://b/'], clicks: 0, impressions: 1, ctr: 0, position: 3 },
      { keys: ['https://a/'], clicks: 0, impressions: 1, ctr: 0, position: 4 },
    ];

    expect(normalizeGscRows(rows, ['page'])).toEqual(normalizeGscRows([...rows].reverse(), ['page']));
    expect(normalizeGscRows(rows, ['page'])[0].page).toBe('https://a/');
  });

  it('GA4: métrica vira número e a ordem independe da entrada', () => {
    const report = {
      dimensionHeaders: [{ name: 'eventName' }],
      metricHeaders: [{ name: 'eventCount' }],
      rows: [
        { dimensionValues: [{ value: 'b' }], metricValues: [{ value: '2' }] },
        { dimensionValues: [{ value: 'a' }], metricValues: [{ value: '2' }] },
      ],
    };
    const out = normalizeGa4Rows(report, 'eventCount');

    expect(out).toEqual([
      { eventName: 'a', eventCount: 2 },
      { eventName: 'b', eventCount: 2 },
    ]);
    expect(normalizeGa4Rows({ ...report, rows: [...report.rows].reverse() }, 'eventCount')).toEqual(out);
  });
});
