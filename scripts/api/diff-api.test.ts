import { describe, expect, it } from 'vitest';

import { extractLocation } from './diff-api.js';

/**
 * Cobertura de `extractLocation`, a função que preenche a coluna `Path` do
 * relatório de breaking changes. Ela já regrediu duas vezes:
 *
 *  - `BL-API-DIFF-PATH-REMOVE-BLANK` (spec 062 → 2026-08-13): `path.remove`
 *    saía com `Path` vazio, escondendo justamente a remoção de rota inteira.
 *  - achado de review da PR #260: a detecção de método era textual, então um
 *    caminho com segmento `get`/`post` seria truncado ali.
 *
 * `diff-api.ts` roda por `tsx`, que faz strip de tipos sem checá-los, então erro
 * de tipo aqui não aparece no `verify:api` (BL-SCRIPTS-TYPECHECK) — este arquivo
 * é a barreira contra a terceira regressão.
 *
 * Os dois formatos de `location` abaixo foram medidos com openapi-diff 0.24.1
 * contra os specs deste repo, não inferidos da documentação.
 */

const paraPath = (location: string, code = 'path.remove') => ({
  type: 'breaking' as const,
  action: 'remove',
  code,
  entity: 'path',
  sourceSpecEntityDetails: [{ location }],
});

const paraMethod = (location: string, code = 'method.remove') => ({
  type: 'breaking' as const,
  action: 'remove',
  code,
  entity: 'method',
  sourceSpecEntityDetails: [{ location }],
});

describe('extractLocation', () => {
  it('preenche o path em remoção de rota inteira, que não traz método no location', () => {
    expect(extractLocation(paraPath('paths./api/social/{id}/comments'))).toEqual({
      path: '/api/social/:id/comments',
      method: '',
    });
  });

  it('lê o destino em adição de rota, onde a origem é que não existe', () => {
    expect(extractLocation({
      type: 'non-breaking',
      action: 'add',
      code: 'path.add',
      entity: 'path',
      destinationSpecEntityDetails: [{ location: 'paths./api/social/terms/{id}/comments' }],
    })).toEqual({ path: '/api/social/terms/:id/comments', method: '' });
  });

  it('extrai método e corta o sufixo em mudança de nível operação', () => {
    expect(extractLocation(paraMethod('paths./api/admin/feedback/{id}.delete'))).toEqual({
      path: '/api/admin/feedback/:id',
      method: 'DELETE',
    });
    expect(extractLocation(paraMethod('paths./api/v1/tables/{slug}.get.operationId'))).toEqual({
      path: '/api/v1/tables/:slug',
      method: 'GET',
    });
  });

  // Achado de review da PR #260: decidir pelo texto do location trunca um
  // caminho legítimo e ainda inventa um método que a mudança não tem. O sinal
  // certo é o `entity`/`code`, que o openapi-diff já manda.
  it('preserva segmento de caminho parecido com verbo HTTP em mudança de path', () => {
    // Estes dois casos são os que a detecção textual truncava: o verbo aparece
    // após um PONTO, que é o separador que o regex procura. Um segmento com
    // verbo após `/` (`/api/webhooks/post/{id}`) nunca chegou a quebrar, e um
    // teste só com essa forma passa mesmo com a correção desligada — o caso
    // abaixo é o que de fato discrimina.
    expect(extractLocation(paraPath('paths./api/files/report.get/{id}'))).toEqual({
      path: '/api/files/report.get/:id',
      method: '',
    });
    expect(extractLocation(paraPath('paths./api/logs/audit.post'))).toEqual({
      path: '/api/logs/audit.post',
      method: '',
    });
    // Sem ponto antes do verbo: já funcionava, fica como guarda de não-regressão.
    expect(extractLocation(paraPath('paths./api/webhooks/post/{id}'))).toEqual({
      path: '/api/webhooks/post/:id',
      method: '',
    });
  });

  it('usa o code quando o entity não vem preenchido', () => {
    expect(extractLocation({
      type: 'breaking',
      action: 'remove',
      code: 'path.remove',
      entity: '',
      sourceSpecEntityDetails: [{ location: 'paths./api/logs/audit.post' }],
    })).toEqual({ path: '/api/logs/audit.post', method: '' });
  });

  // O ponto dentro do caminho é literal; só o sufixo após o caminho usa `.`
  // como separador. Uma versão anterior trocava todo `.` por `/` e devolvia
  // `/api/files/:name/json` — pior que vazio, porque parece correto.
  it('mantém ponto literal no caminho', () => {
    expect(extractLocation(paraMethod('paths./api/files/{name}.json.get'))).toEqual({
      path: '/api/files/:name.json',
      method: 'GET',
    });
  });

  it('cai para a origem quando o destino vem como array vazio', () => {
    expect(extractLocation({
      type: 'breaking',
      action: 'remove',
      code: 'path.remove',
      entity: 'path',
      destinationSpecEntityDetails: [],
      sourceSpecEntityDetails: [{ location: 'paths./api/systems/catalog-health' }],
    })).toEqual({ path: '/api/systems/catalog-health', method: '' });
  });

  it('devolve vazio sem location ou sem o prefixo esperado', () => {
    expect(extractLocation({ type: 'breaking', action: 'remove', code: 'path.remove', entity: 'path' }))
      .toEqual({ path: '', method: '' });
    expect(extractLocation(paraPath('info.title'))).toEqual({ path: '', method: '' });
  });
});
