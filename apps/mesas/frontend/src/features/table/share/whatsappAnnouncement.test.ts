// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TableDetail } from '../../../types/tables';
import { buildWhatsAppTableAnnouncement, copyTextToClipboard } from './whatsappAnnouncement';
import { deriveSchedule } from '../../table-editor/utils/editorMapping';
import { createDefaultEditorState } from '../../table-editor/hooks/useTableEditor';

function makeTable(overrides: Partial<TableDetail> = {}): TableDetail {
  return {
    id: 'table-1',
    slug: 'mesa-do-dragao',
    title: 'Mesa do Dragão',
    description: 'Descrição **base** com [link](https://example.com).',
    cover_url: null,
    cover_crop_data: null,
    status: 'active',
    archived_at: null,
    type: 'campanha',
    audience: 'todos',
    age_rating: '+16',
    modality: 'online',
    price_type: 'paga',
    price_value: 50,
    price_frequency: 'sessao',
    price_value_monthly: null,
    accepts_donations: false,
    suggested_donation_value: null,
    slots_total: 5,
    slots_filled: 2,
    slots_open: 3,
    language: 'pt-BR',
    experience_level: 'iniciante',
    featured: false,
    publisher_role: 'gm',
    actual_gm_name: 'Mestre Real',
    contacts: [],
    system_name: 'D&D 5.2',
    system_slug: 'dnd-52',
    system_logo_filename: null,
    system_website_url: null,
    gm_slug: 'mestre',
    gm_user_id: 'user-1',
    gm_avatar_url: null,
    gm_display_name: 'Mestre Público',
    gm_bio_long: 'Bio global do mestre.',
    is_ddal: true,
    is_covil: false,
    ddal_code: 'DDAL-01',
    ddal_name: 'Aventura DDAL',
    ddal_tier: 2,
    created_at: '2026-07-08T00:00:00.000Z',
    synopsis_narrative: '# Sinopse\nUma aventura heroica.',
    setting_name: 'Forgotten Realms',
    setting_styles: ['heroico', 'investigação'],
    vtt_platform: {
      id: 'vtt-1',
      name: 'Foundry VTT',
      slug: 'foundry',
      logo_filename: null,
      website_url: null,
    },
    game_platform_custom: null,
    starts_at: null,
    schedule_day_status: 'defined',
    schedule_time_status: 'defined',
    schedule_day_hint: 'sábado',
    schedule_time_hint: '19:00',
    city: null,
    state: null,
    content_warnings: ['violência fantástica'],
    safety_tools: ['linhas e véus'],
    table_gm_bio: 'Bio específica da mesa.',
    scenario_name: 'Phandalin',
    scenario_subgenres: [],
    schedules: [
      {
        id: 'schedule-2',
        day_of_week: 'domingo',
        start_time: '15:30:00',
        end_time: null,
        frequency: 'quinzenal',
        slots_per_session: null,
        is_ongoing: true,
        notes: 'sessão extra',
        sort_order: 2,
      },
      {
        id: 'schedule-1',
        day_of_week: 'sábado',
        start_time: '19:00:00',
        end_time: '23:00:00',
        frequency: 'semanal',
        slots_per_session: null,
        is_ongoing: true,
        notes: null,
        sort_order: 1,
      },
    ],
    communication_platform: 'Discord',
    origin: 'manual',
    ddal_season: 'Temporada 1',
    ddal_duration: '4 horas',
    ddal_format: 'Online',
    ddal_org_code: 'ORG',
    ddal_setting: 'Forgotten Realms',
    ddal_rules_notes: 'Regras AL.',
    master_display_name: 'Mestre Anunciante',
    campaign_length: 'Campanha longa',
    level_range: 'Níveis 1-5',
    billing_text: 'Pagamento por sessão.',
    session_zero_free: true,
    synopsis: 'Sinopse fallback.',
    style_text: 'Exploração e drama.',
    listing_excerpt: 'Chamada curta.',
    technical_requirements: 'Microfone bom.',
    requires_pc: true,
    requires_camera: false,
    requires_microphone: true,
    benefits_text: 'Material incluso.',
    gm_vtt_platforms: [],
    ...overrides,
  };
}

