# 063 — Ajustes finos: catálogo, filtros e correções da sessão

- **Módulo/Pacote:** apps/mesas (frontend + backend)
- **Gate relacionado:** nenhum (Gate D do mesas já fechado; isto é ajuste fino pós-deploy)

## Contexto

Sessão de coleta de bugs pequenos e ajustes no `mesas` (branch `fix/mesas-invalid-url-publicar-mesa`), antes de qualquer commit. Itens já investigados/corrigidos localmente nesta sessão, mais o pedido de refazer o front-end do catálogo. Esta spec consolida tudo em um único lugar rastreável, para revisão e fechamento conjunto (não itens soltos em memória de chat).

## Problema

1. **Bug — publicar mesa nova falha com "Invalid URL".** `POST /api/v1/gm/tables` retorna 400 quando a mesa não tem banner. `banner_url` do frontend manda string vazia `''`; backend valida com `z.url()` (zod), que rejeita `''` (não é URL válida nem passa pelo `.nullable().optional()`, que só aceita `null`/`undefined`).
2. **Bug — contagem de termos do glossário errada na home.** Landing mostra `dados.length` (tamanho da página carregada, `limit=60`), não o total real de termos cadastrados (~8.795 conforme T0). Não existe endpoint de contagem real.
3. **Feature — sem forma direta de anunciar mesa pela home.** Usuário mestre não tem CTA de "criar mesa" na home pública do mesas; só acessa via `/painel` já autenticado, sem ponto de entrada visível.
4. **Filtros do catálogo — estilo é lista fixa, não reflete uso real.** `VALID_STYLES` no frontend é uma lista hardcoded de 6 valores (`Narrativo`, `Combate intenso`, etc.), enquanto o campo real (`tables.setting_styles`) é livre e populado pelos mestres — pode ter valores fora dessa lista, e a lista não mostra volume de uso (quantas mesas usam cada estilo).
5. **Seletor de sistema do catálogo — UX de lista sem busca autopreenchida.** O filtro de sistema no `/catalogo` usa `SystemTreeSelector` (grade de 3 colunas: base/edição/variante, com busca textual simples que lista resultados abaixo). Mantenedor pede algo mais direto: campo de busca com autocomplete (sugestões aparecem digitando, sem precisar navegar árvore/colunas para o caso comum).
6. **Front-end do catálogo (`/catalogo`) precisa de reforma visual completa.** Espaçamento, hierarquia de botões e uso de área da tela do painel de filtros (ver captura da sessão) não estão bons — pedido de refazer completamente essa área (não só o seletor de sistema).

## Requisitos

R1. Mesa sem banner deve publicar sem erro. `banner_url` vazio/whitespace não pode ser enviado como string vazia ao backend.
R2. Home do glossário deve mostrar o total real de termos cadastrados (contagem do banco, não tamanho de página carregada).
R3. Home do mesas deve ter um botão "Anunciar Mesa" visível, abaixo da busca. Logado → vai direto para criação de mesa. Deslogado → vai para login/cadastro e retorna para a criação de mesa após autenticar.
R4. Filtro de estilo do catálogo deve listar todos os estilos realmente em uso em mesas ativas, com contagem de mesas por estilo, ordenado por frequência — não lista fixa.
R5. Filtro de sistema do catálogo deve virar busca com autocomplete: campo de texto único, sugestões dinâmicas aparecem ao digitar (nome, nome_pt, slug, alias), seleção de um resultado aplica o filtro. Não pode perder a capacidade de escolher sistema base, edição ou variante especificamente (árvore continua existindo como dado; muda a forma de navegar/selecionar).
R6. Layout do painel de filtros do `/catalogo` (desktop e mobile) deve ser refeito: espaçamento, agrupamento visual e hierarquia dos controles (busca, sistema, modalidade, preço, nível, selos, estilos) revisados como conjunto — não itens remendados individualmente.
R7. Nenhuma correção desta spec pode regredir comportamento hoje funcional do `/catalogo`, `/painel` ou `CreateTableForm` (o seletor de sistema é compartilhado entre catálogo, onboarding e formulário de criação/edição de mesa).
R8. Changelog do mesas deve refletir, em linguagem de usuário/mestre (sem termos de admin), pelo menos: botão de anunciar mesa e correções de bug relevantes ao mestre.

## Critérios de aceite

- [ ] Publicar mesa nova sem banner não retorna 400/"Invalid URL" (teste manual ou automatizado cobrindo o caminho).
- [ ] Home do glossário mostra contagem real de termos (validável comparando com `SELECT COUNT(*)` real do banco, respeitando o filtro de status já aplicado pela listagem pública).
- [ ] Home do mesas tem botão "Anunciar Mesa"; clique logado abre criação de mesa; clique deslogado completa login e chega na criação de mesa sem passo manual extra.
- [ ] Filtro de estilo no `/catalogo` mostra estilos reais com contagem, sem lista fixa hardcoded no frontend.
- [ ] Filtro de sistema no `/catalogo` é campo de busca com autocomplete funcional (digitar → sugestões → selecionar), testado com sistema com edição e variante (ex.: D&D 5e 2024).
- [ ] Front-end do `/catalogo` revisado (desktop + mobile) sem quebrar filtros existentes (modalidade, preço, nível, selos).
- [ ] `CreateTableForm`, `OnboardingPage` e `UserSystemsSelector` (demais consumidores do seletor de sistema) continuam funcionando após a mudança do catálogo — se o componente for compartilhado e mudar, smoke nos 4 consumidores; se for divergido (componente próprio do catálogo), os outros 3 permanecem intocados.
- [ ] `pnpm run lint` e `pnpm run build` verdes nos pacotes tocados (mesas frontend/backend, glossario frontend/backend).
- [ ] Changelog do mesas atualizado, sem termos de admin.
- [ ] `specs/backlog.md` e `project-state.md` atualizados ao fechar.

## Fora de escopo

- Cutover de DNS, infra, deploy real (isso é ajuste de código local desta sessão; deploy/promoção são ações separadas com aprovação própria).
- Reforma de filtros de modalidade/preço/nível de experiência (são enums de coluna tipada — permanecem como `<select>` fixo; não fazem sentido "por frequência").
- Qualquer mudança em `packages/*` compartilhado entre apps (auth, ui, etc.) — este trabalho é local ao `apps/mesas` e `apps/glossario`.
- Sistema de moderação/admin do catálogo (Gestão) — pedido é explicitamente sobre a experiência do mestre/usuário comum.

## Riscos e impacto em outros módulos

- `SystemTreeSelector` é usado em 4 lugares dentro do `apps/mesas` (`CatalogoPage`, `OnboardingPage`, `StepSystem` do `CreateTableForm`, `UserSystemsSelector`). Mudar o componente compartilhado exige smoke nos 4; criar um componente de autocomplete separado só para o catálogo evita esse risco, mas duplica lógica de busca — decisão fica para o `plan.md`.
- Nenhum outro app (`glossario`, `site`, `accounts`, `links`) consome esses componentes — risco fica contido em `apps/mesas` e, para o item de contagem, em `apps/glossario`.
- Migration/schema: nenhuma mudança de schema é necessária (estilos e sistemas já existem como dados; o que muda é a forma de consultar/exibir).
