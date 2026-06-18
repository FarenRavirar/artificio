# Sessão 26-06-18_2 — Analytics shared adoption (Spec 032)

- **Data:** 2026-06-18
- **Objetivo:** convergir GA4 dos apps novos para 1 property (D020) + facilitar trackeamento/BI de gestão
- **Módulo/Pacote:** packages/analytics + apps/site + apps/glossario + apps/mesas
- **Gate:** nenhum (consolidação compartilhada; SDD Completo por tocar `packages/*`)
- **Vínculos:** `specs/032-analytics-shared-adoption/{spec,plan,tasks}.md`; `BL-ANALYTICS`; `BL-QA-THIRD-PARTY`; D020; origem `specs/019` B5/FSU-008
- **Divisão de papéis:** investigação + documentação + planejamento = Claude. Execução de código = opencode (fatia por app, PR isolado).

## Plano

1. Investigar estado real do analytics em todos os apps. ✅
2. Decidir property canônica (mantenedor). ✅ `G-8XN5BGPJP3`.
3. Criar spec 032 (spec/plan/tasks). ✅
4. Atualizar backlog/index/decisions/project-state. ✅ (esta sessão)
5. Handoff p/ opencode executar T1–T11.

## Investigação — estado real (verificado 2026-06-18)

Métodos: leitura do código (read-only), `ssh faren` printenv read-only, `curl` HTML servido.

- **packages/analytics** (`@artificio/analytics`): existe, zero-dep. SSR snippet (`gtagSrc`, `gtagInlineConfig`, cookie_domain raiz D020) + client helpers (`trackEvent`, `trackPageview`). Falta helper React (gtag-load + page_view por rota) e catálogo de eventos de domínio.
- **site (beta.artificiorpg.com):** consome o pacote corretamente (`Analytics.astro`, gated `PUBLIC_GA_ID`). MAS `PUBLIC_GA_ID` **vazio** no `.env` da VM (prod e beta confirmado via `docker exec printenv`). HTML servido **sem gtag** → site novo **não trackeia**.
- **glossario (glossario.artificiorpg.com):** gtag **hardcoded** em `frontend/index.html` com `G-XMRHY3FE58` — **property separada, viola D020**. `src/utils/analytics.ts` duplica helpers do pacote (+`trackSearch`). SPA sem page_view por route change. Confirmado no HTML servido (`G-XMRHY3FE58` carregando).
- **mesas (mesas.artificiorpg.com):** `src/services/analytics.ts` = abstração provider genérica, GA4 **comentado, provider nunca setado** → só `console.log`. `index.html` sem gtag. HTML servido sem gtag → **zero instrumentação real**.
- **raiz `artificiorpg.com`:** WordPress (Gate C adiado, intocável). `www` retorna 404. Property `G-8XN5BGPJP3` vive na config GA do WP (tráfego histórico real) → escolhida como canônica.

**Conclusão:** nenhum app novo alimenta a property canônica hoje. Bug real registrado em `BL-ANALYTICS` (atualizado com o estado verificado).

## Decisão do mantenedor

- Property única canônica = **`G-8XN5BGPJP3`** (D020 reforçado). Aposentar `G-XMRHY3FE58`.
- Analytics deve responder, agregado e sem PII (dados de gestão): mesas mais buscadas/clicadas, sistemas mais populares, termos mais procurados/vistos. → catálogo de eventos `search`/`select_mesa`/`filter_sistema`/`view_termo` (R7 da spec; custom dimensions no GA4 admin = T13).

## Arquivos modificados nesta sessão (doc-only)

- `specs/032-analytics-shared-adoption/spec.md` (novo)
- `specs/032-analytics-shared-adoption/plan.md` (novo)
- `specs/032-analytics-shared-adoption/tasks.md` (novo)
- `specs/backlog.md` (BL-ANALYTICS + BL-QA-THIRD-PARTY atualizados)
- `sessoes/index.md` (linha desta sessão)
- `.specify/memory/decisions.md` (nota em D020)
- `.specify/memory/project-state.md` (ponteiro spec 032)

## Checklist de fechamento

- [x] Investigação do estado real concluída e registrada
- [x] Spec 032 criada (spec/plan/tasks)
- [x] Backlog atualizado (BL-ANALYTICS, BL-QA-THIRD-PARTY)
- [x] Index de sessões atualizado
- [x] D020 anotado
- [x] project-state atualizado
- [ ] Execução (opencode) — T1–T11
- [ ] Follow-ups mantenedor — T9 (PUBLIC_GA_ID VM, aprovação), T12/T13 (GA4 admin)

## Critério de conclusão

Doc/planejamento desta sessão: fechado quando spec + backlog + index + decisions + project-state coerentes (✅). Implementação roda em sessão/PRs próprios do opencode.

## Item para project-state.md

Spec 032 aberta: convergência GA4 1-property (D020) + helper React + BI agregado; planejada/documentada, execução pendente por opencode.
