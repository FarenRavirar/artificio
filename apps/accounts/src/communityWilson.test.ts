import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

/**
 * T2.3b — vetores de referência do Wilson, **executados na função PostgreSQL**.
 *
 * ## Por que este arquivo existe separado de `communityMigration.test.ts`
 *
 * Aquele arquivo lê a migration como **texto** e casa regex: prova que a função
 * foi declarada e que `best_score` a referencia. Não prova nenhum valor — uma
 * fórmula errada dentro do corpo da função passaria verde ali.
 *
 * A task exige testar "diretamente a função PostgreSQL de T2.1c, não uma
 * reimplementação em TypeScript". Reimplementar Wilson em TS e comparar os dois
 * resultados só provaria que duas implementações concordam; se ambas errarem o
 * mesmo `z`, o teste passa e o ranking do produto fica errado. Por isso os
 * valores esperados abaixo são **constantes literais**, medidas contra o banco
 * real em 2026-08-07, e não recalculadas em tempo de teste.
 *
 * ## Por que pula em vez de falhar sem banco
 *
 * O monorepo não tem `pg-mem` nem `testcontainers` (busca negativa registrada em
 * T2.3). Falhar sem banco tornaria `pnpm test` vermelho em toda máquina sem
 * PostgreSQL local, e o CI passaria a exigir um serviço que ele não provisiona.
 * Pular deixa a suíte honesta: o teste roda onde há banco e se declara ausente
 * onde não há — nunca finge cobertura.
 *
 * Para rodar: `COMMUNITY_TEST_DATABASE_URL=postgres://... pnpm --filter @artificio/accounts test`
 */

const databaseUrl = process.env.COMMUNITY_TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;

afterAll(async () => {
  await pool?.end();
});

async function wilson(upvotes: number, downvotes: number): Promise<string> {
  const result = await pool!.query<{ value: string }>(
    "SELECT comment_wilson_reddit_80_v1($1, $2)::text AS value",
    [upvotes, downvotes],
  );
  // `numeric` chega como string no driver, de propósito: converter para `number`
  // aqui perderia precisão justamente nos casos que este teste existe para
  // travar. A comparação é textual.
  return result.rows[0].value;
}

