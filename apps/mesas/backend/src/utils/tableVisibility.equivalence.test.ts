import { randomUUID } from 'node:crypto';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { importedTableIsCurrentSql, isImportedTableExpired } from './tableVisibility.js';

/**
 * T1.1 (spec 102) — trava de EQUIVALÊNCIA entre as duas formas da mesma regra.
 *
 * ## Por que este arquivo existe, e por que contra PostgreSQL real
 *
 * "Mesa visível" é escrita duas vezes em `tableVisibility.ts`, de propósito:
 * `isImportedTableExpired` decide sobre um objeto já carregado (SSR, detalhe,
 * Open Graph) e `importedTableIsCurrentSql` decide dentro do `where` de uma
 * query (sitemap, catálogo). Não dá para colapsar as duas — uma roda em
 * JavaScript sobre uma linha, a outra roda no Postgres sobre o conjunto.
 *
 * O risco é a dupla divergir em silêncio, e ela JÁ divergiu três vezes:
 * detalhe ↔ Open Graph (achado CodeRabbit, spec 059/060, que é o motivo deste
 * módulo existir), sitemap ↔ SSR (spec 102 T1.4: o sitemap anunciava 51 de 92
 * URLs que o servidor tratava como inexistentes — soft-404 medido em produção)
 * e o espelho `apps/mesas/frontend/src/utils/tableVisibility.ts`, que segue
 * divergente porque unificá-lo exige um pacote compartilhado que ainda não
 * existe (T1.1 item 3, bloqueado em autorização).
 *
 * Os testes de `tableVisibility.test.ts` cobrem a regra de expiração no lado
 * do objeto; nenhum deles compara os dois lados. Este compara: para o mesmo
 * conjunto de linhas, os ids que o SQL seleciona têm de ser exatamente os ids
 * que o predicado de objeto aprova. Alterar um lado só faz este teste falhar.
 *
 * ## Por que não serve compilar o SQL sem executá-lo
 *
 * Casar o texto da query provaria a forma, não o resultado. O que diverge aqui
 * é semântica de data: `LEAST`/`COALESCE`/`INTERVAL` e o `NOW()` do servidor
 * contra o relógio do Node, incluindo o comportamento com `starts_at` nulo e
 * exatamente no limite. Isso só aparece executando no Postgres.
 *
 * Para rodar:
 * `MESAS_TEST_DATABASE_URL=postgres://... pnpm --filter @artificio/mesas-backend test`
 *
 * Sem a variável o arquivo se declara ausente (`describe.skipIf`) em vez de
 * passar vazio — a suíte do `mesas` é mockada e não sobe banco por padrão.
 */
const databaseUrl = process.env.MESAS_TEST_DATABASE_URL;

interface EquivalenceDatabase {
  [table: string]: {
    id: string;
    origin: string | null;
    created_at: Date;
    starts_at: Date | null;
  };
}

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const db = pool
  ? new Kysely<EquivalenceDatabase>({ dialect: new PostgresDialect({ pool }) })
  : null;

afterAll(async () => {
  await db?.destroy();
});

const DIA_MS = 24 * 60 * 60 * 1000;
const agora = Date.now();
const emDias = (dias: number): Date => new Date(agora + dias * DIA_MS);

/**
 * Casos nos limites de
 * `LEAST(COALESCE(starts_at, created_at + INTERVAL '5 days'), created_at + INTERVAL '5 days')`.
 *
 * Cada linha nomeia o que está sendo exercido; a expectativa NÃO fica aqui de
 * propósito — quem a define é `isImportedTableExpired`, e o teste verifica que
 * o SQL chega ao mesmo veredito. Fixar o esperado à mão aqui criaria uma
 * terceira definição da regra, que é justamente o defeito sob teste.
 */
