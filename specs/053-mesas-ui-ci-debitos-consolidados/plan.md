# 053 — Plano

> Solução técnica das frentes de `spec.md`. Implementação por autorização nominal por ação (cada `git`/deploy próprio).

## Ordem recomendada (menor blast radius → maior)

1. **Frente C (CI)** — barato, fecha o buraco que causou o crash de hoje; deveria vir antes de qualquer novo deploy de pacote shared.
2. **Frente B (tema accounts)** — frontend isolado, sem auth.
3. **Frente A (a11y/UI gestão)** — maior; depende de `packages/ui` (SDD Completo, smoke dos consumidores visuais).
4. **Frente D (doc)** — carona em qualquer PR.
5. **Frente E (ingestão VM)** — resolvida por transferência explícita p/ 052 Bloco A; sem VM write nesta spec.

## Frente A — a11y/UI da revisão de gestão (mesas)

- **Pré-investigação obrigatória** (anti-retrabalho): confirmar quanto da 049/051 já cobriu P1-5 (`ConfirmDialog` em `packages/ui`) e P1-7 (primitivas). Usar Serena `find_referencing_symbols` + `rg "window.confirm" apps/mesas` + leitura dos componentes de revisão de draft. Marcar P1 já-resolvido como tal, não reabrir.
- Modal de preview (P1-1): adicionar `role="dialog"`/`aria-modal`, focus-trap, fechar no `Escape`, restaurar foco ao trigger. Preferir primitiva de modal do `packages/ui` se existir; senão extrair.
- Controles de tabela (P1-2): `aria-label`/`<label>` associado às checkbox/células de ação.
- Focus indicators (P1-3): tokens de foco visível do design system (não outline:none).
- Dirty guard (P1-4): bloquear fechamento/navegação com edição não-salva → confirmação.
- `window.confirm` (P1-5): se ainda houver, migrar para `ConfirmDialog` do `packages/ui`.
- Navegação automática entre abas (P1-6): remover redirect implícito pós-ação; manter contexto.
- Design system (P1-7): trocar elementos crus por `Button`/`Badge`/primitivas.
- Erros (P1-8): `role="alert"`/`aria-live="assertive"` nos banners de erro.
- **Tokens de tema:** qualquer cor nova usa tokens semânticos (`--surface`/`--fg`/`--state-*`), nunca paleta dark hardcoded (constraint herdada da 051).

## Frente B — tema accounts

- Investigar theme provider do `apps/accounts/frontend`: default forçado a light? toggle ausente? leitura de `localStorage`/cookie de tema faltando? Comparar com como mesas/glossario consomem o tema do `packages/ui`.
- Corrigir para respeitar preferência + persistir. Sem mexer em sessão/auth.
- Reestruturar visual do `accounts`: abandonar card central genérico/fundo partido, usar navy/línea/laranja do Artifício, organizar cabeçalho da conta, ações e painel admin com classes próprias.
- Smoke visual local + beta (accounts é PROD-only no deploy, D042 — validar em local/preview; deploy prod só com aprovação nominal).

## Frente C — smoke CJS no CI

- Adicionar passo que, sobre o `dist` compilado dos pacotes shared, executa um runner **CommonJS** e faz `require()` de cada subpath exportado consumido em CJS:
  - `require('@artificio/config')`, `require('@artificio/config/secret-crypto')`, `require('@artificio/media')`, etc.
- Falha o job se algum `ERR_PACKAGE_PATH_NOT_EXPORTED`/resolução quebrar.
- Alternativa/complemento: validador estático que cruza `exports` de cada `packages/*` com a condição (`import`/`require`) exigida pelos consumidores (`tsconfig module` dos apps).
- Plugar no workflow de CI existente (provavelmente junto do build). Garantir que **falha no estado pré-fix** (regressão simulada) e **passa no estado atual**.

## Frente D — doc

- Incluir o §13 da 051 (REV-051-RABBIT-06) no próximo PR. Sem código. Verificado: §13 já está presente; esta branch leva o rastreio da 053.

## Frente E — ingestão diária na VM (final da spec) [ex-048 Fase E]

- Automação operacional pura (sem IA) fica no **Bloco A da 052**. Cada passo na VM exigirá aprovação nominal por ação (write/job/cron/migration/segredo). Esta spec não executa VM write.

## Validação (pétrea)

- `pnpm run lint` + `pnpm run build` antes de declarar qualquer frente concluída.
- Frente A: smoke a11y/teclado manual + consumidores visuais do `packages/ui` (matriz de smoke de `packages/ui` código).
- Frente B: smoke visual tema.
- Frente C: rodar o novo check localmente, provar que pega o bug.
- Git: branch + PR por frente (ou agrupado), cada `commit`/`push`/`merge` com autorização nominal própria.
