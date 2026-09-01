import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deriveGmNickname } from '../profileService.js';

/**
 * Relato do mantenedor (2026-09-01, mestre `dadoviciadopodcast`): perfil nascia
 * com `nickname` NULL, e o `POST /gm/profile` exige 2-40 caracteres. Medido em
 * producao: 7 de 49 perfis sem nickname, mestre travado sem publicar mesa.
 */
describe('deriveGmNickname — perfil nunca nasce sem nickname', () => {
  it('usa o nickname do patch quando ele ja e valido', () => {
    expect(deriveGmNickname({ username: 'fulano', email: 'a@b.com' }, 'slug-x', { nickname: 'Mestre Jeff' }))
      .toBe('Mestre Jeff');
  });

  it('cai no username quando o patch nao traz nickname', () => {
    expect(deriveGmNickname({ username: 'dadoviciado', email: 'a@b.com' }, 'slug-x'))
      .toBe('dadoviciado');
  });

  it('cai no local do e-mail quando nao ha username', () => {
    expect(deriveGmNickname({ username: null, email: 'jeferson@exemplo.com' }, 'slug-x'))
      .toBe('jeferson');
  });

  it('cai no slug quando username e e-mail nao servem — nunca devolve vazio', () => {
    expect(deriveGmNickname({ username: '', email: 'a@b.com' }, 'dadoviciadopodcast'))
      .toBe('dadoviciadopodcast');
    expect(deriveGmNickname(undefined, 'user-528baa88')).toBe('user-528baa88');
  });

  it('respeita o piso de 2 caracteres do contrato do backend', () => {
    // username de 1 char seria recusado pelo POST com 400.
    expect(deriveGmNickname({ username: 'x', email: 'a@b.com' }, 'slug-valido'))
      .toBe('slug-valido');
  });

  it('corta em 40 caracteres, o teto do contrato', () => {
    const longo = 'M'.repeat(60);
    expect(deriveGmNickname({ username: longo, email: 'a@b.com' }, 'slug-x')).toHaveLength(40);
  });
});

/**
 * Achado de review (PR #301): a primeira correcao de E1 punha `nickname:
 * deriveGmNickname(...)` ANTES de `...sanitizedData` no insert, e o patch
 * sobrescrevia o valor derivado. Como o `PATCH /api/v1/profile/gm` manda
 * `nickname` explicitamente (`profile.ts:183`), os tres casos abaixo voltavam a
 * gravar registro fora do contrato de 2-40 — a porta que E1 fecha.
 *
 * O teste e sobre a FUNCAO porque e ela que decide; a ordem no insert e
 * verificada por leitura (`...sanitizedData` vem antes da chave derivada).
 */
describe('deriveGmNickname — patch invalido nao vence o fallback', () => {
  const user = { username: 'dadoviciado', email: 'jeferson@exemplo.com' };

  it('nickname null no patch cai no fallback, nao grava null', () => {
    expect(deriveGmNickname(user, 'dadoviciadopodcast', { nickname: null }))
      .toBe('dadoviciado');
  });

  it('nickname de 1 caractere cai no fallback (piso de 2 do contrato)', () => {
    expect(deriveGmNickname(user, 'dadoviciadopodcast', { nickname: 'x' }))
      .toBe('dadoviciado');
  });

  it('nickname acima de 40 e cortado, nunca recusado pelo POST depois', () => {
    const resultado = deriveGmNickname(user, 'slug-x', { nickname: 'M'.repeat(60) });
    expect(resultado).toHaveLength(40);
  });

  it('so espacos no patch cai no fallback', () => {
    expect(deriveGmNickname(user, 'dadoviciadopodcast', { nickname: '   ' }))
      .toBe('dadoviciado');
  });
});

describe('updateGmProfile — o nickname derivado vence o patch invalido', () => {
  it('mantem nickname depois de ...sanitizedData no insert de gm_profiles', () => {
    const source = readFileSync(new URL('../profileService.ts', import.meta.url), 'utf8');
    const updateStart = source.indexOf('export async function updateGmProfile');
    const updateEnd = source.indexOf('export async function addUserSystem', updateStart);
    const updateSource = source.slice(updateStart, updateEnd);
    const insertStart = updateSource.indexOf(".insertInto('gm_profiles')");
    const insertEnd = updateSource.indexOf('.execute();', insertStart);
    const insertSource = updateSource.slice(insertStart, insertEnd);

    expect(updateStart).toBeGreaterThanOrEqual(0);
    expect(insertStart).toBeGreaterThanOrEqual(0);
    expect(insertSource.indexOf('...sanitizedData')).toBeGreaterThanOrEqual(0);
    expect(insertSource.indexOf('nickname: deriveGmNickname')).toBeGreaterThan(
      insertSource.indexOf('...sanitizedData'),
    );
  });
});
