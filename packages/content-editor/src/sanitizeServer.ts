// Camada DOMPurify do markdown renderizado — SERVER-ONLY.
//
// POR QUE UM MÓDULO SEPARADO, e não uma condicional dentro de `sanitize.ts`:
// aquele arquivo é importado por `ContentEditor.tsx`, que `packages/ui` puxa e
// TODOS os frontends empacotam. Qualquer referência a módulo Node ali entra no
// grafo de browser, e o bundler resolve estaticamente — a condicional de runtime
// não impede isso. Três formas foram medidas na PR #317 (2026-09-13) e as três
// quebraram o build:
//
//   `import { JSDOM } from 'jsdom'`          -> Cannot find module '../data/patch.json'
//                                               (cadeia jsdom -> css-tree, require relativo)
//   `createRequire(import.meta.url)`         -> TS1343: import.meta não existe no build CJS
//   `createRequire` de 'node:module'         -> "createRequire" is not exported by
//                                               "__vite-browser-external"
//
// A separação por ENTRADA é a única saída: este arquivo NÃO é importado por
// `index.ts` nem por `sanitize.ts`, então nenhum frontend o alcança. Quem
// renderiza no servidor importa `@artificio/content-editor/sanitize-server`.
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import sanitizeHtml from 'sanitize-html';
import {
  RENDERED_MARKDOWN_SANITIZE_OPTIONS,
  sanitizeRenderedMarkdown,
} from './sanitize.js';

// Criado UMA vez: `new JSDOM()` por chamada custa caro num caminho que roda a
// cada render de comentário.
const purify = createDOMPurify(new JSDOM('').window as unknown as Window & typeof globalThis);

const TAGS_PERMITIDAS = RENDERED_MARKDOWN_SANITIZE_OPTIONS.allowedTags as string[];

/**
 * Sanitiza HTML renderizado com as TRÊS camadas, para uso no servidor.
 *
 * 1. `sanitize-html` aplica a política — quais tags passam, o `<input>` de task
 *    list, e o `transformTags.a` que decide destino de link. O DOMPurify não faz
 *    isso: ele não reescreve atributo por regra de negócio.
 * 2. `DOMPurify` fecha como camada final, exigida pelo `AGENTS.md` para HTML de
 *    usuário. Não é redundância: sanitiza pelo DOM real, então pega o que um
 *    sanitizador de string erra — mutation XSS, namespace de SVG/MathML, e
 *    entidade que só vira tag depois do parse do navegador.
 * 3. `sanitize-html` de novo, pela SERIALIZAÇÃO: o DOMPurify normaliza `<br />`
 *    para `<br>` e `disabled` para `disabled=""`, e essa forma foi escolhida para
 *    a hidratação — HTML do servidor diferente do cliente faz o React descartar o
 *    do servidor, que é o conteúdo que o crawler lê (objetivo da spec 102). A
 *    terceira passagem só re-serializa uma árvore que o DOMPurify já limpou.
 *
 * `ALLOWED_*` repete a allowlist da camada 1 de propósito: com o default do
 * DOMPurify a segunda passagem seria mais permissiva que a política.
 */
export function sanitizeRenderedMarkdownServer(html: string): string {
  const pelaPolitica = sanitizeRenderedMarkdown(html);
  const peloDom = purify.sanitize(pelaPolitica, {
    ALLOWED_TAGS: TAGS_PERMITIDAS,
    ALLOWED_ATTR: ['href', 'rel', 'target', 'class', 'type', 'disabled', 'checked'],
    // SEM `ALLOWED_URI_REGEXP`. Medido: o DOMPurify aplica esse regex a TODO
    // atributo que considera URI-like, não só ao `href` — com ele `target="_blank"`
    // e `type="checkbox"` reprovam e são REMOVIDOS. O default já aceita `https:` e
    // `mailto:`, e quem decide destino de link é o `transformTags.a` da camada 1.
  });
  return sanitizeHtml(peloDom, RENDERED_MARKDOWN_SANITIZE_OPTIONS);
}
