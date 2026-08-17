# 092 — Uniformização do design system entre os apps

- **Módulo/Pacote:** `packages/ui`, `packages/comments`, `apps/{mesas,site,links,accounts,site-admin,downloads,glossario}`
- **Gate relacionado:** nenhum
- **Origem:** auditoria de front-end pedida pelo mantenedor em 2026-08-17, durante a fase 7 da spec 090

## Estado em 2026-08-17 — leia isto primeiro

A spec nasceu de um defeito visual concreto — a conversa de comentários ilegível em
`mesasbeta` — e a investigação encontrou uma causa que não era do componente: **o design
system existe, é maduro, e os apps não o consomem de forma uniforme.** Parte foi corrigida na
mesma sessão; o resto exige decisão do mantenedor porque muda a aparência de apps em produção.

| Frente | Estado | Resultado |
|---|---|---|
| **A** — vocabulário do `packages/comments` | ✅ feito | CSS reescrito sobre os tokens reais; 216/216 testes |
| **B** — tokens ausentes no design system | ✅ feito | `--radius-*`, `--space-*`, `--btn-danger-*`, `--brand-solid` criados em `packages/ui` |
| **C** — literais duplicados em `accounts` e `links` | ✅ feito | 32 fallbacks removidos, estados e botão destrutivo tokenizados |
| **D** — geometria das fachadas de conversa | ✅ feito | contêiner e hierarquia de título nos três consumidores |
| **E** — grade do catálogo do `mesas` | ✅ feito | `auto-fit` → `auto-fill`; medido 1793px → 420px por card |
| **F** — tokens semânticos redefinidos por app | ⛔ **bloqueado** | decisão do mantenedor: muda aparência de 4 apps em produção |
| **G** — `packages/comments` fora do scanner do Tailwind | ⛔ **bloqueado** | contornado, mas a causa segue de pé |

**O que motivou a spec, na frase do mantenedor:** *"tem que padronizar, isso não pode ocorrer.
todos os sites do projeto tem que ter o mesmo padrão. ficar fazendo gambiarra dá problema."*

---

## O que já se sabe (medido, não inferido)

### 1. O design system é maduro e está carregado em todo lugar

`packages/ui/src/styles.css` tem **105 tokens** (96 antes desta spec, mais os 9 da frente B),
dois temas completos (`:root` e
`:root[data-theme="dark"]`), e comentários registrando decisões de contraste AA com histórico
de review de PR. Seis apps o importam (`accounts`, `downloads`, `glossario`, `site`, `links`,
`mesas`), mais `site-admin` por `main.tsx`.

Não é um sistema ausente sendo reinventado por falta de opção. É um sistema presente que os
apps contornam.

### 2. `packages/comments` falava um vocabulário que não existia

O CSS do pacote pedia `--color-surface`, `--color-text`, `--color-text-muted`,
`--color-border`, `--color-warning`, `--color-danger`, `--radius-md` e `--space-3`. Contagem no
monorepo inteiro: **zero definições, para os oito**. Todos caíam nos fallbacks embutidos,
desenhados para fundo claro.

Consequência medida na página real (`mesasbeta`, tema escuro): texto `rgb(23,32,51)` sobre
fundo `rgb(27,42,74)` — **contraste 1.14:1**, contra o mínimo AA de 4.5:1. Dois azuis-escuros
quase idênticos: o texto estava presente e ilegível.

**A prova de que o defeito era do pacote, e não dos apps:** `packages/content-editor`, pacote
irmão usado no mesmo compositor, consome `var(--surface, #111827)` e `var(--line, …)` — o
vocabulário certo. No mesmo formulário, a área de digitação renderizava correta e a moldura em
volta, branca. Dois contratos de tema incompatíveis a um nível de distância no DOM.

### 3. Os apps redefinem os tokens semânticos com valores divergentes

Este é o problema central, e o que ainda não foi resolvido.

