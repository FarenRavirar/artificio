# 054 — Plano

> Solução técnica da reorganização da `/gestao`. Implementação por autorização nominal por ação.

## Fase 0 — Investigação/decisão (sem código)

- Mapear no código TODO componente/rota por trás de cada nó da IA-alvo (tabela old→new vira mapa real componente↔rota). Usar Serena `find_symbol`/`find_referencing_symbols` + `rg`.
- Inventariar e **classificar** TODO identificador a renomear (decisão 4 = rename ampliado) em 3 baldes:
  - **(a) interno-FE** — estado, nome de componente/arquivo, `tab` local, testid → renomeia direto.
  - **(b) contrato FE↔BE sem persistência** — rota de API, chave de payload → renomeia rota+consumidor no **mesmo PR**, sem migration.
  - **(c) valor persistido** — enum/coluna/JSONB em DB (ex.: `status`, `origin`, valores de tab gravados) → rename **só com migration** + aprovação nominal + guard online-safe (spec 050), ou alias/compat + backfill; se não compensar, **débito explícito** (não quebrar).
- ⚠️ **Pétrea de banco:** nenhum valor persistido renomeado sem migration. `rg` nos valores atuais (`'fontes'`, `'import-json'`, `'mensagens'`, `'drafts'`, enums de status/origin) p/ achar onde gravam/leem em DB.
- Fechar as 4 Decisões em aberto do `spec.md` com o mantenedor.
- Saída: documento de mapeamento + decisões registradas. **Sem editar componentes.**

## Fase 1 — Shell de navegação (sidebar + roteamento)

- Criar componente de layout admin: `<AdminSidebar>` + `<AdminMain>` (header contextual + breadcrumb + zona de ações + slot de subnav + outlet de conteúdo).
- Se Decisão 3 = rotas aninhadas: introduzir rotas `/gestao/<grupo>/<sub>` (React Router nested) com `aria-current` na ativa (reaproveita mecanismo do `Nav.tsx`/`styles.css` já existente — spec 051 F2).
- Avaliar extração de `AdminSidebar`/`Breadcrumb` p/ `packages/ui` (se houver reuso por outro app-admin futuro; senão local no mesas, mas com tokens de tema). Decisão registrada.
- Migrar `GestaoPage` de estado-de-aba → layout shell, **preservando** os painéis existentes como conteúdo dos nós.

## Fase 2 — Reorganização dos grupos (mover, não reescrever)

- Encaixar painéis atuais nos novos nós:
  - Conteúdo ← `Gerenciar Conteúdo` (Sistemas de RPG/Plataformas[VTTs/Comunicação]/Cenários/Mesas).
  - Comunidade ← `Sugestões de Sistemas` (Sugestões + Histórico).
  - **Moderação** ← fila unificada (reaproveita filtro por origem 049/DEB-048-34: Discord + Inbox drafts) — Fila de revisão / Mensagens capturadas / Rascunhos / Ignorados.
  - Integrações ← Discord (Configuração/Canais monitorados/Mensagens capturadas/Rascunhos/Importar histórico) + Importação de dados + Enriquecimento de dados (ex-`Hidratação`).
  - Caixa de entrada ← `Inbox` (Feedbacks/Pendentes/Resolvidos).
  - Sistema ← `Desenvolvimento` (Logs/Jobs/Configurações/Desenvolvimento) — itens sem backend = stub rotulado.
- Resolver duplicação Moderação×Discord (Decisão 1): painel de mensagens/rascunhos renderiza **uma vez**; o outro grupo linka.

## Fase 3 — Renomeações (rótulo + identificadores) + padrão de botões

- Trocar rótulos (tabela de renomeações).
- **Rename ampliado (decisão 4)** conforme classificação da Fase 0: (a) interno-FE direto; (b) contrato FE↔BE no mesmo PR; (c) persistido **só com migration** (aprovação nominal + guard online-safe) ou débito explícito. Atualizar **todos** os consumidores — zero nome velho órfão.
- Varredura de verbos de ação → aplicar padrão de botões (primária/secundária/destrutiva/estado/revisão).
- Atualizar `GestaoPage.test.tsx` e demais testes que asseguram rótulos antigos (`Gerenciar Conteúdo`, `Discord Sync`, `Inbox`, `Hidratação de Dados`, `Apurar`...) → novos rótulos. **Não** apenas deletar asserts — migrar.

## Fase 4 — Dashboard + telas novas (incremental)

- Dashboard: visão geral/pendências/atividades/alertas/atalhos. Widgets que dependem de dados ainda inexistentes = placeholder honesto ("em breve"), nunca número falso.
- Logs/Jobs em Sistema: estrutura + stub se sem backend.

## Validação (pétrea)

- `pnpm run lint` + `pnpm run build` verdes antes de declarar qualquer fase concluída.
- Testes de `GestaoPage` migrados e verdes.
- a11y: teclado/foco/`aria-current` na sidebar (alinhar com 053 Frente A — não regredir).
- Smoke visual mantenedor em beta antes de prod.
- Git: branch + PR; cada `commit`/`push`/`merge`/deploy com autorização nominal própria.

## Riscos

- **Contrato quebrado por rename** — mitigar separando "texto exibido" de "identificador". Fase 0 lista o que é contrato.
- **Colisão com 053 Frente A** (mesma tela) — sequenciar (recomendado: 054 antes de 053 A).
- **Escopo inflar** (Dashboard/Logs/Jobs viram features) — manter como estrutura+stub salvo decisão explícita.
- **`packages/ui`** — se extrair sidebar/breadcrumb, smoke dos consumidores (SDD Completo).