describe('buildWhatsAppTableAnnouncement', () => {
  it('builds complete paid announcement with human labels', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable(), {
      publicOrigin: 'https://mesas.artificiorpg.com/',
    });

    expect(text).toContain('📢*D&D 5.2 - Mesa do Dragão - Campanha - Comissionada*📢');
    expect(text).toContain('▬ Data e Hora: sábado · 19:00-23:00 · semanal; domingo · 15:30 · quinzenal · sessão extra');
    expect(text).toContain('▬ Nº de Vagas: 3');
    expect(text).toContain('▬ Faixa Etária: +16');
    expect(text).toContain('▬ Plataformas: Foundry VTT · Discord');
    expect(text).toContain('▬ Mestre: Mestre Anunciante');
    expect(text).toContain('▬ Mesa: Comissionada');
    expect(text).toContain('*📌 Inscrições:*\nhttps://mesas.artificiorpg.com/mesas/mesa-do-dragao');
    expect(text).toContain('Código DDAL: DDAL-01');
    expect(text).toContain('Sessão zero gratuita');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    expect(text).not.toContain('NaN');
  });

  // Achado do mantenedor (2026-08-31): mesa "a definir" copiava a linha de
  // agenda VAZIA mesmo com o horario preenchido. Os dois eixos sao
  // independentes (editorMapping.deriveSchedule), e o hint que o codigo antigo
  // exigia so e gravado pelo importador do Discord — pelo editor, nunca.
  // Os quatro cruzamentos ficam cobertos para o eixo definido nunca mais
  // desaparecer por causa do indefinido.
  describe('agenda sem linhas — statuses "a definir" (achado 2026-08-31)', () => {
    // Sem `as const`: ele congela `schedules` como `readonly []`, que nao e
    // atribuivel a `TableDetail['schedules']` (array mutavel) — o CI reprova no
    // `tsc` mesmo com os testes verdes, porque o vitest nao type-checa.
    const semLinhas: Partial<TableDetail> = {
      schedules: [],
      schedule_day_hint: null,
      schedule_time_hint: null,
    };

    it('dia a definir + horario definido mantem o horario na linha', () => {
      const text = buildWhatsAppTableAnnouncement(makeTable({
        ...semLinhas,
        schedule_day_status: 'to_define',
        schedule_time_status: 'defined',
        schedule_time_hint: '20:00',
      }));

      expect(text).toContain('▬ Data e Hora: Dia a definir · 20:00');
    });

    it('dia definido + horario a definir mantem o dia na linha', () => {
      const text = buildWhatsAppTableAnnouncement(makeTable({
        ...semLinhas,
        schedule_day_status: 'defined',
        schedule_time_status: 'to_define',
        schedule_day_hint: 'quinta',
      }));

      expect(text).toContain('▬ Data e Hora: quinta · Horário a definir');
    });

    it('os dois a definir dizem isso explicitamente, em vez de linha vazia', () => {
      const text = buildWhatsAppTableAnnouncement(makeTable({
        ...semLinhas,
        schedule_day_status: 'to_define',
        schedule_time_status: 'to_define',
      }));

      expect(text).toContain('▬ Data e Hora: Dia a definir · Horário a definir');
    });

    // O editor nao grava hint nenhum (medido: zero ocorrencias em
    // features/table-editor). Sem hint e sem linha, a agenda nao tem o que
    // dizer — a linha fica vazia de proposito, sem inventar rotulo.
    // Payload da rota de LISTA: ela seleciona `schedule_day_status` sem os
    // hints nem `schedule_time_status` (`tables.ts:163`), entao os campos
    // chegam undefined. Sem status nao ha o que afirmar sobre o eixo — a linha
    // fica vazia, sem rotulo inventado (achado de review, PR #300).
    it('status ausente (payload de lista) nao inventa rotulo', () => {
      const text = buildWhatsAppTableAnnouncement(makeTable({
        schedules: [],
        schedule_day_status: undefined,
        schedule_time_status: undefined,
        schedule_day_hint: null,
        schedule_time_hint: null,
      }));

      expect(text).not.toContain('a definir');
      expect(text).not.toContain('undefined');
    });

    it('status definido sem hint nem linha continua vazio, sem texto inventado', () => {
      const text = buildWhatsAppTableAnnouncement(makeTable({
        ...semLinhas,
        schedule_day_status: 'defined',
        schedule_time_status: 'defined',
      }));

      expect(text).toContain('▬ Data e Hora:\n');
      expect(text).not.toContain('a definir');
    });

    // Fluxo real, sem hint escrito a mao: o payload sai de `deriveSchedule`
    // (o que o editor de fato manda) e alimenta o anuncio. Os testes acima
    // preenchem `schedule_time_hint` diretamente, o que mascarava o caso do
    // mestre — o editor zerava os dois hints e o horario nunca chegava aqui
    // (achado Codex P2, PR #300).
    it('payload do editor com dia a definir + horario preenchido mantem o horario no anuncio', () => {
      const payload = deriveSchedule({
        ...createDefaultEditorState(),
        isPersonalizedSchedule: false,
        schedules: [{
          day_of_week: 'to_define',
          start_time: '20:00',
          frequency: 'semanal',
          is_ongoing: false,
          notes: '',
          sort_order: 0,
        }],
      });

      const text = buildWhatsAppTableAnnouncement(makeTable({
        schedules: [],
        schedule_day_status: payload.schedule_day_status,
        schedule_time_status: payload.schedule_time_status,
        schedule_day_hint: payload.schedule_day_hint,
        schedule_time_hint: payload.schedule_time_hint,
      }));

      expect(text).toContain('▬ Data e Hora: Dia a definir · 20:00');
    });

    it('linhas reais continuam vencendo os statuses do topo', () => {
      const text = buildWhatsAppTableAnnouncement(makeTable({
        schedule_day_status: 'to_define',
        schedule_time_status: 'to_define',
        schedule_day_hint: null,
        schedule_time_hint: null,
      }));

      expect(text).toContain('▬ Data e Hora: sábado · 19:00-23:00 · semanal');
      expect(text).not.toContain('Dia a definir');
    });
  });

  it('keeps empty labels empty and formats free table with age rating Livre', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      age_rating: 'livre',
      price_type: 'gratuita',
      schedules: [],
      schedule_day_status: 'to_define',
      schedule_time_status: 'to_define',
      system_name: null,
      table_gm_bio: null,
      gm_bio_long: null,
      synopsis_narrative: null,
      synopsis: null,
      description: null,
      style_text: null,
      setting_name: null,
      setting_styles: null,
      benefits_text: null,
      billing_text: null,
      technical_requirements: null,
      content_warnings: [],
      safety_tools: [],
    }));

    expect(text).toContain('▬ Sistema:');
    expect(text).toContain('▬ Data e Hora:');
    expect(text).toContain('▬ Faixa Etária: Livre');
    expect(text).toContain('▬ Mesa: Gratuita');
    // Achado do mantenedor 2026-07-08: seção sem conteúdo (bio do mestre vazia)
    // some do anúncio em vez de sair com título e corpo em branco.
    expect(text).not.toContain('Sobre o Mestre');
    expect(text).not.toContain('[Nome da mesa]');
    expect(text).not.toMatch(/\{[^}]+\}/);
  });

  it('rotula nível de experiência em vez de deixar sair cru (achado do mantenedor 2026-07-16, caso real "Crônicas do Fim dos Dias" — "todos" aparecia sem contexto)', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({ experience_level: 'todos', level_range: null }));
    expect(text).toContain('Experiência: todos');
    expect(text).not.toMatch(/\n\ntodos\n\n/);
  });

  it('inclui linha do pacote mensal quando price_value_monthly está presente', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({ price_value_monthly: 40 }));
    expect(text).toContain('Pacote mensal: R$ 40/sessão');
  });

  it('não menciona pacote mensal quando price_value_monthly está ausente', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({ price_value_monthly: null }));
    expect(text).not.toContain('Pacote mensal');
    expect(text).toContain('Valor: R$ 50');
  });

  it('não menciona pacote mensal em mesa gratuita mesmo com price_value_monthly residual (guard por price_type, achado Codex PR #283)', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      price_type: 'gratuita',
      price_value: null,
      price_value_monthly: 40,
    }));
    expect(text).not.toContain('Pacote mensal');
  });

  it('não anuncia valor avulso em mesa gratuita mesmo com price_value residual (guard por price_type, achado Codex PR #283)', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      price_type: 'gratuita',
      price_value: 50,
      price_value_monthly: null,
      price_frequency: null,
    }));
    expect(text).not.toContain('Valor: R$');
  });

  it('inclui doação com valor sugerido em mesa gratuita', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      price_type: 'gratuita',
      price_value: null,
      price_frequency: null,
      accepts_donations: true,
      suggested_donation_value: 10,
    }));
    expect(text).toContain('Aceita doações');
    expect(text).toContain('Valor sugerido: R$ 10/sessão');
    expect(text).toContain('▬ Mesa: Gratuita');
  });

  it('inclui doação sem valor sugerido quando só o flag está marcado', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      price_type: 'gratuita',
      price_value: null,
      price_frequency: null,
      accepts_donations: true,
      suggested_donation_value: null,
    }));
    expect(text).toContain('Aceita doações');
    expect(text).not.toContain('Valor sugerido');
  });

  it('não menciona doação em mesa gratuita sem o flag (saída atual preservada)', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      price_type: 'gratuita',
      price_value: null,
      price_frequency: null,
      accepts_donations: false,
      suggested_donation_value: null,
    }));
    expect(text).not.toContain('doações');
    expect(text).not.toContain('Valor sugerido');
  });

  it('não menciona doação em mesa paga mesmo com flag inconsistente (guard por price_type)', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      price_type: 'paga',
      price_value: 50,
      accepts_donations: true,
      suggested_donation_value: 10,
    }));
    expect(text).not.toContain('Aceita doações');
    expect(text).not.toContain('Valor sugerido');
  });

  it('keeps age rating empty when absent and converts markdown/html to plain text', () => {
    const text = buildWhatsAppTableAnnouncement(makeTable({
      age_rating: null,
      synopsis_narrative: '<p>Texto <strong>HTML</strong></p>',
      benefits_text: 'Use [formulário](https://forms.example/test) para entrar.',
    }));

    expect(text).toContain('▬ Faixa Etária:');
    expect(text).toContain('Texto HTML');
    expect(text).toContain('formulário: https://forms.example/test');
    expect(text).not.toContain('<strong>');
    expect(text).not.toContain('[formulário]');
  });
});

describe('copyTextToClipboard', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    vi.restoreAllMocks();
  });

  it('uses Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyTextToClipboard('texto');

    expect(writeText).toHaveBeenCalledWith('texto');
  });

  it('throws when Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    await expect(copyTextToClipboard('fallback')).rejects.toThrow('Clipboard unavailable');
  });
});
