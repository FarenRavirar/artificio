import type { SessionSchedule } from '../../../components/SessionRepeater';
import type { ContactFormEntry } from '../../../components/ContactsFormBlock';

export type FormStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface DdalFormState {
  is_ddal: boolean;
  ddal_code: string;
  ddal_name: string;
  ddal_tier: string;
  ddal_season: string;
  ddal_duration: string;
  ddal_format: string;
  ddal_org_code: string;
  ddal_setting: string;
  ddal_rules_notes: string;
}

export interface BasicFormData {
  title: string;
  description: string;
  type: string;
  modality: string;
  audience: string;
  age_rating: string;
  price_type: string;
  price_value: string;
  slots_total: string;
  slots_open: string; // REQ-02: Vagas abertas para recrutamento
  experience_level: string;
  table_level: string;
  language: string;
  // CORREÇÃO REG-04: Campos ausentes
  starts_at?: string;
  schedule_day_status?: 'defined' | 'to_define';
  schedule_time_status?: 'defined' | 'to_define';
  schedule_day_hint?: SessionSchedule['day_of_week'] | null;
  schedule_time_hint?: string | null;
  city?: string;
  state?: string;
  content_warnings?: string[];
  safety_tools?: string[];
  price_frequency?: string;
}

export interface FormState {
  // Dados básicos
  form: BasicFormData;
  
  // Sistema e cenário
  selectedSystemId: string;
  selectedScenarioId: string | null;
  
  // Sessões
  sessions: SessionSchedule[];
  
  // VTT Platform (select com opção "Personalizado")
  vttPlatformId: string; // ID da VTT selecionada ou "custom"
  gamePlatformCustom: string; // Texto livre quando vttPlatformId === "custom"
  
  // Plataforma de comunicação (catálogo + fallback legado)
  communicationPlatformId: string; // UUID selecionado ou "custom"
  communicationPlatformCustom: string; // texto livre quando communicationPlatformId === "custom"
  
  // Configuração
  publisherRole: 'gm' | 'announcer';
  actualGmName: string;
  
  // Contatos
  contacts: ContactFormEntry[];
  
  // Finalização
  rulesNotes: string;
  bannerUrl: string;
  bannerCropData: { x: number; y: number; width: number; height: number } | null;
  gmAvatarUrl: string;
  isCovilMesa: boolean;
  ddal: DdalFormState;
  
  // Campos avançados
  masterDisplayName: string;
  campaignLength: string;
  levelRange: string;
  billingText: string;
  sessionZeroFree: boolean;
  synopsis: string;
  styleText: string;
  listingExcerpt: string;
  technicalRequirements: string;
  requiresPc: boolean;
  requiresCamera: boolean;
  requiresMicrophone: boolean;
  
  // Cenário e estilos
  settingName: string;
  settingStyles: string[];
  
  // Campos editoriais Fase 6 (REQ-28)
  synopsisNarrative: string;
  benefitsText: string;
  tableGmBio: string;
}

export interface CreateTablePayload {
  title: string;
  description: string;
  type: string;
  modality: string;
  price_type: string;
  slots_total: number;
  slots_open: number; // REQ-02: Vagas abertas para recrutamento
  language: string;
  system_id: string;
  scenario_id: string | null;
  schedules: SessionSchedule[]; // CORREÇÃO REG-01: Renomeado de sessions para schedules
  contacts: Array<{
    channel: string;
    value: string;
    label?: string;
    discord_server_url?: string;
  }>;
  publisher_role: 'gm' | 'announcer';
  actual_gm_name: string | null;
  rules_notes: string;
  banner_url?: string;
  banner_crop_data?: { x: number; y: number; width: number; height: number };
  gm_avatar_url?: string;
  is_covil: boolean;
  is_ddal: boolean;
  // CORREÇÃO REG-04, REG-05, REG-06: Campos ausentes no payload
  audience?: string;
  experience_level?: string;
  starts_at?: string;
  schedule_day_status?: 'defined' | 'to_define';
  schedule_time_status?: 'defined' | 'to_define';
  schedule_day_hint?: string | null;
  schedule_time_hint?: string | null;
  city?: string;
  state?: string;
  content_warnings?: string[];
  safety_tools?: string[];
  // VTT Platform
  vtt_platform_id?: string;
  game_platform_custom?: string;
  communication_platform_id?: string;
  communication_platform?: string;
  price_value?: number;
  price_frequency?: string;
  ddal_code?: string;
  ddal_name?: string;
  ddal_tier?: number;
  ddal_season?: string;
  ddal_duration?: string;
  ddal_format?: string;
  ddal_org_code?: string;
  ddal_setting?: string;
  ddal_rules_notes?: string;
  master_display_name?: string;
  campaign_length?: string;
  level_range?: string;
  billing_text?: string;
  session_zero_free?: boolean;
  synopsis?: string;
  style_text?: string;
  listing_excerpt?: string;
  technical_requirements?: string;
  requires_pc?: boolean;
  requires_camera?: boolean;
  requires_microphone?: boolean;
  setting_name?: string;
  setting_styles?: string[];
  // Campos editoriais Fase 6 (REQ-28)
  synopsis_narrative?: string;
  benefits_text?: string;
  table_gm_bio?: string;
}

export type DraftStatus = 'idle' | 'saving' | 'saved';
