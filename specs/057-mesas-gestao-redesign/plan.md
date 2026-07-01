# Plano — 057 Redesign da gestão do mesas

> Escopo desta abertura = **Fase 0 (investigação) + Fase 1 (proposta de IA) + plano faseado**. Fases 2+ (implementação) só após aprovação nominal.

## Arquitetura da solução (alvo)

Painel admin único, coeso, estilo Cloudflare: sidebar de grupos top-level + área de conteúdo com sub-navegação local quando necessário. Uma só árvore de código (`features/admin`), com `modules/admin` absorvido. Estado real, densidade informativa, tokens de tema.

### IA proposta da sidebar (rascunho — fechar em `proposta-ia.md`, R3)

```
Visão geral      → Dashboard enxuto: cards de estado + feed de atividade único
Mesas            → Fila unificada de drafts (Bot/Exporter/Texto · rascunho/revisão/sincronizado · lote)
                   + acesso ao CRUD de mesas publicadas? (decisão R4: CRUD fica em Conteúdo)
Conteúdo         → Sistemas RPG · Plataformas (VTT/Comunicação) · Cenários · Mesas publicadas (CRUD)
Comunidade       → Sugestões de sistema/cenário/setting (aprovar/rejeitar)
Moderação        → Mensagens capturadas · Rascunhos (ações em lote — spec 056)
Importação       → Bot de Discord (Configuração / Importação / Relatórios)
                   · Importação por texto · Enriquecimento de dados
Sistema          → Config geral · Usuários · Dev-feedback
```

> "Mesas" (fila de drafts) vs "Moderação › Rascunhos": **possível sobreposição** — resolver em `proposta-ia.md` (provável: Moderação some/funde em Mesas, ou Mesas = a fila e Moderação = só mensagens capturadas). Decisão registrada lá.

### Bot de Discord (sub-abas)
- **Configuração** — formulário de `chat-exporter/config` (GET/PUT) + bot-token + sources; persistência via round-trip.
- **Importação** — dry-read (`discovery/guilds`, contagem "a atualizar") → filtros → `chat-exporter/run` / `import-json`.
- **Relatórios** — `discord/metrics` + `discord/metrics/shadow` + `import/metrics` + `discord_import_runs`, com filtro/ordenação.

## Arquivos afetados (por módulo)

**Investigação (Fase 0/1) — só leitura + artefatos:**
- `specs/057-mesas-gestao-redesign/inventario.md` (novo)
- `specs/057-mesas-gestao-redesign/proposta-ia.md` (novo)

**Implementação (Fases 2+, depois de aprovado) — previsão:**
- `apps/mesas/frontend/src/features/admin/components/*` — Sidebar nova, Sections reescritas, novo grupo Importação/Mesas.
- `apps/mesas/frontend/src/modules/admin/*` — absorvido em `features/admin` (activity/hydration/platforms/systems/dev-feedback).
- `apps/mesas/frontend/src/features/discord-sync/*` — reorganizar painéis em Bot de Discord.
- `apps/mesas/frontend/src/App.tsx` — roteamento aninhado novo.
- `apps/mesas/backend/src/routes/**` — remover/marcar `legacy` endpoints órfãos (R10), se houver.
- `docs/api/openapi/mesas.yaml` + regenerar bundle (`pnpm api:bundle`) se contrato mudar.

## Contratos/interfaces tocados
- **Auth/accounts:** não. (Admin só checa `role==='admin'` já existente.)
- **Subdomínio/DNS:** não.
- **Schema/banco:** não previsto (reusa tabelas existentes: `discord_import_*`, `import_drafts`, `_ai_suggestions`, `discord_import_runs`).
- **Contrato API:** possível **remoção** de rotas admin órfãs (breaking) → `pnpm verify:api` + `api-diff`.

## Impacto em consumidores
- Único consumidor das rotas admin = `apps/mesas/frontend` (a confirmar em R2). Sem consumidores externos.
- Spec 052 grava métricas/drafts que esta UI lê — não alterar produção desses dados, só leitura.

## Rollback
- Investigação = só artefatos `.md`, rollback trivial (descartar).
- Implementação por fase com branch própria + PR; rollback = reverter PR. `/gestao` antiga preservada até a fase substituir.

## Validação (como provo)
- **Fase 0/1:** artefatos completos + aprovação nominal.
- **Fases 2+:** por fase — `pnpm run lint` + `pnpm run build` + `pnpm verify:api` (se tocar contrato) + smoke da área no beta (`mesasbeta`). Nada de "parcial" como conclusão.
