import { Video, Music, Radio, MessageCircle, FileText, Globe, Camera, Share2, Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Tipos de link do perfil — fonte única do frontend.
 *
 * Espelha `LinkType` de `backend/src/services/linkService.ts` (`detectLinkType`),
 * que é quem decide o tipo ao gravar. Antes existiam três cópias divergentes
 * (a união de `UserLink` com 6 tipos, o mapa do `LinksManager` com 11 e o do
 * `LinksDisplay` com 12). Em 2026-10-11 a cópia do `LinksManager` não tinha
 * `whatsapp`: o `<Icon />` recebia `undefined` e o ErrorBoundary derrubava a
 * aba Mestre de `/perfil` para todo mestre com link de `wa.me`. A paridade com
 * o backend é cobrada em `linkTypes.test.ts`.
 */
export const LINK_TYPES = [
  'youtube',
  'spotify',
  'twitch',
  'twitter',
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'whatsapp',
  'podcast',
  'article',
  'website',
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

const LINK_TYPE_ICONS: Record<LinkType, LucideIcon> = {
  youtube: Video,
  spotify: Music,
  twitch: Radio,
  twitter: MessageCircle,
  instagram: Camera,
  facebook: Share2,
  tiktok: Music,
  linkedin: Briefcase,
  whatsapp: MessageCircle,
  podcast: Radio,
  article: FileText,
  website: Globe,
};

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  twitch: 'Twitch',
  twitter: 'Twitter/X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  podcast: 'Podcast',
  article: 'Artigo',
  website: 'Website',
};

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}

/**
 * O tipo chega do servidor (dado externo): um tipo que o backend passe a gravar
 * antes de o frontend conhecê-lo cai no ícone genérico, nunca em `undefined`.
 */
export function linkTypeIcon(type: string): LucideIcon {
  return isLinkType(type) ? LINK_TYPE_ICONS[type] : Globe;
}

export function linkTypeLabel(type: string): string {
  return isLinkType(type) ? LINK_TYPE_LABELS[type] : 'Link';
}

/** Hostname para exibir; URL que o construtor recusa volta como veio. */
export function linkHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
