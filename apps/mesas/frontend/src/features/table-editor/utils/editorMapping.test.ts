import { describe, it, expect } from 'vitest';
import {
  editorStateToPayload,
  mapApiToEditorState,
  mapGmMeToSnapshot,
  toProfileContactMethods,
  normalizePriceType,
  parsePriceValue,
  parseClearablePriceValue,
} from './editorMapping';
import { createDefaultEditorState } from '../hooks/useTableEditor';
import type { TableEditorState } from '../types';

/**
 * Fixture completa do estado real (tsconfig.test.json type-checka o arquivo
 * inteiro — o estado precisa satisfazer TableEditorState de verdade, mesma
 * regra do mapper.test.ts do fluxo antigo).
 */
function makeState(overrides: Partial<TableEditorState> = {}): TableEditorState {
  return {
    ...createDefaultEditorState(),
    ...overrides,
  };
}

function payloadOf(state: TableEditorState): Record<string, unknown> {
  return editorStateToPayload(state) as Record<string, unknown>;
}

// T7.2b2 (spec 096): `price_frequency` tinha leitor (`tableViewMapper.ts`),
// escritor (`gmPanel.ts:1046`) e exibição pública ("/ sessão" ao lado do preço
// em `TableActionPanel.tsx`) — e nenhum ponto de entrada no editor. A ida e a
// volta precisam fechar, senão editar uma mesa apagaria a periodicidade salva.
describe('editorStateToPayload/mapApiToEditorState — periodicidade (T7.2b2)', () => {
  it('mesa paga leva a periodicidade escolhida ao payload', () => {
    const payload = payloadOf(makeState({ priceType: 'paga', priceValue: '30', priceFrequency: 'mes' }));
    expect(payload.price_frequency).toBe('mes');
  });

  it('mesa paga sem periodicidade declarada manda null (estado legítimo)', () => {
    const payload = payloadOf(makeState({ priceType: 'paga', priceValue: '30', priceFrequency: '' }));
    expect(payload.price_frequency).toBeNull();
  });

  it('mesa gratuita força null, mesmo com resíduo no state', () => {
    const payload = payloadOf(makeState({ priceType: 'gratuita', priceFrequency: 'sessao' }));
    expect(payload.price_frequency).toBeNull();
  });

  it('a volta lê price_frequency da API para o state do editor', () => {
    const state = mapApiToEditorState({ price_type: 'paga', price_frequency: 'campanha' });
    expect(state.priceFrequency).toBe('campanha');
  });

  it('a volta trata price_frequency ausente/null como não informado', () => {
    expect(mapApiToEditorState({ price_type: 'paga' }).priceFrequency).toBe('');
    expect(mapApiToEditorState({ price_type: 'paga', price_frequency: null }).priceFrequency).toBe('');
  });

  // Achado real (review PR #289, inline): a leitura usava `stringValue`, que
  // aceita QUALQUER string e converte número/booleano em texto. Valor fora do
  // enum atravessava o editor e só era recusado pelo `z.enum` do backend, como
  // 400 na hora de publicar — erro longe da causa.
  it.each([
    ['string fora do enum', 'trimestral'],
    ['número', 30],
    ['booleano', true],
    ['objeto', { periodo: 'mes' }],
  ])('normaliza price_frequency inválido (%s) para não informado', (_label, value) => {
    const state = mapApiToEditorState({ price_type: 'paga', price_frequency: value });
    expect(state.priceFrequency).toBe('');
  });

  it('valor inválido vindo da API não vira price_frequency no payload', () => {
    const loaded = mapApiToEditorState({ price_type: 'paga', price_frequency: 'trimestral' });
    const payload = payloadOf(makeState({ ...loaded, priceType: 'paga', priceValue: '30' }));
    expect(payload.price_frequency).toBeNull();
  });

  // Ida e volta: editar uma mesa paga e salvar sem tocar no campo preserva o
  // valor que estava no banco — é o que impede a entrada nova de virar perda.
  it('round-trip preserva a periodicidade salva', () => {
    const loaded = mapApiToEditorState({ price_type: 'paga', price_value: 30, price_frequency: 'sessao' });
    const payload = payloadOf(makeState({ ...loaded, priceType: 'paga', priceValue: '30' }));
    expect(payload.price_frequency).toBe('sessao');
  });
});

describe('editorStateToPayload — regras do mapper que sobrevivem (T4.0f)', () => {
  it("'' zera × undefined preserva: price_value_monthly vazio vira null; ausente omite; não numérico omite (guard Number.isFinite)", () => {
    const empty = payloadOf(makeState({ priceType: 'paga', priceValueMonthly: '' }));
    expect(empty.price_value_monthly).toBeNull();

    const absent = payloadOf(makeState({ priceType: 'paga', priceValueMonthly: undefined }));
    expect('price_value_monthly' in absent).toBe(false);

    const junk = payloadOf(makeState({ priceType: 'paga', priceValueMonthly: 'abc' }));
    expect('price_value_monthly' in junk).toBe(false);
  });

  it('preço avulso não numérico é omitido (NaN serializaria como null e limparia o campo)', () => {
    const payload = payloadOf(makeState({ priceType: 'paga', priceValue: 'abc' }));
    expect('price_value' in payload).toBe(false);
  });

  it('contatos vazios filtrados e discord_server_url só entra se preenchido', () => {
    const payload = payloadOf(
      makeState({
        contacts: [
          { channel: 'whatsapp', value: '+5511999999999', label: '', discord_server_url: '' },
          { channel: 'discord', value: '', label: '', discord_server_url: '' },
          {
            channel: 'discord',
            value: '@usuario',
            label: 'Organização',
            discord_server_url: '  https://discord.gg/abc  ',
          },
        ],
      }),
    );
    const contacts = payload.contacts as Array<Record<string, unknown>>;
    expect(contacts).toHaveLength(2);
    expect(contacts[0]).toMatchObject({
      channel: 'whatsapp',
      value: '+5511999999999',
    });
    expect('discord_server_url' in contacts[0]).toBe(true);
    expect(contacts[0].discord_server_url).toBeUndefined();
    expect(contacts[1].discord_server_url).toBe('https://discord.gg/abc');
  });

  it('slots_per_session NÃO entra no payload (removido por R20)', () => {
    const payload = payloadOf(makeState());
    expect(JSON.stringify(payload)).not.toContain('slots_per_session');
  });

  it('notes de sessão omitido quando vazio', () => {
    const payload = payloadOf(makeState());
    const schedules = payload.schedules as Array<Record<string, unknown>>;
    expect('notes' in schedules[0]).toBe(false);
  });

  it('payload NÃO carrega status — promoção é contrato do PATCH /gm/tables/:id/status (T4.7)', () => {
    const payload = editorStateToPayload(makeState());
    expect('status' in payload).toBe(false);
  });
});

