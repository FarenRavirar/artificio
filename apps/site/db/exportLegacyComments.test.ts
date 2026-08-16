import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('./connection.js', () => dbMocks);

import { exportLegacyComments } from './exportLegacyComments';

interface Linha {
  id: string;
  post_id: string;
  slug: string;
  author_name: string;
  content_html: string;
  created_at: Date | null;
  parent_id: string | null;
}

function bancoCom(rows: Linha[]) {
  const query = vi.fn().mockResolvedValue({ rows });
  dbMocks.getDb.mockResolvedValue({ query, close: vi.fn() });
  return query;
}

const linha = (over: Partial<Linha> = {}): Linha => ({
  id: '501',
  post_id: '10',
  slug: 'meu-post',
  author_name: 'Visitante Antigo',
  content_html: '<p>Comentário do blog</p>',
  created_at: new Date('2019-05-04T12:00:00.000Z'),
  parent_id: null,
  ...over,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('export do acervo legado do site', () => {
  it('emite o payload no contrato que o importador do accounts. aceita', async () => {
    bancoCom([linha()]);

    const payload = await exportLegacyComments();

    expect(payload).toMatchObject({ source_app: 'site', count: 1 });
    expect(payload.comments[0]).toMatchObject({
      legacy_source: 'site',
      legacy_id: '501',
      subject_type: 'site.post',
      subject_id: '10',
      // Barra final obrigatória: `trailingSlash: "always"` faz `/blog/x` e
      // `/blog/x/` serem páginas distintas, e só a segunda existe.
      canonical_path: '/blog/meu-post/',
      author_name: 'Visitante Antigo',
      parent_legacy_id: null,
      sanitizer_policy: 'site-comment-html',
      sanitizer_version: 1,
      created_at: '2019-05-04T12:00:00.000Z',
    });
  });

  it('preserva a hierarquia como legacy_id do pai, não como UUID', async () => {
    bancoCom([linha(), linha({ id: '502', parent_id: '501' })]);

    const payload = await exportLegacyComments();

    // O UUID do pai no destino só existe depois de ele ser inserido; a origem
    // não o conhece. Quem resolve o mapa é o importador.
    expect(payload.comments[1]?.parent_legacy_id).toBe('501');
  });

  it('sanitiza o corpo na saída da origem', async () => {
    bancoCom([linha({ content_html: '<p>oi</p><script>alert(1)</script>' })]);

    const payload = await exportLegacyComments();

    // O corpo veio do WordPress e nunca passou por allowlist nossa. Quem
    // sanitiza é o exportador — `sanitize-html` não é dependência do
    // `accounts.`, e arrastá-la para a imagem do app sagrado é o caso E016/E017.
    expect(payload.comments[0]?.content_html).not.toContain('<script>');
    expect(payload.comments[0]?.content_html).toContain('oi');
  });

  it('usa rótulo neutro quando o nome vem vazio', async () => {
    bancoCom([linha({ author_name: '   ' })]);

    const payload = await exportLegacyComments();

    // `author_name` é `NOT NULL DEFAULT ''`. Medição em prod (2026-08-16) achou
    // 0 linhas assim, mas o `CHECK` da metade legada recusaria `''` no `INSERT`
    // sem dizer qual comentário.
    expect(payload.comments[0]?.author_name).toBe('Visitante');
  });

  it('não inventa data quando created_at é nulo', async () => {
    bancoCom([linha({ created_at: null })]);

    const payload = await exportLegacyComments();

    // Época do Unix é falsa de forma óbvia e ordena antes de tudo — preferível
    // a uma data plausível inventada, que ninguém saberia questionar depois.
    expect(payload.comments[0]?.created_at).toBe('1970-01-01T00:00:00.000Z');
  });

  it('sobrevive a resultado sem linhas e a payload não-array', async () => {
    bancoCom([]);
    expect((await exportLegacyComments()).count).toBe(0);

    dbMocks.getDb.mockResolvedValue({ query: vi.fn().mockResolvedValue({}), close: vi.fn() });
    // Conjunto vazio é resultado legítimo e explícito; o importador recusa
    // export cuja `count` não bate com o conteúdo, então zero precisa sair
    // como zero — nunca como `undefined.map` estourando aqui.
    expect((await exportLegacyComments()).count).toBe(0);
  });

  /**
   * A garantia central do requisito 23, varrida no FONTE e não confiada a
   * comentário: o `site` não escreve no banco do `accounts.`, e este script não
   * escreve em lugar nenhum. Se alguém adicionar um `INSERT` aqui, o teste cai.
   */
  it('é read-only: nenhuma escrita no arquivo do exportador', () => {
    const fonte = readFileSync(
      fileURLToPath(new URL('./exportLegacyComments.ts', import.meta.url)),
      'utf8',
    );
    // Só o corpo executável: os comentários explicam o desenho e citam as
    // palavras de propósito.
    const executavel = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    for (const proibido of [/\bINSERT\s+INTO\b/i, /\bUPDATE\s+\w+\s+SET\b/i, /\bDELETE\s+FROM\b/i]) {
      expect(executavel).not.toMatch(proibido);
    }
  });
});
