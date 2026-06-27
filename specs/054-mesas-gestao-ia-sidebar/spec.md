# 054 — Reorganização da `/gestao` do mesas: sidebar persistente + nova arquitetura de informação + renomeações

- **Módulo/Pacote:** `apps/mesas/frontend` (painel `/gestao`) — primário; possível extração de primitivas de navegação (sidebar/breadcrumb) p/ `packages/ui`; sem mudança de contrato de backend (renomeações são de **rótulo/UX**, não de rota/API salvo onde explicitado).
- **Gate relacionado:** D (mesas em prod) — UX/admin, não destrava gate.
- **Tipo:** **SDD Completo** (reorganização grande de UI + possível toque em `packages/ui` + **rename ampliado a identificadores técnicos** → pode tocar contrato de API/enum persistido, exigindo migration). Blast radius e superfície de contrato confirmam Completo.
- **Origem:** mantenedor 2026-06-27 — proposta de IA (arquitetura de informação) completa para o admin de mesas. A `/gestao` cresceu para 6 abas-topo + subabas heterogêneas (049 refatorou o código, não a IA); rótulos ambíguos ("Sistemas", "Hidratação", "Inbox", "Apurar") e mistura PT/EN.
- **Autor do plano:** Claude Code. **Implementação:** a definir (autorização nominal por ação).
- **Status:** Fases 1-4 implementadas localmente (código presente, não mergeado). Aguarda aprovação do mantenedor para fechar.
- **Coordenação:** **054 é GATE DE BLOQUEIO** (ver §Spec 054 = GATE DE BLOQUEIO abaixo). **053 Frente A** (a11y/UI da gestão) é quem depende/bloqueada pela 054 — roda depois sobre a estrutura nova. As demais frentes da 053 seguem livres.

> **Nota de governança:** este `spec.md` descreve **o quê e por quê** (IA-alvo + requisitos testáveis). A solução técnica (componentes, rotas, CSS, extração p/ `packages/ui`) vive em `plan.md`/`tasks.md`.

---

## Problema

O `/gestao` hoje usa **abas horizontais no topo** com subabas dentro de cada uma. Estado atual real (ancorado no código, 2026-06-27):

| Aba-topo atual | Subabas/conteúdo atual |
|---|---|
| **Gerenciar Conteúdo** | Sistemas, Plataformas (VTT/Comunicação), Cenários, Mesas |
| **Sugestões de Sistemas** | sugestões da comunidade |
| **Hidratação de Dados** | `HydrationAdminPanel` |
| **Discord Sync** | Configuração, Fontes, Mensagens, Drafts, Importar JSON |
| **Inbox** | feedbacks/denúncias/solicitações (`InboxPanel`) |
| **Desenvolvimento** | ferramentas/dev |

Problemas: (1) abas-topo não escalam (já são 6 + subabas); (2) rótulos ambíguos — "Sistemas" parece sistema técnico, não sistema de RPG; "Hidratação" é jargão; "Inbox"/"Drafts"/"Apurar" misturam idioma/verbos; (3) ações com verbos inconsistentes p/ operações parecidas; (4) Discord captura/drafts e a fila de revisão (inbox + discord) vivem em lugares diferentes sem um hub de moderação único (a 049/DEB-048-34 já começou a unificar a fila no backend).

**Sugestão principal do mantenedor (norte do redesign):** transformar as abas-topo em **menu lateral persistente (sidebar)**; subabas viram **subnavegação local dentro da página**. Resolve a confusão visual e escala.

---

## Arquitetura de informação alvo (canônica)

Layout: **Sidebar fixa à esquerda** + **Área principal** (header contextual → breadcrumb → ações principais → subnavegação local → conteúdo).

**Subseções: versão DETALHADA (decisão 2 do mantenedor).**

