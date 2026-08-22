import { z } from 'zod';
import { sanitizeUserMarkdown } from '../utils/userMarkdown.js';
import { isValidEmail } from '../utils/validation.js';
import {
  canonicalizeContactValue,
  canonicalizeDiscordInviteUrl,
  PROFILE_CONTACT_CHANNELS,
} from '../utils/contactUrls.js';

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

export const contactSchema = z.object({
  channel: z.enum(CONTACT_CHANNELS),
  value: z.string().trim().min(1, 'Valor do contato é obrigatório').max(500, 'Valor do contato deve ter no máximo 500 caracteres'),
  label: z.string().trim().max(100, 'Rótulo deve ter no máximo 100 caracteres').nullable().optional(),
  discord_server_url: z.string().trim().max(500, 'URL do Discord deve ter no máximo 500 caracteres').nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
}).superRefine((contact, ctx) => {
  if (contact.channel === 'email' && !isValidEmail(contact.value)) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Email inválido' });
  }

  if (contact.channel === 'whatsapp' && !/^\+\d{1,3}\d{6,14}$/.test(contact.value)) {
    ctx.addIssue({
      code: 'custom',
      path: ['value'],
      message: 'WhatsApp deve estar no formato internacional, como +5511999999999',
    });
  }

  // Facebook/Instagram exigem host da própria rede; `form` exige host alcançável.
  // A regra por canal vive em canonicalizeContactValue para que validação e
  // persistência (`.transform` abaixo) nunca divirjam.
  const externalValue = canonicalizeContactValue(contact.channel, contact.value);
  if (externalValue && !externalValue.ok) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: externalValue.message });
  }

  if (contact.discord_server_url && contact.channel !== 'discord') {
    ctx.addIssue({
      code: 'custom',
      path: ['discord_server_url'],
      message: 'Link de servidor Discord só é permitido no canal Discord',
    });
  }

  if (contact.discord_server_url) {
    const result = canonicalizeDiscordInviteUrl(contact.discord_server_url);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', path: ['discord_server_url'], message: result.message });
    }
  }
}).transform((contact) => {
  const externalValue = canonicalizeContactValue(contact.channel, contact.value);
  const discordUrl = contact.discord_server_url
    ? canonicalizeDiscordInviteUrl(contact.discord_server_url)
    : null;

  return {
    ...contact,
    value: externalValue?.ok ? externalValue.value : contact.value,
    label: contact.label || null,
    discord_server_url: discordUrl?.ok ? discordUrl.value : null,
  };
});

export const contactMethodsSchema = z.array(contactSchema).superRefine((contacts, ctx) => {
  contacts.forEach((contact, index) => {
    if (!PROFILE_CONTACT_CHANNELS.has(contact.channel)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'channel'],
        message: 'Canal não suportado no perfil do mestre',
      });
    }
  });
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

const userMarkdownSchema = (maxLength: number) =>
  z.string().max(maxLength).transform(sanitizeUserMarkdown).nullable().optional();

const baseTableSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200, 'Título muito longo'),
  description: userMarkdownSchema(5000),
  system_id: z.string().uuid('Sistema inválido').nullable().optional(),
  scenario_id: z.string().uuid('Cenário inválido').nullable().optional(),
  type: z.enum(TABLE_TYPES),
  audience: z.enum(TABLE_AUDIENCES).default('livre'),
  modality: z.enum(TABLE_MODALITIES),
  price_type: z.enum(PRICE_TYPES).default('gratuita'),
  price_value: z.number().min(0).nullable().optional(),
  price_value_monthly: z.number().min(0).nullable().optional(),
  // Doações são exclusivas de mesa gratuita. `accepts_donations` é optional
  // SEM `.default(false)` de propósito: no PUT (.partial()), campo omitido
  // fica undefined e o Kysely preserva o valor salvo — um default reescreveria
  // false em toda edição que não manda o campo, apagando a doação. No create,
  // omitido também vira undefined e o service grava false (coluna DEFAULT).
  accepts_donations: z.boolean().optional(),
  suggested_donation_value: z.number().min(0).nullable().optional(),
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
  rules_notes: userMarkdownSchema(2000),
  banner_url: z.url().nullable().optional(),
  // Retangulo de recorte em pixels da imagem ARMAZENADA. Coordenada negativa
  // ou dimensao <= 0 nao descreve area valida e produziria `object-position`
  // sem sentido na exibicao.
  banner_crop_data: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  }).nullable().optional(),
  // Dimensoes da imagem armazenada. Sem elas o recorte acima nao e conversivel
  // em `object-position` e o enquadramento salvo nao aparece.
  banner_width: z.number().int().positive().nullable().optional(),
  banner_height: z.number().int().positive().nullable().optional(),
  gm_avatar_url: z.url().nullable().optional(),
  is_covil: z.boolean().default(false),
  master_display_name: z.string().max(100).nullable().optional(),
  campaign_length: z.string().max(100).nullable().optional(),
  level_range: z.string().max(50).nullable().optional(),
  billing_text: z.string().max(500).nullable().optional(),
  session_zero_free: z.boolean().default(false),
  synopsis: userMarkdownSchema(2000),
  style_text: userMarkdownSchema(1000),
  listing_excerpt: userMarkdownSchema(300),
  technical_requirements: userMarkdownSchema(1000),
  requires_pc: z.boolean().default(false),
  requires_camera: z.boolean().default(false),
  requires_microphone: z.boolean().default(false),
  setting_name: z.string().max(200).nullable().optional(),
  setting_styles: z.array(z.string()).nullable().optional(),
  synopsis_narrative: userMarkdownSchema(3000),
  benefits_text: userMarkdownSchema(2000),
  table_gm_bio: userMarkdownSchema(2000),
  contacts: z.array(contactSchema).min(1, 'Informe ao menos um canal de contato'),
  schedules: z.array(scheduleSchema).optional(),
  // Requisito 8 (spec 079): quando a mesa nasce de um pré-preenchimento via
  // texto colado (POST /gm/parse-preview), o front reenvia esse id pra fechar
  // o loop de aprendizado — compara o payload publicado (com as correções do
  // mestre) contra a sugestão original do parser. Opcional: form em branco
  // não tem preview correlacionado.
  parse_case_id: z.string().uuid().nullable().optional(),
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
    // Decisão A2 do mantenedor (sessão 26-08-22_1, "endurecer"): mesa gratuita
    // não pode ter preço — avulso nem mensal. Simétrico ao refine do pacote
    // mensal abaixo (monthly exige paga): aqui o valor avulso também exige
    // paga. Sem este refine, mesa gratuita com price_value ficaria salva com
    // valor órfão (nunca exibido nem cobrado) — inconsistência silenciosa no
    // banco. `null` (front zera ao trocar para gratuita) não dispara o refine.
    if (data.price_value != null && data.price_type === 'gratuita') {
      return false;
    }
    return true;
  }, { 
    message: 'Mesa gratuita não pode ter preço — use o valor sugerido de doação', 
    path: ['price_value'] 
  })
  .refine((data) => {
    if (data.price_value_monthly != null && data.price_type !== 'paga') {
      return false;
    }
    return true;
  }, { 
    message: 'Pacote mensal só é permitido em mesas pagas', 
    path: ['price_value_monthly'] 
  })
  .refine((data) => {
    // `!= null` (e não "chave presente"): `suggested_donation_value: null`
    // significa "sem sugestão" e não pode forçar a mesa a ser gratuita.
    if ((data.accepts_donations === true || data.suggested_donation_value != null) && data.price_type !== 'gratuita') {
      return false;
    }
    return true;
  }, { 
    message: 'Doações são exclusivas de mesas gratuitas', 
    path: ['accepts_donations'] 
  })
  .refine((data) => {
    if (data.suggested_donation_value != null && data.accepts_donations !== true) {
      return false;
    }
    return true;
  }, { 
    message: "Valor sugerido exige marcar 'Aceita doações'", 
    path: ['suggested_donation_value'] 
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
  })
  .refine((data) => {
    // Decisão A2 do mantenedor (sessão 26-08-22_1, "endurecer"): simétrico do
    // refine do create — mesa gratuita não pode ter preço avulso. Mesma
    // interação `.default('gratuita')`/`.partial()` do refine do mensal abaixo:
    // PUT parcial que envie price_value sem price_type parseia como gratuita e
    // agora é REJEITADO, em vez de rebaixar silenciosamente a mesa paga para
    // gratuita com valor órfão — fecha o achado lateral pré-existente ("PUT
    // parcial sem price_type"). O form de edição envia price_type sempre
    // (mapper.ts) e zera price_value com null ao trocar para gratuita, então o
    // fluxo normal não é afetado.
    if (data.price_value != null && data.price_type === 'gratuita') {
      return false;
    }
    return true;
  }, {
    message: 'Mesa gratuita não pode ter preço — use o valor sugerido de doação',
    path: ['price_value']
  })
  .refine((data) => {
    // `price_type` tem `.default('gratuita')` no baseTableSchema e o `.partial()`
    // preserva o default: num PUT que envie monthly sem price_type, o dado
    // resultante seria mesa gratuita com pacote mensal — contradição de
    // contrato, então rejeita igual. O form de edição envia price_type sempre
    // (mapper.ts), então o fluxo normal não é afetado.
    if (data.price_value_monthly != null && data.price_type === 'gratuita') {
      return false;
    }
    return true;
  }, {
    message: 'Pacote mensal só é permitido em mesas pagas',
    path: ['price_value_monthly']
  })
  .refine((data) => {
    // Mesma interação `.default()`/`.partial()` do refine acima, invertida:
    // PUT com doação mas sem price_type parseia como gratuita (default), que é
    // o único caso válido — o refine então passa, e o preço salvo da mesa paga
    // é o que fica inconsistente no banco (achado pré-existente "PUT parcial
    // sem price_type", fora desta feature). `accepts_donations` não tem default:
    // omitido fica undefined e o Kysely preserva o valor salvo.
    if ((data.accepts_donations === true || data.suggested_donation_value != null) && data.price_type === 'paga') {
      return false;
    }
    return true;
  }, {
    message: 'Doações são exclusivas de mesas gratuitas',
    path: ['accepts_donations']
  })
  .refine((data) => {
    if (data.suggested_donation_value != null && data.accepts_donations !== true) {
      return false;
    }
    return true;
  }, {
    message: "Valor sugerido exige marcar 'Aceita doações'",
    path: ['suggested_donation_value']
  });

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type TableContact = z.infer<typeof contactSchema>;
export type TableSchedule = z.infer<typeof scheduleSchema>;
