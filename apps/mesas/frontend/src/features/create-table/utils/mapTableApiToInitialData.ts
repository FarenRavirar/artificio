import type { SessionSchedule } from '../../../components/SessionRepeater';
import type { ContactFormEntry } from '../../../components/ContactsFormBlock';
import type { FormState } from '../types/createTable.types';

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord | null {
  return typeof value === 'object' && value !== null ? (value as ApiRecord) : null;
}

function stringValue(data: ApiRecord, key: string, fallback = ''): string {
  const value = data[key];
  return value == null ? fallback : String(value);
}

function nullableStringValue(data: ApiRecord, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' ? value : null;
}

function booleanValue(data: ApiRecord, key: string, fallback = false): boolean {
  const value = data[key];
  return typeof value === 'boolean' ? value : fallback;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isCropData(value: unknown): value is { x: number; y: number; width: number; height: number } {
  const crop = asRecord(value);
  return (
    crop !== null &&
    typeof crop.x === 'number' &&
    typeof crop.y === 'number' &&
    typeof crop.width === 'number' &&
    typeof crop.height === 'number'
  );
}

function isContactEntry(value: unknown): value is ContactFormEntry {
  const contact = asRecord(value);
  return contact !== null && typeof contact.channel === 'string' && typeof contact.value === 'string';
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

function defaultSession(data: ApiRecord): SessionSchedule {
  return {
    day_of_week:
      data.schedule_day_status === 'to_define'
        ? 'to_define'
        : (nullableStringValue(data, 'schedule_day_hint') as SessionSchedule['day_of_week']) ?? 'segunda',
    start_time:
      data.schedule_time_status === 'to_define'
        ? ''
        : stringValue(data, 'schedule_time_hint', '19:00'),
    end_time: '',
    frequency: 'semanal',
    is_ongoing: false,
    notes: '',
    sort_order: 0,
  };
}

/**
 * Converte a resposta flat da API (GET /api/v1/tables/:id)
 * para a estrutura aninhada Partial<FormState> esperada pelo
 * useCreateTableForm como `initialData`.
 */
export function mapTableApiToInitialData(apiData: unknown): Partial<FormState> & { id?: string } {
  const data = asRecord(apiData);
  if (!data) return {};

  const sessions = Array.isArray(data.sessions) ? data.sessions.filter(isSessionSchedule) : [];
  const contacts = Array.isArray(data.contacts) ? data.contacts.filter(isContactEntry) : [];

  return {
    // Bug real (spec 081, reporte GM Douglas dos Santos 2026-07-10): id nunca
    // era incluido aqui, entao useCreateTableForm.submit (initialData?.id)
    // sempre calculava isEditing=false e toda edicao de mesa criava mesa nova
    // via POST em vez de atualizar via PUT.
    id: nullableStringValue(data, 'id') ?? undefined,

    form: {
      title: stringValue(data, 'title'),
      description: stringValue(data, 'description'),
      type: stringValue(data, 'type', 'campanha'),
      modality: stringValue(data, 'modality', 'online'),
      audience: stringValue(data, 'audience', 'livre'),
      age_rating: stringValue(data, 'age_rating', 'livre'),
      price_type: stringValue(data, 'price_type', 'free'),
      price_value: stringValue(data, 'price_value'),
      slots_total: stringValue(data, 'slots_total', '4'),
      slots_open: stringValue(data, 'slots_open', '4'),
      experience_level: stringValue(data, 'experience_level', 'todos'),
      table_level: stringValue(data, 'table_level'),
      language: stringValue(data, 'language', 'pt-BR'),
    },

    selectedSystemId: stringValue(data, 'system_id'),
    selectedScenarioId: nullableStringValue(data, 'scenario_id'),

    sessions: sessions.length > 0 ? sessions : [defaultSession(data)],

    vttPlatformId: stringValue(data, 'vtt_platform_id'),
    gamePlatformCustom: stringValue(data, 'game_platform_custom'),
    communicationPlatformId: data.communication_platform_id
      ? stringValue(data, 'communication_platform_id')
      : (data.communication_platform ? 'custom' : ''),
    communicationPlatformCustom: data.communication_platform_id
      ? ''
      : stringValue(data, 'communication_platform'),

    publisherRole: data.publisher_role === 'announcer' ? 'announcer' : 'gm',
    actualGmName: stringValue(data, 'actual_gm_name'),

    contacts,

    rulesNotes: stringValue(data, 'rules_notes'),
    bannerUrl: stringValue(data, 'banner_url') || stringValue(data, 'image_url'),
    bannerCropData: isCropData(data.banner_crop_data) ? data.banner_crop_data : null,
    gmAvatarUrl: stringValue(data, 'gm_avatar_url'),
    isCovilMesa: booleanValue(data, 'is_covil_mesa'),

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

    masterDisplayName: stringValue(data, 'master_display_name'),
    campaignLength: stringValue(data, 'campaign_length'),
    levelRange: stringValue(data, 'level_range'),
    billingText: stringValue(data, 'billing_text'),
    sessionZeroFree: booleanValue(data, 'session_zero_free'),

    synopsis: stringValue(data, 'synopsis'),
    styleText: stringValue(data, 'style_text'),
    listingExcerpt: stringValue(data, 'listing_excerpt'),
    technicalRequirements: stringValue(data, 'technical_requirements'),

    requiresPc: booleanValue(data, 'requires_pc'),
    requiresCamera: booleanValue(data, 'requires_camera'),
    requiresMicrophone: booleanValue(data, 'requires_microphone'),

    settingName: stringValue(data, 'setting_name'),
    settingStyles: stringArrayValue(data.setting_styles),

    synopsisNarrative: stringValue(data, 'synopsis_narrative'),
    benefitsText: stringValue(data, 'benefits_text'),
    tableGmBio: stringValue(data, 'table_gm_bio'),
  };
}
