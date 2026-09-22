import { describe, expect, it } from 'vitest';
import {
  activeCatalogFiltersCount,
  DAYPART_OPTIONS,
  DAYPART_RANGES,
  DAYPART_VALUES,
  hasActiveCatalogFilters,
  isDaypartOption,
  isWeekdayOption,
  normalizeEnumMulti,
  WEEKDAY_OPTIONS,
  WEEKDAY_TO_DEFINE,
  WEEKDAY_VALUES,
} from './catalogFilterOptions';
import { buildCatalogParams, parseCatalogFilters } from './catalogFilters';
import { mapFiltersToQueryParams } from '../services/catalogService';
import { makeCatalogFilters } from '../test/catalogFixtures';

/**
 * T7.1/T7.2 (spec 103) — registro canônico, parser e builder de dia da semana e
 * faixa de horário.
 */

describe('fonte única de dia e faixa (R6)', () => {
  it('as opções e os valores derivam da mesma lista', () => {
    expect(WEEKDAY_OPTIONS.map((option) => option.value)).toEqual([...WEEKDAY_VALUES]);
    expect(DAYPART_OPTIONS.map((option) => option.value)).toEqual([...DAYPART_VALUES]);
  });

  it('os 7 dias são o mesmo literal do CHECK do banco, com acento', () => {
    // Igual a `table_schedules.day_of_week` (migration 12, linha 16) e a
    // `tables.schedule_day_hint` (migration 124, linha 46). Perder o acento aqui
    // faria o filtro não casar nenhuma linha — o banco guarda o texto acentuado.
    //
    // `to_define` é excluído de propósito: ele NÃO existe nesses dois CHECK, e é
    // justamente por isso que o backend o separa antes de montar o `IN (...)`.
    expect(WEEKDAY_VALUES.filter((value) => value !== WEEKDAY_TO_DEFINE)).toEqual([
      'segunda',
      'terça',
      'quarta',
      'quinta',
      'sexta',
      'sábado',
      'domingo',
    ]);
  });

  it('“A definir” é o último valor e repete o literal do status do banco', () => {
    // Último porque não é dia de calendário, é a ausência dele (D4). O literal
    // vem de `SCHEDULE_DEFINITION_STATUSES` (`tableValidators.ts:38`), que é o
    // que `schedule_day_status` guarda — sentinela paralelo criaria tradução.
    expect(WEEKDAY_TO_DEFINE).toBe('to_define');
    expect(WEEKDAY_VALUES[WEEKDAY_VALUES.length - 1]).toBe(WEEKDAY_TO_DEFINE);
    expect(WEEKDAY_OPTIONS[WEEKDAY_OPTIONS.length - 1]).toEqual({
      value: 'to_define',
      label: 'A definir',
    });
  });

  it('as 4 faixas cobrem 24 h sem sobreposição e sem buraco', () => {
    // Requisito técnico, não escolha (D5): faixa sobreposta faz a mesma mesa
    // aparecer em duas, e buraco faz mesa sumir de todas.
    const ranges = DAYPART_VALUES.map((value) => DAYPART_RANGES[value]).sort(
      (left, right) => left.startHour - right.startHour,
    );

    expect(ranges[0].startHour).toBe(0);
    expect(ranges[ranges.length - 1].endHour).toBe(24);

    for (const [index, range] of ranges.entries()) {
      expect(range.endHour).toBeGreaterThan(range.startHour);
      if (index > 0) {
        // Fim de uma é começo exato da seguinte: sem lacuna, sem sobreposição.
        expect(range.startHour).toBe(ranges[index - 1].endHour);
      }
    }
  });

  it('os cortes são 06/12/18/00 (D5, respondida em 2026-09-18)', () => {
    expect(DAYPART_RANGES.madrugada).toEqual({ startHour: 0, endHour: 6 });
    expect(DAYPART_RANGES.manha).toEqual({ startHour: 6, endHour: 12 });
    expect(DAYPART_RANGES.tarde).toEqual({ startHour: 12, endHour: 18 });
    expect(DAYPART_RANGES.noite).toEqual({ startHour: 18, endHour: 24 });
  });

  it('os guards aceitam só o que está no registro', () => {
    expect(isWeekdayOption('sábado')).toBe(true);
    expect(isWeekdayOption('sabado')).toBe(false); // sem acento não existe no banco
    expect(isWeekdayOption('funday')).toBe(false);
    expect(isDaypartOption('manha')).toBe(true);
    expect(isDaypartOption('manhã')).toBe(false); // o valor de URL é sem acento
    expect(isDaypartOption('brunch')).toBe(false);
  });

  it('o label da faixa leva acento; o valor de URL, não', () => {
    // A faixa não existe no banco (é derivada de `start_time`), então o valor é
    // nosso e fica sem acento para não depender de encode na URL.
    expect(DAYPART_OPTIONS.find((option) => option.value === 'manha')?.label).toBe('Manhã');
    expect(DAYPART_VALUES.some((value) => /[^\x20-\x7E]/.test(value))).toBe(false);
  });
});

