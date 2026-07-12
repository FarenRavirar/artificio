# Spec 073 — Downloads-D: Descoberta pública (catálogo/busca/ficha)

## Origem

Spec filha da `061-downloads-definicao-produto` (§F7/T7.3). Implementa T4.1 (rotas), T4.2 (submenu/sidebar), T4.3 (busca/filtro/ordenação/paginação), T4.4 (card/ficha/perfil de criador), T4.5 (wireframes/AA).

## Pré-requisitos

- Spec 070 (dado real via API).
- Spec 071 (CTA de acesso funcional — link para storage próprio precisa existir).
- Spec 072 (só material aprovado deve aparecer publicamente).

## Objetivo

Frontend público do Downloads: rotas, navegação, busca/filtro/ordenação/paginação com estado em URL, card e ficha de material, perfil de criador.

## Escopo

- Rotas conforme T4.1: `/`, `/catalogo`, `/materiais/:materialSlug`, `/criadores/:slug`, `/usuarios/:username` (aponta ao perfil comunitário compartilhado), coleções, `/ir/:destinationId`, `/obter/:fileId`.
- Header global (`packages/ui`) + submenu Downloads + sidebar contextual (T4.2), reaproveitando os mesmos contratos já usados por mesas/glossario/site/links — sem header paralelo.
- Busca/filtro/ordenação/paginação como contrato único de URL (T4.3): facetas do MVP (sistema/edição, tipo, gênero, idioma, formato, origem, gratuito/PWYW, licença por classe, barreiras).
- Card (T4.4): capa/placeholder, nome+sistema/edição, badge de origem/licença, indicador de barreira, contagem pública simples de download (clique logado deduplicado por conta+material — D111 item 7), alvo de clique único, sem truncamento cego de nome (lição de `packages/catalog-ui`).
- Ficha (T4.4): ordem de seções fixada em `061/spec.md`, CTA de acesso disparando evento de funil antes do redirecionamento, aviso no lugar do CTA quando destino degradado (T3.4).
- Perfil de criador (`/criadores/:slug`): aceita créditos sem conta associada (T3.2).
- Última atualização pública do material (D111 item 7) exibida na ficha quando há edição pós-publicação.
- Wireframes/AA de T4.5: contraste AA, alvo 44×44, zoom 200%/reflow 320px, nenhuma informação só por cor, `prefers-reduced-motion`.

## Fora de escopo

- Painel do usuário/edição (spec 074).
- Gestão/admin (spec 075).
- Upload real de arquivo (spec 071 já resolve o back; aqui só consome).

## Critérios de aceite

1. Busca/filtro/ordenação/página são um único contrato de URL compartilhável.
2. Card tem alvo de clique único, foco visível, sem truncar nome cego.
3. CTA de acesso dispara evento de funil antes do redirecionamento (nunca conta clique como download sem o evento).
4. Material com destino degradado mostra aviso, nunca falha silenciosa.
5. Perfil de criador funciona sem conta de usuário associada.
6. Contraste AA, alvo 44×44, zoom 200% e reduced-motion verificados localmente.
7. Nenhum material fora do estado "aprovado/publicado" aparece nesta camada pública.

## Dependências

- Specs 070, 071, 072.
- Bloqueia spec 074 (reaproveita componentes de card/ficha).
