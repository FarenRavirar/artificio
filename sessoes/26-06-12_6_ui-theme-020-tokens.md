# Sessao 26-06-12_6 — Spec 020: fonte unica de tokens (Fase B, fatia 1)

- **Data:** 2026-06-12
- **Tipo:** SDD Completo (toca `packages/ui`)
- **Modulo/Pacote:** `packages/ui` (consumidores validados em build)
- **Gate relacionado:** nenhum. WP raiz/DNS/VM/deploy/producao fora de escopo.
- **Spec vinculada:** `specs/020-ui-theme-artificio-padrao/` (T1, T2, T13 Fase B)
- **Estado:** em andamento

## Objetivo
Primeira fatia segura da Spec 020: decisao de paleta (T1) + mapa de tokens (T2) + fonte unica de tokens em `packages/ui` com paridade interna (T13 Fase B). NAO migrar telas grandes. NAO habilitar lua/sol. Sem commit/push.

## Decisao de paleta (T1) — D064
Mantenedor confirmou com certeza: laranja de marca = **`#FF5722`** (Material Deep Orange 500), nao `#FF9457`.
Evidencia objetiva (amostragem pixel via System.Drawing):
- Logos PNG canonicos (`Logo-PNG-Negativo-2.png`, `cropped-Logo-PNG-Negativo-2.png`): laranja dominante = `#FF9457` (x1094/x1074, solido, nao anti-alias). Foi o que D040 amostrou (do hexagono do logo).
- `midias/telaprincipal.png` (screenshot da UI antiga): vermelho-laranja dominante = `#FF5722` (x122). = a cor que o mantenedor lembra.
- Glossario / memoria do mantenedor: `#e85d26` / `#E8521A` (vermelho-laranja proximo de `#FF5722`).
Conclusao: D040 amostrou o logo (pessego); o acento real da marca/UI e o vermelho `#FF5722`. **D064** supera o laranja do D040; navy/ink `#020740` permanece.

## Mapa de tokens atual (T2)
| Papel | tokens.ts | preset.js | glossario | mesas | accounts | target D064 |
|---|---|---|---|---|---|---|
| navy/ink | `#020740` | `#10103A` ❌ | `#1a2744` | `#1B2A4A`¹ | `#020740` | `#020740` |
| brand/accent | `#FF9457` | `#FC9054` ❌ | `#e85d26` | `#FF9457` | `#ff9457` | `#FF5722` |
| brandDeep/hover | `#E0712F` | `#E0712F` | — | `#E0712F` | `#e0712f` | `#E64A19` |
| muted | `#5A6172` | `#5A6172` | `#6b7280` | — | `#5a6172` | `#5A6172` |
| line | `#E3E5EC` | `#E3E5EC` | `#d1d5db` | — | `#e6e8f0` | `#E3E5EC` |
| surface | `#FFFFFF` | `#FFFFFF` | `#ffffff` | (dark) | `#ffffff` | `#FFFFFF` |
| canvas | `#F6F7FA` | `#F6F7FA` | `#f9fafb` | (dark) | `#f3f4f9` | `#F6F7FA` |

¹ `#1B2A4A` = superficie dark do app, nao cor de marca.

Achados: (1) **drift interno** packages/ui — preset.js (`#10103A`/`#FC9054`) nao bate com tokens.ts nem D040 nem consumidor algum. (2) accounts/mesas tem **hexes locais duplicados** do laranja (FSU-019/020) — migrar em fatia seguinte. (3) glossario tem paleta propria red-orange (`#e85d26`) — proxima do alvo, migrar em piloto light.

## Mudancas (fatia 1 — somente packages/ui)
- `packages/ui/src/tokens.ts`: brand `#FF9457`→`#FF5722`; brandDeep `#E0712F`→`#E64A19`; focus `#E0712F`→`#E64A19`; comentarios D040→D064.
- `packages/ui/src/styles.css`: `--artificio-brand` `#ff9457`→`#ff5722`; `--artificio-brand-deep` `#e0712f`→`#e64a19`; `--artificio-focus` `#e0712f`→`#e64a19`.
- `packages/ui/tailwind-preset.js`: ink `#10103A`→`#020740`; brand `#FC9054`→`#FF5722`; brand-deep `#E0712F`→`#E64A19`; focus `#E0712F`→`#E64A19`; boxShadow tint navy.

## Fatia 2 — DRY: consumidores puxam a variavel (nao repetem hex)
Pedido do mantenedor: "nao repetir cor em cada lugar; puxar de uma variavel". Aplicado.
Fonte unica = `@artificio/ui` `--artificio-brand`/`--artificio-brand-deep`. Apps que importam
`@artificio/ui/styles.css` (site, mesas, glossario) aliasam seus tokens para `var(--artificio-brand)`;
accounts/site-admin nao importam o CSS compartilhado → token concreto `#ff5722` (1 lugar por app);
literais espalhados passam a referenciar o token.

