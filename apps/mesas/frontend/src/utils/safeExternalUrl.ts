// Normalizadores de URL de contato — fonte única em `@artificio/catalog-table`
// (spec 102 T4.2, `plan.md` §5.1). Subiram para o pacote porque o SSR monta os
// mesmos links (WhatsApp, Discord, e-mail) que o cliente, e o `Offer` de T4.3
// depende deles no servidor.
//
// Só `openSafeExternalUrl` continua aqui: usa `window.open`, que não existe no
// servidor. Manter a divisão explícita evita que alguém importe o pacote no SSR
// e descubra a quebra em runtime.
export {
  HTTPS_ONLY_MESSAGE,
  INVALID_DISCORD_INVITE_MESSAGE,
  UNRESOLVABLE_URL_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  INVALID_WHATSAPP_MESSAGE,
  INVALID_SOCIAL_PROFILE_MESSAGE,
  URL_VALUE_CHANNELS,
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
} from '@artificio/catalog-table';
export type { SafeUrlResult } from '@artificio/catalog-table';

import { toSafeHttpsUrl } from '@artificio/catalog-table';

export function openSafeExternalUrl(value: string | null | undefined): boolean {
  const safeUrl = toSafeHttpsUrl(value);
  if (!safeUrl) return false;
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
}
