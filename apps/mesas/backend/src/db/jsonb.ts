/**
 * Serialização de colunas JSONB para a escrita via Kysely.
 *
 * **Por que isto existe.** O driver `pg` não serializa objeto/array JS para
 * JSONB: ele aplica a conversão de *array do Postgres*, então `[{title: 'x'}]`
 * chega ao banco como `{"{\"title\":\"x\"}"}` e o Postgres recusa com
 * `22P02 invalid input syntax for type json` (`Expected ":", but found "}"`).
 * Medido em `mesasbeta` (2026-09-04): `PUT /api/v1/gm/profile` devolvia 500 na
 * primeira gravação real de `selling_points`.
 *
 * O defeito passou despercebido porque as colunas de `gm_profiles` estavam
 * tipadas como `unknown` dos dois lados — esquecer de serializar compilava. O
 * `ColumnType<T, string, string>` em `types.ts` fecha isso no compilador (mesmo
 * padrão de `notification_outbox.snapshot`), e este helper é o par da trava:
 * o tipo obriga uma string, esta função produz a string certa.
 *
 * Preserva o contrato de três estados que as rotas usam: `undefined` mantém o
 * valor salvo (a coluna sai do `SET`/`VALUES`), `null` zera a coluna, e
 * qualquer outro valor é serializado.
 */
export function toJsonbParam<T>(value: T | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.stringify(value);
}

/**
 * Variante para coluna `NOT NULL DEFAULT '[]'` (`gm_profiles.selling_points`,
 * `gm_profiles.contact_methods`): ali `null` é recusado pelo banco, e omitir a
 * coluna é o único jeito de "não mexer". Manter os dois tipos separados é o que
 * faz o compilador recusar um `null` que só falharia em runtime.
 */
export function toJsonbParamNotNull<T>(value: T | undefined): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}
