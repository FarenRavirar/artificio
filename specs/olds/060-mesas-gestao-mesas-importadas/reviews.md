# Reviews — 060

Reviews externos (usuário, bots, PRs, checks) desta spec entram aqui.

## PR #137 (spec 059/tangencial) — achados que motivaram esta spec

- **Codex, P1** (`TableActionPanel.tsx`): botão "Publicar mesa" ficava em
  branch `variant === 'owner'`, que nenhum caller usado no fluxo de draft
  passa — nunca renderizava. Revertido; motivou investigação mais funda.
- **Codex, P2** (`DiscordDraftPreview.tsx`): link "Ver mesa" apontava para
  `/painel?edit=...`, rota gm-scoped que nunca serve mesa com
  `gm_id: null`. Mantido como conhecido/insuficiente; resolvido de fato
  por esta spec (tela de gestão admin nova).
- **CodeRabbit, minor** (`TableActionPanel.tsx`): botão "Marcar como
  encerrada" aparecia mesmo em `status: 'draft'`. Corrigido na PR #137
  com guard adicional.