describe('editorStateToPayload — horário único (T4.0u)', () => {
  it('dia e horário definidos → uma linha, statuses defined', () => {
    const payload = payloadOf(makeState());
    expect(payload.schedule_day_status).toBe('defined');
    expect(payload.schedule_time_status).toBe('defined');
    expect(payload.schedules).toHaveLength(1);
    const row = (payload.schedules as Array<Record<string, unknown>>)[0];
    expect(row.day_of_week).toBe('segunda');
    expect(row.start_time).toBe('19:00');
  });

  it('"horário personalizado" → schedule_day_status to_define + texto em table_schedules.notes (sem coluna nova)', () => {
    const payload = payloadOf(
      makeState({
        isPersonalizedSchedule: true,
        schedules: [{
          day_of_week: 'segunda',
          start_time: '19:00',
          frequency: 'semanal',
          is_ongoing: false,
          notes: 'Quinzenal, alternando sábado e domingo, combinado no grupo.',
          sort_order: 0,
        }],
      }),
    );
    expect(payload.schedule_day_status).toBe('to_define');
    expect(payload.schedule_time_status).toBe('to_define');
    const row = (payload.schedules as Array<Record<string, unknown>>)[0];
    expect(row.notes).toBe('Quinzenal, alternando sábado e domingo, combinado no grupo.');
    // NOT NULL no banco: a linha carrega valor real de placeholder — o card
    // decide pelo status da tabela, não pelo dia da linha.
    expect(row.day_of_week).toBe('segunda');
  });

  it('dia "a definir" → sem linhas e status to_define (contrato do mapper antigo)', () => {
    const payload = payloadOf(
      makeState({
        schedules: [{
          day_of_week: 'to_define',
          start_time: '19:00',
          frequency: 'semanal',
          is_ongoing: false,
          notes: '',
          sort_order: 0,
        }],
      }),
    );
    expect(payload.schedule_day_status).toBe('to_define');
    expect(payload.schedule_time_status).toBe('defined');
    expect(payload.schedules).toHaveLength(0);
    // O eixo DEFINIDO conserva o valor: antes os dois hints iam a `null` e o
    // horario que o mestre digitou sumia do payload — o anuncio saia sem ele
    // (achado Codex P2, PR #300). O eixo `to_define` continua nulo, que e o
    // que o refine do backend exige.
    expect(payload.schedule_time_hint).toBe('19:00');
    expect(payload.schedule_day_hint).toBeNull();
  });

  it('mesa legada com 2+ horários: a lista inteira é preservada no payload (nunca apagar o que não se mostra)', () => {
    const payload = payloadOf(
      makeState({
        schedules: [
          { day_of_week: 'segunda', start_time: '19:00', frequency: 'semanal', is_ongoing: false, notes: '', sort_order: 0 },
          { day_of_week: 'quarta', start_time: '20:00', end_time: '23:00', frequency: 'semanal', is_ongoing: false, notes: 'Mesa antiga', sort_order: 1 },
        ],
      }),
    );
    const rows = payload.schedules as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].day_of_week).toBe('segunda');
    expect(rows[1]).toMatchObject({ day_of_week: 'quarta', start_time: '20:00', end_time: '23:00', notes: 'Mesa antiga', sort_order: 1 });
  });
});

