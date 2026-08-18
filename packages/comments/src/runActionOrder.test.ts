import { describe, expect, it } from 'vitest';

/**
 * O painel só fecha e o rascunho só é limpo quando a escrita DEU CERTO.
 *
 * Defeito medido em beta (2026-08-18): `runAction` chamava `finishAction`
 * dentro do mesmo `try` da ação. Quando a escrita falhava — foi o caso com o
 * `403 insufficient_scope` do `downloads`, que não tinha o escopo
 * `comment.write` —, a exceção pulava para o `catch` e `finishAction` nunca
 * rodava. O painel de EDIÇÃO ficava aberto com o texto intacto, e o clique
 * seguinte chamava `client.edit` em vez de `client.create`: o usuário
 * atualizava um comentário achando que publicava um novo.
 *
 * Este teste espelha o fluxo de `CommentsConversation.tsx:runAction`. Testar
 * pelo componente exigiria montagem com DOM e disparo de submit — a suíte
 * daquele arquivo usa `renderToStaticMarkup`, que não interage. Aqui a ordem
 * das chamadas é o que importa, e é exatamente o que o defeito invertia.
 */
async function runAction(
  action: () => Promise<unknown>,
  finish: () => Promise<void>,
  onError: (e: unknown) => void,
  onSettled: () => void,
): Promise<void> {
  try {
    await action();
  } catch (error: unknown) {
    onError(error);
    onSettled();
    return;
  }
  try {
    await finish();
  } finally {
    onSettled();
  }
}

describe('runAction — fecho do painel', () => {
  it('escrita OK: fecha o painel e limpa o rascunho', async () => {
    const chamadas: string[] = [];
    await runAction(
      async () => { chamadas.push('acao'); },
      async () => { chamadas.push('finish'); },
      () => chamadas.push('erro'),
      () => chamadas.push('settled'),
    );
    expect(chamadas).toEqual(['acao', 'finish', 'settled']);
  });

  it('escrita FALHA: NÃO fecha o painel — o texto continua para nova tentativa', async () => {
    const chamadas: string[] = [];
    await runAction(
      async () => { throw new Error('403 insufficient_scope'); },
      async () => { chamadas.push('finish'); },
      () => chamadas.push('erro'),
      () => chamadas.push('settled'),
    );
    // `finish` fora da lista é o ponto: se ele rodasse, o rascunho sumiria e a
    // pessoa perderia o texto. Se rodasse ANTES do erro ser exibido, pior ainda.
    expect(chamadas).toEqual(['erro', 'settled']);
    expect(chamadas).not.toContain('finish');
  });

  it('erro DEPOIS da escrita não é confundido com falha da escrita', async () => {
    // `finishAction` mexe em foco e anúncio de acessibilidade. Se ele estourar,
    // a escrita já aconteceu — tratar como falha faria o usuário reenviar e
    // duplicar o comentário.
    const chamadas: string[] = [];
    await expect(runAction(
      async () => { chamadas.push('acao'); },
      async () => { throw new Error('foco perdido'); },
      () => chamadas.push('erro'),
      () => chamadas.push('settled'),
    )).rejects.toThrow('foco perdido');
    expect(chamadas).toEqual(['acao', 'settled']);
    expect(chamadas).not.toContain('erro');
  });
});
