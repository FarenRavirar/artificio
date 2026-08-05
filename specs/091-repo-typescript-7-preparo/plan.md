# Plano — 091

> **Este plano foi reescrito em 2026-08-05.** A primeira versão propunha instalar TypeScript 6
> sob o `typescript-language-server` para consertar o fallback `bundled`. A proposta partia de
> duas premissas erradas — que o TS 7 não tem language server e que não expõe API de compilador.
> Ambas caíram na medição (ver `spec.md` §O que o TS 7 realmente é). O plano corrigido **mede
> antes de escolher**, em vez de propor um paliativo como se fosse a única saída.

## Arquitetura da solução

Três frentes independentes. A ordem importa numa delas: a Fase 0 **investiga antes de agir**.

### 1. Repositório — trocar `node10` por `bundler` nos 8 pacotes

Estado atual de cada `tsconfig.cjs.json`:

```jsonc
"module": "CommonJS",
"moduleResolution": "node10",
"ignoreDeprecations": "6.0"
```

Estado alvo:

```jsonc
"module": "CommonJS",
"moduleResolution": "bundler"
```

`ignoreDeprecations` sai junto: existia **só** para calar o aviso do `node10`. Mantê-lo sem o
`node10` seria lixo de configuração que o próximo agente teria de decifrar.

**Matriz medida em `packages/comments`, contra o TS 6.0.3 do workspace:**

| `moduleResolution` | compila | emite | `require()` | TS 7 |
|---|---|---|---|---|
| `node10` (atual) | sim | CJS | sim | **não** (`TS5108`) |
| `node16` | sim | **ESM** | **quebra** | — |
| `nodenext` | **não** (`TS5110`) | — | — | — |
| **`bundler`** | **sim** | **CJS** | **sim** | **sim** |

`node16` é a armadilha: passa no `tsc` e produz `export {...}` no `dist-cjs`. Verde no build,
quebra quando o container sobe — a classe exata dos incidentes E016/E017. É por isso que a
validação exige **carregar** o artefato.

`bundler` funciona porque estes pacotes declaram `exports` explícito com `import`/`require`, e
nenhum depende do algoritmo de resolução legado do Node 10.

**Efeito colateral esperado:** remover `ignoreDeprecations` revela outras deprecações que ele
calava. Já ocorreu em `packages/content` (`baseUrl`). Tratar, não recolocar a flag.

### 2. Suíte de testes — limitar concorrência, não mexer em teste

Sintoma: `rtk pnpm run test` falha de forma intermitente, alternando o pacote afetado
(`content-editor` numa rodada, `downloads-frontend` noutra), sem erro de asserção.

**Causa medida durante a suíte:** 56 processos `node` simultâneos, memória livre caindo de
9,7 GB para 6,3 GB. A máquina tem 12 CPUs, 6 pacotes usam `environment: jsdom`, e
`turbo run test` rodava **sem limite de concorrência** — cada vitest abre seus próprios workers.

Correção: `turbo run test --concurrency=4` no `package.json` da raiz. Uma linha. **Nenhum teste
desabilitado, pulado ou afrouxado** — isso mascararia o defeito em vez de corrigi-lo
(`AGENTS.md` §Nunca mascarar erro).

Validação de defeito intermitente exige **repetição**: rodadas seguidas verdes, não uma.

### 3. Ambiente local — saída (a) executada: o LSP passou a ser o do TS 7

O `typescript-language-server` é um wrapper Node do `tsserver.js`. Sua cadeia de resolução é
`userSetting → workspace → fallbackSetting → bundled` (`cli.mjs:24008-24035`), e o `bundled`
resolve `require('typescript')` a partir de si mesmo, derivando `<dir>/tsserver.js`. Com o TS 7
global esse arquivo não existe — o fallback estava quebrado.

O TS 7 tem servidor LSP próprio, então havia três saídas. O mantenedor escolheu **(a)** depois da
medição de T0.3, e ela foi executada:

| Saída | Custo | Decisão |
|---|---|---|
| **(a) Apontar o cliente para `tsc --lsp -stdio`** | "7 em tudo", dispensa o wrapper; LSP novo, menos exercitado | ✅ **escolhida e executada** |
| (b) Dar TypeScript 6 ao wrapper | paliativo, global segue no 7 | descartada |
| (c) Não fazer nada | neste repo o LSP já funcionava pelo workspace | descartada |

**Como ficou.** Marketplace local em `~/.claude/local-marketplace/`, com um plugin
`typescript-lsp-native` cujo `plugin.json` declara:

