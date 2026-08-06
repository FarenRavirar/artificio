import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Os tipos publicados por `@testing-library/jest-dom` descrevem um arquivo
// diferente do que o runtime carrega, e é isso que o cast abaixo concilia:
//
// - tipo: `types/matchers-standalone.d.ts` termina em `export = matchersStandalone`
//   (CJS). Com `esModuleInterop`, `import * as` sobre um `export =` produz um
//   namespace que inclui a chave sintética `default`, e um objeto com `default`
//   não satisfaz o `MatchersObject` de `expect.extend` — TS2345.
// - runtime: quem resolve é o Vite, que pega a condição `import` do pacote
//   (`dist/matchers.mjs`). Esse arquivo tem só exports nomeados, sem `default`.
//
// `import * as` é portanto a forma correta para o runtime — trocar por default
// import satisfaz o compilador e quebra os testes, já verificado.
//
// Descartar `default` por desestruturação reconstrói no tipo o mesmo conjunto
// de chaves que o `.mjs` de fato exporta, em vez de silenciar a divergência com
// um cast: se um dia a lib publicar tipos ESM corretos, `default` deixa de
// existir e o `omitido` vira erro de variável não usada — o aviso aparece
// sozinho, sem depender de alguém reler este comentário.
//
// Só este pacote bate no problema: os frontends usam `moduleResolution: bundler`
// (que modela o que o Vite faz) e `packages/ui`, também NodeNext, não usa jest-dom.
const { default: omitido, ...matchersEsm } = matchers;
void omitido;

expect.extend(matchersEsm);

afterEach(() => {
  cleanup();
});
