/**
 * T6.2 (spec 090) — export **read-only** do acervo legado de comentários do
 * `site`.
 *
 * ## A fronteira que este script existe para respeitar
 *
 * O requisito 23 proíbe o módulo escrever no banco do `accounts.`: SQL local
 * não transfere dado cross-service. O fluxo é export aqui, importador do lado
 * do `accounts.` (`importLegacyComments.ts`), inserts idempotentes por
 * `(legacy_source, legacy_id)` lá. Este arquivo **só lê** — não há um único
 * `INSERT`/`UPDATE` nele, de propósito.
 *
 * ## Por que o `site` é mais simples que o `downloads`, e onde é mais difícil
 *
 * Mais simples: `comments` (`db/migrations/001_init.sql:66-73`) **não tem**
 * coluna de remoção, então nenhum legado é tombstone e o caminho de
 * `community_actor` opaco da Fase 5 não tem sujeito aqui. E o nome do autor já
 * vem literal (`author_name`), sem consultar conta — o blog foi importado do
 * WordPress sem vínculo com o SSO, e o requisito 9 fixa "`user_id` nulo,
 * `legacy_author_name`, autoria não verificada".
 *
 * Mais difícil: o legado do `site` é **aninhado** (`parent_id`), enquanto o do
 * `downloads` era lista plana. `parent_id` não tem FK (`spec.md:151`), então
 * pai órfão e ciclo são possíveis na origem — quem os detecta é o importador,
 * que tem o lote inteiro à vista; este export emite o `parent_legacy_id` cru e
 * não tenta consertar a árvore.
 *
 * ## Congelar a escrita antes de exportar
 *
 * O requisito 24a admite "dual-write **ou** congelar a escrita por janela
 * curta". Aqui a escrita nunca existiu: `comments` é read-only desde a
 * importação do WordPress (`001_init.sql:65` — "read-only por ora"), e nenhuma
 * rota do `site` insere na tabela. Sem caminho de escrita, nada nasce entre o
 * export e o cutover, e o catch-up que o requisito protege não tem objeto.
 *
 * Uso:
 *   tsx db/exportLegacyComments.ts > export.json
 */

import { getDb } from "./connection.js";
import { cleanHtml } from "../server/lib/sanitize-html.js";

/**
 * Identificação da política que produziu `content_html`.
 *
 * Gravar **qual** política sanitizou aquele corpo é o que permite reprocessar
 * seletivamente no dia em que o sanitizador mudar de regra. O nome é diferente
 * do usado pelo `downloads` (`content-editor/sanitizeUserMarkdown`) porque o
 * conteúdo é diferente: lá era markdown, aqui é **HTML** vindo do WordPress.
 *
 * O par (política, versão) chega até `legacy_sanitizer_policy` no banco central
 * e é o que `legacyBodyFormat` (`communityCommentRead.ts`) consulta para
 * escolher entre renderizar como markdown ou como HTML — qualquer política que
 * não seja a do markdown cai no caminho HTML, que reaplica
 * `sanitizeLegacyCommentHtml` na saída (requisito 10, "protegido de novo na
 * saída sem regravar o banco").
 */
const LEGACY_SANITIZER_POLICY = "site-comment-html";
const LEGACY_SANITIZER_VERSION = 1;

interface LegacyCommentRow {
  id: string;
  post_id: string;
  slug: string;
  author_name: string;
  content_html: string;
  created_at: Date | null;
  parent_id: string | null;
}

export interface SiteLegacyComment {
  legacy_source: "site";
  legacy_id: string;
  subject_type: "site.post";
  subject_id: string;
  canonical_path: string;
  /** Nome literal da origem; o `site` não tem conta por trás (requisito 9). */
  author_name: string;
  /** `legacy_id` do pai — o importador resolve o UUID e ordena o lote. */
  parent_legacy_id: string | null;
  content_html: string;
  sanitizer_policy: string;
  sanitizer_version: number;
  created_at: string;
}

export interface SiteLegacyExport {
  source_app: "site";
  exported_at: string;
  count: number;
  comments: SiteLegacyComment[];
}