```json
"lspServers": {
  "typescript": {
    "command": "C:\\Users\\paulo\\AppData\\Roaming\\npm\\node_modules\\typescript\\node_modules\\@typescript\\typescript-win32-x64\\lib\\tsc.exe",
    "args": ["--lsp", "-stdio"],
    "extensionToLanguage": { ".ts": "typescript", "...": "..." },
    "transport": "stdio",
    "restartOnCrash": true
  }
}
```

**`command` era `tsc` e isso era um defeito — corrigido em 2026-08-05 (plugin v1.1.0).** A
primeira versão desta spec afirmava que "o wrapper npm no `PATH` delega `--lsp` ao binário
nativo, então não é preciso caminho absoluto". Funcionava **por acidente**: só porque o TS 7
está instalado globalmente e à frente no `PATH`. Medição que derruba a afirmação — num `PATH`
sem o npm global, com o repositório no caminho:

```
command -v tsc   →  /c/projetos/artificio/node_modules/.bin/tsc
tsc --version    →  Version 6.0.3
tsc --lsp        →  error TS5023: Unknown compiler option '--lsp'
```

O `tsc` do workspace é o **TS 6**, que não conhece `--lsp`. O cliente não recebe erro
interpretável: recebe um servidor que não sobe — sem hover, sem diagnóstico, sem aviso. É a
mesma falha silenciosa descrita nas issues do ecossistema (ver §Referências externas). O
caminho absoluto do `tsc.exe` nativo elimina a dependência de ordem de `PATH`.

**Trade-off assumido:** o caminho absoluto quebra se o `npm prefix -g` mudar (reinstalação do
Node noutro prefixo). A alternativa — `command: "tsc"` — quebra se o TS 7 sair da frente do
`PATH`, que é a falha silenciosa acima. Preferido o modo que falha **alto** (executável não
encontrado) ao que falha **baixo** (servidor mudo). A documentação de `lspServers` diz que
`command` "must be in PATH" e **não documenta** caminho absoluto; foi validado por execução, não
por leitura — ver prova abaixo.

**Prova, executada com a config nova (`claude -p` + ferramenta LSP, duas execuções):**

```
LSP hover  packages/comments/src/subjectAuthorization.ts:56  →  const canonicalPathSchema: z.ZodString
serverInfo: {"name":"typescript-go","version":"7.0.2"}
```

Nenhum `typescript-language-server`, nenhum `tsserver.js`, nenhum wrapper `cmd.exe`/`node` na
cadeia — o cliente executa o `.exe` diretamente.

**Três travas descobertas na execução — cada uma custou uma tentativa falha:**

1. **`strict: false` não carrega `lspServers`.** A documentação de marketplaces (§Strict mode)
   lista o que esse modo cobre — skills, agents, hooks, MCP servers e output styles — e
   `lspServers` **não está na lista**. Com `strict: false` e sem `plugin.json`, a definição é
   silenciosamente ignorada: o plugin instala, aparece `enabled`, e não registra servidor nenhum.
   O certo é `strict` no default (`true`) com `lspServers` dentro do `plugin.json`.
2. **Só um servidor por extensão sobe**, e o oficial precisa ser desabilitado em **todos** os
   escopos. Ele estava habilitado em `user` **e** em `project` (`.claude/settings.json`); desabilitar
   só o de usuário não bastou, porque `local > project > user`. Um escopo mais alto reativa o
   plugin sem aviso.
3. **A configuração só é lida no start do cliente.** `/reload-plugins` recarrega, mas não derruba
   language server já vivo — verificar o efeito exige reiniciar a sessão e olhar a linha de
   comando do processo.

**Precedência confirmada empiricamente**, porque a documentação se contradiz: ela declara
`local > project > user`, mas o texto seguinte afirma que um plugin habilitado em `project` não
pode ser desabilitado por `local`/`user`. Medido: depois de escrever em `settings.local.json`,
`claude plugin list` passou a mostrar **ambas** as entradas do oficial como `✘ disabled`. A ordem
declarada é a correta; a ressalva está errada.

**Onde a desabilitação ficou — corrigido na origem.** A primeira tentativa escreveu
`"typescript-lsp@claude-plugins-official": false` em `.claude/settings.local.json`, supondo que
fosse local. **É versionado** (`git ls-files` o lista, commit `4b1d84d`, ausente do
`.gitignore`), e pior: era remendo — mascarava um `true` que continuava no `.claude/settings.json`
versionado, deixando o repositório afirmando duas coisas contraditórias.

Corrigido: o `true` do `.claude/settings.json` virou `false`, e o override saiu do
`settings.local.json`, que voltou **idêntico ao commit `4b1d84d`** (239 permissões preservadas,
`git diff --quiet` limpo). Diff final no repositório: **uma linha em um arquivo**.

