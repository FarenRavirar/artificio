import { z } from 'zod';

// ============================================================================
// ENUMS E CONSTANTES
// ============================================================================

export const TABLE_TYPES = ['campanha', 'one-shot', 'oneshot-serie', 'aberta'] as const;
export const TABLE_MODALITIES = ['online', 'presencial', 'hibrida'] as const;
export const TABLE_AUDIENCES = ['livre', 'adultos'] as const;
export const PRICE_TYPES = ['gratuita', 'paga'] as const;
export const PRICE_FREQUENCIES = ['sessao', 'mes', 'campanha'] as const;
export const EXPERIENCE_LEVELS = ['todos', 'iniciante', 'intermediario', 'veterano'] as const;
export const PUBLISHER_ROLES = ['gm', 'announcer'] as const;
export const CONTACT_CHANNELS = ['whatsapp', 'discord', 'phone', 'email', 'facebook', 'instagram', 'form'] as const;
export const DAYS_OF_WEEK = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;
export const SCHEDULE_FREQUENCIES = ['semanal', 'quinzenal', 'mensal', 'avulsa'] as const;
export const SCHEDULE_DEFINITION_STATUSES = ['defined', 'to_define'] as const;

// ============================================================================
// SCHEMAS DE VALIDAÇÃO
// ============================================================================

const contactSchema = z.object({
  channel: z.enum(CONTACT_CHANNELS),
  value: z.string().min(1, 'Valor do contato é obrigatório'),
  label: z.string().nullable().optional(),
  discord_server_url: z.union([
    z.string().url('URL do Discord inválida'),
    z.literal('')
  ]).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

const scheduleSchema = z.object({
  day_of_week: z.enum(DAYS_OF_WEEK),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato de horário inválido (HH:MM ou HH:MM:SS)'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato de horário inválido').nullable().optional(),
  frequency: z.enum(SCHEDULE_FREQUENCIES),
  slots_per_session: z.number().int().min(1).max(100).nullable().optional(),
  is_ongoing: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

const baseTableSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200, 'Título muito longo'),
  description: z.string().max(5000).nullable().optional(),
  system_id: z.string().uuid('Sistema inválido').nullable().optional(),
  scenario_id: z.string().uuid('Cenário inválido').nullable().optional(),
  type: z.enum(TABLE_TYPES),
  audience: z.enum(TABLE_AUDIENCES).default('livre'),
  modality: z.enum(TABLE_MODALITIES),
  price_type: z.enum(PRICE_TYPES).default('gratuita'),
  price_value: z.number().min(0).nullable().optional(),
  price_frequency: z.enum(PRICE_FREQUENCIES).nullable().optional(),
  slots_total: z.number().int().min(1).max(100).default(4),
  slots_filled: z.number().int().min(0).default(0),
  slots_open: z.number().int().min(0).optional(),
  language: z.string().max(50).default('Português'),
  experience_level: z.enum(EXPERIENCE_LEVELS).default('todos'),
  starts_at: z.string().datetime().nullable().optional(),
  schedule_day_status: z.enum(SCHEDULE_DEFINITION_STATUSES).default('defined'),
  schedule_time_status: z.enum(SCHEDULE_DEFINITION_STATUSES).default('defined'),
  schedule_day_hint: z.enum(DAYS_OF_WEEK).nullable().optional(),
  schedule_time_hint: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Formato de horário inválido').nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(2).nullable().optional(),
  content_warnings: z.array(z.string()).default([]),
  safety_tools: z.array(z.string()).default([]),
  publisher_role: z.enum(PUBLISHER_ROLES).default('gm'),
  actual_gm_name: z.string().min(2).max(100).nullable().optional(),
  is_ddal: z.boolean().default(false),
  ddal_code: z.string().max(50).nullable().optional(),
  ddal_name: z.string().max(200).nullable().optional(),
  ddal_tier: z.number().int().min(1).max(4).nullable().optional(),
  ddal_season: z.string().max(50).nullable().optional(),
  ddal_duration: z.string().max(50).nullable().optional(),
  ddal_format: z.string().max(50).nullable().optional(),
  ddal_org_code: z.string().max(50).nullable().optional(),
  ddal_setting: z.string().max(100).nullable().optional(),
  ddal_rules_notes: z.string().max(1000).nullable().optional(),
  vtt_platform_id: z.string().nullable().optional(),
  game_platform_custom: z.string().max(100).nullable().optional(),
  communication_platform_id: z.string().uuid('Plataforma de comunicação inválida').nullable().optional(),
  communication_platform: z.string().max(100).nullable().optional(),
  rules_notes: z.string().max(2000).nullable().optional(),
  banner_url: z.string().url().nullable().optional(),
  banner_crop_data: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).nullable().optional(),
  gm_avatar_url: z.string().url().nullable().optional(),
  is_covil: z.boolean().default(false),
  master_display_name: z.string().max(100).nullable().optional(),
  campaign_length: z.string().max(100).nullable().optional(),
  level_range: z.string().max(50).nullable().optional(),
  billing_text: z.string().max(500).nullable().optional(),
  session_zero_free: z.boolean().default(false),
  synopsis: z.string().max(2000).nullable().optional(),
  style_text: z.string().max(1000).nullable().optional(),
  listing_excerpt: z.string().max(300).nullable().optional(),
  technical_requirements: z.string().max(1000).nullable().optional(),
  requires_pc: z.boolean().default(false),
  requires_camera: z.boolean().default(false),
  requires_microphone: z.boolean().default(false),
  setting_name: z.string().max(200).nullable().optional(),
  setting_styles: z.array(z.string()).nullable().optional(),
  synopsis_narrative: z.string().max(3000).nullable().optional(),
  benefits_text: z.string().max(2000).nullable().optional(),
  table_gm_bio: z.string().max(2000).nullable().optional(),
  contacts: z.array(contactSchema).min(1, 'Informe ao menos um canal de contato'),
  schedules: z.array(scheduleSchema).optional(),
});

