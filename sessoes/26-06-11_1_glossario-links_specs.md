# Sessão 26-06-11_1 — glossário + links/regras + nav + SSO (specs 012–015)

- **Data:** 2026-06-11 · **Módulo:** glossario / links / packages-ui · **Gate:** D (glossário, links)
- **Objetivo:** investigar e especificar: (1) glossário → monorepo + `glossario.artificiorpg.com`; (2) restaurar `links.` + `regras.`; (3) nav principal item "WhatsApp"; (4) SSO accounts no glossário com compat do login antigo.
- **Vínculos:** `specs/012-glossario-monorepo/`, `specs/013-links-regras-restore/`, `specs/014-ui-nav-whatsapp/`, `specs/015-glossario-sso-compat/`.

## Decisões do mantenedor nesta sessão
- Glossário está NO AR em `glossariorpg.` mas alvo é **`glossario.artificiorpg.com`** (rename de hostname; registrar D0NN ao executar 012).
- Glossário vai **direto pro monorepo** (sem restauração intermediária do legado).
- links/regras: backup teria sido feito na migração, **não implementado**; artefato não está em `artificiobackup\2026-06-04` (`MANIFEST.md` sem `code/`; T6 da spec 001 não executada; D027 = host não localizado). T1 da 013 = localizar com mantenedor.
- `regras.artificiorpg.com` não consta em doc nenhum — confirmar se é ex-`servidorvirtual.` (T1 da 013).

## Achados da investigação
- Legado glossário: `C:\projetos\glossario_rpg_artificio` (React18/Vite/Tailwind + Express + PG `glossario_v2`, 14 tabelas; auth próprio email/senha BCrypt + JWT custom; GitHub próprio beta+prod; `ARQUITETURA_PROJETO.md`/`OPERACAO_PRODUCAO.md` = docs canônicos do legado).
- Backups: dumps + volumes + opt-dirs do glossário em `C:\projetos\artificiobackup\2026-06-04` (checksums OK, restore-test 14 tabelas).
- Compat SSO: pétrea Google-only ⇒ link por email (`users.email` lower) no 1º login SSO; preserva `terms.added_by`/votos/comentários; senha aposentada; órfãos (email não-Google) = decisão do mantenedor (T1 da 015).

## Ordem de execução proposta
012 (glossário→monorepo) → 013 (links/regras) → 014 (nav WhatsApp, junto/depois da 013) → 015 (SSO compat, fecha Gate D glossário).

## Checklist de fechamento
- [x] Specs 012–015 criadas (spec/plan/tasks).
- [x] Sessão criada + index atualizado.
- [x] `project-state.md` log atualizado.
- [ ] Execução = sessões próprias por spec.

## Decisões adicionais do mantenedor (2026-06-11, 2ª rodada)
- 013: se artefato de links/regras não for achado em T1 → **refazer as duas páginas do zero** (spec atualizada).
- 012/014: glossário **já entra com o nav cross-módulo** no header (T3 da 012 usa `defaultNavItems`); 014 lista glossário como consumidor do item WhatsApp.
- 015: usuários legados com email não-Google **conectam via fluxo de reivindicação**: aviso "email não-Google? entre por aqui" → valida senha antiga (endpoint de migração, sem sessão) → tela obrigatória de conexão Google → herda tudo (termos/votos/comentários) na conta Google. Exceção controlada à pétrea Google-only **autorizada explicitamente** (só migração; login de sessão por senha continua proibido). Spec/plan/tasks 015 atualizados.

## Pendências p/ mantenedor
- 013-T1: indicar onde está o backup/código de links/regras (se houver); confirmar `regras` = ex-servidorvirtual.
- 014-T1: confirmar rótulo "WhatsApp" e posição no nav.
