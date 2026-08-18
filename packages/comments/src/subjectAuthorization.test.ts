import { describe, expect, it } from 'vitest';
import {
  accountsUserIdOrNull,
  authorize,
  canonicalPathSchema,
  normalizeGuardResult,
  refuse,
  subjectAuthorizationSchema,
  subjectRefSchema,
  type CommentSubjectAuthorization,
} from './subjectAuthorization.js';

const validAuthorization: CommentSubjectAuthorization = {
  exists: true,
  visible: true,
  commentable: true,
  ownerUserId: '11111111-1111-4111-8111-111111111111',
  canonicalPath: '/materiais/exemplo',
};

describe('canonicalPathSchema', () => {
  it('aceita caminho enraizado', () => {
    expect(canonicalPathSchema.safeParse('/materiais/exemplo').success).toBe(true);
    expect(canonicalPathSchema.safeParse('/').success).toBe(true);
    expect(canonicalPathSchema.safeParse('/blog/post?x=1#frag').success).toBe(true);
  });

  it('recusa URL inteira — a origem é resolvida no servidor (requisito 5b)', () => {
    expect(canonicalPathSchema.safeParse('https://evil.example/x').success).toBe(false);
    expect(canonicalPathSchema.safeParse('http://artificiorpg.com/x').success).toBe(false);
  });

  it('recusa protocol-relative, que sai do domínio passando por "/"', () => {
    expect(canonicalPathSchema.safeParse('//evil.example/x').success).toBe(false);
  });

  it('recusa esquema perigoso mesmo sem "//"', () => {
    expect(canonicalPathSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(canonicalPathSchema.safeParse('data:text/html,x').success).toBe(false);
  });

  it('recusa barra invertida e credencial embutida', () => {
    expect(canonicalPathSchema.safeParse('/x\\..\\y').success).toBe(false);
    expect(canonicalPathSchema.safeParse('/user@host/x').success).toBe(false);
  });

  it('recusa caractere de controle, que quebra header e log', () => {
    expect(canonicalPathSchema.safeParse('/x\nSet-Cookie: a=b').success).toBe(false);
    expect(canonicalPathSchema.safeParse('/x\r\ny').success).toBe(false);
  });

  it('recusa caminho relativo sem "/" inicial', () => {
    expect(canonicalPathSchema.safeParse('materiais/exemplo').success).toBe(false);
    expect(canonicalPathSchema.safeParse('../admin').success).toBe(false);
  });

  it('recusa acima do limite de 1024', () => {
    expect(canonicalPathSchema.safeParse(`/${'a'.repeat(1024)}`).success).toBe(false);
  });
});

describe('subjectRefSchema', () => {
  it('aceita subject_type namespaced', () => {
    expect(subjectRefSchema.safeParse({ subjectType: 'downloads.material', subjectId: 'abc' }).success).toBe(true);
    expect(subjectRefSchema.safeParse({ subjectType: 'blog.post', subjectId: '42' }).success).toBe(true);
    expect(subjectRefSchema.safeParse({ subjectType: 'a.b.c', subjectId: '1' }).success).toBe(true);
  });

  it('recusa subject_type SEM ponto — o banco também recusa', () => {
    // `migration_006:118` tem `CHECK (subject_type LIKE '%.%')` em
    // `community_comment_subject`. Enquanto este schema aceitava `material`, o
    // valor passava na validação e morria como erro de constraint, sem motivo
    // legível para o consumidor. Achado em 2026-08-07 (T2.6c), rodando o script
    // de medição contra PostgreSQL real.
    for (const subjectType of ['material', 'post', 'table']) {
      expect(subjectRefSchema.safeParse({ subjectType, subjectId: 'x' }).success).toBe(false);
    }
  });

  it('recusa subject_type com maiúscula, espaço ou ponto solto', () => {
    for (const subjectType of ['Material', 'blog post', '.post', 'blog.', 'blog..post']) {
      expect(subjectRefSchema.safeParse({ subjectType, subjectId: 'x' }).success).toBe(false);
    }
  });

  it('recusa acima dos limites de 64 e 255', () => {
    // Precisa casar o regex E passar de 64, senão o teste mede formato em vez de
    // limite: `'a.'.repeat(33)` termina em ponto e seria recusado pelo regex
    // mesmo com 10 caracteres. `a.` + 63 letras = 65 e é namespaced válido.
    expect(subjectRefSchema.safeParse({ subjectType: `a.${'b'.repeat(63)}`, subjectId: 'x' }).success).toBe(false);
    // Fronteira: exatamente 64 passa.
    expect(subjectRefSchema.safeParse({ subjectType: `a.${'b'.repeat(62)}`, subjectId: 'x' }).success).toBe(true);
    expect(subjectRefSchema.safeParse({ subjectType: 'a.b', subjectId: 'x'.repeat(256) }).success).toBe(false);
  });

  it('não aceita realm nem source_app — derivam da credencial', () => {
    const parsed = subjectRefSchema.parse({
      subjectType: 'downloads.material',
      subjectId: 'abc',
      realm: 'prod',
      sourceApp: 'downloads',
    } as never);

    expect(parsed).toEqual({ subjectType: 'downloads.material', subjectId: 'abc' });
    expect(parsed).not.toHaveProperty('realm');
    expect(parsed).not.toHaveProperty('sourceApp');
  });
});

describe('subjectAuthorizationSchema', () => {
  it('aceita afirmação completa', () => {
    expect(subjectAuthorizationSchema.safeParse(validAuthorization).success).toBe(true);
  });

  it('aceita ownerUserId nulo — post de blog e mesa órfã (requisitos 15a, 15b)', () => {
    expect(
      subjectAuthorizationSchema.safeParse({ ...validAuthorization, ownerUserId: null }).success,
    ).toBe(true);
  });

  it('recusa exists/visible/commentable falsos — o contrato só descreve autorização concedida', () => {
    for (const field of ['exists', 'visible', 'commentable'] as const) {
      expect(
        subjectAuthorizationSchema.safeParse({ ...validAuthorization, [field]: false }).success,
      ).toBe(false);
    }
  });

  it('recusa ownerUserId que não é UUID — forjar dono é o ataque do requisito 11', () => {
    expect(
      subjectAuthorizationSchema.safeParse({ ...validAuthorization, ownerUserId: 'admin' }).success,
    ).toBe(false);
  });
});

describe('normalizeGuardResult', () => {
  it('preserva autorização válida', () => {
    const result = normalizeGuardResult(authorize(validAuthorization));
    expect(result.authorized).toBe(true);
  });

  it('preserva o motivo de uma recusa conhecida', () => {
    for (const reason of ['not_found', 'not_visible', 'not_commentable'] as const) {
      const result = normalizeGuardResult(refuse(reason));
      expect(result).toEqual({ authorized: false, reason });
    }
  });

  it('converte autorização malformada em recusa — guard com bug não vira escrita autorizada', () => {
    const result = normalizeGuardResult({
      authorized: true,
      authorization: { ...validAuthorization, exists: false },
    });

    expect(result).toEqual({ authorized: false, reason: 'not_found' });
  });

  it('converte payload arbitrário em recusa', () => {
    for (const value of [null, undefined, 'ok', 42, [], {}, { authorized: 'true' }]) {
      expect(normalizeGuardResult(value).authorized).toBe(false);
    }
  });

  it('recusa autorização sem o campo authorization', () => {
    expect(normalizeGuardResult({ authorized: true }).authorized).toBe(false);
  });

  it('normaliza motivo desconhecido para not_found, sem propagar string arbitrária', () => {
    const result = normalizeGuardResult({ authorized: false, reason: 'porque sim' });
    expect(result).toEqual({ authorized: false, reason: 'not_found' });
  });
});

describe('accountsUserIdOrNull', () => {
  /**
   * O caso que motivou a função (produção, 2026-08-18): `mesas.users.google_id`
   * tem 53 UUIDs do `accounts` e 15 `google_sub` legados na MESMA coluna. O
   * valor legado atravessava o app e virava `400` opaco no `accounts.`,
   * bloqueando comentário em 14 mesas.
   */
  it('degrada google_sub legado para null em vez de deixar vazar', () => {
    expect(accountsUserIdOrNull('106884162561229573720')).toBeNull();
  });

  it('preserva o UUID do accounts, que é o formato do contrato', () => {
    const uuid = '4ed50549-3346-48d7-89cc-6a4afa9485c7';
    expect(accountsUserIdOrNull(uuid)).toBe(uuid);
  });

  it('mantém null como null — dono ausente é caso legítimo, não erro', () => {
    expect(accountsUserIdOrNull(null)).toBeNull();
  });

  it('degrada os ids de teste com prefixo, que existem em beta', () => {
    expect(accountsUserIdOrNull('fake_4da9e061-4590-42c4-adfb-3bb25399c341')).toBeNull();
  });

  it('o que sobrevive sempre passa no schema do contrato', () => {
    for (const v of ['106884162561229573720', '4ed50549-3346-48d7-89cc-6a4afa9485c7', null]) {
      const owner = accountsUserIdOrNull(v);
      const parsed = subjectAuthorizationSchema.safeParse({
        exists: true, visible: true, commentable: true,
        ownerUserId: owner, canonicalPath: '/mesas/x/',
      });
      expect(parsed.success, `ownerUserId=${String(owner)} recusado pelo schema`).toBe(true);
    }
  });
});