```
Gestão Administrativa
├── Dashboard
│   ├── Visão geral
│   ├── Pendências
│   ├── Últimas atividades
│   ├── Alertas
│   └── Atalhos rápidos
├── Conteúdo
│   ├── Sistemas de RPG
│   ├── Plataformas
│   │   ├── VTTs
│   │   └── Comunicação
│   ├── Cenários
│   └── Mesas
├── Comunidade
│   ├── Sugestões recebidas
│   ├── Sugestões aprovadas
│   ├── Sugestões rejeitadas
│   └── Histórico de decisões
├── Moderação
│   ├── Fila de revisão
│   ├── Mensagens capturadas
│   ├── Rascunhos gerados
│   ├── Itens ignorados
│   └── Itens conferidos
├── Integrações
│   ├── Discord
│   │   ├── Configuração
│   │   ├── Canais monitorados
│   │   ├── Mensagens capturadas   (link → Moderação; painel não duplica)
│   │   ├── Rascunhos              (link → Moderação)
│   │   └── Importar histórico
│   ├── Importação de dados
│   ├── Enriquecimento de dados
│   └── Logs de integração
├── Caixa de entrada
│   ├── Feedbacks
│   ├── Denúncias
│   ├── Solicitações
│   ├── Pendentes
│   ├── Resolvidos
│   └── Arquivados
└── Sistema
    ├── Feedbacks técnicos
    ├── Erros reportados
    ├── Jobs e filas
    ├── Logs
    ├── Configurações
    └── Ferramentas de desenvolvimento
```

> Itens sem backend ainda (Dashboard widgets, Logs de integração, Jobs e filas, Erros reportados) = estrutura + stub honesto, materializados incrementalmente. Pendências/Resolvidos/Arquivados etc. podem ser **filtros de status** sobre a mesma fonte quando fizer sentido, não necessariamente telas separadas.

### Mapa de renomeações (rótulo atual → novo)

| Atual | Novo | Observação |
|---|---|---|
| (sem dashboard) | **Dashboard** | NOVO. Visão geral, pendências, últimas atividades, alertas, atalhos. |
| Gerenciar Conteúdo | **Conteúdo** | grupo |
| Sistemas | **Sistemas de RPG** | desambiguar (não é sistema técnico) |
| Plataformas VTT | **VTTs** | sub de Plataformas |
| Plataformas de Comunicação | **Comunicação** | sub de Plataformas |
| Cenários / Mesas | Cenários / Mesas | mantêm |
| Sugestões de Sistemas | **Comunidade › Sugestões** | "sugestões da comunidade" (não só sistemas) |
| Discord Sync | **Integrações › Discord** | "Integração Discord" |
| Fontes | **Canais monitorados** | |
| Mensagens | **Mensagens capturadas** | |
| Drafts | **Rascunhos** | |
| Importar JSON | **Importar histórico** | |
| Hidratação de Dados | **Enriquecimento de dados** | jargão → claro |
| Inbox | **Caixa de entrada** | PT puro |
| Desenvolvimento | **Sistema › Desenvolvimento** | "Desenvolvimento" vira subitem de "Sistema" |
| Apurar | **Revisar** | ação |
| Apurar todas pendentes | **Revisar pendências** | ação |
| Mandar para revisão | **Enviar para revisão** | ação |
| Marcar conferida | **Marcar como conferida** | ação |
| Ignorar | **Ignorar mensagem** | ação |

### Padrão de botões (consistência de verbos)

- Primária: `+ Novo` / `Criar` / `Salvar`
- Secundária: `Editar` / `Recarregar` / `Selecionar arquivo`
- Destrutiva: `Excluir` / `Remover`
- Estado: `Ativar` / `Desativar`
- Revisão: `Enviar para revisão` / `Marcar como conferido` / `Ignorar`

Mesma ação ⇒ mesmo verbo em todo o painel.

---

## Decisões fechadas pelo mantenedor (2026-06-27)

1. **Moderação × Integrações/Discord — RESOLVIDO (recomendado).** **Moderação = fila de revisão transversal** (drafts de Discord + Inbox unificados — reaproveita 049/DEB-048-34, filtro por origem); **Integrações/Discord = configuração + canais + importação**. Painel de mensagens/rascunhos renderiza **uma vez** (Moderação); Integração linka contextualmente. Sem duplicação.
2. **Subseções — ADOTAR O DETALHADO.** Usar as versões completas, não as enxutas:
   - **Comunidade:** Sugestões recebidas / Sugestões aprovadas / Sugestões rejeitadas / Histórico de decisões.
   - **Caixa de entrada:** Feedbacks / Denúncias / Solicitações / Pendentes / Resolvidos / Arquivados.
   - **Dashboard:** Visão geral / Pendências / Últimas atividades / Alertas / Atalhos rápidos.
   - **Sistema:** Feedbacks técnicos / Erros reportados / Jobs e filas / Logs / Configurações / Ferramentas de desenvolvimento.
   - **Moderação:** Fila de revisão / Mensagens capturadas / Rascunhos gerados / Itens ignorados / Itens conferidos.
   - Itens sem backend ainda = estrutura + stub honesto ("em breve"), nunca dado falso.
