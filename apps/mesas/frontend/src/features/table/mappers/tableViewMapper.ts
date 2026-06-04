import type { TableContact, TableDetail } from '../../../types/tables';
import type { TableViewModel, TableCertifications, CTAConfig, UrgencyConfig, VisibilityConfig } from '../types/tableView.types';

/**
 * Gera configuração de CTA baseado no estado da mesa e contatos disponíveis
 */
function generateCTAConfig(table: TableDetail, slotsLeft: number, contacts: TableContact[]): CTAConfig {
  // CORREÇÃO: Bloquear CTA para mesas desativadas/encerradas
  if (table.status === 'cancelled') {
    return {
      label: 'Mesa desativada',
      disabled: true,
      variant: 'disabled',
      action: 'none',
    };
  }

  if (table.status === 'ended') {
    return {
      label: 'Mesa encerrada',
      disabled: true,
      variant: 'disabled',
      action: 'none',
    };
  }

  const isFull = slotsLeft <= 0;

  if (isFull) {
    return {
      label: 'Mesa lotada',
      disabled: true,
      variant: 'disabled',
      action: 'none',
    };
  }

  // Ordenar contatos por sort_order (menor = maior prioridade)
  const sortedContacts = [...contacts].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  const primaryContact = sortedContacts[0];

  // Se há apenas 1 contato dominante, CTA direto
  if (primaryContact && sortedContacts.length === 1) {
    if (primaryContact.channel === 'discord' && primaryContact.discord_server_url) {
      return {
        label: '💬 Entrar no Discord',
        disabled: false,
        variant: 'primary',
        action: 'external-link',
        actionUrl: primaryContact.discord_server_url,
      };
    }
    if (primaryContact.channel === 'whatsapp') {
      const url = getWhatsAppUrl(primaryContact.value);
      return {
        label: '💬 Enviar WhatsApp',
        disabled: false,
        variant: 'primary',
        action: 'external-link',
        actionUrl: url,
      };
    }
  }

  // Múltiplos contatos ou canal não suportado: fallback para seletor
  return {
    label: '🎲 Escolher como entrar',
    disabled: false,
    variant: 'primary',
    action: 'scroll-contact',
  };
}

/**
 * Helper: formata número WhatsApp para wa.me
 */
function getWhatsAppUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('wa.me')) {
    return `https://${value}`;
  }
  const cleanNumber = value.replace(/\D/g, '');
  if (cleanNumber.length >= 10) {
    const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
    return `https://wa.me/${fullNumber}`;
  }
  return `https://${value}`;
}

/**
 * Gera configuração de urgência baseado em vagas restantes
 */
function generateUrgencyConfig(table: TableDetail, slotsLeft: number): UrgencyConfig {
  // CORREÇÃO: Urgência específica para status
  if (table.status === 'cancelled') {
    return {
      label: '⏸️ Mesa desativada',
      tone: 'none',
      icon: '⏸️',
    };
  }

  if (table.status === 'ended') {
    return {
      label: '🏁 Mesa encerrada',
      tone: 'none',
      icon: '🏁',
    };
  }

  if (slotsLeft === 0) {
    return {
      label: '❌ Mesa lotada',
      tone: 'critical',
      icon: '❌',
    };
  }

  if (slotsLeft <= 2) {
    return {
      label: `🔥 Últimas ${slotsLeft} ${slotsLeft === 1 ? 'vaga' : 'vagas'}`,
      tone: 'high',
      icon: '🔥',
    };
  }

  if (slotsLeft <= 5) {
    return {
      label: `⚠️ ${slotsLeft} vagas restantes`,
      tone: 'medium',
      icon: '⚠️',
    };
  }

  return {
    label: `${slotsLeft} vagas disponíveis`,
    tone: 'low',
    icon: '✓',
  };
}

/**
 * Gera configuração de visibilidade baseado no contexto
 */
function generateVisibilityConfig(table: TableDetail): VisibilityConfig {
  return {
    showPrice: !!table.price_value,
    showSchedules: (table.schedules?.length ?? 0) > 0
      || table.schedule_day_status === 'to_define'
      || table.schedule_time_status === 'to_define',
    showMaster: !!table.table_gm_bio || !!table.master_display_name,
    showFullDetails: true, // Pode ser controlado por variant no futuro
    compact: false, // Pode ser controlado por variant no futuro
  };
}

/**
 * Transforma TableDetail (API) em TableViewModel (UI)
 * Centraliza lógica de transformação e defaults
 */
