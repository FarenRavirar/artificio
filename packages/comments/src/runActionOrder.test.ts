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
  onWriteSucceededButReloadFailed: () => void = () => {},
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
  } catch {
    // Espelha o `catch` real: a rejeição aqui vem do RELOAD, não da escrita.
    // Todo chamador usa `void runAction(...)`, então deixá-la escapar viraria
    // unhandled rejection e a pessoa veria o comentário sumir sem explicação
    // (achado de review, PR #273). O aviso é separado de `onError` de propósito
    // — `onError` arma a mensagem de "tente de novo", que aqui duplicaria.
    onWriteSucceededButReloadFailed();
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
    // `finishAction` recarrega a thread e mexe em foco/anúncio. Se ele estourar,
    // a escrita JÁ aconteceu — tratar como falha faria o usuário reenviar e
    // duplicar o comentário.
    const chamadas: string[] = [];
    await runAction(
      async () => { chamadas.push('acao'); },
      async () => { throw new Error('reload falhou'); },
      () => chamadas.push('erro'),
      () => chamadas.push('settled'),
      () => chamadas.push('aviso-reload'),
    );
    // `erro` fora da lista é o ponto: ele arma "não foi possível concluir a
    // ação", que sobre uma escrita confirmada convida ao reenvio.
    expect(chamadas).toEqual(['acao', 'aviso-reload', 'settled']);
    expect(chamadas).not.toContain('erro');
  });

  it('falha do reload NÃO escapa como unhandled rejection', async () => {
    // Todo chamador em `CommentsConversation.tsx` dispara com `void
    // runAction(...)`: uma promessa rejeitada aqui não tem quem a pegue.
    await expect(runAction(
      async () => {},
      async () => { throw new Error('reload falhou'); },
      () => {},
      () => {},
    )).resolves.toBeUndefined();
  });
});
