import { describe, expect, it } from 'vitest';
import { applyParserPreview, buildStateFromPreview } from './previewMerge';
import { createDefaultEditorState } from '../hooks/useTableEditor';
import type { TableEditorState } from '../types';

/**
 * Achado Codex (PR #286): "Colar anúncio" com o formulário já preenchido
 * substituía o estado inteiro pela prévia mesclada sobre os DEFAULTS, apagando
 * em silêncio tudo que o parser não reconhecesse.
 *
 * O detalhe que torna o caso traiçoeiro: `mapApiToEditorState` preenche TODA
 * chave do estado (string vazia, array vazio, `false`, defaults como
 * 'gratuita'), então um spread cru sobrescreve o formulário do mesmo jeito —
 * não existe chave `undefined` para "pular". Estes testes fixam a regra real:
 * só valor efetivamente extraído pelo parser sobrescreve.
 */
function filled(overrides: Partial<TableEditorState> = {}): TableEditorState {
  return {
    ...createDefaultEditorState(),
    title: 'Título que o mestre digitou',
    description: 'Descrição escrita à mão pelo mestre, longa o suficiente.',
    bannerUrl: 'https://cdn.exemplo/banner.png',
    city: 'Palmas',
    contacts: [
      { channel: 'whatsapp', value: '+5563992681119', label: 'Zap', discord_server_url: '' },
    ],
    requiresPc: true,
    ddal: {
      is_ddal: true,
      ddal_code: 'DDAL05-01',
      ddal_name: 'Treasure of the Broken Hoard',
      ddal_tier: '1',
      ddal_season: 'Season 5',
      ddal_duration: '4h',
      ddal_format: 'modulo',
      ddal_org_code: 'CCC-BMG-01',
      ddal_setting: 'Forgotten Realms',
      ddal_rules_notes: 'Notas do mestre',
    },
    ...overrides,
  };
}

