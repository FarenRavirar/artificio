export const HTTPS_ONLY_MESSAGE = 'Somente URLs https:// são aceitas.';
export const INVALID_DISCORD_INVITE_MESSAGE =
  'Use um convite https://discord.gg/... ou https://discord.com/invite/...';

export type SafeUrlResult =
  | { success: true; url: string }
  | { success: false; message: string };

const EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function validateHttpsUrl(value: string): SafeUrlResult {
  const trimmed = value.trim();
  if (!trimmed) return { success: false, message: 'URL obrigatória.' };

  if (EXPLICIT_SCHEME.test(trimmed) && !/^https:/i.test(trimmed)) {
    return { success: false, message: HTTPS_ONLY_MESSAGE };
  }

  try {
    const parsed = new URL(EXPLICIT_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'https:' || !parsed.hostname) {
      return { success: false, message: HTTPS_ONLY_MESSAGE };
    }
    return { success: true, url: parsed.toString() };
  } catch {
    return { success: false, message: 'URL inválida. Use um endereço https:// válido.' };
  }
}

/**
 * Canais cujo valor é uma URL — espelha URL_VALUE_CHANNELS do backend
 * (`utils/contactUrls.ts`). Fonte única no frontend: divergir entre formulário,
 * validação e renderização deixaria o mestre salvar valor que não vira link.
 */
export const URL_VALUE_CHANNELS = new Set(['form', 'facebook', 'instagram']);

export const UNRESOLVABLE_URL_MESSAGE =
  'Informe um endereço completo, como https://exemplo.com/inscricao. Se for um usuário do Discord, escolha o canal Discord.';

/**
 * Host que um navegador consegue de fato resolver.
 *
 * Espelha `isResolvableUrl` do backend (`utils/contactUrls.ts`) — divergir faria
 * o formulário aceitar valor que a API recusa, ou o contrário. `validateHttpsUrl`
 * aceita qualquer host sintaticamente válido, então `uwill` vira `https://uwill/`,
 * URL bem-formada que morre em erro de DNS. Link de contato exige rótulo com
 * ponto e TLD alfabético, o que descarta nick (`uwill`, `.zero9899`).
 */
const RESOLVABLE_HOST = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function validateContactLinkUrl(value: string): SafeUrlResult {
  const result = validateHttpsUrl(value);
  if (!result.success) return result;

  try {
    if (!RESOLVABLE_HOST.test(new URL(result.url).hostname)) {
      return { success: false, message: UNRESOLVABLE_URL_MESSAGE };
    }
  } catch {
    return { success: false, message: UNRESOLVABLE_URL_MESSAGE };
  }

  return result;
}

export function toSafeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const result = validateHttpsUrl(value);
  return result.success ? result.url : null;
}

export function toSafeDiscordInviteUrl(value: string | null | undefined): string | null {
  const safeUrl = toSafeHttpsUrl(value);
  if (!safeUrl) return null;

  const parsed = new URL(safeUrl);
  const hostname = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);
  const validDiscordGg = hostname === 'discord.gg' && segments.length === 1;
  const validDiscordCom =
    (hostname === 'discord.com' || hostname === 'www.discord.com') &&
    segments.length === 2 &&
    segments[0].toLowerCase() === 'invite';

  return validDiscordGg || validDiscordCom ? safeUrl : null;
}

/**
 * Telefone brasileiro vira link de WhatsApp, nunca `tel:`.
 *
 * Decisão do mantenedor (2026-08-03): no Brasil ninguém liga nem manda SMS para
 * contato de mesa — o número existe para abrir conversa no WhatsApp. `tel:`
 * abriria o discador, que é justamente o uso que não acontece. Mesma regra que
 * o canal `whatsapp`, por isso os dois compartilham este normalizador.
 *
 * O backend só valida formato internacional (`+5511999999999`) no canal
 * `whatsapp`; `phone` entra livre e o importador do Discord ainda o gera
 * automaticamente (`syncHelpers.ts`). Logo, aqui o valor é dígito solto de
 * origem desconhecida: extrai dígitos e exige DDD + número (10-13).
 *
 * O `+` inicial é código de país explícito e manda: sem ele, `+14155552671`
 * (EUA) virava `wa.me/5514155552671`, abrindo conversa com outra pessoa.
 * O prefixo 55 só entra em número local, que é o formato que o mestre
 * brasileiro digita sem pensar (`(11) 99999-9999`).
 */
export function toWhatsAppUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return null;

  const hasExplicitCountryCode = trimmed.startsWith('+');
  const withCountry = hasExplicitCountryCode || digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