Mudancas:
- `apps/accounts/.../styles.css`: `--accounts-brand`/`-deep` → `#ff5722`/`#e64a19`; tints rgba(255,148,87)→rgba(255,87,34); soft `#fff0e8`→`#ffe9e3`.
- `apps/site-admin/.../styles.css`: `--orange` → `#ff5722`.
- `apps/site/.../global.css`: `--accent`/`-deep` → `var(--artificio-brand)`/`var(--artificio-brand-deep)`.
- `apps/mesas/.../index.css` `@theme`: `--color-artificio-orange`/`-hover` → `var(--artificio-brand)`/`var(--artificio-brand-deep)`.
- `apps/mesas/.../dev-feedback/{FeedbackButton,FeedbackModal,DevFeedbackPanel}.tsx`: literais Tailwind `bg-[#FF9457]`/`[#E0712F]`/opacidades → tokens `artificio-orange`/`artificio-orange-hover`.
- `apps/glossario/.../index.css`: `--color-brand-accent` → `var(--artificio-brand)`.
- `apps/glossario/.../tailwind.config.ts`: `laranja` `#E8521A`→`#FF5722` (config v3 = fonte unica do app; var nao serve p/ opacidade v3).
- `apps/glossario/backend/.../exportController.ts`: ARGB `FFE8521A`→`FFFF5722` (Excel exige literal).
- `apps/site/server/preview.ts`: `.preview-banner b` → `var(--artificio-brand)` (preview injeta o CSS compartilhado).

Hex concreto do laranja agora vive so em: `packages/ui` (fonte), `apps/accounts`, `apps/site-admin`,
`apps/glossario` config + export ARGB. Cada um e a definicao de token do app, nao repeticao espalhada.
Trocar a cor de marca = editar `packages/ui` (+ 2 spots de glossario por limitacao de Tailwind v3/Excel).

### Incidente (corrigido)
1a tentativa de fatia 2 usou script PowerShell de replace que corrompeu 11 arquivos (`#`→`f` global,
bug de quoting). Restaurados via `git checkout` (autorizado pelo mantenedor, arquivos limpos no HEAD).
Refeito com Edit (Read antes), sem bulk script.

### Validacao fatia 2
- `pnpm turbo run build` → **13/13 successful**.
- `node packages/ui/scripts/check-token-parity.mjs` → OK.
- `git grep` por `FF9457|E0712F|FC9054|e85d26|E8521A` em `apps/` (fora dist) → **vazio**.
- CSS buildado do mesas confirma cadeia: `--color-artificio-orange: var(--artificio-brand)` + `--artificio-brand:#ff5722` + `.bg-artificio-orange`.

## NAO feito (proximas, autorizacao explicita)
- Habilitar lua/sol em glossario/mesas (depende de dark readiness).
- Migrar navy do glossario `#1a2744` → canonico `#020740` (piloto light, decisao R2 separada).
- Primitives/recipes (Fase E/F).

## Validacao
- **Paridade tokens** `node packages/ui/scripts/check-token-parity.mjs` → `token parity OK` (exit 0). Trava nova contra drift tokens.ts vs styles.css vs preset.js.
- **Build cross-modulo** `pnpm turbo run build` → **13/13 successful** (4 cached). Consumidores verdes: mesas (frontend vite 2197 mod + backend tsc), accounts, glossario, site, site-admin, packages.
- **rg hex divergente** em `packages/ui` (fora de dist): so restava `brand-preview.html` (demo estatica fora do build) com `#ff9457`/`#e0712f` → corrigido p/ `#ff5722`/`#e64a19`. Comentario historico no parity script menciona `#10103A`/`#FC9054` de proposito (registro do drift).
- **rg `artificio_theme` duplicado**: sem nova duplicacao; runtime de tema segue unico em `packages/ui/src/theme.tsx` (nao tocado nesta fatia).
- **git status**: so docs/sessoes/specs + `packages/ui/{tokens.ts,styles.css,tailwind-preset.js,brand-preview.html,scripts/}`. Worktree suja preexistente preservada (nao revertida). **Sem commit/push.**

## Estado final
Fatia 1 da Fase B concluida: fonte unica de tokens com laranja canonico `#FF5722` (D064) e paridade interna travada. T1/T2 feitos; T13 parcial (so packages/ui). Proxima fatia = migrar hexes locais duplicados (accounts/mesas/site) e piloto light glossario, em sessao/continuidade autorizada. Sem deploy.