const casos: ReadonlyArray<{
  label: string;
  origin: string | null;
  created_at: Date;
  starts_at: Date | null;
}> = [
  // --- origem: só `imported` entra na regra ---
  { label: 'manual antiga sem starts_at', origin: 'manual', created_at: emDias(-90), starts_at: null },
  { label: 'manual antiga com evento passado', origin: 'manual', created_at: emDias(-90), starts_at: emDias(-30) },
  { label: 'origin nulo e antiga', origin: null, created_at: emDias(-90), starts_at: null },

  // --- limite dos 5 dias, sem `starts_at` ---
  { label: 'importada recém-criada', origin: 'imported', created_at: emDias(-1), starts_at: null },
  { label: 'importada a 4 dias (antes do limite)', origin: 'imported', created_at: emDias(-4), starts_at: null },
  { label: 'importada a 6 dias (depois do limite)', origin: 'imported', created_at: emDias(-6), starts_at: null },
  // O limite exato é o caso que mais separa as implementações: `>` no SQL e
  // `>=` no objeto tratam o instante zero de formas opostas. As duas margens
  // abaixo cercam esse ponto sem depender de o relógio do Postgres e o do Node
  // marcarem o mesmo milissegundo.
  { label: 'importada a 5 dias menos 1 minuto', origin: 'imported', created_at: new Date(agora - 5 * DIA_MS + 60_000), starts_at: null },
  { label: 'importada a 5 dias mais 1 minuto', origin: 'imported', created_at: new Date(agora - 5 * DIA_MS - 60_000), starts_at: null },

  // --- `starts_at` vence antes dos 5 dias ---
  { label: 'importada com evento amanhã', origin: 'imported', created_at: emDias(-1), starts_at: emDias(1) },
  { label: 'importada com evento ontem (criada hoje)', origin: 'imported', created_at: emDias(-1), starts_at: emDias(-0.5) },
  { label: 'importada com evento daqui a 1 minuto', origin: 'imported', created_at: emDias(-1), starts_at: new Date(agora + 60_000) },
  { label: 'importada com evento há 1 minuto', origin: 'imported', created_at: emDias(-1), starts_at: new Date(agora - 60_000) },

  // --- `starts_at` depois dos 5 dias: quem manda é o limite de criação ---
  { label: 'importada criada hoje, evento em 30 dias', origin: 'imported', created_at: emDias(-1), starts_at: emDias(30) },
  { label: 'importada criada há 10 dias, evento em 30 dias', origin: 'imported', created_at: emDias(-10), starts_at: emDias(30) },
];

describe.skipIf(!db)('equivalência entre importedTableIsCurrentSql e isImportedTableExpired', () => {
  it('SQL e predicado de objeto selecionam exatamente o mesmo conjunto', async () => {
    // `!` seguro sob `skipIf`: o bloco só roda com a conexão montada.
    const conexao = db!;
    // Tabela temporária: a regra só toca `origin`, `created_at` e `starts_at`,
    // então o teste não depende do schema de `tables` nem escreve em tabela de
    // negócio. `TEMP` some com a sessão, e o nome único evita colisão entre
    // execuções concorrentes na mesma base.
    const tabela = `equivalencia_visibilidade_${randomUUID().replace(/-/g, '')}`;

    await sql`
      CREATE TEMP TABLE ${sql.ref(tabela)} (
        id          TEXT        PRIMARY KEY,
        origin      TEXT,
        created_at  TIMESTAMPTZ NOT NULL,
        starts_at   TIMESTAMPTZ
      )
    `.execute(conexao);

    const linhas = casos.map((caso, indice) => ({
      id: `${indice}-${caso.label}`,
      origin: caso.origin,
      created_at: caso.created_at,
      starts_at: caso.starts_at,
    }));

    await conexao.insertInto(tabela).values(linhas).execute();

    const selecionadosPeloSql = await conexao
      .selectFrom(tabela)
      .select('id')
      .where(importedTableIsCurrentSql(tabela))
      .execute();

    const idsSql = selecionadosPeloSql.map((linha) => linha.id).sort((a, b) => a.localeCompare(b));
    const idsObjeto = linhas
      .filter((linha) => !isImportedTableExpired(linha))
      .map((linha) => linha.id)
      .sort((a, b) => a.localeCompare(b));

    expect(idsSql).toEqual(idsObjeto);

    // Guard contra falso verde: se um bug fizesse os dois lados aprovarem tudo
    // ou recusarem tudo, a igualdade acima passaria sem provar nada. O conjunto
    // de casos tem vigentes E expiradas, então as duas contagens são
    // estritamente intermediárias.
    expect(idsObjeto.length).toBeGreaterThan(0);
    expect(idsObjeto.length).toBeLessThan(linhas.length);
  });
});
