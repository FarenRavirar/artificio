// Derivação de mesa compartilhada entre SSR e cliente (spec 102 T4.2/T4.3).
//
// Vive em pacote, e não no frontend, por uma razão de contrato: a regra pétrea
// de T4.3 diz que nenhum fato pode existir só no JSON-LD — preço, vagas e data
// têm de estar também no HTML visível. Se o servidor derivasse esses valores
// por um caminho e o cliente por outro, os dois poderiam divergir sem que nada
// quebrasse, e o markup viraria alvo de ação manual de structured data.
// Uma função só, usada pelas duas pontas, torna a divergência impossível.
export { mapTableToView, normalizeNumeric } from './tableViewMapper.js';
export { normalizeAgeRating, ageRatingLabel, isRestrictedAgeRating, RESTRICTED_AGE_RATINGS } from './ageRating.js';
export {
  validateHttpsUrl,
  validateContactLinkUrl,
  validateContactValue,
  toSafeHttpsUrl,
  toSafeDiscordInviteUrl,
  toSafeMailtoUrl,
  toSafeSocialProfileUrl,
  toWhatsAppUrl,
  toDiscordUserId,
  formatWhatsAppDisplay,
  URL_VALUE_CHANNELS,
  HTTPS_ONLY_MESSAGE,
  INVALID_DISCORD_INVITE_MESSAGE,
  UNRESOLVABLE_URL_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  INVALID_WHATSAPP_MESSAGE,
  INVALID_SOCIAL_PROFILE_MESSAGE,
} from './contactUrls.js';
export type { SafeUrlResult } from './contactUrls.js';
export { TABLE_CONTACT_CHANNELS } from './types.js';
export type * from './types.js';
export type * from './viewModel.types.js';
