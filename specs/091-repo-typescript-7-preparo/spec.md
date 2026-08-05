# 091 — Preparo do monorepo para o TypeScript 7

- **Módulo/Pacote:** monorepo inteiro (raiz, `packages/*`, `apps/*`) + ambiente local do mantenedor
- **Gate relacionado:** nenhum

## Estado em 2026-08-05 — leia isto primeiro

**Fases 0, 1 e 2 executadas. Nenhuma decisão pendente.**

| Fase | Estado | Resultado |
|---|---|---|
| **0** — ambiente local | ✅ | O LSP passou a ser servido pelo **TS 7 nativo** (`tsc --lsp -stdio`). Provado no processo vivo: `tsc.exe --lsp` (115 MB) atendendo, sem nenhum `tsserver.js` ou `typescript-language-server` |
| **1** — os 8 pacotes CJS | ✅ | `node10` → `bundler`, `ignoreDeprecations` removido. 9 pontos de entrada com exports idênticos ao baseline; `TS5108` extinto; lint 25/25, build 25/25, test 39/39, `verify:api` `breaking=0` |
| **2** — critério de destravamento | ✅ | `scripts/check-typescript-7-readiness.mjs` responde **BLOQUEADO** hoje (`typescript-eslint` aceita `>=4.8.4 <6.1.0`) |

**Migrar o repo para o TS 7 continua bloqueado** — por um único motivo, `typescript-eslint`. Isso
é o resultado esperado da spec, não uma pendência dela.

### Como o plugin oficial foi desabilitado — corrigido na origem (2026-08-05)

Para o LSP nativo assumir, foi preciso desabilitar o `typescript-lsp` oficial: **o primeiro
servidor registrado para uma extensão vence e os outros nunca sobem** (documentação de
`lspServers`). Ele estava habilitado em **dois escopos**, e desabilitar só o de usuário não
bastou — o de **projeto** vencia.

A primeira correção foi escrever `"...": false` em `.claude/settings.local.json`, sob a crença
de que aquele arquivo era local. **Estava errado:** `git ls-files` o lista, ele tem commit
(`4b1d84d`) e não consta no `.gitignore`, apesar do nome. Pior: era um remendo — mascarava um
`true` que continuava no `.claude/settings.json` versionado.

**A correção definitiva foi na origem:** `.claude/settings.json` passou a declarar o plugin
oficial como `false`, e o override redundante saiu do `settings.local.json` (que voltou idêntico
ao commit `4b1d84d`, com as 239 permissões intactas). O repositório agora diz uma coisa só, no
lugar certo, e quem clonar recebe a configuração coerente com o plugin nativo.

> **Lição de método.** Escrever no arquivo "local" foi tratar o sintoma. A pergunta que faltou
> era "quem está ligando isso?", não "onde eu desligo?". Ver [[feedback_no_scope_inference]].

> **Correção de 2026-08-05, feita depois de uma pergunta do mantenedor.** A primeira redação
> desta spec afirmava que o TypeScript 7 "não expõe mais a API do compilador" e que o
> `typescript@7.0.2` global "não serve ao language server". **As duas afirmações estavam erradas**,
> e levavam a uma solução paliativa: instalar TypeScript 6 sob o `typescript-language-server`.
> O mantenedor perguntou "se a ideia é usar a versão 7 em tudo, por que regredir instalando a 6?"
> — a investigação que essa pergunta forçou está em §O que o TS 7 realmente é. Este bloco fica
> aqui de propósito: a spec errada quase virou trabalho errado.

## O que o TS 7 realmente é

