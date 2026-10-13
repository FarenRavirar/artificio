import { describe, expect, it } from 'vitest';
import {
  GA4_PAGE_LIMIT,
  GSC_ROW_LIMIT,
  collectGa4Report,
  collectGscRows,
  escapeRe2,
  ga4Body,
  gscBody,
  normalizeGa4Rows,
  normalizeGscRows,
  selectEntries,
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
      operator: 'includingRegex',
      expression: String.raw`^https://mesas\.artificiorpg\.com/`,
    });
  });

  it('GSC: regex ancorado não casa host dentro da query de outra página', () => {
    const { expression } = gscBody(entry, { start: '2026-09-13', end: '2026-10-10' }, ['page'])
      .dimensionFilterGroups[0].filters[0];
    const re = new RegExp(expression);

    expect(re.test('https://mesas.artificiorpg.com/mesas/x')).toBe(true);
    expect(re.test('https://artificiorpg.com/?u=https://mesas.artificiorpg.com/')).toBe(false);
    expect(re.test('https://mesasXartificiorpg.com/')).toBe(false);
  });

  it('escapeRe2 escapa metacaracteres', () => {
    expect(escapeRe2(String.raw`a.b+c?(d)[e]{f}|g^h$i*j\k`)).toBe(
      String.raw`a\.b\+c\?\(d\)\[e\]\{f\}\|g\^h\$i\*j\\k`,
    );
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

describe('resposta fora do contrato', () => {
  it('GSC: rows não lista, linha sem keys e métrica não numérica viram erro controlado', () => {
    expect(() => normalizeGscRows(null, ['page'])).toThrow(/fora do contrato/);
    expect(() => normalizeGscRows([{ clicks: 1 }], ['page'])).toThrow(/keys/);
    const ruim = { keys: ['https://a/'], clicks: 1, impressions: 1, ctr: '0', position: 1 };
    expect(() => normalizeGscRows([ruim], ['page'])).toThrow(/ctr/);
  });

  it('GSC: rows ausente (consulta sem resultado) é lista vazia', () => {
    expect(normalizeGscRows(undefined, ['page'])).toEqual([]);
  });

  it('GA4: cabeçalho ausente, célula faltando e métrica não numérica viram erro controlado', () => {
    const base = {
      dimensionHeaders: [{ name: 'eventName' }],
      metricHeaders: [{ name: 'eventCount' }],
    };
    expect(() => normalizeGa4Rows({ rows: [] }, 'eventCount')).toThrow(/dimensionHeaders/);
    expect(() =>
      normalizeGa4Rows({ ...base, rows: [{ dimensionValues: [{ value: 'a' }] }] }, 'eventCount'),
    ).toThrow(/metricValues/);
    expect(() =>
      normalizeGa4Rows(
        { ...base, rows: [{ dimensionValues: [{ value: 'a' }], metricValues: [{ value: 'x' }] }] },
        'eventCount',
      ),
    ).toThrow(/não numérica/);
    expect(() => normalizeGa4Rows({ ...base, rows: null }, 'eventCount')).toThrow(/rows/);
  });
});

describe('paginação', () => {
  it('GSC: avança startRow até a página vir menor que o limite', async () => {
    const full = Array.from({ length: GSC_ROW_LIMIT }, () => ({}));
    const pages = { 0: { rows: full }, [GSC_ROW_LIMIT]: { rows: [{}, {}] } };
    const seen = [];
    const rows = await collectGscRows(async (startRow) => {
      seen.push(startRow);
      return pages[startRow];
    });

    expect(seen).toEqual([0, GSC_ROW_LIMIT]);
    expect(rows).toHaveLength(GSC_ROW_LIMIT + 2);
  });

  it('GSC: página única curta não pede a seguinte', async () => {
    let calls = 0;
    await collectGscRows(async () => {
      calls += 1;
      return { rows: [{}] };
    });
    expect(calls).toBe(1);
  });

  it('GA4: avança offset até cobrir rowCount e mantém os cabeçalhos', async () => {
    const headers = { dimensionHeaders: [{ name: 'a' }], metricHeaders: [{ name: 'm' }] };
    const total = GA4_PAGE_LIMIT + 3;
    const seen = [];
    const report = await collectGa4Report(async (offset) => {
      seen.push(offset);
      const n = offset === 0 ? GA4_PAGE_LIMIT : 3;
      return { ...headers, rowCount: total, rows: Array.from({ length: n }, () => ({})) };
    });

    expect(seen).toEqual([0, GA4_PAGE_LIMIT]);
    expect(report.rows).toHaveLength(total);
    expect(report.dimensionHeaders).toEqual(headers.dimensionHeaders);
  });

  it('GA4: resposta sem rowCount numérico vira erro controlado', async () => {
    await expect(collectGa4Report(async () => ({ rowCount: 'x', rows: [{}] }))).rejects.toThrow(
      /rowCount/,
    );
  });
});

describe('selectEntries', () => {
  const manifest = [entry, { ...entry, app: 'glossario' }];

  it('sem --app devolve o manifesto inteiro', () => {
    expect(selectEntries(manifest, undefined)).toEqual(manifest);
  });

  it('--app válido filtra; vazio ou desconhecido é erro', () => {
    expect(selectEntries(manifest, 'mesas')).toEqual([entry]);
    expect(() => selectEntries(manifest, '')).toThrow(/não está no manifesto/);
    expect(() => selectEntries(manifest, 'x')).toThrow(/não está no manifesto/);
  });
});
