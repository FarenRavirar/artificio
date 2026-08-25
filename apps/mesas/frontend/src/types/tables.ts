export type TableStatus = 'draft' | 'active' | 'full' | 'cancelled' | 'ended' | 'pending_review';
export type TableModality = 'online' | 'presencial' | 'hibrida';
export type TableAgeRating = 'livre' | '+10' | '+12' | '+14' | '+16' | '+18';
export type PriceType = 'gratuita' | 'paga';
export type ExperienceLevel = 'todos' | 'iniciante' | 'intermediario' | 'veterano';
export type CatalogSeal = 'ddal' | 'covil-do-lich' | '';
export type PublisherRole = 'gm' | 'announcer';
/**
 * Os 7 canais de contato — MESA e PERFIL (T4.0r, spec 096 R12, decisão
 * 2026-08-24: "os 7 valem nos dois lados"). Espelha CONTACT_CHANNELS do
 * backend (`utils/contactUrls.ts`), que é a fonte canônica: divergir faria o
 * editor aceitar canal que a API recusa, ou o contato sumir na serialização.
 *
 * Antes o MESMO conceito vivia em três lugares (ContactMethodsEditor,
 * MestreContactMethods e ContactsFormBlock), com os dois primeiros restritos a
 * 4 valores — um canal novo salvo pelo perfil nem aparecia na página pública.
 * A lista em RUNTIME (`TABLE_CONTACT_CHANNELS`) existe para normalizar payload
 * de rede (canal fora do enum não vaza — mesma regra do PR #285).
 */
export const TABLE_CONTACT_CHANNELS = [
  'whatsapp',
  'discord',
  'phone',
  'email',
  'facebook',
  'instagram',
  'form',
] as const;
export type TableContactChannel = (typeof TABLE_CONTACT_CHANNELS)[number];

/**
 * Contato no formato de EDIÇÃO (perfil E mesa) — shape único consolidado
 * (T4.0r). É o que o editor de contatos lê/escreve; `label` e
 * `discord_server_url` são strings vazias quando ausentes (diferente de
 * `TableContact` de leitura pública, que usa null).
 */
export interface ContactMethodInput {
  channel: TableContactChannel;
  value: string;
  label: string;
  discord_server_url: string;
}

export interface TableContact {
  channel: TableContactChannel;
  value: string;
  label: string | null;
  discord_server_url: string | null;
  sort_order: number;
}

export type DayOfWeek = 'segunda' | 'terça' | 'quarta' | 'quinta' | 'sexta' | 'sábado' | 'domingo';
export type ScheduleFrequency = 'semanal' | 'quinzenal' | 'mensal' | 'avulsa';
export type ScheduleDefinitionStatus = 'defined' | 'to_define';

export interface TableSchedule {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string; // HH:MM:SS
  end_time: string | null;
  frequency: ScheduleFrequency;
  slots_per_session: number | null;
  is_ongoing: boolean;
  notes: string | null;
  sort_order: number;
}

