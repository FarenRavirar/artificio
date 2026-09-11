# 081 — Mesas: paridade StartPlaying (catálogo, mesa, review e GM stats)

- **Módulo/Pacote:** apps/mesas + packages/ui (SDD Completo)
- **Gate relacionado:** D (mesas já fechado; esta spec é evolução pós-Gate D)
- **Referência externa:** https://startplaying.games (search + página de adventure), screenshots anexados na sessão de abertura
- **Método:** auditoria visual completa primeiro (`auditoria-visual.md`, 34 achados catálogo+página de mesa+dado sujo), decisão item-a-item com o mantenedor (`decisoes-auditoria.md`), só depois consolidação em tasks (`tasks.md`, T1-T9).

> **Nota de recuperação (2026-07-18):** este `spec.md` foi reconstruído a partir do texto de `tasks.md` recuperado pelo mantenedor no chat, depois que a pasta `specs/081-*/` nunca chegou a ser criada durante a implementação real (PR #179, #178→dev) — commits citavam "spec 081" sem o artefato correspondente existir. Ver `BL-MESAS-CATALOGO-SELOS-DUP` em `specs/backlog.md` para o achado que revelou a lacuna. `auditoria-visual.md` e `decisoes-auditoria.md` citados abaixo **não foram recuperados** — só o conteúdo de `tasks.md` foi resgatado.

## Problema

Mesas hoje cobre listagem de mesas, perfil de GM, contato/favorito/view (telemetry), e catálogo com filtros. Comparado ao StartPlaying (referência de mercado para marketplace de mesas de RPG), o catálogo e a página de mesa têm layout pior organizado (Mesas: container centralizado + filtros empilhados verticalmente; StartPlaying: full-bleed + filtro horizontal), informação já existente mas mal hierarquizada (preço/vagas com pouco destaque visual, card do mestre duplicado, sidebar sem hierarquia), e faltam elementos de confiança do jogador (review estruturado do GM, GM stats de credibilidade calculáveis, selo de mesa paga em destaque).

Esta spec varre, feature a feature, o que existe no StartPlaying e não existe (ou existe parcial) no Mesas, decide o que entra, e implementa o que for aprovado.

**Regra pétrea desta spec:** nada foi ignorado por "já existir" — auditoria cobriu elemento a elemento, mesmo quando o dado já existia no schema, para decidir separadamente se a APRESENTAÇÃO visual precisava mudar.

**Decisão do mantenedor (2026-07-17):** seguir GM, badge "Top GM" e mensagem direta ao GM **não entram** — fora de escopo definitivo (descartado, não reavaliar). Review estruturado do GM **entra**, restrito a usuários registrados/logados (sem review anônimo).

**Achado de investigação (2026-07-17, confirmado no código antes de perguntar):** preço (`PricePanel`), vagas em texto (`QuickInfoPanel` "X disponíveis") e safety-tools/content-warnings (`TableSecurity.tsx`) **já existem e já renderizam** na página da mesa hoje — não são gap de dado, são gap de **destaque visual** (StartPlaying usa badge verde no topo tipo "2 SEATS LEFT"; Mesas só mostra texto discreto na sidebar). O gap real de **dado que não existe em nenhuma coluna hoje** é: GM stats de credibilidade (anos na plataforma, nº mesas hospedadas) e review estruturado com tags de proficiência.

## Escopo aprovado (consolidado em `tasks.md`)

- **T1 — Fusão Home+Catálogo.** `/` deixa de ser landing separada e passa a renderizar o catálogo completo; hero/sugestões migram pro topo do catálogo fundido.
- **T2 — Layout do catálogo.** Full-bleed, filtros em barra horizontal (chips), filtro de Estilos com scroll horizontal, remove contagem duplicada, paginação vira scroll infinito.
- **T3 — Card do catálogo.** Badge de vagas sobre a imagem, "X/Y preenchidas", preço em destaque, horário da sessão no card, favoritar (bookmark), rating do GM (depende de T8).
- **T4 — Hero/breadcrumb da página de mesa.** Breadcrumb "Home › Sistema › Mesa" rente ao título; título antes da imagem de capa; remove vagas duplicada.
- **T5 — Conteúdo e formulário.** Redesenha Horários das Sessões; corrige formulário de cadastro para guiar preenchimento do campo estruturado de estilo; normaliza duplicatas de dado sujo no banco; descrições em safety tools; destaque nos ícones de requisitos técnicos.
- **T6 — Card do Mestre unificado.** Elimina duplicação (`TableMaster`+`MasterCard` mostrando a mesma coisa 2x); aparece também para mesa anunciada por terceiro; hierarquia visual forte na sidebar; aviso de cobrança no CTA para mesa paga; "Copiar anúncio" inclui horário/data; botão "Denunciar mesa" novo.
- **T7 — Bug de tema claro.** Toggle "Alternar tema" não funciona na página de mesa (confirmado em teste real) — corrigir causa raiz antes de declarar suporte a tema claro.
- **T8 — Review estruturado do GM.** Tags de proficiência fixas curadas, só usuário logado avalia, lista completa de reviews + agregação, mora principalmente no perfil `/mestre/{slug}`.
- **T9 — GM stats calculáveis + selo mesa paga.** "Anos na plataforma"/"mesas hospedadas" calculados (distintos do campo `experience_years` autodeclarado já existente); selo de mesa paga em destaque visual.

**Decisão de escopo final (2026-07-17):** todas as fases acima entram **numa única leva de implementação** (não fase-a-fase isolada como inicialmente combinado — mantenedor preferiu consolidar). GM stats de credibilidade = só o **calculável** a partir de dado existente (`created_at` do usuário GM + `count(tables)` do GM) — **tempo/taxa de resposta fica fora** (exigiria rastrear thread de contato, que não existe e não será criado, dado que mensagem direta foi descartada).

## Requisitos (aprovados)

1. **Seats-count em destaque visual** (badge tipo "X/Y vagas" ou "N vagas restantes" destacado no card do catálogo e no hero da página de mesa) — dado já existe (`slots_total`/`slots_filled`/`slots_open`), só falta exibição em destaque.
2. **Review estruturado do GM**: nota geral + tags de proficiência (ex.: Beginner Friendly, Storytelling, Knows the Rules), com contagem por tag. **Só usuário registrado/logado pode avaliar** (sem review anônimo) — dado novo, entidade nova.
3. ~~Safety tools / content warnings~~ — **já implementado e renderizando** (`TableSecurity.tsx`), sem gap; incluído só na reorganização visual (posição/destaque) se a fase 5 achar que precisa mover.
4. **Selo "mesa paga"** em destaque visual — dado já existe (`price_type`/`price_value`), só falta selo/badge equivalente ao seats-count.
5. **GM stats calculáveis**: anos na plataforma (`created_at` do usuário) + nº de mesas hospedadas (`count(tables)` do GM) exibidos no `MasterCard`/perfil do GM. Sem tempo/taxa de resposta.
6. **Reorganização visual da página de mesa/GM** — info que já existe hoje (`TableActionPanel`, `TableSecurity`, `MasterCard`) mas está discreta/mal hierarquizada; layout revisado à luz da referência StartPlaying (estrutura de informação, não cópia de estilo).

## Descartado (decisão definitiva, não reavaliar)

- Seguir GM (follow).
- Badge "Top GM" / destaque de reputação.
- Mensagem direta ao GM (thread/inbox).
- "Meet your party members" (exigiria sistema de RSVP/inscrição, mudança de modelo de produto).
- Tags de perfil do mestre tipo pronome/LGBTQ+/Voice Actor (StartPlaying tem, não entra aqui).

## Critérios de aceite

- Por fase: decisão registrada em sessão (`entra` com escopo definido, ou `não entra` com motivo) antes de qualquer código.
- Endpoint/schema novo (`apps/mesas/backend`) passa por `pnpm verify:api`.
- Componente novo/alterado em `packages/ui` documentado (variantes/estados).
- Build/lint/test de `apps/mesas` e `packages/ui` verdes antes de fechar cada task.
- Nenhuma task quebra contrato SSO/auth existente.
- Migration de normalização de dado sujo (T5.3) documenta antes/depois e não apaga dado sem confirmação.
- Toda mudança de T1-T9 rastreável até um achado específico de `auditoria-visual.md`/`decisoes-auditoria.md` (arquivos não recuperados nesta reconstrução).

## Fora de escopo

- Processar cobrança dentro da plataforma (checkout/pagamento próprio) — Mesas continua gratuito, selo de mesa paga é só indicador informativo, cobrança acontece fora (GM cobra por fora do site).
- Scraping ou automação contra startplaying.games — é só referência visual/funcional, não fonte de dados.
- Sistema de RSVP/inscrição de jogador em mesa (bloqueador de "party members").

## Riscos e impacto em outros módulos

- `packages/ui`: componente(s) novo(s) (badge seats/preço, rating+tags+reviews, hierarquia de sidebar) tornam-se reusáveis por outros projetos (glossario/site) — exige documentação e não-regressão dos consumidores atuais do pacote.
- Migration nova em `apps/mesas/database` para review (T8.2), favoritos (T3.6) e normalização de estilo (T5.3) — segue checklist de migration do `AGENTS.md` (5 campos de header).
- `packages/auth`/`accounts.` podem ser tocados se necessário (guard `auth=user` do review usa infraestrutura já existente via `@artificio/auth`) — se precisar mudança real no pacote, exige aprovação própria + SDD Completo + smoke da matriz mínima (login/me/logout + consumidores SSO) antes de fechar.
- Fusão Home+Catálogo (T1) remove rota/página existente — checar links internos/externos apontando para comportamento antigo de `/`.