| token | `packages/ui` | `site` | `site-admin` | `links` | `mesas` |
|---|---|---|---|---|---|
| `--line` | `rgba(2,7,64,0.14)` | `#e6e8ef` | `#e3e6ef` | `rgba(2,7,64,0.12)` | — |
| `--surface` | `var(--artificio-light-surface)` | `#ffffff` | — | `#ffffff` | — |
| `--fg` | `var(--artificio-light-ink)` | `#020740` | — | — | `#FFFFFF` |
| `--fg-muted` | `rgba(11,18,32,0.66)` | — | — | — | `rgba(255,255,255,0.75)` |

Três cinzas quase iguais para a mesma borda, em três apps. Os valores coincidem hoje; quando
`packages/ui` mudar, **nenhum dos três acompanha** — a sobrescrita local vence.

O comentário em `site/global.css:16` justifica a prática com *"tokens próprios da página (não
conflitam com `--artificio-*`)"*. A afirmação era verdadeira quando foi escrita e **deixou de
ser** quando a spec 022 T8 criou a camada semântica usando exatamente estes nomes. O comentário
envelheceu; a sobrescrita ficou.

### 4. Nem todo literal é dívida — e a primeira contagem estava errada

A contagem inicial apresentada ao mantenedor (**"253 cores literais"**) estava **inflada**: a
expressão contava definição de token (`--accounts-ink: #020740`) como se fosse uso solto.
Recontagem correta: **86 usos reais**, dos quais boa parte é legítima.

Três categorias de literal que **devem permanecer**:

- **Marca de terceiro.** Discord `#5865f2`, Google `#4285f4`, e o fundo branco do "G" do Google
  no botão de login (`accounts/styles.css:225`) — diretriz de marca exige branco em qualquer
  tema. Virar com o tema quebraria a regra de uso do logo alheio.
- **Gradiente decorativo.** Avatares e badges de papel em `ProfileEditPage.css` usam
  `linear-gradient` fixos; o `color: #ffffff` por cima deles é parte da exceção, não dívida.
- **Scrim.** `rgba(0,0,0,*)` sobre imagem.

`ProfileEditPage.css` **já foi padronizado** na spec 022 T8 e documenta essas exceções no
próprio cabeçalho. É trabalho correto, não pendência.

### 5. O Tailwind não enxerga `packages/comments`

Seis apps declaram `@source ".../packages/ui/src/**"`. **Nenhum declara `packages/comments`.**
`site-admin` não declara `@source` nenhum.

Consequência: `CommunityModerationWorkspace` usa `space-y-4`, `p-5`, `rounded border`,
`whitespace-pre-wrap` e `sr-only` — e **nenhuma dessas classes chega a ser gerada**. O caso
grave é `sr-only`: sem ela, o texto do `<output>` destinado a leitor de tela renderiza
**visível** na tela de moderação, em produção no `downloads`.

---

## O que foi feito

Tudo abaixo está no disco, validado, **sem commit**.

### A — `packages/comments/src/styles.css` reescrito

- Oito tokens inventados → vocabulário real (`--surface`, `--fg`, `--fg-muted`, `--line`,
  `--state-warning-fg`, `--state-danger-fg`, `--radius-md`, `--space-3`).
- **Zero cores literais** no arquivo (verificado por busca; as duas ocorrências restantes de
  `#` são texto de comentário).
- Duas classes órfãs ganharam regra: `__empty` (a mensagem de conversa vazia, que aparecia como
  texto apagado sem respiro) e `__edited` (marca de comentário editado).
- `justify-items: start` no grid do compositor. Sem isso, o botão "Publicar comentário" esticava
  para a coluna inteira — **medido em 1841px de largura, fundo `#ffffff`**, enquanto os 10
  botões da barra do editor mediam 44px corretos.
- Hierarquia de botão: `[type=submit]` usa `--btn-primary-*`; antes "Publicar" e "Cancelar"
  recebiam regra idêntica.
- **Hover em 14 botões**, que não tinham nenhum (heurística 1 de Nielsen).
- Um breakpoint para telas estreitas; o arquivo não tinha nenhum.
- CSS do `CommunityModerationWorkspace`, que não existia — incluindo `sr-only` local, para a
  acessibilidade não depender da configuração do scanner do host.

### B — tokens criados em `packages/ui`

