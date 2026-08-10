import { describe, expect, it } from 'vitest';
import {
  COMMENT_RATE_BUCKETS,
  RateLimitConfigurationError,
  resolveRateLimitKeys,
  serializeRateLimitKey,
} from './rateLimitBuckets.js';

/**
 * T2.10 — chaves de bucket (`spec.md` 12b; decisões 50, 54;
 * `contrato-http-v1.md` §14).
 *
 * O que estes casos protegem são invariantes **negativos**: IP que não pode
 * chegar ao `accounts.`, chave composta que não pode existir, e o bucket de
 * autenticação que não pode aparecer na lista. Nenhum deles falha sozinho em
 * runtime — todos passam despercebidos até virarem abuso não contido ou PII
 * gravada.
 */

const USUARIO = 'user-1';
const OUTRO_USUARIO = 'user-2';

describe('a lista de buckets é o contrato §14', () => {
  it('tem exatamente os seis buckets, e nenhum de autenticação', () => {
    // `authentication` fora da lista é o mecanismo, não um esquecimento: 12b
    // manda que nenhum bucket comunitário consuma cota de login, e não existe
    // valor a passar que faça isso.
    expect([...COMMENT_RATE_BUCKETS]).toEqual([
      'read',
      'write',
      'edit',
      'vote',
      'report',
      'appeal',
    ]);
    expect(COMMENT_RATE_BUCKETS).not.toContain('authentication');
  });
});

describe('camada accounts nunca vê IP (decisão 54)', () => {
  it('IP na camada interna é erro de configuração, não é ignorado', () => {
    // Ignorar em silêncio deixaria o chamador achar que o IP virou chave — e um
    // dia ele viraria, porque ninguém saberia que não vira.
    expect(() =>
      resolveRateLimitKeys('accounts', 'write', {
        userId: USUARIO,
        sourceApp: 'downloads',
        ip: '203.0.113.7',
      }),
    ).toThrow(RateLimitConfigurationError);
  });

  it('nenhuma chave da camada interna carrega dimensão de IP', () => {
    const keys = resolveRateLimitKeys('accounts', 'vote', {
      userId: USUARIO,
      sourceApp: 'downloads',
    });

    expect(keys.map((k) => k.dimension).sort()).toEqual(['credential', 'user']);
    expect(keys.some((k) => k.dimension === 'ip')).toBe(false);
  });

  it('camada interna exige a credencial: sem ela não há o que limitar', () => {
    expect(() =>
      resolveRateLimitKeys('accounts', 'write', { userId: USUARIO }),
    ).toThrow(RateLimitConfigurationError);
  });
});

describe('todas as dimensões viram chaves separadas, nunca uma composta', () => {
  it('usuário e credencial são duas chaves', () => {
    // Chave composta `usuário+credencial` daria ao mesmo usuário orçamento novo
    // a cada `source_app`, e um módulo com bug gastaria a cota de todos os seus
    // usuários sem estourar nada.
    const keys = resolveRateLimitKeys('accounts', 'write', {
      userId: USUARIO,
      sourceApp: 'downloads',
    });

    expect(keys).toHaveLength(2);
    expect(new Set(keys.map(serializeRateLimitKey)).size).toBe(2);
  });

  it('IP e usuário são duas chaves na fachada', () => {
    // NAT: a chave de IP é compartilhada por muita gente, a de usuário não.
    // Compor as duas faria o usuário legítimo herdar o consumo do vizinho.
    const keys = resolveRateLimitKeys('facade', 'read', {
      userId: USUARIO,
      ip: '203.0.113.7',
    });

    expect(keys.map((k) => k.dimension).sort()).toEqual(['ip', 'user']);
  });

  it('nenhuma chave concatena duas identidades no mesmo valor', () => {
    const keys = resolveRateLimitKeys('facade', 'read', {
      userId: USUARIO,
      ip: '203.0.113.7',
    });

    for (const key of keys) {
      expect(key.value === USUARIO || key.value === '203.0.113.7').toBe(true);
    }
  });
});

