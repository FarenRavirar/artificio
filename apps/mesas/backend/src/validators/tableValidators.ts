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
// Valores reais do ENUM Postgres `age_rating` (medido em produção via
// pg_enum: livre|+10|+12|+14|+16|+18; coluna nullable DEFAULT 'livre').
// Mesma lista do parser (syncHelpers.ts VALID_AGE_RATINGS) e do select do
// StepConfig — fonte única para o contrato do payload (T3.2, spec 096).
export const TABLE_AGE_RATINGS = ['livre', '+10', '+12', '+14', '+16', '+18'] as const;
export const PRICE_TYPES = ['gratuita', 'paga'] as const;
export const PRICE_FREQUENCIES = ['sessao', 'mes', 'campanha'] as const;
export const EXPERIENCE_LEVELS = ['todos', 'iniciante', 'intermediario', 'veterano'] as const;
// Valores reais do ENUM Postgres `table_level` (medido em produção via
// pg_enum: iniciante|intermediario|avancado|todos; coluna nullable DEFAULT
// 'todos'). 'todos' é o próprio DEFAULT da coluna — o tipo em db/types.ts
// espelha a mesma lista.
export const TABLE_LEVELS = ['iniciante', 'intermediario', 'avancado', 'todos'] as const;
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

// Campos markdown do usuário: sanitiza na escrita e normaliza branco-puro
// para null. Vale para TODOS os campos do baseTableSchema que usam este schema
// (9, medido via `rg "userMarkdownSchema(" tableValidators.ts`): description,
// rules_notes, synopsis, style_text, listing_excerpt, technical_requirements,
// synopsis_narrative, benefits_text, table_gm_bio. Amplitude intencional
// (aprovada): um ponto só cobre create + update.
//
// Motivo do branco→null: causa raiz do bug OG medido em produção (2026-08-22)
// — `synopsis: "\n"` persistida fazia a cadeia de descrição escolher "\n" e o
// `og:description` sair vazio. Normalizar aqui fecha a escrita em todas as
// portas de create/update (o fluxo Discord persiste fora do zod e tem
// normalização própria em syncHelpers.ts).
//
// null/undefined de entrada DEVEM continuar passando intactos — a ordem
// `.transform(...).nullable().optional()` garante isso (o transform só roda
// para string). Inverter a ordem (nullable ANTES do transform) reintroduziria
// o bug do PATCH apagar campo salvo: gmPanel.ts (~1012-1019, PR #278) confia
// em que campo omitido fique `undefined` e o Kysely preserve o valor gravado.
const userMarkdownSchema = (maxLength: number) =>
  z
    .string()
    .max(maxLength)
    .transform((value) => {
      const sanitized = sanitizeUserMarkdown(value);
      return sanitized.trim() === '' ? null : sanitized;
    })
    .nullable()
    .optional();

const baseTableSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200, 'Título muito longo'),
  description: userMarkdownSchema(5000),
  system_id: z.string().uuid('Sistema inválido').nullable().optional(),
  scenario_id: z.string().uuid('Cenário inválido').nullable().optional(),
  type: z.enum(TABLE_TYPES),
  audience: z.enum(TABLE_AUDIENCES).default('livre'),
  // T3.2 (spec 096): a UI coletava faixa etária e nível da mesa, o payload
  // descartava (strict + campos ausentes do schema) e o banco gravava o
  // default — mestre que escolheu "+18" tinha mesa "livre". Defaults espelham
  // os defaults reais das colunas (DEFAULT 'livre' / DEFAULT 'todos', medido
  // via information_schema em produção). CUIDADO no PUT: `.partial()`
  // materializa estes defaults — o handler só grava quando o body enviou o
  // campo (hasOwnProperty), senão editar qualquer coisa rebaixaria a faixa
  // salva para 'livre' (mesma armadilha do price_type, gmPanel.ts:944-953).
  age_rating: z.enum(TABLE_AGE_RATINGS).nullable().default('livre'),
  table_level: z.enum(TABLE_LEVELS).nullable().default('todos'),
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
  // T3.2d (spec 096): slots_filled ganhou ESCRITOR no fluxo manual — o mapper
  // envia slots_total - slots_open (mesma semântica do parser,
  // parseDiscordAnnouncement.ts:2820, e do leitor getSlotsVisualState). A
  // relação <= slots_total é o CHECK `slots_filled_valid` do Postgres; sem o
  // refine, um cliente fora do form mandaria filled > total e levaria 500 do
  // banco em vez de 400 (classe do bug normalizeSlots, syncHelpers.ts:361).
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
  // T3.2c (spec 096, decisão 2026-08-23 opção C): gm_avatar_url sai do
  // contrato do FORM — campo sem UI no fluxo atual. A resposta da API
  // continua (alias computado COALESCE(gm.avatar_url, p.avatar_url) em
  // routes/tables.ts:160,638); só o payload de create/update perde o campo.
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