describe.skipIf(!pool)("comment_wilson_reddit_80_v1 (função PostgreSQL)", () => {
  // Medidos contra o banco real em 2026-08-07. Se um destes mudar, a ordenação
  // `best` do produto mudou junto — é mudança de algoritmo, que a decisão 7 manda
  // fazer com `algorithm_version` nova, nunca reinterpretando o histórico.
  // Tupla explícita: sem ela o TypeScript infere `(string | number)[]` para cada
  // linha, e `upvotes`/`downvotes` chegam como `string | number` em `wilson`,
  // que só aceita `number`.
  it.each<readonly [string, number, number, string]>([
    ["sem voto nenhum", 0, 0, "0"],
    ["um upvote", 1, 0, "0.3784475032252061899591744110283788775970879231297090"],
    ["dez upvotes", 10, 0, "0.8589313179093835601100847408229973860172180167839490"],
    ["cem upvotes", 100, 0, "0.9838416366736703503858296071947352819486192843176396"],
    ["empate 1-1", 1, 1, "0.1642517200298418166789907846180604262053935979064923"],
    ["empate 10-10", 10, 10, "0.3622620430756211782637664853751994406402228156191481"],
    ["5-1", 5, 1, "0.5746713830470804356638328389216897057428089235934819"],
    ["50-10", 50, 10, "0.7629755145824471904671504667458196629460286237281201"],
    ["100-50", 100, 50, "0.6157692771624839377939308941498756760580863784179613"],
    ["3-1", 3, 1, "0.4325414503689864693780673158507718692420314295228099"],
    ["9-1", 9, 1, "0.7175556986096240952793359056796557076931686520519457"],
  ])("vetor %s", async (_caso, upvotes, downvotes, esperado) => {
    expect(await wilson(upvotes, downvotes)).toBe(esperado);
  });

  it("z = 1.281551565545 (80% unilateral), não 1.96", async () => {
    // O vetor `1,0` é o discriminante barato: com z=1.96 (95%, o valor que se
    // copia por engano de exemplo de Wilson na internet) o resultado seria
    // ~0.2065, não ~0.3784. Um teste que só verificasse "está entre 0 e 1"
    // aceitaria os dois e deixaria o produto ranquear com a confiança errada.
    const valor = Number(await wilson(1, 0));
    expect(valor).toBeGreaterThan(0.378);
    expect(valor).toBeLessThan(0.379);
  });

  it("mais upvotes nunca baixa o score", async () => {
    const crescente = [
      Number(await wilson(1, 0)),
      Number(await wilson(10, 0)),
      Number(await wilson(100, 0)),
    ];

    expect(crescente).toStrictEqual([...crescente].sort((a, b) => a - b));
  });

  it("mesma proporção com mais votos sobe: 10-10 acima de 1-1", async () => {
    // É o ponto do limite *inferior* do intervalo, e a razão de o Reddit usá-lo:
    // 1-1 e 10-10 têm a mesma média (0.5), mas o segundo tem mais evidência.
    expect(Number(await wilson(10, 10))).toBeGreaterThan(Number(await wilson(1, 1)));
  });

  it("é estável: mesma entrada, mesmo valor (IMMUTABLE não é decorativo)", async () => {
    // A função é declarada `IMMUTABLE` para poder sustentar uma coluna `STORED`.
    // Se deixasse de ser determinística, `best_score` congelaria um valor que a
    // função não reproduz mais, e o ranking divergiria do que o banco recalcula.
    expect(await wilson(7, 3)).toBe(await wilson(7, 3));
  });

  describe("ordem entre irmãos nos quatro sorts", () => {
    /**
     * `siblingOrder` (`communityCommentRead.ts:164`) não é exportada, e a query
     * completa exige assunto e comentários semeados — bloqueado até T2.6c. O que
     * dá para provar hoje, contra o mesmo PostgreSQL, é a **semântica de
     * ordenação** de cada sort sobre linhas literais: é ela que decide a posição
     * dos irmãos, e é o único trecho dos quatro sorts que não é repasse.
     *
     * Não substitui o smoke: a query real ainda precisa provar `sort_path`, o
     * join da faixa de score e o filtro de cursor.
     */
    async function ordenar(orderBy: string): Promise<string[]> {
      const result = await pool!.query<{ id: string }>(`
        WITH irmaos (id, best_score, score, created_at) AS (VALUES
          ('a', 0.90::numeric, 10, TIMESTAMPTZ '2026-01-01T00:00:00Z'),
          ('b', 0.95::numeric,  2, TIMESTAMPTZ '2026-01-02T00:00:00Z'),
          ('c', 0.10::numeric, 50, TIMESTAMPTZ '2026-01-03T00:00:00Z')
        )
        SELECT id FROM irmaos ORDER BY ${orderBy}
      `);
      return result.rows.map((linha) => linha.id);
    }

    // Os três critérios discordam de propósito: `b` vence em Wilson, `c` em
    // score líquido, e a ordem cronológica é `a,b,c`. Um sort que caísse no
    // critério errado devolveria uma ordem diferente das quatro esperadas.
    it("best ordena por best_score desc (Wilson, não score líquido)", async () => {
      expect(await ordenar("coalesce(best_score, 0) desc, created_at asc, id asc"))
        .toEqual(["b", "a", "c"]);
    });

    it("top ordena por score líquido desc, ignorando Wilson", async () => {
      expect(await ordenar("coalesce(score, 0) desc, created_at asc, id asc"))
        .toEqual(["c", "a", "b"]);
    });

    it("new ordena por created_at desc", async () => {
      expect(await ordenar("created_at desc, id desc")).toEqual(["c", "b", "a"]);
    });

    it("old ordena por created_at asc", async () => {
      expect(await ordenar("created_at asc, id asc")).toEqual(["a", "b", "c"]);
    });

    it("desempate por (created_at, id) é estável quando o score empata", async () => {
      // `spec.md` 8c: sem desempate determinístico, dois irmãos de mesmo score
      // trocam de lugar entre a primeira página e a expansão — um duplica, o
      // outro some. O PostgreSQL não garante ordem de linhas empatadas.
      const result = await pool!.query<{ id: string }>(`
        WITH irmaos (id, best_score, created_at) AS (VALUES
          ('z', 0.50::numeric, TIMESTAMPTZ '2026-01-01T00:00:00Z'),
          ('y', 0.50::numeric, TIMESTAMPTZ '2026-01-01T00:00:00Z'),
          ('x', 0.50::numeric, TIMESTAMPTZ '2026-01-01T00:00:00Z')
        )
        SELECT id FROM irmaos
        ORDER BY coalesce(best_score, 0) desc, created_at asc, id asc
      `);
      expect(result.rows.map((linha) => linha.id)).toEqual(["x", "y", "z"]);
    });

    it("comentário sem faixa de score não some do sort: coalesce cobre o NULL", async () => {
      // Comentário recém-criado ainda não tem linha em
      // `community_comment_score_version`. Sem `coalesce`, `NULL` ordenaria
      // primeiro em `DESC` (NULLS FIRST é o padrão do PostgreSQL) e o comentário
      // sem voto abriria a conversa acima dos mais bem avaliados.
      const result = await pool!.query<{ id: string }>(`
        WITH irmaos (id, best_score) AS (VALUES
          ('sem_score', NULL::numeric),
          ('bom', 0.80::numeric)
        )
        SELECT id FROM irmaos ORDER BY coalesce(best_score, 0) desc, id asc
      `);
      expect(result.rows.map((linha) => linha.id)).toEqual(["bom", "sem_score"]);
    });
  });

  describe("zero upvotes: sem resíduo negativo (migration 009)", () => {
    // Antes da 009 a função devolvia ~-1e-18 aqui, por cancelamento catastrófico:
    // com p̂ = 0 o numerador é `z²/(2n) - z·√(z²/(4n²))`, que simplifica para
    // zero, mas `SQRT` em `numeric` arredonda e a subtração de dois valores quase
    // iguais perde os dígitos significativos.
    //
    // O bug não era cosmético: o resíduo **encolhe** conforme `n` cresce, então a
    // ordem entre comentários sem upvote saía invertida — um downvote ordenava
    // abaixo de mil no sort `best`, que é o padrão de abertura da conversa
    // (`spec.md` 8c).
    it.each([1, 5, 100, 1000])("(0, %i) devolve exatamente zero", async (downvotes) => {
      expect(await wilson(0, downvotes)).toBe("0");
    });

    it("comentários sem upvote empatam entre si, em vez de ordenar ao contrário", async () => {
      // O empate é o comportamento correto: sem nenhum voto positivo, o limite
      // inferior do intervalo é zero independente de quantos downvotes existam.
      // Quem separa esses comentários passa a ser o desempate `(created_at, id)`,
      // que é determinístico — e não um resíduo de arredondamento.
      expect(await wilson(0, 1)).toBe(await wilson(0, 1000));
    });

    it("nunca é negativo: é uma probabilidade", async () => {
      for (const [upvotes, downvotes] of [[0, 1], [0, 50], [1, 1000], [0, 0]]) {
        expect(Number(await wilson(upvotes, downvotes))).toBeGreaterThanOrEqual(0);
      }
    });

    it("o clamp não achatou nenhum caso válido", async () => {
      // `GREATEST(..., 0)` só podia afetar o que já era negativo. Este vetor é o
      // mesmo de cima, repetido de propósito: se a correção tivesse mexido na
      // fórmula, ele mudaria.
      expect(await wilson(3, 1)).toBe(
        "0.4325414503689864693780673158507718692420314295228099",
      );
    });
  });
});
