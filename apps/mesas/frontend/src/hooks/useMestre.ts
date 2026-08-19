import { normalizeImageFrame, type CropRect } from '@artificio/media/image-kinds';
import { useEffect, useMemo, useState } from 'react';
import type { UserLink } from './useLinks';
import type { TableCard } from '../types/tables';
import { authGet } from '../services/apiClient';

export interface ViewerContext {
  is_owner: boolean;
  is_admin: boolean;
}

export interface SellingPoint {
  icon: string;
  title: string;
  description: string;
  highlight?: string;
}

export interface ClosedGroupInfo {
  enabled: boolean;
  systems: Array<{ id: string; name: string }>;
  description: string | null;
  min_price_cents: number | null;
}

export interface MestrePublicData {
  id: string;
  slug: string;
  display_name: string;
  bio_long: string | null;
  tagline?: string | null;
  avatar_url: string | null;
  // Enquadramento escolhido pelo mestre. Sem ele a imagem seria recortada
  // sempre pelo centro geometrico, que foi o defeito medido em producao.
  avatar_crop_data: CropRect | null;
  avatar_width: number | null;
  avatar_height: number | null;
  banner_url: string | null;
  banner_crop_data: CropRect | null;
  banner_width: number | null;
  banner_height: number | null;
  languages: string[];
  specialties: string[];
  badges: string[];
  selling_points?: SellingPoint[];
  promo_badge_text?: string | null;
  closed_group?: ClosedGroupInfo | null;
  tables_count: number;
  /** T9.1 (spec 081): total histórico de mesas hospedadas (inclui encerradas), diferente de tables_count (só ativas). */
  tables_hosted_count?: number;
  /** T9.1 (spec 081): anos na plataforma, calculado via created_at — DIFERENTE de experience_years (autodeclarado). */
  years_on_platform?: number;
  avg_rating: number | null;
  reviews_count: number;
  created_at: string;
  viewer_context?: ViewerContext;
  discord_connected?: boolean;
  discord_username?: string | null;
  covil_verified?: boolean;
  experience_years?: number | null;
  average_price?: number | null;
  links?: UserLink[];
  preferred_vtt_platforms?: Array<{
    id: string;
    name: string;
    slug: string;
    logo_filename: string | null;
    website_url: string | null;
  }>;
  contact_methods?: Array<{
    channel: 'whatsapp' | 'email' | 'discord' | 'form';
    value: string;
    label?: string;
    discord_server_url?: string;
  }>;
  tables: Array<Omit<TableCard, 'gm_slug' | 'gm_avatar_url' | 'gm_display_name'>>;
}

/**
 * Normaliza o enquadramento antes de o perfil entrar no estado do React.
 *
 * O corpo da resposta e `unknown` na pratica: o tipo declarado e promessa, e o
 * recorte vem de JSONB, que aceita qualquer forma. Retangulo malformado
 * chegaria a `cropToObjectPosition` no `MestreHero` e produziria
 * `NaN% NaN%` — descartado pelo navegador, devolvendo justamente o recorte
 * central que este trabalho existe para evitar.
 */
function normalizeMestreProfile(data: MestrePublicData | null | undefined): MestrePublicData | null {
  if (!data) return null;
  const avatar = normalizeImageFrame(data, 'avatar');
  const banner = normalizeImageFrame(data, 'banner');
  return {
    ...data,
    avatar_crop_data: avatar.crop,
    avatar_width: avatar.width,
    avatar_height: avatar.height,
    banner_crop_data: banner.crop,
    banner_width: banner.width,
    banner_height: banner.height,
  };
}

interface GmProfilePayload {
  data: MestrePublicData;
}

export function useMestre(slug?: string) {
  const [profile, setProfile] = useState<MestrePublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadProfile = async () => {
      if (!slug) {
        setError('Perfil inválido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await authGet(`/api/v1/gm/perfis/${slug}`, { signal: controller.signal });

        if (res.status === 404) {
          setError('Mestre não encontrado.');
          setProfile(null);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as GmProfilePayload;
        setProfile(normalizeMestreProfile(json.data));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Não foi possível carregar o perfil do mestre.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
    return () => controller.abort();
  }, [slug]);

  const links = useMemo(() => profile?.links ?? [], [profile]);

  const mappedTables = useMemo(() => {
    if (!profile) return [] as TableCard[];

    return profile.tables.map((table) => ({
      ...table,
      gm_slug: profile.slug,
      gm_avatar_url: profile.avatar_url,
      gm_display_name: profile.display_name,
    }));
  }, [profile]);

  const totalOpenSlots = useMemo(() => {
    return mappedTables.reduce((acc, t) => acc + (t.slots_total - t.slots_filled), 0);
  }, [mappedTables]);

  const canSeeInsights = !!profile?.viewer_context?.is_owner || !!profile?.viewer_context?.is_admin;

  return {
    profile,
    links,
    mappedTables,
    totalOpenSlots,
    canSeeInsights,
    loading,
    error,
  };
}
