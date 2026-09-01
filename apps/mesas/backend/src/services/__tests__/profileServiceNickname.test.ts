import { describe, expect, it } from 'vitest';
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
