import type { FormState, CreateTablePayload } from '../types/createTable.types';
import { normalizeSettingStyles } from '@artificio/catalog-matching';

/**
 * Normaliza o discriminador de cobrança para o conjunto real do contrato.
 * 'free' nunca existiu no banco — o enum price_type é 'gratuita' | 'paga'
 * desde migration_01_base_schema.sql — e era default fantasma no estado do
 * form; 'paid' vem de drafts antigos em inglês. Qualquer valor fora do
 * conjunto vira 'gratuita' (default do produto). Usada no envio do payload e
 * na carga do estado inicial (useCreateTableForm), para que valor legado
 * restaurado nunca alcance o select/controles condicionais (achado Codex
 * PR #283).
 */
export function normalizePriceType(value?: string | null): 'gratuita' | 'paga' {
  if (value === 'paga' || value === 'paid') return 'paga';
  return 'gratuita';
}

/**
 * Transforma o estado do formulário em payload para a API
 */
// `isEditing` decide se `slots_filled` e derivado (criacao) ou omitido para
// preservar a contagem real de jogadores confirmados (edicao). Ver o bloco de
// slots abaixo.
export function formStateToPayload(state: FormState, isEditing = false): CreateTablePayload {
  // Filtrar contatos válidos
  const validContacts = state.contacts
    .filter((c) => c.value.trim().length > 0)
    .map((c) => ({
      channel: c.channel,
      value: c.value,
      label: c.label || '',
      discord_server_url: c.discord_server_url?.trim() ? c.discord_server_url.trim() : undefined,
    }));

  const normalizeScheduleFrequency = (
    value?: string | null
  ): 'semanal' | 'quinzenal' | 'mensal' | 'avulsa' => {
    if (value === 'semanal' || value === 'quinzenal' || value === 'mensal' || value === 'avulsa') {
      return value;
    }

    if (value === 'outros') {
      return 'avulsa';
    }

    return 'semanal';
  };

  let hasUndefinedDay = false;
  let hasUndefinedTime = false;
  let firstKnownDay: string | null = null;
  let firstKnownTime: string | null = null;

  for (const session of state.sessions) {
    if (session.day_of_week === 'to_define') {
      hasUndefinedDay = true;
    } else if (!firstKnownDay) {
      firstKnownDay = session.day_of_week;
    }

    if (!session.start_time) {
      hasUndefinedTime = true;
    } else if (!firstKnownTime) {
      firstKnownTime = session.start_time;
    }
  }

  const hasFlexibleSchedule = hasUndefinedDay || hasUndefinedTime;

  // CORREÇÃO REG-01: Renomear sessions para schedules e mapear estrutura correta
  const schedules = hasFlexibleSchedule
    ? []
    : state.sessions.map((s, index) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time || undefined,
      frequency: normalizeScheduleFrequency(s.frequency),
      slots_per_session: typeof s.slots_per_session === 'number' ? s.slots_per_session : null,
      is_ongoing: s.is_ongoing ?? false,
      notes: s.notes || undefined,
      sort_order: index,
    }));

  // Auditoria adversarial da feature price_value_monthly (sessão 26-08-22_1, A4):
  // parseFloat de string não numérica vira NaN, que JSON.stringify serializa como
  // null e limpa o campo silenciosamente no payload. Guard Number.isFinite: valor
  // não finito não é enviado (undefined omite o campo na serialização).
  // Correção pós-auditoria (achado do implementador, sessão 26-08-22_1): o mesmo
  // defeito existia em price_value, que usava parseFloat direto; o helper foi
  // generalizado para servir os dois campos.
  const parsePriceValue = (raw: string | undefined): number | undefined => {
    if (!raw) return undefined;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  // Auditoria adversarial final (sessão 26-08-22_1, achados #1 e #2): campo
  // esvaziado pelo usuário precisa zerar no banco. '' → null (backend zera);
  // undefined → omitido (backend preserva o salvo); não numérico → undefined
  // (guard Number.isFinite impede NaN de virar null e limpar sem intenção).
  // Só vale para price_value_monthly e suggested_donation_value — o contrato
  // de price_value (campo obrigatório de mesa paga) fica inalterado.
  const parseClearablePriceValue = (raw: string | undefined): number | null | undefined => {
    if (raw === undefined) return undefined;
    if (raw.trim() === '') return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  // T3.2d (spec 096): slots_filled ganha ESCRITOR no fluxo manual — mas SÓ na
  // criação. Na CRIAÇÃO derivar total - open é correto: a mesa não tem
  // contagem anterior a preservar, e é a mesma semântica com que o parser de
  // anúncio faz nascer a mesa (parseDiscordAnnouncement.ts:2820). Sem isso,
  // mesa manual nascia com slots_filled=0 (default da coluna) e os leitores
  // que usam total - filled (painel do mestre, useMestre.ts:164) contavam
  // vagas erradas.
  //
  // Na EDIÇÃO derivar DESTRÓI dado (achado Codex, PR #285). slots_filled são
  // jogadores confirmados; slots_open é quanto o mestre quer recrutar, e o
  // contrato permite open < total - filled quando ele limita ou fecha o
  // recrutamento (routes/tables.ts:130-135). As duas contagens são
  // independentes, então total - open NÃO reconstrói filled. Pior: o form nem
  // carrega o valor salvo (mapTableApiToInitialData.ts:113-114 lê só total e
  // open), então derivar sobrescreve com um número que ninguém digitou.
  // Medido em produção: 43 das 114 mesas teriam slots_filled sobrescrito por
  // uma edição, 4 delas com jogadores reais — "Somewhere in Duskwood"
  // (total=4, filled=4, open=4) perderia os 4 confirmados de uma vez.
  // Omitir é o caminho suportado: updateTableSchema é `.partial()` e
  // `undefined` preserva o valor salvo (gmPanel.ts:1002).
  const parsedSlotsTotal = Number.parseInt(state.form.slots_total, 10) || 0;
  const parsedSlotsOpen = Number.parseInt(state.form.slots_open, 10) || 0;
  // Clamp [0, total] preserva os CHECKs do Postgres (slots_filled_valid /
  // check_slots_valid) mesmo com estado inválido.
  const slotsFilled = isEditing
    ? undefined
    : Math.min(Math.max(parsedSlotsTotal - parsedSlotsOpen, 0), parsedSlotsTotal);

  // Construir payload base
  const payload: CreateTablePayload = {
    title: state.form.title,
    description: state.form.description,
    type: state.form.type,
    modality: state.form.modality,
    price_type: normalizePriceType(state.form.price_type),
    slots_total: parsedSlotsTotal,
    slots_open: parsedSlotsOpen, // REQ-02: Vagas abertas
    // Spread condicional em vez de `slots_filled: undefined`: a chave nem
    // aparece no JSON, entao o PUT nao toca a coluna.
    ...(slotsFilled !== undefined ? { slots_filled: slotsFilled } : {}),
    language: state.form.language,
    system_id: state.selectedSystemId,
    scenario_id: state.selectedScenarioId,
    schedule_day_status: hasUndefinedDay ? 'to_define' : 'defined',
    schedule_time_status: hasUndefinedTime ? 'to_define' : 'defined',
    schedule_day_hint: hasFlexibleSchedule && !hasUndefinedDay ? firstKnownDay : null,
    schedule_time_hint: hasFlexibleSchedule && !hasUndefinedTime ? firstKnownTime : null,
    schedules: schedules, // CORREÇÃO REG-01: Renomeado de sessions para schedules
    contacts: validContacts,
    publisher_role: state.publisherRole,
    actual_gm_name: state.publisherRole === 'announcer' ? state.actualGmName : null,
    rules_notes: state.rulesNotes,
    banner_url: state.bannerUrl?.trim() ? state.bannerUrl.trim() : undefined,
    banner_crop_data: state.bannerCropData ?? undefined,
    banner_width: state.bannerWidth ?? undefined,
    banner_height: state.bannerHeight ?? undefined,
    is_covil: state.isCovilMesa,
    is_ddal: state.ddal.is_ddal,
    // CORREÇÃO REG-04, REG-05, REG-06: Adicionar campos ausentes
    audience: state.form.audience,
    // T3.2 (spec 096): enviar faixa etária e nível da mesa coletados no form
    // (StepConfig.tsx) — antes descartados aqui e o banco gravava os defaults.
    // table_level vazio ('') omite o campo: create cai no DEFAULT 'todos' da
    // coluna, PUT preserva o valor salvo (mesmo comportamento de hoje).
    age_rating: state.form.age_rating,
    table_level: state.form.table_level || undefined,
    experience_level: state.form.experience_level,
    starts_at: state.form.starts_at || undefined,
    city: state.form.city || undefined,
    state: state.form.state || undefined,
    content_warnings: state.form.content_warnings || undefined,
    safety_tools: state.form.safety_tools || undefined,
    // VTT Platform: enviar ID ou null se "custom"
    vtt_platform_id: (state.vttPlatformId && state.vttPlatformId !== 'custom') ? state.vttPlatformId : undefined,
    game_platform_custom: (state.vttPlatformId === 'custom' && state.gamePlatformCustom) ? state.gamePlatformCustom : undefined,
    communication_platform_id:
      state.communicationPlatformId && state.communicationPlatformId !== 'custom'
        ? state.communicationPlatformId
        : undefined,
    communication_platform:
      state.communicationPlatformId === 'custom' && state.communicationPlatformCustom.trim().length > 0
        ? state.communicationPlatformCustom.trim()
        : undefined,
    // Decisão A2 do mantenedor (sessão 26-08-22_1, "endurecer"): campos de
    // preço/doação são enviados POR MODALIDADE, com price_type como fonte de
    // verdade. O form já limpa o state ao trocar paga↔gratuita (StepConfig),
    // mas draft/transição pode carregar valor residual da outra modalidade —
    // o mapper garante que o banco NUNCA acumula campo da modalidade oposta:
    // gratuita zera preços (null) e carrega doações; paga zera doações
    // (false/null) e carrega preços. Enviar o residual cru quebraria a troca
    // de modalidade: o validador do backend rejeita gratuita com preço (A2).
    ...(normalizePriceType(state.form.price_type) === 'gratuita'
      ? {
          price_value: null,
          price_value_monthly: null,
          // Doações: flag vai como boolean literal (false também é enviado —
          // coluna NOT NULL DEFAULT false). Valor sugerido só segue quando
          // 'Aceita doações' está marcado: usuário pode desmarcar sem limpar o
          // campo (o input fica escondido mas o state retém o valor digitado),
          // e enviar o residual dispararia 400 "Valor sugerido exige marcar
          // 'Aceita doações'" — o save quebraria sem mensagem no form (achado
          // Codex PR #283). parseClearablePriceValue segue para o caso
          // marcado: vazio = limpar (null), ausente = preservar, não numérico
          // = omitir.
          accepts_donations: state.form.accepts_donations === true,
          suggested_donation_value: state.form.accepts_donations === true
            ? parseClearablePriceValue(state.form.suggested_donation_value)
            : null,
        }
      : {
          price_value: parsePriceValue(state.form.price_value),
          price_value_monthly: parseClearablePriceValue(state.form.price_value_monthly),
          accepts_donations: false,
          suggested_donation_value: null,
        }),
    price_frequency: state.form.price_frequency || undefined,
  };

  // Adicionar campos DDAL se aplicável
  if (state.ddal.is_ddal) {
    payload.ddal_code = state.ddal.ddal_code || undefined;
    payload.ddal_name = state.ddal.ddal_name || undefined;
    payload.ddal_tier = state.ddal.ddal_tier ? parseInt(state.ddal.ddal_tier) : undefined;
    payload.ddal_season = state.ddal.ddal_season || undefined;
    payload.ddal_duration = state.ddal.ddal_duration || undefined;
    payload.ddal_format = state.ddal.ddal_format || undefined;
    payload.ddal_org_code = state.ddal.ddal_org_code || undefined;
    payload.ddal_setting = state.ddal.ddal_setting || undefined;
    payload.ddal_rules_notes = state.ddal.ddal_rules_notes || undefined;
  }

  // Adicionar campos avançados opcionais
  if (state.masterDisplayName) payload.master_display_name = state.masterDisplayName;
  if (state.campaignLength) payload.campaign_length = state.campaignLength;
  if (state.levelRange) payload.level_range = state.levelRange;
  if (state.billingText) payload.billing_text = state.billingText;
  if (state.sessionZeroFree) payload.session_zero_free = state.sessionZeroFree;
  if (state.synopsis) payload.synopsis = state.synopsis;
  if (state.styleText) payload.style_text = state.styleText;
  if (state.listingExcerpt) payload.listing_excerpt = state.listingExcerpt;
  if (state.technicalRequirements) payload.technical_requirements = state.technicalRequirements;
  if (state.requiresPc) payload.requires_pc = state.requiresPc;
  if (state.requiresCamera) payload.requires_camera = state.requiresCamera;
  if (state.requiresMicrophone) payload.requires_microphone = state.requiresMicrophone;
  if (state.settingName) payload.setting_name = state.settingName;
  if (state.settingStyles && state.settingStyles.length > 0) {
    const normalized = normalizeSettingStyles(state.settingStyles);
    if (normalized) payload.setting_styles = normalized;
  }
  
  // Campos editoriais Fase 6 (REQ-28)
  if (state.synopsisNarrative) payload.synopsis_narrative = state.synopsisNarrative;
  if (state.benefitsText) payload.benefits_text = state.benefitsText;
  if (state.tableGmBio) payload.table_gm_bio = state.tableGmBio;

  // Requisito 8 (spec 079): fecha o loop de aprendizado do pré-preenchimento.
  if (state.parseCaseId) payload.parse_case_id = state.parseCaseId;

  return payload;
}
