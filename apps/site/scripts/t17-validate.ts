// Harness de validação T17 (descartável). Exercita repo + filtro de export num único processo
// (server OFF → sem conflito de lock pglite). Roda: SITE_PGDATA=... tsx scripts/t17-validate.ts
import { getDb } from "../db/connection.js";
import * as Posts from "../db/repo/posts.js";
import * as Redirects from "../db/repo/redirects.js";

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? "✓" : "✗ FALHA:"} ${msg}`); if (!cond) fails++; };

async function publishCount(): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM posts WHERE status='publish'`);
  return r.rows[0]?.n ?? 0;
}
async function taxLinks(postId: number): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM post_taxonomies WHERE post_id=$1`, [postId]);
  return r.rows[0]?.n ?? 0;
}

async function main() {
  const db = await getDb();
  // semente taxonomia
  await db.query(`INSERT INTO taxonomies (id, kind, slug, name) VALUES (9001,'category','t17','T17') ON CONFLICT (id) DO NOTHING`);

  const base = {
    excerpt: "x", content_html: "<p>corpo</p>", block_doc: null, toc: [], reading_time: 1,
    featured_url: null, seo_title: null, seo_description: null, canonical: null,
    og_title: null, og_description: null, og_image: null, twitter_card: "summary_large_image",
    noindex: false, author_id: "t17",
  } as const;

  // 1) Criar draft → published_at NULL
  const id = await Posts.createPost({ ...base, title: "T17 Post", slug: "t17-post", status: "draft", published_at: null });
  await Posts.setPostTaxonomies(id, [9001], []);
  let p = await Posts.getPost(id);
  ok(p?.status === "draft" && p?.published_at == null, "draft criado sem published_at");
  ok(await taxLinks(id) === 1, "vínculo de taxonomia criado");

  const before = await publishCount();

  // 2) BUG FIX: publicar via setPostStatus carimba published_at
  await Posts.setPostStatus(id, "publish");
  p = await Posts.getPost(id);
  ok(p?.status === "publish", "status = publish");
  ok(p?.published_at != null, "published_at carimbado ao publicar (fix RSS)");
  ok(await publishCount() === before + 1, "entra no recorte público (status='publish')");

  // 3) Arquivar → sai do público
  await Posts.setPostStatus(id, "archived");
  ok(await publishCount() === before, "archived sai do recorte público");

  // 4) Restaurar (draft) → published_at preservado (não re-carimba)
  const pubAt = new Date(p!.published_at as string).getTime();
  await Posts.setPostStatus(id, "draft");
  p = await Posts.getPost(id);
  ok(new Date(p!.published_at as string).getTime() === pubAt, "restaurar p/ draft preserva published_at");

  // 5) Mover p/ lixeira
  await Posts.setPostStatus(id, "trash");
  ok(await Posts.getPostStatus(id) === "trash", "status = trash");
  ok(await publishCount() === before, "trash fora do recorte público");

  // 6) listPosts default exclui trash; filtro status='trash' mostra
  const listDefault = await Posts.listPosts({});
  ok(!listDefault.some((x) => x.id === id), "listPosts padrão exclui trash");
  const listTrash = await Posts.listPosts({ status: "trash" });
  ok(listTrash.some((x) => x.id === id), "listPosts status=trash inclui o item");

  // 7) Redirect histórico não é tocado pelo delete
  await Redirects.addRedirect("/blog/t17-post/", "/blog/novo/");

  // 8) Delete permanente: remove post + vínculos, preserva redirect
  const deleted = await Posts.deletePost(id);
  ok(deleted, "deletePost retornou true");
  ok(await Posts.getPost(id) === null, "post some após delete");
  ok(await taxLinks(id) === 0, "post_taxonomies limpo após delete");
  const reds = await Redirects.listRedirects();
  ok(reds.some((r) => r.from_path === "/blog/t17-post/"), "redirect histórico preservado após delete");

  await db.query(`DELETE FROM redirects WHERE from_path='/blog/t17-post/'`);
  await db.query(`DELETE FROM taxonomies WHERE id=9001`);
  await db.close();
  console.log(fails === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${fails} CHECK(S) FALHARAM`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERRO:", e); process.exit(2); });
