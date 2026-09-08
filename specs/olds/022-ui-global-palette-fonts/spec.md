# 022 — Paleta e fontes globais (light/dark) via tokens semânticos únicos

- **Módulo/Pacote:** `packages/ui` + `apps/mesas` + `apps/glossario` + `apps/accounts` (alinhamento) + `apps/site` (referência/modelo)
- **Gate relacionado:** nenhum (SDD Completo por tocar `packages/*` e múltiplos apps)
- **Spec base:** continuação de **020 — Theme Artifício padrão** (que documentou contrato de tokens, consolidação de tema e primitives, mas **não executou a migração de runtime**). Esta spec é a **execução da migração de cor/fonte** dos apps para a fonte única.

## Princípio: UNIFICAÇÃO (modelo "aquisição") — atualizado 2026-06-14

mesas e glossário foram desenvolvidos em **momentos diferentes**, cada um com seu próprio mapa de
cores, padrão de botão e fontes. Esta spec trata o momento como uma **unificação**: como se os dois
módulos tivessem sido **adquiridos pelo Artifício** e agora **adotam o mapa de cores e os padrões do
Artifício** — uma revisão que unifica **cor de tudo** (texto, superfície, **botões**, **estados**) e
**fontes** sob a fonte única `packages/ui`. Não é só virar tema light/dark: é **convergir os dois
produtos ao mesmo design system**. Onde houver divergência (botão navy aqui, azul-médio ali, tint de
badge próprio), a regra é **unificar no padrão Artifício**, não preservar o legado de cada app.

## Problema

A paleta global (light/dark) e as fontes **já existem como fonte única** em `packages/ui` (`tokens.ts` → `styles.css`, expostas como CSS vars `--artificio-*`, importadas por mesas/glossário/site). **Mas os componentes dos apps não consomem esses tokens:** usam utilities Tailwind **cruas e theme-específicas** (`text-white`, `bg-white/NN`, `border-white/NN`, `bg-[#13213f]`, `text-gray/slate/purple-NNN`) que assumem um único tema, e cada app aplica um **remap por-app** em `index.css` para "consertar" o tema oposto.

Consequências medidas (2026-06-14):
- **mesas** (dark-default): ~**1091** `text-white`, **407** `bg-white/*`, **378** `border-white/*`, **87** `bg-[#hex]`, **24** `text-purple-*`, **18** `text-gray/slate-*`, **9** `bg-gray/slate-*` em **134** arquivos `.tsx`. Light é simulado por um remap de **77 linhas** `[data-theme="light"]` em `index.css` — **incompleto**: não cobre `gray/slate/purple` nem várias classes próprias. Resultado real: a **página de perfil do mestre (MestrePage)** em light fica com texto branco/baixo contraste invisível ("MESTRE", "PLATAFORMAS QUE USO", "Conteúdo/Presença/Autoridade", botões "Marcar como encerrada"/"Arquivar", contorno de card) — bug B7 residual.
- **glossário** (light-default): ~**65** `text-white`, **177** `text-gray/slate-*`, **95** `bg-white/*`, **18** `bg-gray/slate-*`, **7** `border-white/*` em **24** `.tsx`. Dark é simulado por um remap de **94 linhas** `[data-theme="dark"]`.
- Os dois remaps são **divergentes** (mesas remapeia branco→ink; glossário remapeia cinza→claro) e usam **rgba hardcoded** em vez dos tokens globais → não há paridade nem fonte única real de tema.
- **Fontes:** `--artificio-font-display` (Oswald) e `--artificio-font-sans` (Inter) existem, mas as classes `font-display`/`font-sans` aparecem só **~1x por app**; os apps dependem do `font-family` do body. Aplicação de Oswald em headings é inconsistente.

**Modelo correto já existe e está validado no `site` (Astro):** componentes referenciam **vars semânticas** (`--bg`, `--surface`, `--fg`, `--muted`, `--line`) e o tema vira essas vars via `[data-theme="dark"]`. Nenhum remap de utility, nenhuma suposição de tema no componente.

## Requisitos (numerados, testáveis)

