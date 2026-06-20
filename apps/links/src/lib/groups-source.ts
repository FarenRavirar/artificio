// Fonte de dados p/ o build SSG. Se DATABASE_URL existir, lê do Postgres (estado real, seed+
// comunidade aprovada); senão cai p/ os curados de data/groups.ts (build sem DB / dev rápido).
// Normaliza para um shape único consumido por index.astro e /grupo/[slug].astro.
import { GROUP_CATEGORIES } from "../data/groups.js";
import { slugify } from "../../server/lib/slug.js";

export interface NormalizedGroup {
  name: string;
  slug: string;
  description: string | null;
  rules: string | null;
  tags: string[]; // labels resolvidos
  isAdult: boolean;
  inviteUrl: string;
  kind: "group" | "channel";
  category: string;
  logoUrl: string | null;
  createdAt: string | null;
  approvedAt: string | null;
}

export interface CategoryBlock {
  id: string;
  title: string;
  groups: NormalizedGroup[];
}

const CATEGORY_TITLES: Record<string, string> = {
  artificio: "Do Artifício RPG",
  tematicos: "Temáticos",
  parceiros: "Parceiros",
  comunidade: "Grupos de RPG (comunidade)",
};

function fromCuratedData(): CategoryBlock[] {
  return GROUP_CATEGORIES.map((c) => ({
    id: c.id,
    title: c.title,
    groups: c.groups.map((g) => ({
      name: g.name,
      slug: slugify(g.name),
      description: g.description,
      rules: null,
      tags: g.tag ? [g.tag] : [],
      isAdult: false,
      inviteUrl: g.href,
      kind: g.kind,
      category: c.id,
      logoUrl: null,
      createdAt: null,
      approvedAt: null,
    })),
  }));
}

async function fromDatabase(): Promise<CategoryBlock[]> {
  const { db } = await import("../../db/index.js");
  const tagRows = await db.selectFrom("group_tags").select(["slug", "label"]).execute();
  const tagLabel = new Map(tagRows.map((t) => [t.slug, t.label]));

  const rows = await db
    .selectFrom("groups")
    .selectAll()
    .where("status", "=", "active")
    .orderBy("category", "asc")
    .orderBy("sort_order", "asc")
    .orderBy("name", "asc")
    .execute();

  const order = ["artificio", "tematicos", "parceiros", "comunidade"];
  const byCat = new Map<string, NormalizedGroup[]>();
  for (const r of rows) {
    const g: NormalizedGroup = {
      name: r.name,
      slug: r.slug ?? slugify(r.name),
      description: r.description,
      rules: r.rules,
      tags: (r.tags ?? []).map((s) => tagLabel.get(s) ?? s),
      isAdult: r.is_adult,
      inviteUrl: r.invite_url,
      kind: r.kind,
      category: r.category,
      logoUrl: r.logo_url,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
    };
    const list = byCat.get(r.category) ?? [];
    list.push(g);
    byCat.set(r.category, list);
  }
  return order
    .filter((id) => byCat.has(id))
    .map((id) => ({ id, title: CATEGORY_TITLES[id] ?? id, groups: byCat.get(id)! }));
}

/** Categorias com grupos ativos. DB se disponível; senão curados. */
export async function getCategories(): Promise<CategoryBlock[]> {
  if (process.env.DATABASE_URL) {
    try {
      return await fromDatabase();
    } catch (e) {
      console.warn("[groups-source] DB indisponível no build; usando curados.", String(e));
    }
  }
  return fromCuratedData();
}

/** Lista achatada (p/ getStaticPaths das páginas por slug). */
export async function getAllGroups(): Promise<NormalizedGroup[]> {
  return (await getCategories()).flatMap((c) => c.groups);
}
