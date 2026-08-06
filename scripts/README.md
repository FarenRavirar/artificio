# `scripts/` — tooling do monorepo

Scripts de CI, deploy, governança de API e checagens do repo. Não é código de
produto: nada aqui é publicado nem importado por `apps/*` ou `packages/*`.

## Por que isto é um pacote do workspace

Para que os scripts tenham **onde ser testados**. Antes `scripts/` era só uma
pasta da raiz, fora do `pnpm-workspace.yaml`, e o `turbo run test` — que roda por
pacote — não tinha como alcançá-la. Consequência: bug de lógica em script de
decisão passava verde no CI. Foi o que aconteceu com `acceptsTypeScript7` em
`check-typescript-7-readiness.mjs`, que respondia "TypeScript 7 liberado" para
`>=8.0.0 <9.0.0` (achado de review, PR #243).

Com o pacote, `pnpm run test` na raiz cobre `scripts/` junto com o resto.

## Duas armadilhas, ambas já pagas

**1. Não adicionar `"type": "module"` ao `package.json`.** Os scripts `.ts` de
`scripts/api/` importam `js-yaml`, que é CommonJS. Sob `"type": "module"` o
`import yaml from 'js-yaml'` para de resolver e o `verify:api` quebra com:

```
SyntaxError: The requested module 'js-yaml' does not provide an export named 'default'
```

A raiz não declara `type` (portanto `commonjs`), e é assim que esses scripts
sempre rodaram. Os arquivos ESM daqui usam extensão `.mjs`, que não depende
desse campo.

**2. Dependência externa usada por script precisa estar declarada aqui.** Antes,
`scripts/` resolvia tudo pelo `node_modules` da raiz. Agora resolve pelo próprio
pacote primeiro. Ao adicionar um `import` de pacote externo a qualquer script,
declare-o em `devDependencies` **com a mesma versão da raiz**, senão o script
quebra em runtime — e o `verify:api` e os git hooks rodam fora do `turbo`, então
nem sempre o CI avisa primeiro.

## `check-test-typecheck-coverage.mjs`

Gate que responde uma pergunta por pacote do workspace: **existe algum `tsc` que
abra os arquivos de teste deste pacote?** Se não, falha e diz qual desenho
adotar.

Existe porque `tsconfig.build.json` exclui teste de propósito (o `dist` vai para
as imagens de produção), e a consequência — erro de tipo em teste passando verde
pelo CI — já foi corrigida à mão duas vezes e voltou nas duas: spec 088 nos
frontends de mesas e downloads, PR #243 em 13 pacotes mais `apps/site`,
`packages/catalog-ui` e `apps/glossario/frontend`. Corrigir uma terceira vez sem
gate só marcaria a data da quarta.

Roda no CI (`pnpm smoke:test-typecheck-coverage`) antes do passo de `typecheck`,
que é justamente o que ele protege. A lista de pacotes vem do `pnpm list -r`, não
de varredura de diretório, para que pacote novo entre sozinho.

Exceção declarada vai na `ALLOWLIST` do próprio script, **com motivo** — hoje só
`@artificio/scripts`, que é JavaScript puro sem tsconfig.

## Escrevendo teste

Arquivo `*.test.mjs` ao lado do script. O script precisa **exportar** a função
testada e proteger a execução como comando:

```js
export function decideAlgo(entrada) { /* ... */ }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

Sem esse guard o `import` do teste executa o script — e um script que consulta
rede vira teste que falha por motivo errado.

## Sem lint

`scripts/` nunca teve ESLint: não existe `eslint.config.js` na raiz do repo, e
este pacote não declara tarefa `lint`. Estado herdado, não decisão desta mudança.