| token | por quê |
|---|---|
| `--radius-sm/md/pill` | `packages/comments` pedia `--radius-md`, inexistente. Codificam o que os pacotes já praticavam em literal: `8px`/`0.5rem` domina (42+8 ocorrências), `999px` a pílula |
| `--space-1/2/3/4/6` | mesma origem; escala de 4px, a régua do Tailwind que os apps já usam em `px-4`/`mt-6` |
| `--btn-danger-bg/fg/bg-hover` | `accounts` mantinha `#b42318`/`#8f1d16` soltos para excluir conta, divergindo de `.artificio-button-danger` do próprio design system |
| `--brand-solid` + `--brand-solid-fg` | **`#cf4317` existia três vezes** — duas no `accounts` e uma no badge de notificação do próprio `packages/ui` — cada uma com o mesmo cálculo de contraste reescrito à mão |

`--brand-solid` e `--btn-danger-*` têm variante no bloco `[data-theme="dark"]`: o tom fechado
que passa AA sobre claro some sobre a superfície navy, e o texto por cima inverte junto.

### C — literais duplicados

- **`accounts`:** botão destrutivo e `.accounts-status-{success,error}` tokenizados (os pares
  anteriores eram fixos de tema claro — no escuro viravam tarja clara sobre painel escuro);
  **32 fallbacks `var(--token, #hex)` removidos**, redundantes porque o design system sempre
  carrega.
- **`links`:** `.chip-adult` reescrevia à mão os três valores de `--state-danger-*` **e a troca
  por tema**, com um override `[data-theme="dark"]` duplicando o que o token já faz. Virou uma
  regra, sem override.

### D — geometria das três fachadas de conversa

- **`mesas`:** a `MesaPage` tem **duas** montagens de `TableConversation`. A de mesa encerrada
  (`:216`) já tinha contêiner; a do caso normal (`:343`) estava solta — **1841px de 1856px de
  viewport**, irmã de uma `<section class="container mx-auto px-6">` de 900px. Corrigido.
- **`downloads`:** mesma `<section>` sem classe; escapava por acidente, porque a `MaterialPage`
  a envolve num `div mx-auto max-w-5xl px-4`. Título alinhado à `RatingSection`, irmã direta.
- **`site`:** já tinha `className="post-conversation container"` — era o único dos três correto.
  O `h2` ficava fora de `.prose` e saía no tamanho do corpo; agora entra no mesmo seletor da
  regra existente, **sem duplicar os valores**.

Em todos, o `h2` renderizava a **16px**, igual ao corpo do texto.

### E — grade do catálogo do `mesas`

`repeat(auto-fit, minmax(280px, 1fr))` → `repeat(auto-fill, minmax(280px, 420px))`.

Medido na página real, com sessão do mantenedor, em `?system=call-of-cthulhu` (1 resultado):

| | antes | depois |
|---|---|---|
| card | 1793×1416px | 420×558px |
| proporção | 1.27 | 0.75 (retrato) |
| capa | 79% do card | 47% |

**Correção a uma afirmação anterior:** foi dito ao mantenedor que "a grade está quebrada". Não
está — com 19 mesas ela produz 6 colunas de 282px e proporção 0.54, correto. O defeito só
aparece quando o filtro devolve poucos resultados: `auto-fit` colapsa as trilhas vazias e
reparte a largura entre as que sobram.

### Validação

- `packages/comments`: **216/216 testes**, `tsc --noEmit` limpo
- `apps/mesas/frontend`, `apps/downloads/frontend`, `apps/accounts/frontend`: `tsc --noEmit` limpo
- Verificação visual em `mesasbeta` com sessão real do mantenedor (Playwright)

### O que foi preservado de propósito

A marca d'água vertical `content: "ARTIFÍCIO"` e a composição
`radial-gradient` + `linear-gradient` de `.accounts-page` seguem **intactas** — o mantenedor
sinalizou que devem ficar, e nenhuma edição tocou fundo de página.

---

## O que precisa ser feito

### F — desfazer a redefinição de tokens semânticos ⛔ decisão do mantenedor