- **R1** — `packages/ui` deve expor um **conjunto de vars semânticas de tema** (ex.: `--fg`, `--fg-muted`, `--surface`, `--surface-subtle`, `--surface-strong`, `--canvas`, `--line`, `--fill`, + estados `success/warning/danger/info`) que **viram por `[data-theme="light"|"dark"]`**, derivadas dos tokens existentes (`--artificio-light-*`/`--artificio-dark-*`/semânticos). Verificável: as vars existem em `styles.css`, têm valor em ambos os temas, e a paridade de nomes é travada por script (estender `check-token-parity.mjs`).
- **R2** — Definir o **mapeamento canônico** "utility crua → token semântico" (ex.: `text-white`→`color:var(--fg)`; `bg-white/NN`→fill; `border-white/NN`→`--line`; `bg-[#navy]`→`--surface*`; `text-gray/slate/purple-*`→`--fg-muted`/acento). Verificável: documento de mapeamento em `plan.md`/anexo, sem ambiguidade.
- **R3** — **mesas** deve renderizar **light e dark** consumindo as vars semânticas globais, **sem** o remap por-app de 77 linhas (removido ou reduzido a zero regras de cor). Verificável: build verde; a MestrePage em light tem todos os textos/*botões*/bordas com **contraste AA (≥4.5 texto / ≥3 não-texto)**; smoke visual das rotas operacionais.
- **R4** — **glossário** deve renderizar **light e dark** consumindo as mesmas vars, **sem** o remap por-app de 94 linhas. Verificável: build verde; AA em ambos os temas nas telas (home, cards, admin, forms).
- **R5** — **Fontes globais aplicadas de forma sistemática**: corpo = Inter, headings = Oswald, via tokens/classe única de `packages/ui`, sem `@import`/`font-family` cru divergente por app. Verificável: headings renderizam Oswald em mesas/glossário/site; uma única fonte de `@import`/`<link>` de fonte.
- **R6** — **Defaults de tema preservados** por produto: mesas = **dark** (sem cookie), glossário = **light** (sem cookie), conforme D065/D066/D067. A migração **não muda** o default; só corrige o tema oposto. Verificável: boot sem cookie mantém o default atual em cada app.
- **R7** — **accounts** alinhado: importar a fonte única de tokens/tema de `packages/ui` (hoje usa `styles.css` próprio e não importa `@artificio/ui/styles.css`) **ou** ficar explicitamente documentado como exceção. Verificável: decisão registrada + (se migrado) accounts consome as vars globais.
- **R8** — **Paridade e anti-regressão**: nenhum consumidor de `packages/ui` quebra. `turbo build` 13/13, testes existentes verdes, `check-token-parity` verde, smokes por app (mesas/glossário/site/accounts) em **beta antes de prod**.

## Critérios de aceite

1. mesas e glossário renderizam **os dois temas** a partir das vars semânticas globais; os remaps por-app de cor em `index.css` foram **removidos** (ou reduzidos a exceções documentadas e mínimas).
2. A **MestrePage light** (caso-gatilho) passa AA em todos os elementos reportados.
3. Fontes (Inter/Oswald) aplicadas por fonte única; Oswald presente nos headings dos 3 apps.
4. Defaults de tema por app inalterados (mesas dark / glossário light).
5. `turbo build` 13/13, parity verde, testes verdes, smokes beta verdes; WP raiz intocado.
6. Tudo promovido só com autorização nominal por ação (REGRA PÉTREA).

## Fora de escopo

- **Não** redesenhar layout, copy ou regra de negócio — só a **camada de cor/fonte/tema** (inclui
  unificar a **cor/estado dos botões** e as **fontes** ao padrão Artifício; ver Princípio: Unificação).
- **Estrutura** de primitives/recipes (Button/Field/Modal como componentes React reutilizáveis) segue
  na T14 da Spec 020. A 022 unifica a **cor/estado/fonte** desses elementos via tokens (ex.: token de
  botão primário `--btn-primary-*`), mesmo que o markup continue usando classes/utilities por ora.
- **Não** mexer no runtime de tema (`theme.tsx`, cookie `artificio_theme`) além do necessário para virar as vars — a consolidação de runtime é a Spec 020 T5.
- **Não** tocar `apps/site` markup além de confirmar que ele já é o modelo (pode receber só alinhamento de nomes de var, se necessário).
- **Não** mudar o laranja de marca (D064 `#FF5722`) nem reabrir D-MARCA2/D040.

## Riscos e impacto em outros módulos

- **`packages/ui` é compartilhado** → mudança aditiva de vars é segura; **remover** algo exige checar os 3 apps. Smoke obrigatório em todos os consumidores.
- **Volume mesas (~2000 ocorrências)** → risco de regressão visual no app operacional em prod (dark é o default vivo). Migração **faseada e por área**, com smoke a cada fatia; default-dark deve permanecer pixel-igual.
- **Cascata Tailwind v4 (mesas) vs v3 (glossário)** → as duas engines tratam `@layer`/especificidade diferente; o mapeamento precisa funcionar nas duas (validar caso a caso).
- **AA**: o erro clássico (B7) é o tom brilhante passar no escuro e falhar no claro — usar as variantes `*Text` dos tokens semânticos para texto/ícone.
- **Auth/SSO**: accounts é sagrado; se migrado, testar login E2E.
- **Sem big-bang**: cada app/fatia em branch própria → PR → beta → validação → prod, com autorização nominal.