3. **Roteamento — MIGRAR para rotas aninhadas.** `/gestao/<grupo>/<sub>` (React Router nested), `aria-current` na ativa, deep-link/refresh/breadcrumb reais. Fim do estado-de-aba interno.
4. **Renomeação — AMPLIAR para identificadores técnicos (não só texto).** Decisão do mantenedor: renomear **também** os identificadores internos (valores de `tab`, enums, nomes de rota/chaves de estado, nomes de componente/arquivo, ids de teste) para casar com a nova IA — **agora**, p/ não gerar retrabalho/pesquisa futura com nomes velhos espalhados.
   - ⚠️ **GOVERNANÇA/IMPACTO:** isto deixa de ser "só UI". Onde um identificador é **contrato externo** (rota de API consumida pelo frontend, **enum persistido em DB/JSONB**, payload trafegado), o rename vira **mudança de contrato** → **SDD Completo no backend + migration quando houver valor em banco + atualização atômica de todos os consumidores no mesmo PR**. Identificadores **internos do frontend** (estado, nome de componente/arquivo, `tab` local, testid) renomeiam livremente.
   - **Regra de segurança do rename:** Fase 0 classifica cada identificador em (a) **interno-FE** (renomeia direto), (b) **contrato FE↔BE sem persistência** (renomeia rota+consumidor no mesmo PR), (c) **valor persistido** (enum/coluna/JSONB em DB) → rename **só com migration** (ou alias/compat + backfill), aprovação nominal, guard online-safe (spec 050). **Nada de renomear valor de banco sem migration** (regra pétrea de banco). Onde o custo/risco do rename de persistência não compensar, registrar como débito explícito em vez de quebrar.

---

## Revisão pós-investigação de código (2026-06-27) — SUPERA partes da IA acima

> Auditoria independente contra o código real (detalhe em `tasks.md` §D) achou que parte da IA-alvo estava ancorada em backend inexistente/errado. Decisões do mantenedor que **superam** os trechos afetados:

- **Moderação = 2 entidades reais, não 5 subitens** (supera a sub-árvore "Moderação" de 5 itens). Pipeline do banco tem 2 estágios:
  - **Mensagens capturadas** (`discord_import_messages`, Discord-only; status `pending/parsed/needs_review/ignored/synced/error`) — triagem. "Ignorados/Conferidos" são **filtros** desta visão, não telas.
  - **Rascunhos** (`discord_import_table_drafts`, **unificado Discord+Inbox** via `discord-sync/drafts?origin=all`; origem = FK não-nulo, NÃO `source_type`) — revisão/sync. Filete de origem vive aqui.
- **"Caixa de entrada" DERRUBADO** (supera o grupo de 6 subitens): `InboxPanel` é inbox de **importação de mesas**, não caixa de feedback; denúncia/solicitação/feedback de usuário **não têm backend** (só `dev-feedback`). Desmembrado: Importar→Integrações›Importação; Drafts→Moderação›Rascunhos; dev-feedback→Sistema. **7 grupos → 6.** Caixa real de feedback = spec futura.
- **Dedup obrigatório:** `InboxDraftReviewTable`+`DiscordDraftReviewTable` (quase clones) colapsam em um `DraftReviewTable` (`origin=all`).
- **`source_type` NÃO é eixo de origem da fila** (só vale `manual_paste`; Discord vive em `discord_import_messages`). Origem derivada do FK.

## Requisitos (numerados, testáveis)

