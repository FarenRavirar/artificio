import type { CropRect } from '@artificio/media/image-kinds';

export interface PlayerProfile {
  experience_level: 'iniciante' | 'intermediario' | 'veterano' | null;
  playstyle: {
    combat?: number;
    roleplay?: number;
    exploration?: number;
    strategy?: number;
  } | null;
  preferred_days: string[] | null;
  preferred_time: 'manha' | 'tarde' | 'noite' | null;
  pricing_preference: 'free' | 'paid' | 'both' | null;
}

export interface GmProfile {
  id: string;
  user_id: string;
  slug: string;
  nickname: string | null;
  bio_long: string | null;
  avatar_url: string | null;
  // Enquadramento do avatar: retangulo em pixels da imagem armazenada mais as
  // dimensoes dela. Viram `object-position` na exibicao, sem alterar o arquivo.
  avatar_crop_data: CropRect | null;
  avatar_width: number | null;
  avatar_height: number | null;
  banner_url: string | null;
  banner_crop_data: CropRect | null;
  banner_width: number | null;
  banner_height: number | null;
  /**
   * Foto do perfil GERAL (`profiles`), devolvida por `GET /gm/me` somente
   * quando `avatar_url` acima e null. Existe para as previas do perfil
   * publico espelharem o `COALESCE(gm.avatar_url, p.avatar_url)` da rota
   * publica sem cada tela precisar buscar `/profile/me` por conta.
   */
  general_avatar?: {
    avatar_url: string | null;
    avatar_crop_data: CropRect | null;
    avatar_width: number | null;
    avatar_height: number | null;
  } | null;
  languages: string[];
  specialties: string[];
  discord_connected: boolean;
  discord_username: string | null;
  covil_verified: boolean;
  experience_years: number | null;
  // Spec 099 B9 / D4: `average_price` saiu do tipo junto com o campo do editor
  // (nenhum leitor restante — medido por rg no front). O backend ainda devolve
  // a chave no GET; chave extra sem declaração é tolerada pelo cast de `api`.
  // O preço exibido ao jogador é o da MESA (table.price_value) e do grupo
  // fechado (min_price_cents) — ambos continuam (D4).
  // Campos do perfil público v2 gravados pelo PUT /api/v1/gm/profile
  // (spec 099 B1/B2): `tagline` encabeça as três cadeias (hero/OG/SEO);
  // `closed_group_*` alimenta a seção de grupos fechados.
  tagline?: string | null;
  closed_group_enabled?: boolean | null;
  closed_group_systems?: string[] | null;
  closed_group_description?: string | null;
  closed_group_min_price_cents?: number | null;
  // Spec 099 B3/B4/B5: `badges`/`promo_badge_text` aceitos pelo PUT e pelo
  // `gmProfileSchema`; `selling_points` vem cru do JSONB (o achado A1 mediu
  // `{}` em 7/12 perfis do beta) — tipado `unknown` para obrigar o consumidor
  // a normalizar antes de usar (normalizeSellingPoints, useMestre.ts).
  badges?: string[] | null;
  promo_badge_text?: string | null;
  selling_points?: unknown;
  gm_style: {
    narrative?: number;
    tactical?: number;
    sandbox?: number;
    railroad?: number;
  } | null;
  tools: string[] | null;
  game_format: {
    session_length?: string;
    frequency?: string;
    group_size?: string;
  } | null;
  preferred_vtt_platforms?: string[];
  /** communication_platforms do mestre (Discord, Meet, Teams) — migration_166. */
  preferred_communication_platforms?: string[];
  contact_methods?: Array<{
    channel: 'whatsapp' | 'email' | 'discord' | 'form';
    value: string;
    label?: string;
    discord_server_url?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface UserSystem {
  id: string;
  user_id: string;
  system_id: string;
  type: 'favorite' | 'gm';
  created_at: string;
}

export interface FullProfile {
  user: {
    id: string;
    email: string;
    username: string | null;
    location: string | null;
    role: string;
    created_at: string;
  };
  profile: {
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_crop_data: CropRect | null;
    avatar_width: number | null;
    avatar_height: number | null;
    languages: string[];
  } | null;
  player: PlayerProfile | null;
  gm: GmProfile | null;
  systems: {
    favorite: UserSystem[];
    gm: UserSystem[];
  };
}