describe('editorStateToPayload — campos e condicionais', () => {
  it('age_rating/table_level vazios omitem (create cai no DEFAULT; PUT preserva o salvo)', () => {
    const payload = payloadOf(makeState({ ageRating: '', tableLevel: '' }));
    expect('age_rating' in payload).toBe(false);
    expect('table_level' in payload).toBe(false);
  });

  it('age_rating preenchida entra (T3.2)', () => {
    const payload = payloadOf(makeState({ ageRating: '+18', tableLevel: 'avancado' }));
    expect(payload.age_rating).toBe('+18');
    expect(payload.table_level).toBe('avancado');
  });

  it('gratuita zera preços e carrega doações; paga zera doações e carrega preços (por modalidade)', () => {
    const free = payloadOf(
      makeState({ priceType: 'gratuita', acceptsDonations: true, suggestedDonationValue: '10' }),
    );
    expect(free.price_value).toBeNull();
    expect(free.price_value_monthly).toBeNull();
    expect(free.accepts_donations).toBe(true);
    expect(free.suggested_donation_value).toBe(10);

    const paid = payloadOf(makeState({ priceType: 'paga', priceValue: '55' }));
    expect(paid.price_value).toBe(55);
    expect(paid.accepts_donations).toBe(false);
    expect(paid.suggested_donation_value).toBeNull();
  });

  it('DDAL: os 9 campos só entram quando o selo está marcado', () => {
    const off = payloadOf(makeState({ ddal: { ...createDefaultEditorState().ddal, is_ddal: false, ddal_code: 'DDAL05-01' } }));
    expect('ddal_code' in off).toBe(false);

    const on = payloadOf(
      makeState({
        ddal: {
          is_ddal: true,
          ddal_code: 'DDAL05-01',
          ddal_name: 'Treasure of the Broken Hoard',
          ddal_tier: '1',
          ddal_season: 'Season 10',
          ddal_duration: '4h',
          ddal_format: 'modulo',
          ddal_org_code: 'CCC-BMG-01',
          ddal_setting: 'Forgotten Realms',
          ddal_rules_notes: '',
        },
      }),
    );
    expect(on.ddal_code).toBe('DDAL05-01');
    expect(on.ddal_tier).toBe(1);
    expect(on.ddal_format).toBe('modulo');
  });

  it('C3: parse_case_id viaja SÓ no payload de publish (includeParseCaseId); autosave omite', () => {
    // Autosave (default): o id do preview NÃO é reenviado a cada 2,5s de
    // digitação — contradiz o contrato de types.ts:163-168 (reenviado no
    // submit; limpo ao restaurar senão contamina discord_parse_cases).
    const autosave = payloadOf(makeState({ parseCaseId: 'case-1' }));
    expect('parse_case_id' in autosave).toBe(false);

    // Publish: fecha o loop de aprendizado do parser (Requisito 8, spec 079).
    const publish = editorStateToPayload(
      makeState({ parseCaseId: 'case-1' }),
      { includeParseCaseId: true },
    ) as Record<string, unknown>;
    expect(publish.parse_case_id).toBe('case-1');

    // Sem id (ou null), nem o publish envia a chave.
    const publishWithout = editorStateToPayload(
      makeState({ parseCaseId: null }),
      { includeParseCaseId: true },
    ) as Record<string, unknown>;
    expect('parse_case_id' in publishWithout).toBe(false);
  });

  it('anunciante envia actual_gm_name; mestre envia null', () => {
    const announcer = payloadOf(makeState({ publisherRole: 'announcer', actualGmName: 'Mestre Arandur' }));
    expect(announcer.actual_gm_name).toBe('Mestre Arandur');
    const gm = payloadOf(makeState({ publisherRole: 'gm', actualGmName: 'Mestre Arandur' }));
    expect(gm.actual_gm_name).toBeNull();
  });

  it('VTT custom envia game_platform_custom e omite vtt_platform_id', () => {
    const payload = payloadOf(
      makeState({ vttPlatformId: 'custom', gamePlatformCustom: 'Teatro da Mente' }),
    );
    expect(payload.game_platform_custom).toBe('Teatro da Mente');
    expect('vtt_platform_id' in payload).toBe(false);
  });

  it('campos do corte (§Gap 8) nunca entram no payload', () => {
    const payload = payloadOf(makeState());
    // `table_gm_bio` saiu deste corte na T4.0p (A19): o campo da bio do mestre
    // entrou no editor e entra no payload quando EDITADO — a omissão por
    // herança tem regra própria (describe abaixo).
    expect(JSON.stringify(payload)).not.toMatch(
      /"synopsis"|"synopsis_narrative"|"style_text"|"listing_excerpt"|"benefits_text"/,
    );
  });
});

describe('editorStateToPayload — herança do perfil (T4.0p, A19)', () => {
  it('omitInherited com masterDisplayName/tableGmBio OMITE as chaves de verdade', () => {
    const state = makeState({
      publisherRole: 'gm',
      masterDisplayName: 'Mestre Corvo',
      tableGmBio: 'Bio herdada do perfil.',
    });
    const payload = editorStateToPayload(state, {
      omitInherited: new Set(['masterDisplayName', 'tableGmBio']),
    }) as Record<string, unknown>;
    expect('master_display_name' in payload).toBe(false);
    expect('table_gm_bio' in payload).toBe(false);
  });

  it('sem omitInherited, campos preenchidos entram normalmente (mestre editou)', () => {
    const payload = payloadOf(
      makeState({
        publisherRole: 'gm',
        masterDisplayName: 'Outro Nome',
        tableGmBio: 'Bio desta mesa.',
      }),
    );
    expect(payload.master_display_name).toBe('Outro Nome');
    expect(payload.table_gm_bio).toBe('Bio desta mesa.');
  });

  it('campos herdados vazios nunca materializam no payload (ausente preserva no PUT)', () => {
    const payload = payloadOf(makeState({ publisherRole: 'gm', masterDisplayName: '', tableGmBio: '' }));
    expect('master_display_name' in payload).toBe(false);
    expect('table_gm_bio' in payload).toBe(false);
  });

  it('contatos NÃO têm omissão por herança: sempre entram no payload', () => {
    // A mesa pública não tem fallback de contatos para o perfil
    // (tableViewMapper lê só table_contacts) — os contatos pré-carregados do
    // perfil são gravados na mesa no publish (T4.0p, fecha o elo perfil→mesa).
    const payload = payloadOf(
      makeState({
        contacts: [{ channel: 'discord', value: '@herdado', label: '', discord_server_url: '' }],
      }),
    );
    expect(payload.contacts).toHaveLength(1);
  });
});

