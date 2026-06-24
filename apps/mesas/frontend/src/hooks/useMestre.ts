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
  banner_url: string | null;
  languages: string[];
  specialties: string[];
  badges: string[];
  selling_points?: SellingPoint[];
  promo_badge_text?: string | null;
  closed_group?: ClosedGroupInfo | null;
  tables_count: number;
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
        const res = await authGet(`/api/v1/gm/${slug}`, { signal: controller.signal });

        if (res.status === 404) {
          setError('Mestre não encontrado.');
          setProfile(null);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as GmProfilePayload;
        setProfile(json.data ?? null);
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
