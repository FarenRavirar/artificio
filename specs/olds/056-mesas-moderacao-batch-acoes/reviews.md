# 056 — Reviews

Só reviews externos (mantenedor, bots, PRs, checks). Achados internos → `debitos.md`.

| ID | Origem | Data | Achado | Veredito | Notas |
|---|---|---|---|---|---|---|
| REV-001 | Codex (chatgpt-codex-connector) | 2026-06-29 | Revisão geral nos 22 arquivos alterados. | Resolvido | Aplicado nos commits da branch. |
| REV-002 | CodeRabbit (coderabbitai) rodada 1 | 2026-06-29 | 7 actionable comments: normalização de payload nos endpoints batch, bypass de cliente injetado em DiscordDraftReviewTable, seleção stale, paralelismo em IntegrationLogsView, limpeza de seleções stale em useDiscordSync, schemas OpenAPI genéricos demais. | Resolvido | Fixes no commit `3834f7d`. |
| REV-003 | CodeRabbit (coderabbitai) rodada 2 | 2026-06-29 | 1 actionable + 1 nitpick: transação atômica em batch rejection (shadow + drafts na mesma transaction), parseBatchResult engolindo falha de parse (deve throw em vez de retornar 0). | Resolvido | Fixes nos commits `3834f7d` + `89251fa`. |
