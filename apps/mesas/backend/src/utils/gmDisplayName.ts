import { sql } from 'kysely';

// Spec 106 R4/D6: UM nome de mestre para card, OG, busca, lista, perfil e página
// da mesa. Antes eram seis COALESCE soltos; a página da mesa respeitava
// `master_display_name` e o card/OG/busca não (6 das 23 mesas com sobrescrita
// divergiam do perfil, medido 2026-10-27). Aliases fixos nas queries: `gm`
// (gm_profiles), `p` (profiles) e `t` (tables).

/** Nome do perfil do mestre. `gm.slug` é o último degrau: UNIQUE NOT NULL, nunca vazio. */
export const gmProfileDisplayNameSql = () =>
  sql<string>`COALESCE(gm.nickname, p.display_name, gm.slug)`;

/** Nome do mestre numa mesa: a sobrescrita da mesa (spec 096) vence o perfil. */
export const tableGmDisplayNameSql = () =>
  sql<string>`COALESCE(NULLIF(btrim(t.master_display_name), ''), gm.nickname, p.display_name, gm.slug)`;
