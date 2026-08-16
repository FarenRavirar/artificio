import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { exportLegacyComments } from './exportLegacyComments';

/**
 * T5.1b/T5.2 (spec 090) — as duas garantias do export.
 *
 * 1. **A escrita está congelada** — é o que substitui high-water mark e
 *    catch-up no rollout de 24a, e a única razão pela qual esta migração pode
 *    pular as duas etapas.
 * 2. **O export não escreve** — requisito 23: o módulo não toca o banco central,
 *    e a origem precisa continuar íntegra para o rollback de T5.7.
 *
 * As duas são verificadas por varredura do fonte, não por convenção: comentário
 * não impede ninguém de reintroduzir um `insertInto` amanhã.
 */

const dbMocks = vi.hoisted(() => ({ selectFrom: vi.fn() }));
vi.mock('../db', () => ({ db: dbMocks }));

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}

/**
 * Remove comentários antes de varrer.
 *
 * Sem isto, a própria documentação que **explica** por que a escrita está
 * congelada derruba o teste ao citar `insertInto('download_comment')` — foi o
 * que aconteceu ao escrevê-lo. Afrouxar a busca seria a saída errada: o teste
 * tem de continuar literal sobre o código, e o que precisa sair é o texto.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('a escrita em download_comment está congelada (T5.7)', () => {
  it('nenhum arquivo de produção insere na tabela legada', () => {
    const culpados = sourceFiles(SRC).filter((file) =>
      codeOnly(readFileSync(file, 'utf8')).includes("insertInto('download_comment')"),
    );

    // Se este teste falhar, o rollout perdeu a premissa que dispensa
    // high-water mark e catch-up: com escrita ativa, comentário nascido entre
    // o export e o cutover some — o defeito que 24a nomeia com todas as letras.
    expect(culpados.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});

describe('o export é read-only (requisito 23)', () => {
  it('não contém nenhuma operação de escrita', () => {
    const fonte = codeOnly(readFileSync(join(__dirname, 'exportLegacyComments.ts'), 'utf8'));

    for (const proibido of ['insertInto', 'updateTable', 'deleteFrom']) {
      expect(fonte).not.toContain(proibido);
    }
  });

  it('emite contagem e conteúdo consistentes, com corpo já sanitizado', async () => {
    dbMocks.selectFrom.mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([
        {
          id: 'comment-1',
          material_id: 'material-1',
          user_id: '11111111-1111-4111-8111-111111111111',
          body: 'Corpo <script>alert(1)</script> legado',
          removed_at: null,
          removed_reason: null,
          created_at: new Date('2026-01-02T03:04:05.000Z'),
          slug: 'guia de magia',
        },
      ]),
    });

    const payload = await exportLegacyComments(() => new Date('2026-08-15T00:00:00.000Z'));

    // A contagem declarada é o que o importador confere antes de escrever:
    // divergir aqui produziria migração parcial que passa por sucesso.
    expect(payload.count).toBe(payload.comments.length);
    expect(payload.count).toBe(1);

    const [comment] = payload.comments;
    expect(comment.content_html).not.toContain('<script>');
    expect(comment.sanitizer_policy).toBe('content-editor/sanitizeUserMarkdown');
    expect(comment.sanitizer_version).toBeGreaterThan(0);
    // Caminho escapado, igual ao que o guard afirma na escrita viva — é o link
    // de volta, e precisa cair na página real.
    expect(comment.canonical_path).toBe('/materiais/guia%20de%20magia');
    expect(comment.created_at).toBe('2026-01-02T03:04:05.000Z');
  });

  it('exporta conjunto vazio sem tratar como erro', async () => {
    dbMocks.selectFrom.mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    });

    const payload = await exportLegacyComments();

    expect(payload).toMatchObject({ count: 0, comments: [] });
  });
});
