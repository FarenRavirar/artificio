# Sessao 26-06-27_1 — mesas/accounts/config — review import-overhaul

## Objetivo

Revisar a branch `feat/048-import-overhaul` contra o plano canonico `specs/048-mesas-discord-chat-exporter-json/plan-import-overhaul.md`, cobrindo WS0..WS4, com foco em bugs, duplicacao, dividas nao registradas e erros de tipo/teste mascarados.

## Escopo

- `apps/mesas`
- `apps/accounts`
- `packages/config`
- Documentacao da spec 048 quando houver divergencia entre plano, codigo e validacao real.

## Regras carregadas

- T0 lido: `project-state.md`, `context-capsule.md`, `decisions.md`.
- `AGENTS.md` lido: governanca, isolamento, segredos, git/PR, conclusao.
- Plano canonico 048 e `debitos.md` lidos.
- Skill `diagnose` lida; loop principal = typecheck/build/test/lint + testes pontuais por pacote.

## Vínculos

- **Spec:** `specs/048-mesas-discord-chat-exporter-json/`
- **Plano:** `specs/048-mesas-discord-chat-exporter-json/plan-import-overhaul.md`
- **Débitos:** `specs/048-mesas-discord-chat-exporter-json/debitos.md`
- **Branch:** `feat/048-import-overhaul` (`61dd214`)
- **PR:** #78 (aberto)

## Arquivos a modificar

- `specs/048-mesas-discord-chat-exporter-json/debitos.md` — alinhar descrição WS3 com código real
- `specs/048-mesas-discord-chat-exporter-json/plan-import-overhaul.md` — remover seção "Escopo confirmado a esclarecer com o mantenedor" do WS3
- `specs/backlog.md` — corrigir referência de path
- `apps/mesas/frontend/tsconfig.app.json` — remover exclude de testes
- `apps/mesas/frontend/src/jest-dom.d.ts` — declarar tipos jest-dom p/ LSP

## Critério de conclusão

- [ ] LSP limpo nos 15 arquivos de teste de frontend
- [ ] `pnpm run test` (mesas-frontend 163/163) ✅
- [ ] `pnpm run build` (mesas-frontend, mesas-backend, accounts) ✅
- [ ] `pnpm run lint` (15/15) ✅
- [ ] Débitos da spec 048 coerentes com código real
- [ ] Backlog atualizado

## Hipoteses iniciais

1. Se ha erros LSP como `toBeInTheDocument` inexistente, entao algum pacote frontend usa matcher DOM sem carregar `@testing-library/jest-dom/vitest` nos tipos/setup.
2. Se `debitos.md` marca WS0..WS4 como fechado sem comando real consistente, entao `pnpm run build/test/lint` ou builds filtrados devem reproduzir falhas.
3. Se WS3 foi implementado rapido demais, entao ha risco em contrato accounts/mesas: env vars ausentes, rota admin/service mal testada, ou payload externo DeepSeek sem normalizador forte.
4. Se WS1 antecipou upload de capa, entao ha risco de duplicar upload ou quebrar parse em lote por falha externa.

## Plano

- Verificar branch, diff e arquivos tocados.
- Rodar validacoes pontuais primeiro: frontend mesas type/test, backend mesas build/test, accounts build/test, packages/config build.
- Investigar falhas reais por simbolo com codebase-memory-mcp + leitura localizada.
- Corrigir falhas dentro do escopo, com comentarios apenas onde necessario para contrato/segredo/fallback.
- Atualizar `debitos.md`/backlog se algum item ficar bloqueado ou se status documental estiver falso.
- Rodar validacao final proporcional antes de encerrar.

## Evidencias

- Em andamento.

## Checklist de fechamento

- [ ] Falhas reproduzidas por comando real.
- [ ] Correcoes aplicadas sem mascarar erro.
- [ ] Testes/regressoes relevantes adicionados ou ajustados.
- [ ] `debitos.md` 048 coerente com o codigo real.
- [ ] `specs/backlog.md` atualizado ou justificativa registrada.
- [ ] `project-state.md` atualizado se mudar estado operacional.
- [ ] Sem processo auxiliar deixado rodando.
