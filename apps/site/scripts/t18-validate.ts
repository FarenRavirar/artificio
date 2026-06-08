// Harness de validação T18 (descartável). Repo de mídia num único processo (server OFF).
// Roda: SITE_PGDATA=... tsx scripts/t18-validate.ts
import { getDb } from "../db/connection.js";
import * as Media from "../db/repo/media.js";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "✓" : "✗ FALHA:"} ${m}`); if (!c) fails++; };

async function main() {
  const db = await getDb();

  const id = await Media.createMedia({
    source: "local", url: "/uploads/x.png", cloudinary_public_id: null, mime: "image/png",
    size_bytes: 123, width: 10, height: 20, alt: "a", caption: null, title: "X", created_by: "t18",
  });
  ok(id >= 1000000, "createMedia retorna id do sequence nativo (>=1e6)");

  let item = await Media.getMedia(id);
  ok(item?.source === "local" && item?.mime === "image/png", "getMedia traz source/mime");
  ok(item?.url === "/uploads/x.png", "url canônica gravada");

  let list = await Media.listMedia({});
  ok(list.total >= 1 && list.items.some((x) => x.id === id), "listMedia inclui o item + total");

  const img = await Media.listMedia({ type: "image" });
  ok(img.items.some((x) => x.id === id), "filtro type=image acha o png");
  const aud = await Media.listMedia({ type: "audio" });
  ok(!aud.items.some((x) => x.id === id), "filtro type=audio exclui o png");

  const q = await Media.listMedia({ q: "x.png" });
  ok(q.items.some((x) => x.id === id), "busca por URL acha");

  await Media.updateMediaMeta(id, { alt: "novo", caption: "leg", title: "Y" });
  item = await Media.getMedia(id);
  ok(item?.alt === "novo" && item?.caption === "leg" && item?.title === "Y", "updateMediaMeta persiste");

  ok(await Media.deleteMedia(id), "deleteMedia true");
  ok((await Media.getMedia(id)) === null, "some após delete");

  await db.close();
  console.log(fails === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${fails} FALHARAM`);
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.error("ERRO:", e); process.exit(2); });
