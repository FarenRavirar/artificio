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

/** Carrega plataformas VTT ativas do banco para o parse de anúncios Discord. */
export async function loadVttPlatformsForParser(): Promise<MatchEntry[]> {
  const platforms = await db
    .selectFrom('vtt_platforms')
    .select(['id', 'name'])
    .where('is_active', '=', true)
    .execute();
  return platforms.map((p) => ({ id: p.id, name: p.name, aliases: [] }));
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
