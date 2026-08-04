import { describe, expect, it } from 'vitest';
import { canonicalizeContactValue, canonicalizeSocialProfileUrl, isResolvableUrl } from './contactUrls.js';

describe('canonicalizeSocialProfileUrl', () => {
  it('aceita host da própria rede', () => {
    expect(canonicalizeSocialProfileUrl('facebook', 'facebook.com/meuperfil'))
      .toEqual({ ok: true, value: 'https://facebook.com/meuperfil' });
    expect(canonicalizeSocialProfileUrl('instagram', 'https://instagr.am/meuperfil').ok).toBe(true);
  });

  it('canonicaliza username cru para o domínio da rede', () => {
    // Mesma transformação que a página pública já fazia — sem isso a API
    // recusava `meuperfil`, que o render sabia exibir.
    expect(canonicalizeSocialProfileUrl('facebook', 'meuperfil'))
      .toEqual({ ok: true, value: 'https://facebook.com/meuperfil' });
    expect(canonicalizeSocialProfileUrl('instagram', '@meuperfil'))
      .toEqual({ ok: true, value: 'https://instagram.com/meuperfil' });
  });

  it('recusa host de fora da rede, que o render não exibiria', () => {
    // Divergência apontada pelo Codex na PR #236: a API aceitava e o contato
    // sumia da página pública, sem erro em lugar nenhum.
    expect(canonicalizeSocialProfileUrl('facebook', 'https://exemplo.com/perfil').ok).toBe(false);
    expect(canonicalizeSocialProfileUrl('instagram', 'https://linktr.ee/meu').ok).toBe(false);
    expect(canonicalizeSocialProfileUrl('facebook', 'javascript:alert(1)').ok).toBe(false);
  });

  it('mantém canais não-sociais na regra genérica de URL', () => {
    expect(canonicalizeSocialProfileUrl('form', 'https://forms.gle/abc').ok).toBe(true);
  });
});

describe('isResolvableUrl', () => {
  it('aceita endereço com host alcançável', () => {
    expect(isResolvableUrl('https://forms.gle/abc')).toBe(true);
    expect(isResolvableUrl('forms.gle/abc')).toBe(true);
    expect(isResolvableUrl('https://sub.exemplo.com.br/inscricao')).toBe(true);
  });

  it('recusa identificador solto que canonicalizaria para host morto', () => {
    // Valores reais de produção (3 mesas ativas): o parser do Discord jogou o
    // nick do mestre no campo de URL e `https://uwill/` só produz erro de DNS.
    expect(isResolvableUrl('uwill')).toBe(false);
    expect(isResolvableUrl('.zero9899')).toBe(false);
    expect(isResolvableUrl('kauarang')).toBe(false);
  });

  it('recusa host sem TLD alfabético ou malformado', () => {
    expect(isResolvableUrl('localhost')).toBe(false);
    expect(isResolvableUrl('https://192.168.0.1/x')).toBe(false);
    expect(isResolvableUrl('exemplo.')).toBe(false);
    expect(isResolvableUrl('-exemplo.com')).toBe(false);
  });

  it('recusa o que canonicalizeHttpsUrl já rejeita', () => {
    expect(isResolvableUrl('javascript:alert(1)')).toBe(false);
    expect(isResolvableUrl('http://exemplo.com')).toBe(false);
    expect(isResolvableUrl('')).toBe(false);
    expect(isResolvableUrl(null)).toBe(false);
  });
});

describe('canonicalizeContactValue', () => {
  it('aplica a regra de rede social nos canais sociais', () => {
    // Roteamento por canal: sem ele, `exemplo.com/perfil` passaria pela regra
    // genérica de URL (host alcançável) e seria gravado como perfil do Facebook,
    // que a página pública não renderiza — o contato sumiria sem erro.
    expect(canonicalizeContactValue('facebook', 'exemplo.com/perfil')?.ok).toBe(false);
    expect(canonicalizeContactValue('instagram', 'exemplo.com/perfil')?.ok).toBe(false);

    expect(canonicalizeContactValue('facebook', 'meuperfil'))
      .toEqual({ ok: true, value: 'https://facebook.com/meuperfil' });
    expect(canonicalizeContactValue('instagram', 'instagram.com/meuperfil')?.ok).toBe(true);
  });

  it('exige host alcançável no canal de URL genérico', () => {
    expect(canonicalizeContactValue('form', 'uwill')?.ok).toBe(false);
    expect(canonicalizeContactValue('form', 'https://forms.gle/abc')?.ok).toBe(true);
  });

  it('devolve null para canal cujo valor não é URL', () => {
    // `null` distingue "não se aplica" de "inválido": o schema persiste o valor
    // original nesses canais, em vez de tentar canonicalizar telefone ou e-mail.
    expect(canonicalizeContactValue('whatsapp', '+5511999999999')).toBeNull();
    expect(canonicalizeContactValue('email', 'mestre@example.com')).toBeNull();
    expect(canonicalizeContactValue('discord', 'uwill')).toBeNull();
    expect(canonicalizeContactValue('phone', '(11) 99999-9999')).toBeNull();
  });
});
