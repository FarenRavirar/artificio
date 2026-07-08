// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TableDetail } from '../../../types/tables';
import { buildWhatsAppTableAnnouncement, copyTextToClipboard } from './whatsappAnnouncement';

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