describe('toProfileContactMethods — contatos para POST/PUT /gm/profile (T4.0p2/T4.0q)', () => {
  it('filtra linhas vazias, trima e converte label vazio em null', () => {
    const result = toProfileContactMethods([
      { channel: 'whatsapp', value: ' +5511999999999 ', label: ' Zap ', discord_server_url: '' },
      { channel: 'discord', value: '', label: '', discord_server_url: '' },
      {
        channel: 'discord',
        value: '@usuario',
        label: '  ',
        discord_server_url: ' https://discord.gg/abc ',
      },
    ]);
    expect(result).toEqual([
      { channel: 'whatsapp', value: '+5511999999999', label: 'Zap' },
      {
        channel: 'discord',
        value: '@usuario',
        label: null,
        discord_server_url: 'https://discord.gg/abc',
      },
    ]);
  });

  it('omite discord_server_url quando vazio (serializer do perfil não grava ausente)', () => {
    const result = toProfileContactMethods([
      { channel: 'email', value: 'mestre@example.com', label: '', discord_server_url: '' },
    ]);
    expect(result[0]).toEqual({ channel: 'email', value: 'mestre@example.com', label: null });
    expect('discord_server_url' in result[0]).toBe(false);
  });
});

describe('mapGmMeToSnapshot — GET /gm/me para o snapshot de herança (T4.0p/T6.4)', () => {
  it('normaliza nickname/bio/contatos com shape real do backend', () => {
    const snapshot = mapGmMeToSnapshot({
      id: 'p-1',
      slug: 'mestre-corvo',
      nickname: 'Mestre Corvo',
      bio_long: 'Bio longa do perfil.',
      contact_methods: [
        { channel: 'whatsapp', value: '+5511999999999', label: 'Zap' },
        { channel: 'discord', value: '@usuario' },
      ],
    });
    expect(snapshot).toEqual({
      nickname: 'Mestre Corvo',
      bioLong: 'Bio longa do perfil.',
      contactMethods: [
        { channel: 'whatsapp', value: '+5511999999999', label: 'Zap', discord_server_url: '' },
        { channel: 'discord', value: '@usuario', label: '', discord_server_url: '' },
      ],
      // Fase 6 (T6.4): campos de herança novos — ausentes viram listas vazias.
      preferredVttPlatforms: [],
      languages: [],
      // Spec 099 B10: campos crus da prévia do perfil — ausentes viram null
      // (id/slug vêm do input, já validados como string por mapGmMeToSnapshot).
      id: 'p-1',
      slug: 'mestre-corvo',
      avatar_url: null,
      avatar_crop_data: null,
      avatar_width: null,
      avatar_height: null,
      banner_url: null,
      banner_crop_data: null,
      banner_width: null,
      banner_height: null,
      tagline: null,
      promo_badge_text: null,
      covil_verified: null,
      experience_years: null,
      created_at: null,
      tables_count: null,
      // Foto do perfil geral: null quando o GET nao devolve o campo (so vem
      // quando o mestre nao tem foto propria).
      general_avatar: null,
    });
  });

  it('Fase 6 (T6.4): normaliza preferred_vtt_platforms e languages — entradas não-string saem', () => {
    const snapshot = mapGmMeToSnapshot({
      id: 'p-1',
      slug: 'mestre-corvo',
      nickname: 'Mestre Corvo',
      bio_long: null,
      preferred_vtt_platforms: ['vtt-uuid-1', 42, null],
      languages: ['pt-BR', 'en', 7],
    });
    expect(snapshot?.preferredVttPlatforms).toEqual(['vtt-uuid-1']);
    expect(snapshot?.languages).toEqual(['pt-BR', 'en']);
  });

  it('Fase 6 (T6.4): apara espaço e descarta vazio — "" não vira plataforma herdada em branco', () => {
    const snapshot = mapGmMeToSnapshot({
      id: 'p-1',
      slug: 'mestre-corvo',
      nickname: 'Mestre Corvo',
      bio_long: null,
      preferred_vtt_platforms: ['', '   ', '  vtt-uuid-1  '],
      languages: ['  pt-BR  ', '', '\t'],
    });
    expect(snapshot?.preferredVttPlatforms).toEqual(['vtt-uuid-1']);
    expect(snapshot?.languages).toEqual(['pt-BR']);
  });

  it('Fase 6 (T6.4): campo não-array devolve lista vazia (nunca propaga o valor inválido)', () => {
    const snapshot = mapGmMeToSnapshot({
      id: 'p-1',
      slug: 'mestre-corvo',
      nickname: 'Mestre Corvo',
      bio_long: null,
      preferred_vtt_platforms: 'vtt-uuid-1',
      languages: { 0: 'pt-BR' },
    });
    expect(snapshot?.preferredVttPlatforms).toEqual([]);
    expect(snapshot?.languages).toEqual([]);
  });

  it('Spec 099 B10: carrega os campos crus da prévia do perfil com leitura defensiva', () => {
    const snapshot = mapGmMeToSnapshot({
      id: 'p-1',
      slug: 'mestre-corvo',
      nickname: 'Mestre Corvo',
      bio_long: null,
      avatar_url: 'https://cdn.example/avatar.png',
      avatar_crop_data: { x: 0.5, y: 0.2, width: 0.4, height: 0.4 },
      avatar_width: 800,
      avatar_height: 600,
      banner_url: 'https://cdn.example/banner.png',
      banner_crop_data: { x: 0, y: 0, width: 1, height: 1 },
      banner_width: 1600,
      banner_height: 400,
      tagline: 'Aventuras épicas toda quinta',
      promo_badge_text: 'Campanha nova em janeiro',
      covil_verified: true,
      experience_years: 14,
      created_at: '2024-01-01T00:00:00Z',
      tables_count: 3,
    });
    expect(snapshot?.avatar_url).toBe('https://cdn.example/avatar.png');
    expect(snapshot?.avatar_crop_data).toEqual({ x: 0.5, y: 0.2, width: 0.4, height: 0.4 });
    expect(snapshot?.banner_crop_data).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(snapshot?.tagline).toBe('Aventuras épicas toda quinta');
    expect(snapshot?.covil_verified).toBe(true);
    expect(snapshot?.experience_years).toBe(14);
    expect(snapshot?.tables_count).toBe(3);
  });

  it('Spec 099 B10: campo da prévia fora do tipo vira null (nunca propaga valor inválido)', () => {
    const snapshot = mapGmMeToSnapshot({
      id: 'p-1',
      slug: 'mestre-corvo',
      nickname: 'Mestre Corvo',
      bio_long: null,
      avatar_url: 42,
      avatar_crop_data: { x: 'nope' },
      avatar_width: '800',
      banner_url: null,
      tagline: 7,
      covil_verified: 'sim',
      experience_years: '14',
      created_at: 2024,
      tables_count: '3',
    });
    expect(snapshot?.avatar_url).toBeNull();
    expect(snapshot?.avatar_crop_data).toBeNull();
    expect(snapshot?.avatar_width).toBeNull();
    expect(snapshot?.tagline).toBeNull();
    expect(snapshot?.covil_verified).toBeNull();
    expect(snapshot?.experience_years).toBeNull();
    expect(snapshot?.created_at).toBeNull();
    expect(snapshot?.tables_count).toBeNull();
  });

  it('devolve null quando não é perfil (id/slug ausentes)', () => {
    expect(mapGmMeToSnapshot(null)).toBeNull();
    expect(mapGmMeToSnapshot({ nickname: 'x' })).toBeNull();
    expect(mapGmMeToSnapshot({})).toBeNull();
  });

  it('canal fora do enum não vaza; contato estruturalmente inválido é filtrado', () => {
    const snapshot = mapGmMeToSnapshot({
      id: 'p-1',
      slug: 'mestre',
      nickname: 'Mestre',
      bio_long: null,
      contact_methods: [
        { channel: 'telegram', value: '@x' }, // fora dos 7
        { channel: 'discord' }, // sem value
        { channel: 'email', value: 'mestre@example.com', label: null, discord_server_url: null },
      ],
    });
    expect(snapshot?.contactMethods).toEqual([
      { channel: 'email', value: 'mestre@example.com', label: '', discord_server_url: '' },
    ]);
    expect(snapshot?.nickname).toBe('Mestre');
    expect(snapshot?.bioLong).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mapApiToEditorState — a ENTRADA (resposta real de GET /gm/tables/:id).
// Campos snake_case da API → estado camelCase do editor, com normalizadores
// na fronteira: valor inesperado fora do enum não vaza (PR #285).
// ─────────────────────────────────────────────────────────────────────────────

/** Resposta real de GET /api/v1/gm/tables/:id (contrato snake_case). */
function makeApiTableResponse(): Record<string, unknown> {
  return {
    id: 't-42',
    slug: 'masmorra-de-vecna',
    status: 'active',
    title: 'A Masmorra de Vecna',
    description: 'Uma campanha épica pelo multiverso de D&D.',
    age_rating: '+16',
    table_level: 'avancado',
    experience_level: 'intermediario',
    type: 'campanha',
    audience: 'maioridade',
    language: 'pt-BR',
    modality: 'online',
    vtt_platform_id: 'roll20',
    communication_platform_id: 'discord-uuid',
    requires_pc: true,
    requires_camera: false,
    requires_microphone: true,
    city: 'São Paulo',
    state: 'SP',
    price_type: 'paga',
    price_value: 55,
    price_value_monthly: 180,
    accepts_donations: false,
    billing_text: 'Pagamento via PIX.',
    session_zero_free: true,
    slots_total: 5,
    slots_open: 3,
    system_id: 'sys-1',
    scenario_id: 'scen-2',
    setting_name: 'Forgotten Realms',
    setting_styles: ['dark fantasy', 'sandbox'],
    rules_notes: 'Sem PvP entre jogadores.',
    banner_url: 'https://cdn.example.com/banner.jpg',
    banner_crop_data: { x: 0, y: 10, width: 800, height: 400 },
    banner_width: 1600,
    banner_height: 800,
    is_covil: true,
    is_ddal: true,
    ddal_code: 'DDAL05-01',
    ddal_name: 'Treasure of the Broken Hoard',
    ddal_tier: '1',
    ddal_season: 'Season 10',
    ddal_duration: '4h',
    ddal_format: 'modulo',
    ddal_org_code: 'CCC-BMG-01',
    ddal_setting: 'Forgotten Realms',
    ddal_rules_notes: 'Sem homebrew.',
    content_warnings: ['violencia', 'horror'],
    safety_tools: ['x-card', 'linhas-e-veus'],
    publisher_role: 'announcer',
    actual_gm_name: 'Mestre Arandur',
    master_display_name: 'Arandur',
    campaign_length: 'longa',
    level_range: '1-5',
    technical_requirements: 'Microfone obrigatório.',
    contacts: [
      { channel: 'whatsapp', value: '+5511999999999', label: 'Zap' },
      {
        channel: 'discord',
        value: '@usuario',
        label: 'Organização',
        discord_server_url: 'https://discord.gg/abc',
      },
    ],
    schedules: [
      {
        day_of_week: 'quarta',
        start_time: '20:30:00',
        end_time: '23:30:00',
        frequency: 'semanal',
        is_ongoing: true,
        notes: 'Pontual',
        sort_order: 1,
      },
      {
        day_of_week: 'segunda',
        start_time: '19:00',
        frequency: 'semanal',
        is_ongoing: false,
        sort_order: 0,
      },
    ],
    schedule_day_status: 'defined',
    schedule_time_status: 'defined',
    schedule_day_hint: 'segunda',
    schedule_time_hint: '19:00',
  };
}

describe('mapApiToEditorState — entrada real da API', () => {
  it('mapeia a resposta completa de GET /gm/tables/:id para o estado do editor', () => {
    const state = mapApiToEditorState(makeApiTableResponse());

    expect(state.id).toBe('t-42');
    expect(state.status).toBe('active');
    expect(state.slug).toBe('masmorra-de-vecna');

    expect(state.title).toBe('A Masmorra de Vecna');
    expect(state.description).toBe('Uma campanha épica pelo multiverso de D&D.');
    expect(state.rulesNotes).toBe('Sem PvP entre jogadores.');

    expect(state.ageRating).toBe('+16');
    expect(state.tableLevel).toBe('avancado');
    expect(state.experienceLevel).toBe('intermediario');
    expect(state.type).toBe('campanha');
    expect(state.audience).toBe('maioridade');
    expect(state.language).toBe('pt-BR');

    expect(state.modality).toBe('online');
    expect(state.vttPlatformId).toBe('roll20');
    expect(state.communicationPlatformId).toBe('discord-uuid');
    expect(state.communicationPlatformCustom).toBe('');
    expect(state.requiresPc).toBe(true);
    expect(state.requiresCamera).toBe(false);
    expect(state.requiresMicrophone).toBe(true);
    expect(state.city).toBe('São Paulo');
    expect(state.state).toBe('SP');

    expect(state.priceType).toBe('paga');
    expect(state.priceValue).toBe('55');
    expect(state.priceValueMonthly).toBe('180');
    expect(state.acceptsDonations).toBe(false);
    expect(state.billingText).toBe('Pagamento via PIX.');
    expect(state.sessionZeroFree).toBe(true);

    expect(state.slotsTotal).toBe('5');
    expect(state.slotsOpen).toBe('3');

    expect(state.selectedSystemId).toBe('sys-1');
    expect(state.selectedScenarioId).toBe('scen-2');
    expect(state.settingName).toBe('Forgotten Realms');
    // T4.0g: leitura normaliza para a forma canônica do catálogo (mesma regra
    // que o backend aplica na escrita) — nunca cru como antes.
    expect(state.settingStyles).toEqual(['Dark Fantasy', 'Sandbox']);

    expect(state.bannerUrl).toBe('https://cdn.example.com/banner.jpg');
    expect(state.bannerCropData).toEqual({ x: 0, y: 10, width: 800, height: 400 });
    expect(state.bannerWidth).toBe(1600);
    expect(state.bannerHeight).toBe(800);

    expect(state.isCovil).toBe(true);

    expect(state.ddal!.is_ddal).toBe(true);
    expect(state.ddal!.ddal_code).toBe('DDAL05-01');
    expect(state.ddal!.ddal_tier).toBe('1');
    expect(state.ddal!.ddal_format).toBe('modulo');

    expect(state.contentWarnings).toEqual(['violencia', 'horror']);
    expect(state.safetyTools).toEqual(['x-card', 'linhas-e-veus']);

    expect(state.publisherRole).toBe('announcer');
    expect(state.actualGmName).toBe('Mestre Arandur');
    expect(state.masterDisplayName).toBe('Arandur');
    expect(state.campaignLength).toBe('longa');
    expect(state.levelRange).toBe('1-5');
    expect(state.technicalRequirements).toBe('Microfone obrigatório.');
  });

  it('mapeia contatos preservando label e discord_server_url', () => {
    const state = mapApiToEditorState(makeApiTableResponse());
    expect(state.contacts).toHaveLength(2);
    expect(state.contacts![0]).toMatchObject({
      channel: 'whatsapp',
      value: '+5511999999999',
      label: 'Zap',
    });
    expect(state.contacts![1]).toMatchObject({
      channel: 'discord',
      value: '@usuario',
      label: 'Organização',
      discord_server_url: 'https://discord.gg/abc',
    });
  });

  it('ordena schedules por sort_order e normaliza HH:MM:SS para HH:MM', () => {
    const state = mapApiToEditorState(makeApiTableResponse());
    expect(state.schedules).toHaveLength(2);
    expect(state.schedules!.map((s) => s.day_of_week)).toEqual(['segunda', 'quarta']);
    expect(state.schedules![0].start_time).toBe('19:00');
    expect(state.schedules![1].start_time).toBe('20:30');
    expect(state.schedules![1].end_time).toBe('23:30');
    expect(state.schedules![1].notes).toBe('Pontual');
    expect(state.isPersonalizedSchedule).toBe(false);
  });

  it('contatos estruturalmente inválidos são filtrados, nunca vazam', () => {
    const state = mapApiToEditorState({
      contacts: [
        { channel: 'discord' }, // sem value
        { value: 'só valor' }, // sem channel
        'string-solta', // nem objeto
        { channel: 'email', value: 'mestre@exemplo.com', label: '' },
      ],
    });
    expect(state.contacts).toHaveLength(1);
    expect(state.contacts![0]).toMatchObject({ channel: 'email', value: 'mestre@exemplo.com' });
  });
});

describe('mapApiToEditorState — normalizadores: valor inesperado não vaza (PR #285)', () => {
  it('age_rating fora do enum vira vazio (nunca é reenviada no PUT)', () => {
    expect(mapApiToEditorState({ age_rating: 'Livre' }).ageRating).toBe('');
    expect(mapApiToEditorState({ age_rating: 16 }).ageRating).toBe('');
    expect(mapApiToEditorState({ age_rating: '+99' }).ageRating).toBe('');
    expect(mapApiToEditorState({ age_rating: 'livre' }).ageRating).toBe('livre');
    expect(mapApiToEditorState({ age_rating: '+12' }).ageRating).toBe('+12');
  });

  it('price_type desconhecido cai em gratuita; paid é normalizado para paga', () => {
    expect(mapApiToEditorState({ price_type: 'paid' }).priceType).toBe('paga');
    expect(mapApiToEditorState({ price_type: 'paga' }).priceType).toBe('paga');
    expect(mapApiToEditorState({ price_type: 'banana' }).priceType).toBe('gratuita');
    expect(mapApiToEditorState({}).priceType).toBe('gratuita');
  });

  it('booleanos exigem boolean de verdade; strings/números viram false', () => {
    expect(mapApiToEditorState({ is_covil: 'true' }).isCovil).toBe(false);
    expect(mapApiToEditorState({ requires_pc: 1 }).requiresPc).toBe(false);
    expect(mapApiToEditorState({ is_ddal: 'sim' }).ddal!.is_ddal).toBe(false);
    expect(mapApiToEditorState({ session_zero_free: '1' }).sessionZeroFree).toBe(false);
  });

  it('publisher_role fora do contrato cai em gm', () => {
    expect(mapApiToEditorState({ publisher_role: 'x' }).publisherRole).toBe('gm');
    expect(mapApiToEditorState({ publisher_role: 'announcer' }).publisherRole).toBe('announcer');
  });

  it('arrays exigem array de strings; payloads de outra forma viram []', () => {
    expect(mapApiToEditorState({ content_warnings: 'violencia' }).contentWarnings).toEqual([]);
    expect(mapApiToEditorState({ safety_tools: [1, 'x-card'] }).safetyTools).toEqual(['x-card']);
    expect(mapApiToEditorState({ setting_styles: { a: 1 } }).settingStyles).toEqual([]);
    expect(mapApiToEditorState({ contacts: 'x' }).contacts).toEqual([]);
    expect(mapApiToEditorState({ schedules: 'x' }).schedules).toHaveLength(1); // defaultSession
  });

  it('campo de texto rejeita objeto/array — "[object Object]" não vira conteúdo do mestre', () => {
    // Achado Sonar (PR #286): `String(value)` cru aceitava qualquer coisa, e o
    // resultado é REENVIADO no PUT como se o mestre tivesse digitado (mesmo
    // defeito que normalizeAgeRating corrigiu na PR #285).
    expect(mapApiToEditorState({ title: { pt: 'Mesa' } }).title).toBe('');
    expect(mapApiToEditorState({ description: ['a', 'b'] }).description).toBe('');
    // Número e boolean seguem convertidos: a API devolve slots_total numérico
    // e o estado do editor trabalha com string.
    expect(mapApiToEditorState({ slots_total: 6 }).slotsTotal).toBe('6');
  });

  it('setting_styles: forma canônica na leitura; valor fora do catálogo é preservado (T4.0g)', () => {
    // Grafia do estoque legado normaliza para a forma canônica — a MESMA que
    // o backend aplica na escrita (gmPanel.ts) e o mapper antigo no payload.
    expect(
      mapApiToEditorState({ setting_styles: ['dark fantasy', 'exploracao'] }).settingStyles,
    ).toEqual(['Dark Fantasy', 'Exploracao']);
    // Valor com hífen (slug legado, fora da grafia do catálogo) é PRESERVADO
    // com capitalização canônica — o normalizador ajusta grafia, nunca filtra
    // por "estar no catálogo". Mesa legada não quebra nem perde dado.
    expect(mapApiToEditorState({ setting_styles: ['dark-fantasy'] }).settingStyles).toEqual([
      'Dark-fantasy',
    ]);
    // Dedup APÓS normalizar (mesma regra do pacote e da migration_160): sem
    // isso o estoque regride em chips duplicados na próxima reescrita.
    expect(mapApiToEditorState({ setting_styles: ['Sandbox', 'sandbox'] }).settingStyles).toEqual([
      'Sandbox',
    ]);
    // Entrada não-string dentro do array é ignorada (contrato do pacote).
    expect(mapApiToEditorState({ setting_styles: ['Sandbox', 42, null] }).settingStyles).toEqual([
      'Sandbox',
    ]);
  });

  it('status só entra quando é string', () => {
    expect(mapApiToEditorState({ status: 'draft' }).status).toBe('draft');
    expect(mapApiToEditorState({ status: 5 }).status).toBeUndefined();
  });

  it('dimensões de banner inválidas não viram frame válido (crop exige dimensões)', () => {
    const state = mapApiToEditorState({
      banner_crop_data: { x: 0, y: 0, width: 100, height: 100 },
      banner_width: '1600', // string, não number
      banner_height: 800,
    });
    expect(state.bannerCropData).toBeNull();
    expect(state.bannerWidth).toBeNull();
    expect(state.bannerHeight).toBe(800);
  });
});

describe('mapApiToEditorState — ausência de campos não quebra (defaults)', () => {
  it('payload vazio mapeia para os defaults do estado', () => {
    const state = mapApiToEditorState({});
    expect(state.id).toBeUndefined();
    expect(state.status).toBeUndefined();
    expect(state.slug).toBeUndefined();
    expect(state.title).toBe('');
    expect(state.description).toBe('');
    expect(state.modality).toBe('online');
    expect(state.type).toBe('campanha');
    expect(state.audience).toBe('livre');
    expect(state.language).toBe('pt-BR');
    expect(state.experienceLevel).toBe('todos');
    expect(state.priceType).toBe('gratuita');
    expect(state.slotsTotal).toBe('4');
    expect(state.slotsOpen).toBe('4');
    expect(state.ageRating).toBe('');
    expect(state.publisherRole).toBe('gm');
    expect(state.contacts).toEqual([]);
    expect(state.ddal!.is_ddal).toBe(false);
    expect(state.bannerCropData).toBeNull();
    expect(state.bannerWidth).toBeNull();
  });

  it('fonte que não é objeto devolve {} (sem estado)', () => {
    expect(mapApiToEditorState(null)).toEqual({});
    expect(mapApiToEditorState('string')).toEqual({});
    expect(mapApiToEditorState(42)).toEqual({});
  });

  it('sem schedules cai na sessão default derivada dos hints da tabela', () => {
    const withHints = mapApiToEditorState({
      schedule_day_status: 'defined',
      schedule_time_status: 'defined',
      schedule_day_hint: 'terça',
      schedule_time_hint: '20:00',
    });
    expect(withHints.schedules).toHaveLength(1);
    expect(withHints.schedules![0].day_of_week).toBe('terça');
    expect(withHints.schedules![0].start_time).toBe('20:00');
    expect(withHints.isPersonalizedSchedule).toBe(false);
  });

  it('dia a definir sem linhas vira sessão to_define; com linha vira horário personalizado', () => {
    const flexible = mapApiToEditorState({
      schedule_day_status: 'to_define',
      schedule_time_status: 'to_define',
    });
    expect(flexible.schedules).toHaveLength(1);
    expect(flexible.schedules![0].day_of_week).toBe('to_define');
    expect(flexible.schedules![0].start_time).toBe('');
    expect(flexible.isPersonalizedSchedule).toBe(false);

    const personalized = mapApiToEditorState({
      schedule_day_status: 'to_define',
      schedule_time_status: 'to_define',
      schedules: [
        {
          day_of_week: 'segunda',
          start_time: '19:00',
          frequency: 'semanal',
          is_ongoing: false,
          sort_order: 0,
          notes: 'Quinzenal, combinado no grupo.',
        },
      ],
    });
    expect(personalized.isPersonalizedSchedule).toBe(true);
    expect(personalized.schedules).toHaveLength(1);
  });

  it('comunicação custom: communication_platform sem id vira custom', () => {
    const custom = mapApiToEditorState({ communication_platform: 'Nosso Discord' });
    expect(custom.communicationPlatformId).toBe('custom');
    expect(custom.communicationPlatformCustom).toBe('Nosso Discord');

    const cataloged = mapApiToEditorState({
      communication_platform_id: 'discord-uuid',
      communication_platform: 'Nosso Discord',
    });
    expect(cataloged.communicationPlatformId).toBe('discord-uuid');
    expect(cataloged.communicationPlatformCustom).toBe('');
  });

  it('banner_url ausente cai no fallback image_url (formato antigo)', () => {
    expect(mapApiToEditorState({ image_url: 'https://cdn.example.com/old.jpg' }).bannerUrl).toBe(
      'https://cdn.example.com/old.jpg',
    );
    expect(
      mapApiToEditorState({
        banner_url: 'https://cdn.example.com/new.jpg',
        image_url: 'https://cdn.example.com/old.jpg',
      }).bannerUrl,
    ).toBe('https://cdn.example.com/new.jpg');
  });
});

// ── Normalizadores de preço (T4.8) ─────────────────────────────────────────
// Herdados do mapper do wizard antigo (features/create-table/utils/mapper e
// mapper.test.ts, removidos na T4.8). Os casos via payload já eram cobertos
// por editorStateToPayload acima; aqui ficam os contratos unitários dos três
// helpers exportados, incluindo os casos de auditoria NaN→null.
describe('normalizadores de preço — herança do mapper do wizard (T4.8)', () => {
  describe('normalizePriceType — legado free/paid (achado Codex PR #283)', () => {
    it("'free' vira 'gratuita' (valor fantasma do form antigo; nunca existiu no banco)", () => {
      expect(normalizePriceType('free')).toBe('gratuita');
    });

    it("'paid' (draft antigo em inglês) vira 'paga'", () => {
      expect(normalizePriceType('paid')).toBe('paga');
    });

    it('undefined/null viram gratuita (default do produto)', () => {
      expect(normalizePriceType(undefined)).toBe('gratuita');
      expect(normalizePriceType(null)).toBe('gratuita');
    });

    it('valores atuais passam intactos', () => {
      expect(normalizePriceType('gratuita')).toBe('gratuita');
      expect(normalizePriceType('paga')).toBe('paga');
    });
  });

  describe('parsePriceValue — guard Number.isFinite (auditoria A4, sessão 26-08-22_1)', () => {
    it('string não numérica vira ausente (NaN serializaria como null e limparia o campo)', () => {
      expect(parsePriceValue('abc')).toBeUndefined();
    });

    it('número válido passa como number', () => {
      expect(parsePriceValue('40')).toBe(40);
      expect(parsePriceValue('39.90')).toBe(39.9);
    });

    it('string vazia e indefinido viram ausente', () => {
      expect(parsePriceValue('')).toBeUndefined();
      expect(parsePriceValue(undefined)).toBeUndefined();
    });
  });

  describe('parseClearablePriceValue — auditoria final (sessão 26-08-22_1, achados #1 e #2)', () => {
    it('campo esvaziado vira null (backend zera)', () => {
      expect(parseClearablePriceValue('')).toBeNull();
      expect(parseClearablePriceValue('   ')).toBeNull();
    });

    it('campo indefinido é omitido (backend preserva o salvo)', () => {
      expect(parseClearablePriceValue(undefined)).toBeUndefined();
    });

    it('não numérico é omitido (guard Number.isFinite impede NaN de virar null)', () => {
      expect(parseClearablePriceValue('abc')).toBeUndefined();
    });

    it('número válido passa como number', () => {
      expect(parseClearablePriceValue('40')).toBe(40);
      expect(parseClearablePriceValue('39.90')).toBe(39.9);
    });
  });
});
