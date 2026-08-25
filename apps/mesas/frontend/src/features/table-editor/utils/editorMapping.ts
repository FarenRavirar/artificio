import { normalizeImageFrame } from '@artificio/media/image-kinds';
import { normalizeSettingStyles } from '@artificio/catalog-matching';
import { normalizeAgeRating } from '../../../utils/ageRating';
import type {
  ContactMethodInput,
  DayOfWeek,
  ScheduleFrequency,
  TableContactChannel,
} from '../../../types/tables';
import { TABLE_CONTACT_CHANNELS } from '../../../types/tables';
import type { TableEditorState } from '../types';
import type { SessionSchedule } from '../../../components/SessionRepeater';
// ── Normalizadores de preço (T4.8) ─────────────────────────────────────────
// Herdados do mapper do wizard antigo (features/create-table/utils/mapper,
// removido na T4.8): sobem para cá com os comentários de auditoria intactos
// para manter UMA fonte — consumidos também por editorValidation, ValuesPart
// e cardPreviewMapping.

/**
 * Normaliza o discriminador de cobrança para o conjunto real do contrato.
 * 'free' nunca existiu no banco — o enum price_type é 'gratuita' | 'paga'
 * desde migration_01_base_schema.sql — e era default fantasma no estado do
 * form antigo; 'paid' vem de drafts antigos em inglês. Qualquer valor fora do
 * conjunto vira 'gratuita' (default do produto). Usada no payload do editor e
 * na carga do estado inicial, para que valor legado restaurado nunca alcance
 * o select/controles condicionais (achado Codex PR #283).
 */
export function normalizePriceType(value?: string | null): 'gratuita' | 'paga' {
  if (value === 'paga' || value === 'paid') return 'paga';
  return 'gratuita';
}

