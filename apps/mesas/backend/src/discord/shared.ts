import crypto from 'node:crypto';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { loadSystemCatalogFlat } from '../services/systemCatalogProvider.js';
import { sanitizeJsonValue } from './parseDiscordAnnouncement.js';
import type { SystemEntry, MatchEntry } from './parseDiscordAnnouncement.js';

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
  // Achado Codex (PR #168): embeds/attachments podem carregar 0x00 em campos
  // de texto (description, field.value, filename) — sanitiza recursivamente
  // antes de virar jsonb, mesmo risco que content_raw.
  return sql<unknown[]>`${JSON.stringify(sanitizeJsonValue(value) ?? [])}::jsonb`;
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
//
// Aliases vêm da tabela (vtt_platform_aliases / communication_platform_aliases),
// decisão D2 da spec 093. O mapa hardcoded VTT_ALIASES e o aliases: [] fixo foram
// removidos: slug/name divergente virava [] em silêncio, e VTT criada pelo CRUD
// admin não podia ganhar alias. Carregamento segue o padrão de
// loadScenariosForParser (duas queries + Map) — catálogo inteiro uma vez por batch.

/** Carrega plataformas VTT ativas do banco para o parse de anúncios Discord. */
export async function loadVttPlatformsForParser(): Promise<MatchEntry[]> {
  const platforms = await db
    .selectFrom('vtt_platforms')
    .select(['id', 'name'])
    .where('is_active', '=', true)
    .execute();

  const aliases = await db
    .selectFrom('vtt_platform_aliases')
    .select(['vtt_platform_id', 'alias'])
    .execute();

  const aliasMap = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.vtt_platform_id) ?? [];
    list.push(a.alias);
    aliasMap.set(a.vtt_platform_id, list);
  }

  return platforms.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: aliasMap.get(p.id) ?? [],
  }));
}

/** Carrega plataformas de comunicação ativas do banco para o parse de anúncios Discord. */
export async function loadCommunicationPlatformsForParser(): Promise<MatchEntry[]> {
  const platforms = await db
    .selectFrom('communication_platforms')
    .select(['id', 'name'])
    .where('is_active', '=', true)
    .execute();

  const aliases = await db
    .selectFrom('communication_platform_aliases')
    .select(['communication_platform_id', 'alias'])
    .execute();

  const aliasMap = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.communication_platform_id) ?? [];
    list.push(a.alias);
    aliasMap.set(a.communication_platform_id, list);
  }

  return platforms.map((p) => ({
    id: p.id,
    name: p.name,
    aliases: aliasMap.get(p.id) ?? [],
  }));
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