/**
 * `mailto:` para endereço já validado, sem deixar o valor virar href cru.
 *
 * O backend valida e-mail na escrita (`isValidEmail`), mas contato antigo foi
 * gravado antes disso e o front nunca deve montar href a partir de texto não
 * verificado. Sem esta checagem, `mailto:` aceitaria qualquer coisa, incluindo
 * quebra de linha para forjar cabeçalho e `?subject=`/`?body=`, que o cliente
 * de e-mail interpreta como campos e usa para pré-preencher a mensagem.
 *
 * Por isso a regra é uma allow-list (`EMAIL_ADDRESS`), não uma lista de
 * caracteres proibidos: qualquer coisa fora do conjunto de um endereço válido
 * é recusada, sem depender de lembrar cada separador de query string.
 */
// `%` fica de fora da parte local, apesar de válido por RFC: é o que permite
// escrever conteúdo percent-encoded no endereço (`nome%0Ateste@x.com`), e
// nenhum provedor real emite caixa com `%`. Custo zero, remove a ambiguidade
// entre "caractere literal" e "byte codificado" antes de montar a URI.
const EMAIL_ADDRESS = /^[A-Za-z0-9!#$&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function toSafeMailtoUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return null;
  if (!EMAIL_ADDRESS.test(trimmed)) return null;

  // `encodeURIComponent`, não `encodeURI`: a allow-list aceita `?`, `&` e `#`
  // na parte local (são válidos por RFC), e `encodeURI` não escapa nenhum dos
  // três — `a&b@x.com` sairia como separador de campo do próprio `mailto:`.
  //
  // Codifica cada lado do `@` em separado, em vez de codificar tudo e reverter
  // o `%40` depois: `replace` com string literal troca só a primeira ocorrência
  // (achado do CodeQL), e reverter por busca acopla esta linha ao formato da
  // allow-list à distância — quem afrouxar a regex depois não leria aqui.
  // A allow-list já garante exatamente um `@`, então o split é seguro.
  const atIndex = trimmed.lastIndexOf('@');
  const localPart = encodeURIComponent(trimmed.slice(0, atIndex));
  const domain = encodeURIComponent(trimmed.slice(atIndex + 1));

  return `mailto:${localPart}@${domain}`;
}

const DISCORD_MENTION = /^<@!?(\d{17,20})>$/;
const DISCORD_SNOWFLAKE = /^\d{17,20}$/;

/**
 * Extrai o ID de usuário do Discord de um valor de contato, quando houver.
 *
 * Aceita snowflake cru (`123456789012345678`) e menção (`<@id>` / `<@!id>`),
 * formato que a importação de texto do Discord produz. Só o ID permite deep-link
 * de perfil; username não tem URL pública no Discord e fica como texto puro.
 */
export function toDiscordUserId(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const mentionId = DISCORD_MENTION.exec(trimmed)?.[1];
  if (mentionId) return mentionId;

  return DISCORD_SNOWFLAKE.test(trimmed) ? trimmed : null;
}

const SOCIAL_HOSTS = {
  facebook: { canonical: 'facebook.com', accepted: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com', 'm.facebook.com'] },
  instagram: { canonical: 'instagram.com', accepted: ['instagram.com', 'www.instagram.com', 'instagr.am', 'www.instagr.am'] },
} as const;

const SOCIAL_USERNAME = /^[A-Za-z0-9._-]{1,60}$/;

/**
 * Perfil de rede social a partir de URL completa ou de username cru.
 *
 * `contactSchema` canonicaliza `facebook`/`instagram` para HTTPS na escrita,
 * mas contato gravado antes disso guarda o username puro (`meuperfil`,
 * `@meuperfil`). Tratado como URL, `meuperfil` vira o host `meuperfil` e
 * `@meuperfil` é pior: o `@` é separador de userinfo, então o host some por
 * completo. Os dois resultavam em link morto na página pública.
 *
 * Só aceita host conhecido da própria rede — username vira caminho sob o
 * domínio canônico, nunca host arbitrário, para que valor hostil não escape
 * como redirecionamento externo.
 */
export function toSafeSocialProfileUrl(
  network: keyof typeof SOCIAL_HOSTS,
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const { canonical, accepted } = SOCIAL_HOSTS[network];
  const trimmed = value.trim();
  if (!trimmed) return null;

  const safeUrl = toSafeHttpsUrl(trimmed);
  if (safeUrl) {
    const parsed = new URL(safeUrl);
    if ((accepted as readonly string[]).includes(parsed.hostname.toLowerCase())) {
      return safeUrl;
    }
  }

  // Não é URL de host conhecido: só resta username. `@` é prefixo de exibição.
  const username = trimmed.replace(/^@/, '');
  if (!SOCIAL_USERNAME.test(username)) return null;

  return `https://${canonical}/${username}`;
}

export function openSafeExternalUrl(value: string | null | undefined): boolean {
  const safeUrl = toSafeHttpsUrl(value);
  if (!safeUrl) return false;
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
  return true;
}
