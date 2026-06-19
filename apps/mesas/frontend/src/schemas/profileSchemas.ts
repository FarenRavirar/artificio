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
  avatar_url: z
    .string()
    .refine(
      (val) => !val || val.trim() === '' || z.url().safeParse(val).success,
      { message: 'URL do avatar inválida' }
    )
    .optional()
    .nullable(),
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

export const gmStyleSchema = z.object({
  narrative: z.number().min(1).max(5).optional(),
  tactical: z.number().min(1).max(5).optional(),
  sandbox: z.number().min(1).max(5).optional(),
  railroad: z.number().min(1).max(5).optional(),
});

export const gameFormatSchema = z.object({
  session_length: z.string().optional(),
  frequency: z.string().optional(),
  group_size: z.string().optional(),
});

export const gmProfileSchema = z.object({
  nickname: z
    .string()
    .max(50, 'Apelido deve ter no máximo 50 caracteres')
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
  average_price: z
    .number()
    .min(0, 'Preço médio deve ser positivo')
    .optional()
    .nullable(),
  gm_style: gmStyleSchema.optional().nullable(),
  tools: z.array(z.string()).optional().nullable(),
  game_format: gameFormatSchema.optional().nullable(),
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