- **R1 — Sidebar persistente.** Navegação principal vira sidebar fixa à esquerda com os 7 grupos (Dashboard, Conteúdo, Comunidade, Moderação, Integrações, Caixa de entrada, Sistema). Abas-topo removidas.
- **R2 — Subnavegação local.** Cada grupo expõe sua subnavegação dentro da área principal (não no topo global).
- **R3 — Header contextual + breadcrumb.** Área principal mostra header da tela atual + breadcrumb (ex.: `Conteúdo / Plataformas / VTTs`) + zona de ações principais.
- **R4 — Renomeações aplicadas (rótulo + identificadores).** Rótulos da tabela trocados (sem PT/EN misturado) **e** identificadores técnicos alinhados à nova IA (decisão 4): internos-FE renomeados direto; contrato FE↔BE renomeado com consumidor no mesmo PR; valor persistido (enum/DB/JSONB) só via migration + aprovação nominal + guard online-safe (ou débito explícito se não compensar). Nenhum estado quebrado/inconsistente pós-rename.
- **R5 — Padrão de botões.** Verbos padronizados por tipo de ação em todo o painel; mesma ação ⇒ mesmo rótulo.
- **R6 — Moderação unificada.** Fila de revisão única (Discord + Inbox) reaproveitando o filtro por origem da 049/DEB-048-34; sem duplicar o painel de mensagens/rascunhos em dois grupos (ver Decisão 1).
- **R7 — Dashboard.** Tela inicial com visão geral/pendências/atividades/alertas/atalhos (widgets podem ser incrementais; placeholders rotulados "em breve" são aceitáveis na 1ª onda, sem texto morto enganoso).
- **R8 — Acessibilidade herdada da 053.** A sidebar e a navegação respeitam o que a 053 Frente A endereça (foco visível, teclado, `aria-current` na navegação ativa, roles). **Não** regredir a a11y.
- **R9 — Tema/design system.** Cores via tokens semânticos (`packages/ui`), nada hardcoded; primitivas (`Button`/`Badge`) do design system; se sidebar/breadcrumb virarem compartilháveis, extrair p/ `packages/ui` (SDD Completo).
- **R10 — Deep-link/refresh.** (se Decisão 3 = rotas) cada tela tem URL própria; refresh/voltar funcionam; estado preservado coerente.

## Critérios de aceite

1. Sidebar persistente substitui as abas-topo; subnavegação local funciona nos 7 grupos.
2. Renomeações de rótulo **e** de identificadores aplicadas conforme a classificação da Fase 0; contratos persistidos só renomeados via migration (ou débito explícito registrado); nenhum consumidor órfão de nome velho.
3. Fila de moderação unificada sem painel duplicado.
4. Padrão de botões consistente verificado em varredura.
5. a11y não regride (checagem de teclado/foco/`aria-current`); validação proporcional à 053.
6. `pnpm run lint` + `pnpm run build` verdes; testes de `GestaoPage` atualizados (os atuais checam os rótulos antigos — devem ser migrados).
7. Smoke visual do mantenedor em beta antes de prod.
8. ~~Decisões em aberto~~ — **fechadas pelo mantenedor 2026-06-27** (ver §Decisões fechadas): 1=recomendado, 2=detalhado, 3=rotas aninhadas, 4=rename ampliado a identificadores. Implementação pode prosseguir conforme elas.

## Fora de escopo

- **Mudança de _lógica_ de negócio** no backend (a reorg renomeia identificadores e pode renomear contrato/enum via migration, mas **não** altera regras/comportamento das operações).
- Auth/SSO.
- Automação de ingestão/IA (specs 052/053 Frente E).
- Novos recursos de produto além de reorganizar/renomear o que já existe (Dashboard/Logs/Jobs novos entram como estrutura + stub, não como features completas, salvo decisão explícita).

## Spec 054 = GATE DE BLOQUEIO (prioridade, decisão mantenedor 2026-06-27)

A 054 é **prioritária e bloqueante**: qualquer spec que toque as **mesmas superfícies** que a 054 fica **bloqueada até a 054 fechar** (ou até a parte conflitante da 054 entregar), p/ não retrabalhar/conflitar na mesma tela.

**Superfícies que a 054 toca (e que ficam atrás dela):**
- `apps/mesas/frontend` — painel `/gestao` (página inteira: `GestaoPage`, painéis de Discord/Inbox/Conteúdo/Hidratação, estado de aba → rotas), testes de `GestaoPage`.
- Possível `packages/ui` — extração de `AdminSidebar`/`Breadcrumb`/primitivas de navegação + padrão de botões.
- `apps/mesas/backend` — onde o rename ampliado tocar rota/enum/contrato (Fase 0 lista).

**Bloqueios diretos:**
- **053 Frente A** (a11y/UI da revisão de gestão) — **mesma tela** → BLOQUEADA pela 054. A 053 Frente A só roda **depois** da 054 reorganizar; aí aplica a11y na estrutura nova (um smoke só). As outras frentes da 053 (B tema accounts, C CI CJS, D doc, E ingestão VM) **não** tocam `/gestao` → seguem livres em paralelo.
- **052** — já bloqueada pela 053; com a 054 na frente, a ordem de prioridade fica **054 → 053 → 052**.
- Qualquer nova spec que mexa em `/gestao` do mesas → atrás da 054.

> Implementação da 054 sob autorização nominal por ação. Enquanto a 054 não fechar a parte de `/gestao`, não abrir frente paralela na mesma tela.
