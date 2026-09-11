# Auditoria Downloads Beta — visual, funcional e build

URL auditada: `https://downloadsbeta.artificiorpg.com`

Data: 2026-07-23

## Achado adicional — tema visual

Evidência fornecida pelo mantenedor: o modo dark aparece como uma tela predominantemente navy, com conteúdo/áreas sem hierarquia visual suficiente; no modo light, somente o Header acompanha a troca de tema. O restante permanece com aparência dark ou contraste inadequado.

### Diagnóstico no código

- `AppShell.tsx` fixa o wrapper em `bg-[var(--color-artificio-blue)] text-white`.
- `Footer` é renderizado sem `variant`, portanto usa o default `light`, enquanto o wrapper continua navy.
- Shells e numerosas páginas usam `text-white`, `border-white/*` e `bg-[var(--color-artificio-blue)]` diretamente.
- `packages/ui` já fornece tokens semânticos (`--canvas`, `--surface`, `--fg`, `--line`) e o Header reage a `data-theme`; o conteúdo Downloads não os consome de forma integral.

### Veredito do tema

- **Dark:** parcialmente visualizado, mas com composição predominantemente navy e conteúdo sem diferenciação suficiente.
- **Light:** não implementado de ponta a ponta; Header troca, conteúdo e shells permanecem presos a tokens/classes dark.
- **Código buildado:** o toggle/header e tokens compartilhados estão presentes; a migração completa do conteúdo Downloads para tokens semânticos não está presente.
- **Ação:** somente especificar e validar em 082; nenhuma correção foi aplicada nesta auditoria.

## Visual confirmado

### Home `/`

- Título: “Materiais gratuitos de RPG”.
- Hero e CTA “Explorar catálogo”.
- Header Artifício compartilhado, links Portal/Glossário/Mesas/Downloads/Esferas/SRD/WhatsApps.
- Busca, changelog, alternância de tema e conta SSO visíveis.
- Footer e links institucionais renderizados.
- Sem erro de console `warn/error` observado nesta rota.

### Catálogo `/catalogo`

- Título “Catálogo”.
- Busca “Buscar materiais”.
- Ordenação: Relevância, Mais recentes, Mais populares, Nome (A-Z).
- Estado inicial “Carregando…”.
- Após esperar o carregamento: “Falha ao carregar materiais. Tente novamente.”
- Nenhum card, faceta, paginação ou material foi exibido.

## Funcional confirmado

| Fluxo | Resultado |
|---|---|
| Abrir Home | passa |
| Navegar para Catálogo | passa |
| Renderizar controles do catálogo | passa |
| Popular materiais | falha |
| Ficha de material | não testável sem material listado |
| Busca/filtro/ordenação real | não testável sem API |
| Submissão | não comprovada |
| Moderação/publicação | não comprovada |
| Download/redirect | não comprovado |
| Painel/gestão | não comprovado |

## O que saiu no build frontend

Com base no DOM live e no artefato local `apps/downloads/frontend/dist`:

- Shell e Home estão no bundle.
- Rota `/catalogo`, busca, select de ordenação, estados de carregamento/erro estão no bundle.
- Bundle local contém chamadas/strings de materiais, gestão, submissão e rotas de API; existência no bundle prova somente que o código foi compilado, não que o backend respondeu.
- O artefato local tem `index-DV1BPgmv.js`, `index-9hntxIx8.css` e vendors React/Query; timestamps locais não são prova do timestamp da imagem Beta.

## O que não saiu ou não está comprovado

- Cards e dados de materiais não chegaram ao usuário.
- API/DB saudável não está comprovada; o catálogo termina em erro.
- `/api/v1/health` não foi validado live nesta rodada.
- Resposta 401 de `/api/v1/materials/mine` não foi validada live nesta rodada.
- Fluxo ponta a ponta submissão→moderação→publicação→download não foi executado.
- Storage/provider, checksum, migrations aplicadas e rollback não foram comprovados.

## Contraste com o código de deploy

O manifesto declara `downloads-beta-api`/`downloads-beta-app` como health containers e `/api/v1/health`/Home/`materials/mine` como rotas críticas. O compose declara `pgdata_downloads_beta`, enquanto a sessão de 2026-07-20 registrou volumes divergentes e API `42P01`. Logo, o build frontend pode estar correto e servido mesmo com o backend apontando para banco vazio/errado.

## Veredito

**Frontend visual: parcialmente entregue e servido.**

**Produto funcional: bloqueado no catálogo.**

**Downloads Beta: não aprovado para promoção/produção.**