describe('buildStateFromPreview — prévia do parser não apaga o que o mestre preencheu', () => {
  it('campo que o parser NÃO reconheceu preserva o valor atual', () => {
    // Objeto do parser com uma única chave: é assim que a rota responde —
    // `data.table` só carrega o que a engine extraiu.
    const current = filled();

    const merged = buildStateFromPreview({ title: 'Título extraído do anúncio' }, current);

    expect(merged.title).toBe('Título extraído do anúncio');
    // Nada disso veio no texto colado — tem de sobreviver.
    expect(merged.description).toBe(current.description);
    expect(merged.bannerUrl).toBe(current.bannerUrl);
    expect(merged.city).toBe('Palmas');
    expect(merged.contacts).toEqual(current.contacts);
  });

  it('default do mapper não vence o que já estava no formulário', () => {
    // price_type ausente → o mapper emite 'gratuita' por default. Isso não é
    // extração: não pode rebaixar uma mesa que o mestre marcou como paga.
    const current = filled({ priceType: 'paga', priceValue: '55' });

    const merged = buildStateFromPreview({ title: 'Mesa' }, current);

    expect(merged.priceType).toBe('paga');
    expect(merged.priceValue).toBe('55');
  });

  it('boolean ausente na fonte não desmarca opção do mestre', () => {
    // requires_pc ausente → booleanValue devolve false, indistinguível de
    // "não reconheci". Desmarcar por engano é pior que não marcar.
    const merged = buildStateFromPreview({ title: 'Mesa' }, filled({ requiresPc: true }));

    expect(merged.requiresPc).toBe(true);
  });

  it('bloco ddal vazio não apaga o DDAL preenchido', () => {
    const current = filled();

    const merged = buildStateFromPreview({ title: 'Mesa' }, current);

    expect(merged.ddal).toEqual(current.ddal);
  });

  it('bloco ddal mescla campo a campo — o extraído entra, o resto fica', () => {
    const current = filled();

    const merged = buildStateFromPreview({ ddal_code: 'DDAL10-02' }, current);

    expect(merged.ddal.ddal_code).toBe('DDAL10-02');
    expect(merged.ddal.ddal_name).toBe('Treasure of the Broken Hoard');
    expect(merged.ddal.is_ddal).toBe(true);
  });

  it('valor EXPLÍCITO igual ao default do mapper sobrescreve o formulário', () => {
    // Achado CodeRabbit (PR #286): comparar com o mapeamento de uma fonte vazia
    // confundia "o parser achou 'gratuita'" com "o mapper preencheu 'gratuita'".
    // A fonte traz price_type de propósito — tem de rebaixar a mesa paga.
    const current = filled({ priceType: 'paga', priceValue: '55' });

    const merged = buildStateFromPreview({ price_type: 'gratuita' }, current);

    expect(merged.priceType).toBe('gratuita');
  });

  it('boolean EXPLÍCITO false na fonte desmarca a opção', () => {
    // `false` que veio do parser vale; `false` que o mapper inventou para uma
    // chave ausente, não (caso coberto pelo teste "boolean ausente"). A
    // sondagem distingue os dois: trocar `requires_pc` por `true` muda o campo,
    // provando que a chave o alimenta.
    const merged = buildStateFromPreview({ requires_pc: false }, filled({ requiresPc: true }));

    expect(merged.requiresPc).toBe(false);
  });

  it('lista vazia da prévia não apaga contatos já preenchidos', () => {
    const current = filled();

    const merged = buildStateFromPreview({ title: 'Mesa', contacts: [] }, current);

    expect(merged.contacts).toEqual(current.contacts);
  });

  it('lista extraída SOBRESCREVE a atual (o parser achou contatos de verdade)', () => {
    const merged = buildStateFromPreview({
      contacts: [{ channel: 'discord', value: 'mestre#1234' }],
    }, filled());

    expect(merged.contacts).toHaveLength(1);
    expect(merged.contacts[0]).toMatchObject({ channel: 'discord', value: 'mestre#1234' });
  });

  it('F2 (spec 096, T6.6): a fonte lê `schedules` — a chave `sessions` do contrato antigo nunca existiu e não alimenta nada', () => {
    // A correção T3.1 (spec 096) fez o mapper ler `schedules` (o que o
    // backend devolve desde o GM panel). A fixture fixa o contrato ATUAL:
    // fonte com `schedules` alimenta o horário; fonte com `sessions` (bug
    // histórico) cai no default — nada é lido de lá.
    const current = filled();

    const withSchedules = buildStateFromPreview({
      schedules: [{
        day_of_week: 'sexta',
        start_time: '20:30',
        frequency: 'quinzenal',
        is_ongoing: false,
        sort_order: 0,
      }],
    }, current);

    expect(withSchedules.schedules[0].day_of_week).toBe('sexta');
    expect(withSchedules.schedules[0].start_time).toBe('20:30');
    expect(withSchedules.schedules[0].frequency).toBe('quinzenal');

    const withSessionsOnly = buildStateFromPreview({
      // Nome do contrato ANTIGO do wizard (mapTableApiToInitialData:86) —
      // o backend nunca devolveu esta chave; o parser novo não a lê.
      sessions: [{ day_of_week: 'sabado', start_time: '10:00', frequency: 'mensal' }],
    }, current);

    expect(withSessionsOnly.schedules[0].day_of_week).toBe(current.schedules[0].day_of_week);
  });
});

describe('applyParserPreview (Fase 6, T6.2) — prévia + campos que a fonte produziu', () => {
  it('devolve os campos extraídos para a marca visual "Pelo anúncio"', () => {
    const current = filled();

    const { state, extractedFields } = applyParserPreview(
      { title: 'Título do anúncio', price_type: 'paga', price_value: 40 },
      current,
    );

    expect(state.title).toBe('Título do anúncio');
    expect(state.priceType).toBe('paga');
    expect(state.priceValue).toBe('40');
    expect(extractedFields).toContain('title');
    expect(extractedFields).toContain('priceType');
    expect(extractedFields).toContain('priceValue');
    // O que a fonte NÃO trouxe não entra na lista de marcas.
    expect(extractedFields).not.toContain('description');
  });

  it('chaves de sinal (_*/missing_fields/raw_system_hint) não alimentam nenhum campo do estado', () => {
    const current = filled();
    const { extractedFields } = applyParserPreview(
      {
        title: 'Mesa',
        missing_fields: ['day_of_week'],
        _price_ambiguity: true,
        _schedule_ambiguity: true,
        _slots_ambiguity: { first: 2, second: 5, source: 'x_slash_y' },
        raw_system_hint: 'Xyz',
      },
      current,
    );

    expect(extractedFields).toContain('title');
    for (const field of extractedFields) {
      expect(['missing_fields', '_price_ambiguity', '_schedule_ambiguity', '_slots_ambiguity', 'raw_system_hint']).not.toContain(field);
    }
  });
});
