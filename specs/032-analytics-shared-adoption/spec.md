# 032 — Adoção compartilhada de analytics (GA4 unificado)

- **Módulo/Pacote:** packages/analytics + apps/site + apps/glossario + apps/mesas
- **Gate relacionado:** nenhum (consolidação compartilhada; toca pacote shared → SDD Completo)
- **Origem:** `BL-ANALYTICS` (specs/019 B5 / FSU-008); tangência `BL-QA-THIRD-PARTY`. Decisão base **D020**.

## Problema

D020 manda **1 GA4 property** com `cookie_domain` raiz cobrindo todos os subdomínios. Estado real verificado (2026-06-18, read-only VM + curl):

- **site (beta.artificiorpg.com):** usa `@artificio/analytics` corretamente, mas `PUBLIC_GA_ID` está **vazio** no `.env` da VM (prod e beta). HTML servido **não carrega gtag**. Site novo **não trackeia nada**.
- **glossario (glossario.artificiorpg.com):** gtag **hardcoded** em `index.html` com `G-XMRHY3FE58` — **property separada**, viola D020. Tem `utils/analytics.ts` duplicando os helpers do pacote. SPA React sem `page_view` por route change.
- **mesas (mesas.artificiorpg.com):** `services/analytics.ts` é abstração provider genérica com GA4 **comentado e provider nunca configurado** → só `console.log`. gtag **não carrega**. **Zero instrumentação real.**

Resultado: nenhum app novo alimenta a property canônica; dados fragmentados/ausentes; navegação entre subdomínios não é unificada (referral interno). Property canônica decidida pelo mantenedor = **`G-8XN5BGPJP3`** (www.artificiorpg.com, com histórico de tráfego real).

## Requisitos (numerados, testáveis)

1. **R1** — Todos os apps novos (site, glossario, mesas) enviam para a **única** property `G-8XN5BGPJP3`. Nenhum outro measurement id ativo no HTML servido.
2. **R2** — `cookie_domain=.artificiorpg.com` em todos (cross-subdomínio, D020). Verificável no cookie `_ga` servido.
3. **R3** — site (beta) carrega gtag com a property canônica (env `PUBLIC_GA_ID` preenchido); HTML servido contém o loader.
4. **R4** — glossario remove o gtag hardcoded do `index.html` e o `utils/analytics.ts` duplicado; passa a consumir `@artificio/analytics`. Sem `G-XMRHY3FE58` no bundle.
5. **R5** — mesas carrega GA4 real via `@artificio/analytics` (não placeholder morto); rotas públicas instrumentadas.
6. **R6** — SPAs (glossario, mesas) disparam `page_view` em cada mudança de rota (React Router), com `send_page_view:false` no config inicial para não duplicar.
7. **R7** — Eventos de domínio usam o catálogo central de `@artificio/analytics`, não strings soltas por app. Catálogo de BI agregado:
   - **glossario:** `search` (`search_term`), `view_termo` (`termo_id`, `termo`, `sistema`).
   - **mesas:** `search` (`search_term`), `select_mesa` (`mesa_id`, `mesa_nome`, `sistema`), `filter_sistema` (`sistema`).
   - `search_term` é **texto livre digitado pelo usuário**, podendo conter PII; mitigações obrigatórias: sem `user_id`, `anonymize_ip`, redação de e-mails/PII óbvia via regex antes do cap, e cap de tamanho (max 100 caracteres após trim e redação).
   - `termo`, `mesa_nome` e `sistema` são campos de **conteúdo público controlado** (nome de termo/mesa/sistema), não dado de pessoa.
   - Responde: mesas mais buscadas/clicadas, sistemas mais populares, termos mais procurados/vistos. Tudo agregado, sem `user_id`/identificação.
8. **R8** — Privacidade: `anonymize_ip` ativo; nenhum PII em params; sem `user_id` salvo necessidade aprovada. `search_term` é texto livre do usuário, mitigado por redação de e-mail/PII via regex + cap de 100 caracteres (slice+trim) + min length 2, sem `user_id` e com `anonymize_ip`. Compromisso "sem coleta desnecessária".
9. **R9** — `G-XMRHY3FE58` (property antiga do glossário) é aposentada; D020 e backlog refletem a convergência.

## Critérios de aceite

- DebugView/Realtime GA4 mostra page_view dos 3 apps na **mesma** property `G-8XN5BGPJP3`.
- HTML servido de beta, glossario, mesas carrega `gtag/js?id=G-8XN5BGPJP3` (e só esse id).
- glossario: route change dispara novo `page_view` (Network/DebugView), evento `search` chega no catálogo central.
- Cookie `_ga` com `Domain=.artificiorpg.com` nos 3.
- Nenhum `G-XMRHY3FE58` nem id hardcoded remanescente no código/bundle.
- `BL-ANALYTICS` fechado; D020 com nota de convergência; `project-state.md` atualizado.

## Fora de escopo

- WordPress de produção raiz (Gate C adiado, intocável) — a property `G-8XN5BGPJP3` no WP segue como está.
- Config do painel GA4 admin (exclusão de referral interno, data streams) — ação do mantenedor, registrada como follow-up, não código.
- Consent Mode / banner de cookies (projeto sem ads/remarketing; reavaliar só se exigência legal surgir).
- Eventos avançados/funis específicos por app além do mínimo de page_view + eventos já existentes.
- srd, esferas, downloads, links (ainda não no ar; herdarão o padrão via contrato de módulo).

## Riscos e impacto em outros módulos

- **packages/analytics** é compartilhado → mudança exige smoke dos consumidores (site, glossario, mesas). Helper React novo não pode quebrar o snippet SSR do site (Astro).
- Preencher `PUBLIC_GA_ID` na VM = **write na VM** → aprovação nominal + rebuild do site.
- Risco de duplicar page_view se `send_page_view` não for desligado nas SPAs (R6).
- Trocar property do glossário descarta continuidade histórica de `G-XMRHY3FE58` (aceito: baixo volume, decisão do mantenedor por unificação D020).