/**
 * Invariantes de cobrança da mesa (decisão A2 do mantenedor, sessão
 * 26-08-22_1, "endurecer"): gratuita não pode ter preço, paga exige preço,
 * mensal e doações são exclusivos da própria modalidade. Cada regra define
 * check/message/path UMA vez e é aplicada em três pontos, na ordem da cadeia
 * de cada schema:
 *
 * - createTableSchema: as 5 regras sobre o payload completo;
 * - handler PUT /gm/tables/:id: as 5 regras via pricingConsistencySchema
 *   sobre o ESTADO RESULTANTE (linha salva + payload) antes de gravar —
 *   achado Codex (PR #283): validar só o payload deixava passar PUT parcial
 *   que produzia mesa inválida no banco (ex.: doações numa mesa paga);
 * - updateTableSchema NÃO aplica as regras de relação: o `.partial()` com o
 *   `.default('gratuita')` materializado rejeitava PUT parcial válido contra a
 *   linha salva antes do merge (ex.: mesa paga + `{ price_value_monthly: 40 }`
 *   sem price_type) — achado Codex (PR #283, segunda rodada). A relação é do
 *   estado resultante; o schema do update mantém só a forma de cada campo.
 *
 * `z.coerce.number()` (e não `z.number()`) no schema completo: no handler,
 * price_value salvo chega do Kysely como string quando o pg não tem parser
 * para o OID 1700 (db/types.ts:903) — o mesmo formato que o front normaliza
 * no mapper (tableViewMapper.normalizeNumeric). Coerce é neutro para número
 * já parseado nos usos de payload.
 */
type PricingData = {
  // Propriedade opcional (e não `price_type: ... | undefined`) para casar com
  // o output type do `.partial()` do updateTableSchema. Em runtime o
  // `.default('gratuita')` garante 'gratuita' | 'paga' nos três usos.
  price_type?: 'gratuita' | 'paga';
  price_value?: number | null;
  price_value_monthly?: number | null;
  accepts_donations?: boolean;
  suggested_donation_value?: number | null;
};

export const pricingRules = {
  paidNeedsPrice: {
    check: (d: PricingData) => !(d.price_type === 'paga' && (d.price_value == null || d.price_value <= 0)),
    message: 'Valor obrigatório para mesas pagas',
    path: ['price_value'],
  },
  freeCannotHavePrice: {
    check: (d: PricingData) => !(d.price_value != null && d.price_type === 'gratuita'),
    message: 'Mesa gratuita não pode ter preço — use o valor sugerido de doação',
    path: ['price_value'],
  },
  monthlyOnlyPaid: {
    check: (d: PricingData) => !(d.price_value_monthly != null && d.price_type !== 'paga'),
    message: 'Pacote mensal só é permitido em mesas pagas',
    path: ['price_value_monthly'],
  },
  donationOnlyFree: {
    check: (d: PricingData) =>
      !(
        (d.accepts_donations === true || d.suggested_donation_value != null) &&
        d.price_type !== 'gratuita'
      ),
    message: 'Doações são exclusivas de mesas gratuitas',
    path: ['accepts_donations'],
  },
  suggestedNeedsAccept: {
    check: (d: PricingData) => !(d.suggested_donation_value != null && d.accepts_donations !== true),
    message: "Valor sugerido exige marcar 'Aceita doações'",
    path: ['suggested_donation_value'],
  },
} as const;