/**
 * Rótulo de autor quando a origem não tem um.
 *
 * `author_name` é `TEXT NOT NULL DEFAULT ''`, então string vazia é possível
 * pelo schema. A medição em produção (2026-08-16) achou **0 linhas** assim nos
 * 25 comentários, mas o fallback fica: o `CHECK` da metade legada exige
 * `legacy_author_name` preenchido, e um `''` que escape recusaria a linha no
 * `INSERT` sem dizer qual. "Visitante" é o rótulo neutro do acervo do blog —
 * diferente de "Conta excluída" do `downloads`, que descreve conta que existiu
 * e foi apagada; aqui nunca houve conta.
 */
const AUTOR_SEM_NOME = "Visitante";

export async function exportLegacyComments(): Promise<SiteLegacyExport> {
  const db = await getDb();

  // `JOIN` com `posts` porque `canonical_path` precisa do slug, e o slug é a
  // chave natural imutável do post (`001_init.sql:30`). `INNER` e não `LEFT`:
  // `post_id` tem FK com `ON DELETE CASCADE` (`:68`), então comentário sem post
  // não existe — se existisse, importá-lo criaria assunto para uma página que
  // não pode ser aberta.
  //
  // A ordenação por `created_at` não é cosmética: ela põe pai antes de filho no
  // caso comum (resposta é sempre posterior), o que reduz o trabalho do
  // ordenador topológico do importador. A correção não depende disso — o
  // importador ordena de novo —, mas o export sai legível para conferência
  // manual do relatório de reconciliação (T6.6).
  const result = await db.query<LegacyCommentRow>(
    `SELECT c.id::text AS id,
            c.post_id::text AS post_id,
            p.slug AS slug,
            c.author_name,
            c.content_html,
            c.created_at,
            c.parent_id::text AS parent_id
       FROM comments c
       JOIN posts p ON p.id = c.post_id
      ORDER BY c.created_at ASC NULLS FIRST, c.id ASC`,
  );

  const rows = Array.isArray(result.rows) ? result.rows : [];

  const comments: SiteLegacyComment[] = rows.map((row) => ({
    legacy_source: "site",
    legacy_id: row.id,
    subject_type: "site.post",
    subject_id: row.post_id,
    // Mesmo caminho que `postSubjectGuard.postCanonicalPath` produz: barra
    // final obrigatória (`trailingSlash: "always"`). Divergir aqui faria o link
    // da notificação cair no 404 do próprio site.
    canonical_path: `/blog/${encodeURIComponent(row.slug)}/`,
    author_name: row.author_name.trim() || AUTOR_SEM_NOME,
    parent_legacy_id: row.parent_id,
    // Sanitizado NA SAÍDA da origem, com a política declarada junto (requisito
    // 10). O corpo veio do WordPress e nunca passou por allowlist nossa; o
    // importador não sanitiza porque `sanitize-html` não é dependência do
    // `accounts.` — arrastar pacote para a imagem do app sagrado é o caso
    // E016/E017.
    content_html: cleanHtml(row.content_html),
    sanitizer_policy: LEGACY_SANITIZER_POLICY,
    sanitizer_version: LEGACY_SANITIZER_VERSION,
    // `created_at` é nullable no schema (`:71`). Sem data, o comentário entraria
    // com `Invalid Date` no destino; a época do Unix é falsa de forma óbvia e
    // ordena antes de tudo, o que é preferível a uma data plausível inventada.
    created_at: (row.created_at ?? new Date(0)).toISOString(),
  }));

  return {
    source_app: "site",
    exported_at: new Date().toISOString(),
    // `count` é o que o importador confere contra o que recebeu: export
    // truncado que declara 25 e entrega 9 é recusado lá, em vez de produzir
    // migração parcial que passa por sucesso.
    count: comments.length,
    comments,
  };
}

// Execução direta: `tsx db/exportLegacyComments.ts > export.json`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  exportLegacyComments()
    .then((payload) => {
      process.stdout.write(JSON.stringify(payload, null, 2));
      return getDb();
    })
    .then((db) => db.close())
    .catch((error: unknown) => {
      console.error("[export-legacy-comments]", error);
      process.exitCode = 1;
    });
}
