# 038 — links: mídia dos grupos (Cloudinary) + reidratação + reportar
- **Módulo/Pacote:** apps/links (+ packages/media compartilhado; +CI/cron; +nav cross-app em packages/ui)
- **Gate relacionado:** D (projeto links)

## Problema
O diretório `links.artificiorpg.com` está no ar, mas:

1. **Grupos sem logo.** Os 13 grupos do seed têm `logo_url: null` → todo card cai no `/placeholder.svg`; a home parece quebrada/vazia. A foto de cada grupo existe no WhatsApp (avatar exposto no `og:image` da página de convite `chat.whatsapp.com/<code>`), mas nunca é puxada nem persistida.
2. **Pipeline de mídia existe mas falha + sem reidratação.** O fluxo (og:image → Cloudinary → `logo_url`/`logo_public_id`) já está em `server/lib/{og,cloudinary}.ts` + `resolveLogo` (server.ts:176), chamado no accept/patch/seed. Mas: (a) `og.ts` não decodifica `&amp;` → download falha → logo null (os 13 do seed); (b) não há rotina de **reidratação** para popular faltantes e atualizar avatares (que mudam no WhatsApp) periodicamente nem sob demanda.
3. **Sem moderação pelo usuário.** Não há como o visitante reportar um card (convite quebrado, conteúdo impróprio, grupo morto).
4. **Bug — nav cross-app desatualizado (achado 2026-06-21).** `packages/ui/src/modules.ts` já lista `links` ("WhatsApps", linha 13), mas glossario/mesas/site/accounts em produção foram buildados antes e servem o nav **sem** links (verificado: `curl` glossario/site = 0 ocorrências de "WhatsApps"). Os apps não se referenciam ao links.
5. **Bug — todo card usa placeholder (achado 2026-06-21).** Consequência direta de (1); registrado aqui para fechar junto.

## Requisitos (numerados, testáveis)
- **R1 — Extração da foto do convite.** Dado um `invite_url` (`chat.whatsapp.com/<code>`), o backend busca a página, extrai a `og:image` (avatar do grupo) e devolve a URL da imagem. Trata convite inválido/privado/sem `og:image` sem quebrar (retorna "sem imagem", não erro fatal). **Já existe** em `server/lib/og.ts` (`fetchOgImage`), mas com **bug**: não decodifica entidades HTML (`&amp;`) na URL → download falha → logo fica null (provável causa dos 13 grupos sem logo). Corrigir o decode é parte de R1. Grupos de WhatsApp normalmente têm foto real; rejeitar "avatar genérico" é guard barato e opcional, não bloqueia.
- **R2 — Upload ao Cloudinary (signed, backend).** A imagem extraída em R1 é subida ao Cloudinary via `@artificio/media` (`uploadFromUrl`, signed preset, nunca credencial no front), em pasta dedicada (`links/groups`). Persiste `logo_url` (secure_url) + `logo_public_id` no registro do grupo. Idempotente por hash do conteúdo (mesma imagem não duplica).
- **R3 — Reidratação em lote.** Rotina que varre grupos `status='active'` e: (a) preenche logo de quem está com `logo_url IS NULL`; (b) re-busca quem está desatualizado e atualiza só se a imagem mudou (hash diferente); remove o asset antigo do Cloudinary (`deleteAsset`) ao trocar. Reporta quantos atualizados/falhos/inalterados.
- **R4 — Botão admin "Reidratar imagens".** No painel admin (`/admin`, role=admin), botão que dispara R3 sob demanda e mostra o resultado (contadores). Protegido por auth (admin-only), rate-limited.
- **R5 — Cron semanal (domingo).** Workflow agendado roda R3 automaticamente todo domingo, sem expor segredo, com guard de branch (padrão dos crons de prod). Falha visível (não silenciosa).
- **R6 — Botão "Reportar" no card.** Cada `GroupCard` tem ação "Reportar"; abre motivo (convite quebrado / conteúdo impróprio / grupo inativo / outro) + texto opcional. Persiste em tabela `group_reports`. Admin vê a fila de reports no painel. Rate-limited; sem coletar dado pessoal além do mínimo (sem exigir login para reportar; se logado, denormaliza email do SSO).
- **R7 — Propagar nav cross-app.** Garantir `links` no nav compartilhado (`modules.ts` já tem) e **redeployar** os apps consumidores (glossario/mesas/site/accounts) para que o nav servido em prod inclua "WhatsApps". Critério: `curl` de cada app mostra `links.artificiorpg.com` no nav.

## Critérios de aceite
- Home do links mostra **fotos reais** dos grupos (Cloudinary), não placeholder, para todo grupo cujo convite expõe `og:image`. Grupos sem imagem disponível seguem com placeholder, registrado.
- `logo_url` aponta para `res.cloudinary.com/...` (não para `chat.whatsapp.com`); `logo_public_id` preenchido.
- Botão admin reidrata e retorna contadores reais; cron de domingo roda e registra resultado.
- Card tem "Reportar" funcional; report persiste e aparece no admin.
- Cada app consumidor serve o nav com "WhatsApps"/links (verificável por `curl`).
- Nenhuma credencial Cloudinary no frontend; upload sempre no backend.
- Tudo entra por **branch + PR** (sem commit direto em `dev`); nada de pular etapas.

## Fora de escopo
- Cutover WP / DNS raiz (Gate C).
- Migrar mídia de outros módulos.
- Redesenho visual do card além do botão Reportar.
- Login obrigatório para reportar.

## Riscos e impacto em outros módulos
- **WhatsApp é fonte hostil/instável:** a página de convite pode mudar markup, rate-limitar, exigir desafio, ou servir `og:image` genérico (logo padrão do WhatsApp). Pipeline deve degradar gracioso e nunca travar deploy/cron. Apenas **GET/read-only** sobre o WhatsApp; nunca autenticar/entrar no grupo.
- **packages/media é compartilhado → SDD Completo** (já é). Mudança nele exige smoke dos consumidores (site/mesas/glossario que usam media).
- **packages/ui (modules.ts) é compartilhado:** propagar nav exige rebuild/redeploy dos apps; risco de regressão visual no header — smoke proporcional.
- **Cloudinary custo/cota:** reidratação semanal multiplica uploads; usar hash p/ não re-subir imagem igual; limpar asset antigo ao trocar.
- **Dados pessoais (reports):** minimizar; não exigir login; sanitizar texto livre (DOMPurify/sanitize-html) — entrada externa hostil.
</content>
</invoke>
