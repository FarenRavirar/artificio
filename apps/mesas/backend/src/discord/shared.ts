import crypto from 'node:crypto';
import { sql } from 'kysely';
import { db } from '../db';
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

/** Carrega sistemas e aliases do banco para o parse de anúncios Discord. */
export async function loadSystemsForParser(): Promise<SystemEntry[]> {
  const systems = await db
    .selectFrom('systems')
    .select(['id', 'name', 'name_pt'])
    .execute();

  const aliases = await db
    .selectFrom('system_aliases')
    .select(['system_id', 'alias'])
    .execute();

  const aliasMap = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.system_id) ?? [];
    list.push(a.alias);
    aliasMap.set(a.system_id, list);
  }

  return systems.map((s) => ({
    id: s.id,
    name: s.name,
    name_pt: s.name_pt,
    aliases: aliasMap.get(s.id) ?? [],
  }));
}

// ─── Fase A/C (spec 058) — VTT e plataforma de comunicação p/ parse de anúncios ──

// Achado do mantenedor (2026-07-08): "Foundry VTT" (nome do catálogo) nunca bate
// em anúncio real, que sempre cita só "Foundry"/"FoundryVTT" — matcher exige o
// nome inteiro como substring (candidateMatchesText). Sem tabela de aliases para
// vtt_platforms/communication_platforms no banco (só systems/scenarios têm),
// mapa estático por slug é o fix mais barato até existir vtt_platform_aliases.
const VTT_ALIASES: Record<string, string[]> = {
  'foundry-vtt': ['Foundry', 'FoundryVTT'],
  'tabletop-simulator': ['TTS', 'Tabletop Simulator'],
  'fantasy-grounds-unity': ['Fantasy Grounds', 'FGU'],
  'owlbear-rodeo': ['Owlbear'],
  'dndbeyond-maps': ['D&D Beyond', 'DDB Maps', 'DnD Beyond'],
  'alchemy-rpg': ['Alchemy'],
};

/** Carrega plataformas VTT ativas do banco para o parse de anúncios Discord. */
export async function loadVttPlatformsForParser(): Promise<MatchEntry[]> {
  const platforms = await db
    .selectFrom('vtt_platforms')
    .select(['id', 'name', 'slug'])
    .where('is_active', '=', true)
    .execute();
  return platforms.map((p) => ({ id: p.id, name: p.name, aliases: VTT_ALIASES[p.slug] ?? [] }));
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