describe('leitura pública sem sessão continua possível', () => {
  it('fachada sem usuário chaveia só por IP', () => {
    // A conversa é pública (§2). Recusar leitura por falta de conta contradiria
    // o produto; o IP ainda limita.
    const keys = resolveRateLimitKeys('facade', 'read', {
      userId: null,
      ip: '203.0.113.7',
    });

    expect(keys).toHaveLength(1);
    expect(keys[0].dimension).toBe('ip');
  });

  it('camada interna sem X-Acting-User-Id chaveia só pela credencial', () => {
    // O header é opcional na leitura (§2, só afeta `my_vote`). A credencial
    // sozinha continua contendo um módulo descontrolado.
    const keys = resolveRateLimitKeys('accounts', 'read', {
      userId: null,
      sourceApp: 'site',
    });

    expect(keys).toHaveLength(1);
    expect(keys[0].dimension).toBe('credential');
  });

  it('fachada exige IP real validado', () => {
    expect(() => resolveRateLimitKeys('facade', 'read', { userId: USUARIO })).toThrow(
      RateLimitConfigurationError,
    );
  });

  it('fachada não recebe credencial de serviço: ela fala com o navegador', () => {
    expect(() =>
      resolveRateLimitKeys('facade', 'read', {
        userId: USUARIO,
        ip: '203.0.113.7',
        sourceApp: 'downloads',
      }),
    ).toThrow(RateLimitConfigurationError);
  });
});

describe('a serialização mantém os orçamentos separados', () => {
  it('camadas diferentes não compartilham contador', () => {
    // Sem o prefixo de camada, o consumo da fachada abateria o orçamento
    // interno do mesmo usuário — ele pagaria duas vezes pela mesma ação.
    const facade = serializeRateLimitKey({
      layer: 'facade',
      bucket: 'write',
      dimension: 'user',
      value: USUARIO,
    });
    const accounts = serializeRateLimitKey({
      layer: 'accounts',
      bucket: 'write',
      dimension: 'user',
      value: USUARIO,
    });

    expect(facade).not.toBe(accounts);
  });

  it('buckets diferentes não compartilham contador', () => {
    const escrita = resolveRateLimitKeys('accounts', 'write', {
      userId: USUARIO,
      sourceApp: 'downloads',
    }).map(serializeRateLimitKey);
    const voto = resolveRateLimitKeys('accounts', 'vote', {
      userId: USUARIO,
      sourceApp: 'downloads',
    }).map(serializeRateLimitKey);

    expect(escrita.some((k) => voto.includes(k))).toBe(false);
  });

  it('usuários diferentes não compartilham contador', () => {
    const um = resolveRateLimitKeys('accounts', 'write', {
      userId: USUARIO,
      sourceApp: 'downloads',
    });
    const outro = resolveRateLimitKeys('accounts', 'write', {
      userId: OUTRO_USUARIO,
      sourceApp: 'downloads',
    });

    const chaveDeUsuario = (keys: typeof um) =>
      keys.filter((k) => k.dimension === 'user').map(serializeRateLimitKey);

    expect(chaveDeUsuario(um)).not.toEqual(chaveDeUsuario(outro));
  });

  it('a credencial é compartilhada entre usuários do mesmo módulo — de propósito', () => {
    // É o que permite conter um módulo inteiro descontrolado sem depender de
    // identificar qual usuário dele está abusando.
    const um = resolveRateLimitKeys('accounts', 'write', {
      userId: USUARIO,
      sourceApp: 'downloads',
    });
    const outro = resolveRateLimitKeys('accounts', 'write', {
      userId: OUTRO_USUARIO,
      sourceApp: 'downloads',
    });

    const chaveDeCredencial = (keys: typeof um) =>
      keys.filter((k) => k.dimension === 'credential').map(serializeRateLimitKey);

    expect(chaveDeCredencial(um)).toEqual(chaveDeCredencial(outro));
  });
});
