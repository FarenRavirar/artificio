# 014 — Nav principal: item "WhatsApp" → `links.artificiorpg.com`

- **Módulo/Pacote:** packages/ui (defaultNavItems) + apps/site (`MODULES` em content.ts)
- **Gate relacionado:** nenhum (qualidade cross-módulo)
- **Nível SDD:** Completo (toca `packages/ui` — shared, pétrea)

## Problema
Mantenedor quer `https://links.artificiorpg.com` no nav principal do Artifício, com rótulo **"WhatsApp"** (a página é o hub de grupos de WhatsApp). Nav cross-módulo vive em dois lugares espelhados: `packages/ui` `defaultNavItems` (React, consumido por mesas/accounts) e `apps/site/…/content.ts` `MODULES` (Astro zero-JS, espelho — padrão spec 010).

## Requisitos (numerados, testáveis)
1. Item "WhatsApp" → `https://links.artificiorpg.com` em `defaultNavItems` (`packages/ui`).
2. Espelho em `MODULES` (`apps/site`) — mesma ordem/rótulo.
3. Aparece em todos os módulos que consomem o nav (site, mesas, accounts e **glossário** — consumidor a partir da spec 012) sem regressão visual.
4. Externo abre na mesma guia (mesmo domínio raiz, suite única) — manter padrão dos demais itens.
5. Só entra no ar depois (ou junto) do `links.` restaurado (spec 013) — sem link morto no nav.

## Critérios de aceite
- [ ] HTML servido de site/mesas/accounts/glossário contém o item apontando p/ `links.artificiorpg.com`.
- [ ] Build turbo verde de todos os consumidores; smoke beta de todos.
- [ ] Checklist Nielsen (consistência/padrões) na sessão.

## Fora de escopo
Restaurar a página (spec 013). Mudar outros itens do nav.

## Riscos e impacto em outros módulos
`packages/ui` é shared → mudança mínima aditiva; smoke obrigatório em todos os consumidores (regra pétrea de isolamento). Deploy push-dev redeploya betas (efeito D041 esperado).
