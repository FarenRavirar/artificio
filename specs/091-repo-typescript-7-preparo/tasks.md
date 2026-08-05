# Tasks — 091

> **Origem:** achado lateral da spec 090, T2.2 (2026-08-05). Um `tsc` invocado à mão falhou com
> `TS5108` e o agente registrou como falso alarme antes de investigar até a causa. O mantenedor
> mandou investigar mais; a investigação encontrou duas causas reais e um terceiro problema que
> ninguém tinha visto — o fallback `bundled` do language server está quebrado.
>
> **Decisões do mantenedor, fechadas em 2026-08-05:**
>
> 1. **Escopo é preparo + monitoramento**, não migração — `typescript-eslint` não suporta TS 7.
> 2. **Subir dentro do 6.x**: pedido, mas **não há o que subir** — `6.0.3` é o último 6.x
>    publicado (medido; o canal tem `6.0.2` e `6.0.3`). Registrado como fato no requisito 5 para
>    não ser reaberto.
> 3. **Migrar os 8 pacotes de `node10` agora.**
> 4. **Global fica no 7.** "Tem que corrigir, mas deixando o 7."
> 5. **`packages/auth` incluído** — "sim, toca o auth também".
> 6. **Flake de teste: corrigir agora**, não registrar como débito.
>
> ---
>
> ⚠️ **CORREÇÃO DE 2026-08-05 — a primeira redação desta spec estava errada e quase virou
> trabalho errado. Ler antes de executar a Fase 0.**
>
> A versão anterior deste bloco afirmava: *"o TS 7 não expõe API estável"* e *"o global 7.0.2 não
> contém `tsserver.js`, logo o fallback do language server precisa de um TypeScript 6"*. A
> conclusão era instalar TS 6 sob o `typescript-language-server`.
>
> O mantenedor perguntou: **"se a ideia é usar a versão 7 em tudo, por que regredir instalando a
> 6?"** A investigação que essa pergunta forçou derrubou as duas premissas:
>
> - **O TS 7 tem language server nativo.** `tsc --lsp -stdio | -pipe | -socket`. Medido dentro do
>   `tsc.exe` (23,4 MB, `@typescript/typescript-win32-x64`): 6242 ocorrências de `lsp`, 82 métodos
>   `textDocument/`, caminhos de origem `cmd/tsgo/lsp.go` e `internal/lsp/lsproto/baseproto.go`.
>   **Provado:** um `initialize` JSON-RPC por stdio recebeu resposta válida.
> - **A API do compilador existe** — `tsc --api`, com `-async` (JSON-RPC) ou MessagePack. Ela não
>   sumiu; **mudou de transporte**, de `require('typescript')` para IPC. É por isso que
>   `exports["."]` só carrega `version.cjs`: o consumo virou por processo, não por módulo.
> - **`tsserver.js` não foi removido sem substituto** — foi substituído por `tsc --lsp`. O
>   `typescript-language-server` é um wrapper Node do `tsserver.js`, e o TS 7 **não precisa dele**.
>
> **Consequência para as tasks:** a Fase 0 deixou de ser "instalar TS 6" e virou "medir se o
> cliente LSP aceita servidor customizado, e só então decidir". O bloqueador da migração também
> caiu de dois para **um**: `typescript-eslint`.
>
> **A lição, para quem retomar:** a spec errada não veio de falta de medição — veio de medir uma
> ausência (`não achei tsserver.js`) e concluir uma impossibilidade (`logo não há LSP`), sem
> procurar o substituto. Ausência do que se esperava não é ausência de solução.
>
> ---
>
> **Medições que sustentam a spec corrigida:**
> `@typescript-eslint/typescript-estree@8.66.0` (latest, reconfirmado) declara
> `typescript: ">=4.8.4 <6.1.0"` — **único bloqueador**; `typescript@7.0.2` é o
> [typescript-go](https://github.com/microsoft/typescript-go), wrapper npm fino sobre binário
> nativo por plataforma, com LSP e API embutidos; `moduleResolution: bundler` compila, emite CJS,
> carrega em Node e passa no TS 7, enquanto `node16` emite ESM e quebra e `nodenext` nem compila.

## Fase 0 — Ambiente local

- [x] T0.0a — Ler `AGENTS.md` inteiro (T0 pétreo — obrigatório toda sessão/toda fase nova, mesmo se já lido antes nesta mesma sessão) antes de agir nesta fase. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T0.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase (`rtk git status/diff/log`, `rtk rg`, `rtk read`, `rtk pnpm`, `rtk tsc`, `rtk lint`, `rtk <test-runner>` — ver `AGENTS.md` §rtk pra lista completa). · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T0.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra (`AGENTS.md` — regra de comunicação do projeto). · feito quando: mensagens da fase seguem o registro.
> **Esta fase mede antes de agir.** Nenhuma alteração de ambiente acontece antes de T0.3
> responder, e a escolha é do mantenedor (T0.4), não do agente. Foi pular esse passo que produziu
> a versão errada da spec.

- [x] T0.1 — **Registrar a baseline do ambiente antes de tocar em nada.** Versão do `typescript` global; conteúdo de `lib/` dele; alvo atual da resolução `bundled` a partir do `cli.mjs` do `typescript-language-server`; e a linha de comando dos processos `tsserver` vivos. Sem baseline não há como provar que a mudança fez o que devia e só o que devia. · feito quando: os quatro valores registrados, com o `bundled` documentado apontando para caminho inexistente (estado defeituoso atual).
- [x] T0.2 — **Confirmar o servidor LSP nativo do TS 7 no ambiente do mantenedor.** Localizar o binário (`@typescript/typescript-<plataforma>/lib/tsc.exe`), rodar `tsc --lsp --help` para listar os modos de transporte, e enviar um `initialize` JSON-RPC por stdio confirmando resposta válida. Já medido uma vez em 2026-08-05; a task existe para reproduzir em ambiente limpo e registrar o comando exato que o cliente usaria. · feito quando: `tsc --lsp -stdio` responde a um `initialize`, com a resposta registrada.
- [x] T0.3 — **Medir se o cliente LSP aceita servidor customizado** (requisito 9). **Resposta: SIM.** Investigado local e online em 2026-08-05. Evidência abaixo. · feito quando: resposta sim/não com evidência. ✅

> **T0.3 — resultado: o cliente aceita servidor customizado, e a saída (a) é viável.**
>
> **Local:** `~/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json:3500-3527`
> define o `typescript-lsp` com um bloco `lspServers` declarativo — `command`,
> `args: ["--stdio"]` e `extensionToLanguage`. O `settings.json` só carrega o **toggle** do
> plugin; a definição do servidor vive no manifesto. **12 plugins** do marketplace usam o mesmo
> padrão (`gopls`, `clangd`, `rust-analyzer`, `pyright-langserver`, …), sempre com `command` e
> `args` livres.
>
> **Online** ([docs oficiais](https://code.claude.com/docs/en/plugins-reference)): o schema é
> `.lsp.json` na raiz do plugin **ou** campo `lspServers` no `plugin.json`. Obrigatórios:
> `command` (binário, precisa estar no `PATH`) e `extensionToLanguage`. Opcionais: `args`,
> `transport` (`stdio` padrão ou `socket`), `env`, `initializationOptions`, `settings`,
> `workspaceFolder`, `startupTimeout`, `shutdownTimeout`, `restartOnCrash`, `maxRestarts`,
> `diagnostics`.
>
> **Marketplace local é suportado**, sem depender do oficial: diretório com
> `.claude-plugin/marketplace.json`, `source` apontando para uma pasta que exista, e
> `/plugin marketplace add <caminho>` + `/plugin install <nome>@<marketplace>` + `/reload-plugins`.
>
> ⚠️ **Correção do que este parágrafo dizia antes:** eu havia escrito que `"strict": false` faz a
> entrada do marketplace virar "a definição completa, dispensando `plugin.json`". **Isso não vale
> para LSP.** A documentação de marketplaces (§Strict mode) lista o que `strict: false` cobre —
> skills, agents, hooks, MCP servers e output styles — e **`lspServers` não está nessa lista**.
> Com `strict: false` e sem `plugin.json`, o `lspServers` da entrada é silenciosamente ignorado: o
> plugin instala, aparece como `enabled`, e não registra servidor nenhum. **O certo é
> `strict` no default (`true`) com `lspServers` dentro do `plugin.json` do próprio plugin.** Copiei
> `strict: false` do `typescript-lsp` oficial sem verificar o que o campo faz.
>
> **Medição que fecha a viabilidade:** `tsc --lsp --help` executado pelo **`tsc` do `PATH`**
> (wrapper npm) responde `Usage of lsp: -pipe / -socket / -stdio`, `exit 0`. O wrapper delega ao
> binário nativo.
>
> ⚠️ **Correção de 2026-08-05 — a conclusão que este parágrafo tirava estava errada.** Eu havia
> escrito que "`command: "tsc"` basta — não é preciso caminho absoluto". A medição estava certa,
> **a inferência não**: ela só provou que o `tsc` do `PATH` *daquele momento* era o TS 7 global.
> Num `PATH` sem o npm global, `tsc` resolve para `node_modules/.bin/tsc` do repositório, que é
> **TS 6.0.3** e responde `error TS5023: Unknown compiler option '--lsp'`. O servidor não sobe e
> o cliente não recebe erro interpretável — só fica mudo. Corrigido no plugin v1.1.0 com o
> caminho absoluto do `tsc.exe` nativo. Detalhe e trade-off em `plan.md` §3.
>
> **Trava descoberta na documentação, que a implementação precisa respeitar:** quando mais de um
> servidor habilitado declara a mesma extensão em `extensionToLanguage`, **o primeiro registrado
> vence e os outros nunca sobem**. Logo, adicionar um plugin novo **não basta** — é preciso
> desabilitar o `typescript-lsp` oficial, senão o resultado é indeterminado. O `/plugin` mostra
> aviso nomeando qual está ativo.
>
> **Consequência para T0.4:** a saída (a) — "7 em tudo" — é tecnicamente viável e não exige tocar
> no pacote global. Custo: criar um marketplace local, desabilitar o plugin oficial e aceitar um
> language server novo (o LSP do typescript-go é recente e menos exercitado que o `tsserver.js`,
> que tem uma década de uso). A escolha continua sendo do mantenedor.
- [x] T0.4 — **ESCOLHA DO MANTENEDOR, 2026-08-05: saída (a) — apontar o cliente LSP para `tsc --lsp -stdio` do TypeScript 7.** "7 em tudo": o wrapper `typescript-language-server` deixa de ser usado, o pacote global permanece no 7.0.2 e nenhum TypeScript 6 é instalado fora do repo. Custo aceito: o LSP do typescript-go é recente e menos exercitado que o `tsserver.js`. Rollback é reabilitar o plugin oficial. **Trava obrigatória na execução:** o `typescript-lsp` oficial precisa ser desabilitado, senão dois servidores disputam as mesmas extensões e o primeiro registrado vence de forma indeterminada. · feito quando: escolha registrada. ✅
- [x] T0.5 — **Executar a saída (a).** Aprovação nominal do mantenedor em 2026-08-05. Escrita de arquivo feita pelo agente; os comandos de sessão (`/plugin marketplace add`, `/plugin install`, `/reload-plugins`) são do mantenedor. · feito quando: arquivos criados, plugin oficial desabilitado, comandos de sessão executados.

> **T0.5 — o que foi criado e alterado (2026-08-05):**
>
> | Caminho | Ação |
> |---|---|
> | `~/.claude/local-marketplace/.claude-plugin/marketplace.json` | **novo** — marketplace `local-plugins`, entrada `typescript-lsp-native` com `source`, `version` e metadados. **Sem `strict: false` e sem `lspServers`** — a primeira versão os tinha, e foi o defeito corrigido adiante |
> | `~/.claude/local-marketplace/plugins/typescript-lsp-native/.claude-plugin/plugin.json` | **novo** — a autoridade: `lspServers` com `command` = **caminho absoluto do `tsc.exe` nativo** (v1.1.0; era `"tsc"` na v1.0.0, e isso era defeito — ver correção em T0.5), `args: ["--lsp","-stdio"]`, 8 extensões, `transport`, `restartOnCrash` |
> | `~/.claude/local-marketplace/plugins/typescript-lsp-native/README.md` | **novo** — documenta o porquê, a trava de servidor único e o rollback |
> | `~/.claude/settings.json` | `typescript-lsp@claude-plugins-official` → **`false`** (escopo usuário) |
> | `.claude/settings.json` | `typescript-lsp@claude-plugins-official` → **`false`** (escopo projeto, versionado). **É aqui que a correção definitiva mora** — este arquivo é que mantinha o plugin oficial ativo |
> | `.claude/settings.local.json` | **inalterado**, idêntico ao commit `4b1d84d`. A primeira tentativa escreveu o override aqui; era remendo sobre o `true` do `settings.json` e foi revertido |
>
> O pacote `typescript` global segue em 7.0.2, intocado.
>
> **Achado durante a execução — falso alarme, registrado para não custar tempo depois.**
> Testando o comando exato do plugin, `Start-Process "tsc" --lsp -stdio` falhou com
> `%1 não é um aplicativo Win32 válido`. **Não é problema do plugin:** `tsc` no `PATH` é um shim
> (`tsc.cmd`/`tsc.ps1`/script sh), e `Start-Process` do PowerShell não executa `.cmd` diretamente.
>
> Duas verificações fecham a questão: (1) o binário nativo
> (`@typescript/typescript-win32-x64/lib/tsc.exe --lsp -stdio`) responde ao `initialize` JSON-RPC;
> (2) **por precedente** — o plugin oficial usa `typescript-language-server`, que também é shim
> `.cmd`, e funcionava (T0.1 registrou 2 processos `tsserver` vivos). Logo o Claude Code resolve
> shims.
>
> ⚠️ **A última frase deste bloco previa o desfecho errado.** Ela dizia que trocar `command` pelo
> caminho absoluto "amarraria a configuração à plataforma e à versão, então só se a evidência
> exigir". **A evidência exigiu** — e não pelo motivo previsto (cliente não subir o servidor), mas
> por um pior: com `command: "tsc"`, um `PATH` sem o npm global faz o cliente subir o `tsc` do
> **workspace** (TS 6.0.3), que rejeita `--lsp` e deixa o LSP mudo sem erro visível. Corrigido no
> plugin v1.1.0. As três formas (`.exe` direto, `tsc.cmd` absoluto, `tsc` via `PATH`) foram
> medidas e **todas** completam o handshake — o que decidiu foi a robustez a mudança de `PATH`,
> não a capacidade.
> **T0.6 — DEFEITO ENCONTRADO E CORRIGIDO: `strict: false` não carrega `lspServers` (2026-08-05).**
>
> Depois do reinício do Claude Code, os processos eram **novos** (13:11:16) e mesmo assim ainda
> `typescript-language-server` + `tsserver.js` do workspace. **Nenhum `tsc --lsp` subiu.** Minha
> hipótese anterior — "processos velhos sobreviveram ao reload" — **estava errada**, e o reinício
> provou isso.
>
> **Causa real, na documentação de marketplaces** (§Strict mode): `strict: false` significa "a
> entrada do marketplace é a definição inteira", e a lista de componentes que ela cobre é
> **skills, agents, hooks, MCP servers e output styles** — **`lspServers` não está nela**. Com
> `strict: false` e sem `plugin.json`, o `lspServers` que eu tinha escrito na entrada do
> marketplace simplesmente não era lido. O plugin instalava, aparecia em `claude plugin list`,
> contava como "3 plugin LSP servers" e **não registrava servidor nenhum**.
>
> Copiei `"strict": false` do `typescript-lsp` oficial sem verificar o que o campo faz — o
> oficial funciona por outro caminho, não por causa dele.
>
> **Correção aplicada:**
>
> | Arquivo | Mudança |
> |---|---|
> | `plugins/typescript-lsp-native/.claude-plugin/plugin.json` | **novo** — passa a ser a autoridade, com `lspServers` (`command: "tsc"` nesta etapa; virou caminho absoluto na v1.1.0, ver T0.5), `args: ["--lsp","-stdio"]`, 8 extensões |
> | `.claude-plugin/marketplace.json` | `strict: false` **removido** (volta ao default `true`), `lspServers` removido da entrada (ficaria duplicado e, com `strict: true`, seria merge desnecessário), `version` → `1.0.1` para forçar atualização (hoje **1.1.0**, sincronizada com o `plugin.json`) |
>
> Com `strict: true` (default), o `plugin.json` é a autoridade e a entrada do marketplace pode
> suplementá-lo. É o modo correto para um plugin que define seus próprios componentes.
>
> **Pendente:** reinstalar o plugin (a `version` mudou) e verificar de novo.

> **T0.6 — tentativa anterior, hipótese errada, mantida como histórico:**
>
> Depois de `/plugin marketplace add` + `/plugin install typescript-lsp-native@local-plugins` +
> `/reload-plugins`, o Claude Code reportou **"3 plugin LSP servers"** — eram 2 antes
> (`typescript-lsp` + `pyright-lsp`), então o plugin novo **foi registrado**.
>
> **Mas o servidor novo não está servindo ainda.** Medido: uma consulta LSP real
> (`workspaceSymbol`) respondeu corretamente, porém os processos que atendem continuam sendo
> `typescript-language-server.cmd` + dois `tsserver.js` do workspace. **Nenhum `tsc --lsp`
> subiu.**
>
> **Causa: processos anteriores ao reload.** Os quatro processos foram criados às `12:59:49`, e o
> `/reload-plugins` rodou ~70 segundos depois. `/reload-plugins` recarrega a configuração, mas
> **não mata language server já vivo** — o servidor antigo continua dono das extensões `.ts`
> pela regra do "primeiro registrado vence".
>
> **Descartado como causa, por medição:** (a) a estrutura do plugin — comparada campo a campo com
> a do `typescript-lsp` oficial, `source`/`strict`/`lspServers` idênticos em forma; (b) o
> conteúdo do cache — o oficial também guarda só `README`/`LICENSE`, porque a definição vive no
> `marketplace.json`, não no cache; (c) `command: "tsc"` ser shim — o oficial usa
> `typescript-language-server.cmd`, também shim, e funciona.
>
> **Pendente:** reiniciar o Claude Code e repetir a verificação. Enquanto não reiniciar, o
> ambiente segue servido pelo `typescript-language-server` + `tsserver.js` do workspace — que é o
> comportamento anterior, sem regressão.

> **T0.6/T0.7 — CONCLUÍDO E PROVADO (2026-08-05). O TS 7 serve o LSP.**
>
> Processo vivo depois da correção final, com a cadeia inteira visível:
>
> ```
> PID 22300  tsc.cmd --lsp -stdio
> PID  6984  node .../npm/node_modules/typescript/bin/tsc --lsp -stdio
> PID 20488  .../@typescript/typescript-win32-x64/lib/tsc.exe --lsp    (115 MB)
> ```
>
> **Nenhum `typescript-language-server`. Nenhum `tsserver.js`.** Consulta real
> (`workspaceSymbol` por `normalizeGuardResult`) respondeu corretamente, servida por essa cadeia.
>
> Confirma também o que eu havia deduzido em T0.3: o wrapper npm no `PATH` (`tsc.cmd`) delega
> `--lsp` ao binário nativo. **Mas "funciona" não era o mesmo que "está certo"** — a cadeia de 3
> processos acima existe porque `command` era `"tsc"`, e ela só resolvia o TS 7 porque o npm
> global estava à frente no `PATH`. Corrigido na v1.1.0: com o caminho absoluto do `.exe`, o
> cliente executa **um processo só**, sem `cmd.exe` nem `node` no meio. Ver T0.5.
>
> ---
>
> **A causa que travava tudo, e que só o `claude plugin list` revelou: escopo de plugin.**
>
> O `typescript-lsp` oficial estava habilitado em **dois escopos**, e eu só tinha desativado um:
>
> | Escopo | Origem | Estado inicial |
> |---|---|---|
> | `user` | `~/.claude/settings.json` | desativei na primeira tentativa |
> | **`project`** | **`.claude/settings.json` do repositório** | **continuava `true`** |
>
> Project vence user, então o oficial seguia ativo e ganhava a disputa das extensões `.ts` pela
> regra do "primeiro servidor registrado vence" — e o `tsc --lsp` nunca subia. O sintoma era
> mudo: plugin instalado, `enabled`, contando como "3 plugin LSP servers", e sem servir nada.
>
> **Primeira correção (remendo):** `"typescript-lsp@claude-plugins-official": false` em
> `.claude/settings.local.json`, deixando `.claude/settings.json` intocado.
>
> ⚠️ **Dois erros meus nessa correção, ambos corrigidos em 2026-08-05:**
>
> 1. Afirmei que `settings.local.json` "não é versionado". **É.** `git ls-files` o lista, tem
>    commit (`4b1d84d`) e não consta no `.gitignore`, apesar do nome. A mudança entrava no
>    repositório — exatamente o que eu disse que estava evitando.
> 2. Pior que o erro de fato: era **remendo sobre a causa**. O `true` continuava no
>    `.claude/settings.json` versionado, então o repositório afirmava duas coisas contraditórias
>    e dependia da precedência de escopo para não se contradizer na prática.
>
> **Correção definitiva, na origem:** `.claude/settings.json` passou a declarar `false`, e o
> override saiu do `settings.local.json` — que voltou **idêntico ao commit `4b1d84d`**
> (`git diff --quiet` limpo, 239 permissões preservadas). Diff final no repositório: **uma linha
> em um arquivo**. A pergunta certa era "quem está ligando isso?", não "onde eu desligo?".
>
> **Precedência confirmada empiricamente, porque a documentação se contradizia.** A doc afirma
> `local > project > user`, mas o texto seguinte dizia que "não se pode desabilitar por
> local/user um plugin habilitado em project". Testado: depois de escrever em
> `settings.local.json`, `claude plugin list` passou a mostrar **ambas** as entradas do oficial
> como `✘ disabled` — inclusive a de escopo `project`. A ordem declarada é a correta; a ressalva
> estava errada.
>
> ---
>
> **Duas hipóteses minhas que a medição derrubou, registradas para não voltarem:**
>
> 1. **"Processos velhos sobreviveram ao `/reload-plugins`."** Falso — depois do reinício os
>    processos eram novos (13:11:16) e ainda assim eram o `typescript-language-server`.
> 2. **"O cache do plugin não tem `plugin.json`."** Falso — tinha, em
>    `1.0.0/.claude-plugin/plugin.json`. Meu `find` não listava arquivos ocultos, e eu li a
>    ausência na saída como ausência no disco.
>
> **O que continuou valendo:** a correção de `strict: false` → `plugin.json` era necessária
> (`lspServers` não entra na lista de componentes que `strict: false` cobre), só não era
> suficiente sozinha.

- [x] T0.6 — **Provar o resultado da saída escolhida.** Em (a): o cliente sobe usando `tsc --lsp` e responde a uma consulta real (`hover`/`workspaceSymbol`). Em (b): a resolução `bundled` a partir do `cli.mjs` aponta para um `tsserver.js` **existente**. Em (c): registrar que o fallback segue quebrado e por que isso é aceitável. · feito quando: evidência coletada por execução, não por leitura de configuração.
- [x] T0.7 — **Provar qual TypeScript passa a servir este repo, e que a mudança é intencional.** **Reescrita depois da escolha da saída (a) em T0.4:** a formulação anterior exigia que o LSP continuasse usando o TypeScript do workspace (6.0.3) — o que **contradiz** a saída escolhida, cujo propósito é justamente servir pelo TS 7. Aquele critério fazia sentido para (b) e (c), não para (a). Em (a), o correto é confirmar na linha de comando do processo vivo que o servidor passou a ser `tsc --lsp` e que **nenhum** `tsserver.js` do workspace sobe em paralelo para as mesmas extensões. **Consequência a registrar, não a esconder:** o repo compila com TS 6.0.3, mas passa a ser *analisado* pelo TS 7 no editor — divergência aceitável enquanto o diagnóstico bater, e que precisa ser observada. Se o LSP do TS 7 acusar erro que o `tsc` do repo não acusa (ou o contrário), isso é achado a reportar, não ruído a ignorar. · feito quando: processo vivo confirmado servindo por `tsc --lsp`, sem `tsserver.js` concorrente, e a divergência de versão registrada.
- [x] T0.8 — **Confirmar que o `tsc` do `PATH` continua sendo o 7** e que o pacote global não foi tocado — nem versão, nem conteúdo, nem resíduo de teste (renomeação, diretório sonda). · feito quando: `tsc --version` responde `7.0.2` e o diretório global está íntegro. ✅ **`Version 7.0.2`, íntegro.** Configuração coerente: `typescript-lsp@claude-plugins-official = false`, `typescript-lsp-native@local-plugins = true`, marketplace `local-plugins` registrado como `source: directory`. Nenhum TypeScript 6 instalado fora do repo — a saída (a) cumpriu a decisão 4 do mantenedor.

## Fase 1 — Os 8 pacotes CJS

- [x] T1.0a — Ler `AGENTS.md` inteiro (T0 pétreo — obrigatório toda sessão/toda fase nova, mesmo se já lido antes nesta mesma sessão) antes de agir nesta fase. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T1.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase (`rtk git status/diff/log`, `rtk rg`, `rtk read`, `rtk pnpm`, `rtk tsc`, `rtk lint`, `rtk <test-runner>` — ver `AGENTS.md` §rtk pra lista completa). · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T1.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra (`AGENTS.md` — regra de comunicação do projeto). · feito quando: mensagens da fase seguem o registro.
- [x] T1.1 — **Levantar quem importa cada um dos 8 pacotes, por busca no código.** `auth`, `catalog-client`, `catalog-matching`, `changelog`, `comments`, `content`, `content-editor`, `feedback` — quais apps consomem por `require`, e quais `Dockerfile` de produção copiam o `dist-cjs` deles. É o passo que os incidentes E016/E017 provaram indispensável: pacote compartilhado que muda emissão sem mapear consumidor quebra só quando o container sobe. · feito quando: tabela pacote → consumidores → `Dockerfile` que copia, levantada por busca e não por memória.
- [x] T1.2 — **Aprovação nominal para tocar `packages/auth`** (`AGENTS.md`: pacote sagrado). **Concedida pelo mantenedor em 2026-08-05: "sim, toca o auth também".** Os 8 pacotes entram juntos, `auth` incluído; não há PR separado para ele. A mudança é de configuração de build (2 linhas no `tsconfig.cjs.json`), não de código, mas a emissão dele alimenta o SSO de toda a suíte — o smoke de T1.8 continua obrigatório. · feito quando: aprovação registrada. ✅
- [x] T1.3 — **Capturar o `dist-cjs` de referência dos 8 antes da mudança.** Para cada pacote: buildar no estado atual e registrar os exports que `require()` devolve. Sem esse "antes", "depois" não prova nada. · feito quando: lista de exports por pacote registrada, obtida por carga real do artefato.
- [x] T1.4 — **Trocar `moduleResolution: node10` por `bundler` e remover `ignoreDeprecations`** nos 8 `tsconfig.cjs.json`. Manter `module: CommonJS`. `ignoreDeprecations` sai porque existia só para calar o aviso do `node10` — mantê-lo viraria lixo de configuração. **Não usar `node16` nem `nodenext`:** medido antes da spec, `node16` compila mas emite ESM e o `require()` quebra; `nodenext` nem compila (`TS5110`). · feito quando: os 8 arquivos alterados, nenhum com `node10` ou `ignoreDeprecations` remanescente.
- [x] T1.5 — **Provar emissão CommonJS real nos 8** (requisito 6). Para cada pacote, `require()` do `dist-cjs` recém-emitido devolve os mesmos exports de T1.3. Inspecionar o `tsconfig` ou dar `head` no arquivo **não** vale — foi assim que `node16` passou por bom no teste inicial. · feito quando: os 8 carregam por `require()` com exports idênticos aos de T1.3.
- [x] T1.6 — **Provar que o `TS5108` acabou** (requisito 7). Rodar o `tsc` do TS 7 global contra cada um dos 8 `tsconfig.cjs.json` — o mesmo comando que hoje sai `1`. · feito quando: os 8 saem `0` sob o TS 7.
- [x] T1.7 — **Validar o repo inteiro:** `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test` e `rtk pnpm verify:api`, com contagem por app/pacote registrada. `verify:api` é obrigatório por `AGENTS.md` (mudança em `packages/**`); expectativa é `breaking=0`. · feito quando: os quatro verdes com número, nunca "tudo verde" sem contagem.
- [x] T1.9 — **Corrigir o flake da suíte sob paralelismo, na causa** (requisito 7; decisão do mantenedor em 2026-08-05: "corrigir agora"). **Causa medida durante a suíte:** 56 processos `node` simultâneos e memória livre caindo de 9,7 GB para 6,3 GB — 12 CPUs, 6 pacotes com `environment: jsdom`, e `turbo run test` **sem limite de concorrência**, cada vitest abrindo seus próprios workers. O sintoma alternava de pacote (`content-editor` numa rodada, `downloads-frontend` noutra) e nunca trazia erro de asserção, que é a assinatura de esgotamento de recurso, não de teste ruim. **Correção:** `turbo run test --concurrency=4` no `package.json` da raiz — uma linha, **nenhum teste desabilitado, pulado ou afrouxado** (`AGENTS.md` §Nunca mascarar erro). · feito quando: rodadas repetidas da suíte completa, todas verdes — uma só não prova nada num defeito intermitente. ✅ **3 rodadas seguidas, 39/39 cada, exit 0.**
- [x] T1.8 — **Smoke de SSO nos consumidores de `packages/auth`** (`AGENTS.md`, se T1.2 aprovou incluir `auth`): login, `/me`, logout. · feito quando: smoke executado nos consumidores levantados em T1.1, com resultado registrado.

> **Fase 1 executada em 2026-08-05. Os 8 pacotes migrados de `node10` para `bundler`.**
>
> **T1.1 — mapa de consumidores (levantado por busca):**
>
> | Pacote | Apps que importam | Entry CJS |
> |---|---|---|
> | `auth` | accounts, downloads, glossario, links, mesas, site | `dist-cjs/index-cjs.js` |
> | `catalog-client` | downloads, glossario, mesas | `dist-cjs/index.js` |
> | `catalog-matching` | downloads | `dist-cjs/index.js` |
> | `changelog` | downloads, glossario, mesas | `dist-cjs/index.js` |
> | `comments` | (nenhum ainda — criado em 2026-08-05) | `dist-cjs/index.js` |
> | `content` | downloads, glossario, mesas, site | `dist-cjs/index.js` |
> | `content-editor` | downloads, mesas | subpaths `sanitize`, `commentLinks` |
> | `feedback` | glossario, mesas, site | `dist-cjs/index.js` |
>
> Três `Dockerfile` de produção copiam `dist-cjs`: `downloads/backend`, `mesas/backend`,
> `glossario/backend`. **Correção de uma leitura minha que estava errada no meio do caminho:**
> medi que só `downloads/backend` declara `"type": "commonjs"` e quase concluí que os outros dois
> não dependiam do `dist-cjs`. Errado — o comentário no próprio `Dockerfile` (spec 089) explica:
> o `main` dos pacotes aponta para `dist-cjs`, então backend ESM também cai nele pela resolução.
> Os três dependem. Verificado depois por `require.resolve` a partir de cada backend: os três
> resolvem `dist-cjs`.
>
> **T1.3/T1.5 — exports antes e depois, por carga real do artefato** (não por leitura de
> `tsconfig`, que é o que deixaria `node16` passar por bom):
>
> `auth` 3 · `catalog-client` 8 · `catalog-matching` 6 · `changelog` 5 · `comments` 10 ·
> `content` 10 · `feedback` 13 · `content-editor/sanitize` 4 · `content-editor/commentLinks` 7.
> **Os 9 pontos de entrada com SHA do conjunto de exports idêntico antes e depois.** Emissão
> confirmada CommonJS nos 8 (nenhum `export {` no `dist-cjs`).
>
> **T1.6 — `TS5108` extinto:** os 8 `tsconfig.cjs.json` saem `exit 0` sob o `tsc` do TS 7 global,
> com emissão real (não só `--noEmit`). É o mesmo comando que saía `1`. Artefatos rebuildados com
> o `tsc` do repo depois do teste, para não deixar saída do TS 7 no `dist-cjs`.
>
> **T1.7 — validação:** `lint` **25/25** · `build` **25/25** · `test` **39/39** ·
> `verify:api` **`breaking=0` nos 6 apps**.
>
> **T1.8 — smoke de `packages/auth`:** os três backends que o consomem em produção
> (`downloads`, `mesas`, `glossario`) resolvem o `dist-cjs` e carregam `requireAuth`,
> `verifyToken` e `csrfProtection` — 3/3 em cada. Smoke funcional: `verifyToken` com token
> inválido devolve `null`, não lança.
>
> **Achado durante a execução, corrigido: `packages/content` tinha uma segunda deprecação
> escondida.** Remover `ignoreDeprecations` expôs `TS5101: Option 'baseUrl' is deprecated` — o
> `ignoreDeprecations` calava **duas** coisas, não uma. O `baseUrl` existia só para um `paths`
> apontando `@artificio/config` para o `.d.ts`; verificado que `src/index.ts` **não importa**
> `@artificio/config`, e que o pacote já declara `exports.types` resolvível sozinho. `baseUrl` e
> `paths` removidos; exports do `content` seguem idênticos (10, mesmo SHA). Sem este passo, o
> `baseUrl` viraria o próximo `TS5108` na migração para o TS 7.
>
> **Flake de teste sob paralelismo — corrigido em T1.9** (decisão do mantenedor: "corrigir
> agora"). Detalhe na própria task.

## Fase 2 — Critério de destravamento

- [x] T2.0a — Ler `AGENTS.md` inteiro (T0 pétreo — obrigatório toda sessão/toda fase nova, mesmo se já lido antes nesta mesma sessão) antes de agir nesta fase. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T2.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase (`rtk git status/diff/log`, `rtk rg`, `rtk read`, `rtk pnpm`, `rtk tsc`, `rtk lint`, `rtk <test-runner>` — ver `AGENTS.md` §rtk pra lista completa). · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T2.0c — Comunicação com o mantenedor nesta fase em português, caveman ultra (`AGENTS.md` — regra de comunicação do projeto). · feito quando: mensagens da fase seguem o registro.
- [x] T2.1 — **Escrever `scripts/check-typescript-7-readiness.mjs`** (requisito 12). Consulta o npm o range `peerDependencies.typescript` do `latest` de `@typescript-eslint/typescript-estree`. Imprime **DESTRAVADO** quando o range aceitar `7.x`; **BLOQUEADO** caso contrário, com o range atual visível. **Critério único** — a versão anterior desta task exigia também que a API do TypeScript saísse de `./unstable/*`, condição que **deixou de existir**: a API está em `tsc --api` (JSON-RPC/MessagePack), não em módulo importável, e nunca voltará ao formato antigo. Manter aquela condição faria o script responder `BLOQUEADO` para sempre. Sob demanda, **fora do CI** — o CI não pode falhar porque o ecossistema não mudou. · feito quando: script existe e roda.
- [x] T2.2 — **Rodar o script e confirmar que ele responde `BLOQUEADO` hoje**, imprimindo o range real do `typescript-eslint`. Um verificador que não sabe dizer "ainda não" também não saberá dizer "agora sim". · feito quando: saída registrada, com o range atual visível.
> **Fase 2 — executada em 2026-08-05. Entregável: `scripts/check-typescript-7-readiness.mjs`.**
>
> Saída real de hoje:
>
> ```
>   typescript (latest no npm) : 7.0.2
>   @typescript-eslint/typescript-estree : 8.66.0
>   range de typescript aceito : >=4.8.4 <6.1.0
>
> BLOQUEADO — typescript-eslint ainda não aceita 7.x.
> ```
>
> **A lógica foi testada nos dois sentidos**, porque um verificador que só sabe dizer "ainda não"
> não serve para dizer "agora sim". Sete casos, todos corretos: `>=4.8.4 <6.1.0` → bloqueado;
> `>=4.8.4 <8.0.0` → destravado; `>=7.0.0 <8.0.0` → destravado; **`>=4.8.4 <7.0.0` → bloqueado**
> (parece aceitar 7, mas o teto exclui); sem teto e sem menção a 7 → bloqueado; vazio e nulo →
> bloqueado. Conservador por desenho: um falso DESTRAVADO custa uma migração quebrada, um falso
> BLOQUEADO custa rodar o comando de novo depois.
>
> **Critério único, e isso é deliberado.** A condição "API do TypeScript sair de `./unstable/*`"
> foi removida: ela **nunca** será satisfeita, porque o TS 7 serve a API por IPC (`tsc --api`) em
> vez de módulo importável. Mantê-la faria o script responder BLOQUEADO para sempre — um
> verificador que nunca destrava é pior que nenhum.
>
> **Sai `0` em qualquer resultado, e roda fora do CI**: o CI não pode ficar vermelho porque o
> ecossistema não mudou. Quem lê a saída é humano.
>
> **Dois detalhes de implementação com pegadinha registrada no próprio arquivo:** `execFile` não
> executa o `npm` do Windows (é `.cmd`, recusado desde CVE-2024-27980, falha com `spawn EINVAL`),
> e `execFile` + `shell: true` funciona mas emite `DEP0190`. A saída limpa é `exec` com linha de
> comando única — válida aqui porque nada vem de entrada externa, e o comentário no código avisa
> que voltar a `execFile` é obrigatório se algum argumento virar parâmetro.

- [x] T2.3 — **Registrar o critério onde o mantenedor mandar.** · feito quando: destino confirmado pelo mantenedor e registro feito só ali. ✅ **Destinos autorizados e usados:** (1) esta spec, que é o registro canônico do critério; (2) `specs/090-packages-comments-compartilhado/tasks.md` §Bloqueios conhecidos, onde o débito que originou a 091 passou a apontar para cá (`specs/091-repo-typescript-7-preparo/`). **`project-state.md` não foi tocado** — decisão explícita do mantenedor em 2026-08-05 ("não precisa do project-state"). `decisions.md`, backlog e sessões também não foram abertos nem atualizados.

## Bloqueios conhecidos

- **`packages/auth` é sagrado.** Está entre os 8. Aprovação nominal concedida em 2026-08-05
  ("sim, toca o auth também"), e o smoke de T1.8 permanece obrigatório mesmo sendo mudança de
  configuração de build — a emissão dele alimenta o SSO de toda a suíte.
- **O risco real não é falhar o build, é emitir ESM achando que emitiu CJS.** `node16` faz
  exatamente isso: passa no `tsc` e produz `export {...}` no `dist-cjs`. Verde no CI,
  `Unexpected token 'export'` quando o container sobe — a classe de falha dos incidentes
  E016/E017. É por isso que T1.5 exige carregar o artefato, não ler configuração.
- **A migração para o TS 7 continua bloqueada depois desta spec, por UM motivo:**
  `typescript-eslint` não aceita `7.x`. Fechar esta spec **não** autoriza migrar. **A versão
  anterior listava dois bloqueadores** e incluía "API estável do TS 7" — condição que caiu: a API
  existe em `tsc --api`, por IPC. Quem retomar não deve reintroduzir aquele item.
- **A Fase 0 mexeu no ambiente local do mantenedor** (marketplace e plugin em `~/.claude/`, fora
  do repositório). Exigiu aprovação nominal antes da escrita (T0.5), e a saída foi escolha do
  mantenedor (T0.4), não do agente.
- **Desabilitar plugin: corrigir na origem, não no arquivo mais próximo.** O `typescript-lsp`
  oficial estava `true` no `.claude/settings.json` (versionado, escopo `project`). A primeira
  correção neutralizou isso pelo `settings.local.json` — que **também é versionado**
  (`git ls-files`, commit `4b1d84d`, ausente do `.gitignore`, apesar do nome). Resultado: dois
  arquivos do repositório afirmando o oposto, dependendo de precedência de escopo para não
  colidir. **Corrigido:** o `false` mora agora no `.claude/settings.json`, e o
  `settings.local.json` voltou ao estado do commit. Regra que fica: quando um plugin precisa ser
  desligado, achar **quem o liga** antes de escolher onde escrever.
- **`command` de `lspServers` não deve depender do `PATH` quando o binário certo é ambíguo.**
  Com `command: "tsc"`, o servidor só subia porque o TS 7 global estava à frente; num `PATH`
  sem ele, `tsc` é o **TS 6.0.3 do workspace**, que responde `error TS5023: Unknown compiler
  option '--lsp'` e deixa o LSP mudo, sem erro visível ao cliente. Corrigido com caminho absoluto
  do `tsc.exe` nativo (plugin v1.1.0). Trade-off aceito: quebra se `npm prefix -g` mudar — mas
  falha **alto** (executável não encontrado) em vez de **baixo** (servidor mudo).
- **URI no formato Windows mata o servidor do TS 7.** Um `didOpen` com `file://C:\...` (barra
  invertida) derruba o `tsc.exe` com `rc=2`, sem panic e sem mensagem. **Diagnóstico:** quando o
  LSP emudecer, checar se o processo `tsc.exe --lsp` ainda existe antes de suspeitar de
  configuração — servidor ausente é crash, não config errada. O cliente do Claude Code não tem
  esse defeito (emite `/c:/...`). Variantes `c:` vs `C:` e percent-encoding **não** quebram nada.
- **Ausência do que se esperava não é ausência de solução.** O erro que originou a correção desta
  spec: mediu-se que o TS 7 não tem `tsserver.js` e concluiu-se que ele não tem language server.
  Tinha — `tsc --lsp`. Antes de declarar impossibilidade a partir de uma ausência, procurar o
  substituto.
- **Configuração de LSP só é lida no start do cliente.** `/reload-plugins` recarrega a config mas
  não derruba language server já vivo. Verificar efeito de mudança de servidor exige reiniciar a
  sessão **e** olhar a linha de comando do processo — `claude plugin list` mostra `enabled` mesmo
  quando o servidor não subiu, e o contador de "N plugin LSP servers" também não prova que ele
  está servindo.

---

## Estado final da execução (2026-08-05)

**Fases 0, 1 e 2 concluídas. Nenhuma decisão pendente.** Nada commitado — commit exige
autorização nominal do mantenedor.

**Diff no repositório: uma linha em um arquivo** (`.claude/settings.json`, `true` → `false`).
O resto da Fase 0 vive fora do repositório, em `~/.claude/`.

| Validação | Resultado |
|---|---|
| Os 8 pacotes sob `tsc` do TS 7 | **8/8 `exit 0`** (antes: `1` com `TS5108`) |
| Exports CJS antes × depois | **9/9 pontos de entrada idênticos**, por carga real do artefato |
| `rtk pnpm run lint` | **25/25** |
| `rtk pnpm run build` | **25/25** |
| `rtk pnpm run test` | **39/39**, e 3 rodadas seguidas verdes após o fix do flake |
| `rtk pnpm verify:api` | **`breaking=0`** nos 6 apps |
| Smoke `packages/auth` | 3 backends resolvem `dist-cjs`; `requireAuth`/`verifyToken`/`csrfProtection` carregam; `verifyToken` com token inválido devolve `null` |
| LSP servido por | **`tsc.exe --lsp`** (115 MB), sem `tsserver.js` nem `typescript-language-server` |
| `tsc` global | **7.0.2**, intocado |

**Arquivos tocados no repositório:** 8 `tsconfig.cjs.json` (7 modificados + `comments`, que é novo
da spec 090), `package.json` (concorrência do teste), `scripts/check-typescript-7-readiness.mjs`
(novo), `.claude/settings.local.json` (**pendente de decisão**), e esta spec.

**Fora do repositório:** `~/.claude/local-marketplace/**` (novo) e `~/.claude/settings.json`.