export const createTableSchema = baseTableSchema
  .strict()
  .refine((data) => !!data.system_id, { 
    message: 'Sistema é obrigatório', 
    path: ['system_id'] 
  })
  .refine((data) => {
    const slotsOpen = data.slots_open ?? data.slots_total;
    return slotsOpen <= data.slots_total;
  }, { 
    message: 'Vagas abertas não pode ser maior que vagas totais', 
    path: ['slots_open'] 
  })
  .refine((data) => {
    if (data.price_type === 'paga' && (!data.price_value || data.price_value <= 0)) {
      return false;
    }
    return true;
  }, { 
    message: 'Valor obrigatório para mesas pagas', 
    path: ['price_value'] 
  })
  .refine((data) => {
    if (data.publisher_role === 'announcer' && !data.actual_gm_name) return false;
    return true;
  }, { 
    message: 'Nome do mestre real obrigatório quando for anunciante', 
    path: ['actual_gm_name'] 
  })
  .refine((data) => {
    if (data.vtt_platform_id === 'custom' && !data.game_platform_custom) return false;
    return true;
  }, { 
    message: 'Nome da plataforma obrigatório quando selecionar "Personalizado"', 
    path: ['game_platform_custom'] 
  })
  .refine((data) => {
    if (data.schedule_day_status === 'to_define' && data.schedule_day_hint) return false;
    return true;
  }, {
    message: 'Dia a definir não deve enviar dia preenchido',
    path: ['schedule_day_hint']
  })
  .refine((data) => {
    if (data.schedule_time_status === 'to_define' && data.schedule_time_hint) return false;
    return true;
  }, {
    message: 'Horário a definir não deve enviar horário preenchido',
    path: ['schedule_time_hint']
  })
  .refine((data) => {
    if ((data.vtt_platform_id || data.game_platform_custom) && 
        data.modality !== 'online' && data.modality !== 'hibrida') {
      return false;
    }
    return true;
  }, { 
    message: 'Plataforma VTT só para mesas online ou híbridas', 
    path: ['vtt_platform_id'] 
  })
  .refine((data) => {
    if (data.is_ddal && (!data.ddal_code || !data.ddal_name || !data.ddal_tier)) {
      return false;
    }
    return true;
  }, { 
    message: 'Campos DDAL incompletos (código, nome, tier)', 
    path: ['is_ddal'] 
  });

export const updateTableSchema = baseTableSchema
  .partial()
  .strict()
  .refine((data) => {
    if (data.slots_open !== undefined && data.slots_total !== undefined) {
      return data.slots_open <= data.slots_total;
    }
    return true;
  }, { 
    message: 'Vagas abertas não pode ser maior que vagas totais', 
    path: ['slots_open'] 
  })
  .refine((data) => {
    if (data.publisher_role === 'announcer' && !data.actual_gm_name) return false;
    return true;
  }, { 
    message: 'Nome do mestre real obrigatório quando for anunciante', 
    path: ['actual_gm_name'] 
  })
  .refine((data) => {
    if (data.is_ddal === true && (!data.ddal_code || !data.ddal_name || !data.ddal_tier)) {
      return false;
    }
    return true;
  }, { 
    message: 'Campos DDAL incompletos', 
    path: ['is_ddal'] 
  })
  .refine((data) => {
    if (data.schedule_day_status === 'to_define' && data.schedule_day_hint) return false;
    return true;
  }, {
    message: 'Dia a definir não deve enviar dia preenchido',
    path: ['schedule_day_hint']
  })
  .refine((data) => {
    if (data.schedule_time_status === 'to_define' && data.schedule_time_hint) return false;
    return true;
  }, {
    message: 'Horário a definir não deve enviar horário preenchido',
    path: ['schedule_time_hint']
  });

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type TableContact = z.infer<typeof contactSchema>;
export type TableSchedule = z.infer<typeof scheduleSchema>;
