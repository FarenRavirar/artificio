import { normalizeImageFrame, type CropRect } from '@artificio/media/image-kinds';
import { useEffect, useMemo, useState } from 'react';
import type { UserLink } from './useLinks';
import type { TableCard } from '../types/tables';
import { authGet } from '../services/apiClient';
import { toFiniteNumber } from '@artificio/ui';

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
  /** migration_166: Discord/Meet/Teams. Sem `logo_filename` — a tabela
      `communication_platforms` não tem essa coluna. */
  preferred_communication_platforms?: Array<{
    id: string;
    name: string;
    slug: string;
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
 * Normaliza `selling_points` vindo da API antes de entrar no estado.
 *
 * O campo vem cru do banco (JSONB) e no beta 7/12 perfis devolvem `{}` em vez
 * de array. O cast (`as GmProfilePayload`) nao valida nada, e o `?? []` dos
 * consumidores nao protege contra objeto. Aqui, todo nao-array vira `[]` e
 * cada item precisa de `icon`, `title` e `description` como strings nao
 * vazias; `highlight` so entra quando e string. Quem renderiza recebe
 * `SellingPoint[]` de verdade (spec 099, criterios A5/A9).
 *
 * Nao lanca nunca: so usa `Array.isArray` e `typeof` sobre entrada `unknown`.
 */
export function normalizeSellingPoints(input: unknown): SellingPoint[] {
  if (!Array.isArray(input)) return [];

  const points: SellingPoint[] = [];
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue;
    const item = raw as Record<string, unknown>;

    const icon = item.icon;
    const title = item.title;
    const description = item.description;
    if (typeof icon !== 'string' || icon.length === 0) continue;
    // `.trim()` e nao `.length`: "   " tem length 3 e passava, renderizando um
    // destaque em branco na pagina publica. O formulario ja usa trim
    // (`isValidSellingPoint`, profileEditorDomain.ts:48) — sem isto as duas
    // camadas divergem, e o item entra por qualquer caminho que nao seja o
    // editor (achado de review, PR #297).
    if (typeof title !== 'string' || title.trim().length === 0) continue;
    if (typeof description !== 'string' || description.trim().length === 0) continue;

    const point: SellingPoint = { icon, title, description };
    if (typeof item.highlight === 'string') {
      point.highlight = item.highlight;
    }
    points.push(point);
  }
  return points;
}

/**
 * Normaliza o enquadramento antes de o perfil entrar no estado do React.
 *
 * O corpo da resposta e `unknown` na pratica: o tipo declarado e promessa, e o
 * recorte vem de JSONB, que aceita qualquer forma. Retangulo malformado
 * chegaria a `cropToObjectPosition` no `MestreHero` e produziria
 * `NaN% NaN%` — descartado pelo navegador, devolvendo justamente o recorte
 * central que este trabalho existe para evitar.
 *
 * Exportada para teste direto da normalizacao de entrada (mesmo padrao dos
 * utils puros do repo); consumidores seguem usando apenas o hook.
 */
export function normalizeMestreProfile(data: MestrePublicData | null | undefined): MestrePublicData | null {
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
    // `selling_points` cru do banco: `{}` em 7/12 perfis do beta (JSONB).
    // Normalizar aqui e o que garante `SellingPoint[]` para todo consumidor —
    // sem isso `MestrePage` passaria `{}` adiante e `MestreSellingPoints`
    // renderizaria lixo no lugar da secao.
    selling_points: normalizeSellingPoints(data.selling_points),
    // `avg_rating` é NUMERIC(3,2) e o parser default do `pg` entrega string.
    // O payload chega por cast (`as GmProfilePayload`), sem validação, então o
    // tipo `number | null` não garante nada em runtime. Converter aqui, na
    // entrada, mantém o estado honesto: durante um deploy em que o frontend sobe
    // antes do backend a API ainda devolve "5.00", e sem isso qualquer consumidor
    // novo repete o `.toFixed()` que derrubou o catálogo em produção.
    avg_rating: toFiniteNumber(data.avg_rating),
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

  // `canSeeInsights` saiu daqui na spec 100 (T3.3): ele existia só para o
  // perfil público decidir se renderizava Insights e Recomendações, e as duas
  // seções passaram ao /painel, que autoriza pela própria rota autenticada.
  // O tipo `viewer_context` fica — é contrato da API, não derivado desta tela.
  return {
    profile,
    links,
    mappedTables,
    totalOpenSlots,
    loading,
    error,
  };
}