/**
 * Aplica os 5 invariantes de cobrança (pricingRules) na ordem canônica.
 * Usado por createTableSchema (sobre o payload completo) e por
 * pricingConsistencySchema (sobre o estado resultante do PUT) — o bloco de
 * refine fica definido uma única vez (achado SonarQube: blocos duplicados nos
 * dois schemas). A ordem fixa preserva a ordem de issues do 400 da rota.
 */
function withPricingRules<S extends z.ZodTypeAny>(schema: S) {
  // Cast para PricingData: o generic de output não é afunilado pelo TS, mas os
  // dois únicos usos (createTableSchema e pricingConsistencySchema) garantem
  // os cinco campos no objeto que chega a estes checks.
  return schema
    .refine((d) => pricingRules.paidNeedsPrice.check(d as PricingData), {
      message: pricingRules.paidNeedsPrice.message,
      path: [...pricingRules.paidNeedsPrice.path],
    })
    .refine((d) => pricingRules.freeCannotHavePrice.check(d as PricingData), {
      message: pricingRules.freeCannotHavePrice.message,
      path: [...pricingRules.freeCannotHavePrice.path],
    })
    .refine((d) => pricingRules.monthlyOnlyPaid.check(d as PricingData), {
      message: pricingRules.monthlyOnlyPaid.message,
      path: [...pricingRules.monthlyOnlyPaid.path],
    })
    .refine((d) => pricingRules.donationOnlyFree.check(d as PricingData), {
      message: pricingRules.donationOnlyFree.message,
      path: [...pricingRules.donationOnlyFree.path],
    })
    .refine((d) => pricingRules.suggestedNeedsAccept.check(d as PricingData), {
      message: pricingRules.suggestedNeedsAccept.message,
      path: [...pricingRules.suggestedNeedsAccept.path],
    });
}

export const pricingConsistencySchema = withPricingRules(
  z.object({
    price_type: z.enum(PRICE_TYPES),
    price_value: z.coerce.number().min(0).nullable().optional(),
    price_value_monthly: z.coerce.number().min(0).nullable().optional(),
    accepts_donations: z.boolean().optional(),
    suggested_donation_value: z.coerce.number().min(0).nullable().optional(),
  }),
);

