import crypto from 'node:crypto';
import { sql } from 'kysely';
import { db } from '../db';
import { loadSystemCatalogFlat } from '../services/systemCatalogProvider';
import type { SystemEntry, MatchEntry } from './parseDiscordAnnouncement';

interface HashableMessage {
  content?: string;
  embeds?: unknown[] | null;
  attachments?: unknown[] | null;
}

export function getContentHash(msg: HashableMessage): string {
  return crypto
    .createHash('sha256')
    .update(msg.content ?? '')
    .update(JSON.stringify(msg.embeds ?? []))
    .update(JSON.stringify(msg.attachments ?? []))
    .digest('hex');
}

export type JsonbArray = ReturnType<typeof sql<unknown[]>>;

export function asJsonbArray(value: unknown): JsonbArray {
  return sql<unknown[]>`${JSON.stringify(value ?? [])}::jsonb`;
}

// ─── REV-036 / D013 — loadSystemsForParser (DB query) ─────────────────────────

/** Carrega sistemas e aliases da fonte canônica do ambiente. */
export async function loadSystemsForParser(): Promise<SystemEntry[]> {
  return (await loadSystemCatalogFlat()).map((s) => ({
    id: s.id,
    name: s.name,
    name_pt: s.name_pt,
    slug: s.slug,
    path_slug: s.path_slug,
    node_type: s.node_type,
    parent_id: s.parent_id,
    aliases: s.aliases,
  }));
}

// ─── Fase A/C (spec 058) — VTT e plataforma de comunicação p/ parse de anúncios ──

// Achado do mantenedor (2026-07-08): "Foundry VTT" (nome do catálogo) nunca bate
// em anúncio real, que sempre cita só "Foundry"/"FoundryVTT" — matcher exige o
// nome inteiro como substring (candidateMatchesText). Sem tabela de aliases para
// vtt_platforms/communication_platforms no banco (só systems/scenarios têm),
// mapa estático por slug é o fix mais barato até existir vtt_platform_aliases.
// Achado CodeRabbit (PR #132): admin pode editar slug/name livre via
// routes/vttPlatforms.ts (PATCH) — se um registro seed sair dessas chaves,
// VTT_ALIASES[...] vira [] em silêncio e o parser volta a exigir o nome
// completo. Chaveado por slug E name (segunda tentativa) reduz o risco sem
// exigir migration nova; risco residual documentado, não eliminado.
const VTT_ALIASES: Record<string, string[]> = {
  'foundry-vtt': ['Foundry', 'FoundryVTT'],
  'tabletop-simulator': ['TTS', 'Tabletop Simulator'],
  'fantasy-grounds-unity': ['Fantasy Grounds', 'FGU'],
  'owlbear-rodeo': ['Owlbear'],
  'dndbeyond-maps': ['D&D Beyond', 'DDB Maps', 'DnD Beyond'],
  'alchemy-rpg': ['Alchemy'],
  'Foundry VTT': ['Foundry', 'FoundryVTT'],
  'Tabletop Simulator (TTS)': ['TTS', 'Tabletop Simulator'],
  'Fantasy Grounds Unity': ['Fantasy Grounds', 'FGU'],
  'Owlbear Rodeo': ['Owlbear'],
  'D&D Beyond Maps': ['D&D Beyond', 'DDB Maps', 'DnD Beyond'],
  'Alchemy RPG': ['Alchemy'],
};

/** Carrega plataformas VTT ativas do banco para o parse de anúncios Discord. */
export async function loadVttPlatformsForParser(): Promise<MatchEntry[]> {
  const platforms = await db
    .selectFrom('vtt_platforms')
    .select(['id', 'name', 'slug'])
    .where('is_active', '=', true)
    .execute();
  return platforms.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: VTT_ALIASES[p.slug] ?? VTT_ALIASES[p.name] ?? [],
  }));
}

/** Carrega plataformas de comunicação ativas do banco para o parse de anúncios Discord. */
export async function loadCommunicationPlatformsForParser(): Promise<MatchEntry[]> {
  const platforms = await db
    .selectFrom('communication_platforms')
    .select(['id', 'name'])
    .where('is_active', '=', true)
    .execute();
  return platforms.map((p) => ({ id: p.id, name: p.name, aliases: [] }));
}

/** Carrega cenarios e aliases do banco para o parse de anuncios Discord. */
export async function loadScenariosForParser(): Promise<MatchEntry[]> {
  const scenarios = await db
    .selectFrom('scenarios')
    .select(['id', 'name', 'name_pt'])
    .execute();

  const aliases = await db
    .selectFrom('scenario_aliases')
    .select(['scenario_id', 'alias'])
    .execute();

  const aliasMap = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.scenario_id) ?? [];
    list.push(a.alias);
    aliasMap.set(a.scenario_id, list);
  }

  return scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name_pt ?? scenario.name,
    aliases: [
      scenario.name,
      ...(scenario.name_pt ? [scenario.name_pt] : []),
      ...(aliasMap.get(scenario.id) ?? []),
    ],
  }));
}
