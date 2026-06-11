# 013 — Restaurar `links.` e `regras.artificiorpg.com` (módulo links)

- **Módulo/Pacote:** apps/links (novo) + infra (tunnel/DNS 2 hostnames)
- **Gate relacionado:** D
- **Nível SDD:** Completo (infra/DNS; conteúdo é estático simples)

## Problema
`links.artificiorpg.com` (página de links/grupos WhatsApp, estilo linktree) e `regras.artificiorpg.com` estão fora do ar desde a migração da VM. Docs registram: página TS única, **sem GitHub**, host não localizado no inventário T1 (D027); T6 da spec 001 (backup do código + push p/ GitHub) **não foi executada** — `MANIFEST.md` 2026-06-04 não contém `code/`. Mantenedor afirma que backup foi feito na migração, mas não implementado/restaurado — **localizar o artefato é a 1ª tarefa**. `regras.` não consta em nenhum doc do monorepo (hipótese: é a página antes chamada `servidorvirtual.` ou irmã do links — confirmar com mantenedor).

## Requisitos (numerados, testáveis)
1. Código/artefato das duas páginas **localizado e confirmado pelo mantenedor** (candidatos: caminho local indicado por ele; `secrets.7z`/`opt-dirs` do backup; Cloudflare Pages; Hostinger).
2. Código versionado no monorepo em `apps/links` (uma app estática servindo as duas páginas, ou duas — decidir no plan pelo conteúdo achado). Fecha D027 + pendência T6/spec 001.
3. Servidas em `https://links.artificiorpg.com` e `https://regras.artificiorpg.com` (200) via Cloudflare Tunnel, rede `artificio_net`.
4. Marca/design G1 (`@artificio/ui` tokens) se o conteúdo permitir sem reescrever a página; senão, restaurar fiel primeiro e anotar débito visual.
5. Deploy canônico via `_deploy-module.yml` (estático = container nginx simples; sem DB).
6. Conteúdo restaurado = conteúdo do backup (paridade visual/links confirmada pelo mantenedor).

## Critérios de aceite
- [ ] Ambos hostnames 200 com conteúdo correto (mantenedor valida).
- [ ] Código no monorepo + workflow de deploy verde.
- [ ] D027 fechado em `decisions.md` (linha nova) e roadmap atualizado.

## Fora de escopo
Reescrever as páginas/redesign. Nav principal (spec 014). Qualquer SSO (páginas públicas).

## Riscos e impacto em outros módulos
- **Artefato pode não existir** (decisão do mantenedor 2026-06-11): se a busca de T1 falhar, **refazer as duas páginas do zero** em `apps/links` (conteúdo via Wayback Machine + mantenedor; stack canônica estática; marca G1). Requisito 6 (paridade com backup) vira "paridade com referência aprovada pelo mantenedor".
- Hostnames novos no tunnel = write VM (aprovação por ação); não tocar ingress existente.
- Zero impacto em packages/DB.
