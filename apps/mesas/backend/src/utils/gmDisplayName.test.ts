import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PostgresDialect, Kysely } from 'kysely';
import { gmProfileDisplayNameSql, tableGmDisplayNameSql } from './gmDisplayName.js';

const compile = (frag: { compile: (db: Kysely<unknown>) => { sql: string } }) =>
  frag.compile(new Kysely<unknown>({ dialect: new PostgresDialect({ pool: {} as never }) })).sql;

describe('gmDisplayName — um nome de mestre em todas as superfícies (spec 106 R4)', () => {
  it('sobrescrita da mesa vence o perfil, e string só de espaços não conta', () => {
    expect(compile(tableGmDisplayNameSql())).toBe(
      "COALESCE(NULLIF(btrim(t.master_display_name), ''), gm.nickname, p.display_name, gm.slug)",
    );
  });

  it('perfil: nickname → display_name → slug', () => {
    expect(compile(gmProfileDisplayNameSql())).toBe('COALESCE(gm.nickname, p.display_name, gm.slug)');
  });

  it('nenhuma rota volta a escrever o COALESCE do nome à mão', () => {
    for (const f of ['tables.ts', 'og.ts', 'gm.ts']) {
      const src = readFileSync(new URL(`../routes/${f}`, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/COALESCE\(gm\.nickname/);
    }
  });
});
