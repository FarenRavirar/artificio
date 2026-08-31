import { z } from 'zod';

/**
 * Schemas de validação para perfil de usuário
 * Usados tanto no frontend quanto no backend para garantir consistência
 */

// ============================================================================
// USER
// ============================================================================

export const userSchema = z.object({
  username: z
    .string()
    .min(3, 'Username deve ter no mínimo 3 caracteres')
    .max(30, 'Username deve ter no máximo 30 caracteres')
    .regex(
      /^[a-z0-9_]+$/,
      'Username deve conter apenas letras minúsculas, números e underscore'
    )
    .optional(),
  location: z
    .string()
    .max(100, 'Localização deve ter no máximo 100 caracteres')
    .optional(),
});

export type UserUpdateInput = z.infer<typeof userSchema>;

// ============================================================================
// PROFILE
// ============================================================================

/**
 * Enquadramento de imagem, compartilhado entre perfil geral e perfil de mestre.
 *
 * `z.object` remove chave desconhecida no parse, entao campo ausente aqui NAO
 * chega ao backend — foi assim que `banner_url` e `avatar_url` do mestre
 * sumiam silenciosamente do PATCH (medido: parse devolvia so `nickname`).
 * Todo campo que a UI edita precisa estar declarado.
 */
const imageUrlSchema = z
  .string()
  .refine((val) => !val || val.trim() === '' || z.url().safeParse(val).success, {
    message: 'URL de imagem inválida',
  })
  .optional()
  .nullable();

const cropRectSchema = z
  .object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .optional()
  .nullable();

const imageDimensionSchema = z.number().int().positive().optional().nullable();

export const profileSchema = z.object({
  display_name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres')
    .optional(),
  bio: z
    .string()
    .max(500, 'Bio deve ter no máximo 500 caracteres')
    .optional()
    .nullable(),
  avatar_url: imageUrlSchema,
  avatar_crop_data: cropRectSchema,
  avatar_width: imageDimensionSchema,
  avatar_height: imageDimensionSchema,
  languages: z
    .array(z.string())
    .min(1, 'Selecione pelo menos um idioma')
    .optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileSchema>;

// ============================================================================
// PLAYER PROFILE
// ============================================================================

export const playstyleSchema = z.object({
  combat: z.number().min(1).max(5).optional(),
  roleplay: z.number().min(1).max(5).optional(),
  exploration: z.number().min(1).max(5).optional(),
  strategy: z.number().min(1).max(5).optional(),
});

export const playerProfileSchema = z.object({
  experience_level: z
    .enum(['iniciante', 'intermediario', 'veterano'])
    .optional()
    .nullable(),
  playstyle: playstyleSchema.optional().nullable(),
  preferred_days: z.array(z.string()).optional().nullable(),
  preferred_time: z
    .enum(['manha', 'tarde', 'noite'])
    .optional()
    .nullable(),
  pricing_preference: z
    .enum(['free', 'paid', 'both'])
    .optional()
    .nullable(),
});

export type PlayerProfileUpdateInput = z.infer<typeof playerProfileSchema>;

// ============================================================================
// GM PROFILE
// ============================================================================

export const sellingPointSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
  highlight: z.string().optional(),
});

export const gmProfileSchema = z.object({
  nickname: z
    .string()
    .min(2, 'Apelido deve ter no mínimo 2 caracteres')
    .max(40, 'Apelido deve ter no máximo 40 caracteres')
    .optional()
    .nullable(),
  bio_long: z
    .string()
    .max(2000, 'Biografia deve ter no máximo 2000 caracteres')
    .optional()
    .nullable(),
  languages: z
    .array(z.string())
    .min(1, 'Selecione pelo menos um idioma')
    .optional(),
  specialties: z.array(z.string()).optional().nullable(),
  experience_years: z
    .number()
    .min(0, 'Anos de experiência deve ser positivo')
    .max(100, 'Anos de experiência deve ser no máximo 100')
    .optional()
    .nullable(),
  // Spec 099 B9 / D4: `average_price` ("Preço Médio") saiu do editor e deste
  // schema. O backend continua aceitando a chave no PUT (inofensivo — a coluna
  // e o handler ficam intactos), mas o front não a envia mais: removida aqui,
  // `z.object` descarta chave extra no parse e nenhum payload do cliente volta
  // a carregar o valor. O preço da MESA e o do GRUPO FECHADO continuam (D4).
  // Campos do perfil público v2: o PUT /api/v1/gm/profile os aceita com os
  // mesmos cortes do backend (200/120) — declarados aqui porque `z.object`
  // descarta chave desconhecida no parse e o campo nunca chegaria à rota.
  tagline: z
    .string()
    .max(200, 'Slogan deve ter no máximo 200 caracteres')
    .optional()
    .nullable(),
  promo_badge_text: z
    .string()
    .max(120, 'Texto do selo deve ter no máximo 120 caracteres')
    .optional()
    .nullable(),
  badges: z.array(z.string()).optional().nullable(),
  selling_points: z.array(sellingPointSchema).optional().nullable(),
  // B2: campos de grupo fechado — o PUT /api/v1/gm/profile os aceita com as
  // mesmas regras do backend (boolean; UUIDs; markdown sanitizado; inteiro
  // não-negativo em centavos). Declarados aqui porque `z.object` descarta
  // chave desconhecida no parse (mesma lição de tagline/promo_badge_text).
  closed_group_enabled: z.boolean().optional().nullable(),
  closed_group_systems: z.array(z.string()).optional().nullable(),
  closed_group_description: z.string().optional().nullable(),
  closed_group_min_price_cents: z
    .number()
    .int('Preço mínimo deve ser em centavos inteiros')
    .min(0, 'Preço mínimo deve ser positivo')
    .optional()
    .nullable(),
  avatar_url: imageUrlSchema,
  avatar_crop_data: cropRectSchema,
  avatar_width: imageDimensionSchema,
  avatar_height: imageDimensionSchema,
  banner_url: imageUrlSchema,
  banner_crop_data: cropRectSchema,
  banner_width: imageDimensionSchema,
  banner_height: imageDimensionSchema,
});

export type GmProfileUpdateInput = z.infer<typeof gmProfileSchema>;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Valida dados e retorna resultado tipado ou lança erro com mensagem amigável
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Pegar primeira mensagem de erro
      const firstError = error.issues[0];
      throw new Error(firstError.message, { cause: error });
    }
    throw error;
  }
}

/**
 * Valida dados e retorna resultado ou null (sem lançar erro)
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: 'Erro de validação' };
  }
}