export interface TableCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  cover_crop_data?: { x: number; y: number; width: number; height: number } | null;
  // Dimensões da imagem armazenada. Sem elas o recorte acima não é conversível
  // em `object-position`: a conta divide pela FOLGA (imagem menos recorte).
  cover_width?: number | null;
  cover_height?: number | null;
  status: TableStatus;
  archived_at?: string | null; // D-MESAS1: timestamp de arquivamento (null = ativa)
  type: string;
  audience: string;
  modality: TableModality;
  price_type: PriceType;
  price_value: number | null;
  slots_total: number;
  slots_filled: number;
  slots_open: number; // REQ-02: Vagas abertas para recrutamento
  language: string;
  experience_level: ExperienceLevel;
  featured: boolean;
  publisher_role: PublisherRole;
  actual_gm_name: string | null;
  contacts: TableContact[];
  system_name: string | null;
  system_slug: string | null;
  system_logo_filename?: string | null;
  system_website_url?: string | null;
  gm_slug: string | null;
  gm_user_id?: string | null;
  gm_avatar_url: string | null;
  gm_display_name: string | null;
  gm_bio_long: string | null; // CORREÇÃO HP-10: Bio global do perfil do mestre
  gm_avg_rating?: number | null; // T3.7/T6/T8.6 (spec 081): rating resumido do GM
  gm_reviews_count?: number | null;
  // T3.4 (spec 081): primeiro horário configurado (day_of_week/start_time recorrentes,
  // sem data absoluta — não existe "próxima sessão" calculável, é o padrão da mesa).
  // T4.0u (spec 096): schedule_day_status/notes chegam da lista (backend compõe no
  // next_schedule) para o card exibir "Horário Personalizado" (R20) — aditivo.
  next_schedule?: {
    day_of_week: DayOfWeek;
    start_time: string;
    frequency: ScheduleFrequency;
    schedule_day_status?: ScheduleDefinitionStatus;
    notes?: string | null;
  } | null;
  is_ddal: boolean;
  is_covil: boolean; // CORREÇÃO C01: Padronizado para is_covil (mesmo nome do backend)
  ddal_code?: string | null;
  ddal_name?: string | null;
  ddal_tier?: number | null;
  created_at: string;
  metrics?: {
    views: number;
    clicks: number;
    contacts: number;
    favorites: number;
  };
  synopsis_narrative?: string | null;
  score?: number;
  // CORREÇÃO REG-09: Adicionar campos de cenário e estilos
  setting_name?: string | null;
  setting_styles?: string[] | null;
  // CORREÇÃO C-HIGH-02: Mover vtt_platform para TableCard para exibição em catálogo
  vtt_platform?: {
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  } | null;
  game_platform_custom?: string | null; // Quando mestre escolhe "Personalizado"
  // R24/A27 (spec 096): faixa etária no card do catálogo. Opcional para não
  // quebrar consumidores/fixtures montados antes do campo existir na lista.
  age_rating?: TableAgeRating | null;
}

export interface TableDetail extends TableCard {
  price_frequency: string | null;
  price_value_monthly: number | null; // Valor individual por sessão no pacote mensal (opcional, mesa paga)
  accepts_donations: boolean; // Doações (exclusivo de mesa gratuita)
  suggested_donation_value: number | null; // Valor sugerido por sessão (opcional; exige accepts_donations)
  starts_at: string | null;
  schedule_day_status?: ScheduleDefinitionStatus;
  schedule_time_status?: ScheduleDefinitionStatus;
  schedule_day_hint?: DayOfWeek | null;
  schedule_time_hint?: string | null;
  city: string | null;
  state: string | null;
  content_warnings: string[];
  safety_tools: string[];
  table_gm_bio: string | null;
  scenario_name?: string | null;
  scenario_subgenres?: string[];
  schedules?: TableSchedule[];
  // VTT Platform (Migration 006)
  vtt_platform?: {
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  } | null;
  game_platform_custom?: string | null; // Quando mestre escolhe "Personalizado"
  communication_platform?: string | null; // CORREÇÃO C06: Plataforma de comunicação
  origin?: 'manual' | 'imported';
  ddal_season?: string | null;
  ddal_duration?: string | null;
  ddal_format?: string | null;
  ddal_org_code?: string | null;
  ddal_setting?: string | null;
  ddal_rules_notes?: string | null;
  // Campos avançados (REQ-26)
  master_display_name?: string | null;
  campaign_length?: string | null;
  level_range?: string | null;
  billing_text?: string | null;
  session_zero_free?: boolean;
  synopsis?: string | null;
  style_text?: string | null;
  listing_excerpt?: string | null;
  technical_requirements?: string | null;
  requires_pc?: boolean;
  requires_camera?: boolean;
  requires_microphone?: boolean;
  // Campos de cenário e estilos (REQ-28)
  setting_name?: string | null;
  setting_styles?: string[] | null;
  // REQ-28 Fase 7: Campos editoriais separados
  synopsis_narrative?: string | null;
  benefits_text?: string | null;
  // Plataformas VTT preferidas do mestre
  gm_vtt_platforms?: Array<{
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  }>;
}

export interface TablesResponse {
  data: TableCard[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
    total?: number; // CORREÇÃO DT-05: Total de mesas ativas
  };
}
