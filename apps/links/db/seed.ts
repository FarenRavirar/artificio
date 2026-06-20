// Seed dos grupos curados (data/groups.ts → tabela groups, source=curated status=active).
// Idempotente por invite_url (ON CONFLICT). Resolve logo og→Cloudinary se CLOUDINARY_* presente;
// senão deixa logo nula (não falha). Uso: pnpm --filter @artificio/links seed (requer DATABASE_URL).
import { db } from "./index.js";
import { GROUP_CATEGORIES } from "../src/data/groups.js";
import { fetchOgImage } from "../server/lib/og.js";
import { uploadLogoFromUrl, cloudinaryEnabled } from "../server/lib/cloudinary.js";
import { slugify } from "../server/lib/slug.js";
import type { GroupCategory } from "./types.js";

async function resolveLogo(inviteUrl: string): Promise<{ logo_url: string; logo_public_id: string } | null> {
  if (!cloudinaryEnabled()) return null;
  const og = await fetchOgImage(inviteUrl);
  if (!og) return null;
  try {
    const stored = await uploadLogoFromUrl(og);
    return { logo_url: stored.url, logo_public_id: stored.public_id };
  } catch (e) {
    console.warn(`[seed] logo falhou (${inviteUrl}):`, String(e));
    return null;
  }
}

// Vocabulário inicial de tags: deriva dos `tag` dos curados (idempotente por slug).
const tagSlug = new Map<string, string>(); // label -> slug
let tagOrder = 0;
for (const category of GROUP_CATEGORIES) {
  for (const g of category.groups) {
    if (!g.tag || tagSlug.has(g.tag)) continue;
    const slug = slugify(g.tag);
    tagSlug.set(g.tag, slug);
    const exists = await db.selectFrom("group_tags").select(["id"]).where("slug", "=", slug).executeTakeFirst();
    if (!exists) {
      await db.insertInto("group_tags").values({ slug, label: g.tag, sort_order: tagOrder }).execute();
    }
    tagOrder += 1;
  }
}

let inserted = 0;
let updated = 0;
let order = 0;

for (const category of GROUP_CATEGORIES) {
  for (const g of category.groups) {
    const tags = g.tag ? [tagSlug.get(g.tag)!] : [];
    const slug = slugify(g.name);
    const existing = await db
      .selectFrom("groups")
      .select(["id", "logo_url", "slug"])
      .where("invite_url", "=", g.href)
      .executeTakeFirst();

    const needLogo = !existing?.logo_url;
    const logo = needLogo ? await resolveLogo(g.href) : null;

    if (existing) {
      await db
        .updateTable("groups")
        .set({
          name: g.name,
          slug: existing.slug ?? slug,
          tags,
          description: g.description,
          kind: g.kind,
          category: category.id as GroupCategory,
          source: "curated",
          status: "active",
          sort_order: order,
          ...(logo ?? {}),
        })
        .where("id", "=", existing.id)
        .execute();
      updated += 1;
    } else {
      await db
        .insertInto("groups")
        .values({
          name: g.name,
          slug,
          tags,
          description: g.description,
          invite_url: g.href,
          kind: g.kind,
          category: category.id as GroupCategory,
          source: "curated",
          status: "active",
          sort_order: order,
          approved_at: new Date().toISOString(),
          ...(logo ?? {}),
        })
        .execute();
      inserted += 1;
    }
    order += 1;
  }
}

console.log(`seed: ${inserted} inseridos, ${updated} atualizados (${order} curados, logos=${cloudinaryEnabled() ? "cloudinary" : "off"})`);
await db.destroy();