describe('normalizeEnumMulti — ordem canônica, não alfabética', () => {
  it('reordena pela ordem do calendário, qualquer que seja a ordem de clique', () => {
    // Alfabética daria ['domingo','sexta']; o usuário espera a semana em ordem.
    expect(normalizeEnumMulti(['sexta', 'domingo'], WEEKDAY_VALUES)).toEqual(['sexta', 'domingo']);
    expect(normalizeEnumMulti(['domingo', 'sexta'], WEEKDAY_VALUES)).toEqual(['sexta', 'domingo']);
  });

  it('reordena a faixa pela cronologia do dia', () => {
    expect(normalizeEnumMulti(['noite', 'manha'], DAYPART_VALUES)).toEqual(['manha', 'noite']);
  });

  it('deduplica e descarta valor fora do registro', () => {
    expect(normalizeEnumMulti(['sexta', 'funday', 'sexta'], WEEKDAY_VALUES)).toEqual(['sexta']);
    expect(normalizeEnumMulti([], WEEKDAY_VALUES)).toEqual([]);
  });
});

describe('parser de URL (T7.2)', () => {
  it('lê dia e faixa multivalor', () => {
    const parsed = parseCatalogFilters(new URLSearchParams('weekday=sexta,domingo&daypart=noite'));
    expect(parsed.weekdays).toEqual(['sexta', 'domingo']);
    expect(parsed.dayparts).toEqual(['noite']);
  });

  it('E4: valor inválido é descartado, não quebra a página', () => {
    expect(parseCatalogFilters(new URLSearchParams('weekday=sexta,funday,sexta')).weekdays).toEqual(['sexta']);
    expect(parseCatalogFilters(new URLSearchParams('daypart=noite,brunch')).dayparts).toEqual(['noite']);
    expect(parseCatalogFilters(new URLSearchParams('weekday=funday')).weekdays).toEqual([]);
  });

  it('decodifica o acento vindo percent-encoded', () => {
    // `sábado` chega como `s%C3%A1bado` quando o link é copiado da barra.
    expect(parseCatalogFilters(new URLSearchParams('weekday=s%C3%A1bado')).weekdays).toEqual(['sábado']);
  });

  it('URL sem os parâmetros devolve listas vazias', () => {
    const parsed = parseCatalogFilters(new URLSearchParams(''));
    expect(parsed.weekdays).toEqual([]);
    expect(parsed.dayparts).toEqual([]);
  });

  it('decode inválido não lança', () => {
    expect(() => parseCatalogFilters(new URLSearchParams('weekday=%E0%A4%A'))).not.toThrow();
    expect(parseCatalogFilters(new URLSearchParams('weekday=%E0%A4%A')).weekdays).toEqual([]);
  });
});

describe('builder de URL (T7.2)', () => {
  it('round-trip parse→build→parse é estável', () => {
    const filters = makeCatalogFilters({ weekdays: ['sábado', 'sexta'], dayparts: ['noite', 'manha'] });
    const reparsed = parseCatalogFilters(buildCatalogParams(filters));

    expect(reparsed.weekdays).toEqual(['sexta', 'sábado']);
    expect(reparsed.dayparts).toEqual(['manha', 'noite']);
  });

  it('a mesma seleção em ordem diferente produz a mesma URL', () => {
    const left = buildCatalogParams(makeCatalogFilters({ weekdays: ['domingo', 'sexta'] })).toString();
    const right = buildCatalogParams(makeCatalogFilters({ weekdays: ['sexta', 'domingo'] })).toString();
    expect(left).toBe(right);
  });

  it('não serializa parâmetro quando nada está marcado', () => {
    const params = buildCatalogParams(makeCatalogFilters());
    expect(params.has('weekday')).toBe(false);
    expect(params.has('daypart')).toBe(false);
  });

  it('descarta valor inválido que tenha entrado no estado', () => {
    const params = buildCatalogParams(
      makeCatalogFilters({ weekdays: ['funday' as never, 'sexta'] }),
    );
    expect(params.get('weekday')).toBe('sexta');
  });
});

describe('mapper de query do backend', () => {
  it('envia weekday e daypart na ordem canônica', () => {
    const params = mapFiltersToQueryParams(
      makeCatalogFilters({ weekdays: ['domingo', 'sexta'], dayparts: ['noite'] }),
    );
    expect(params.get('weekday')).toBe('sexta,domingo');
    expect(params.get('daypart')).toBe('noite');
  });

  it('omite os parâmetros quando não há seleção', () => {
    const params = mapFiltersToQueryParams(makeCatalogFilters());
    expect(params.has('weekday')).toBe(false);
    expect(params.has('daypart')).toBe(false);
  });
});

describe('contagem de filtros ativos (E8)', () => {
  it('cada dia e cada faixa conta como um filtro', () => {
    expect(activeCatalogFiltersCount(makeCatalogFilters({ weekdays: ['sexta', 'sábado'] }))).toBe(2);
    expect(
      activeCatalogFiltersCount(makeCatalogFilters({ weekdays: ['sexta'], dayparts: ['noite'] })),
    ).toBe(2);
  });

  it('dia e faixa tornam o estado "com filtro ativo"', () => {
    expect(hasActiveCatalogFilters(makeCatalogFilters({ weekdays: ['sexta'] }))).toBe(true);
    expect(hasActiveCatalogFilters(makeCatalogFilters({ dayparts: ['manha'] }))).toBe(true);
    expect(hasActiveCatalogFilters(makeCatalogFilters())).toBe(false);
  });
});
