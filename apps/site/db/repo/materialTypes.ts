import { randomUUID } from "node:crypto";
import { getDb } from "../connection.js";

export type MaterialTypeStatus = "pending" | "active" | "merged" | "rejected";

export interface MaterialType {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  status: MaterialTypeStatus;
  created_at: string;
  updated_at: string;
}

export interface MaterialTypeWrite {
  name: string;
  slug?: string;
  aliases?: string[];
  status?: MaterialTypeStatus;
}

const STATUSES = new Set<MaterialTypeStatus>(["pending", "active", "merged", "rejected"]);

export function slugifyMaterialType(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function cleanAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

export function normalizeMaterialTypeWrite(input: MaterialTypeWrite): Required<MaterialTypeWrite> {
  const name = input.name.trim();
  const slug = (input.slug?.trim() || slugifyMaterialType(name)).slice(0, 80);
  if (!name) throw new Error("name_required");
  if (!slug) throw new Error("slug_required");
  const status = input.status ?? "active";
  if (!STATUSES.has(status)) throw new Error("bad_status");
  return { name, slug, aliases: cleanAliases(input.aliases), status };
}

export async function listMaterialTypes(includeInactive = false): Promise<MaterialType[]> {
  const db = await getDb();
  const sql = `SELECT id, slug, name, aliases, status, created_at, updated_at
    FROM catalog_material_types ${includeInactive ? "" : "WHERE status = 'active'"} ORDER BY name`;
  const rows = (await db.query<MaterialType>(sql)).rows;
  return rows.map((row) => ({ ...row, aliases: cleanAliases(row.aliases) }));
}

export async function createMaterialType(input: MaterialTypeWrite, actorId: string | null): Promise<MaterialType> {
  const value = normalizeMaterialTypeWrite(input);
  const db = await getDb();
  const row = (await db.query<MaterialType>(
    `INSERT INTO catalog_material_types (id, slug, name, aliases, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$6) RETURNING id, slug, name, aliases, status, created_at, updated_at`,
    [randomUUID(), value.slug, value.name, JSON.stringify(value.aliases), value.status, actorId],
  )).rows[0]!;
  return { ...row, aliases: cleanAliases(row.aliases) };
}

export async function updateMaterialType(id: string, input: Partial<MaterialTypeWrite>, actorId: string | null): Promise<MaterialType | null> {
  const db = await getDb();
  const current = (await db.query<MaterialType>("SELECT id, slug, name, aliases, status, created_at, updated_at FROM catalog_material_types WHERE id=$1", [id])).rows[0];
  if (!current) return null;
  const value = normalizeMaterialTypeWrite({ name: input.name ?? current.name, slug: input.slug ?? current.slug, aliases: input.aliases ?? cleanAliases(current.aliases), status: input.status ?? current.status });
  const row = (await db.query<MaterialType>(
    `UPDATE catalog_material_types SET slug=$1, name=$2, aliases=$3::jsonb, status=$4, updated_by=$5, updated_at=now()
     WHERE id=$6 RETURNING id, slug, name, aliases, status, created_at, updated_at`,
    [value.slug, value.name, JSON.stringify(value.aliases), value.status, actorId, id],
  )).rows[0]!;
  return { ...row, aliases: cleanAliases(row.aliases) };
}
