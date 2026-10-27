import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deriveGmNickname, slugifyGmName } from '../profileService.js';

const ID = '528baa88-0000-0000-0000-000000000000';

/**
 * Spec 106 R1/D4 (substitui a ordem da 099 E1): `patch → profiles.display_name →
 * username → user-<8 hex>`. O e-mail não entra. Caso medido: `patorico027` era o
 * prefixo do e-mail do mestre `VOID` (`display_name` = `VOID`).
 */
describe('deriveGmNickname — perfil nunca nasce sem nickname, nunca do e-mail', () => {
  it('usa o nickname do patch quando ele ja e valido', () => {
    expect(deriveGmNickname({ displayName: 'VOID', username: 'void' }, ID, { nickname: 'Mestre Jeff' }))
      .toBe('Mestre Jeff');
  });

  it('sem patch, display_name vence o username', () => {
    expect(deriveGmNickname({ displayName: 'VOID', username: 'dadoviciado' }, ID)).toBe('VOID');
  });

  it('cai no username quando nao ha display_name', () => {
    expect(deriveGmNickname({ displayName: null, username: 'dadoviciado' }, ID)).toBe('dadoviciado');
  });

  it('sem nada, user-<8 hex do id> — nunca vazio', () => {
    expect(deriveGmNickname({}, ID)).toBe('user-528baa88');
    expect(deriveGmNickname({ displayName: '', username: ' ' }, ID)).toBe('user-528baa88');
  });

  it('o placeholder "Usuário" de updateProfile não vira nome público: cai no username', () => {
    expect(deriveGmNickname({ displayName: ' usuário ', username: 'dadoviciado' }, ID)).toBe('dadoviciado');
    expect(deriveGmNickname({ displayName: 'Usuário' }, ID)).toBe('user-528baa88');
  });

  it('respeita o piso de 2 caracteres do contrato do backend', () => {
    expect(deriveGmNickname({ displayName: 'x', username: 'y' }, ID)).toBe('user-528baa88');
  });

  it('corta em 40 caracteres, o teto do contrato', () => {
    expect(deriveGmNickname({ displayName: 'M'.repeat(60) }, ID)).toHaveLength(40);
  });
});

describe('deriveGmNickname — patch invalido nao vence o fallback', () => {
  const names = { displayName: 'VOID', username: 'void' };

  it.each([null, 'x', '   '])('nickname %j no patch cai no fallback', (nickname) => {
    expect(deriveGmNickname(names, ID, { nickname })).toBe('VOID');
  });

  it('nickname acima de 40 e cortado, nunca recusado pelo POST depois', () => {
    expect(deriveGmNickname(names, ID, { nickname: 'M'.repeat(60) })).toHaveLength(40);
  });
});

describe('slugifyGmName', () => {
  it('tira acento e normaliza separador', () => {
    expect(slugifyGmName('Clézio RPG')).toBe('clezio-rpg');
    expect(slugifyGmName('Dado Viciado')).toBe('dado-viciado');
  });

  it('nome sem letra nem numero devolve vazio (o chamador cai em user-<8 hex>)', () => {
    expect(slugifyGmName('***')).toBe('');
  });

  it('sem hifen nas pontas, nem depois do corte em 36', () => {
    expect(slugifyGmName('--Dado  Viciado!!')).toBe('dado-viciado');
    expect(slugifyGmName(`${'a'.repeat(35)} b`)).toBe('a'.repeat(35));
  });

  it('entrada hostil de hifens e simbolos roda em tempo linear', () => {
    const inicio = Date.now();
    expect(slugifyGmName('-'.repeat(200_000) + 'x' + '-'.repeat(200_000))).toBe('x');
    expect(Date.now() - inicio).toBeLessThan(500);
  });
});

/**
 * R1 + A9: o e-mail não pode voltar a alimentar a identidade. Se alguém reintroduzir
 * `email.split('@')` em `profileService.ts`, este teste falha.
 */
describe('identidade do mestre — sem e-mail', () => {
  it('profileService.ts nao le o e-mail para derivar nome ou slug', () => {
    const source = readFileSync(new URL('../profileService.ts', import.meta.url), 'utf8');
    const start = source.indexOf('export function deriveGmNickname');
    const end = source.indexOf('async function promoteUserToGm');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(source.slice(start, end)).not.toMatch(/email/i);
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
    // A chave e so `nickname` desde a extracao de `prepareNewGmProfileIdentity`
    // (achado de duplicacao do Sonar, PR #302). O que o teste guarda continua
    // sendo a POSICAO: vindo depois do spread, o patch nao a sobrescreve.
    expect(/(^|\s)nickname,/.test(insertSource)).toBe(true);
    expect(insertSource.search(/(^|\s)nickname,/)).toBeGreaterThan(
      insertSource.indexOf('...sanitizedData'),
    );
  });
});

/**
 * A duplicacao entre os dois caminhos de criacao foi o que permitiu que E1
 * precisasse ser corrigida duas vezes (a segunda por review). Se alguem voltar
 * a escrever a derivacao inline num deles, as copias divergem de novo.
 */
describe('prepareNewGmProfileIdentity — um caminho so para criar perfil', () => {
  it('e usado pelo insert de gm_profiles do service, sem derivacao inline', () => {
    const source = readFileSync(new URL('../profileService.ts', import.meta.url), 'utf8');

    const chamadas = source.match(/prepareNewGmProfileIdentity\(/g) ?? [];
    // 1 chamada (`updateGmProfile`) + a declaracao. A 2a era `connectDiscord`,
    // removida na spec 106 T10.1; `POST /gm/profile` chama de `gmPanel.ts`.
    expect(chamadas).toHaveLength(2);

    // A unica derivacao legitima vive DENTRO de `prepareNewGmProfileIdentity`;
    // procurar a partir do inicio dela acusaria a propria funcao. O corte e o
    // `promoteUserToGm` declarado logo abaixo — dali para a frente, qualquer
    // `nickname: deriveGmNickname(` inline e uma copia voltando.
    const depoisDaDeclaracao = source.slice(
      source.indexOf('async function promoteUserToGm'),
    );
    expect(depoisDaDeclaracao.match(/nickname: deriveGmNickname\(/g)).toBeNull();
  });
});

// Spec 106 T8.8 (R21): para qualquer prefixo de e-mail, nickname e slug nascem do
// nome escolhido, nunca do prefixo. O e-mail nem é argumento da derivação; o caso
// `patorico027` / `VOID` é o medido em produção.
describe('identidade cruzada — nickname e slug ≠ prefixo do e-mail', () => {
  it.each([
    ['patorico027@gmail.com', 'VOID'],
    ['dadoviciado@gmail.com', 'Dado Viciado'],
  ])('%s com display_name %s', (email, displayName) => {
    const prefixo = email.split('@')[0];
    const nickname = deriveGmNickname({ displayName, username: null }, ID);
    expect(nickname).toBe(displayName);
    expect(nickname.toLowerCase()).not.toBe(prefixo);
    expect(slugifyGmName(nickname)).not.toBe(prefixo);
  });
});