export function mapTableToView(table: TableDetail): TableViewModel {
  // CORREÇÃO DT-09: Usar slots_open ao invés de calcular slots_total - slots_filled
  // slots_open = vagas abertas para recrutamento (controlado pelo mestre)
  // slots_filled = jogadores já inscritos
  const slotsLeft = table.slots_open ?? ((table.slots_total ?? 0) - (table.slots_filled ?? 0));

  // Estrutura de certificações
  const certifications: TableCertifications = {};

  if (table.is_ddal) {
    certifications.ddal = {
      code: table.ddal_code ?? undefined,
      name: table.ddal_name ?? undefined,
      tier: table.ddal_tier ?? undefined,
      season: table.ddal_season ?? undefined,
      duration: table.ddal_duration ?? undefined,
      format: table.ddal_format ?? undefined,
      orgCode: table.ddal_org_code ?? undefined,
      setting: table.ddal_setting ?? undefined,
      rulesNotes: table.ddal_rules_notes ?? undefined,
    };
  }

  if (table.is_covil) {
    certifications.covil = {
      isMember: true,
    };
  }

  return {
    // =============================
    // DECISION ENGINE (configs)
    // =============================
    cta: generateCTAConfig(table, slotsLeft, table.contacts ?? []),
    urgency: generateUrgencyConfig(table, slotsLeft),
    visibility: generateVisibilityConfig(table),

    // =============================
    // DADOS
    // =============================

    // Identificação
    id: table.id,
    slug: table.slug,
    title: table.title,
    subtitle: table.listing_excerpt ?? table.description?.slice(0, 120),

    // Decisão rápida
    system: table.system_name ?? 'Sistema livre',
    systemLogoFilename: table.system_logo_filename ?? undefined,
    systemWebsiteUrl: table.system_website_url ?? undefined,
    experience: table.experience_level,
    modality: table.modality,

    // Vagas
    slotsLeft,
    slotsTotal: table.slots_total,
    slotsFilled: table.slots_filled,
    slotsOpen: table.slots_open, // CORREÇÃO DT-09: Adicionar slots_open ao ViewModel
    isFull: slotsLeft <= 0,

    // Preço
    price: table.price_value ?? undefined,
    priceFrequency: table.price_frequency ?? undefined,

    // Certificações
    certifications,
    scenario: table.scenario_name ?? undefined,

    // Mestre
    masterName: table.master_display_name ?? table.gm_display_name ?? undefined,
    masterSlug: table.gm_slug ?? undefined,
    masterAvatar: table.gm_avatar_url ?? undefined,
    // CORREÇÃO A-MED-01 / C-MED-02: Fallback entre bio específica da mesa e bio global do perfil
    // Prioridade: table_gm_bio (bio específica desta mesa) > gm_bio_long (bio global do perfil)
    masterBio: table.table_gm_bio ?? table.gm_bio_long ?? undefined,
    masterVttPlatforms: table.gm_vtt_platforms ?? undefined,

    // Horários
    schedules: table.schedules ?? [],
    scheduleDayStatus: table.schedule_day_status,
    scheduleTimeStatus: table.schedule_time_status,
    scheduleDayHint: table.schedule_day_hint,
    scheduleTimeHint: table.schedule_time_hint,

    // Plataformas
    vttPlatform: table.vtt_platform ? {
      id: table.vtt_platform.id,
      name: table.vtt_platform.name,
      slug: table.vtt_platform.slug,
      logo_filename: table.vtt_platform.logo_filename,
      website_url: table.vtt_platform.website_url,
    } : undefined,
    gamePlatformCustom: table.game_platform_custom ?? undefined,
    communicationPlatform: table.communication_platform ?? undefined, // CORREÇÃO C06

    // Conteúdo
    description: table.description ?? undefined,
    narrative: table.synopsis_narrative ?? undefined,
    benefits: table.benefits_text ?? undefined,
    styleText: table.style_text ?? undefined,

    // Segurança
    contentWarnings: table.content_warnings ?? [],
    safetyTools: table.safety_tools ?? [],

    // Técnico
    campaignLength: table.campaign_length ?? undefined,
    levelRange: table.level_range ?? undefined,
    billingText: table.billing_text ?? undefined,
    sessionZeroFree: table.session_zero_free ?? false,
    technicalRequirements: table.technical_requirements ?? undefined,
    requiresPC: table.requires_pc ?? false,
    requiresCamera: table.requires_camera ?? false,
    requiresMicrophone: table.requires_microphone ?? false,

    // Cenário e estilos
    settingName: table.setting_name ?? undefined,
    settingStyles: table.setting_styles ?? undefined,

    // Metadados
    coverUrl: table.cover_url ?? undefined,
    coverCropData: table.cover_crop_data ?? undefined,
    status: table.status,
    origin: table.origin,
    publisherRole: table.publisher_role,
    actualGmName: table.actual_gm_name ?? undefined,

    // Contatos
    contacts: table.contacts ?? [],

    // Localização
    city: table.city ?? undefined,
    state: table.state ?? undefined,
    language: table.language,
    startsAt: table.starts_at ?? undefined,
  };
}
