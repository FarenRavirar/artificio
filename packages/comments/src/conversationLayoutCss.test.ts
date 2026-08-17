// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Os quatro blocos em grid da conversa (`__composer`, `__comment`, `__form`,
 * `__confirm`) compartilham `justify-items: start` para que botão não vire
 * barra de ponta a ponta da tela — o defeito que a auditoria de 2026-08-17
 * mediu em 1841px de largura no "Publicar comentário".
 *
 * Só que `start` dá a TODO filho direto largura intrínseca (`max-content`), e
 * isso é certo para controle e errado para conteúdo. Cada bloco que contém
 * conteúdo precisa do contrapeso `justify-self: stretch`; o `__comment` ficou
 * sem ele por uma rodada (achado de review, PR #270), e seus dois filhos são
 * justamente conteúdo: o `<article>` do comentário e o `<ol>` das respostas.
 *
 * A consequência não é cosmética. Em `max-content` o texto longo **para de
 * quebrar linha** e transborda o cartão, e a borda do fio aninhado deixa de
 * acompanhar a coluna. Nenhum teste existente pega isso: não é erro de
 * sintaxe, não é erro de tipo, e o CSS continua válido.
 */

// Caminho a partir do cwd do pacote, e não de `import.meta.url`: sob o
// ambiente jsdom a URL do módulo não tem esquema `file:` e `fileURLToPath`
// recusa. Mesma razão registrada em `moderationFallbackCss.test.ts`.
// Comentários fora: um bloco `/* ... */` imediatamente antes de uma regra cai
// dentro do grupo de seletores do regex abaixo e vira "seletor" inválido, que
// o jsdom rejeita com erro em vez de simplesmente não casar nada.
const CSS = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Blocos que declaram `justify-items: start` e contêm conteúdo de largura
 * variável — cada um precisa devolver `stretch` aos filhos que não são
 * controle.
 */
const BLOCOS_COM_CONTEUDO = [
  'artificio-comments__composer',
  'artificio-comments__comment',
  'artificio-comments__form',
  // O `__confirm` abre com um `<p>` de 62 caracteres
  // (`CommentsConversation.tsx:361`) que em `max-content` não quebra e força a
  // largura do painel — dentro de um cartão aninhado a 4 níveis, transborda.
  'artificio-comments__confirm',
] as const;

/** Extrai os seletores de uma declaração, direto do CSS publicado. */
function seletoresQueDeclaram(propriedade: string, valor: string): string[] {
  const regex = new RegExp(`([^{}]+)\\{[^{}]*${propriedade}:\\s*${valor}\\s*[;}]`, 'g');
  return [...CSS.matchAll(regex)]
    .flatMap((m) => m[1].split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('/*') && !s.startsWith('@'));
}

/** Espelha `CommentsConversation.tsx:458-568`: o cartão e o fio aninhado. */
function montarCartao(): void {
  document.body.innerHTML = `
    <section class="artificio-comments">
      <ol class="artificio-comments__thread">
        <li class="artificio-comments__comment">
          <article>
            <header class="artificio-comments__author"></header>
            <div class="artificio-comments__body"><p>texto longo do comentário</p></div>
            <div class="artificio-comments__actions"><button>Responder</button></div>
          </article>
          <ol class="artificio-comments__thread">
            <li class="artificio-comments__comment"><article></article></li>
          </ol>
        </li>
      </ol>
    </section>`;
}

describe('layout em grid da conversa', () => {
  it('os blocos que encolhem filhos por padrão são os quatro conhecidos', () => {
    const seletores = seletoresQueDeclaram('justify-items', 'start');
    expect(seletores).toEqual(
      expect.arrayContaining([
        '.artificio-comments__composer',
        '.artificio-comments__comment',
        '.artificio-comments__form',
        '.artificio-comments__confirm',
      ]),
    );
  });

  it('todo bloco com conteúdo devolve stretch aos filhos diretos', () => {
    const seletores = seletoresQueDeclaram('justify-self', 'stretch');

    for (const bloco of BLOCOS_COM_CONTEUDO) {
      const cobre = seletores.some((s) => s === `.${bloco} > *`);
      expect(
        cobre,
        `.${bloco} encolhe os filhos com justify-items:start e nunca devolve stretch — `
          + `texto longo deixa de quebrar e transborda. Seletores achados: ${seletores.join(' | ')}`,
      ).toBe(true);
    }
  });

  it('o article e o fio de respostas do cartão são alcançados pela regra de stretch', () => {
    montarCartao();

    const cartao = document.querySelector('.artificio-comments__comment');
    const filhosDiretos = [...(cartao?.children ?? [])];
    // Se a marcação mudar, este é o lugar de descobrir.
    expect(filhosDiretos.map((e) => e.tagName)).toEqual(['ARTICLE', 'OL']);

    const alcancados = seletoresQueDeclaram('justify-self', 'stretch')
      .flatMap((s) => [...document.querySelectorAll(s)]);

    for (const filho of filhosDiretos) {
      expect(
        alcancados.includes(filho),
        `<${filho.tagName.toLowerCase()}> é filho direto do cartão e nenhum seletor de stretch o alcança`,
      ).toBe(true);
    }
  });

  it('os controles do compositor continuam encolhendo', () => {
    // O `justify-self: start` explícito é o que impede a volta da barra larga.
    const seletores = seletoresQueDeclaram('justify-self', 'start');
    expect(seletores).toEqual(
      expect.arrayContaining([
        '.artificio-comments__composer > button',
        '.artificio-comments__form-actions',
        '.artificio-comments__confirm > button',
      ]),
    );
  });
});
