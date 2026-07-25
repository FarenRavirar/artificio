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
  const collapsed = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  // Achado real (review PR #205, Sonar, Major): /^-+|-+$/ podia sofrer
  // backtracking superlinear. Varredura linear preserva o trim de hífens.
  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed[start] === "-") start += 1;
  while (end > start && collapsed[end - 1] === "-") end -= 1;
  return collapsed.slice(start, end).slice(0, 80);
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
  // Achado real (review PR #205, Codex): read-then-write reenviava todos os
  // campos e perdia edição concorrente feita depois do SELECT. UPDATE dinâmico
  // toca apenas propriedades presentes no PATCH; actor/timestamp sempre ficam.
  const assignments: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown, cast = "") => {
    values.push(value);
    assignments.push(`${column}=$${values.length}${cast}`);
  };

  if (Object.hasOwn(input, "name")) {
    const name = input.name?.trim() ?? "";
    if (!name) throw new Error("name_required");
    set("name", name);
  }
  if (Object.hasOwn(input, "slug")) {
    const slug = input.slug?.trim().slice(0, 80) ?? "";
    if (!slug) throw new Error("slug_required");
    set("slug", slug);
  }
  if (Object.hasOwn(input, "aliases")) {
    set("aliases", JSON.stringify(cleanAliases(input.aliases)), "::jsonb");
  }
  if (Object.hasOwn(input, "status")) {
    const status = input.status;
    if (!status || !STATUSES.has(status)) throw new Error("bad_status");
    set("status", status);
  }

  set("updated_by", actorId);
  assignments.push("updated_at=now()");
  values.push(id);
  const row = (await db.query<MaterialType>(
    `UPDATE catalog_material_types SET ${assignments.join(", ")}
     WHERE id=$${values.length} RETURNING id, slug, name, aliases, status, created_at, updated_at`,
    values,
  )).rows[0];
  return row ? { ...row, aliases: cleanAliases(row.aliases) } : null;
}
