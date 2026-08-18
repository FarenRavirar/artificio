import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { csrfProtection } from '@artificio/auth';
import { resolveCsrfAllowedOrigins } from '../config/csrfOrigins.js';

/**
 * CSRF do glossário (achado CodeQL, PR #273).
 *
 * Este app lê a sessão do cookie `artificio_session`
 * (`middlewares/authMiddleware.ts:23`) e ficou sem `csrfProtection` enquanto
 * `accounts`, `links` e `site` já o montavam. Com cookie
 * `Domain=.artificiorpg.com`, um `<form method="POST">` de outro site dispara
 * escrita autenticada: CORS não bloqueia formulário HTML, e a escrita ocorre
 * antes de o navegador descartar a resposta. Medido: 30 das 31 rotas mutantes
 * passam por `authMiddleware`, inclusive `DELETE` de categoria por admin.
 *
 * O middleware é exercitado direto, sem servidor HTTP: `supertest` não é
 * dependência deste app, e o que está em prova é a CONFIGURAÇÃO daqui (a
 * allowlist), não a implementação do pacote — que tem suíte própria.
 */
// A política REAL do app, não uma cópia: uma lista fabricada aqui provaria
// apenas que o pacote funciona, e continuaria verde se o `index.ts` deixasse de
// montar o middleware ou perdesse os hosts públicos.
const ALLOWED = resolveCsrfAllowedOrigins();

interface Resultado {
  readonly status: number | null;
  readonly passou: boolean;
}

function chamar(options: {
  method: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): Resultado {
  let status: number | null = null;
  let passou = false;

  const req = {
    method: options.method,
    cookies: options.cookies ?? {},
    headers: options.headers ?? {},
  } as unknown as Request;

  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
    cookie() {
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    passou = true;
  };

  csrfProtection(ALLOWED)(req, res, next);
  return { status, passou };
}

const COM_SESSAO = { artificio_session: 'token-de-sessao' };

describe('glossário — proteção CSRF nas rotas mutantes', () => {
  it('recusa POST com cookie de sessão vindo de outra origem', () => {
    const resultado = chamar({
      method: 'POST',
      cookies: COM_SESSAO,
      headers: { origin: 'https://site-do-atacante.example' },
    });

    // Sem esta recusa, qualquer página da web fazia escrita autenticada em nome
    // de quem estivesse logado.
    expect(resultado.passou).toBe(false);
    expect(resultado.status).toBe(403);
  });

  it('recusa POST com cookie de sessão e SEM Origin (formulário HTML clássico)', () => {
    // O `<form>` cross-site é justamente o vetor que o CORS não cobre.
    const resultado = chamar({ method: 'POST', cookies: COM_SESSAO });

    expect(resultado.passou).toBe(false);
    expect(resultado.status).toBe(403);
  });

  it('recusa DELETE, não só POST', () => {
    const resultado = chamar({
      method: 'DELETE',
      cookies: COM_SESSAO,
      headers: { origin: 'https://site-do-atacante.example' },
    });

    expect(resultado.status).toBe(403);
  });

  it('aceita escrita do próprio front, servido same-origin pelo nginx', () => {
    // Regressão que importa tanto quanto o bloqueio: `ALLOWED_ORIGINS` está
    // VAZIA na VM (medido em beta e prod), e o cliente usa cookie sem Bearer e
    // sem header `X-XSRF-TOKEN`. Se a allowlist não trouxesse as origens
    // públicas por padrão, todo POST real do glossário viraria 403.
    // Os hosts são afirmados explicitamente, e não só iterados a partir de
    // `ALLOWED`: um `for` sobre lista vazia não itera, então o teste passaria
    // verde justamente no caso em que a política perdeu os hosts públicos e todo
    // POST do glossário viraria 403.
    expect(ALLOWED).toEqual(expect.arrayContaining([
      'https://glossario.artificiorpg.com',
      'https://glossariobeta.artificiorpg.com',
    ]));

    for (const origin of ALLOWED) {
      const resultado = chamar({
        method: 'POST',
        cookies: COM_SESSAO,
        headers: { origin },
      });

      expect(resultado.passou).toBe(true);
      expect(resultado.status).toBeNull();
    }
  });

  it('deixa passar cliente com Bearer, que não sofre CSRF', () => {
    // Token em header não é anexado pelo navegador automaticamente, então não
    // há o que forjar. Preserva integração server-to-server e scripts.
    const resultado = chamar({
      method: 'POST',
      cookies: COM_SESSAO,
      headers: {
        authorization: 'Bearer token-explicito',
        origin: 'https://site-do-atacante.example',
      },
    });

    expect(resultado.passou).toBe(true);
  });

  it('não interfere em leitura pública sem sessão', () => {
    expect(chamar({ method: 'GET' }).passou).toBe(true);
    expect(chamar({ method: 'POST' }).passou).toBe(true);
  });

  it('não libera localhost quando NODE_ENV=production', () => {
    // A abertura de `localhost` existe para o Vite em desenvolvimento. Se ela
    // vazasse para produção, qualquer página servida em `http://localhost` na
    // máquina da vítima passaria pela allowlist — e beta e prod rodam com
    // `NODE_ENV=production` (medido na VM).
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(resolveCsrfAllowedOrigins()).toEqual([
        'https://glossario.artificiorpg.com',
        'https://glossariobeta.artificiorpg.com',
      ]);
    } finally {
      process.env.NODE_ENV = anterior;
    }
  });

  it('libera o Vite fora de produção, para não quebrar o desenvolvimento local', () => {
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(resolveCsrfAllowedOrigins()).toContain('http://localhost:5173');
    } finally {
      process.env.NODE_ENV = anterior;
    }
  });
});