export const createTableSchema = withPricingRules(
  baseTableSchema
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
      // Espelha o CHECK `slots_filled_valid` do Postgres (filled <= total) —
      // 400 antes de chegar no banco (T3.2d, spec 096).
      return data.slots_filled <= data.slots_total;
    }, {
      message: 'Vagas preenchidas não pode ser maior que vagas totais',
      path: ['slots_filled']
    }),
).refine((data) => {
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
    // PUT parcial: só valida a relação quando os DOIS campos vieram no body
    // (mesmo padrão do slots_open acima) — a linha salva não é visível aqui.
    if (data.slots_filled !== undefined && data.slots_total !== undefined) {
      return data.slots_filled <= data.slots_total;
    }
    return true;
  }, {
    message: 'Vagas preenchidas não pode ser maior que vagas totais',
    path: ['slots_filled']
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
  // Invariantes de cobrança NÃO são validados neste schema: com o `.partial()`
  // e o `.default('gratuita')` do price_type, um PUT parcial válido contra a
  // linha salva (ex.: mesa paga + `{ price_value_monthly: 40 }` sem
  // price_type) era rejeitado ANTES do merge — o default materializado fazia o
  // payload parecer gratuita. A relação entre os campos é validada
  // exclusivamente sobre o ESTADO RESULTANTE no handler PUT /gm/tables/:id
  // (mergePricingState + pricingConsistencySchema; achado Codex PR #283,
  // segunda rodada). Aqui fica só a FORMA de cada campo (z.number().min(0)
  // etc. do baseTableSchema) — price_value_monthly: -1 continua rejeitado no
  // parse. O form de edição envia price_type sempre (mapper.ts), então o
  // fluxo normal não muda.;

/**
 * Linha salva com os campos de cobrança, para a validação do PUT parcial.
 */
export interface TablePricingRow {
  price_type: 'gratuita' | 'paga';
  price_value: number | null;
  price_value_monthly: number | null;
  accepts_donations: boolean;
  suggested_donation_value: number | null;
}

/**
 * Estado resultante dos campos de cobrança para a validação do PUT parcial:
 * campo ENVIADO no body vence; campo omitido herda o valor salvo. Distinguir
 * enviado de omitido exige `hasOwnProperty` no body cru — o schema com
 * `.default('gratuita')` materializa price_type mesmo quando omitido, então
 * `payload.price_type` não serve como sinal de envio. Usado pelo handler
 * PUT /gm/tables/:id antes de gravar (achado Codex PR #283).
 */
export function mergePricingState(
  payload: UpdateTableInput,
  body: Record<string, unknown>,
  existing: TablePricingRow,
): TablePricingRow {
  const sent = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  return {
    price_type: sent('price_type') ? (payload.price_type ?? existing.price_type) : existing.price_type,
    price_value: sent('price_value') ? (payload.price_value ?? null) : existing.price_value,
    price_value_monthly: sent('price_value_monthly')
      ? (payload.price_value_monthly ?? null)
      : existing.price_value_monthly,
    accepts_donations: sent('accepts_donations')
      ? (payload.accepts_donations ?? existing.accepts_donations)
      : existing.accepts_donations,
    suggested_donation_value: sent('suggested_donation_value')
      ? (payload.suggested_donation_value ?? null)
      : existing.suggested_donation_value,
  };
}

/**
 * Linha salva com os campos de vagas, para a validação do PUT parcial.
 */
export interface TableSlotsRow {
  slots_total: number;
  slots_filled: number;
  slots_open: number;
}

/**
 * Estado resultante das vagas para a validação do PUT parcial: campo ENVIADO
 * no body vence, omitido herda o salvo. Mesmo padrão de `mergePricingState`.
 *
 * Por que o refine do `updateTableSchema` não basta (achado Codex, PR #285):
 * a linha salva não é visível de dentro do schema. O patch que escapava é o
 * de **só `slots_total`**, reduzido abaixo do `slots_filled` salvo — que é
 * exatamente o que o form de edição envia, já que ele omite `slots_filled`
 * (mapper.ts). Medido: patch só com `slots_filled` ou só com `slots_open` NÃO
 * escapa, porque o `.partial()` preserva o `.default(4)` de `slots_total` e o
 * refine dispara no parse comparando contra esse default.
 *
 * Não havia corrupção de dado: os CHECKs do Postgres (`slots_filled_valid`,
 * `check_slots_valid`) barram a escrita. O defeito era o mestre levar 500 em
 * vez de 400 com mensagem. Medido em produção: 9 mesas com
 * `slots_filled >= 3` alcançam esse caminho ao reduzir o total.
 */
export function mergeSlotsState(
  payload: UpdateTableInput,
  body: Record<string, unknown>,
  existing: TableSlotsRow,
): TableSlotsRow {
  const sent = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  return {
    slots_total: sent('slots_total') ? (payload.slots_total ?? existing.slots_total) : existing.slots_total,
    slots_filled: sent('slots_filled') ? (payload.slots_filled ?? existing.slots_filled) : existing.slots_filled,
    slots_open: sent('slots_open') ? (payload.slots_open ?? existing.slots_open) : existing.slots_open,
  };
}

/**
 * Invariantes de vagas sobre o ESTADO RESULTANTE, espelhando os CHECKs do
 * Postgres para devolver 400 com mensagem em vez de 500 do banco.
 */
export const slotsConsistencySchema = z
  .object({
    slots_total: z.number().int().min(0),
    slots_filled: z.number().int().min(0),
    slots_open: z.number().int().min(0),
  })
  .refine((s) => s.slots_filled <= s.slots_total, {
    message: 'Vagas preenchidas não pode ser maior que vagas totais',
    path: ['slots_filled'],
  })
  .refine((s) => s.slots_open <= s.slots_total, {
    message: 'Vagas abertas não pode ser maior que vagas totais',
    path: ['slots_open'],
  });

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type TableContact = z.infer<typeof contactSchema>;
export type TableSchedule = z.infer<typeof scheduleSchema>;