O TypeScript 7 é o **[typescript-go](https://github.com/microsoft/typescript-go)** — o compilador
reescrito em Go. Não é o TS 6 com opções removidas; é outro executável, com outro modelo de
consumo. Medido em 2026-08-05 no `typescript@7.0.2` instalado:

- O pacote npm `typescript` virou um **wrapper fino**: `lib/` tem só `tsc.js`, `getExePath.js` e
  `version.cjs`; `exports["."]` aponta para `version.cjs`; o único `bin` declarado é `tsc`. O
  trabalho real está em `@typescript/typescript-<plataforma>` — 20 pacotes opcionais, um por
  alvo. No Windows: `@typescript/typescript-win32-x64/lib/tsc.exe`, **23,4 MB**.
- Esse executável **contém um servidor LSP nativo**. Dentro do binário: 6242 ocorrências de
  `lsp`, 82 métodos `textDocument/`, e os caminhos de origem
  `cmd/tsgo/lsp.go` e `internal/lsp/lsproto/baseproto.go`.
- Ele expõe dois modos de servidor, ambos com opções próprias:

  ```
  tsc --lsp -stdio | -pipe <nome> | -socket <addr>
  tsc --api        [-async] [-callbacks ...] [-cwd ...] [-pipe ...]
  ```

- **Provado, não deduzido:** um `initialize` JSON-RPC enviado por stdio ao `tsc.exe --lsp -stdio`
  recebeu resposta válida — `{"jsonrpc":"2.0","method":"window/logMessage",...}`.

**Conclusão que corrige a redação anterior:** `tsserver.js` não foi removido sem substituto. Ele
foi **substituído por `tsc --lsp`**. E a API do compilador não sumiu — **mudou de transporte**, de
`require('typescript')` para IPC (`--api`, MessagePack ou JSON-RPC). É exatamente por isso que
`exports["."]` só carrega `version.cjs`: o consumo agora é por processo, não por módulo.

## Problema

O monorepo está em `typescript ~6.0.3`. O TS 7.0.2 é o `latest` no npm. Migrar hoje ainda não é
possível, mas por **um** bloqueador, não pelos dois que a versão anterior desta spec listava:

**Bloqueador real e único:** `typescript-eslint` não suporta TS 7. A versão instalada (8.61.1) e
a mais recente publicada (8.66.0, reconfirmada em 2026-08-05) declaram ambas
`typescript: ">=4.8.4 <6.1.0"`. Não há tag `next` com suporte. Doze pacotes deste repo usam lint
type-aware (`projectService`), que depende do parser dele.

**O que deixou de ser bloqueador:** a API do compilador. Ela existe, por `--api`. Ferramentas que
migrarem para o transporte novo funcionam com o TS 7; o que trava é o ecossistema ainda não ter
migrado — não uma ausência de API.

**O que dói hoje, mesmo sem migrar.** Um `tsc` invocado à mão falhou com
`TS5108: Option 'moduleResolution=node10' has been removed` em 8 pacotes, e o achado foi
registrado como falso alarme antes de ser investigado até a causa (spec 090, T2.2). Duas causas:

- **`typescript@7.0.2` instalado globalmente**, à frente do binário do workspace no `PATH`.
- **8 pacotes usam `moduleResolution: node10`**, removido no TS 7, sustentado por
  `ignoreDeprecations: "6.0"` — que cobre a depreciação do TS 6, não a remoção do TS 7.

Nada disso quebra build ou CI, que usam o `tsc` do workspace. Mas custa diagnóstico errado, e já
custou uma vez.

**Sobre o language server — resolvido em 2026-08-05.** O `typescript-language-server` (wrapper Node
do `tsserver.js`) tem um fallback `bundled` que resolve `require('typescript')` a partir de si
mesmo e deriva `<dir>/tsserver.js`. Com o TS 7 global, esse caminho não existe — o fallback estava
quebrado. **O remédio não foi instalar TS 6:** o wrapper é desnecessário para o TS 7, que tem
servidor próprio. O cliente passou a apontar direto para `tsc --lsp -stdio`, e o wrapper saiu de
cena. Detalhe da execução e das travas em `tasks.md`, Fase 0.

## Requisitos (numerados, testáveis)

### Repositório

1. Os 8 pacotes que emitem CJS deixam de usar `moduleResolution: node10` e passam a
   `moduleResolution: bundler` com `module: CommonJS`, sem `ignoreDeprecations`. São `auth`,
   `catalog-client`, `catalog-matching`, `changelog`, `comments`, `content`, `content-editor` e
   `feedback`.
2. Cada um dos 8 continua emitindo **CommonJS real**, carregável por `require()` em Node — não
   ESM. Verificado carregando o `dist-cjs` emitido, não inspecionando o `tsconfig`.
3. Depois de 1, `tsc` do TS 7 **não** produz mais `TS5108` em nenhum dos 8 — o falso negativo que
   originou esta spec deixa de existir.
4. Nenhuma outra opção depreciada fica escondida atrás de `ignoreDeprecations` nos 8. Removê-lo
   revela tudo que ele calava, não só o `node10`.
5. A versão do TypeScript no repo permanece `~6.0.3`. **Não há bump a fazer:** `6.0.3` é o último
   6.x publicado (medido em 2026-08-05; o canal tem `6.0.2` e `6.0.3`, e nada além). Registrado
   para que a decisão não seja reaberta sem novo lançamento.
6. `rtk pnpm run lint`, `rtk pnpm run build` e `rtk pnpm run test` verdes no repo inteiro, com
   contagem registrada.
7. A suíte de testes deixa de falhar de forma intermitente sob paralelismo. A correção age na
   **causa medida** — esgotamento de recurso —, nunca desabilitando, pulando ou afrouxando teste.

### Ambiente local

8. O `typescript@7.0.2` global **permanece instalado e permanece na versão 7** (decisão do
   mantenedor, 2026-08-05). O `tsc` do `PATH` continua sendo o 7.
9. ✅ **Cumprido — resposta: SIM.** O cliente aceita servidor customizado por configuração
   declarativa: `lspServers` no `plugin.json` do plugin, com `command` e `args` livres. É como os
   12 plugins de LSP do marketplace oficial são definidos, e marketplace **local** é suportado.
   **Trava:** `lspServers` **não** é carregado a partir de uma entrada de marketplace com
   `strict: false` — precisa estar no `plugin.json`.
10. ✅ **Decidido pelo mantenedor: saída (a)** — apontar o cliente para `tsc --lsp -stdio` do
    TS 7. O wrapper `typescript-language-server` sai de cena; o pacote global permanece no 7.0.2 e
    nenhum TypeScript 6 é instalado fora do repo. As alternativas descartadas eram (b) dar TS 6 ao
    wrapper e (c) não fazer nada. **Executado e provado no processo vivo.**
10a. **Só um servidor por extensão sobe.** Quando mais de um plugin habilitado declara a mesma
    extensão em `extensionToLanguage`, o primeiro registrado vence e os demais nunca iniciam.
    Instalar o plugin novo **não basta** — o `typescript-lsp` oficial precisa ser desabilitado em
    **todos** os escopos onde estiver habilitado (usuário, projeto e local), porque a precedência
    é `local > project > user` e um escopo mais alto reativa o plugin silenciosamente.
10b. **Consequência aceita e a observar:** o repo compila com TS 6.0.3, mas passa a ser
    **analisado pelo TS 7** no editor. Divergência intencional. Se o LSP acusar erro que o `tsc`
    do repo não acusa — ou o contrário —, isso é achado a reportar, não ruído a ignorar.

### Critério de destravamento

11. Fica registrado o critério objetivo que autoriza migrar para o TS 7: **`typescript-eslint`
    publicar versão cujo range de `typescript` aceite `7.x`**. Este é o único item; a API do
    compilador saiu da lista por existir (`--api`).
12. A verificação é executável por comando, não por leitura de release notes.

## Critérios de aceite

- **Os 8 pacotes compilam sem `node10` e sem `ignoreDeprecations`**, e cada `dist-cjs` emitido
  carrega por `require()` devolvendo exatamente os exports de antes da mudança.
- **`tsc` do TS 7 sai `0`** em cada um dos 8 `tsconfig.cjs.json` — o mesmo comando que saía `1`
  com `TS5108`.
- **Nenhum backend consumidor quebra**: `mesas`, `downloads` e `glossario` carregam os pacotes
  pelo `dist-cjs`, que é o que vai para as imagens de produção (`AGENTS.md` §Dockerfile de
  produção, incidentes E016/E017).
- **`rtk pnpm run lint`, `run build` e `run test` verdes**, com número por app/pacote.
- **A suíte passa em rodadas repetidas**, não numa só — defeito intermitente não se prova com
  uma execução verde.
- **O `tsc` global continua respondendo `Version 7.0.2`** ao fim de tudo.
- **A pergunta do requisito 9 tem resposta medida**, e a decisão do requisito 10 está registrada
  como escolha do mantenedor — não como inferência do agente.
- **O critério de destravamento tem comando que responde sim/não** sobre o suporte do
  `typescript-eslint` ao TS 7.

## Fora de escopo

- **Migrar o repo para o TypeScript 7.** É o objetivo futuro que esta spec prepara. Enquanto o
  `typescript-eslint` não aceitar `7.x`, migrar quebraria o lint type-aware de 12 pacotes.
- **Rebaixar ou desinstalar o `typescript` global.** Decisão explícita do mantenedor: mantém-se
  o 7.
- **Trocar o cliente LSP ou o plugin `typescript-lsp`.** O requisito 9 apenas **mede** se a troca
  de servidor é possível; executá-la é decisão do requisito 10, e trocar o plugin em si está fora.
- **Subir a versão dentro do canal 6.x.** Não existe versão mais nova (requisito 5).
- **Substituir `typescript-eslint`, `vitest`, `vite` ou `astro`** por alternativas que já falem
  com o TS 7. Trocar ferramenta madura para antecipar migração é risco maior que o ganho.
- **Alterar o README do plugin `typescript-lsp`** — é do marketplace oficial do Claude Code, fora
  deste repositório.

## Riscos e impacto em outros módulos

- **Os 8 pacotes são compartilhados; 3 backends consomem o `dist-cjs` em produção.** O risco real
  não é falhar o build — é **emitir ESM achando que emitiu CJS**, que passa no `tsc` e quebra só
  quando o container sobe, o padrão dos incidentes E016/E017. Por isso o requisito 2 exige
  carregar o artefato, não ler a configuração.
- **`packages/auth` está entre os 8.** É sagrado (`AGENTS.md`). A mudança é de configuração de
  build, não de código, mas a emissão dele alimenta o login de toda a suíte. Aprovação nominal
  concedida em 2026-08-05.
- **`bundler` foi validado, não assumido.** Medido antes de escrever: `node16` **falha** — compila
  mas emite ESM e o `require()` quebra; `nodenext` não compila (`TS5110`); `bundler` +
  `module: CommonJS` compila, emite CJS, carrega em Node e **também passa no TS 7**.
- **Remover `ignoreDeprecations` expõe o que ele calava.** Em `packages/content` havia uma segunda
  deprecação escondida (`baseUrl`), invisível enquanto a flag existia. É um risco esperado da
  mudança, e o requisito 4 existe para que ele seja tratado, não descoberto depois.
- **Nada nesta spec toca VM, DNS, tunnel, banco ou deploy.**