O pacote global não é alterado (requisito 8).

## Referências externas consultadas (2026-08-05)

Quatro fontes, lidas depois da execução, a pedido do mantenedor. Nenhuma mudou a solução; duas
expuseram defeito real, e uma delas foi refutada por medição.

| Fonte | Estado | O que rendeu |
|---|---|---|
| [claude-plugins-official #4492](https://github.com/anthropics/claude-plugins-official/issues/4492) | aberta | Pede exatamente `tsc --lsp --stdio` no plugin oficial. Confirma que o plugin local é a solução correta **e a única disponível** |
| [claude-plugins-official #225](https://github.com/anthropics/claude-plugins-official/pull/225) | fechada por bot | PR que implementava isso, recusada: *"this repo only accepts contributions from Anthropic team members"*. **Não adianta esperar upstream** |
| [oh-my-claudecode #3403](https://github.com/Yeachan-Heo/oh-my-claudecode/issues/3403) | fechada | Nomeia o requisito que faltava: resolver o binário por caminho do projeto, **não por `PATH`**. Origem do defeito corrigido acima |
| [oraios/serena #1402](https://github.com/oraios/serena/issues/1402) | aberta | Mesmo problema noutro cliente; confirma que é do ecossistema, não desta configuração |

**Achado adicional, medido: URI no formato Windows mata o servidor.** Um `didOpen` com
`file://C:\projetos\...` (barra invertida) derruba o `tsc.exe` com `rc=2` — sem mensagem de erro,
sem panic no log. O pipe morre e o cliente vê "LSP mudo".

*Diagnóstico:* quando o LSP emudecer, checar **se o processo `tsc.exe --lsp` ainda existe** antes
de suspeitar de configuração. Servidor ausente = crash, não config errada.

O cliente do Claude Code **não tem esse defeito**: emite `/c:/projetos/...` (barra normal), e o
servidor da sessão sobreviveu a toda a bateria de testes. Também foi **refutada** por medição a
afirmação (de um guia de migração) de que o compilador Go não reconcilia variantes de URI:
`c:` vs `C:` e percent-encoding vs literal resolvem tipo normalmente — só a barra invertida mata.
Nenhum shim, proxy ou wrapper `cmd /c` é necessário aqui.

### 4. Critério de destravamento executável

Script curto que responde sim/não, para o item não virar folclore:

- Consulta o `latest` de `@typescript-eslint/typescript-estree` e lê o range
  `peerDependencies.typescript`.
- Imprime **DESTRAVADO** quando o range aceitar `7.x`; **BLOQUEADO** caso contrário, com o range
  atual visível.

Um único critério — a API do compilador saiu da lista por existir via `--api`. Manter aquela
condição faria o script responder BLOQUEADO para sempre, porque a API **nunca** volta ao formato
de módulo importável. Roda sob demanda, **fora do CI**: o CI não deve falhar porque o ecossistema
não mudou, e o script sai `0` em qualquer resultado.

**Implementado e rodando** (`scripts/check-typescript-7-readiness.mjs`). Saída de 2026-08-05:

```
  typescript (latest no npm) : 7.0.2
  @typescript-eslint/typescript-estree : 8.66.0
  range de typescript aceito : >=4.8.4 <6.1.0

BLOQUEADO — typescript-eslint ainda não aceita 7.x.
```

A lógica de detecção foi testada **nos dois sentidos** — um verificador que só sabe dizer "ainda
não" não serve para dizer "agora sim". Sete casos, todos corretos, incluindo `>=4.8.4 <7.0.0`, que
parece aceitar 7 mas cujo teto o exclui.

## Arquivos afetados (por módulo/pacote)

| Caminho | Natureza |
|---|---|
| `packages/{auth,catalog-client,catalog-matching,changelog,comments,content,content-editor,feedback}/tsconfig.cjs.json` | `node10` → `bundler`, remove `ignoreDeprecations`. **8 arquivos.** `packages/auth` é sagrado — aprovação concedida em 2026-08-05 |
| `packages/content/tsconfig.cjs.json` | além do acima, remove `baseUrl` e `paths` — deprecação que o `ignoreDeprecations` escondia, e `paths` que o `src` não usa |
| `package.json` (raiz) | `turbo run test` → `turbo run test --concurrency=4` |
| `scripts/check-typescript-7-readiness.mjs` | novo — verificação executável do destravamento |
| `specs/091-repo-typescript-7-preparo/*` | esta spec |
| `~/.claude/local-marketplace/**` | **novo** — marketplace local com o plugin `typescript-lsp-native` (`plugin.json` com `lspServers`, `command: "tsc"`, `args: ["--lsp","-stdio"]`, 8 extensões) + `README.md`. Fora do repositório, não versionado |
| `~/.claude/settings.json` | `typescript-lsp@claude-plugins-official` → `false`. Fora do repositório |
| `.claude/settings.local.json` | `typescript-lsp@claude-plugins-official` → `false`. **Versionado** — ver a pendência na §3 e em `spec.md` §Estado |

**Não tocar:** `package.json` de apps e a versão `~6.0.3` (requisito 5). Nenhum `tsconfig.json` de
type-check; só os `.cjs.json` de emissão. Nenhum arquivo de teste.

## Contratos/interfaces tocados (auth/accounts? subdomínio/DNS? schema?)

- **`packages/auth`** entra na lista dos 8. Não muda código nem contrato — muda como o `dist-cjs`
  é resolvido na emissão. Sendo o pacote que sustenta o SSO, segue a trava de `AGENTS.md`:
  aprovação (concedida) + smoke dos consumidores.
- **Nenhum contrato HTTP muda.** `verify:api` roda por obrigação (mudança em `packages/**`), com
  expectativa de `breaking=0`.
- **Sem schema, migration, DNS, tunnel ou deploy.**

## Impacto em consumidores (quem mais usa o que vou mexer)

Os 8 pacotes são consumidos pelos backends, e o `dist-cjs` vai **inteiro** para as imagens de
produção. Levantado por busca:

| Pacote | Apps |
|---|---|
| `auth` | accounts, downloads, glossario, links, mesas, site |
| `catalog-client` | downloads, glossario, mesas |
| `catalog-matching` | downloads |
| `changelog` | downloads, glossario, mesas |
| `comments` | nenhum ainda |
| `content` | downloads, glossario, mesas, site |
| `content-editor` | downloads, mesas |
| `feedback` | glossario, mesas, site |

Três `Dockerfile` de produção copiam `dist-cjs`: `downloads/backend`, `mesas/backend`,
`glossario/backend`. **Só `downloads/backend` declara `"type": "commonjs"`, mas os três dependem
do `dist-cjs`** — o `main` dos pacotes aponta para lá, então backend ESM também cai nele pela
resolução. Confirmado por `require.resolve` a partir de cada backend.

## Rollback

- **Repo:** reverter os 8 `tsconfig.cjs.json` e a linha do `package.json`. Sem migration, sem
  dado, sem estado — `git revert` do commit resolve.
- **Ambiente local:** depende da saída escolhida na Fase 0. Em (a), restaurar a configuração
  anterior do cliente; em (b), remover o diretório instalado; em (c), não há o que reverter. Em
  todas, o pacote global nunca foi alterado.
- **Se um consumidor quebrar em beta:** o revert devolve o `dist-cjs` ao formato anterior no
  build seguinte. Nenhum dado é afetado.

## Validação (como provo que funciona)

1. **Emissão CJS real nos 8:** `require()` do `dist-cjs` devolve os mesmos exports de antes,
   comparados por hash do conjunto. Ler o `tsconfig` ou dar `head` no arquivo **não** vale — foi
   assim que `node16` passou por bom no teste inicial.
2. **`TS5108` extinto:** `tsc` do TS 7 sai `0` nos 8 `tsconfig.cjs.json`, com emissão real.
3. **Nenhuma deprecação restante escondida:** o build dos 8 passa sem `ignoreDeprecations`.
4. **Repo verde:** `lint`, `build`, `test` e `verify:api`, com número por app/pacote — nunca
   "tudo verde" sem contagem.
5. **Flake corrigido:** rodadas repetidas da suíte completa, todas verdes. Uma só não prova nada
   num defeito intermitente.
6. **Smoke de `packages/auth`:** os backends que o consomem em produção resolvem o `dist-cjs` e
   carregam as funções de sessão; `verifyToken` com token inválido devolve `null`, não lança.
7. **Global preservado:** `tsc --version` responde `Version 7.0.2` ao fim.
8. **Fase 0:** a pergunta "o cliente aceita servidor customizado?" tem resposta medida, e a
   escolha entre (a), (b) e (c) está registrada como decisão do mantenedor.
9. **Destravamento:** o script roda e responde **BLOQUEADO** hoje, com o range atual do
   `typescript-eslint` impresso. Um verificador que não sabe dizer "ainda não" também não saberá
   dizer "agora sim".

O passo 1 é o que prova a spec. Compilar sem erro já acontece com `node16`, que emite ESM e
quebra em produção — o artefato carregado é a única evidência que separa uma coisa da outra.