// Auditoria adversarial da feature price_value_monthly (sessão 26-08-22_1, A4):
// parseFloat de string não numérica vira NaN, que JSON.stringify serializa como
// null e limpa o campo silenciosamente no payload. Guard Number.isFinite: valor
// não finito não é enviado (undefined omite o campo na serialização).
// Correção pós-auditoria (achado do implementador, sessão 26-08-22_1): o mesmo
// defeito existia em price_value, que usava parseFloat direto; o helper foi
// generalizado para servir os dois campos.
export const parsePriceValue = (raw: string | undefined): number | undefined => {
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
export const parseClearablePriceValue = (raw: string | undefined): number | null | undefined => {
  if (raw === undefined) return undefined;
  if (raw.trim() === '') return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Payload POST/PUT /gm/tables a partir do estado do editor.
 *
 * Regras do mapper que precisam sobreviver (plan.md §Regras do mapper),
 * todas preservadas aqui:
 * - `''` zera × `undefined` preserva (campos esvaziados de propósito mandam
 *   null; ausentes são omitidos e o backend preserva o salvo);
 * - guard `Number.isFinite` nos preços (parseFloat de texto não numérico
 *   vira NaN, que JSON.stringify serializa como null e limparia o campo
 *   silenciosamente);
 * - contatos vazios filtrados;
 * - `discord_server_url` só entra se preenchido;
 * - primeiro dia/horário conhecido derivado para as colunas de topo;
 * - `notes` por sessão omitido quando vazio;
 * - `slots_per_session` NÃO entra (removido por R20/A23/T4.0u);
 * - `parse_case_id` enviado SÓ no submit (opção `includeParseCaseId`) para
 *   fechar o loop de aprendizado — nunca no payload do autosave (C3).
 *
 * `status` é o ponto de integração do rascunho no backend (T4.7): o
 * validator atual NÃO aceita o campo (baseTableSchema não tem `status` e não
 * é `.strict()`, então ele é descartado silenciosamente) e o service grava
 * 'active' fixo na criação — enquanto o outro agente não prepara o backend,
 * enviar `status` é inócuo e já deixa o contrato pronto.
 */

export type EditorPayload = Record<string, unknown>;

/**
 * Opções do payload (T4.0p, A19): campos herdados do perfil do mestre que ele
 * NÃO editou. Omitidos de verdade — a mesa pública resolve o fallback com
 * COALESCE (`table_gm_bio ?? gm_bio_long`; `master_display_name ??
 * gm_display_name` em tableViewMapper.ts) e o perfil permanece INTACTO.
 * Quem decide "editou ou não" é o useTableEditor (compara o estado atual com
 * o snapshot do GET /gm/me); o mapper só aplica a omissão.
 */
export interface EditorPayloadOptions {
  omitInherited?: ReadonlySet<'masterDisplayName' | 'tableGmBio'>;
  /**
   * C3 (revisão adversarial Fase 4): `parse_case_id` só viaja no payload do
   * PUBLISH. O contrato de types.ts:163-168 é "reenviado NO SUBMIT para
   * fechar o loop" e "limpo ao restaurar senão contamina discord_parse_cases"
   * — o autosave remoto manda o payload a cada 2,5s de digitação e reenviaria
   * o id do preview a cada save. Default (autosave) OMITE; o publish passa
   * `includeParseCaseId: true`.
   */
  includeParseCaseId?: boolean;
}

// Exportado para a prévia do card (T4.2b): o `next_schedule` que o
// TableCardComponent lê é derivado exatamente como o payload deriva as
// colunas de agenda — mesma função, nunca uma cópia.
export interface ScheduleRow {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time?: string;
  frequency: ScheduleFrequency;
  is_ongoing: boolean;
  notes?: string;
  sort_order: number;
}

function normalizeFrequency(value?: string | null): ScheduleFrequency {
  if (value === 'semanal' || value === 'quinzenal' || value === 'mensal' || value === 'avulsa') {
    return value;
  }
  // 'outros' era a opção legada do repeater; cai no contrato 'avulsa'.
  return 'avulsa';
}

/** Linha de schedule no formato do payload (slots_per_session fora — R20). */
function toScheduleRow(schedule: SessionSchedule, index: number): ScheduleRow {
  const row: ScheduleRow = {
    day_of_week: (schedule.day_of_week !== 'to_define'
      ? schedule.day_of_week
      : 'segunda') as DayOfWeek,
    start_time: schedule.start_time || '19:00',
    frequency: normalizeFrequency(schedule.frequency),
    is_ongoing: schedule.is_ongoing ?? false,
    sort_order: index,
  };
  // T4.0f: `notes`/`end_time` vazios OMITEM a chave (ausente preserva o
  // salvo no PUT) — nunca `undefined` explícito no objeto.
  if (schedule.end_time) row.end_time = schedule.end_time;
  if (schedule.notes) row.notes = schedule.notes;
  return row;
}

export interface ScheduleDerivation {
  schedules: ScheduleRow[];
  schedule_day_status: 'defined' | 'to_define';
  schedule_time_status: 'defined' | 'to_define';
  schedule_day_hint: DayOfWeek | null;
  schedule_time_hint: string | null;
}/**
 * Deriva as colunas de agenda do topo da mesa + as linhas de
 * `table_schedules`, no contrato medido do backend (spec 096 §Gap 10 item 3):
 *
 * - "Horário personalizado" (R20): `schedule_day_status='to_define'` + texto
 *   em `table_schedules.notes`. `day_of_week`/`start_time` são NOT NULL e o
 *   enum do banco NÃO tem 'to_define' (db/types.ts `DayOfWeek`), então a
 *   linha carrega um valor real de placeholder — o card do catálogo decide
 *   pelo status da TABELA, não pelo dia da linha.
 * - Dia/horário "a definir": sem linhas (mesmo contrato do mapper antigo),
 *   status de tabela carrega o que existe. Linhas extras de mesa legada
 *   (2+ horários) são PRESERVADAS intactas no payload — o editor edita só a
 *   primeira e nunca apaga o que não mostra (T4.0u).
 */
export function deriveSchedule(state: TableEditorState): ScheduleDerivation {
  const first = state.schedules[0];

  if (state.isPersonalizedSchedule) {
    return {
      // Índice passado explicitamente: `toScheduleRow` usa o 2º parâmetro como
      // `sort_order` de propósito, e a forma point-free esconde isso (é o que
      // a regra do Sonar sinaliza — aqui o índice é intencional, não acidental).
      schedules: state.schedules.map((schedule, index) => toScheduleRow(schedule, index)),
      schedule_day_status: 'to_define',
      schedule_time_status: 'to_define',
      schedule_day_hint: null,
      schedule_time_hint: null,
    };
  }

  const dayDefined = !!first && first.day_of_week !== 'to_define';
  const timeDefined = !!first && !!first.start_time;

  if (!dayDefined || !timeDefined) {
    // Flexível: sem linhas, statuses de tabela + hints nulos (o hint só vale
    // com status 'defined' — refine do validator proíbe o contrário).
    return {
      schedules: [],
      schedule_day_status: dayDefined ? 'defined' : 'to_define',
      schedule_time_status: timeDefined ? 'defined' : 'to_define',
      schedule_day_hint: null,
      schedule_time_hint: null,
    };
  }

  return {
    schedules: state.schedules.map((schedule, index) => toScheduleRow(schedule, index)),
    schedule_day_status: 'defined',
    schedule_time_status: 'defined',
    schedule_day_hint: null,
    schedule_time_hint: null,
  };
}

// Nota (2026-08-24): `status` NÃO viaja no payload de POST/PUT — o backend
// rejeita `status` no PUT e o create nasce 'draft' pelo default real da
// coluna; a promoção é contrato do `PATCH /gm/tables/:id/status` (medido na
// onda 1 do backend, PR ainda aberta). A opção antiga `EditorPayloadOptions`
// foi removida para não dar a impressão de contrato que não existe.

/**
 * Plataformas (VTT e comunicação): slug do catálogo, ou o texto livre quando o
 * mestre escolheu "custom" — nunca os dois. Mesmo contrato do mapper antigo.
 */
function platformFields(state: TableEditorState): EditorPayload {
  const isCustomVtt = state.vttPlatformId === 'custom';
  const isCustomComm = state.communicationPlatformId === 'custom';
  const customComm = state.communicationPlatformCustom.trim();

  return {
    vtt_platform_id: !isCustomVtt && state.vttPlatformId ? state.vttPlatformId : undefined,
    game_platform_custom:
      isCustomVtt && state.gamePlatformCustom ? state.gamePlatformCustom : undefined,
    communication_platform_id:
      !isCustomComm && state.communicationPlatformId ? state.communicationPlatformId : undefined,
    communication_platform: isCustomComm && customComm ? customComm : undefined,
  };
}

/**
 * Preços e doação POR MODALIDADE (decisão A2 do mantenedor, sessão
 * 26-08-22_1): `price_type` é a fonte de verdade. O form limpa o state ao
 * trocar paga↔gratuita (T4.0d), mas draft/transição pode carregar valor
 * residual da outra modalidade; o payload garante que o banco NUNCA acumula
 * campo da modalidade oposta (o validator rejeita gratuita com preço e paga
 * com doação).
 */
function priceFields(state: TableEditorState): EditorPayload {
  if (normalizePriceType(state.priceType) !== 'gratuita') {
    return {
      price_value: parsePriceValue(state.priceValue),
      price_value_monthly: parseClearablePriceValue(state.priceValueMonthly),
      accepts_donations: false,
      suggested_donation_value: null,
    };
  }

  const acceptsDonations = state.acceptsDonations === true;
  return {
    price_value: null,
    price_value_monthly: null,
    accepts_donations: acceptsDonations,
    suggested_donation_value: acceptsDonations
      ? parseClearablePriceValue(state.suggestedDonationValue)
      : null,
  };
}

export function editorStateToPayload(
  state: TableEditorState,
  options: EditorPayloadOptions = {},
): EditorPayload {
  const omitInherited = options.omitInherited;
  // Contatos vazios filtrados; discord_server_url só se preenchido.
  const validContacts = state.contacts
    .filter((c) => c.value.trim().length > 0)
    .map((c) => ({
      channel: c.channel,
      value: c.value,
      label: c.label || '',
      discord_server_url: c.discord_server_url?.trim() ? c.discord_server_url.trim() : undefined,
    }));

  const schedule = deriveSchedule(state);

  const parsedSlotsTotal = Number.parseInt(state.slotsTotal, 10) || 0;
  const parsedSlotsOpen = Number.parseInt(state.slotsOpen, 10) || 0;

  const payload: EditorPayload = {
    title: state.title,
    description: state.description,
    type: state.type,
    modality: state.modality,
    audience: state.audience || 'livre',
    price_type: normalizePriceType(state.priceType),
    slots_total: parsedSlotsTotal,
    slots_open: parsedSlotsOpen,
    language: state.language,
    system_id: state.selectedSystemId,
    scenario_id: state.selectedScenarioId,
    ...schedule,
    contacts: validContacts,
    publisher_role: state.publisherRole,
    actual_gm_name: state.publisherRole === 'announcer' ? state.actualGmName : null,
    // T4.0p (A19): herança do perfil. NÃO editado → chave OMITIDA (a mesa
    // espelha o perfil; ausente preserva o salvo no PUT). Editado → valor
    // gravado na mesa; o perfil não é tocado por nenhum destes caminhos.
    ...(state.masterDisplayName && !omitInherited?.has('masterDisplayName')
      ? { master_display_name: state.masterDisplayName }
      : {}),
    ...(state.tableGmBio && !omitInherited?.has('tableGmBio')
      ? { table_gm_bio: state.tableGmBio }
      : {}),
    rules_notes: state.rulesNotes,
    banner_url: state.bannerUrl?.trim() ? state.bannerUrl.trim() : undefined,
    banner_crop_data: state.bannerCropData ?? undefined,
    banner_width: state.bannerWidth ?? undefined,
    banner_height: state.bannerHeight ?? undefined,
    is_covil: state.isCovil,
    is_ddal: state.ddal.is_ddal,
    // T3.2 (spec 096): vazio ('') OMITE o campo — no create a coluna cai no
    // DEFAULT, no PUT o `.partial()` preserva o valor salvo. Materializar
    // 'livre' rebaixaria a faixa em mesa que nunca a escolheu (PR #285).
    age_rating: state.ageRating || undefined,
    table_level: state.tableLevel || undefined,
    experience_level: state.experienceLevel,
    city: state.city || undefined,
    state: state.state || undefined,
    content_warnings: state.contentWarnings || undefined,
    safety_tools: state.safetyTools || undefined,
    ...platformFields(state),
    // Decisão A2 do mantenedor (sessão 26-08-22_1): preços/doação POR
    // MODALIDADE — price_type é a fonte de verdade. O form limpa o state ao
    // trocar paga↔gratuita (T4.0d), mas draft/transição pode carregar valor
    // residual da outra modalidade; o payload garante que o banco NUNCA
    // acumula campo da modalidade oposta (o validator rejeita gratuita com
    // preço e paga com doação).
    ...priceFields(state),
  };

  // Requisito 8 (spec 079): fecha o loop de aprendizado do parser — SÓ no
  // payload do publish (C3): o autosave remoto não reenvia o id a cada 2,5s.
  if (options.includeParseCaseId && state.parseCaseId) {
    payload.parse_case_id = state.parseCaseId;
  }

  applyDdalFields(payload, state);
  applyOptionalFields(payload, state);

  // T4.0f — omissão REAL: `JSON.stringify` já descarta `undefined` no envio,
  // mas manter a chave no objeto local engana consumidor que testa
  // `'key' in payload` (contrato: ausente preserva o salvo no PUT; `null`
  // zera de propósito e PERMANECE).
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }

  return payload;
}

/** 9 campos DDAL — só entram quando o selo está marcado (mapper antigo). */
function applyDdalFields(payload: EditorPayload, state: TableEditorState): void {
  if (!state.ddal.is_ddal) return;
  payload.ddal_code = state.ddal.ddal_code || undefined;
  payload.ddal_name = state.ddal.ddal_name || undefined;
  payload.ddal_tier = state.ddal.ddal_tier ? Number.parseInt(state.ddal.ddal_tier, 10) : undefined;
  payload.ddal_season = state.ddal.ddal_season || undefined;
  payload.ddal_duration = state.ddal.ddal_duration || undefined;
  payload.ddal_format = state.ddal.ddal_format || undefined;
  payload.ddal_org_code = state.ddal.ddal_org_code || undefined;
  payload.ddal_setting = state.ddal.ddal_setting || undefined;
  payload.ddal_rules_notes = state.ddal.ddal_rules_notes || undefined;
}

/**
 * Campos opcionais: valor falsy (string vazia, false) OMITE a chave, para o
 * backend preservar o salvo (mesma regra do mapper antigo). Os campos do
 * corte (§Gap 8) simplesmente não existem aqui — nunca são enviados.
 */
function applyOptionalFields(payload: EditorPayload, state: TableEditorState): void {
  const optional: [unknown, (p: EditorPayload) => void][] = [
    // masterDisplayName saiu desta lista (T4.0p): agora entra no corpo do
    // payload com a regra de herança (omitir quando não editado — A19).
    [state.campaignLength, (p) => { p.campaign_length = state.campaignLength; }],
    [state.levelRange, (p) => { p.level_range = state.levelRange; }],
    [state.billingText, (p) => { p.billing_text = state.billingText; }],
    [state.sessionZeroFree, (p) => { p.session_zero_free = state.sessionZeroFree; }],
    [state.technicalRequirements, (p) => { p.technical_requirements = state.technicalRequirements; }],
    [state.requiresPc, (p) => { p.requires_pc = state.requiresPc; }],
    [state.requiresCamera, (p) => { p.requires_camera = state.requiresCamera; }],
    [state.requiresMicrophone, (p) => { p.requires_microphone = state.requiresMicrophone; }],
    [state.settingName, (p) => { p.setting_name = state.settingName; }],
  ];

  for (const [value, assign] of optional) {
    if (value) assign(payload);
  }

  if (state.settingStyles.length > 0) {
    payload.setting_styles = state.settingStyles;
  }
}
/**
 * Converte a resposta de GET /api/v1/gm/tables/:id (e o formato moldado do
 * parse-preview) para o estado do editor.
 *
 * Emite SOMENTE as chaves presentes na fonte — sem defaults. Isso serve aos
 * dois consumidores:
 * - edição: o hook mescla sobre o estado default (`buildInitialEditorState`);
 * - prévia do parser: aplicada como patch, sem sobrescrever com defaults o
 *   que o mestre já digitou.
 *
 * Correções herdadas da T3.1 (spec 096):
 * - lê `is_covil` (a coluna real) — `is_covil_mesa` nunca existiu e
 *   desmarcava mesa Covil a cada edição;
 * - lê `schedules` (o backend devolve `schedules`) — `sessions` nunca
 *   existiu e fazia a edição colapsar horários no defaultSession.
 *
 * T4.0u: mesa legada com 2+ horários → a lista inteira entra no estado
 * (ordenada por sort_order); a UI edita só a primeira e o payload preserva
 * as demais intactas.
 */
type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord | null {
  return typeof value === 'object' && value !== null ? (value as ApiRecord) : null;
}

/**
 * Campo de texto do payload. `String()` cru aceitava objeto/array e gravava
 * "[object Object]" no estado — que o PUT REENVIA como se fosse conteúdo do
 * mestre (mesmo defeito que o `normalizeAgeRating` corrigiu na PR #285).
 * Número e boolean continuam convertidos: a API devolve `slots_total` numérico
 * e o estado do editor trabalha com string.
 */
function stringValue(data: ApiRecord, key: string, fallback = ''): string {
  const value = data[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function nullableStringValue(data: ApiRecord, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' ? value : null;
}

function trimmedIdOrUndefined(data: ApiRecord, key: string): string | undefined {
  const value = data[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function booleanValue(data: ApiRecord, key: string, fallback = false): boolean {
  const value = data[key];
  return typeof value === 'boolean' ? value : fallback;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * setting_styles com o normalizador canônico (T4.0g): a fronteira garante o
 * contrato de entrada do pacote (array de strings), e o pacote garante a
 * forma canônica + dedup. O cast é seguro: `normalizeSettingStyles` ignora
 * entradas não-string internamente (medido no pacote, linha do map com
 * `typeof s === 'string'`).
 */
function settingStylesValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeSettingStyles(value as string[]) ?? [];
}

function isContactEntry(value: unknown): value is ContactMethodInput {
  const contact = asRecord(value);
  return (
    contact !== null &&
    // `channel` tipa TableContactChannel: aceitar qualquer string deixava canal
    // desconhecido entrar no estado e cair no `default` de quem despacha por
    // canal (ícone/URL), com o tipo mentindo sobre o conteúdo.
    typeof contact.channel === 'string' &&
    (TABLE_CONTACT_CHANNELS as readonly string[]).includes(contact.channel) &&
    typeof contact.value === 'string'
  );
}

/** Normaliza a lista de contatos da API para o formato do editor. */
function mapContacts(data: ApiRecord): ContactMethodInput[] {
  if (!Array.isArray(data.contacts)) return [];
  return data.contacts
    .filter(isContactEntry)
    .map((contact) => ({
      channel: contact.channel,
      value: contact.value,
      // Campos opcionais: `?? ''` só cobre null/undefined — valor não-string
      // (número, objeto) passava direto e virava conteúdo de input de texto.
      label: typeof contact.label === 'string' ? contact.label : '',
      discord_server_url:
        typeof contact.discord_server_url === 'string' ? contact.discord_server_url : '',
    }));
}

function isSessionSchedule(value: unknown): value is SessionSchedule {
  const session = asRecord(value);
  return (
    session !== null &&
    typeof session.day_of_week === 'string' &&
    typeof session.start_time === 'string' &&
    typeof session.frequency === 'string' &&
    typeof session.is_ongoing === 'boolean' &&
    typeof session.sort_order === 'number'
  );
}

/** HH:MM:SS → HH:MM (o input `type=time` só aceita HH:MM). */
function toTimeInput(value: string): string {
  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

/** Schedules da API, ordenados por sort_order (preservando todos). */
function mapSchedules(data: ApiRecord): SessionSchedule[] {
  if (!Array.isArray(data.schedules)) return [];
  return data.schedules
    .filter(isSessionSchedule)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((session) => ({
      ...session,
      start_time: toTimeInput(session.start_time),
      // Checar o TIPO, não a veracidade: `end_time` truthy não-string (número
      // vindo de payload legado) entrava em toTimeInput e estourava no
      // `.trim()`, derrubando o mapeamento da mesa inteira.
      end_time: typeof session.end_time === 'string' ? toTimeInput(session.end_time) : undefined,
    }));
}

/** Sessão default quando a mesa não tem schedule (mesma lógica do fluxo antigo). */
function defaultSession(data: ApiRecord): SessionSchedule {
  return {
    day_of_week:
      data.schedule_day_status === 'to_define'
        ? 'to_define'
        : (nullableStringValue(data, 'schedule_day_hint') as SessionSchedule['day_of_week']) ?? 'segunda',
    start_time:
      data.schedule_time_status === 'to_define'
        ? ''
        : toTimeInput(stringValue(data, 'schedule_time_hint', '19:00')),
    end_time: '',
    frequency: 'semanal',
    is_ongoing: false,
    notes: '',
    sort_order: 0,
  };
}

export type EditorInitialData = Partial<TableEditorState> & { id?: string };

/**
 * Plataforma de comunicação na leitura: id do catálogo quando existe; senão
 * 'custom' + o texto livre, que é como o editor representa a opção fora da
 * lista. Os dois campos derivam da MESMA decisão, por isso saem juntos.
 */
function communicationFields(data: ApiRecord): {
  communicationPlatformId: string;
  communicationPlatformCustom: string;
} {
  if (data.communication_platform_id) {
    return {
      communicationPlatformId: stringValue(data, 'communication_platform_id'),
      communicationPlatformCustom: '',
    };
  }

  const custom = stringValue(data, 'communication_platform');
  return {
    communicationPlatformId: custom ? 'custom' : '',
    communicationPlatformCustom: custom,
  };
}

export function mapApiToEditorState(apiData: unknown): EditorInitialData {
  const data = asRecord(apiData);
  if (!data) return {};

  const bannerFrame = normalizeImageFrame(data, 'banner');
  const schedules = mapSchedules(data);

  // "Horário personalizado" (T4.0u): status 'to_define' NA TABELA + linha com
  // o texto livre em notes. "Dia a definir" legado tem status 'to_define' sem
  // linhas — os dois se distinguem pela presença da linha.
  const isPersonalizedSchedule = data.schedule_day_status === 'to_define' && schedules.length > 0;

  const result: EditorInitialData = {
    id: trimmedIdOrUndefined(data, 'id'),
    status: typeof data.status === 'string' ? data.status : undefined,
    // Slug público (R22): só entra quando a API devolve string. É o destino
    // de "Ver como jogador" — sem slug não há página pública.
    slug: typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : undefined,

    title: stringValue(data, 'title'),
    description: stringValue(data, 'description'),
    rulesNotes: stringValue(data, 'rules_notes'),
    bannerUrl: stringValue(data, 'banner_url') || stringValue(data, 'image_url'),
    bannerCropData: bannerFrame.crop ?? null,
    bannerWidth: bannerFrame.width,
    bannerHeight: bannerFrame.height,

    selectedSystemId: stringValue(data, 'system_id'),
    selectedScenarioId: nullableStringValue(data, 'scenario_id'),

    settingName: stringValue(data, 'setting_name'),
    // T4.0g (spec 096): leitura com o normalizador canônico do pacote
    // @artificio/catalog-matching — o MESMO que o backend aplica na escrita
    // (gmPanel.ts:1091) e o mapper antigo no payload. A forma canônica do
    // estoque (migration_152/160) é capitalizada por palavra
    // ("dark fantasy" → "Dark Fantasy"); ler com stringArrayValue deixava
    // mesa legada com grafia fora do catálogo entrar no estado cru e ser
    // reenviada divergente — o defeito que R19/R20 existem para corrigir.
    // Valor fora do catálogo NÃO é descartado: o normalizador só ajusta a
    // grafia e deduplica (medido no pacote); entrada não-array/vazia vira []
    // como antes.
    settingStyles: settingStylesValue(data.setting_styles),

    schedules: schedules.length > 0 ? schedules : [defaultSession(data)],
    isPersonalizedSchedule,

    slotsTotal: stringValue(data, 'slots_total', '4'),
    slotsOpen: stringValue(data, 'slots_open', '4'),

    modality: stringValue(data, 'modality', 'online'),
    vttPlatformId: stringValue(data, 'vtt_platform_id'),
    gamePlatformCustom: stringValue(data, 'game_platform_custom'),
    ...communicationFields(data),

    requiresPc: booleanValue(data, 'requires_pc'),
    requiresCamera: booleanValue(data, 'requires_camera'),
    requiresMicrophone: booleanValue(data, 'requires_microphone'),
    city: stringValue(data, 'city'),
    state: stringValue(data, 'state'),

    priceType: normalizePriceType(stringValue(data, 'price_type', 'gratuita')),
    priceValue: stringValue(data, 'price_value'),
    priceValueMonthly: stringValue(data, 'price_value_monthly'),
    acceptsDonations: booleanValue(data, 'accepts_donations'),
    suggestedDonationValue: stringValue(data, 'suggested_donation_value'),
    billingText: stringValue(data, 'billing_text'),
    sessionZeroFree: booleanValue(data, 'session_zero_free'),

    type: stringValue(data, 'type', 'campanha'),
    // normalizeAgeRating em vez de stringValue: payload de rede, e String()
    // aceitaria qualquer coisa ('16' → "16"; {} → "[object Object]") que
    // seria REENVIADA no PUT sem casar com opção nenhuma (PR #285).
    ageRating: normalizeAgeRating(data.age_rating) ?? '',
    experienceLevel: stringValue(data, 'experience_level', 'todos'),
    tableLevel: stringValue(data, 'table_level'),
    audience: stringValue(data, 'audience', 'livre'),
    language: stringValue(data, 'language', 'pt-BR'),
    contentWarnings: stringArrayValue(data.content_warnings),
    safetyTools: stringArrayValue(data.safety_tools),

    publisherRole: data.publisher_role === 'announcer' ? 'announcer' : 'gm',
    actualGmName: stringValue(data, 'actual_gm_name'),
    masterDisplayName: stringValue(data, 'master_display_name'),
    tableGmBio: stringValue(data, 'table_gm_bio'),
    contacts: mapContacts(data),
    campaignLength: stringValue(data, 'campaign_length'),
    levelRange: stringValue(data, 'level_range'),

    technicalRequirements: stringValue(data, 'technical_requirements'),
    // T3.1: a coluna é `is_covil` — `is_covil_mesa` nunca existiu.
    isCovil: booleanValue(data, 'is_covil'),

    ddal: {
      is_ddal: booleanValue(data, 'is_ddal'),
      ddal_code: stringValue(data, 'ddal_code'),
      ddal_name: stringValue(data, 'ddal_name'),
      ddal_tier: stringValue(data, 'ddal_tier'),
      ddal_season: stringValue(data, 'ddal_season'),
      ddal_duration: stringValue(data, 'ddal_duration'),
      ddal_format: stringValue(data, 'ddal_format'),
      ddal_org_code: stringValue(data, 'ddal_org_code'),
      ddal_setting: stringValue(data, 'ddal_setting'),
      ddal_rules_notes: stringValue(data, 'ddal_rules_notes'),
    },
  };

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Perfil do mestre (T4.0p/T4.0p2/T4.0q) — herança e criação no publish.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contatos normalizados para as DUAS escritas de perfil (POST/PUT
 * /api/v1/gm/profile): a criação do perfil no publish (T4.0p2) e o botão de
 * sincronizar (T4.0q). Mesma regra de filtragem do payload de mesa (vazio
 * fora, campos opcionais trim) — o schema do perfil (contactSchema) aceita
 * `label: null`, o serializer omite `discord_server_url` ausente, e o value
 * é trimado aqui pelo MESMO motivo do backend (`z.string().trim()` em
 * contactSchema, tableValidators.ts:52): o que a validação do backend
 * normaliza não deve ser gravado diferente pelo front.
 */
export function toProfileContactMethods(
  contacts: readonly ContactMethodInput[],
): Array<{
  channel: TableContactChannel;
  value: string;
  label: string | null;
  discord_server_url?: string;
}> {
  return contacts
    .filter((c) => c.value.trim().length > 0)
    .map((c) => ({
      channel: c.channel,
      value: c.value.trim(),
      label: c.label?.trim() ? c.label.trim() : null,
      ...(c.discord_server_url?.trim()
        ? { discord_server_url: c.discord_server_url.trim() }
        : {}),
    }));
}

/** Snapshot do perfil usado pela herança — só o que a mesa consome. */
export interface GmProfileSnapshot {
  nickname: string;
  bioLong: string;
  contactMethods: ContactMethodInput[];
  /**
   * Fase 6 (spec 096, T6.4): plataformas VTT preferidas do mestre — UUIDs do
   * catálogo `vtt_platforms` (gm_profiles.preferred_vtt_platforms, 39/39 em
   * produção). A herança pré-carrega o PRIMEIRO no estado do editor; o
   * WherePart já reconcilia UUID→slug quando o catálogo carrega (mesma
   * mecânica da edição de mesa legada).
   */
  preferredVttPlatforms: string[];
  /**
   * Fase 6 (spec 096, T6.4): idiomas do perfil (gm_profiles.languages,
   * códigos como 'pt-BR'). A herança pré-carrega o PRIMEIRO no estado do
   * editor, só na criação — mesa em edição mantém o valor salvo.
   */
  languages: string[];
}

function isProfileContact(value: unknown): value is ContactMethodInput {
  const contact = asRecord(value);
  if (contact === null || typeof contact.channel !== 'string' || typeof contact.value !== 'string') {
    return false;
  }
  // Canal fora do enum não vaza (mesma regra do PR #285): o snapshot alimenta
  // o estado do editor e um canal desconhecido quebraria a UI a jusante.
  return (TABLE_CONTACT_CHANNELS as readonly string[]).includes(contact.channel);
}

/**
 * Lista de string vinda de payload externo: descarta não-string, apara espaço e
 * remove o que sobra vazio. O trim/descarte não é cosmético — a herança usa
 * `preferredVttPlatforms[0]` como vttPlatformId (useTableEditor), e o guard de
 * lá testa o array, não o item: um "" no perfil viraria plataforma selecionada
 * em branco no editor. Não-array devolve [] (nunca propaga o valor inválido).
 */
function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Normaliza o corpo de GET /api/v1/gm/me para o snapshot de herança.
 * Devolve null quando não é perfil (id/slug ausentes) — o hook decide entre
 * "sem perfil" (404 do endpoint) e "inválido" (aqui).
 */
export function mapGmMeToSnapshot(value: unknown): GmProfileSnapshot | null {
  const data = asRecord(value);
  if (!data) return null;
  if (typeof data.id !== 'string' || typeof data.slug !== 'string') return null;

  const contactMethods: ContactMethodInput[] = Array.isArray(data.contact_methods)
    ? data.contact_methods
        .filter(isProfileContact)
        .map((c) => ({
          channel: c.channel as TableContactChannel,
          value: c.value,
          label: typeof c.label === 'string' ? c.label : '',
          discord_server_url: typeof c.discord_server_url === 'string' ? c.discord_server_url : '',
        }))
    : [];

  return {
    nickname: typeof data.nickname === 'string' ? data.nickname : '',
    bioLong: typeof data.bio_long === 'string' ? data.bio_long : '',
    contactMethods,
    // Fase 6 (T6.4): listas de string do perfil — entradas não-string saem
    // (payload externo, normalização obrigatória do repo).
    preferredVttPlatforms: normalizeStringList(data.preferred_vtt_platforms),
    languages: normalizeStringList(data.languages),
  };
}
