/**
 * T5.1b/T5.2 (spec 090) — export **read-only** do acervo legado de comentários
 * do `downloads`.
 *
 * ## A fronteira que este script existe para respeitar
 *
 * O requisito 23 proíbe o módulo escrever no banco do `accounts.`: SQL local
 * não transfere dado cross-service. O fluxo é export aqui, importador do lado do
 * `accounts.` (`importLegacyComments.ts`), inserts idempotentes por
 * `(legacy_source, legacy_id)` lá. Este arquivo **só lê** — não há um único
 * `insert`/`update` nele, de propósito.
 *
 * ## Ordem obrigatória: congelar a escrita ANTES de exportar
 *
 * O requisito 24a exige `expand → backfill → catch-up → cutover` com
 * high-water mark, porque "copiar antes de parar de ler perde tudo o que
 * nascer entre a cópia e a troca". Ele admite duas formas de fechar essa
 * janela: **dual-write ou congelar a escrita por janela curta**.
 *
 * Esta migração usa a segunda, e por isso **não tem** high-water mark nem
 * catch-up: `POST /api/v1/comments` já responde `410` (T5.7) e **nenhum arquivo
 * de produção insere na tabela legada** — garantia varrida pelo fonte em
 * `exportLegacyComments.test.ts`, não confiada a este comentário. Sem caminho de
 * escrita, nada pode nascer entre o export e o cutover; a janela que o catch-up
 * protege não existe.
 *
 * A consequência prática, e a razão de este comentário existir: **exportar
 * antes de fechar a escrita reabre a janela**. Se alguém reativar a rota, o
 * catch-up volta a ser obrigatório.
 *
 * ## Guarda de contagem
 *
 * A medição de 2026-08-15 acusou `download_comment` com 0 linhas em produção e
 * 2 em beta (exercício manual). O caminho perigoso é o inverso do usual:
 * assumir que continua vazio e pular o backfill quando já houver dado. Por isso
 * o export sempre **conta e reporta** antes de emitir, e o importador recusa
 * silêncio — conjunto vazio é resultado legítimo e explícito, nunca inferido.
 *
 * Uso:
 *   tsx src/scripts/exportLegacyComments.ts > export.json
 */

import { sanitizeUserMarkdown } from '@artificio/content-editor/sanitize';
import { db } from '../db';

/**
 * Identificação da política que produziu `content_html`.
 *
 * Gravar **qual** política sanitizou aquele corpo é o que permite reprocessar
 * seletivamente no dia em que o sanitizador mudar de regra — sem isso não há
 * como saber o que já passou por qual versão, e a única saída seria reprocessar
 * tudo às cegas. `sanitizeUserMarkdown` não exporta identificador próprio
 * (busca negativa em `packages/content-editor/src/sanitize.ts`), então o nome é
 * fixado aqui. A versão sobe quando a política mudar de forma que exija
 * reprocessamento; o `CHECK` do banco central exige `> 0`.
 */
const LEGACY_SANITIZER_POLICY = 'content-editor/sanitizeUserMarkdown';
const LEGACY_SANITIZER_VERSION = 1;

export interface LegacyCommentExport {
  /** Identifica a origem no UNIQUE `(legacy_source, legacy_id)` do destino. */
  legacy_source: 'downloads';
  legacy_id: string;
  subject_type: 'downloads.material';
  subject_id: string;
  canonical_path: string;
  /**
   * `user_id` do SSO. O `downloads` não tem tabela `users` local — o id da
   * sessão já é o do `accounts.` (`middleware/auth.ts:66`), então não há a
   * confusão de dois UUIDs que T7.2 documenta para o `mesas`.
   */
  author_user_id: string;
  /**
   * Corpo **já sanitizado aqui**, com a política declarada junto.
   *
   * A sanitização acontece no export, e não no import, por dependência:
   * `sanitizeUserMarkdown` vive em `@artificio/content-editor`, que já é
   * dependência deste app e **não** é do `accounts.` — arrastar pacote novo
   * para a imagem do app sagrado é o caso E016/E017, que derrubou o SSO por 5h
   * em 2026-08-08.
   *
   * O requisito 10 pede o HTML legado "sanitizado uma vez na entrada, com
   * política/versionamento". Quem sanitiza declara o que usou; o par viaja com
   * o corpo até `legacy_sanitizer_policy`/`legacy_sanitizer_version`.
   */
  content_html: string;
  sanitizer_policy: string;
  sanitizer_version: number;
  removed_at: string | null;
  removed_reason: string | null;
  created_at: string;
}

export interface LegacyExportPayload {
  source_app: 'downloads';
  exported_at: string;
  /** Contagem medida na origem, para o importador conferir o que recebeu. */
  count: number;
  comments: LegacyCommentExport[];
}

export async function exportLegacyComments(now: () => Date = () => new Date()): Promise<LegacyExportPayload> {
  const rows = await db
    .selectFrom('download_comment')
    .innerJoin('download_material', 'download_material.id', 'download_comment.material_id')
    .select([
      'download_comment.id as id',
      'download_comment.material_id as material_id',
      'download_comment.user_id as user_id',
      'download_comment.body as body',
      'download_comment.removed_at as removed_at',
      'download_comment.removed_reason as removed_reason',
      'download_comment.created_at as created_at',
      'download_material.slug as slug',
    ])
    // Ordem estável: o import roda duas vezes e o relatório de reconciliação
    // compara linha a linha (T5.2c). Sem `ORDER BY`, o PostgreSQL não promete
    // ordem alguma e a comparação acusaria divergência inexistente.
    .orderBy('download_comment.created_at', 'asc')
    .orderBy('download_comment.id', 'asc')
    .execute();

  const comments = rows.map((row): LegacyCommentExport => ({
    legacy_source: 'downloads',
    legacy_id: row.id,
    subject_type: 'downloads.material',
    subject_id: row.material_id,
    // Mesmo caminho que o guard afirma na escrita viva
    // (`materialSubjectGuard.ts`), para o link de volta cair na página real.
    canonical_path: `/materiais/${encodeURIComponent(row.slug)}`,
    author_user_id: row.user_id,
    content_html: sanitizeUserMarkdown(row.body),
    sanitizer_policy: LEGACY_SANITIZER_POLICY,
    sanitizer_version: LEGACY_SANITIZER_VERSION,
    removed_at: row.removed_at ? row.removed_at.toISOString() : null,
    removed_reason: row.removed_reason,
    created_at: row.created_at.toISOString(),
  }));

  return {
    source_app: 'downloads',
    exported_at: now().toISOString(),
    count: comments.length,
    comments,
  };
}

// `require.main === module` e **não** `import.meta.url`: o backend do
// `downloads` compila para CommonJS, e `import.meta` ali é `TS1343` no build
// (o `tsx`, que roda o script em dev, aceitaria os dois — o erro só aparece no
// `tsc`). O efeito é o mesmo: só executa quando chamado direto, nunca quando
// importado pelo teste.
if (require.main === module) {
  void (async () => {
    try {
      const payload = await exportLegacyComments();
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      process.stderr.write(`[export] ${payload.count} comentário(s) exportado(s).\n`);
    } catch (error: unknown) {
      process.stderr.write(`[export] falhou: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    } finally {
      // `finally`, e não só no sucesso: o pool do Kysely mantém handle ativo, e
      // uma consulta que falha deixaria o processo pendurado sem nunca chegar ao
      // `exitCode = 1` que o operador espera ver. Falha de export precisa sair
      // **falhando**, não travar o terminal na VM.
      await db.destroy();
    }
  })();
}