Remover as ~40 definições locais que sobrescrevem `--surface`, `--fg`, `--fg-muted`, `--line` e
`--surface-strong` em `site`, `links`, `site-admin` e `mesas`, deixando todos herdarem de
`packages/ui`.

**Por que está bloqueado, e não é preguiça.** Tecnicamente é simples — é apagar definições. O
problema é que **cada app muda de aparência em algum grau**: o `--line` do `site` fica levemente
mais azulado, o do `site-admin` também. Os apps atingidos são o blog em produção na raiz
`artificiorpg.com`, o `links`, o `site-admin` e o SSO.

Isso exige conferência visual do mantenedor app por app — não é trabalho para fazer e mostrar
depois. **Ordem sugerida:** `links` (menor exposição) → `site-admin` → `site` → `accounts`
(SSO por último, exige smoke de todos os consumidores).

**Alternativa, se o mantenedor preferir menor risco:** manter as definições locais mas fazê-las
**derivar** do token do design system (`--line: var(--artificio-line)`) em vez de repetir o
valor. Uniformiza a fonte da verdade sem mudar pixel algum hoje, e faz os apps acompanharem
mudanças futuras. É reversível e verificável por busca.

### G — `packages/comments` fora do scanner do Tailwind ⛔ decisão do mantenedor

O CSS do workspace de moderação foi escrito no próprio pacote (frente A), então **a tela não
está mais sem estilo**. Mas a causa segue: qualquer classe utilitária nova em
`packages/comments` continuará não sendo gerada, silenciosamente.

Duas saídas, com custos diferentes:

- **`@source` nos apps consumidores** — três arquivos de host precisam permanecer sincronizados;
  esquecer um reintroduz o defeito sem erro visível.
- **Manter CSS próprio no pacote** (o que está feito) — o pacote se sustenta sozinho, mas
  duplica utilitárias que o Tailwind já sabe gerar.

Recomendação: a segunda, por não depender de sincronia entre hosts. Fica registrado que a
escolha é do mantenedor.

### H — literais restantes fora do `accounts`

~10 usos, em `MestrePage.css` (1), `PlayerPage.css` (1), `mesas/index.css` (1) e os
`color: #fff` sobre `--brand` no `links`. Trabalho mecânico, baixo risco, não bloqueado —
apenas não foi feito nesta sessão.

### I — achados laterais, não tratados

- **`downloads` dispara retry inútil.** Seis `POST /api/auth/refresh` em sequência e
  `GET /api/v1/favorites` repetindo em backoff (1.2s, 3.3s, 7.3s), todos `401`, em sessão
  anônima que nunca vai autenticar. Medido no console; fora do escopo desta spec.
- **`/catalogo` do `mesas` exige login em beta.** Duas navegações anônimas foram redirecionadas
  para o OAuth do Google. Deveria ser página pública — é a vitrine do projeto. **Não
  investigado**, apenas medido.

---

## Fora de escopo

- Redesenho visual dos apps. Esta spec uniformiza a **fonte** dos valores, não os valores.
- Migração dos literais legítimos (marca de terceiro, gradiente decorativo, scrim).
- `ProfileEditPage.css`, já padronizado na spec 022 T8.

## Erros de método cometidos nesta auditoria

Registrados porque o mantenedor cobrou o método, não só o resultado.

1. **Primeira contagem inflada** (253 → 86): a expressão contava definição de token como uso
   solto. Número errado apresentado ao mantenedor antes de ser conferido.
2. **Afirmação mais ampla que a medição** ("a grade está quebrada", quando só degrada com
   poucos resultados).
3. **Diagnóstico raso na primeira rodada.** A primeira entrega tratou o defeito como "faltam
   tokens" e parou; o mantenedor respondeu *"acho que tá pouco"*, e a investigação mais funda
   encontrou seis defeitos adicionais — classes órfãs, workspace sem CSS, ausência de hover,
   botões sem hierarquia.
4. **Duplicação cometida durante a própria correção:** ao estilizar o `h2` do `site`, os valores
   `28px`/`14px` foram copiados de `.prose h2` para uma regra nova — exatamente o vício que a
   spec combate. Corrigido para um seletor único antes da entrega.
