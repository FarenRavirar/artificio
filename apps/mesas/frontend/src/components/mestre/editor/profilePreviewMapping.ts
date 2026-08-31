import type { CropRect } from '@artificio/media/image-kinds';
import {
  normalizeMestreProfile,
  normalizeSellingPoints,
  type MestrePublicData,
} from '../../../hooks/useMestre';

/**
 * Campos do editor → `MestrePublicData` de LEITURA para a prévia do perfil
 * público (spec 099 B10/D5/D8).
 *
 * Vive fora do MestreProfilePreview.tsx por causa do
 * `react-refresh/only-export-components` (arquivo de componente não exporta
 * função/constante — mesmo padrão do `cardPreviewMapping.ts` do editor de
 * mesa).
 */

/**
 * Campos que o editor tem, no shape do `GmProfile`/payload do `GET /gm/me`
 * (snake_case). Todos opcionais de propósito: as três telas de D5 editam
 * SUBCONJUNTOS diferentes — o mapeamento preenche o que existe e cai para
 * fallback neutro no que não existe (nunca inventa valor).
 */
export interface MestrePreviewSource {
  id?: string;
  slug?: string;
  nickname?: string | null;
  bio_long?: string | null;
  tagline?: string | null;
  avatar_url?: string | null;
  avatar_crop_data?: CropRect | null;
  avatar_width?: number | null;
  avatar_height?: number | null;
  banner_url?: string | null;
  banner_crop_data?: CropRect | null;
  banner_width?: number | null;
  banner_height?: number | null;
  languages?: string[] | null;
  specialties?: string[] | null;
  badges?: string[] | null;
  selling_points?: unknown;
  promo_badge_text?: string | null;
  covil_verified?: boolean | null;
  experience_years?: number | null;
  created_at?: string | null;
  tables_count?: number | null;
  avg_rating?: number | null;
}

/**
 * Monta o `MestrePublicData` da prévia a partir dos campos do editor.
 *
 * `display_name` espelha o COALESCE do GET público (backend gm.ts:144:
 * `COALESCE(gm.nickname, p.display_name, gm.slug)`) — a prévia mostra o MESMO
 * nome que o jogador vê, com a mesma cadeia de fallback.
 *
 * Campos que o editor não tem viram fallback neutro, nunca valor inventado:
 * `tables_count` 0, `avg_rating` null, `reviews_count` 0, `created_at` ''
 * (esconde `years_on_platform`), `tables` []. O hero público some com os
 * blocos zerados (hasAnyStat/hasAnyTrust), então a prévia não finge atividade.
 *
 * O resultado passa por `normalizeMestreProfile` — o MESMO normalizador da
 * fronteira do hook público: crop inválido vira null (sem `NaN%` no
 * object-position), `selling_points` não-array vira [] (o achado A1 mediu `{}`
 * em 7/12 perfis do beta) e `avg_rating` NUMERIC-string vira number.
 */
export function buildMestrePreviewData(
  source: MestrePreviewSource,
  userDisplayName?: string | null,
): MestrePublicData {
  const raw: MestrePublicData = {
    id: source.id ?? '',
    slug: source.slug ?? '',
    display_name: source.nickname ?? userDisplayName ?? source.slug ?? '',
    bio_long: source.bio_long ?? null,
    tagline: source.tagline ?? null,
    avatar_url: source.avatar_url ?? null,
    avatar_crop_data: source.avatar_crop_data ?? null,
    avatar_width: source.avatar_width ?? null,
    avatar_height: source.avatar_height ?? null,
    banner_url: source.banner_url ?? null,
    banner_crop_data: source.banner_crop_data ?? null,
    banner_width: source.banner_width ?? null,
    banner_height: source.banner_height ?? null,
    languages: source.languages ?? [],
    specialties: source.specialties ?? [],
    badges: source.badges ?? [],
    selling_points: normalizeSellingPoints(source.selling_points),
    promo_badge_text: source.promo_badge_text ?? null,
    covil_verified: source.covil_verified ?? false,
    experience_years: source.experience_years ?? null,
    tables_count: source.tables_count ?? 0,
    avg_rating: source.avg_rating ?? null,
    reviews_count: 0,
    created_at: source.created_at ?? '',
    tables: [],
  };
  // normalizeMestreProfile só devolve null quando a entrada é null/undefined —
  // aqui a entrada é sempre o objeto montado acima, então o `?? raw` é guarda
  // de tipo (o fallback nunca roda).
  return normalizeMestreProfile(raw) ?? raw;
}
