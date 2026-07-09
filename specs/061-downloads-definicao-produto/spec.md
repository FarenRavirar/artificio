# Spec 061 — Downloads: investigação e definição do produto

- **Estado:** investigação
- **Nível SDD:** Completo
- **Escopo:** definição prévia; zero código
- **Projeto futuro:** `downloads.artificiorpg.com`
- **Ambientes:** `downloadsbeta.artificiorpg.com` (beta) e `downloads.artificiorpg.com` (produção)

## Problema

O projeto `downloads` existe no roadmap apenas como nome/host e na descrição antiga “materiais traduzidos”. Falta definir produto, regras, dados, moderação, UX, segurança, armazenamento, operação e sequência de implementação antes de criar `apps/downloads`.

## Visão inicial do produto

Catálogo comunitário de materiais gratuitos para RPG, inspirado na utilidade do antigo Dungeonist e na riqueza de metadados do DriveThruRPG, mas com identidade e design do Artifício RPG.

- Visitante: descobre, pesquisa, filtra, consulta detalhes e segue o link externo do material.
- Usuário autenticado via `accounts.artificiorpg.com`: cadastra e mantém materiais gratuitos.
- Artifício hospeda metadados e, opcionalmente, imagens de capa no Cloudinary compartilhado.
- O usuário escolhe: enviar arquivo para os providers externos integrados ou cadastrar um link externo autorizado.
- O Artifício guarda catálogo/metadados e resolve o destino; arquivo enviado vive no provider externo.
- Ordem definida de storage: **Cloudflare R2** primário; ao esgotar a cota, **Backblaze B2**; depois **Fastio**; por último **Cloudinary para PDF**.
- O destino pode ser link direto autorizado ou página de distribuição externa (ex.: item gratuito na DMsGuild); login, newsletter ou outra barreira devem ser sinalizados.
- Layout público respeita o shell compartilhado, com submenu abaixo do nav e sidebar lateral para descoberta/filtros.

## Regra pétrea do app

**`downloads` é hub de catálogo, descoberta e redirecionamento — nunca marketplace, checkout ou biblioteca comercial.**

- Objetivo: catalogar materiais gratuitos e permitir encontrá-los.
- A ação final sempre leva ao destino do material: link externo informado ou URL lógica que redireciona ao arquivo guardado em provider externo.
- O app não vende, cobra, processa pagamento, calcula comissão nem oferece produto pago.
- “Upload no Artifício” significa envio mediado pelo backend para R2/B2/Fastio/Cloudinary; não significa arquivo durável na VM ou no filesystem do app.
- Referência conceitual de distribuição: diretório/redirecionador como o Baixaki antigo, adaptado a materiais gratuitos de RPG.
- Esta regra prevalece sobre descrições históricas de “marketplace”, “loja”, “download hospedado” ou “biblioteca”.

## Decisões de produto fechadas

1. Todo cadastro e toda edição publicada entram em moderação antes de publicação.
2. A autorização de auto-publicação deve existir no modelo de permissões, porém ficar desativada por padrão. Futuro: admin concede por usuário/role sem remodelar o domínio.
3. O publicador declara seu papel: autor, tradutor, editora/selo ou curador de material de terceiro.
4. Curadoria de terceiros é aceita quando o usuário declara que o material é gratuito e sua divulgação é permitida.
5. O produto é catálogo/hub. Aceita link direto autorizado, página externa de distribuição ou upload mediado para provider externo; em todos os casos a ação final é redirecionamento/resolução de destino.
6. Link que exige login, cadastro, newsletter ou outra barreira é aceito, mas deve carregar flags visíveis.
7. Material sem licença explícita só pode entrar quando declarado como produção de fã; ainda fica sujeito a moderação/remoção.
8. Comentários, avaliações, favoritos e coleções pertencem ao MVP.
9. Criador, autor ou editora terá perfil público.
10. Métricas públicas incluem cliques e favoritos, rotuladas corretamente; clique externo nunca será chamado de download concluído.
11. Links externos terão verificação periódica de disponibilidade e segurança.
12. Taxonomia buscará paridade funcional com os filtros atuais do DriveThruRPG, adaptada ao catálogo gratuito e registrada por snapshot verificável antes do schema.
13. Não há legado WP de `downloads` a importar. Menções antigas a CPT `docs`, página `material-online` ou categoria `downloads` não constituem acervo deste produto.
14. Storage de arquivos usa cadeia ordenada: R2 → B2 → Fastio → Cloudinary PDF. Capas continuam no Cloudinary compartilhado.
15. `downloads` terá beta e produção como os demais projetos. Não cria modelo próprio: herda a esteira, convenções, isolamento e gates canônicos vigentes no momento da implementação.
16. O Artifício não terá pagamento, produto pago, checkout, carrinho, comissão, split, saldo ou biblioteca de compras. D102 permite somente redirecionar a uma página PWYW externa com opção real de valor zero.
17. DriveThruRPG é referência máxima de configuração, metadados, taxonomia e filtros; Dungeonist é referência visual, sem importar seu modelo comercial.
18. Antes de implementar qualquer parte de `downloads`, a primeira spec filha deve planejar a migração para um banco/catálogo canônico único de sistemas/edições compartilhado por `mesas`, `glossario` e `downloads`.
19. Material PWYW é aceito somente por link para página externa de aquisição, com opção zero verificável e sinalização pública; nunca pode ser enviado ou armazenado pelos providers do Artifício.

## Questões ainda abertas

- Como verificar periodicamente que destino PWYW ainda permite adquirir por zero?
- Qual evidência/declaração basta para permissão de divulgação e produção de fã?
- Quais eventos suspendem automaticamente um link/material?
- Qual é o produto/contrato exato chamado “Fastio” e quais APIs/limites oferece?
- O fallback ocorre somente para novos uploads ou também migra objetos existentes?
- Como medir cota, evitar split-brain e preservar URL estável entre providers?
- Qual limiar libera auto-publicação e quem pode conceder/revogar a permissão?
- Qual arquitetura centraliza sistemas/edições sem acoplar indevidamente os bancos dos três apps?

## Pré-requisito bloqueante — catálogo único de sistemas

`mesas` e `glossario` já mantêm cadastro/gerenciamento de sistemas. `downloads` não criará uma terceira fonte concorrente.

Antes de qualquer spec de implementação do app:

- auditar schema, dados, APIs, administração, consumidores e diferenças semânticas de sistemas/edições em `apps/mesas` e `apps/glossario`;
- definir o contrato comum necessário a `downloads`;
- comparar banco/serviço central, API compartilhada, pacote versionado, replicação/sync e outras opções;
- decidir ownership, disponibilidade, cache, IDs canônicos, aliases, versões/edições, migrations, autorização admin e isolamento de falhas;
- planejar migração/deduplicação e compatibilidade sem quebrar consumidores existentes;
- definir testes, rollout, rollback e observabilidade;
- somente depois liberar schema/taxonomia/backend de `downloads`.

“Unificar” significa um banco/catálogo canônico e um gerenciamento únicos para sistemas/edições. A investigação não decide se haverá unificação; decide ownership, localização, contrato de acesso e migração. Os demais dados de domínio dos três apps continuam isolados.

## Requisitos desta spec

- **R1** — Definir proposta de valor, públicos, jornadas e limites do produto.
- **R2** — Produzir inventário de perguntas abertas com método de resolução.
- **R3** — Investigar referências reais: Dungeonist, DriveThruRPG e alternativas atuais.
- **R4** — Registrar formalmente que não há legado WP de `downloads` a migrar e impedir que ocorrências históricas sejam tratadas como acervo.
- **R5** — Definir taxonomia e metadados mínimos/candidatos.
- **R6** — Definir modelo de autoria, propriedade, licença, gratuidade, denúncias e remoção.
- **R7** — Definir fluxo de submissão, revisão, publicação, edição, arquivamento e recurso.
- **R8** — Definir descoberta pública: busca, filtros, ordenação, sidebar, submenu, detalhe e perfil do publicador.
- **R9** — Definir adapter multi-storage para arquivos na ordem R2 → B2 → Fastio → Cloudinary PDF; capas permanecem no Cloudinary compartilhado; VM não armazena arquivo durável.
- **R10** — Decompor implementação em specs independentes, ordenadas por dependência.
- **R11** — Cada spec filha deve ter objetivo, dependências, entregáveis, gates e testes.
- **R12** — Não criar código, migrations, containers, DNS, APIs nem mocks executáveis nesta spec.

## Metadados a investigar

- título, subtítulo, descrição curta e completa;
- capa, galeria/amostras permitidas e texto alternativo;
- URL externa principal e URLs alternativas;
- autor(es), tradutor(es), editora/selo e publicador no Artifício;
- sistema, edição, compatibilidade, cenário e regras requeridas;
- tipo de material, tema/gênero, idioma e número de páginas;
- formato externo, VTT/plataforma, acessibilidade e versão/data de atualização;
- licença, uso de conteúdo de terceiros, classificação etária e avisos;
- gratuidade declarada, exigência de conta/login/newsletter e “pague quanto quiser”;
- papel do publicador: autor, tradutor, editora/selo ou curador;
- tags, créditos, status e motivo de moderação;
- métricas permitidas sem fingir download hospedado.

## Fora de escopo

- Implementação de qualquer natureza.
- Implementação do upload/armazenamento/proxy de PDF, ZIP ou outros arquivos (será spec filha).
- Marketplace, checkout, pagamento, comissão ou material pago.
- Biblioteca de compras, carteira, saldo, cupom, afiliado ou processamento financeiro.
- Decisão automática por IA.
- Importação automática do legado WP.
- DNS, Tunnel, deploy ou criação de banco.

## Critérios de saída

- Produto definido o bastante para evitar decisões estruturais durante coding.
- Perguntas críticas resolvidas ou transformadas em investigações/gates explícitos.
- Mapa de specs filhas completo e ordenado.
- Riscos legais, abuso, segurança e operação com donos/testes definidos.
- `specs/backlog.md`, roadmap, README, decisões e sessão sincronizados.

## T0.4 — Auditoria dos contratos reais reutilizáveis

Auditoria concluída em 2026-07-08 no código real. O bundle canônico contém 290 operações: accounts 11, glossario 46, links 22, mesas 179 e site 32. `downloads` ainda não tem código/API.

### Auth e autorização

**Reusar:**

- `packages/auth/src/middleware.ts`: `requireAuth` aceita bearer ou cookie `artificio_session`, valida JWT e injeta `session`.
- `packages/auth/src/csrf.ts`: Origin allowlist + double-submit `xsrf_token`/`x-xsrf-token` para mutações com cookie.
- `packages/auth/client`: sessão, login central e logout usados pelo Header.

**Adaptar:**

- Role SSO continua somente `user|admin`. Auto-publicação não deve ampliar role global nem tocar `packages/auth`.
- Permissões específicas (`can_auto_publish`, suspensão, limites) pertencem ao banco de `downloads`, vinculadas ao `user_id` SSO, concedidas/revogadas por admin.
- Ownership precisa usar ID estável da sessão; email/nome são snapshot de apresentação, não chave de autorização.

### Shell, submenu, sidebar e design

**Reusar:**

- `packages/ui/src/modules.ts`: `Downloads` e `MODULE_ORIGINS.downloads` já existem na nav compartilhada.
- `packages/ui/src/Header.tsx`: `moduleNav`/`moduleCurrentHref` já implementam submenu na segunda linha; inclui SSO, menu de conta, busca, changelog, tema e mobile nav.
- `packages/ui`: Footer, tokens, tema, primitivas, `ConfirmDialog` e `FileDropzone`.

**Adaptar:**

- Sidebar de `apps/links/src/components/Sidebar.astro` prova drawer mobile, backdrop, Escape e grupos recolhíveis; serve como referência comportamental, não componente para copiar.
- `downloads` será React; sidebar deve ser componente próprio do app ou nova primitiva compartilhada somente após provar reuso real.
- Não copiar CSS/markup do links: o componente é Astro, acoplado a categorias/regras e chama `focus()` no `aside` sem contrato de foco reutilizável.

### Mídia e arquivos

**Reusar:**

- `packages/media/src/index.ts` é o contrato compartilhado atual do Cloudinary: `configure`, `isConfigured`, `uploadBuffer`, `uploadFromUrl`, `deleteAsset` e `destroyAssetResult`.
- Upload é backend signed; `uploadFromUrl` valida imagem, rejeita SVG, limita 10 MB, aplica timeout e usa hash SHA-256 como `public_id`.
- Padrão `apps/links/server/lib/cloudinary.ts`: wrapper fino por domínio e persistência de URL + `public_id`.

**Gap estrutural:**

- `@artificio/media` é Cloudinary-only; não oferece interface genérica, streams, R2/B2/Fastio, quota, failover, checksum independente ou URL lógica.
- `uploadFromUrl` aceita apenas imagem. PDF deve usar `uploadBuffer(... resourceType: "raw"|"auto")` no fallback Cloudinary, com validação própria.
- Storage multi-provider exige spec compartilhada própria. Não enfiar R2/B2 no pacote atual sem SDD Completo e análise de todos os consumidores.

### Submissão, moderação e denúncias

**Baseline técnico principal: `apps/mesas`:**

- Reusar arquitetura React 19/Vite + Express 5/Kysely/Postgres, organização frontend/backend/database, schemas Zod, API client, TanStack Query, migrations, auth, CSRF e testes.
- Reusar padrões maduros de ownership, perfis públicos, painel do usuário, gestão admin, estados, moderação em lote, auditoria, paginação, filtros, upload de imagem, tratamento de erros e rotas públicas/privadas.
- Reusar a disciplina de contratos API/OpenAPI, validação frontend+backend, rate limit, health/smokes e isolamento beta/prod.
- Adaptar domínio; não copiar entidades, regras ou complexidade específica de mesas/Discord.

**Referência complementar estreita: `apps/links`:**

- `POST /api/groups/suggest`: usuário autenticado sugere; item nasce `pending`.
- Admin usa `/api/admin/v1/groups`, accept/archive/PATCH/DELETE.
- Denúncia pública autenticada: `POST /api/groups/{slug}/report`; estados `open|resolved|dismissed`.
- Banco possui status `pending|active|archived|rejected`, `submitted_by`, snapshots de email/nome, `approved_at`, slug parcial único e índices de listagem.
- Rate limits separados existem para sugestão, denúncia e rotas públicas/admin.

**Não copiar sem corrigir:**

- `links` denormaliza usuário e não possui ownership/edição pelo publicador.
- Workflow é curto demais para downloads: faltam draft, pending_update, published, rejected com motivo, suspended, takedown, recurso e histórico imutável.
- Auto-publicação precisa ser permissão app-local, nunca bypass solto na rota.
- Comentários, avaliações, favoritos e coleções são domínios novos; `@artificio/feedback` é feedback técnico/bug, não comentário ou review de material.

### Feedback técnico

**Reusar:**

- `packages/feedback`: parser/normalização e limites para bug/sugestão, diagnóstico de console/rede e screenshot.
- `packages/ui/feedback`: copy e tipos do widget.

**Separar:**

- Feedback técnico continua separado de denúncia, comentário e avaliação.
- Cada domínio terá tabela, moderação, rate limit e política próprios.

### Analytics

**Reusar:**

- `packages/analytics`: `trackPageview`, `trackSearch`, `trackEvent`; remove query string de pageview, redige email da busca e evita PII óbvia.
- GA4 compartilhado/cross-subdomínio já é contrato da suite.

**Adicionar depois:**

- Eventos de downloads devem ser catálogo sem PII: `view_material`, `select_external_link`, `file_download_start`, `file_download_result`, `favorite`, `collection_add`, `filter_material`.
- Clique externo não pode ser registrado/nomeado como download concluído.
- Métricas públicas vêm do banco agregado e antifraude; GA4 não é fonte pública de contagem.

### SEO/content

**Reusar:**

- `packages/content`: meta/canonical/Open Graph/Twitter, sitemap, robots, breadcrumbs e JSON-LD básicos.

**Adaptar:**

- Criar JSON-LD de material/catalog item adequado após pesquisa (`CreativeWork`, `Book` ou tipo mais específico); não usar `Article` por conveniência.
- Sempre passar canonical e identidade do host `downloads`; defaults do `SITE` raiz não devem vazar para o subdomínio.
- Páginas indexáveis: catálogo, detalhe e perfis públicos. Busca combinatória/filtros precisam política de canonical/noindex para evitar explosão SEO.

### API

- Fonte canônica confirmada: `docs/api/generated/artificio-api.bundle.json`.
- Padrão útil de `links`: API pública de lista/detalhe/tags; self-service autenticado; namespace `/api/admin/v1`; health sem auth.
- `downloads` precisa OpenAPI antes da implementação e deverá entrar no bundle/`verify:api`.
- Rotas candidatas não estão fechadas nesta fase; nenhuma deve ser copiada da memória/chat.

### Deploy e banco

**Reusar:**

- `.github/deploy-manifest.json` + `deploy.yml` + `_deploy-module.yml`: manifesto declarativo, beta/prod, `deploy_paths`, DB, containers, health e critical routes.
- Migrations SQL classificadas (`@class`, `@requires-backup`) e aplicadas pelo framework canônico.
- Padrão de smoke: health 200, home 200, endpoint privado sem cookie 401 e redirect/login SSO.

**Necessário para downloads:**

- Entrada própria no manifesto somente na spec de infraestrutura.
- Hosts previstos: `downloadsbeta.artificiorpg.com` e `downloads.artificiorpg.com`.
- Reproduzir exatamente o padrão vigente dos demais módulos no manifesto, compose, banco, containers, secrets, storage, gates e promoção; não inventar fluxo específico para downloads.
- Smokes adicionais: catálogo público, submissão 401, admin 401 e URL lógica de arquivo sem expor credencial/provider.
- Deploy não configura DNS/Tunnel; ação continua separada e aprovada.

### Veredito T0.4

- Baseline técnico e estrutural: `apps/mesas`, por ser o app mais avançado e completo.
- Referência funcional complementar: `apps/links` somente para sugestão simples/moderação/denúncia.
- Melhor referência visual: `Header.moduleNav` + comportamento responsivo da sidebar de links.
- Reuso direto: auth, CSRF, Header/Footer/tokens, feedback técnico, analytics base, content base e pipeline de deploy.
- Extrações novas obrigatórias: storage multi-provider e, possivelmente, sidebar compartilhada somente após implementação local provar generalidade.
- Antiatalho: não modelar downloads como clone de links, não copiar domínio Discord/mesas e não estender role SSO global para auto-publicação.

## T1.1 — Reconstrução verificável do Dungeonist histórico

Pesquisa concluída em 2026-07-08. O domínio oficial está fora do ar; tentativas de abrir capturas do Internet Archive/Arquivo.pt foram bloqueadas pelo acesso disponível. A reconstrução abaixo separa evidência de inferência.

### Fatos sustentados por fontes

1. **Era marketplace brasileiro especializado em RPG digital.** Fonte acadêmica de 2019 cita `dungeonist.com/marketplace/` e afirma que a plataforma hospedava centenas de sistemas. Relatos comunitários posteriores a descrevem como polo agregador/marketplace brasileiro.
2. **Atendia autores independentes e editoras.** A cobertura do encerramento afirma que criadores de conteúdo e editoras perderiam acesso ao principal marketplace de RPG do Brasil. Comunidade o usava para encontrar aventuras, sistemas e materiais independentes.
3. **Vendia PDFs e também aceitava itens gratuitos.** Há registro de compra de PDF, páginas externas apontando “Loja: Dungeonist” e preço, além de autor divulgando demo gratuita em PDF hospedada no Dungeonist.
4. **O catálogo incluía sistemas, aventuras e suplementos.** Relatos de usuários citam “aventuras, sistemas e tudo mais dos autores independentes”; exemplos verificáveis incluem RPG completo/demo, aventura e ficha editável.
5. **Tinha operação editorial/comercial real.** A notícia de encerramento relata gerenciamento de chamados, integração com pagamentos e aprovação de novos produtos.
6. **Autores recebiam participação da venda.** Cobertura contemporânea informa faixa de 65% a 75% do valor do produto destinada aos autores.
7. **O encerramento foi gradual e motivado por custo/tempo operacional.** Anúncio de março de 2022 previa parar novos produtos no fim de abril e transformar a empresa de marketplace em editora; fontes comunitárias registram postergação e novo encerramento anunciado para abril de 2023.
8. **Seu fim deixou lacuna de descoberta/distribuição nacional.** Discussões após o encerramento perguntam onde encontrar/comprar material independente e, ainda em 2024, descrevem ausência de polo agregador brasileiro equivalente.

### Fontes usadas

- [Joga o D20, 12/04/2022, “Dungeonist encerrará o serviço de Marketplace”](https://jogaod20.com/2022/04/12/dungeonist-marketplace/): natureza do negócio, públicos, aprovação de produtos, pagamentos, suporte, comissão e plano de encerramento.
- [TCC/UnB de 2019](https://bdm.unb.br/bitstream/10483/32118/1/2019_ChristiaTellesPiresAlves_tcc.pdf): URL do marketplace e afirmação de centenas de sistemas hospedados.
- [Guilda dos Mestres, “Lawful Good RPG”](https://guildadosmestres.com.br/lawful-good-rpg/): exemplo de aventura em PDF, sistema, loja e preço.
- [Reddit `r/rpg_brasil`, 2021, “[FREE] Pluralyiah RPG em PDF na Dungeonist!”](https://www.reddit.com/r/rpg_brasil/comments/kw13x7): exemplo de autor publicando demo gratuita.
- [Reddit, 2022, discussão após o fim](https://www.reddit.com/r/rpg_brasil/comments/tvrtzp) e [Reddit, 2024, ausência de polo agregador](https://www.reddit.com/r/rpg_brasil/comments/1h76ppj): impacto do encerramento e função de polo agregador.
- [iRPGdb](https://irpgdb.com/supplement/aventuras-foices-feiticos-versao-introdutoria/): produto disponível no DriveThruRPG ou Dungeonist.

### Inferências razoáveis — não tratar como fato de interface

- Existia conta/fluxo de fornecedor para enviar produto, porque havia prazo para inserir produto novo e aprovação operacional.
- Produto provavelmente guardava autor/editora, preço, sistema, arquivo e dados de apresentação, pois esses campos aparecem nos exemplos e eram necessários à venda; o schema exato não foi recuperado.
- Havia biblioteca/entrega pós-compra ou mecanismo equivalente, porque usuários relatam compra e acesso a PDFs; detalhes não foram recuperados.
- Descoberta por catálogo era valor central, mas filtros, ordenação, busca, avaliações, favoritos e coleções do Dungeonist **não foram comprovados**.

### Lacunas não recuperadas

- Capturas navegáveis das telas e formulários.
- Lista exata de filtros/categorias/metadados.
- Política de conteúdo, licenças, takedown e pirataria.
- Processo detalhado de aprovação/reprovação e SLA.
- Limites/tipos de arquivo, storage e entrega.
- Reviews, comentários, favoritos, perfis e analytics.
- Termos comerciais completos, taxas ao comprador e meios de pagamento.

### Lições para `downloads`

**Adotar:**

- Foco brasileiro e descoberta de produção independente.
- Catálogo unificado para autores, editoras e materiais gratuitos.
- Perfil público e relacionamento material↔autor/editora/sistema.
- Submissão com moderação e capacidade futura de publicação confiável.

**Adaptar:**

- Downloads começa gratuito e sem checkout; remove pagamentos/comissão do MVP.
- Aceita curadoria de terceiro e links externos, não só upload do detentor.
- Deve sinalizar barreiras externas e origem do arquivo.
- Taxonomia será baseada em evidência atual do DriveThruRPG, não numa lembrança não verificável do Dungeonist.

**Evitar:**

- Operação manual sem ferramentas, métricas ou automação: suporte + pagamentos + aprovação consumiram tempo/dinheiro e contribuíram para o encerramento.
- Acoplar catálogo, storage e operação editorial sem adapters/filas.
- Depender de um único storage ou de conhecimento preso na equipe.
- Prometer auto-publicação antes de histórico, confiança, denúncias e kill switch.

### Veredito T1.1

Dungeonist valida a necessidade de um polo brasileiro e o valor para independentes, mas não oferece especificação recuperável suficiente para copiar UI/schema. Para a 061 ele é referência de missão e risco operacional; DriveThruRPG será referência verificável de taxonomia/metadados, e `apps/mesas` seguirá baseline técnico.

### Limite de aplicação do Dungeonist

- Referência visual e histórica de polo brasileiro.
- Não copiar pagamentos, comissão, checkout, operação de loja ou biblioteca comercial.
- Quando houver conflito, a configuração do DriveThruRPG e a regra pétrea de hub gratuito prevalecem.

## T1.1b — DriveThruRPG como referência máxima de configuração

**Estado:** concluído em 2026-07-08.

Objetivo: levantar o DriveThruRPG atual como fonte principal de campos, taxonomias, filtros, relações e configuração editorial do material. A investigação deve cobrir:

- ficha completa de produto/material;
- sistemas, edições, regras, cenários e compatibilidades;
- categorias/tipos de produto;
- formatos digitais, VTTs e acessibilidade;
- idiomas, autores, editoras e selos;
- tags, gêneros, temas, público e classificação;
- filtros, ordenações, busca e navegação;
- perfis/páginas de criadores e editoras;
- avaliações, comentários, favoritos/wishlist e coleções;
- datas, versões, atualizações e changelog;
- capas, previews, amostras e créditos;
- declaração de licença e conteúdo comunitário/fan content;
- campos comerciais existentes somente para identificar e excluir do Artifício.

### Regra de tradução para o Artifício

- **Puxar:** configuração, metadados, taxonomia, filtros e profundidade de catálogo.
- **Adaptar:** perfis, avaliações, favoritos, coleções e páginas de material ao contexto gratuito.
- **Excluir:** preço, desconto, carrinho, checkout, pagamento, comissão, afiliado, saldo e biblioteca de compras.
- **Adicionar:** origem do destino (`external_link|managed_upload`), flags de login/newsletter, provider/storage, verificação do link e permissão de divulgação.
- Resultado final deve ser uma matriz campo/filtro do DriveThruRPG → equivalente Artifício → decisão (`adotar|adaptar|excluir`) → justificativa.

### Evidência e limite

- Fontes primárias usadas: Partner Help Center e Customer Help Center atuais.
- O browse público retornou HTTP 403 ao leitor automatizado. Portanto, a estrutura/configuração está comprovada; a lista literal de todos os valores atuais de cada filtro continua em T1.2.
- Não foram usados screenshots antigos como contrato atual.

### Matriz de configuração

| DriveThruRPG | Artifício Downloads | Decisão | Regra |
|---|---|---|---|
| Title | `title` | adotar | Obrigatório; título público e base do slug. |
| Author(s) | autores relacionados | adotar | Relação N:N; não texto único. |
| Artist(s) | créditos/contribuidores | adaptar | Papel tipado: artista, tradutor, editor, diagramador etc. |
| Publisher | perfil público de editora/selo | adotar | Pode coexistir com autor e publicador SSO. |
| Product page text | descrição curta + completa | adaptar | Sanitizada; links externos separados em campos próprios. |
| Number of pages | `page_count` | adotar | Opcional conforme tipo/formato. |
| Cover 736×953 PNG/JPG/GIF | capa Cloudinary | adaptar | Mesma proporção recomendada; formatos/limite seguem contrato Artifício, com alt obrigatório. |
| Product preview | preview/amostra | adaptar | Capa, galeria e amostra permitida; sem gerar preview integral automaticamente no MVP. |
| Video/graphics in description | mídia de apresentação | adaptar | URLs allowlisted; sem HTML arbitrário. |
| Category Assignments / Filters | taxonomias controladas | adotar | Fonte principal de descoberta; vocabulário administrável e versionado. |
| System Rules | sistema + edição + compatibilidade | adotar | Só marcar quando regras forem realmente requeridas. |
| Any System/System Agnostic | agnóstico de sistema | adotar | Valor explícito; não duplicar em todos os sistemas. |
| Genre | gênero/tema | adotar | Vocabulário controlado; `multi-genre` quando adequado, evitando tag spam. |
| Product Type | tipo de material | adotar | Livro básico, aventura, suplemento, cenário, mapa, ficha, gerador, referência, assets etc.; enum final em T1.2. |
| Format | formatos disponíveis | adotar | PDF, EPUB, MOBI, imagem/mapa, VTT, STL/OBJ e outros permitidos; separar tipo lógico de extensão. |
| Virtual Tabletops | plataforma VTT | adotar | Roll20, Foundry, Fantasy Grounds etc.; valores finais em T1.2. |
| Digital Format Label | rótulo de formato | adaptar | Derivado dos arquivos/destinos; não texto comercial livre. |
| Source of PDF: electronic/scanned | origem técnica | adotar | `born_digital|scanned`; útil para qualidade/acessibilidade. |
| Creation Method | método de criação | adotar | `human_without_ai|contains_ai`; política própria precisa ser fechada. |
| Adult flag | conteúdo adulto/classificação | adaptar | Usar classificação etária + avisos; opt-in/filtro conforme política brasileira. |
| Language/site locale | idioma do material | adotar | Multi-idioma por material/arquivo; não confundir idioma da UI. |
| Product requirements | requisitos | adotar | Sistema/livro-base/software/VTT/impressão necessários. |
| Intended audience | público-alvo | adotar | Mestre, jogador, ambos, educador, criador etc. |
| Print/screen orientation | características de uso | adotar | Impressão necessária/opcional, ink-friendly, screen-friendly, retrato/paisagem. |
| Run time / usage notes | duração/escopo | adaptar | Aplicável por tipo: duração, nível, quantidade de jogadores, escala de mapa. |
| Main + supplementary files | variantes/arquivos | adotar | Um material pode ter múltiplos arquivos/links e formatos. |
| Template from previous title | duplicar cadastro | adaptar | Futuro: duplicar material próprio como draft, sem copiar ownership indevido. |
| Batch edit for verified partner | edição em lote | adaptar | Ferramenta admin/autor confiável futura; auditada. |
| Private/Public toggle | estados editoriais | adaptar | `draft→pending_review→published`; publicação direta só com permissão gated. |
| Approval for unverified partner | moderação por confiança | adotar | Todos moderados inicialmente; auto-publicação concedível/revogável. |
| Publisher verification | confiança do publicador | adaptar | Permissões app-local, nunca nova role SSO global. |
| Future release date | publicação agendada | adaptar | Pós-MVP; sem venda, apenas visibilidade futura. |
| 3 public titles/24h | limite de publicação | adaptar | Rate limit/configuração anti-spam, não regra fixa copiada. |
| Updates/new file versions | versões e changelog | adotar | Versão, data, notas e arquivos/destinos ativos. |
| Public publisher page | perfil público | adotar | Autor, editora/selo e catálogo relacionado. |
| Search title/publisher/system | busca full-text/facetada | adotar | Também descrição, autores, tags e compatibilidade. |
| List/tile views | lista/cards | adotar | Preferência responsiva; sidebar de filtros. |
| Sort title/publisher/system/date | ordenação | adaptar | Relevância, recentes, atualizados, avaliação, favoritos e cliques. |
| Wishlists | favoritos | adaptar | Favorito simples + notificações futuras sem desconto. |
| Collections | coleções do usuário | adotar | Um material em múltiplas coleções; privadas inicialmente. |
| Ratings/reviews | avaliações/comentários | adaptar | Política antifraude/moderação; separar nota de comentário. |
| Community Content Programs | licença/programa de fã | adaptar | Registrar IP/licença/programa aplicável; linkar política externa. |
| Illegal/infringing prohibition | declaração legal/takedown | adotar | Publicador garante permissão; denúncia e remoção auditáveis. |
| AI policy/filter | declaração de IA | adaptar | Transparência obrigatória; política Artifício será própria. |
| Apps/software prohibition | tipos permitidos | adaptar | Downloads define allowlist própria; não copiar proibição automaticamente. |
| Price/download price | — | excluir | Produto é sempre gratuito. |
| Purchase note | notas de acesso/barreiras | adaptar | Converter para instruções de acesso: login, newsletter, senha, conta externa. |
| Cart/checkout/account credit | — | excluir | Proibido por D095. |
| Discounts/coupons/sales | — | excluir | Proibido por D095. |
| Royalties/accounting/sales reports | — | excluir | Sem venda/comissão; relatórios serão de catálogo. |
| POD/printing fulfillment | — | excluir | App só cataloga material digital gratuito. |
| Purchase library/download status | histórico/favoritos/coleções | adaptar | Sem biblioteca comercial; histórico de acesso opcional e privado. |
| Watermarking commercial | — | excluir | Não necessário no hub gratuito por padrão. |

### Campos próprios necessários

Estes não vêm do modelo comercial do DriveThruRPG:

- `source_type`: `external_link|managed_upload`;
- destino externo direto ou página de distribuição;
- provider real e object key internos quando upload gerenciado;
- URL lógica pública independente de provider;
- flags `requires_login`, `requires_registration`, `requires_newsletter`, `pay_what_you_want`;
- estado/resultado da verificação de link/arquivo;
- papel de quem cadastrou: autor, tradutor, editora/selo ou curador;
- declaração/evidência de gratuidade, licença e permissão de divulgação;
- status de moderação, motivo, histórico, recurso e takedown;
- permissionamento local de auto-publicação;
- métricas de clique, favorito e acesso iniciado, sem chamar clique de download concluído.

### Fluxo de cadastro derivado

1. Escolher `link externo` ou `upload gerenciado`.
2. Identificar papel do publicador e titularidade/permissão.
3. Anexar prova verificável de gratuidade ou possibilidade jurídica de divulgação/publicação.
4. Informar título, autores/créditos, editora/selo e descrição.
5. Selecionar sistema/edição, tipo, gênero, formato, idioma, público e requisitos.
6. Informar classificação/avisos, método de criação e licença/programa de fã.
7. Adicionar capa, previews e arquivos/links.
8. Marcar barreiras externas e instruções de acesso.
9. Revisar preview do card/detalhe.
10. Salvar draft ou enviar à moderação.
11. Publicar após aprovação; usuário confiável poderá auto-publicar quando permitido.

## Regra de prova para aprovação — D100

Nenhum material pode ser aprovado somente pela declaração do usuário. Toda submissão, própria ou de terceiro, exige ao menos uma evidência verificável:

- URL oficial mostrando que o material é gratuito ou que sua divulgação/distribuição é permitida;
- imagem ou captura mostrando gratuidade, permissão ou autorização;
- licença, autorização do titular, programa de conteúdo de fã ou outra base jurídica demonstrável que permita publicação/divulgação.

O moderador deve conseguir relacionar a prova ao material e ao tipo de uso pretendido. Link quebrado, captura sem origem/contexto ou alegação genérica não bastam. Dúvida mantém o item pendente ou leva à rejeição; nunca à aprovação presumida.

A evidência acompanha revisões posteriores. Mudança de link, arquivo, licença, titularidade ou forma de distribuição exige nova avaliação. Futura permissão de auto-publicação não elimina a obrigação de prova; apenas muda quem executa o ato editorial.

Ainda será definido em T3.2/T5.6: retenção, visibilidade, acesso administrativo, proteção de dados e armazenamento das imagens/documentos comprobatórios.

### Fontes primárias

- [Set Up a New Title or Edit an Existing Title Listing](https://help.drivethrupartners.com/hc/en-us/articles/12780799278103-Set-Up-a-New-Title-or-Edit-an-Existing-Title-Listing)
- [Product Standards Guidelines](https://help.drivethrupartners.com/hc/en-us/articles/12780748778135-Product-Standards-Guidelines)
- [Product Approval Checklist for New Partners](https://help.drivethrupartners.com/hc/en-us/articles/15316083891351-Product-Approval-Checklist-for-New-Partners)
- [Digital Title FAQ](https://help.drivethrupartners.com/hc/en-us/articles/12780762948631-Digital-Title-FAQ)
- [Navigating and Filtering Your Library](https://help.drivethrurpg.com/hc/en-us/articles/12723264045207-Navigating-and-Filtering-Your-Library)
- [How to Access Your Virtual Tabletop Content](https://help.drivethrurpg.com/hc/en-us/articles/12723267986839-How-to-Access-Your-Virtual-Tabletop-Content)
- [Wishlists](https://help.drivethrurpg.com/hc/en-us/categories/34632060222999-Wishlists)

### Veredito T1.1b

DriveThruRPG fornece boa espinha dorsal de configuração: ficha rica, taxonomia controlada, sistema/agnóstico, formatos múltiplos, requisitos, origem do PDF, criação/IA, classificação, previews, perfis, versões e moderação por confiança. Artifício adota essa profundidade, remove integralmente o comércio e acrescenta origem/link/storage/verificação/permissão. T1.2 permanece responsável apenas pelo snapshot literal dos valores atuais de cada filtro.

## T1.2 — Snapshot atual do DriveThruRPG

**Estado:** concluído em 2026-07-09.

### Método e limite

Fontes oficiais atuais:

- catálogo público novo do DriveThruRPG, inspecionado sem login em 2026-07-09;
- ficha pública real de produto;
- Partner Help Center: cadastro/edição, checklist de aprovação, padrões e FAQ digital;
- Customer Help Center: biblioteca, avaliações e PWYW.

O endpoint público `/en/browse` retornou 403 no leitor HTTP e apresentou falha de roteamento de locale no navegador (`/pt/en/browse`). A home pública e fichas de produto carregaram. Portanto:

- famílias de filtros, opções de primeiro nível, atalhos e parâmetros abaixo foram vistos no DOM atual;
- sistemas e editoras são catálogos dinâmicos: o menu exibe destaques, não todos os valores;
- não se transforma a lista destacada de sistemas/editoras em enum canônico;
- a Spec 062 fornece sistemas/edições; editoras serão entidades próprias do Downloads;
- folhas internas não visíveis e listas completas dinâmicas não são inventadas.

### O que é filtro, categoria ou navegação

| Superfície atual | Classificação | Uso no Artifício |
|---|---|---|
| `Publisher` | filtro facetado por entidade; menu mostra editoras destacadas | entidade/perfil de editora, não enum |
| `Genre` | taxonomia/filtro | vocabulário controlado expansível |
| `Product Type` | taxonomia hierárquica/filtro | vocabulário controlado próprio |
| `Rule System` | taxonomia/filtro por entidade | consumir catálogo canônico da Spec 062 |
| `Languages` | filtro facetado | vocabulário controlado por código de idioma |
| `Format` | grupo de formato e criação | separar formato de arquivo, plataforma e método de criação |
| `On Sale!` | atalho comercial | excluir |
| `Pay What You Want!` | atalho/regime de aquisição | adaptar: destino externo sinalizado, valor zero obrigatório, sem storage Artifício (D102) |
| `Free Titles!` | atalho de preço zero | adaptar para `access_cost=free` |
| promoções/faixas “under $5/$10” | navegação comercial | excluir |
| `Newest`, `Bestselling`, `Popularity`, `Newest Physical` | ordenações/strips | adaptar; excluir venda/físico |
| `Community Content`, `indie`, `exclusive`, `physical` | recortes editoriais/navegação | adaptar somente quando houver conceito equivalente |

### Valores públicos de primeiro nível observados

**Genre:**

- `Family Gaming`;
- `Fantasy`;
- `Historical`;
- `Horror`;
- `Modern`;
- `Science Fiction`;
- `Miscellaneous`.

**Product Type:**

- `Core Rulebooks`;
- `Supplements & Expansions`;
- `Maps & Miniatures`;
- `RPG Accessories & Merch`;
- `Media & Software`;
- `Magazines & Zines`;
- `Other Tabletop Games`;
- `Gift Certificates`;
- `Publisher Resources`.

Decisão de tradução: não copiar cegamente. `Gift Certificates`, produtos físicos/merch e comércio são excluídos. Os demais viram candidatos para T3.1, com tipos digitais próprios e folhas internas curadas.

**Languages:**

- English;
- Català;
- Deutsch;
- Español;
- Français;
- Greek / Ελληνικά;
- Hebrew / עברית;
- Italiano;
- Japanese 日本語;
- Korean 한국어;
- Magyar;
- Nederlands;
- Norsk;
- Polski;
- Português;
- Russian / Русский;
- Suomi;
- Svenska;
- Ukrainian / Українська;
- Zhongwen 中文.

Decisão de tradução: armazenar código BCP 47/ISO adequado e nome localizado; lista administrável, não enum fechado em código.

**Format, primeiro nível:**

- `Digital`;
- `Physical Products`;
- `Virtual Tabletops (VTT)`;
- `Bundles`;
- `Creation Method`.

Decisão de tradução:

- excluir `Physical Products`;
- separar `Digital` em formatos reais de arquivo;
- VTT vira plataforma/compatibilidade;
- bundle vira relação/coleção de materiais;
- método de criação vira dimensão própria, não formato.

**Rule System exibidos como destaques, não lista completa:**

- BRP (Basic Roleplaying);
- Cyberpunk;
- Daggerheart;
- Demon Lord Engine;
- Dungeons & Dragons;
- Fate;
- Forged in the Dark;
- Marvel d616;
- Modiphius 2d20;
- Mothership;
- Old-School Revival (OSR);
- Pathfinder / Starfinder;
- Savage Worlds;
- Storyteller / Storytelling;
- Traveller;
- Warhammer;
- Year Zero Engine;
- Any system / system-agnostic;
- Other systems.

Essa lista não governa Downloads. A árvore completa e administrável vem da Spec 062. `Any system/system-agnostic` deve ser estado explícito sem `system_id`; `Other systems` não vira sistema canônico genérico, mas fluxo de sugestão.

### Metadados literais do cadastro/edição

Documentação oficial atual confirma:

- template baseado em título anterior;
- título;
- autores;
- artistas;
- número de páginas;
- preço de download;
- texto/descrição da página;
- capa;
- atribuições de categorias/filtros;
- sistema ou `Any System/System Agnostic`;
- origem do PDF: `Electronic format` ou `Scanned image`;
- purchase note;
- arquivo principal e arquivos suplementares;
- rótulo de formato digital;
- PDF com ou sem watermark;
- estado privado/público;
- data futura de disponibilidade;
- previews;
- múltiplos arquivos e formatos.

Tradução para Artifício:

- excluir preço, purchase note comercial, watermark comercial e data de venda;
- manter título, créditos, páginas, descrição, capa, taxonomias, sistema, origem digital/scan, arquivos/links, formatos, previews, draft/publicação e data programada futura;
- adicionar D100, papel do publicador, licença, barreiras externas, origem `external_link|managed_upload`, provider e verificação.

### Metadados literais da ficha pública real

Ficha atual observada expõe:

- título, capa e preview;
- editora e link para perfil;
- categoria;
- sistemas;
- contagem de páginas;
- data de entrada no catálogo;
- badge/ranking editorial;
- autores e artistas;
- presença/origem de ilustrações;
- método de criação;
- filtros/taxonomias;
- ISBN e código de estoque da editora;
- tamanho de arquivo;
- formato;
- última atualização;
- idiomas;
- descrição rica e mídia incorporada;
- avaliações agregadas, reviews e discussões.

Artifício deve manter ficha rica, mas:

- ISBN/código de estoque são opcionais;
- tamanho só existe para upload gerenciado;
- link externo não permite afirmar tamanho/arquivo sem verificação;
- badge comercial/bestseller não entra;
- reviews, comentários e nota são domínios separados;
- clique/redirecionamento não é “download concluído”.

### Políticas atuais relevantes

- Parceiro não verificado passa por aprovação; verificado pode ter aprovação automática.
- Checklist atual informa normalmente 2–3 dias úteis, até 5 em fila pesada.
- Recomendação/limite operacional: três títulos por 24 horas.
- Capa, descrição e preview são os três eixos principais de apresentação.
- Conteúdo adulto exige marcação/filtro e apresentação pública apropriada.
- `Creation Method` é obrigatório; valores documentados incluem `Contains AI-Generated Content` e `Human-made without AI`.
- Conteúdo ilegal ou infrator é proibido; responsabilidade de direitos é do criador.
- Community Content Programs têm regras próprias do titular.
- Conteúdo original ou sob licença de terceiro pode seguir fluxo geral.
- Sistema deve ser marcado somente quando as regras forem realmente exigidas; material agnóstico usa estado próprio.
- Produtos podem ter múltiplos arquivos; formatos citados incluem PDF, EPUB, MOBI, JPG, STL e OBJ.
- Preview pode ser PDF, JPG ou PNG; ZIP não serve como preview.
- Aplicativos, executáveis, instaladores e extensões são proibidos pelo padrão atual do DriveThruRPG.
- Avaliação/review exige aquisição, espera de 24 horas e barreiras antiabuso para contas novas.
- Gratuito (`$0`) e PWYW são regimes distintos. Por D102, ambos podem entrar, mas PWYW somente como link externo quando zero libera o material e nunca como arquivo armazenado pelo Artifício.

### Resultado para o Downloads

Adotar:

- seis famílias facetadas conceituais, separando entidade de enum;
- ficha rica;
- múltiplos formatos/arquivos;
- método de criação;
- adulto/avisos;
- preview;
- moderação por confiança;
- relações com autor, artista, tradutor e editora;
- idioma, sistema e agnóstico explícito;
- avaliações com barreiras antiabuso.

Adaptar:

- `Product Type` e `Genre` para catálogo exclusivamente digital/gratuito;
- `Format` em três dimensões: arquivo, VTT/plataforma e criação;
- community content para licença/programa de fã + prova D100;
- datas, badges e ordenação para relevância/recência/atualização, sem vendas;
- múltiplos arquivos para múltiplos destinos externos ou objetos gerenciados.

Excluir:

- preço fixo, desconto, venda, checkout, comissão, bestseller por receita;
- produtos físicos, merch, gift certificates e POD;
- purchase note comercial e watermark comercial;
- publisher stock obrigatório;
- qualquer inferência de “compra” ou “biblioteca comercial”.

### Gate produzido por T1.2

T1.2 fecha o inventário de famílias, superfícies, metadados e políticas verificáveis. Não fecha:

- taxonomia final do Artifício — T3.1;
- PWYW externo foi aceito sob restrições por D102/T2.3;
- política própria de IA — T3.2;
- allowlist de tipos/arquivos — T5.4/T5.5;
- regras de avaliações/comentários — T3.3/T3.4.

T1.2a consolidará o modelo sem campos financeiros e com campos próprios do hub.

## Regra de gratuidade e PWYW externo — D102

D102 supera D101. Downloads aceita duas condições:

- `free`: material obtido sem oferta ou exigência de pagamento;
- `pwyw_external`: página externa oferece “pague quanto quiser”, mas valor zero precisa liberar integralmente o material cadastrado.

Restrições:

- PWYW só pode usar `source_type=external_link`;
- arquivo PWYW nunca entra em `managed_upload`, R2, B2, Fastio, Cloudinary PDF, espelhamento, proxy ou cópia Artifício;
- Artifício não captura, persiste nem exibe valor sugerido, mínimo escolhido ou valor pago;
- ficha, card quando houver espaço e CTA sinalizam “Pague quanto quiser — consulte no site externo”, sem mostrar número ou moeda;
- usuário deve abrir o link externo para consultar condições e escolher eventual contribuição;
- prova D100 deve demonstrar opção zero e legitimidade de divulgação;
- moderação e checker consultam a página externa para confirmar que zero ainda libera integralmente o material;
- login, cadastro ou newsletter continuam permitidos quando declarados;
- preço mínimo maior que zero, tier pago necessário, doação obrigatória ou pagamento para liberar o material continuam proibidos;
- página pode vender outros produtos, desde que o material cadastrado esteja claramente disponível por zero.

Mudança que retire a opção zero recebe `no_longer_free` e suspende publicação. Mudança entre `free` e `pwyw_external` exige nova revisão.

### Fontes verificadas em T1.2

- [DriveThruRPG — catálogo/home atual](https://www.drivethrurpg.com/en/)
- [Ficha pública real usada na amostra](https://www.drivethrurpg.com/en/product/562366/hexcrawl-campaign-style-guidebook)
- [Set Up a New Title or Edit an Existing Title Listing](https://help.drivethrupartners.com/hc/en-us/articles/12780799278103-Set-Up-a-New-Title-or-Edit-an-Existing-Title-Listing)
- [Product Approval Checklist for New Partners](https://help.drivethrupartners.com/hc/en-us/articles/15316083891351-Product-Approval-Checklist-for-New-Partners)
- [Product Standards Guidelines](https://help.drivethrupartners.com/hc/en-us/articles/12780748778135-Product-Standards-Guidelines)
- [Digital Title FAQ](https://help.drivethrupartners.com/hc/en-us/articles/12780762948631-Digital-Title-FAQ)
- [Product Ratings, Reviews and Discussions](https://help.drivethrurpg.com/hc/en-us/articles/12723266439319-Product-Ratings-Reviews-and-Discussions)
- [Payment and Pricing Questions](https://help.drivethrurpg.com/hc/en-us/articles/12723267225111-Payment-and-Pricing-Questions)

## T1.2a — Modelo conceitual Artifício sem comércio

**Estado:** concluído em 2026-07-09.

### Princípio

DriveThruRPG fornece profundidade de catálogo, não domínio comercial copiável. Downloads modela descoberta, confiança, compatibilidade, acesso gratuito e redirecionamento. Preço, compra e entrega comercial não existem.

O modelo precisa representar duas origens equivalentes para o público:

- `external_link`: Artifício cataloga e redireciona para destino externo;
- `managed_upload`: usuário envia arquivo, Artifício guarda em provider integrado e entrega por URL lógica própria.

Ambas aparecem como material catalogado. Provider, object key e detalhes internos nunca definem identidade pública.

### Entidades conceituais

1. **Material:** ficha editorial descoberta pelo público.
2. **Versão:** edição/revisão publicada do material, com changelog e destinos/arquivos vigentes.
3. **Destino:** link externo ou arquivo gerenciado usado para acesso.
4. **Pessoa/organização:** autor, tradutor, artista, editora/selo ou outro crédito.
5. **Perfil público:** página agregadora de criador/editora.
6. **Classificação:** sistemas, edições, tipos, gêneros, idiomas, formatos, VTTs, público e avisos.
7. **Evidência:** prova D100 de gratuidade e possibilidade jurídica.
8. **Revisão editorial:** submissão, decisão, motivo, ator, timestamps e snapshot.
9. **Verificação:** checagem de disponibilidade, segurança e gratuidade de cada destino.
10. **Interação:** favorito, coleção, avaliação e comentário; separados do material.

Material não é arquivo. Um material pode ter várias versões, destinos e arquivos. Um destino pode mudar sem trocar a identidade/slug do material, mas mudança jurídica ou de gratuidade reabre moderação.

### Campos públicos obrigatórios para publicar

| Grupo | Campo conceitual | Regra |
|---|---|---|
| Identidade | título | obrigatório; nome real do material |
| Identidade | slug | gerado, único e estável; redirect em troca |
| Identidade | resumo curto | obrigatório para cards e SEO |
| Identidade | descrição | obrigatória; conteúdo sanitizado |
| Origem | `source_type` | `external_link|managed_upload` |
| Acesso | ao menos um destino ativo | URL externa ou objeto gerenciado |
| Acesso | condição | `free|pwyw_external`; PWYW exige link externo, opção zero verificável e nenhum valor exposto pelo Artifício |
| Responsabilidade | papel do publicador | `author|translator|publisher|curator` |
| Créditos | ao menos um autor/criador ou organização responsável | obrigatório |
| Idioma | idioma principal | código controlado |
| Classificação | tipo de material | obrigatório; vocabulário T3.1 |
| Classificação | sistema ou agnóstico | ao menos um `system_id` canônico ou `system_agnostic=true` |
| Formato | ao menos um formato | PDF, EPUB, mapa, VTT etc.; allowlist futura |
| Jurídico | licença/programa/base aplicável | obrigatório como categoria, inclusive `fan_content` |
| Jurídico | evidência D100 | obrigatória e válida |
| Criação | método de criação/IA | obrigatório; política final em T3.2 |
| Segurança | classificação etária/avisos | declaração obrigatória, mesmo quando “sem aviso” |
| Media | capa | obrigatória para publicação; Cloudinary shared |
| Workflow | aceite das declarações | versão dos termos + timestamp |

### Campos públicos condicionais

- edição/variante do sistema: quando aplicável;
- tradutor e idioma de origem: quando tradução;
- editora/selo: quando houver;
- artistas e demais créditos;
- número de páginas: para documento paginado;
- duração, jogadores, nível, escala e requisitos: conforme tipo;
- VTT/plataforma: para módulo ou asset específico;
- ISBN/código editorial: opcionais;
- previews/amostras;
- data original de publicação;
- versão e changelog;
- compatibilidade/requisitos;
- instruções de acesso;
- barreiras externas sinalizadas;
- site oficial e links relacionados.

Campo incompatível com o tipo não aparece vazio na ficha; simplesmente não se aplica.

### Campos somente de moderação/owner

- usuário SSO que cadastrou;
- ownership e permissões app-local;
- URL/documento/imagem de evidência D100;
- texto explicativo da base jurídica;
- origem e contexto da captura;
- notas privadas do publicador;
- notas e decisão do moderador;
- motivo de rejeição/suspensão/takedown;
- snapshots antes/depois de edição;
- denúncias e recursos;
- histórico de verificações;
- dados internos de storage/provider;
- hashes, tamanho real e análise de arquivo;
- correlation/request IDs e auditoria.

Evidência jurídica não é pública por padrão. Público vê categoria de licença, papel declarado e indicador “verificado pelo Artifício”, nunca documento privado automaticamente.

### Destino externo

Campos mínimos:

- URL exata do material ou página oficial de distribuição;
- tipo: `direct_file|landing_page`;
- domínio/host normalizado;
- requisitos de acesso;
- instruções curtas;
- data e resultado da última verificação;
- prova de gratuidade;
- status de segurança/disponibilidade.

Regras:

- URL deve usar HTTPS, salvo exceção administrativa justificada;
- encurtador/opacidade não substitui destino verificável;
- redirecionamentos são seguidos para verificação, com destino final registrado;
- link de marketplace é aceito apenas para item gratuito específico;
- página contendo produtos pagos é permitida se o material cadastrado continuar claramente gratuito;
- destino PWYW é aceito somente quando zero libera o material e `source_type=external_link`;
- preço mínimo positivo, tier pago necessário ou doação obrigatória reprovam;
- link direto e landing page devem ser distinguíveis na interface.

### Upload gerenciado

Campos conceituais:

- URL lógica estável;
- provider atual;
- object key interno;
- nome original e nome público;
- MIME detectado e extensão;
- tamanho;
- hash/checksum;
- versão;
- status de scan/processamento;
- data de upload;
- uploader;
- disponibilidade.

Regras:

- identidade pública nunca usa URL bruta do provider;
- trocar R2/B2/Fastio/Cloudinary não muda URL pública;
- metadado informado pelo cliente não é confiável; backend futuro detecta MIME/tamanho/hash;
- arquivo só publica após verificação técnica e moderação jurídica;
- múltiplos arquivos pertencem a uma versão identificada.

### Barreiras externas

Em vez de vários booleanos rígidos, usar coleção controlada `access_requirements[]`. Valores iniciais:

- `login`;
- `account_registration`;
- `newsletter_signup`;
- `email_delivery`;
- `access_code`;
- `age_gate`;
- `region_restriction`;
- `other`.

Cada requisito pode ter instrução curta. `payment`, `donation` e `tip` não são barreiras obrigatórias válidas. `pay_what_you_want` não pertence à coleção de barreiras: é condição de acesso `pwyw_external`, válida somente quando zero libera o material.

Na ficha/card, barreiras aparecem antes do botão de acesso. Nenhuma barreira pode ficar escondida em descrição livre.

### Classificação sem drift

- sistema/edição: somente IDs da fonte canônica da Spec 062;
- agnóstico: estado explícito, nunca UUID “Outros”;
- sistema ausente: sugestão ao catálogo central, não texto livre permanente;
- editora/criador: entidade própria com aliases e perfil;
- idioma: código padronizado + nome localizado;
- tipo/gênero/formato/VTT: vocabulários administráveis;
- método de criação, licença e avisos: dimensões separadas;
- tags livres podem complementar busca, nunca substituir filtros controlados.

### Estados editoriais mínimos

- `draft`: incompleto, privado ao owner/admin;
- `pending_review`: enviado, congelado para decisão;
- `published`: versão aprovada e visível;
- `pending_update`: edição aguarda revisão; versão pública anterior permanece;
- `rejected`: não publicado, com motivo;
- `suspended`: ocultado por risco temporário;
- `takedown`: removido por decisão jurídica/política;
- `archived_by_owner`: retirado voluntariamente, preservando histórico.

Auto-publicação futura permite transição autorizada para `published`, mas continua exigindo todos os campos, D100, verificações e auditoria. Não é bypass de validação.

### Estados de verificação do destino

- `pending`: nunca verificado ou aguardando processamento;
- `verified`: acessível, seguro dentro das checagens e gratuito;
- `degraded`: acessível com anomalia ou barreira alterada;
- `unavailable`: indisponível após política de retentativas;
- `unsafe`: risco de malware/phishing ou bloqueio de segurança;
- `no_longer_free`: passou a exigir valor maior que zero ou retirou acesso integral por zero;
- `needs_human_review`: automação inconclusiva.

Somente `verified` publica inicialmente. Política posterior decidirá tolerância/janela para `degraded` e `unavailable`.

### Visibilidade por superfície

**Card:**

- capa, título, resumo;
- tipo, sistema/agnóstico, idioma e formato principal;
- autor/editora;
- barreiras de acesso;
- avaliação agregada;
- indicador de link/upload e verificação.

**Ficha pública:**

- todos os metadados públicos aplicáveis;
- créditos completos;
- licença/programa declarado;
- versão/changelog;
- destinos/arquivos ativos;
- previews;
- última verificação em linguagem simples;
- métricas públicas ainda dependentes de T2.5.

**Área do publicador:**

- drafts, revisões, evidências, verificações, histórico, denúncias e recurso próprios.

**Admin:**

- tudo acima, mais auditoria, evidências privadas, decisões, risco e controles.

### Validações conceituais

- `system_agnostic=true` não combina com sistema/edição específica;
- edição deve pertencer ao sistema informado;
- tradução exige idioma original e tradutor;
- managed upload exige objeto válido; external link exige URL válida;
- ao menos um destino ativo por versão publicada;
- cada destino exige evidência D100 relacionada;
- material adulto/avisos não pode omitir classificação;
- licença/base declarada deve combinar com papel e evidência;
- `curator` não vira autor automaticamente;
- editora, autor e tradutor não são strings intercambiáveis;
- mudança sensível cria revisão, não sobrescreve publicação auditada;
- campos financeiros próprios do Artifício são inválidos, não apenas ocultos;
- `pwyw_external` com upload gerenciado é inválido;
- destino que deixa de permitir zero recebe `no_longer_free`.

### Exclusões definitivas

Não existem no modelo:

- preço/moeda cobrados pelo Artifício;
- configuração PWYW interna ou upload de material PWYW;
- desconto, cupom, promoção e sale;
- carrinho, checkout, pedido e pagamento;
- comissão, royalty, saldo e saque;
- biblioteca de compras;
- bestseller por receita;
- purchase note comercial;
- POD, frete, estoque e produto físico;
- afiliado;
- watermark comercial.

### Lacunas preservadas para fases próprias

- lista final de tipos/gêneros/formatos: T3.1;
- política de licença, fan content e IA: T3.2;
- moderação e auto-publicação: T3.3;
- denúncias, link quebrado e takedown: T3.4;
- limites/allowlist/scan de arquivos: T5.4/T5.5;
- retenção e privacidade das evidências: T5.6;
- métricas públicas: T2.5;
- frequência do link checker: T6.3.

T1.2a fecha estrutura conceitual e separação público/privado. Não antecipa essas decisões.

## T1.3 — Comparação de catálogos atuais de materiais gratuitos

**Snapshot:** 2026-07-09.  
**Escopo:** itch.io (`Physical games` + tag `free`), RPGGeek e Keeper/Fari RPGs.  
**Seleção:** modelos complementares: plataforma aberta em escala, banco comunitário moderado e coleção curada gratuita/open. DriveThruRPG não foi contado, pois já recebeu investigação própria em T1.1b/T1.2.

### Método e limites

- Inspeção pública sem login, cruzada com documentação oficial de submissão, descoberta e política.
- “Gratuito” foi reavaliado conforme D102: acesso integral precisa ser possível por zero; PWYW é aceito somente por link externo e com sinalização. Rótulo, tag ou preço zero isolado não bastam.
- Nenhuma referência coincide integralmente com Downloads. Achados são evidência comparativa, não decisão automática.
- Quantidades são retrato datado: itch.io mostrava 310 resultados em `Physical games` com tag `free`; Keeper, 69 entradas entre recursos e jogos.
- Painéis autenticados, tempos reais de moderação, segurança dos arquivos e disponibilidade histórica não foram testados.

### 1. itch.io — catálogo aberto e descoberta em escala

**Modelo observado**

- Criador autenticado cria página própria com título, descrição curta, capa, URL, classificação, gênero, até dez tags, metadados, arquivos e links externos.
- Projeto nasce privado. Publicação e indexação são estados diferentes: página pública pode existir por URL/perfil sem aparecer em busca/browse.
- Indexação exige página pública, capa e conteúdo acessível. Spam, metadata enganosa, abuso de tags, conteúdo vazio ou baixa qualidade podem causar desindexação.
- Browse combina categoria, tags e ordenações `Popular`, `New & Popular`, `Top sellers`, `Top rated` e `Most Recent`.
- Cards exibem capa, título, resumo, criador, conta verificada quando aplicável e ação de coleção.
- Upload aceita múltiplos arquivos; documentação também admite Dropbox e links externos. Atualização ocorre na mesma página.
- Perfil, seguidores, feed, comentários/reviews, ratings, coleções e analytics privados de views/downloads integram o ecossistema.

**Gratuidade**

- Opção `No payments` é compatível com `free`.
- Opção `$0 or Donate` é compatível com `pwyw_external` somente quando “No thanks” realmente libera o material, mediante link externo e sinalização.
- `Physical games tagged free` usa tag comunitária. Tag não prova `No payments`, gratuidade de todos os arquivos ou permanência da condição.
- itch.io só pode ser destino aceito após verificar configuração/fluxo real do item. Tag `free`, texto “free” ou preço zero não são prova suficiente.

**Moderação, qualidade e direito**

- Publicação normalmente é direta; moderação atua sobre indexação, denúncias e violações. Novos vendedores podem entrar em fila antes da indexação, sem equivaler à revisão jurídica prévia do Artifício.
- Regras exigem metadata correta, conteúdo adulto rotulado, divulgação de IA, ausência de malware/spyware/adware e direito de publicar/distribuir.
- Termos responsabilizam publisher por direitos/licenças/permissões e oferecem DMCA. É declaração contratual e takedown reativo, não prova individual prévia.
- Cada página possui denúncia.

**Forças**

- Descoberta por cards, tags combináveis, ordenações, coleções, perfis e páginas visuais.
- Separação `published`/`indexed`.
- Capa/conteúdo mínimo para descoberta.
- Metadata de IA, conteúdo adulto e qualidade editorial.

**Riscos**

- Folksonomia livre cria ruído, duplicidade e tags promocionais.
- Popularidade/vendas dominam ranking; `Top sellers` não serve ao produto sem comércio.
- Página personalizável reduz consistência visual.
- PWYW, doação e tiers tornam elegibilidade mutável; checker precisa confirmar opção zero e ausência de arquivo/tier obrigatório pago.
- Auto-publicação padrão e moderação reativa são insuficientes para D100.

### 2. RPGGeek — banco comunitário estruturado e moderado

**Modelo observado**

- Banco editorial relaciona RPG, edição, item/produto, versão, pessoa, empresa/editora, sistema, cenário, família, série, categoria, mecânica e gênero.
- Fluxo manda pesquisar duplicidade, criar pessoas/empresas ausentes, ligar item ao RPG e representar edições significativamente diferentes como RPGs distintos.
- Submissões entram em filas pendentes; conteúdo normalmente passa por admin ou moderação comunitária (`GeekMod`).
- Ficha reúne créditos, editora, categorias, gênero, versões, imagens, arquivos, Web Links, avaliações, comentários, reviews, coleções e estatísticas.
- Usuários enriquecem conteúdo após aprovação; área wiki fica separada da descrição factual.

**Arquivos e links**

- Arquivo pertence à ficha, não é entrada solta. Atualização relacionada preserva comentários e votos.
- Upload exige descrição curta/versão e aceita nota privada ao admin.
- Limite observado: 100 MB. Arquivos são baixados, testados e avaliados; aprovação pode levar dias ou até duas semanas.
- Scans e arquivos obtidos de terceiros não podem ser reenviados sem consentimento expresso, indicado ao admin.
- Sem permissão para reupload, orientação é usar Web Link. Isso valida desenho híbrido do Artifício: catalogar link quando hospedar cópia seria indevido.
- Publisher pode bloquear uploads para seus títulos.

**Gratuidade**

- Não é catálogo exclusivo de gratuitos; mistura fichas bibliográficas, produtos e recursos.
- Separar produto, arquivo e Web Link é útil, mas presença no banco não prova gratuidade.
- Links/arquivos exigiriam classificação própria no Artifício.

**Moderação e direito**

- Referência mais próxima de D100: consentimento expresso para scans/reuploads, comunicado ao admin.
- Falta estrutura pública uniforme de licença/prova por item; regra vive na orientação.
- Moderação prévia, filas, nota privada, suspensão do upload e histórico são padrões fortes.

**Interações**

- Ratings, comentários, reviews, coleções, votos em arquivos e perfis/contribuições são maduros.
- Ranking usa amostra mínima/amortecimento e mecanismos contra manipulação. Downloads não deve copiar fórmula opaca, mas deve evitar média crua com poucas notas.

**Forças**

- Busca de duplicidade antes da submissão.
- Entidades canônicas e créditos relacionais.
- Item, edição, versão, arquivo e link separados.
- Moderação antes da entrada.
- Atualização preserva contexto social/histórico.
- Link externo preferido quando reupload não é autorizado.

**Riscos**

- Modelo enciclopédico pesado para submissão casual.
- Taxonomia e UX históricas podem ser difíceis.
- Mistura catálogo bibliográfico com disponibilidade.
- `GeekGold`, posse, troca e venda não servem ao Artifício.

### 3. Keeper/Fari RPGs — coleção pequena, curada, gratuita e licenciada

**Modelo observado**

- Coleção gratuita/open de recursos TTRPG; separa `Resources` de `Games`.
- Home e busca dão acesso direto; busca alterna `All`, `Games` e `Resources`.
- Ficha de recurso apresenta autor, idiomas/locales, links externos, capítulos e licença; pode permitir copiar/baixar Markdown e editar no GitHub.
- Alguns jogos são consultáveis no Keeper com assets; recursos também podem apontar a itch.io/DriveThruRPG.
- Conteúdo vira página estruturada, não mero índice de PDF.

**Submissão**

- Comunidade envia por formulário web com upload ou Pull Request.
- Equipe publica quando disponível; não há auto-publicação.
- Diretrizes exigem conteúdo original ou corretamente licenciado, metadata/frontmatter, estrutura e Markdown válido.
- Pull Request dá revisão/histórico, mas exclui não técnicos; formulário reduz barreira.

**Gratuidade e direito**

- Missão gratuita/open é explícita. Fichas observadas exibem atribuição/licença, como CC BY 4.0.
- Melhor exemplo de licença visível junto ao conteúdo.
- Não foi encontrada política completa de fan content, takedown, denúncia, prova privada ou revalidação. “Original ou licenciado” é menos operacional que D100.

**Descoberta e interações**

- Experiência limpa e focada. Separação jogos/recursos reduz carga.
- Taxonomia pública é rasa: busca/tipo, autor e locale observados; sem profundidade DriveThruRPG/RPGGeek.
- Não foram observados ratings, comentários, favoritos, coleções pessoais, perfis completos, métricas ou ordenações avançadas.

**Forças**

- Escopo gratuito/open inequívoco.
- Licença e atribuição visíveis.
- Conteúdo textual acessível, navegável, copiável e multilíngue.
- Curadoria humana prévia.
- Interface enxuta, sem ruído comercial.

**Riscos**

- Curadoria manual/PR não escala ao catálogo amplo.
- Converter material para conteúdo nativo aumenta custo, responsabilidade e risco de reprodução.
- Taxonomia rasa limita acervo grande.
- Interações e saúde de destinos não atendem MVP da 061.

### Comparação transversal

| Eixo | itch.io | RPGGeek | Keeper | Implicação para Downloads |
|---|---|---|---|---|
| Natureza | publicação/hospedagem aberta | banco + arquivos/links | coleção curada/nativa | hub próprio, sem loja nem wiki integral |
| Entrada | criador publica | submissão pendente | formulário/PR, equipe publica | moderação prévia |
| Gratuito exclusivo | não | não | sim, missão explícita | elegibilidade própria; não confiar na plataforma |
| Link externo | aceito, às vezes desencorajado | Web Link próprio | links complementares | destino de primeira classe |
| Upload | múltiplos arquivos | arquivo ligado ao item | upload/PR convertido | `managed_upload` ligado a material/versão |
| Prova jurídica | declaração + takedown | consentimento ao admin | original/licenciado | D100 permanece mais forte |
| Taxonomia | gênero/tags/metadata | profunda/relacional | rasa | DriveThruRPG + RPGGeek; controle central |
| Moderação | reativa/desindexação | prévia | prévia editorial | separar publicação, descoberta e segurança |
| Versões | atualização na página | arquivo/versão relacionados | histórico Git | preservar histórico/interações |
| Social | forte | muito forte | quase ausente | interações próprias |
| Saúde do destino | não observada | não observada | não observada | verificação periódica obrigatória |
| Comércio | estrutural | presente no ecossistema | apoio externo | excluir semântica financeira |

### Achados firmes para T1.4

1. **Rótulo não prova gratuidade.** Tag `free`, preço zero, texto promocional ou coleção gratuita não substituem inspeção do fluxo e D100.
2. **Material, destino e arquivo são distintos.** Ficha não deve confundir identidade bibliográfica e disponibilidade.
3. **Publicação e descoberta precisam estados separados.** Deve ser possível suspender descoberta/destino sem apagar ficha/histórico.
4. **Link externo é legítimo, não fallback inferior.** Sem autorização de reupload, link oficial é juridicamente melhor.
5. **Licença precisa aparecer ao público.** Evidência sensível continua privada.
6. **Submissão começa por busca de duplicidade.**
7. **Versões preservam contexto social.** Troca de destino/arquivo não apaga interações/histórico editorial.
8. **Taxonomia livre não governa campos centrais.** Tags complementam vocabulário controlado.
9. **Avaliação exige defesa contra amostra pequena/manipulação.**
10. **Curadoria humana pura não escala.** Fila, nota privada, duplicidade, prova e revalidação precisam ferramentas antes de auto-publicação.

### Lacunas não resolvidas pelas referências

- prova jurídica estruturada, retenção, privacidade e revalidação;
- verificação periódica de que PWYW externo ainda permite aquisição integral por zero;
- monitoramento periódico de link, segurança e gratuidade;
- URL lógica estável multi-provider;
- papel `autor|tradutor|editora/selo|curador de terceiro`;
- taxonomia profunda + moderação prévia + UX simples;
- métricas honestas de redirecionamento;
- auto-publicação por permissão revogável.

### Fontes verificadas

- itch.io: [catálogo `free`](https://itch.io/physical-games/tag-free), [criação](https://itch.io/docs/creators/getting-started), [indexação](https://itch.io/docs/creators/getting-indexed), [preços](https://itch.io/docs/creators/pricing), [qualidade](https://itch.io/docs/creators/quality-guidelines), [termos/DMCA](https://itch.io/docs/legal/terms).
- RPGGeek: [entrada de dados](https://rpggeek.com/wiki/page/RPGG_Guide_to_Data_Entry_-_Submitting_Data_for_RPGs), [arquivos](https://rpggeek.com/wiki/page/File_Submissions), [conteúdo/moderação](https://rpggeek.com/wiki/page/How_to_Add_Content), [ratings](https://rpggeek.com/wiki/page/ratings), [perfil/coleções](https://rpggeek.com/wiki/page/User_Profile).
- Keeper: [home](https://keeper.farirpgs.com/), [busca](https://keeper.farirpgs.com/search/), [documentação](https://keeper.farirpgs.com/docs/), [submissão](https://keeper.farirpgs.com/docs/submitting-content/), [24XX/licença](https://keeper.farirpgs.com/resources/jason-tocci/24xx/), [repositório](https://github.com/farirpgs/keeper).

T1.3 encerra comparação factual. T1.4 transforma T1.1–T1.3 numa matriz normativa única `adotar|adaptar|rejeitar`, respeitando D095/D100/D102.

## T1.4 — Matriz normativa final `adotar | adaptar | rejeitar`

**Consolidado em:** 2026-07-09.  
**Fontes:** Dungeonist (T1.1), DriveThruRPG (T1.1b/T1.2), itch.io, RPGGeek e Keeper (T1.3), código Artifício auditado em T0.4 e decisões D089–D102.

### Como ler

- **Adotar:** conceito entra no produto com sentido equivalente e vira requisito das specs filhas.
- **Adaptar:** conceito entra após mudança explícita para o hub gratuito, identidade Artifício, moderação e arquitetura escolhida.
- **Rejeitar:** conceito não entra; futura spec não pode reintroduzi-lo sem nova decisão do mantenedor.
- Esta matriz decide produto, não schema/API/UI final. Campos e nomes conceituais podem mudar na implementação sem alterar a regra.
- Em conflito: decisões pétreas D095, D100, D102 e pré-requisito D096–D099 prevalecem.

### A. Posicionamento e limites

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Catálogo especializado em RPG | Dungeonist/DriveThruRPG/RPGGeek | **Adotar** | somente materiais de RPG e utilidades diretamente relacionadas | T2.1/T2.2 |
| Hub de descoberta/redirecionamento | Baixaki/D095 | **Adotar** | objetivo principal é catalogar e encontrar; ação final resolve destino | pétrea |
| Criadores independentes e editoras | Dungeonist/itch.io | **Adotar** | autoria própria e publicação institucional têm espaço equivalente | T2.1/T3.2 |
| Curadoria de material de terceiro | D090/RPGGeek | **Adotar** | usuário pode cadastrar link autorizado de terceiro com papel `curator` | T3.2/T3.3 |
| Marketplace/loja | Dungeonist/DriveThruRPG/itch.io | **Rejeitar** | Artifício não vende nem intermedeia transação | pétrea D095 |
| Biblioteca de compras/posse | DriveThruRPG/itch.io | **Rejeitar** | favorito/coleção não significam propriedade ou licença adquirida | T4.7 |
| Conteúdo nativo integral como wiki | Keeper | **Rejeitar** | catálogo não republica integralmente obras; preserva ficha, previews permitidos e destino | T3.2/T5.5 |
| Catálogo bibliográfico sem acesso | RPGGeek | **Rejeitar** | publicação exige destino ativo e condição de acesso elegível | T3.4/T6.3 |

### B. Origem, destino e acesso

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Link para página oficial do material | RPGGeek/Keeper/D095 | **Adotar** | `external_link` é destino de primeira classe, não fallback inferior | T5.2 |
| Link direto autorizado ao arquivo | D090 | **Adotar** | permitido com prova e verificação; interface distingue arquivo de landing page | T3.2/T5.2 |
| Upload de arquivo próprio/autorizado | itch.io/RPGGeek/D091 | **Adaptar** | backend envia para provider externo; VM nunca é armazenamento durável | T5.3–T5.5 |
| Múltiplos arquivos por material | DriveThruRPG/itch.io | **Adotar** | versão pode ter arquivos complementares, idiomas e formatos distintos | T3.1/T5.3 |
| Dropbox/host arbitrário como storage integrado | itch.io | **Rejeitar** | link externo pode apontar ao destino; upload gerenciado usa somente cadeia aprovada | T5.3 |
| PWYW externo | DriveThruRPG/itch.io/D102 | **Adaptar** | só `external_link`; zero precisa liberar material integral; sinalização sem valor/moeda | pétrea D102/T3.4 |
| Valor sugerido, mínimo escolhido ou pago de PWYW | comércio externo | **Rejeitar** | não capturar, persistir, inferir nem exibir; usuário consulta destino | pétrea D102 |
| Upload/espelhamento de material PWYW | D102 | **Rejeitar** | nenhum R2/B2/Fastio/Cloudinary PDF/proxy/cópia Artifício | pétrea D102/T5 |
| Preço mínimo positivo | marketplaces | **Rejeitar** | material deixa de ser elegível | T3.4/T6.3 |
| Tier pago necessário para o material cadastrado | itch.io | **Rejeitar** | acesso integral por zero é obrigatório | T3.4/T6.3 |
| Login/cadastro/newsletter | destinos externos | **Adaptar** | permitido, sempre com flags públicas específicas | T3.1/T4.3 |
| Região, idade, código ou entrega por e-mail | destinos externos | **Adaptar** | barreiras controladas, visíveis e verificáveis | T3.1/T4.3 |
| Encurtador opaco | diretórios externos | **Rejeitar** | armazenar URL informada e destino final observado; exceção só administrativa | T5.2/T6.3 |

### C. Identidade, ficha e metadados

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Título, resumo, descrição e capa | todas | **Adotar** | núcleo obrigatório da ficha/cards/SEO | T3.1/T4.3 |
| Subtítulo, galeria e previews | DriveThruRPG/itch.io | **Adaptar** | opcionais; somente conteúdo autorizado, acessível e moderado | T3.1/T5.5 |
| Autor, tradutor, editora/selo e demais créditos | DriveThruRPG/RPGGeek | **Adotar** | entidades/papéis separados; não strings intercambiáveis | T3.1/T3.2 |
| Papel do cadastrante | D090 | **Adotar** | `author|translator|publisher|curator`, sem converter curador em autor | T3.2/T3.3 |
| Perfil público de autor/editora | DriveThruRPG/itch.io/D090 | **Adotar** | perfil relaciona créditos e materiais; não implica propriedade automática do cadastro | T2.4/T4.8 |
| Sistema, edição e compatibilidade | DriveThruRPG/RPGGeek | **Adotar** | IDs canônicos do serviço 062; estado agnóstico explícito | Spec 062/T3.1 |
| Cenário como catálogo global de sistemas | Mesas/062 | **Rejeitar** | cenários ficam fora do catálogo canônico; Downloads modela classificação própria se necessária | T3.1 |
| Tipo, gênero/tema, idioma e formato | DriveThruRPG | **Adotar** | vocabulários controlados, facetáveis e multivalorados quando cabível | T3.1 |
| Tags livres | itch.io | **Adaptar** | complementam descoberta; não substituem campos centrais nem criam sistema/edição | T3.1 |
| Método de criação/uso de IA | DriveThruRPG/itch.io | **Adaptar** | declaração controlada e visível conforme política própria | T3.2 |
| Classificação etária e avisos | DriveThruRPG/itch.io | **Adotar** | obrigatórios quando aplicáveis; capa pública não pode usar conteúdo explícito | T3.1/T4.3 |
| Página customizada por publicador | itch.io | **Rejeitar** | ficha usa design system Artifício; identidade vem por capa/perfil/conteúdo | T4.1–T4.4 |
| ISBN, dimensões, impressão/POD/estoque | RPGGeek/DriveThruRPG | **Rejeitar** | fora do catálogo digital gratuito inicial | T3.1 |

### D. Taxonomia e descoberta

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Busca textual | todas | **Adotar** | título, resumo, créditos, editora, sistema, edição e tags permitidas | T4.2/T7 |
| Filtros facetados | DriveThruRPG | **Adotar** | sidebar por sistema, edição, idioma, tipo, gênero, formato, acesso e compatibilidade | T3.1/T4.2 |
| Sidebar lateral | pedido/Dungeonist | **Adotar** | desktop persistente; mobile vira drawer acessível | T4.1/T4.2 |
| Submenu abaixo do nav | pedido | **Adotar** | navegação interna do Downloads sob shell compartilhado | T4.1 |
| Cards com capa e informação essencial | itch.io/Keeper | **Adotar** | título, autor/editora, sistema, tipo, idioma, condição de acesso e flags | T4.2 |
| Separação `Games`/`Resources` rasa | Keeper | **Adaptar** | entrada simples pode existir, mas tipo controlado oferece granularidade maior | T3.1/T4.2 |
| Ordenar por recente, atualizado, avaliação e popularidade | DriveThruRPG/itch.io | **Adaptar** | excluir venda/receita; explicar critérios e proteger amostra pequena | T2.5/T4.2 |
| `Top sellers`, receita e bestseller | DriveThruRPG/itch.io | **Rejeitar** | nenhum ranking financeiro | pétrea D095 |
| Promoções, descontos e faixas de preço | DriveThruRPG | **Rejeitar** | inexistentes no Artifício | pétrea D095 |
| Coleções editoriais/destaques | DriveThruRPG/RPGGeek | **Adotar** | listas curadas sem alterar status jurídico ou ranking orgânico | T4.2/T4.7 |
| Folksonomia irrestrita | itch.io | **Rejeitar** | tags passam por normalização/moderação e limites | T3.1/T3.3 |
| Busca de duplicidade antes do envio | RPGGeek | **Adotar** | formulário consulta título, URL final, créditos e fingerprints disponíveis | T3.3/T5.2 |

### E. Submissão, moderação e histórico

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Rascunho privado | itch.io/Mesas | **Adotar** | usuário salva e completa antes de enviar | T3.3 |
| Moderação prévia | Dungeonist/RPGGeek/Keeper/D090 | **Adotar** | cadastro e edição sensível entram em fila antes de publicação | T3.3 |
| Nota privada ao moderador | RPGGeek | **Adotar** | espaço para contexto, permissão e exceções; nunca público | T3.2/T3.3 |
| Auto-publicação padrão | itch.io | **Rejeitar** | desligada por padrão | T3.3 |
| Permissão futura de auto-publicação | D090 | **Adaptar** | capacidade revogável por usuário/role, já modelada; não ativa no lançamento | T3.3/T5.1 |
| Publicação e indexação separadas | itch.io | **Adotar** | ficha pode existir sem aparecer em descoberta; suspensão não apaga histórico | T3.3/T3.4 |
| Estados editoriais explícitos | Mesas/T1.2a | **Adotar** | draft, pending, published, pending_update, rejected, suspended, takedown, archived_by_owner | T3.3/T3.4 |
| Edição publicada sobrescrita diretamente | plataformas simples | **Rejeitar** | alteração sensível cria revisão auditável | T3.3 |
| Versões preservando comentários/interações | RPGGeek/itch.io | **Adotar** | atualização de arquivo/destino não reinicia identidade social do material | T3.3/T4.5–T4.7 |
| Exclusão física de registro publicado | diretórios simples | **Rejeitar** | usar retirada/suspensão/takedown; preservar auditoria conforme política | T3.4/T5.6 |
| Curadoria por Pull Request | Keeper | **Rejeitar** | contribuição pública usa formulário do produto; Git não é requisito do usuário | T4.4 |

### F. Direitos, prova e segurança

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Declaração de direitos pelo usuário | itch.io | **Adotar** | aceite formal obrigatório, mas nunca suficiente sozinho | T3.2/T5.1 |
| Prova verificável por submissão | D100/RPGGeek | **Adotar** | URL, captura contextual ou licença/autorização/base jurídica | T3.2/T5.6 |
| Licença e atribuição públicas | Keeper | **Adotar** | ficha mostra categoria/licença e créditos; documento sensível fica privado | T3.2/T4.3 |
| Reupload de arquivo de terceiro sem consentimento | RPGGeek | **Rejeitar** | usar link oficial; upload só com autorização demonstrável | T3.2/T5.5 |
| Material sem licença explícita | D090 | **Adaptar** | somente produção de fã declarada, com base/programa aplicável e moderação | T3.2 |
| Takedown reativo como única defesa | itch.io | **Rejeitar** | prevenção D100 + denúncia + takedown + recurso | T3.2/T3.4 |
| Denúncia pública | itch.io/Mesas/Links | **Adotar** | motivos controlados, evidência, antiabuso e acompanhamento | T3.4/T5.1 |
| Conteúdo adulto sem rótulo | itch.io | **Rejeitar** | classificação/avisos obrigatórios; descoberta segura por padrão | T3.1/T4.2 |
| Arquivo sem inspeção técnica | risco próprio | **Rejeitar** | allowlist, tamanho, MIME real, hash, malware e quarentena antes de publicar | T5.4/T5.5 |
| Executáveis/instaladores | DriveThruRPG | **Rejeitar** | escopo inicial documental/VTT seguro; allowlist explícita | T5.4 |

### G. Interações, reputação e métricas

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Comentários | itch.io/RPGGeek/D090 | **Adotar** | usuários autenticados; moderação, denúncia e estados próprios | T3.4/T4.5 |
| Avaliação | DriveThruRPG/RPGGeek/D090 | **Adaptar** | somente autenticado, uma por usuário/material, antiabuso e amostra mínima | T3.4/T4.6 |
| Exigir compra para avaliar | DriveThruRPG | **Rejeitar** | não existe compra; política usa conta, idade e sinais de interação legítima | T4.6/T5.1 |
| Favoritos | DriveThruRPG/itch.io/D090 | **Adotar** | privado por padrão; contagem pública conforme política | T4.7/T2.5 |
| Coleções pessoais | itch.io/RPGGeek/D090 | **Adotar** | listas organizacionais; não representam propriedade | T4.7 |
| Seguidores/feed de criador | itch.io | **Adaptar** | investigar após núcleo do perfil; não bloquear MVP inicial das interações decididas | spec filha posterior |
| Cliques externos | D090 | **Adotar** | contar redirecionamento com privacidade e anti-fraude | T2.5/T6.2 |
| Chamar clique de download | diretórios | **Rejeitar** | rótulo sempre “clique/visita ao destino”; download concluído é desconhecido | pétrea D090 |
| Analytics privados do publicador | itch.io | **Adaptar** | somente métricas honestas disponíveis, com limites de privacidade | T2.5/T6.2 |
| Média/ranking com uma avaliação | RPGGeek | **Rejeitar** | amostra mínima e estado “sem avaliações suficientes” | T4.6 |
| Fórmula opaca de ranking | RPGGeek/itch.io | **Rejeitar** | critérios documentados e auditáveis | T2.5/T4.2 |
| Incentivo monetário/interno por submissão | RPGGeek | **Rejeitar** | sem GeekGold, saldo ou recompensa financeira | D095 |

### H. UX, identidade e acessibilidade

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Design padrão Artifício | pedido/T0.4 | **Adotar** | Header/Footer/tokens/tema/SSO compartilhados | T4.1 |
| Experiência enxuta sem ruído comercial | Keeper | **Adotar** | nenhuma faixa de oferta, carrinho, sale ou publicidade de compra | T4.1–T4.4 |
| Capa como principal sinal visual | itch.io/DriveThruRPG | **Adotar** | proporção/tamanho definidos; alt obrigatório; fallback consistente | T4.2/T5.5 |
| Licença/barreiras escondidas no texto | catálogos externos | **Rejeitar** | badges/resumo estruturado perto do CTA | T4.3 |
| CTA único genérico “Download” | diretórios | **Rejeitar** | CTA reflete destino: `Acessar material`, `Baixar arquivo` ou PWYW externo | T4.3 |
| Responsividade e acessibilidade | Keeper/Artifício | **Adotar** | teclado, foco, leitor de tela, contraste, reduced motion e mobile | T4.1–T4.8 |
| Conteúdo piscante/chocante em capa | itch.io | **Rejeitar** | capa segura para descoberta; conteúdo sensível atrás de aviso | T3.1/T5.5 |

### I. Storage, disponibilidade e operação

| Referência/conceito | Origem | Veredito | Regra Artifício | Encaminhamento |
|---|---|---|---|---|
| Provider único acoplado ao domínio | plataformas hospedadas | **Rejeitar** | adapter e URL lógica independente de fornecedor | T5.3/T6.1 |
| R2 → B2 → Fastio → Cloudinary PDF | D091/D092 | **Adotar** | ordem obrigatória para uploads elegíveis não-PWYW | T5.3 |
| Capas no Cloudinary shared | T0.4/D091 | **Adotar** | upload backend signed; nunca segredo/client upload inseguro | T5.5 |
| Arquivo durável na VM | risco infra | **Rejeitar** | temporário só durante processamento, com limpeza | T5.3/T5.5 |
| Failover silencioso sem reconciliação | risco multi-provider | **Rejeitar** | quota, estado, idempotência, auditoria e repair job | T5.3/T6.1 |
| Verificação periódica de links | D090 | **Adotar** | disponibilidade, cadeia de redirect, segurança e condição gratuita/PWYW zero | T6.3 |
| Remover ficha no primeiro erro | diretórios simples | **Rejeitar** | retentativas, `degraded/unavailable`, janela e revisão humana | T3.4/T6.3 |
| Ambientes beta/prod próprios | D093/D094 | **Adotar** | mesmos padrões canônicos dos demais projetos, sem snowflake | T6.1/T6.4 |
| Mesma storage/DB entre beta e prod | risco infra | **Rejeitar** | isolamento idêntico ao padrão vigente | T6.1/T6.4 |

### Decisões derivadas obrigatórias

As seguintes regras passam a ser entrada obrigatória de qualquer spec filha:

1. Toda ficha representa um **material** estável; versões, destinos e arquivos são registros relacionados.
2. Todo material publicado tem ao menos um destino ativo, elegível e verificado.
3. `external_link` e `managed_upload` compartilham ficha pública, mas possuem regras jurídicas e técnicas diferentes.
4. `pwyw_external` é condição de acesso, não preço do Artifício. Nenhum valor/moeda entra no produto.
5. Sistemas/edições vêm exclusivamente do serviço canônico da Spec 062.
6. Submissão pesquisa duplicidade antes de permitir novo cadastro.
7. Cadastro, edição sensível e prova passam por moderação; auto-publicação fica desligada.
8. Licença/base e barreiras ficam visíveis; prova privada tem acesso/retenção próprios.
9. Suspensão, retirada e atualização preservam histórico e interações.
10. Métrica de redirecionamento nunca é apresentada como download concluído.
11. Upload elegível usa somente adapter multi-provider; PWYW nunca usa upload.
12. Descoberta pública não depende de comércio, receita, preço ou propriedade.

### Itens que exigiriam nova decisão para voltar

- marketplace, checkout, carrinho, pagamento ou comissão no Artifício;
- material com preço mínimo maior que zero;
- valor/moeda PWYW armazenado ou exibido;
- upload/espelhamento de PWYW;
- auto-publicação geral no lançamento;
- terceiro catálogo local de sistemas/edições;
- arquivo durável em VM;
- ranking por vendas/receita;
- ficha publicada sem destino verificável;
- reupload de terceiro sem autorização demonstrável.

T1.4 encerra a fase comparativa F1. Próxima frente é F2 — definição do produto, começando por T2.1 (usuários/personas e jornadas), usando esta matriz como contrato.

## T2.1 — Usuários, personas funcionais e jornadas

### Princípio

Personas abaixo são **arquétipos funcionais**, não personagens fictícios. Uma mesma conta pode exercer papéis diferentes em materiais diferentes. Papel descreve relação com o material; permissão descreve ação autorizada no app.

Exemplos:

- uma tradutora pode ser `translator` numa obra e `curator` em outra;
- uma editora pode administrar perfil institucional e também publicar material próprio;
- um autor pode cadastrar link externo ou enviar arquivo elegível;
- ser creditado como autor não concede automaticamente controle da ficha;
- ser cadastrante/curador não transforma usuário em autor ou titular.

### Atores primários

#### P1 — Visitante pesquisador

**Quem é:** pessoa sem sessão que busca material para jogar, mestrar, estudar, traduzir ou criar.

**Objetivos:**

- descobrir material relevante rapidamente;
- entender sistema, edição, idioma, tipo, licença, autoria e barreiras antes de sair do Artifício;
- saber se destino é gratuito direto ou PWYW externo;
- avaliar segurança, atualidade e confiabilidade da ficha;
- abrir destino correto com mínimo atrito.

**Dores evitadas:**

- links quebrados ou enganosos;
- “grátis” que exige pagamento;
- material incompatível com sistema/edição;
- ausência de créditos/licença;
- CTA dizendo download quando apenas abre página externa.

**Pode:** buscar, filtrar, ordenar, abrir ficha/perfil, consultar comentários/avaliações/métricas, seguir destino e iniciar denúncia.

**Não pode sem login:** comentar, avaliar, favoritar, criar coleção, submeter material ou concluir denúncia autenticada quando política exigir conta.

#### P2 — Usuário leitor autenticado

**Quem é:** visitante com conta Artifício que quer organizar e participar.

**Objetivos:**

- favoritar;
- organizar coleções;
- comentar e avaliar;
- denunciar problema;
- acompanhar materiais relevantes.

**Pode:** tudo do visitante + interações pessoais e submissão.

**Não ganha:** direito editorial, autoria, propriedade ou auto-publicação apenas por ter conta.

#### P3 — Autor/criador independente

**Quem é:** pessoa que criou material ou representa legitimamente coautoria.

**Objetivos:**

- tornar obra encontrável;
- publicar link oficial ou arquivo elegível;
- controlar apresentação, versões, créditos e destino;
- receber feedback e acompanhar cliques/favoritos honestos;
- atualizar ou retirar material.

**Necessidades:**

- formulário claro sem linguagem de marketplace;
- prova jurídica proporcional;
- rascunho e preview;
- histórico de versões;
- status/motivo de moderação;
- perfil público e vínculo entre suas obras.

**Risco principal:** usuário confundir autoria declarada com prova suficiente. D100 permanece obrigatório.

#### P4 — Tradutor/adaptador autorizado

**Quem é:** pessoa responsável por tradução/localização/adaptação permitida.

**Objetivos:**

- creditar obra original e contribuição traduzida;
- indicar idiomas de origem/destino;
- comprovar licença, autorização ou programa de fã;
- relacionar tradução ao sistema/edição corretos;
- evitar parecer autor da obra-base.

**Necessidades específicas:**

- papéis de crédito separados;
- relação com obra-base quando conhecida;
- evidência de tradução/adaptação permitida;
- campo de escopo: tradução integral, parcial, suplemento ou adaptação.

#### P5 — Editora/selo/coletivo

**Quem é:** organização que publica material próprio ou representa catálogo autorizado.

**Objetivos:**

- manter perfil institucional;
- distribuir gestão entre pessoas autorizadas;
- cadastrar/atualizar vários materiais;
- preservar autoria individual e crédito institucional;
- solicitar correção de curadoria de terceiro;
- acompanhar saúde do catálogo.

**Necessidades específicas:**

- membros/representantes e permissões auditáveis;
- ownership institucional sem compartilhar conta;
- operações em lote somente após regras seguras;
- reivindicação de ficha com prova;
- saída de membro sem perda do acervo.

**Não pode:** apagar histórico, assumir autoria individual ou publicar automaticamente sem permissão própria.

#### P6 — Curador de terceiro

**Quem é:** usuário que encontrou material elegível publicado em site oficial, editora, itch.io, DriveThruRPG/DMsGuild ou outra fonte.

**Objetivos:**

- tornar material encontrável sem se apropriar dele;
- cadastrar destino oficial;
- atribuir autores/editora corretamente;
- informar gratuito/PWYW e barreiras;
- entregar prova de gratuidade/divulgação.

**Necessidades específicas:**

- papel `curator` muito visível no formulário/admin, sem destaque autoral público indevido;
- preferência por link oficial em vez de reupload;
- prevenção de duplicidade;
- possibilidade de titular legítimo reivindicar manutenção;
- canal para avisar mudança/quebra sem controlar obra.

**Proibição:** curador nunca envia cópia de terceiro aos providers sem autorização demonstrável de reupload.

#### P7 — Moderador editorial/jurídico

**Quem é:** pessoa autorizada a revisar conteúdo do Downloads.

**Objetivos:**

- confirmar escopo, duplicidade, qualidade mínima, gratuidade/PWYW zero e base jurídica;
- corrigir sem sequestrar autoria;
- aprovar, pedir ajuste, rejeitar, suspender ou encaminhar;
- manter decisões consistentes e auditáveis.

**Necessidades:**

- fila priorizável;
- comparação entre versão publicada e proposta;
- acesso controlado à evidência privada;
- destino final e cadeia de redirect;
- checklist por `external_link|managed_upload`;
- notas internas, motivo público adequado e histórico;
- ferramentas contra abuso sem decisão opaca.

**Não pode:** aprovar por confiança pessoal sem D100, apagar trilha ou ativar auto-publicação por conveniência.

#### P8 — Administrador do Downloads

**Quem é:** responsável por política, permissões e operação do projeto.

**Objetivos:**

- gerir moderadores, permissões e futura auto-publicação;
- tratar recurso, takedown e incidentes;
- gerir vocabulários próprios sem duplicar sistemas/edições;
- acompanhar filas, storage, link checker e abuso;
- suspender risco rapidamente;
- manter beta/prod e integrações coerentes.

**Diferença do moderador:** pode gerir permissões/políticas e decidir escaladas; não substitui automaticamente prova ou revisão.

#### P9 — Titular/representante que não criou a ficha

**Quem é:** autor, editora, tradutor ou agente legítimo diante de ficha criada por curador/terceiro.

**Objetivos:**

- corrigir créditos, licença, destino e apresentação;
- reivindicar manutenção;
- autorizar ou proibir reupload;
- pedir retirada;
- preservar contribuições legítimas e histórico.

**Necessidades:**

- fluxo de reivindicação com prova;
- resolução sem transferência automática;
- comunicação auditável;
- opção de coexistir com curador como colaborador.

#### P10 — Operação automatizada

**Quem é:** link checker, scanner, quota monitor e jobs futuros. Não é usuário nem decisor jurídico.

**Objetivos:**

- verificar disponibilidade, redirects, segurança e condição de acesso;
- detectar mudança de gratuito/PWYW;
- monitorar arquivos/providers;
- gerar evidência operacional e encaminhar anomalia.

**Limite:** automação muda estado técnico ou solicita revisão conforme política; não conclui titularidade/licença nem publica conteúdo por conta própria.

### Matriz de capacidades

| Capacidade | Visitante | Usuário | Publicador/curador | Moderador | Admin | Automação |
|---|---:|---:|---:|---:|---:|---:|
| Buscar/filtrar/ver ficha | sim | sim | sim | sim | sim | leitura técnica |
| Seguir destino | sim | sim | sim | sim | sim | verificação controlada |
| Favoritar/colecionar | não | sim | sim | sim | sim | não |
| Comentar/avaliar | não | sim | sim | sim | sim | não |
| Criar rascunho | não | sim | sim | sim | sim | não |
| Enviar à moderação | não | sim | sim | sim | sim | não |
| Editar próprio cadastro | não | não | sim, com ownership | sim | sim | não |
| Editar crédito alheio publicado | não | sugerir correção | sugerir/reivindicar | sim, auditado | sim, auditado | não |
| Ver evidência privada | não | só própria | só própria | conforme escopo | sim, conforme política | mínimo técnico |
| Aprovar/rejeitar | não | não | não | sim | sim | não |
| Suspender por risco | denunciar | denunciar | denunciar/próprio | conforme permissão | sim | somente regra técnica aprovada |
| Gerir permissões | não | não | não | não | sim | não |
| Conceder auto-publicação | não | não | não | não | futuro, revogável | não |
| Apagar histórico publicado | não | não | não | não | não | não |

### Jornadas principais

#### J1 — Descobrir e acessar material

1. Visitante chega por busca, SEO, destaque, perfil ou link.
2. Pesquisa ou filtra por sistema, edição, idioma, tipo, gênero, formato e acesso.
3. Card informa atributos essenciais e flags.
4. Ficha detalha créditos, licença/base, compatibilidade, barreiras, versão, verificação e interações.
5. CTA coerente:
   - `Acessar material` para landing page externa;
   - `Baixar arquivo` para arquivo elegível;
   - `Pague quanto quiser — consulte no site externo` para PWYW.
6. Artifício registra clique/visita, nunca download concluído.
7. Destino abre com aviso quando houver barreira ou PWYW.

**Sucesso:** pessoa chega ao destino correto sabendo o que encontrará.  
**Falha recuperável:** link indisponível oferece denúncia, última verificação e materiais relacionados.

#### J2 — Participar e organizar

1. Visitante tenta favoritar, colecionar, comentar ou avaliar.
2. SSO leva ao Accounts e retorna ao contexto original.
3. Usuário conclui ação sem perder ficha.
4. Favorito/coleção ficam privados por padrão; comentário/avaliação seguem política pública.
5. Usuário consegue editar/remover própria interação.

**Sucesso:** participação simples sem transformar coleção em biblioteca de propriedade.

#### J3 — Publicar material próprio por link

1. Usuário inicia cadastro e escolhe `author` ou `publisher`.
2. Busca preventiva mostra possíveis duplicatas.
3. Informa URL oficial e sistema detecta destino final.
4. Preenche identidade, créditos, classificação, acesso, licença e avisos.
5. Anexa prova D100.
6. Salva rascunho, revisa preview e envia.
7. Moderação aprova, pede ajustes ou rejeita com motivo.
8. Aprovado entra em publicação/descoberta; publicador acompanha histórico e saúde.

**Gate:** declaração sem prova não chega a aprovação.

#### J4 — Publicar material próprio por upload

1. Usuário escolhe `managed_upload`.
2. Fluxo confirma que material **não é PWYW** e que há direito de armazenar/distribuir.
3. Metadata/prova são preenchidas antes do envio definitivo.
4. Arquivo passa por tamanho, extensão, MIME, hash, malware e quarentena.
5. Backend escolhe provider conforme adapter; URL lógica não expõe fornecedor.
6. Moderação revisa ficha, prova e resultado técnico.
7. Publicação só ocorre com arquivo seguro e destino resolvível.

**Falha:** quota/provider/scan não perde rascunho; item fica pendente técnico, nunca publicado parcialmente.

#### J5 — Cadastrar curadoria de terceiro

1. Usuário escolhe explicitamente `curator`.
2. Busca duplicidade por título, URL final, autor/editora e sistema.
3. Usa preferencialmente página oficial; upload fica indisponível sem autorização específica.
4. Cadastra créditos reais, sem colocar a si mesmo como autor.
5. Anexa prova de gratuidade/PWYW zero e possibilidade de divulgação.
6. Moderação confirma fonte, atribuição e destino.
7. Ficha pública credita titulares; curador pode constar apenas como contribuição editorial discreta, conforme política futura.

**Sucesso:** material encontrado sem apropriação ou cópia indevida.

#### J6 — Cadastrar PWYW externo

1. Publicador/curador escolhe `pwyw_external`.
2. `managed_upload` desaparece/fica inválido.
3. Usuário informa página externa específica.
4. Prova mostra que opção zero libera integralmente o material.
5. Artifício não pergunta nem armazena valor/moeda.
6. Moderação consulta destino e confirma fluxo zero.
7. Ficha/CTA sinalizam que condições devem ser consultadas externamente.
8. Checker revalida; retirada da opção zero suspende material.

**Sucesso:** descoberta permite apoiar criador externamente sem Artifício virar comércio.

#### J7 — Publicar tradução/adaptação

1. Usuário escolhe `translator`.
2. Identifica obra-base, titular, autor original, idioma original/destino e escopo.
3. Liga sistema/edição corretos.
4. Apresenta licença/autorização/programa de fã.
5. Define destino/link ou upload conforme autorização; PWYW permanece só externo.
6. Moderação avalia tradução e direito separadamente.
7. Ficha mostra créditos sem confundir autor original, tradutor e editora.

#### J8 — Editar material publicado

1. Responsável abre ficha no painel e cria proposta de alteração.
2. Sistema classifica campos:
   - não sensíveis podem seguir política simplificada futura;
   - destino, arquivo, licença, créditos, acesso e titularidade sempre exigem nova revisão.
3. Versão publicada permanece ativa enquanto proposta aguarda, salvo risco.
4. Moderador compara diff e evidência.
5. Aprovação cria nova revisão/versionamento; rejeição preserva versão anterior.

**Sucesso:** catálogo não fica indisponível nem perde histórico por edição.

#### J9 — Moderar submissão

1. Moderador abre fila com tipo, risco, idade, duplicidade e pendências.
2. Confere cadastro, destino final, prova, créditos, taxonomia e flags.
3. Para upload, confere autorização e resultados técnicos.
4. Para PWYW, visita página e confirma opção zero sem registrar valor.
5. Decide:
   - pedir ajuste;
   - aprovar;
   - rejeitar;
   - escalar ao admin/jurídico;
   - marcar duplicata e orientar vínculo/merge.
6. Decisão grava checklist, nota, autor e data.
7. Publicador recebe motivo útil sem expor nota/evidência privada.

#### J10 — Denunciar e corrigir problema

1. Pessoa inicia denúncia na ficha.
2. Escolhe motivo: link quebrado, deixou de ser gratuito, PWYW sem zero, autoria/crédito, licença, conteúdo indevido, malware/phishing, duplicata ou outro.
3. Informa contexto/evidência; login e rate limit seguem risco.
4. Sistema acusa recebimento sem prometer resultado.
5. Risco técnico grave pode suspender destino preventivamente conforme política.
6. Moderador investiga, pede resposta ao responsável e decide.
7. Denunciante recebe estado compatível com privacidade.

#### J11 — Reivindicar ficha

1. Titular encontra ficha criada por curador.
2. Solicita vínculo como autor/editora/tradutor/representante.
3. Apresenta prova de identidade/representação.
4. Admin/moderador verifica sem remover curador automaticamente.
5. Pode:
   - conceder manutenção;
   - corrigir créditos;
   - registrar colaboração;
   - negar com motivo;
   - retirar material a pedido legítimo.
6. Histórico preserva origem e decisão.

#### J12 — Verificação periódica

1. Job seleciona destino conforme frequência/risco.
2. Resolve redirects com proteção SSRF e limites.
3. Verifica disponibilidade, segurança e sinais de condição de acesso.
4. Em PWYW, precisa confirmar que zero continua possível; valor não é persistido.
5. Resultado:
   - `verified`;
   - `degraded`;
   - `unavailable`;
   - `unsafe`;
   - `no_longer_free`;
   - `needs_human_review`.
6. Política aplica retentativas, suspensão ou fila humana.
7. Responsável é notificado e pode corrigir/recorrer.

#### J13 — Retirar ou encerrar manutenção

1. Responsável solicita retirada ou informa fim do material.
2. Sistema explica diferença entre remover destino, arquivar por autor e takedown.
3. Se não houver disputa, publicação sai da descoberta e destino é desativado.
4. Histórico/interações ficam preservados conforme retenção.
5. Arquivo gerenciado segue política de retenção/remoção dos providers.
6. Reativação exige destino elegível e nova verificação.

### Jornadas administrativas transversais

#### J14 — Conceder/revogar permissão futura de auto-publicação

1. Admin consulta histórico, incidentes e critérios ainda definidos por T3.3.
2. Concessão é explícita, limitada e auditada.
3. Permissão não elimina D100, scan, checker ou regras de PWYW.
4. Revogação afeta novas ações; não apaga histórico.
5. Incidente pode suspender permissão e publicações relacionadas conforme política.

**Estado no lançamento:** ferramenta/modelo previstos; concessão desativada.

#### J15 — Administrar organização

1. Representante comprovado cria/reivindica perfil institucional.
2. Convida membros com papéis limitados.
3. Membro publica/edita em nome da organização com autoria registrada.
4. Saída ou revogação remove acesso, não obras/histórico.
5. Ações sensíveis permanecem auditadas por pessoa real.

### Regras de ownership derivadas

1. Ownership pertence à relação conta/organização/ficha; crédito pertence à relação pessoa/organização/material. Não são equivalentes.
2. Material pode ter múltiplos responsáveis autorizados.
3. Organização nunca usa credencial compartilhada.
4. Curador pode manter ficha até titular legítimo assumir/colaborar; reivindicação não apaga contribuição.
5. Moderador pode corrigir conteúdo, mas não vira owner.
6. Admin resolve disputa; não presume titularidade apenas por domínio de e-mail ou nome.
7. Mudança de ownership é evento auditado com prova.
8. Suspensão de conta não determina automaticamente validade da obra; exige tratamento próprio.

### Requisitos de continuidade entre jornadas

- retorno SSO preserva URL e ação pretendida;
- rascunho sobrevive a falha de upload/provider;
- revisão nunca sobrescreve silenciosamente versão publicada;
- decisão de moderação sempre tem motivo e estado;
- erro técnico não vira rejeição jurídica;
- denúncia não expõe identidade/evidência sem necessidade;
- CTA nunca promete download concluído;
- material relacionado não substitui correção de link quebrado;
- toda saída externa deixa condição/barreira clara antes do clique.

### Perguntas encaminhadas, sem bloquear T2.1

- critérios exatos de auto-publicação: T3.3;
- regras e janela de recurso: T3.3/T3.4;
- visibilidade do crédito “cadastrado por”: T4.3;
- exigência de login para cada tipo de denúncia: T3.4/T5.1;
- retenção após retirada/takedown: T5.6;
- políticas de membro/organização e reivindicação: spec filha de perfis/ownership;
- frequência e capacidade semântica do checker de PWYW: T6.3;
- seguidores/notificações: pós-MVP em T2.2.

T2.1 fecha quem usa o produto, por quê, o que pode fazer e como percorre fluxos essenciais. T2.2 decidirá quais jornadas entram no MVP, pós-MVP ou ficam como não objetivo.

## T2.2 — MVP, pós-MVP e não objetivos

### Definição de MVP

MVP não significa protótipo descartável nem “lista com links”. É a menor versão pública que cumpre promessa já feita:

> Encontrar, catalogar, moderar, acessar e organizar materiais gratuitos de RPG — inclusive PWYW externo — com autoria, licença, sistema e condição de acesso claros.

Se faltar moderação, prova, taxonomia, verificação, storage escolhido, interações decididas ou operação beta/prod, produto ainda não atingiu MVP.

### Pré-requisitos bloqueantes do MVP

Não são funcionalidades opcionais do Downloads:

1. **Spec 062 implementada:** catálogo canônico de sistemas/edições disponível para leitura/escrita central.
2. **Contrato de identidade/SSO:** Accounts, sessão e retorno ao contexto funcionando no novo projeto.
3. **Ambientes canônicos:** `downloadsbeta.artificiorpg.com` e `downloads.artificiorpg.com`, seguindo padrão vigente sem snowflake.
4. **Política jurídica aprovada:** categorias de licença/fan content, prova D100, denúncia, retirada e retenção.
5. **Storage investigado:** produto exato Fastio confirmado; contratos, quotas, custos, APIs e riscos dos quatro providers conhecidos.
6. **Threat model/abuso:** link externo, upload, SSRF, malware, phishing, evidência privada, comentários e avaliações cobertos.

Sem qualquer item acima, desenvolvimento dependente pode avançar isoladamente, mas lançamento público não.

### MVP obrigatório

#### M1 — Catálogo público e descoberta

- home do Downloads;
- busca textual;
- sidebar facetada;
- drawer equivalente no mobile;
- submenu sob nav compartilhado;
- filtros por sistema, edição, idioma, tipo, gênero/tema, formato, compatibilidade e condição de acesso;
- ordenações não financeiras: relevância, recente, atualizado e avaliação/popularidade somente com critérios honestos;
- cards com capa, título, autor/editora, sistema, tipo, idioma, `free|pwyw_external` e barreiras relevantes;
- página de detalhe;
- URLs estáveis, metadata SEO, sitemap e dados estruturados adequados;
- estados vazios, indisponíveis e sem resultado;
- acessibilidade e tema padrão Artifício.

**Corte proibido:** substituir filtros por tags livres ou lançar sem sidebar/mobile equivalente.

#### M2 — Ficha e modelo editorial

- Material, MaterialVersion, Destination, arquivos, créditos, perfis, classificação, evidência, revisão, verificação e interações separados conceitualmente;
- título, resumo, descrição, capa/alt;
- autor, tradutor, editora/selo e créditos;
- sistema/edição canônicos ou agnóstico;
- tipo, gênero, idioma, formato, compatibilidade, classificação etária e avisos;
- licença/base jurídica e papel do cadastrante;
- versão, atualização/changelog e destinos ativos;
- flags de login, cadastro, newsletter, e-mail, código, idade, região e outra barreira;
- estado `free|pwyw_external`;
- última verificação em linguagem pública;
- CTA coerente com landing page, arquivo gerenciado ou PWYW externo.

**Corte proibido:** ficha genérica de título/descrição/link que adie autoria, licença ou classificação.

#### M3 — Submissão e ownership

- login SSO com retorno;
- painel do usuário;
- rascunho e preview;
- busca de duplicidade antes do cadastro;
- papéis `author|translator|publisher|curator`;
- link externo e upload gerenciado;
- múltiplos créditos;
- prova D100 obrigatória;
- edição como proposta revisável;
- histórico de versões/revisões;
- retirada pelo responsável;
- reivindicação básica por titular legítimo;
- perfil público de pessoa/editora e vínculo aos materiais;
- ownership separado de crédito/titularidade.

**Escopo mínimo institucional:** perfil de editora/selo pode ter um responsável verificado. Equipe com múltiplos membros e papéis granulares fica pós-MVP, mas modelo não pode exigir conta compartilhada.

#### M4 — Gratuidade e PWYW

- `free` para acesso sem oferta de pagamento;
- `pwyw_external` somente por landing page externa onde zero libera o material;
- nenhuma captura/exibição de valor ou moeda;
- badge/CTA “Pague quanto quiser — consulte no site externo”;
- proibição técnica de `managed_upload` para PWYW;
- moderação consulta fluxo externo;
- checker detecta retirada da opção zero;
- preço mínimo positivo, tier obrigatório pago ou material incompleto por zero são inelegíveis.

**Corte proibido:** aceitar tag “free” como prova ou armazenar cópia PWYW.

#### M5 — Moderação e administração

- fila para novo cadastro e edição sensível;
- estados editoriais definidos em T1.2a;
- checklist diferente para link/upload/PWYW;
- nota privada;
- comparação da proposta com versão publicada;
- pedir ajustes, aprovar, rejeitar, suspender, retirar e escalar;
- motivos auditáveis;
- gestão de denúncias, reivindicações e recursos básicos;
- permissões separadas de usuário, moderador e admin;
- modelo + superfície administrativa de auto-publicação presentes, **desativados por padrão e sem caminho de concessão ativo no lançamento**;
- auditoria de ações administrativas.

**Corte proibido:** publicação direta geral, aprovação sem prova ou decisão sem histórico.

#### M6 — Upload e media

- capas via Cloudinary compartilhado, backend signed;
- adapter de arquivo com Cloudflare R2, Backblaze B2, Fastio e Cloudinary PDF;
- ordem R2 → B2 → Fastio → Cloudinary PDF;
- URL lógica independente do provider;
- namespaces/credenciais isolados por ambiente;
- múltiplos arquivos e versões;
- validação de tamanho, extensão, MIME real e hash;
- malware scan/quarentena;
- idempotência, retry, limpeza temporária e reconciliação;
- quota/capacidade monitorada;
- falha de provider não publica objeto parcial;
- remoção/retention integrada ao lifecycle editorial.

**Corte proibido:** lançar upload somente com R2 e chamar B2/Fastio de futuro. D092 exige os três.

#### M7 — Interações comunitárias

Conforme D090, todas entram no MVP:

- comentários;
- avaliações;
- favoritos;
- coleções pessoais;
- denúncia de comentário/avaliação;
- edição/remoção da própria interação;
- moderação;
- uma avaliação por usuário/material;
- proteção básica contra spam/manipulação;
- amostra mínima antes de média/ranking público;
- contagem pública de favoritos conforme T2.5;
- privacidade de favoritos/coleções por padrão.

**Corte proibido:** reduzir MVP a favoritos e adiar comentários/avaliações/coleções.

#### M8 — Perfis públicos

- perfil de autor/criador;
- perfil de tradutor quando houver contribuição;
- perfil de editora/selo;
- nome, bio curta, links aprovados, avatar/logo, papéis e materiais relacionados;
- distinção entre perfil creditado e conta que administra;
- denúncia/reivindicação/correção;
- página indexável quando pública e válida.

#### M9 — Métricas honestas

- clique/visita ao destino;
- favoritos;
- avaliações/comentários;
- saúde dos destinos;
- volume/tempo de moderação;
- métricas privadas mínimas ao responsável;
- nenhuma métrica chamada “downloads” quando Artifício só conhece clique;
- proteção anti-bot/fraude e privacidade definidas por T2.5.

#### M10 — Verificação, segurança e abuso

- link checker periódico;
- resolução segura de redirect com proteção SSRF;
- verificação de disponibilidade e HTTPS;
- detecção/triagem de phishing/malware;
- estados de verificação T1.2a;
- retentativas e janela antes de indisponibilidade definitiva;
- suspensão rápida para risco grave;
- denúncia por link quebrado, deixou de ser gratuito, PWYW sem zero, autoria, licença, duplicidade, conteúdo indevido e segurança;
- rate limits e anti-spam;
- evidências privadas com autorização, retenção e auditoria;
- termos e avisos claros de responsabilidade do hub.

#### M11 — Operação e qualidade

- beta e produção isolados conforme padrão vigente;
- migrations, rollback e backup;
- health/readiness;
- logs estruturados, métricas e alertas;
- jobs observáveis e idempotentes;
- analytics compartilhado;
- feedback técnico compartilhado;
- testes unitários, integração, contrato, E2E e smoke;
- Lighthouse/SEO/a11y conforme gates do projeto;
- runbooks de storage, checker, moderação, incidente e takedown;
- carga inicial curada suficiente para validar filtros e descoberta antes do lançamento.

### Jornadas do T2.1 no MVP

| Jornada | MVP | Observação |
|---|---:|---|
| J1 descobrir/acessar | sim | núcleo do produto |
| J2 participar/organizar | sim | comentários, avaliações, favoritos e coleções |
| J3 publicar próprio por link | sim | fluxo principal |
| J4 publicar próprio por upload | sim | providers completos |
| J5 curadoria de terceiro | sim | requisito D090 |
| J6 PWYW externo | sim | D102 |
| J7 tradução/adaptação | sim | público essencial |
| J8 editar publicado | sim | revisão/histórico obrigatórios |
| J9 moderar | sim | lançamento bloqueado sem isso |
| J10 denunciar | sim | segurança/jurídico |
| J11 reivindicar ficha | sim, básico | disputa complexa pode exigir operação manual |
| J12 checker periódico | sim | saúde/condição de acesso |
| J13 retirar | sim | lifecycle mínimo |
| J14 auto-publicação | somente estrutura desativada | concessão real pós-MVP e novo gate |
| J15 organização | parcial | perfil + um responsável no MVP; equipes granulares depois |

### Pós-MVP planejado

Pós-MVP não significa prometido para imediatamente após lançamento. Cada item exige spec, prioridade e evidência.

#### P1 — Equipes institucionais avançadas

- vários membros por editora/coletivo;
- papéis granulares;
- convites, transferência e saída;
- aprovação interna da organização;
- operações em lote;
- delegação por catálogo.

#### P2 — Auto-publicação real

- critérios mensuráveis;
- concessão/revogação;
- limites por origem/tipo;
- shadow mode;
- auditoria e kill switch;
- rollout gradual;
- resposta automática a incidente.

**Gate:** nova decisão explícita do mantenedor. Estrutura desativada no MVP não autoriza ligar.

#### P3 — Seguidores e notificações

- seguir autor/editora/material/coleção;
- feed de atualizações;
- notificações dentro do Artifício;
- e-mail opt-in;
- digest e controle de frequência.

#### P4 — Curadoria editorial avançada

- coleções oficiais;
- destaques sazonais;
- listas colaborativas;
- páginas temáticas;
- recomendações editoriais e relacionadas;
- sem ranking financeiro.

#### P5 — Descoberta avançada

- busca semântica;
- recomendações personalizadas;
- sinônimos e aliases além do catálogo canônico;
- filtros salvos;
- comparação entre materiais;
- internacionalização ampla da interface.

#### P6 — Ferramentas avançadas do publicador

- duplicação de cadastro;
- edição em lote;
- importação por manifesto;
- webhook/API de atualização;
- analytics avançado;
- exportação do próprio catálogo;
- agendamento de publicação.

#### P7 — Automação assistiva

- sugestão de metadata;
- detecção avançada de duplicidade;
- classificação sugerida;
- triagem de prova;
- priorização de moderação;
- nunca decisão jurídica automática.

#### P8 — Integrações externas

- importação assistida de metadata oficial;
- status de plataformas conhecidas;
- verificação especializada de PWYW por provider;
- federação/feeds públicos;
- integrações VTT específicas.

### Não objetivos permanentes

Requerem nova decisão para existir:

1. Marketplace, loja ou checkout Artifício.
2. Processar pagamento, doação, gorjeta ou PWYW.
3. Capturar/exibir valor ou moeda PWYW.
4. Comissão, royalty, split, saldo, saque ou carteira.
5. Cupom, promoção, desconto, afiliado ou ranking por receita.
6. Produto com preço mínimo positivo.
7. Biblioteca de compras, prova de posse ou DRM.
8. Impressão sob demanda, estoque, frete ou produto físico.
9. Hospedar/espelhar material PWYW.
10. Reupload de terceiro sem autorização demonstrável.
11. Reproduzir obra integral como wiki/conteúdo nativo.
12. Arquivo durável na VM/filesystem do app.
13. Terceiro catálogo local de sistemas/edições.
14. Importar suposto legado WP de Downloads.
15. Chamar clique externo de download concluído.
16. Publicação automática por IA.
17. Decisão automática de titularidade, licença ou legalidade.
18. Página visual livre/custom CSS por publicador.
19. Executáveis/instaladores no escopo inicial.
20. Rede social geral, fórum ou chat desvinculado das fichas.

### Itens explicitamente não cortáveis do MVP

Para impedir erosão posterior de escopo, estes itens não podem ser movidos para pós-MVP por conveniência técnica:

- moderação prévia;
- prova D100;
- curadoria de terceiro;
- PWYW externo sem valor exposto;
- comentários, avaliações, favoritos e coleções;
- perfis públicos;
- link checker;
- denúncia/takedown;
- R2, B2 e Fastio;
- scan/quarentena;
- histórico editorial;
- catálogo canônico 062;
- ambientes beta/prod isolados;
- acessibilidade, segurança e observabilidade mínimas.

Qualquer redução exige decisão explícita do mantenedor e atualização de D090/D092/D094/D100/D102 conforme impacto.

### Gate de lançamento do MVP

MVP pode ser chamado de pronto somente quando:

1. pré-requisitos bloqueantes estão fechados;
2. jornadas J1–J13 passam em beta, incluindo J11 básico;
3. estrutura J14 existe e está comprovadamente desativada;
4. J15 funciona com um responsável institucional sem conta compartilhada;
5. todos os providers obrigatórios passam upload/leitura/remoção/reconciliação em beta;
6. PWYW nunca oferece upload nem mostra valor;
7. prova/evidência privada não vaza;
8. checker detecta link quebrado e perda de opção zero;
9. moderação e recurso básico preservam histórico;
10. interações incluem antiabuso e moderação;
11. beta/prod permanecem isolados;
12. smoke, rollback, backup, observabilidade, SEO e a11y passam nos gates definidos pelas specs filhas.

T2.2 fecha fronteira de lançamento. Próxima task de produto é T2.5, métricas de sucesso e analytics; T2.3/T2.4 já estão encerradas.

## T2.5 — Métricas de sucesso e analytics

### Princípio pétreo de medição

Downloads mede **descoberta e encaminhamento**, não consumo final fora do Artifício.

- `destination_click` = usuário acionou CTA para destino;
- `managed_file_redirect` = Artifício resolveu URL lógica de arquivo gerenciado;
- nenhum dos dois prova início, conclusão, leitura ou uso do download;
- palavra pública correta: **cliques**, **visitas ao destino** ou **acessos encaminhados**;
- palavra `downloads` só pode nomear o projeto, nunca contador inferido.

Se provider futuro oferecer log técnico de transferência, isso ainda não prova uso e exige decisão própria antes de virar métrica pública.

### Objetivo de sucesso

Produto tem sucesso quando pessoas encontram material elegível e chegam ao destino correto, enquanto catálogo permanece juridicamente rastreável, tecnicamente saudável e operacionalmente moderável.

Quatro resultados precisam coexistir:

1. **Descoberta útil:** buscas/filtros levam a fichas relevantes.
2. **Encaminhamento honesto:** CTA leva a destino correto sem fingir download.
3. **Catálogo confiável:** links, arquivos, gratuidade/PWYW e provas permanecem válidos.
4. **Ecossistema sustentável:** publicadores conseguem contribuir e equipe consegue moderar sem fila/abuso incontrolável.

Volume sozinho não define sucesso. Muitos cliques para links quebrados representam falha.

### Métrica principal

**Acessos qualificados ao destino por período**

Conta evento deduplicado quando:

- material está publicado;
- destino estava `verified` no momento;
- ação veio de pessoa provável, não bot conhecido;
- CTA foi acionado voluntariamente;
- evento passou validação de integridade;
- repetições da mesma sessão/material/destino dentro da janela anti-spam contam uma vez para métrica qualificada.

Nome público: **Visitas ao destino**.  
Nome interno sugerido: `qualified_destination_visits`.

Não usar como ranking isolado. Materiais antigos, marcas grandes e tráfego externo naturalmente concentram cliques.

### Métricas de resultado

#### Descoberta

| Métrica | Definição | Leitura |
|---|---|---|
| buscas iniciadas | submissões válidas de busca | demanda |
| busca com resultado | busca retornou ao menos uma ficha elegível | cobertura |
| zero resultados | busca sem ficha | lacuna de catálogo/taxonomia |
| refinamento de filtro | filtro aplicado/removido | utilidade facetada |
| resultado → ficha | abertura de ficha após lista/busca | relevância de cards |
| ficha → destino | visita qualificada após ficha | clareza/confiança |
| tempo até destino | duração entre entrada e CTA, agregada | fricção; não otimizar cegamente |
| retorno ao catálogo | sessão recorrente sem identificar pessoa publicamente | retenção útil |

#### Cobertura do catálogo

| Métrica | Definição |
|---|---|
| materiais publicados | fichas atualmente publicadas |
| materiais por sistema/edição | cobertura canônica, sem meta artificial de preencher tudo |
| materiais agnósticos | cobertura de conteúdo não dependente de sistema |
| idiomas/tipos/formatos cobertos | diversidade do acervo |
| perfis com material publicado | base ativa de criadores/editoras |
| origem própria vs curadoria | proporção por papel do cadastrante |
| `free` vs `pwyw_external` | condição de acesso, sem valor/moeda |
| link externo vs upload gerenciado | operação por origem |

#### Publicação e moderação

| Métrica | Definição |
|---|---|
| rascunhos iniciados | primeiro save válido |
| rascunhos enviados | entrada em revisão |
| abandono de rascunho | sem envio após janela definida |
| tempo até primeira resposta | submissão → primeira ação humana |
| tempo até decisão | submissão → aprovação/rejeição |
| pedidos de ajuste | volume e ciclos por submissão |
| taxa de aprovação | aprovações/submissões decididas, segmentada por origem |
| motivo de rejeição | distribuição controlada |
| backlog de moderação | itens pendentes por idade/risco |
| retrabalho pós-publicação | correção material logo após aprovação |
| recurso procedente | decisão revertida por erro inicial |

Taxa alta de rejeição pode indicar formulário ruim, não “moderação eficiente”. Sempre cruzar motivo e origem.

#### Confiabilidade e segurança

| Métrica | Definição |
|---|---|
| cobertura de verificação | destinos checados dentro da janela/total publicado |
| destinos saudáveis | `verified`/total |
| destinos degradados | `degraded`/total |
| indisponibilidade | `unavailable`/total |
| deixou de ser gratuito | `no_longer_free` |
| PWYW perdeu opção zero | subconjunto explícito de `no_longer_free` |
| tempo para detectar falha | mudança estimada/primeiro sinal → detecção |
| tempo para conter risco | detecção grave → suspensão |
| falsos positivos | suspensão/checker revertidos sem mudança real |
| denúncias procedentes | confirmadas/decididas |
| reincidência por responsável | incidentes repetidos, uso administrativo restrito |
| malware/phishing | detecções, bloqueios e incidentes confirmados |

#### Comunidade

| Métrica | Definição |
|---|---|
| favoritos | relações ativas |
| coleções criadas | coleções não vazias e ativas |
| materiais em coleções | relações material/coleção |
| comentários válidos | publicados, excluindo spam/removidos |
| avaliações válidas | uma por usuário/material |
| cobertura de avaliação | fichas com amostra suficiente |
| denúncias de interação | comentários/avaliações reportados |
| remoção por abuso | interações moderadas |
| participantes recorrentes | usuários ativos em períodos distintos, agregado |

Não gamificar quantidade de comentários/submissões. Incentivo volumétrico favorece spam.

#### Storage

| Métrica | Definição |
|---|---|
| uploads tentados/concluídos/falhos | por provider e ambiente |
| bytes armazenados | por provider, tipo e ambiente |
| objetos ativos/órfãos | reconciliação |
| uso de quota | percentual e tendência |
| seleção de fallback | quantas vezes cadeia avançou de provider |
| falha por provider | timeout, quota, autenticação, validação ou indisponibilidade |
| tempo de processamento | upload → scan/quarentena pronta |
| detecções de malware | arquivo bloqueado |
| remoções pendentes/falhas | lifecycle |
| integridade | hash divergente, objeto ausente ou metadata inconsistente |

Nunca publicar quota, custo, bucket, object key ou fornecedor real de cada arquivo.

### Funis canônicos

#### Funil de descoberta

`catalog_view → search_or_filter → material_view → destination_click → redirect_resolved`

Quebras interpretáveis:

- pouca busca/filtro: navegação direta pode estar boa ou filtros invisíveis;
- pouca ficha: cards/resultados pouco relevantes;
- pouca visita ao destino: ficha não inspira confiança, CTA confuso ou barreira desestimula;
- redirect falho: problema técnico, nunca comportamento do usuário.

#### Funil de contribuição

`submission_started → draft_saved → evidence_attached → submitted → first_review → decision → published`

Segmentar por:

- papel;
- `external_link|managed_upload`;
- `free|pwyw_external`;
- primeiro cadastro vs publicador recorrente;
- motivo de abandono/rejeição quando conhecido.

#### Funil de qualidade

`verification_due → check_started → check_completed → healthy_or_issue → auto_retry_or_human_review → resolved`

#### Funil de denúncia

`report_started → report_submitted → triaged → action_or_no_action → resolved`

### Eventos conceituais mínimos

Nomes finais dependem da spec de analytics, mas semântica não pode mudar.

| Evento | Momento | Dados permitidos mínimos |
|---|---|---|
| `catalog_view` | lista/home aberta | origem, dispositivo agregado |
| `search_submitted` | busca válida | comprimento/faixa; termo bruto somente se política permitir |
| `filter_changed` | filtro aplicado/removido | família e valor canônico não sensível |
| `sort_changed` | ordenação alterada | tipo |
| `material_view` | ficha carregada | material, origem de navegação |
| `profile_view` | perfil público aberto | perfil público |
| `destination_click` | CTA externo acionado | material, destino, condição/barreiras |
| `redirect_resolved` | resolução concluída | sucesso, classe de destino, latência |
| `favorite_changed` | favorito criado/removido | material, ação |
| `collection_changed` | relação alterada | material, ação; nunca nome privado |
| `comment_submitted` | comentário enviado | material, estado; nunca texto |
| `rating_submitted` | avaliação salva | material; valor só no domínio transacional necessário |
| `report_submitted` | denúncia concluída | categoria; nunca narrativa/evidência em analytics |
| `submission_started` | primeiro passo | origem/papel |
| `draft_saved` | rascunho persistido | completude agregada |
| `evidence_attached` | prova vinculada | tipo, nunca URL/conteúdo |
| `submission_submitted` | fila de revisão | origem/papel/condição |
| `review_action` | ação moderadora | classe da ação/motivo controlado |
| `material_published` | publicação efetiva | origem/condição/classificações públicas |
| `verification_completed` | checker finaliza | estado, classe de falha, latência |
| `upload_completed` | pipeline termina | provider abstrato ou interno restrito, tamanho em faixa |
| `security_blocked` | bloqueio técnico | categoria, nunca payload |

### Dimensões permitidas

- ambiente;
- data/hora agregável;
- material/versão por ID interno;
- origem da navegação;
- condição `free|pwyw_external`;
- `external_link|managed_upload`;
- landing page vs arquivo;
- barreiras declaradas;
- papel do cadastrante;
- sistema/edição/tipo/idioma/formato por ID controlado;
- estado editorial/verificação;
- dispositivo/canal em granularidade segura;
- usuário autenticado de forma pseudonimizada apenas onde necessário.

### Dados proibidos em analytics

- conteúdo ou imagem da prova D100;
- URL privada da evidência;
- token, cookie, e-mail ou nome real;
- query string completa de destino;
- valor/moeda PWYW;
- valor eventualmente pago fora;
- texto de comentário, denúncia, moderação ou descrição;
- filename/object key/bucket/credencial;
- IP persistido como identidade de produto;
- conteúdo do arquivo;
- motivo jurídico em texto livre;
- IDs externos que permitam correlação desnecessária.

Logs técnicos seguem política própria e não viram analytics automaticamente.

### Deduplicação e anti-fraude

Manter três contagens distintas:

1. **eventos brutos:** uso técnico restrito e retenção curta;
2. **eventos válidos:** passam schema e integridade;
3. **eventos qualificados:** deduplicados e sem bot/abuso provável.

Regras mínimas:

- idempotency/event ID;
- janela de deduplicação por sessão + material + destino;
- bots/crawlers conhecidos fora de clique público;
- preview/admin/moderação/testes fora de métricas públicas;
- rate limit para interação e redirect;
- detecção de rajada/anomalia;
- usuário não aumenta avaliação/favorito repetindo ação;
- material não ganha ranking apenas por tráfego externo concentrado;
- correção retroativa possível sem apagar trilha;
- beta nunca mistura analytics com produção.

Janela exata e modelo anti-bot serão decididos na spec executável com dados beta.

### Métricas públicas

#### Na ficha

Podem aparecer:

- visitas ao destino qualificadas;
- favoritos;
- média de avaliação **somente com amostra mínima**;
- quantidade de avaliações;
- quantidade de comentários publicados;
- última verificação;
- data de publicação/atualização.

Regras:

- rótulo “Visitas ao destino”, nunca “Downloads”;
- número pode ser arredondado/faixado para reduzir manipulação e falsa precisão;
- sem amostra mínima: “Ainda sem avaliações suficientes”;
- métricas suspensas/contestadas podem ficar ocultas;
- zero é válido; não inventar popularidade;
- não exibir receita, valor PWYW, bytes ou custo.

#### Em listas/rankings

- relevância de busca não expõe fórmula completa de segurança, mas critérios gerais são públicos;
- popularidade combina sinais qualificados e saúde, nunca só clique;
- novidade e atualização usam datas editoriais reais;
- destaques editoriais são rotulados como curadoria;
- nenhum “mais baixado” quando não existe confirmação de download.

### Métricas privadas do responsável

Painel pode mostrar:

- visitas qualificadas por material/período;
- origem agregada do tráfego;
- favoritos/coleções agregados;
- avaliações/comentários;
- status do funil de submissão;
- saúde/verificações;
- incidentes e denúncias próprias com privacidade;
- uploads, versões e uso agregado do próprio acervo.

Não mostrar:

- identidade de visitante;
- quem favoritou/colecionou, salvo interação explicitamente pública;
- IP, fingerprint ou sessão individual;
- dados de outros publicadores;
- conteúdo privado de denúncia/evidência;
- valor PWYW.

### Métricas administrativas

- funis completos e backlog;
- SLA/SLO de moderação;
- saúde/checker;
- abuso/segurança;
- storage/quota/custo operacional;
- cobertura taxonômica;
- qualidade de busca/zero results;
- incidência por origem/provider;
- adoção e retenção agregadas;
- auditoria de auto-publicação desativada;
- alertas de isolamento beta/prod.

Acesso por menor privilégio; métricas jurídicas e técnicas podem exigir permissões diferentes.

### Metas e método de baseline

Não há base real para inventar metas de crescimento antes do produto existir.

#### Beta — provar instrumentação e fluxo

Metas são de correção:

- 100% dos eventos obrigatórios passam validação de schema;
- 0 mistura beta/prod;
- 0 evento com dado proibido em amostra auditada;
- 0 contador público rotulado como download;
- 100% dos materiais publicados de teste têm destino/evidência/estado;
- 100% dos cenários J1–J13 geram sequência esperada;
- bots, admin e testes não inflam contador público;
- PWYW não registra valor/moeda;
- dashboards reconciliam com dados transacionais dentro de tolerância definida pela spec executável.

#### Produção — baseline de 30 dias

Primeiros 30 dias servem para:

- medir distribuição real;
- separar tráfego humano/bot;
- identificar buscas sem resultado;
- medir tempos de moderação/checker;
- calibrar deduplicação;
- encontrar eventos faltantes ou excessivos;
- não publicar ranking competitivo instável.

#### Após 30 dias

Equipe define metas trimestrais com:

- valor inicial;
- alvo;
- janela;
- segmento;
- responsável;
- risco de incentivo perverso;
- ação caso melhore ou piore.

#### Revisão de 90 dias

Validar:

- acessos qualificados crescem junto com destinos saudáveis;
- zero results caem nas consultas prioritárias;
- backlog/tempo de moderação são sustentáveis;
- taxa de correção/recurso não indica decisões ruins;
- comunidade participa sem abuso crescente;
- providers suportam volume/custo;
- métricas públicas não geraram gaming.

### Indicadores de alerta

Disparam investigação, não punição automática:

- clique cresce e saúde cai;
- material recebe rajada anormal;
- favoritos/ratings de contas recém-criadas se concentram;
- rejeição sobe para um papel/origem;
- muitos rascunhos param antes da prova;
- PWYW falha repetidamente na verificação zero;
- um provider recebe fallback excessivo;
- backlog envelhece;
- denúncias procedentes sobem após aprovação;
- buscas recorrentes sem resultado;
- diferença entre contagem transacional e analytics;
- evento proibido aparece em payload/log.

### Critérios de aceite da futura implementação

1. catálogo de eventos versionado;
2. schemas validados;
3. consentimento/cookies seguem padrão Artifício vigente;
4. beta/prod isolados;
5. testes de evento positivo, negativo, duplicado e bot;
6. reconciliação com banco para favoritos, avaliações, publicações e redirects;
7. auditoria automática/manual de dados proibidos;
8. painéis respeitam escopo público/responsável/admin;
9. métricas funcionam com adblock sem quebrar produto;
10. analytics indisponível não impede CTA, submissão ou moderação;
11. retenção e exclusão documentadas;
12. nomes públicos revisados para nunca afirmar download não observado.

T2.5 encerra F2. Próxima fase é F3 — conteúdo e políticas, começando por T3.1 (taxonomia e metadados obrigatórios/opcionais).

## T3.1 — Taxonomia e metadados obrigatórios/opcionais

### Princípios

1. Taxonomia serve descoberta e consistência; não replica estrutura comercial do DriveThruRPG.
2. Campos centrais usam vocabulário controlado administrável, nunca enum congelado no frontend.
3. Tags livres complementam; não substituem sistema, edição, idioma, tipo, formato, licença ou acesso.
4. Sistemas/edições são IDs canônicos da Spec 062. Downloads não mantém cópia ou fallback local.
5. Cenários/ambientações ficam fora do catálogo compartilhado da 062 e recebem vocabulário próprio do Downloads.
6. “Outro” sempre exige texto de sugestão e entra em moderação; não vira categoria permanente automaticamente.
7. Valores inativos permanecem legíveis em fichas antigas e apontam ao substituto quando mesclados.
8. Classificação pública usa rótulos traduzidos; persistência futura usa IDs/slugs estáveis.
9. Ausência conhecida, não aplicável e desconhecido são estados diferentes.
10. Nenhum campo financeiro existe; PWYW é condição externa sem valor/moeda.

### Famílias taxonômicas

| Família | Tipo | Cardinalidade | Faceta pública | Fonte/governança |
|---|---|---:|---:|---|
| sistema | controlada | 0..N | sim | serviço canônico 062 |
| edição | controlada | 0..N | sim | serviço canônico 062 |
| compatibilidade | controlada | 1..N | sim | Downloads |
| cenário/ambientação | controlada extensível | 0..N | sim | Downloads; fora da 062 |
| tipo de material | hierárquica | 1 | sim | Downloads |
| gênero/tema | hierárquica | 1..N | sim | Downloads |
| idioma | padrão BCP 47 | 1..N | sim | registro padrão + administração |
| formato de conteúdo | controlada | 1..N | sim | Downloads |
| plataforma/ecossistema | controlada extensível | 0..N | sim | Downloads |
| condição de acesso | fechada | 1 | sim | `free|pwyw_external` |
| barreira de acesso | fechada/extensível | 0..N | sim | Downloads |
| licença/base | controlada | 1..N | sim | Downloads/política T3.2 |
| papel de crédito | controlada | 1..N | não como filtro inicial | Downloads |
| público/modo de uso | controlada | 0..N | sim, quando útil | Downloads |
| classificação etária | controlada | 1 | sim | Downloads |
| avisos de conteúdo | controlada + texto | 0..N | sim | Downloads |
| método de criação | controlada | 1..N | sim | política T3.2 |
| tags | moderada | 0..N | secundária | Downloads |

### Sistema, edição e compatibilidade

#### Sistema/edição

- Material pode referenciar vários sistemas quando realmente compatível.
- Edição só pode ser selecionada sob sistema pai válido.
- Material agnóstico usa `system_agnostic=true` e não seleciona sistema/edição.
- `system_agnostic=true` é incompatível com qualquer `system_id`.
- “Sistema próprio incluído” não é agnóstico: sistema deve existir/sugerir-se no catálogo 062.
- Sistema desconhecido não vira texto livre: submissão abre sugestão central e pode permanecer em rascunho.
- Subsistema/variante do modelo 062 pode ser usado quando necessário; não duplicar como tag.

#### Compatibilidade

Valores iniciais:

| Valor | Significado |
|---|---|
| `native` | criado especificamente para sistema/edição selecionados |
| `compatible` | usa ou complementa regras sem ser produto-base |
| `adaptation` | converte material de outra origem/sistema |
| `multi_system` | oferece suporte explícito a mais de um sistema |
| `system_agnostic` | não depende de regras específicas |
| `requires_core_rules` | exige livro/regras-base externas |
| `standalone` | inclui tudo necessário para uso pretendido |

Regras:

- `system_agnostic` corresponde ao estado global e não combina com sistema;
- `multi_system` exige ao menos dois sistemas ou justificativa moderada;
- `requires_core_rules` deve apontar requisitos em texto e, quando possível, sistema/edição;
- compatibilidade não autoriza uso de marca; política jurídica continua separada.

### Cenário/ambientação

Vocabulário próprio, administrável e opcional:

- cenário oficial/licenciado;
- cenário de terceiro;
- cenário próprio;
- genérico;
- histórico/real;
- sem cenário definido.

Fichas podem relacionar nome canônico de ambientação. Sugestões passam por moderação, aliases e deduplicação. Cenário não entra no serviço 062 nem interfere na hierarquia sistema/edição.

### Tipo de material

Uma ficha possui **um tipo primário**. Conteúdo híbrido usa tags/atributos secundários; duplicar tipo para ganhar filtros é proibido.

#### 1. Regras e jogos

- `core_rulebook` — livro/regras básicas completas;
- `quickstart` — início rápido/kit introdutório;
- `srd_reference` — SRD, referência aberta ou documento de referência;
- `rules_supplement` — expansão/suplemento de regras;
- `rules_variant` — regra alternativa, hack ou variante;
- `conversion_guide` — conversão/adaptação entre sistemas/edições;

#### 2. Aventuras e campanha

- `adventure` — aventura pronta;
- `one_shot` — aventura de sessão única;
- `campaign` — campanha;
- `adventure_path` — série/caminho de aventuras;
- `encounter` — encontro/cena isolada;
- `plot_hook` — sementes/ganchos;
- `solo_adventure` — aventura solo;

#### 3. Cenário e lore

- `setting` — ambientação/cenário;
- `location` — local, cidade, região ou dungeon descritiva;
- `lore` — história, cosmologia ou material de mundo;
- `faction` — facção/organização;
- `gazetteer` — guia geográfico;

#### 4. Personagens e criaturas

- `character_option` — classe, arquétipo, ancestralidade, talento ou opção;
- `npc` — NPCs;
- `bestiary` — coleção de criaturas;
- `creature` — criatura individual/pequeno conjunto;
- `equipment` — itens, equipamentos, veículos;
- `spell_power` — magias, poderes ou habilidades;

#### 5. Apoio ao mestre/jogador

- `gm_guide` — guia/ferramenta para mestre;
- `player_guide` — guia para jogador;
- `reference_sheet` — referência rápida/cheat sheet;
- `character_sheet` — ficha de personagem;
- `playbook` — playbook/arquétipo jogável;
- `handout` — handout/documento de mesa;
- `safety_tool` — ferramenta de segurança;
- `session_tool` — iniciativa, campanha, notas ou gestão de sessão;
- `generator_table` — gerador/tabela aleatória;

#### 6. Mapas e recursos visuais

- `map` — mapa;
- `battlemap` — mapa tático;
- `token` — tokens/peões digitais;
- `paper_miniature` — miniatura imprimível;
- `card_deck` — cartas/deck;
- `visual_asset` — arte/asset visual permitido para mesa;

#### 7. VTT e ferramentas digitais

- `vtt_module` — módulo/pacote para VTT;
- `vtt_asset` — asset configurado para VTT;
- `digital_tool` — ferramenta digital não executável distribuída em formato permitido;
- `dataset` — tabela/dados estruturados para uso RPG;

#### 8. Produção e criação

- `creator_resource` — template, guia editorial ou recurso para criadores;
- `translation_resource` — glossário/guia de tradução relacionado a material;
- `accessibility_resource` — versão/recurso acessível;
- `license_document` — licença, compatibility license ou kit de comunidade;

#### 9. Mídia editorial relacionada

- `magazine_zine` — revista/zine;
- `fiction` — ficção diretamente vinculada a RPG/cenário;
- `comic` — quadrinho diretamente vinculado;
- `audio_resource` — trilha, ambiente ou áudio para mesa;
- `other_rpg_material` — exceção moderada, nunca categoria de conveniência.

Regras:

- software executável/instalador continua proibido no escopo inicial;
- `digital_tool` exige formato não executável permitido pela futura allowlist;
- `fiction|comic|audio_resource` só entram quando relação com RPG é explícita;
- `other_rpg_material` exige justificativa e revisão taxonômica.

### Gênero e tema

Cobertura superior preserva famílias observadas no DriveThruRPG:

| Família | Exemplos de subgênero inicial |
|---|---|
| `family_gaming` | infantil, todas as idades, educativo |
| `fantasy` | alta fantasia, baixa fantasia, espada e feitiçaria, fantasia urbana, dark fantasy, folclore |
| `historical` | antiguidade, medieval, renascimento, era moderna, guerras, história alternativa |
| `horror` | cósmico, gótico, sobrevivência, body horror, folk horror, slasher |
| `modern` | contemporâneo, espionagem, crime, militar, ação, cotidiano |
| `science_fiction` | space opera, cyberpunk, pós-apocalipse, hard sci-fi, biopunk, mecha |
| `miscellaneous` | universal, multigênero, surreal, humor, experimental |

Famílias adicionais necessárias para evitar jogar conceitos recorrentes em “miscellaneous”:

- `superhero`;
- `western`;
- `mystery_investigation`;
- `romance_drama`;
- `mythology_religion`;
- `sports_competition`.

Regras:

- ao menos uma família;
- até limite definido na implementação para evitar spam;
- subgênero implica família pai;
- tema sensível não substitui aviso de conteúdo;
- “OSR”, “PbtA”, “solo” e “rules-light” não são gênero: pertencem a estilo/modo/tags controladas.

### Idioma

- Usar BCP 47 (`pt-BR`, `en`, `es`, etc.), com rótulo localizado.
- Um idioma principal obrigatório.
- Idiomas adicionais permitidos quando conteúdo realmente multilíngue.
- `language_independent` somente para material sem texto necessário.
- Tradução registra idioma original e idioma(s) da versão atual.
- Não usar bandeira como representação única de idioma.
- Busca aceita nomes/aliases locais.

### Formato de conteúdo

Formato descreve o que usuário recebe, não onde compra nem provider.

Valores iniciais:

- `pdf`;
- `epub`;
- `mobi`;
- `plain_text`;
- `markdown`;
- `html_web`;
- `image_pack`;
- `printable`;
- `spreadsheet`;
- `structured_data`;
- `audio`;
- `video`;
- `vtt_package`;
- `vtt_compendium`;
- `archive`;
- `other_format`.

Regras:

- múltiplos formatos permitidos;
- formato declarado é validado contra arquivos/landing page quando possível;
- `archive` nunca basta sozinho: conteúdo interno também deve ser descrito;
- `other_format` exige sugestão;
- formato taxonômico não é allowlist de upload. T5.4/T5.5 decidirão MIME/extensão/tamanho seguros.

### Plataforma/ecossistema

Usado somente quando material depende ou possui versão preparada para plataforma:

- `foundry_vtt`;
- `roll20`;
- `fantasy_grounds`;
- `alchemy_vtt`;
- `owlbear_rodeo`;
- `tabletop_simulator`;
- `maptool`;
- `generic_vtt`;
- `web_browser`;
- `print_physical_use`;
- `other_platform`.

Regras:

- plataforma não significa formato;
- material PDF usado ao lado do Foundry não recebe `foundry_vtt` sem integração real;
- lista é administrável; não enum fechado no código;
- plataforma externa não implica endosso.

### Condição e barreiras de acesso

#### Condição

- `free`;
- `pwyw_external`.

#### Barreiras

- `login`;
- `account_registration`;
- `newsletter_signup`;
- `email_delivery`;
- `access_code`;
- `age_gate`;
- `region_restriction`;
- `other_access_requirement`.

Campos auxiliares:

- instrução curta;
- obrigatória/opcional;
- barreira confirmada em;
- observação pública moderada.

Regras:

- PWYW não é barreira; é condição;
- pagamento obrigatório nunca é barreira válida;
- “outro” exige descrição;
- ausência de barreira deve ser explícita, não inferida de lista vazia durante moderação.

### Licença/base jurídica

T3.1 define categorias para classificação; T3.2 fechará aceitação/provas.

- `public_domain`;
- `cc0`;
- `cc_by`;
- `cc_by_sa`;
- `cc_by_nc`;
- `cc_by_nc_sa`;
- `ogl`;
- `orc`;
- `system_specific_license`;
- `community_content_program`;
- `fan_content_policy`;
- `direct_permission`;
- `rights_holder_original`;
- `other_explicit_license`;
- `fan_work_without_explicit_license`;

Campos relacionados:

- nome/versão da licença;
- URL oficial;
- titular/licenciante;
- atribuição exigida;
- uso não comercial;
- share-alike;
- modificações permitidas;
- autorização de redistribuição/hosting;
- observação moderada.

Regras:

- “todos os direitos reservados” não é licença de redistribuição;
- curadoria por link pode ser válida sem direito de reupload;
- upload gerenciado exige direito específico de armazenar/distribuir;
- `fan_work_without_explicit_license` é exceção D090 e passa por T3.2.

### Créditos

Papéis iniciais:

- `author`;
- `designer`;
- `writer`;
- `translator`;
- `adapter`;
- `developer`;
- `editor`;
- `publisher`;
- `imprint`;
- `artist`;
- `cartographer`;
- `layout`;
- `proofreader`;
- `sensitivity_reader`;
- `license_holder`;
- `original_creator`;
- `other_credit`.

Cada crédito liga pessoa/organização, papel, ordem e texto opcional. Publicador no Artifício é relação separada.

Regras:

- ao menos um autor/criador responsável ou organização;
- tradutor não substitui autor original;
- editora não substitui autores;
- `other_credit` exige rótulo moderado;
- nome de pessoa/organização deve ser reutilizado/deduplicado quando existir;
- perfil público pode ser não reivindicado.

### Público e modo de uso

Valores opcionais e facetáveis:

- `gm`;
- `player`;
- `creator`;
- `educator`;
- `solo`;
- `duet`;
- `group`;
- `gm_less`;
- `cooperative`;
- `competitive`;
- `one_on_one`;
- `all_ages`.

Não misturar:

- `solo` como modo não substitui `solo_adventure` quando tipo é esse;
- `all_ages` não substitui classificação etária;
- “iniciante/avançado” pertence a nível de experiência, campo separado opcional.

### Classificação etária e avisos

Classificação inicial:

- `all_ages`;
- `age_10_plus`;
- `age_12_plus`;
- `age_14_plus`;
- `age_16_plus`;
- `age_18_plus`;
- `not_rated`.

Avisos controlados iniciais:

- violência;
- violência gráfica;
- horror;
- linguagem forte;
- sexo/nudez;
- drogas/álcool;
- discriminação/preconceito;
- abuso;
- automutilação/suicídio;
- morte/luto;
- temas religiosos;
- jogo/aposta;
- outro.

Regras:

- `not_rated` exige revisão, não ausência silenciosa;
- `age_18_plus` exige tratamento visual/descoberta específico;
- aviso pode ter nota curta sem spoiler quando necessário;
- taxonomia será revisada com política local, não importada como rating oficial estatal.

### Método de criação

Classificação inicial:

- `human_created`;
- `ai_assisted`;
- `ai_generated_text`;
- `ai_generated_image`;
- `procedural_generation`;
- `mixed_creation`;
- `unknown_legacy`.

Regras:

- múltiplos valores quando aplicável;
- `unknown_legacy` não pode ser usado em nova submissão comum;
- declaração não decide elegibilidade; T3.2 fecha política;
- tradução automática assistida deve ser declarada em campo apropriado;
- método de criação não substitui créditos/direitos.

### Tags

- máximo futuro definido por teste de UX/abuso;
- normalização de caixa, acentos, singular/plural e aliases;
- sem nomes de sistema/edição já estruturados;
- sem idioma/formato/plataforma já estruturados;
- sem termos promocionais (`melhor`, `grátis`, `novo`, `imperdível`);
- sem nomes enganosos de marcas;
- tag nova entra pendente de moderação/normalização;
- tags mescladas preservam redirect/alias;
- tags podem apoiar estilo: OSR, PbtA, rules-light, crunch, narrativo, hexcrawl, sandbox, journaling, dungeon crawl.

### Metadados obrigatórios para publicação

| Grupo | Campo | Obrigação |
|---|---|---|
| identidade | título | obrigatório |
| identidade | slug estável | obrigatório, gerado |
| identidade | resumo curto | obrigatório |
| identidade | descrição completa | obrigatório |
| visual | capa | obrigatório para descoberta; exceção moderada usa fallback |
| visual | texto alternativo | obrigatório com capa |
| origem | `external_link|managed_upload` | obrigatório |
| acesso | `free|pwyw_external` | obrigatório |
| acesso | declaração explícita de barreiras/nenhuma | obrigatório |
| destino | ao menos um destino ativo | obrigatório |
| responsabilidade | papel do cadastrante | obrigatório |
| créditos | autor/criador/organização responsável | obrigatório |
| classificação | tipo primário | obrigatório |
| classificação | ao menos um gênero/família | obrigatório |
| idioma | idioma principal ou independente | obrigatório |
| regras | sistema/edição ou agnóstico | obrigatório |
| regras | compatibilidade | obrigatório |
| formato | ao menos um formato | obrigatório |
| jurídico | categoria de licença/base | obrigatório |
| jurídico | prova D100 | obrigatório e privada |
| conteúdo | classificação etária | obrigatório |
| conteúdo | declaração de avisos/nenhum | obrigatório |
| criação | método de criação | obrigatório |
| moderação | declarações de veracidade/direitos | obrigatório |

### Metadados condicionais

| Condição | Campos exigidos |
|---|---|
| `external_link` | URL, tipo de destino, destino final observado, host, verificação |
| `managed_upload` | arquivos, versão, autorização de hosting, resultado técnico |
| `pwyw_external` | landing page externa, prova de opção zero, sinalização; nenhum valor |
| tradução/adaptação | obra-base, autor original, idioma original/destino, autorização/base |
| edição selecionada | sistema pai |
| `requires_core_rules` | requisitos necessários |
| VTT | plataforma + formato/versão compatível |
| barreira presente | tipo + instrução curta |
| `other_*` | texto/sugestão |
| licença explícita | nome/versão/URL/atribuição quando aplicável |
| produção de fã | IP/titular/política ou justificativa |
| conteúdo 18+ | avisos e tratamento específico |
| múltiplos arquivos | nome público, formato, idioma, versão/ordem |
| curador | fonte oficial, titulares/créditos e prova de divulgação |

### Metadados opcionais

- subtítulo;
- galeria/previews autorizados;
- número de páginas;
- duração estimada;
- tamanho de grupo;
- duração de sessão/campanha;
- nível de experiência;
- dados/dado principal;
- cenário/ambientação;
- requisitos físicos;
- acessibilidade do arquivo;
- versão sem imagens/alto contraste/leitor de tela;
- homepage oficial adicional;
- links alternativos;
- changelog detalhado;
- ISBN/código editorial apenas como identificador informativo futuro, sem filtro MVP;
- notas públicas moderadas;
- tags;
- materiais relacionados/obra-base.

### Campos privados

- evidência D100 e anexos;
- nota ao moderador;
- resultado detalhado de scan;
- cadeia técnica de redirects;
- provider/object key/quota;
- decisões/checklists internos;
- denúncias e identidade do denunciante;
- disputa/reivindicação;
- histórico de ownership/permissões;
- sinais antiabuso;
- dados de recurso/takedown.

Nunca promover campo privado a público por conveniência.

### Facetas públicas do MVP

Ordem recomendada da sidebar:

1. Sistema;
2. Edição;
3. Tipo de material;
4. Idioma;
5. Gênero/tema;
6. Formato;
7. Condição de acesso;
8. Barreiras de acesso;
9. Compatibilidade;
10. Plataforma/VTT;
11. Cenário/ambientação;
12. Público/modo;
13. Classificação etária;
14. Licença/base;
15. Método de criação;
16. Tags selecionadas.

Regras UX:

- exibir contagem por faceta somente sobre conjunto elegível;
- esconder valores zero por padrão, sem apagar URL compartilhável;
- filtros multivalorados precisam semântica AND/OR explícita;
- edição depende do sistema escolhido;
- filtros ativos aparecem como chips removíveis;
- “limpar tudo” sempre disponível;
- estado serializável em URL;
- mobile preserva seleção ao fechar drawer;
- rótulos não expõem slugs internos.

### Ordenação

- relevância;
- mais recentes;
- recentemente atualizados;
- mais bem avaliados, após amostra mínima;
- mais visitados, usando visitas qualificadas;
- mais favoritados;
- ordem alfabética.

Proibidos:

- mais baixados;
- mais vendidos;
- maior receita;
- preço;
- valor PWYW.

### Regras de qualidade e validação cruzada

1. material precisa ter destino e classificação completas antes de revisão;
2. `pwyw_external` exige `external_link`;
3. `managed_upload` proíbe PWYW;
4. sistema agnóstico proíbe sistema/edição;
5. edição exige sistema pai;
6. VTT exige plataforma;
7. tradução exige créditos e idioma original;
8. curador não pode ser único autor por padrão;
9. licença/base precisa combinar com direito de link ou hosting;
10. barreira declarada precisa aparecer publicamente;
11. formato precisa refletir destino/arquivo;
12. conteúdo adulto exige classificação/avisos;
13. tag não pode contradizer campo controlado;
14. “outro” sem sugestão é inválido;
15. valor inativo/mesclado resolve para canônico sem quebrar ficha;
16. alteração de sistema, licença, créditos, acesso, destino ou arquivo é sensível e volta à moderação.

### Governança taxonômica

#### Sistemas/edições

- serviço 062;
- administração distribuída por Site/Mesas/Glossário/Downloads;
- Site/sidebar é gestão principal;
- merges/redirects, nunca delete/archive sem destino.

#### Taxonomias próprias do Downloads

- administração no Downloads;
- sugestão por usuário durante submissão;
- estados `pending|approved|merged|rejected`;
- aliases e traduções;
- trilha de auditoria;
- merge exige destino canônico;
- ficha publicada nunca fica órfã;
- alteração de rótulo não muda ID;
- uso real e zero-result searches orientam evolução, não popularidade isolada.

#### Revisão periódica

- revisar duplicatas/“outro”;
- analisar termos de busca sem resultado dentro da política de privacidade;
- identificar valores sem uso;
- conferir tradução dos rótulos;
- evitar categorias discriminatórias/promocionais;
- publicar changelog taxonômico quando mudança afetar descoberta.

### Critérios de aceite da futura implementação

1. nenhuma enum central duplicada no frontend;
2. sistema/edição lidos do serviço 062;
3. IDs estáveis e aliases testados;
4. requiredness validada no backend, não só UI;
5. todas as combinações cruzadas inválidas cobertas por teste;
6. facetas produzem contagens corretas;
7. URLs de filtro são estáveis/compartilháveis;
8. valores inativos/mesclados não quebram fichas;
9. sugestões entram em moderação;
10. campos privados nunca aparecem em API pública/analytics;
11. PWYW não possui campo de valor/moeda;
12. acessibilidade da sidebar/drawer/chips passa smoke;
13. busca reconhece aliases sem criar duplicata;
14. migration/seed inicial é versionado e rollbackável;
15. catálogo DriveThruRPG de referência tem cobertura conceitual documentada, sem importar comércio.

T3.1 fecha vocabulários e requiredness conceituais.

## T3.2 — Autoria, licenças, produção de fã, traduções, IA e provas

### Escopo e princípio conservador

Esta seção define política editorial do produto, não aconselhamento jurídico individual. O Artifício não decide quem “tem razão” numa disputa complexa: exige base verificável, limita a ação ao direito demonstrado, mantém trilha de moderação e retira/suspende quando a base deixa de ser confiável.

Quatro permissões são independentes:

1. **catalogar** metadados e apontar para uma página pública;
2. **exibir** capa, preview, marca ou outra imagem;
3. **traduzir/adaptar** conteúdo;
4. **armazenar e redistribuir** arquivo pelo fluxo gerenciado.

Prova de uma não concede as demais. Link público não autoriza reupload; gratuidade não equivale a licença; crédito não substitui autorização; compra/acesso ao arquivo não transfere direitos.

### Base jurídica verificada

A Lei 9.610/1998 preserva direitos morais do autor e exige autorização prévia e expressa para atos como reprodução, edição, adaptação, tradução e distribuição, salvo hipótese legal aplicável. Registro autoral é facultativo e serve como elemento de prova, não como condição para nascer a proteção.

Consequências para o produto:

- autoria e titularidade podem pertencer a pessoas diferentes;
- o cadastrante pode ser autor, tradutor, editora ou curador, sem apropriar-se dos demais papéis;
- tradução é obra derivada e exige base que permita adaptação/tradução;
- material “encontrado na internet”, “sem aviso de copyright” ou “disponível gratuitamente” não ganha autorização presumida;
- produção de fã não constitui passe jurídico universal: depende de licença, política do titular, autorização ou análise conservadora específica.

### Classes de base e ações permitidas

| Classe | Base declarada | Catálogo/link | Capa/preview | Upload gerenciado | Tradução/adaptação |
|---|---|---:|---:|---:|---:|
| A1 | obra própria, com direitos suficientes | sim | sim, se própria/autorizada | sim | sim |
| A2 | autorização direta do titular | conforme autorização | conforme autorização | somente se expresso | somente se expresso |
| A3 | domínio público ou CC0 comprovado | sim | conforme direitos de cada elemento | sim | sim |
| A4 | licença Creative Commons | sim | conforme licença e origem | conforme licença | somente licença sem ND |
| A5 | OGL aplicável | sim | não por presunção | só conteúdo coberto e com notices | só conteúdo coberto |
| A6 | ORC aplicável | sim | não por presunção | só Licensed Material e notices | só Licensed Material |
| A7 | licença aberta/específica de sistema | conforme texto | conforme texto | conforme texto | conforme texto |
| A8 | programa comunitário fechado, como DMsGuild | sim, para página oficial | somente permitido pelo programa | **não** | somente dentro das regras do programa |
| A9 | produção de fã coberta por política oficial | sim, se cumprir política | conforme política | somente se hospedagem por terceiro for claramente permitida | conforme política |
| A10 | produção de fã sem licença/política explícita | proposta: **somente link** | fallback neutro, salvo autorização | **não** | **não** |

Todos os casos continuam sujeitos a moderação, atribuição, notices, limites de marca, conteúdo de terceiros incorporado e eventual retirada.

### Creative Commons

| Família | Redistribuição inalterada | Tradução/adaptação | Condições essenciais |
|---|---:|---:|---|
| CC0 | sim | sim | identificar corretamente a origem; verificar direitos de terceiros |
| CC BY | sim | sim | atribuição, licença, link e indicação de alterações |
| CC BY-SA | sim | sim | requisitos BY + adaptação sob licença compatível/igual |
| CC BY-NC | sim, não comercial | sim, não comercial | BY + respeitar NC |
| CC BY-NC-SA | sim, não comercial | sim, não comercial | BY + NC + SA |
| CC BY-ND | somente inalterada | **não** | tradução é adaptação |
| CC BY-NC-ND | somente inalterada e não comercial | **não** | NC + ND |

A licença cobre somente material que o licenciante podia licenciar. Fotografias, ilustrações, fontes, marcas ou excertos de terceiros podem ter bases próprias. A versão exata da licença e os créditos exigidos devem ser registrados.

### OGL, ORC, SRDs e licenças de sistema

- O D&D SRD 5.1 disponibilizado em CC BY 4.0 segue os termos e a atribuição indicada pelo próprio documento.
- OGL e ORC são bases distintas; uma não converte automaticamente conteúdo da outra.
- Na ORC, apenas `Licensed Material` é concedido; marcas, lore, arte e outros `Reserved Material` não se tornam abertos por associação.
- Notices, attribution e indicação da base acompanham o material.
- “Compatível com um sistema” não autoriza copiar texto, identidade visual, logotipo ou conteúdo protegido desse sistema.
- Cada licença/programa específico terá registro versionado com URL oficial, escopo permitido, notices exigidos e data da última revisão.

### Programas fechados e links de terceiros

DMsGuild e programas equivalentes são tratados como destinos externos fechados. O Artifício pode catalogar e redirecionar à página oficial elegível, inclusive gratuita ou PWYW externo conforme D102, mas não replica seus arquivos. A ficha deixa claro que acesso, condições e eventual transação acontecem no destino.

Política do programa prevalece sobre inferências genéricas. Exclusividade de distribuição, marcas permitidas e território do programa devem ser respeitados.

### Produção de fã

Produção de fã deve:

- ser marcada publicamente como não oficial;
- identificar o titular/universo referenciado sem sugerir endosso;
- cumprir disclaimer, gratuidade, uso de marcas e demais limites da política aplicável;
- provar a origem pública e a política/autorização vigente;
- não republicar material oficial nem substituir o original;
- não usar upload gerenciado quando a política só tolera publicação no canal do criador ou não autoriza redistribuição por terceiros.

A política da Wizards mostra que “gratuito” pode ser mais restrito que a regra comercial do Artifício: pagamentos, pesquisa, assinatura, newsletter ou cadastro podem violar aquela política. Portanto, `free`/`pwyw_external` do catálogo não basta; a submissão também precisa cumprir a política específica do titular.

Para A10, admite-se apenas curadoria por link à página pública do criador, com rótulo não oficial, prova contextual, revisão humana, auto-publicação proibida e retirada simplificada. O Artifício não hospeda arquivo, tradução, capa copiada ou preview.

### Traduções

Toda tradução informa:

- obra e idioma de origem;
- autor/titular original;
- tradutor humano responsável;
- licença, programa ou autorização que permite a tradução;
- se houve tradução automática/IA e qual foi a revisão humana;
- alterações relevantes e licença aplicável à tradução.

São aceitas traduções quando a licença permite derivados, há autorização expressa ou programa específico permite. São rejeitadas quando há cláusula ND, mera gratuidade, ausência de licença/autorização, autorização limitada a uso pessoal ou incompatibilidade com o canal de distribuição.

Provas insuficientes: crédito isolado; silêncio do autor; captura sem URL/contexto; licença de outra obra/versão; mensagem sem identidade verificável; página que só permite leitura/download; declaração de que “é de fã”.

### Capas, previews e marcas

Direito sobre texto/arquivo não prova direito sobre capa. Cada mídia deve ser:

- própria;
- incluída expressamente na licença/autorização; ou
- fornecida pelo destino/titular com permissão clara de divulgação.

Curadoria de terceiro usa imagem neutra/fallback quando não houver prova. Logotipo e marca não são tratados como conteúdo aberto por estarem ao lado de um SRD/OGL/ORC. T3.5 detalhará dimensões, transformação, moderação visual e armazenamento Cloudinary sem afrouxar estas regras.

### IA — política recomendada

O método de criação é obrigatório e público:

- `human_created`: aceito;
- `ai_assisted`: aceito com declaração da ferramenta, partes afetadas e revisão/autoria humana substancial;
- texto final gerado por IA: rejeitado;
- produto de prompts: rejeitado;
- pacote autônomo de arte, mapa, token ou asset VTT gerado por IA: rejeitado;
- imagem gerada por IA em capa/interior de obra humana substancial: aceita condicionada a declaração, termos da ferramenta, ausência de imitação enganosa de artista/marca e moderação.

IA não pode ser creditada como autora ou titular, não fornece autorização e não prova origem. O publicador responde pelos dados de entrada, saídas, direitos de terceiros e transparência. “Revisado por humano” não transforma automaticamente geração integral em autoria humana substancial.

A política final acompanha o padrão intermediário conservador: proibir texto gerado e pacotes autônomos, mas permitir imagem integrada a obra humana sob declaração e moderação.

### Prova D100

#### Tipos admissíveis

- URL oficial da licença, política, página do titular ou página de distribuição;
- licença/notices incorporados ao arquivo;
- autorização escrita identificável, com partes, obra, ações e canal permitidos;
- captura contextual com URL, data, identidade e texto legíveis;
- documento de titularidade/representação quando necessário;
- registro autoral como evidência complementar;
- cadeia de atribuição e fontes de componentes incorporados.

Declaração do cadastrante é obrigatória, mas nunca prova suficiente sozinha.

#### Força da evidência

| Nível | Definição | Uso |
|---|---|---|
| E3 forte | fonte oficial pública ou autorização diretamente verificável e específica | upload, tradução e casos sensíveis |
| E2 suficiente | conjunto coerente de fonte pública, autoria/origem e termos aplicáveis | link comum e licenças padronizadas |
| E1 fraca | captura parcial, alegação indireta ou contexto incompleto | pedir complementação; não publicar |
| E0 inválida | declaração isolada, silêncio, gratuidade, acesso ou crédito | rejeitar |

#### Proporcionalidade por ação

- catálogo para página oficial: prova de que a página/material existe, é elegível e foi descrito corretamente;
- link direto: prova de autorização/forma oficial de distribuição;
- capa/preview: prova específica da mídia;
- tradução: prova de derivados/tradução;
- upload: prova de armazenamento e redistribuição por terceiro, não apenas download;
- curador: prova aponta ao titular/origem; curador não declara propriedade;
- autor/editora: identidade e cadeia de direitos devem ser coerentes com os créditos.

### Registro, privacidade e revalidação

A ficha pública mostra categoria da base, licença/programa, autoria, créditos, notices, rótulo de fã e declaração de IA. Autorizações privadas, contatos, documentos e capturas sensíveis ficam restritos à moderação.

O registro preserva fonte, URL, hash quando houver arquivo, data de coleta, versão da política/licença, responsável pela decisão, justificativa e histórico. Mudança de URL, arquivo, licença, titular, capa, tradução ou distribuição reabre revisão. Políticas externas devem ser reverificadas periodicamente e por denúncia. Retenção e controles técnicos ficam para T5.6.

### Fluxo editorial

1. identificar papel do cadastrante e titulares/créditos;
2. classificar A1–A10;
3. separar ações pedidas: link, mídia, tradução e upload;
4. exigir prova proporcional para cada ação;
5. verificar licença/política oficial, versão, notices e componentes de terceiros;
6. verificar gratuidade/PWYW e barreiras sem confundir acesso com permissão;
7. verificar declaração de IA;
8. aprovar somente ações demonstradas; reduzir para link/fallback quando cabível;
9. registrar decisão e próxima revisão;
10. encaminhar disputa, ambiguidade material ou conflito de titularidade para suspensão/rejeição, nunca improvisação jurídica.

Auto-publicação futura não dispensa estes gates. Categorias A8–A10, tradução, upload de terceiro e material com IA permanecem elegíveis a revisão humana obrigatória mesmo se o usuário ganhar outra capacidade editorial.

### Critérios de aceite para specs executáveis

1. direitos de catálogo, mídia, tradução e upload são avaliados separadamente;
2. gratuidade e declaração isolada nunca bastam;
3. cada material tem papéis de crédito e base versionada;
4. CC ND bloqueia tradução; SA/NC são preservadas;
5. OGL/ORC/SRD não abrem automaticamente arte, lore ou marcas;
6. programas fechados são link-only quando não autorizam redistribuição externa;
7. produção de fã mostra rótulo e política/disclaimer;
8. upload de terceiro exige autorização expressa de redistribuição;
9. capa/preview tem prova própria ou fallback;
10. tradução registra origem, tradutor, base e IA;
11. IA é declarada e nunca serve como autora/prova;
12. evidência recebe nível E0–E3 e decisão auditável;
13. alteração sensível reabre moderação;
14. prova privada tem acesso/retention definidos em T5.6;
15. denúncia e retirada podem suspender sem apagar a trilha.

### Fontes primárias consultadas

- Lei 9.610/1998, Presidência da República: <https://www.planalto.gov.br/ccivil_03/leis/l9610.htm>
- Direitos autorais, Biblioteca Nacional: <https://www.gov.br/bn/pt-br/atuacao/direitos-autorais-1/direitos-autorais>
- FAQ histórica da Biblioteca Nacional sobre tradução/adaptação: <https://antigo.bn.gov.br/node/256>
- Creative Commons, tipos de licença: <https://creativecommons.org/share-your-work/use-remix/cc-licenses/>
- Creative Commons FAQ: <https://creativecommons.org/faq/>
- D&D SRD 5.1 CC BY 4.0: <https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0_License_live%20links.pdf>
- Paizo ORC License e FAQ/licenças: <https://paizo.com/orclicense> e <https://paizo.com/licenses>
- Wizards Fan Content Policy: <https://company.wizards.com/en/legal/fancontentpolicy>
- Paizo Community Use Policy: <https://paizo.com/community/communityuse>
- DMsGuild Licensing Information e Content Guidelines: <https://help.dmsguild.com/hc/en-us/articles/12776887523479-Dungeon-Masters-Guild-Licensing-Information> e <https://help.dmsguild.com/hc/en-us/articles/12776909822615-Dungeons-Dragons-Content-Guidelines>
- DMsGuild/DriveThru, política de conteúdo generativo: <https://help.dmsguild.com/hc/en-us/articles/23505289491223-Advice-Best-Practices-for-New-Creators>
- U.S. Copyright Office, relatório 2025 sobre copyrightability de outputs generativos, usado apenas como referência estrangeira: <https://www.copyright.gov/newsnet/2025/1060.html>

### Decisões finais

1. A10: produção de fã sem política/licença explícita entra somente como link para a página pública do criador, nunca upload;
2. IA: imagem generativa somente integrada a obra humana substancial, declarada e moderada; texto final gerado e pacotes autônomos são proibidos.

T3.2 está concluída. Estas regras orientam T3.3–T3.5 e futuras specs executáveis.

## T3.3 — Estados editoriais, moderação e auto-publicação desativada

### Resultado da investigação interna

`apps/mesas` oferece o baseline mais maduro:

- rascunho/importação e publicação são etapas distintas;
- conteúdo importado nasce `draft`, nunca publicado;
- somente estado apto pode avançar;
- primeira publicação registra marco próprio;
- administração enxerga itens invisíveis ao público;
- automação tem modo, kill switch, gates nominais, shadow, confiança e bloqueio explícito;
- a configuração atual mantém `autonomyGateEnabled=false` e `autoApprovalEnabled=false`.

O Glossário acrescenta fila `pendente → verificado|rejeitado`, identidade/data do revisor e notificação ao autor. Downloads precisa ir além: revisão de versões, pedido de correção, suspensão, conflito, prova jurídica e preservação da versão pública anterior.

### Três eixos independentes

Uma única coluna `status` seria ambígua. O modelo futuro separará:

1. **estado editorial da versão** — maturidade e decisão da submissão;
2. **estado público do material** — se a ficha publicada está visível/indexável;
3. **saúde do destino/arquivo** — resultado técnico do checker, scan e storage.

Exemplos:

- versão publicada continua pública enquanto uma edição está `under_review`;
- ficha pode estar `suspended` embora a última versão editorial tenha sido aprovada;
- link `temporarily_unavailable` não transforma prova jurídica em rejeitada;
- arquivo em quarentena nunca fica disponível, mesmo com metadados aprovados.

### Unidade moderada e versionamento

O material é a identidade durável. Cada envio cria uma **versão editorial imutável** contendo snapshot dos campos, destinos, mídias, arquivos, provas, declarações e termos aceitos.

- criar rascunho não altera versão pública;
- enviar edição de material publicado cria nova versão candidata;
- aprovação promove atomicamente a candidata a versão pública;
- rejeição/pedido de ajuste preserva a versão pública anterior;
- histórico nunca é sobrescrito;
- moderador vê diff entre versão pública, candidata e alterações anteriores;
- correção do moderador no ato exige registro explícito do diff e autoria da mudança;
- alteração jurídica, destino, arquivo, capa, créditos, condição de acesso ou IA é sempre sensível;
- edição puramente administrativa também permanece auditada.

### Estados editoriais da versão

| Estado | Significado | Público? | Quem move |
|---|---|---:|---|
| `draft` | edição privada incompleta | não | autor/editor |
| `submitted` | enviada e congelada para triagem | não | autor/editor |
| `under_review` | assumida por moderador | não | moderador/sistema de fila |
| `changes_requested` | faltam correções ou provas | não | moderador |
| `resubmitted` | correções reenviadas | não | autor/editor |
| `approved` | decisão humana concluída | ainda não isoladamente | moderador |
| `published` | versão promovida e pública | sim, se ficha visível | transição editorial |
| `rejected` | inelegível nesta versão | não | moderador |
| `withdrawn` | retirada antes da decisão | não | autor/editor |
| `superseded` | versão substituída por outra publicada | histórico | sistema |

`approved` é estado transitório/auditável: publicação só ocorre após todos os gates técnicos e editoriais passarem. No MVP, aprovação humana pode promover imediatamente quando gates verdes; ainda assim são eventos distintos.

### Estado público do material

| Estado | Comportamento |
|---|---|
| `unpublished` | nunca teve versão pública |
| `listed` | ficha pública e presente em busca/facetas/sitemap |
| `unlisted` | acessível por URL, ausente de descoberta e sitemap |
| `temporarily_hidden` | ocultação operacional reversível |
| `suspended` | indisponível por segurança, direitos, fraude ou investigação |
| `withdrawn` | responsável retirou a publicação |

Rejeição pertence à versão, não apaga o material. Suspensão/retirada e seus recursos serão aprofundados em T3.4. Nenhum estado exclui fisicamente histórico, provas ou auditoria.

### Saúde técnica

Estados técnicos são sinais, não decisões editoriais:

- destino: `unchecked|healthy|degraded|unavailable|unsafe`;
- arquivo: `none|pending_upload|quarantined|scanning|available|blocked|storage_error`;
- prova: `pending|valid|needs_revalidation|invalid|disputed`.

Regras:

- `unsafe`, arquivo `blocked` ou prova `invalid|disputed` bloqueiam publicação;
- falha transitória gera reteste antes de suspensão automática;
- checker nunca aprova licença/autoria;
- storage nunca publica arquivo antes de scan e aprovação editorial;
- estado técnico e motivo ficam visíveis ao moderador; público recebe mensagem não sensível.

### Máquina de transições

Fluxo normal:

`draft → submitted → under_review → approved → published`

Correção:

`under_review → changes_requested → resubmitted → under_review`

Encerramentos:

- `draft|changes_requested → withdrawn`;
- `submitted|under_review|resubmitted → rejected`;
- `published → superseded` quando nova versão é promovida;
- versão rejeitada nunca volta diretamente: correção gera nova versão candidata;
- versão retirada pode ser duplicada para novo rascunho, preservando histórico.

Transições proibidas:

- rascunho direto para publicado;
- autor aprovar o próprio envio;
- automação contornar prova, scan ou moderação;
- editar versão congelada `submitted|under_review`;
- publicar versão baseada em prova E0/E1;
- apagar decisão anterior para “tentar novamente”.

### Cadastro inicial e edições

- Todo cadastro inicial entra em moderação.
- Toda edição de conteúdo publicado cria revisão.
- Enquanto a edição aguarda, a última versão aprovada permanece pública.
- Exceção: risco jurídico, segurança, malware, fraude, conteúdo proibido ou destino enganoso permite ocultação/suspensão imediata.
- Mudanças críticas recebem comparação destacada.
- Mudanças de baixo risco podem ter fila mais rápida, mas não auto-publicam no lançamento.
- Autor pode cancelar candidato sem afetar versão pública.
- Moderador não deve reescrever substancialmente obra/ficha em nome do usuário; pede ajuste quando a mudança altera sentido ou responsabilidade.

### Papéis e capacidades

| Papel/capacidade | Criar/editar rascunho | Enviar | Moderar | Publicar | Suspender |
|---|---:|---:|---:|---:|---:|
| usuário autenticado | próprios/colaborações | sim | não | não | não |
| colaborador/editor autorizado | material delegado | sim | não | não | não |
| moderador | não por papel | não por papel | sim | via aprovação | solicitar/aplicar conforme permissão |
| administrador | sim | sim | sim | sim | sim |
| `trusted_publisher` futuro | sim | sim | não | somente se gates futuros ativos | não |

Autor, tradutor, editora e curador são **papéis de relação/crédito**, não permissões administrativas. Perfil público não concede controle. Colaboração e reivindicação exigem vínculo explícito.

Controles mínimos:

- separação entre usuário comum, moderador e administrador;
- moderador não aprova submissão própria nem de organização em que atua;
- conflito de interesse força reatribuição;
- concessão/revogação de capacidade é auditada;
- ações em lote exigem confirmação e motivo;
- sessão/role é validada no backend em cada ação.

### Fila de moderação

Cada item mostra:

- material, versão, autor do envio e papel declarado;
- inicial ou edição; diff e campos sensíveis;
- A1–A10, licença/programa, prova E0–E3 e validade;
- link/upload/PWYW, barreiras e resultados técnicos;
- capa/previews e estado de scan;
- declaração de IA;
- denúncias/conflitos prévios;
- idade da fila, prioridade e responsável;
- notas públicas ao publicador e notas privadas;
- histórico completo de decisões.

Filtros: estado, idade, prioridade, tipo de mudança, risco, papel, licença, A1–A10, link/upload, PWYW, IA, prova, checker, scan, moderador e reenvio.

Priorização:

1. segurança/malware, denúncia jurídica e risco ativo;
2. suspensão/recurso e material público afetado;
3. reenvio após correção;
4. edição de material publicado;
5. cadastro inicial;
6. baixa criticidade/administrativo.

Ordem temporal vale dentro da mesma prioridade. SLA será definido operacionalmente depois de medir volume; a spec não inventa prazo sem baseline.

### Decisões do moderador

| Decisão | Exigência |
|---|---|
| aprovar | checklist completo, gates verdes, justificativa breve |
| pedir alterações | campos/provas faltantes, instrução acionável e prazo futuro configurável |
| rejeitar | motivo controlado + explicação; sem apagar |
| reduzir escopo | ex.: retirar capa/upload e aprovar somente link, com concordância/reenvio quando muda responsabilidade |
| encaminhar | conflito jurídico, fraude, segurança ou decisão administrativa |
| suspender | motivo grave, trilha e revisão posterior |

Motivos controlados incluem: fora do escopo; não gratuito/elegível; prova insuficiente; licença incompatível; upload não autorizado; tradução não autorizada; autoria/créditos inconsistentes; IA proibida/não declarada; duplicado; metadados enganosos; destino inseguro; arquivo malicioso; conteúdo proibido; precisa de especialista.

Rejeitar não pune automaticamente o usuário. Fraude/reincidência é processo separado, com evidência e proporcionalidade.

### Auditoria e comunicação

Todo evento registra:

- ator e papel efetivo;
- origem humana/sistema;
- timestamp;
- estado anterior/novo;
- versão e diff;
- motivo controlado e nota;
- provas/checks considerados;
- correção feita pelo moderador;
- concessão usada, inclusive futura auto-publicação;
- correlação com denúncia, checker ou job.

O publicador recebe notificações de envio, assunção opcional, pedido de ajustes, aprovação/publicação, rejeição, suspensão, expiração futura de pendência e revalidação. Notificação não expõe nota privada, dados de denunciante ou documento sensível.

### Auto-publicação: estrutura futura, execução impossível no lançamento

A capacidade futura será denominada `downloads.content.auto_publish`. Ela nasce:

- conhecida pelo modelo de autorização;
- não atribuída a ninguém;
- desligada por configuração global;
- bloqueada por kill switch;
- sem endpoint/UI capaz de ligá-la no MVP;
- sem fallback que interprete admin, autor ou editora como autoaprovado;
- observável em modo `shadow`, sem mudar estado público;
- revogável instantaneamente.

Mesmo futuramente, publicação automática exigirá simultaneamente:

1. feature gate global aprovado nominalmente;
2. kill switch desligado;
3. capacidade individual ativa e não expirada;
4. usuário/organização sem restrição;
5. tipo de ação elegível;
6. prova E2/E3 válida;
7. checker/scan/storage verdes;
8. ausência de denúncia, disputa ou conflito;
9. shadow validado com amostra e métricas;
10. trilha completa e rollback.

Continuam sempre fora da auto-publicação:

- A8–A10;
- curadoria de terceiro com upload;
- tradução;
- PWYW externo;
- mudança de licença, autoria/titularidade ou destino;
- upload novo/substituído;
- conteúdo com IA;
- material adulto/sensível;
- reenvio após rejeição/suspensão;
- qualquer prova em revalidação/disputa.

“Auto-publicação” não significa aprovação por IA. IA pode auxiliar triagem no futuro, mas não concede direito, não decide conflito e não substitui gates.

### Ativação futura em fases

1. **off:** configuração e capacidade inertes;
2. **suggest:** sistema recomenda prioridade/checklist, humano decide;
3. **shadow:** calcula decisão hipotética e mede divergência, sem publicar;
4. **piloto restrito:** somente após nova spec, aprovação nominal e critérios mensuráveis;
5. **expansão/revogação:** por classe de risco, sempre com kill switch.

Ativação exigirá spec própria com thresholds, amostra mínima, taxa de erro, falsos positivos, incidentes, rollback, beta antes de prod e aprovação explícita. T3.3 não autoriza ativação.

### Concorrência e falhas

- assunção de item tem lock/lease para evitar dois moderadores decidirem simultaneamente;
- decisão usa controle de versão otimista;
- job idempotente impede publicação duplicada;
- falha entre aprovação e publicação fica recuperável, nunca parcialmente pública;
- indisponibilidade de checker/storage mantém pendente, não “fail open”;
- notificação falha não desfaz decisão, mas gera retry observável;
- publicação promove ficha, destinos e arquivos de forma atômica;
- rollback restaura última versão pública segura.

### Métricas operacionais privadas

- tamanho e idade da fila;
- tempo por estado e classe de risco;
- taxa de aprovação, ajustes, rejeição e reenvio;
- divergência entre moderadores;
- reversão/suspensão após aprovação;
- causa de bloqueio técnico;
- reincidência por motivo, sem ranking público punitivo;
- no shadow futuro: decisão hipotética versus humana.

Métricas não viram meta cega de velocidade. Qualidade jurídica, segurança e consistência prevalecem.

### Critérios de aceite para specs executáveis

1. versão editorial, estado público e saúde técnica são separados;
2. cadastro e edição publicada exigem moderação;
3. versão pública anterior permanece durante revisão comum;
4. risco grave permite suspensão imediata auditada;
5. transições permitidas/proibidas são validadas no backend;
6. autor não aprova envio próprio;
7. fila apresenta diff, provas, checks, risco e histórico;
8. decisões exigem motivo e ator;
9. rejeição/pedido de ajuste não apagam versões;
10. publicação é atômica e idempotente;
11. notas privadas não vazam;
12. notificações cobrem eventos editoriais;
13. capacidade `downloads.content.auto_publish` existe conceitualmente, sem atribuição;
14. gate global e kill switch mantêm auto-publicação impossível no MVP;
15. shadow não altera estado público;
16. classes de alto risco permanecem humanas;
17. ativação futura exige spec e aprovação nominal;
18. falhas técnicas são fail-closed;
19. auditoria permite reconstruir qualquer decisão;
20. beta e produção possuem configuração independente, ambas desligadas inicialmente.

T3.3 está concluída. T3.4 aprofundará denúncia, retirada, recurso, abandono e links quebrados.

## T3.4 — Denúncias, remoção, recurso, abandono e links quebrados

### Princípios

- denúncia é sinal para triagem, não prova automática;
- risco imediato pode exigir contenção antes do contraditório;
- medida deve ser proporcional e tecnicamente limitada ao conteúdo/destino apontado;
- suspensão e remoção lógica prevalecem sobre exclusão física;
- denunciante, publicador, moderador e sistema recebem proteção de dados e trilha auditável;
- decisão jurídica ambígua nunca é delegada a IA/checker;
- ordem de autoridade competente é tratada prioritariamente e dentro de seus limites;
- restauração é tão auditável quanto retirada.

Esta é política de produto, não parecer jurídico. Casos complexos devem admitir encaminhamento a assessoria/autoridade competente.

### Base oficial verificada

O Marco Civil da Internet exige identificação específica do conteúdo em ordens de indisponibilização e preserva princípios de liberdade de expressão, privacidade e responsabilidade. Em 2025, o STF declarou o art. 19 parcialmente inconstitucional e definiu regimes em que ciência inequívoca de ilícito, inclusive por notificação idônea, pode gerar dever de ação; portanto o Artifício não adotará regra simplista de “somente com ordem judicial”.

A Lei 9.610/1998 continua sendo a base para reprodução/distribuição/autorização autoral. A LGPD exige finalidade, necessidade, segurança e direitos de acesso/correção/bloqueio/eliminação, ressalvadas bases legítimas de conservação. Dados de denúncias e provas serão mínimos, privados e retidos por política específica T5.6.

### Canais

Cada ficha pública oferece `Denunciar`. Haverá também:

- canal geral para conteúdo não acessível/ficha já oculta;
- canal jurídico para titular, representante ou autoridade;
- canal de privacidade/LGPD;
- canal de segurança para malware, phishing ou exposição grave;
- botão `Link quebrado`, mais simples que denúncia jurídica;
- sinal automático do checker.

Denúncia comum pode ser enviada por visitante. Login é recomendado e obrigatório para acompanhar pelo painel. Denúncia anônima é aceita, mas precisa de elementos verificáveis; não recebe acesso a detalhes do caso. Alegação de titularidade, representação, privacidade individual ou recurso exige identificação suficiente.

### Categorias

| Família | Exemplos | Prioridade inicial |
|---|---|---:|
| segurança crítica | malware, phishing, roubo de credenciais, arquivo adulterado | P0 |
| ordem/autoridade | ordem judicial/administrativa válida, requerimento oficial | P0 |
| risco pessoal | dados íntimos, ameaça, exploração, conteúdo sexual envolvendo menor | P0 |
| direitos | copyright, marca, licença, tradução/reupload não autorizado | P1 |
| fraude/engano | falsa autoria, destino trocado, PWYW sem opção zero, impersonação | P1 |
| conteúdo | impróprio, discriminatório, ilegal, classificação ausente | P1/P2 |
| técnico | 404/410, timeout, certificado, arquivo corrompido | P2 |
| qualidade/metadata | duplicado, sistema/edição/crédito incorreto | P3 |
| abuso da plataforma | spam, denúncia coordenada, assédio ao publicador | P1/P2 |

P0–P3 são prioridade, não veredito.

### Dados mínimos da denúncia

- material/versão/destino/arquivo exatos;
- categoria e descrição objetiva;
- URL ou trecho específico;
- evidência/anexos quando aplicável;
- data da constatação;
- identificação/contato quando necessária;
- para direito autoral: obra, titular, legitimidade do requerente, direito alegado e ação pedida;
- declaração de boa-fé e exatidão;
- consentimento informado sobre eventual compartilhamento limitado da manifestação;
- relação com denúncia anterior, se houver.

O formulário não pede documento de identidade por padrão. Só coleta prova adicional quando proporcional. Dados do denunciante não são publicados nem entregues integralmente ao denunciado.

### Estados do caso

| Estado | Significado |
|---|---|
| `received` | protocolo criado |
| `triaged` | categoria, prioridade e duplicidade verificadas |
| `investigating` | moderador analisa material, histórico e provas |
| `awaiting_reporter` | faltam elementos do denunciante |
| `awaiting_publisher` | publicador foi notificado para manifestação/correção |
| `contained` | medida cautelar aplicada |
| `actioned` | decisão de mérito aplicada |
| `dismissed` | improcedente, insuficiente ou fora do canal |
| `appealed` | decisão contestada |
| `closed` | processo encerrado, sem apagar histórico |

Casos duplicados são vinculados a um caso principal, não contam como votos independentes.

### Triagem e contenção

1. validar alvo, categoria, evidência mínima e abuso;
2. agrupar duplicatas;
3. capturar snapshot privado do estado relevante;
4. verificar histórico, D100, checker, scan, licença e versão;
5. classificar risco e reversibilidade;
6. aplicar contenção imediata apenas quando necessária;
7. notificar as partes quando isso não ampliar risco;
8. investigar e decidir;
9. permitir recurso quando cabível;
10. revalidar/restaurar ou encerrar.

Medidas cautelares:

- desabilitar somente um link/arquivo;
- substituir mídia por fallback;
- ocultar ficha da busca;
- tornar ficha indisponível;
- bloquear download gerenciado;
- preservar evidência e impedir novas versões;
- restringir temporariamente capacidade do publicador.

Malware/phishing, exploração de menor, vazamento íntimo, ordem válida e risco grave recebem contenção imediata. Copyright/marca/licença com documentação plausível pode receber suspensão cautelar do arquivo/reupload; catálogo por link pode permanecer se não for o objeto da alegação. Metadata discutível normalmente permanece até análise.

### Decisões de mérito

| Resultado | Efeito |
|---|---|
| `no_action` | denúncia arquivada com motivo |
| `corrected` | metadata/destino corrigido por nova versão ou ação limitada |
| `link_disabled` | destino específico indisponível |
| `asset_removed` | capa/preview específico removido |
| `file_blocked` | arquivo gerenciado bloqueado, preservado privadamente conforme retenção |
| `unlisted` | ficha acessível apenas por URL |
| `suspended` | ficha indisponível durante condição/disputa |
| `withdrawn` | retirada solicitada pelo responsável |
| `restored` | medida revertida após prova/recurso |
| `account_restricted` | capacidade limitada por abuso comprovado |
| `referred` | encaminhado a autoridade/assessoria competente |

Não existe “delete para resolver”. Exclusão física segue retenção, obrigação legal, LGPD, backup e integridade de auditoria.

### Notificação e contraditório

Quando seguro e permitido, o publicador recebe:

- material/versão afetados;
- categoria e substância da alegação;
- medida cautelar;
- evidências compartilháveis, com dados protegidos;
- ação solicitada e canal de resposta;
- prazo configurável conforme risco;
- efeitos da inércia;
- forma de recurso.

O denunciante recebe protocolo e resultado em nível compatível com privacidade/segurança. Não recebe documentos privados do publicador, detalhes de conta, método antifraude ou justificativa jurídica interna.

Não há contraditório prévio quando ele puder prolongar dano grave, destruir evidência, expor vítima/denunciante ou contrariar ordem. Nesses casos, manifestação ocorre após contenção.

### Recurso/contestação

Podem recorrer publicador afetado, titular/representante cuja denúncia foi negada e usuário cuja capacidade foi restringida.

Recurso exige:

- decisão identificada;
- ponto contestado;
- fatos/provas novos ou erro demonstrável;
- declaração de boa-fé;
- identidade/legitimidade suficientes.

Regras:

- revisor do recurso deve ser diferente do decisor inicial sempre que possível;
- recurso não restaura automaticamente conteúdo;
- decisão considera estado atual, não apenas snapshot antigo;
- nova evidência pode reduzir, manter ou ampliar medida;
- restauração reexecuta checker/scan/provas;
- repetição sem fato novo pode ser encerrada como duplicata;
- ordem/decisão externa superveniente prevalece dentro de seus limites;
- resultado e fundamento são comunicados e auditados.

O produto usa “recurso/contestação”, não copia automaticamente o procedimento DMCA dos Estados Unidos. Política brasileira e eventual licença/programa específico governam o caso.

### Abuso e denúncias maliciosas

- rate limit, CAPTCHA/antibot proporcional e deduplicação;
- análise de padrão sem publicar score;
- volume não determina verdade;
- denúncia de boa-fé improcedente não gera punição;
- fraude documental, assédio, impersonação e reincidência deliberada podem restringir canal/conta;
- denunciante não pode usar o sistema para obter dados pessoais;
- moderador não revela sinais antifraude;
- ação de conta exige evidência, motivo e recurso.

### Retirada voluntária

Responsável autorizado pode retirar a ficha ou arquivo sem provar ilícito. Efeitos:

- interrompe acesso público;
- não apaga créditos, decisões, comentários, métricas ou provas imediatamente;
- informa motivo público neutro quando necessário;
- preserva possibilidade de restauração por versão nova;
- não permite ao curador retirar obra do autor fora do Artifício: apenas o cadastro que controla;
- organização com múltiplos gestores segue suas permissões;
- disputa de controle suspende mudanças sensíveis até resolução.

### Abandono

Inatividade de conta não torna material órfão, não transfere autoria e não autoriza reupload.

Considera-se possível abandono operacional quando há combinação de:

- contato reiteradamente impossível;
- ficha sem gestor ativo;
- destino indisponível/degradado persistentemente;
- prova/licença exigindo revalidação sem resposta;
- organização encerrada ou conta excluída;
- pedido de correção vencido após tentativas documentadas.

Fluxo:

1. detectar e marcar `owner_unreachable`;
2. tentar canais existentes sem coletar dados novos indevidos;
3. manter versão segura enquanto destino/prova forem válidos;
4. impedir edições sensíveis sem responsável;
5. permitir reivindicação verificada;
6. converter para curadoria por link quando houver origem oficial válida;
7. suspender se não houver destino/prova segura;
8. nunca transferir direitos autorais pelo fluxo administrativo.

Reivindicação pode conceder gestão do cadastro, não autoria/titularidade. Exige identidade, relação com autor/editora/obra e prova proporcional. Representante, sucessor ou nova editora não herda automaticamente direitos de distribuição; deve demonstrá-los.

Conta excluída:

- conteúdo próprio pode ser retirado conforme pedido e bases aplicáveis;
- cadastro de curadoria pode permanecer sob gestão administrativa se ficha/destino forem lícitos;
- dados pessoais são minimizados/anonimizados quando possível;
- registros necessários a direito, fraude, segurança e auditoria seguem retenção T5.6.

### Links quebrados e destinos degradados

O checker testa disponibilidade e segurança; não confirma download concluído nem licença.

Sinais:

- HTTP, redirects e destino final;
- TLS/certificado;
- mudança de domínio/host;
- MIME quando link direto;
- páginas de erro disfarçadas;
- login/newsletter/CAPTCHA/barreira;
- opção zero em PWYW;
- malware/phishing/reputação;
- tamanho/hash quando aplicável e permitido;
- alteração relevante da página.

Estado e reação:

| Situação | Reação |
|---|---|
| falha única/transitória | `degraded`, reteste; continua público |
| falhas repetidas em janelas separadas | `unavailable`, avisar responsável e reduzir destaque |
| 404/410 persistente | ocultar CTA; manter ficha temporariamente para correção |
| domínio expirado/redirect inesperado | bloquear redirecionamento até revisão |
| phishing/malware | bloquear imediatamente e abrir P0 |
| PWYW perdeu opção zero | suspender elegibilidade/publicação |
| passou a exigir login/newsletter | atualizar flag via revisão; não ocultar se ainda elegível |
| novo destino oficial seguro | trocar por versão revisada; emergência pode desabilitar antigo antes |
| arquivo gerenciado indisponível | failover/reconciliação T5/T6; nunca redirecionar a origem incerta |

Nenhuma falha isolada comum causa remoção definitiva. Thresholds, intervalos e orçamento serão calibrados na spec operacional T6.3 com beta/telemetria. Princípio: múltiplas observações separadas antes de ocultação automática, salvo segurança, 410 inequívoco ou mudança hostil.

Página arquivada/cache histórico pode ajudar na investigação, mas não vira automaticamente destino de download nem prova de autorização atual.

### Recuperação e substituição de link

- responsável recebe ação para corrigir;
- usuário pode sugerir novo destino oficial;
- sugestão não substitui automaticamente;
- moderador verifica domínio, gratuidade, barreiras, licença e relação com o material;
- troca preserva histórico e URL pública da ficha;
- hash/arquivo/capa não são copiados do novo destino sem direito;
- múltiplos destinos válidos podem coexistir se representarem formatos/idiomas legítimos;
- destino antigo comprometido fica em denylist interna para evitar regressão.

### Automação

Pode automatizar:

- protocolo, deduplicação e agrupamento;
- checks técnicos;
- contenção de indicador técnico crítico confirmado;
- notificações/retestes;
- prioridade sugerida;
- aplicação de ordem já validada por humano ao alvo exato.

Não pode automatizar:

- veredito de autoria/licença;
- credibilidade final das partes;
- sanção de conta por denúncia isolada;
- recurso;
- transferência de gestão;
- restauração jurídica;
- exclusão física de evidência.

Toda automação é fail-closed, auditada e possui kill switch.

### Retenção e privacidade

T5.6 definirá prazos exatos. Requisitos:

- separar dados públicos, manifestação compartilhável e notas/provas privadas;
- acesso por necessidade e papel;
- criptografia/segurança proporcionais;
- downloads de prova auditados;
- redaction antes de compartilhar;
- não enviar documentos sensíveis em notificações;
- política para backup e deleção;
- atender direitos LGPD sem destruir prova legitimamente necessária;
- registrar base/finalidade de conservação;
- anonimizar métricas e casos encerrados quando possível.

### Métricas privadas

- casos por categoria/prioridade/estado;
- tempo até contenção e decisão;
- taxa de procedência, correção, recurso e reversão;
- links degradados/recuperados;
- falsos positivos do checker;
- reincidência de destinos/contas;
- idade de casos aguardando parte;
- divergência entre decisão inicial e recurso;
- incidentes após restauração.

Não publicar ranking de denunciados/denunciantes.

### Critérios de aceite para specs executáveis

1. canais cobrem denúncia comum, jurídica, privacidade, segurança e link quebrado;
2. alvo exato e evidência mínima são exigidos;
3. denúncia não remove automaticamente conteúdo comum;
4. P0 permite contenção imediata proporcional;
5. casos têm estados, prioridade, responsável e auditoria;
6. duplicatas são agrupadas;
7. medida pode atingir apenas link/arquivo/mídia afetados;
8. publicador recebe contraditório quando seguro;
9. dados do denunciante e notas privadas são protegidos;
10. decisão usa motivos controlados;
11. recurso tem revisão independente quando possível;
12. restauração revalida gates;
13. remoção lógica preserva histórico;
14. retirada voluntária não apaga auditoria;
15. abandono não transfere autoria/direitos;
16. reivindicação separa gestão de titularidade;
17. checker distingue falha transitória, persistente e hostil;
18. redirect/domínio hostil bloqueia CTA;
19. PWYW sem opção zero suspende elegibilidade;
20. página arquivada não vira download automaticamente;
21. automação não decide direito/recurso;
22. thresholds técnicos serão medidos em beta;
23. retenção/LGPD são fechadas em T5.6;
24. beta e prod têm filas/configuração/kill switch separados;
25. ordem de autoridade recebe tratamento prioritário, específico e auditado.

### Fontes oficiais consultadas

- Marco Civil da Internet, Lei 12.965/2014: <https://planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm>
- STF, Tema 987, acórdão publicado em 05/11/2025: <https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=987>
- STF, parâmetros de responsabilização de plataformas: <https://noticias.stf.jus.br/postsnoticias/stf-define-parametros-para-responsabilizacao-de-plataformas-por-conteudos-de-terceiros/>
- Lei de Direitos Autorais, Lei 9.610/1998: <https://www.planalto.gov.br/ccivil_03/leis/l9610.htm>
- LGPD, Lei 13.709/2018 compilada: <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm>
- ANPD, denúncia e petição de titular: <https://www.gov.br/anpd/pt-br/canais_atendimento/cidadao-titular-de-dados/denuncia-peticao-de-titular>

T3.4 está concluída. T3.5 definirá política de capas/imagens e direitos de uso.

## T3.5 — Capas, imagens e direitos de uso

### Decisão central

O Artifício pode armazenar e exibir **reprodução reduzida da capa** para finalidade editorial, informativa e de identificação do material, como capa usada em manchete, resenha, notícia ou catálogo. Essa permissão de produto não se estende à imagem em resolução original, arquivo-fonte, arte interna, galeria, mapa, token, logotipo ou pacote visual.

A capa:

- é acessória à ficha e à descoberta;
- não é oferecida como download;
- não substitui o exemplar/material;
- mantém proporção e integridade;
- aponta ao material/origem;
- recebe crédito/fonte quando conhecidos;
- usa somente resolução necessária à interface;
- pode ser removida sem retirar a ficha;
- nunca prova direito sobre o PDF ou vice-versa.

### Base e cautela jurídica

A Lei 9.610/1998 protege ilustrações, fotografias e demais obras visuais. Seu art. 46 permite citações na medida justificada e reprodução de pequenos trechos/obras plásticas quando a reprodução não é o objetivo principal, não prejudica exploração normal e não causa prejuízo injustificado. A política de capa reduzida é construída nesses limites editoriais, sem declarar uma autorização universal.

Consequências:

- resolução reduzida, contexto informativo, atribuição e proporcionalidade são requisitos, não decoração;
- uso promocional independente, merchandising, banco de capas ou download de imagem não entra;
- pedido plausível do titular pode remover a imagem e aplicar fallback enquanto o mérito é analisado;
- licença/autorização expressa continua preferível e amplia somente o que disser;
- capa inédita, vazada, roubada, sem publicação legítima ou obtida de área privada é proibida.

### Classes de mídia

| Classe | Uso | Base mínima | Regime |
|---|---|---|---|
| `editorial_cover` | identificar material | página pública oficial/legítima | reprodução reduzida |
| `publisher_cover` | capa fornecida pelo autor/editora | declaração + origem | conforme autorização |
| `user_original` | arte criada pelo usuário | autoria/direitos declarados + D100 quando necessário | conforme termos |
| `licensed_media` | imagem sob CC/licença | licença, versão e atribuição | conforme licença |
| `promotional_asset` | banner/kit oficial | permissão pública de divulgação | limites do kit |
| `preview_page` | página/trecho interno | autorização/licença específica | nunca presumida pela capa |
| `gallery_image` | arte interna/mockup | autorização/licença específica | moderada individualmente |
| `logo_or_mark` | marca/selo/sistema | uso identificador estritamente necessário | sem sugerir afiliação |
| `ai_integrated_image` | capa/interior com IA | D103 + declaração | somente em obra humana substancial |
| `neutral_fallback` | ausência/restrição de imagem | asset próprio Artifício | padrão seguro |

### Origem aceitável para capa editorial

Preferência:

1. upload do autor/editora/titular;
2. media kit ou página oficial do publicador;
3. página oficial de distribuição;
4. página pública do criador;
5. destino externo catalogado, quando claramente ligado ao material.

Não aceitar:

- Google Imagens ou buscador como fonte;
- agregador sem origem;
- rede social/repost de terceiro sem vínculo;
- captura com watermark removido;
- PDF obtido irregularmente;
- imagem ampliada por IA;
- vazamento/pré-lançamento não autorizado;
- URL privada, temporária ou autenticada copiada para contornar acesso.

O registro guarda URL-fonte, domínio, data de coleta, responsável, classe, créditos, base e hash perceptual/técnico quando definido.

### Resolução e derivados

Para `editorial_cover`:

- não conservar arquivo-fonte em resolução integral após gerar o derivado;
- derivado canônico limitado a **800 × 1200 px**, sem upscale;
- qualidade web econômica e metadados desnecessários removidos;
- formatos públicos otimizados, preferindo WebP/AVIF com fallback quando necessário;
- cards usam derivados menores;
- Open Graph compõe a capa inteira em layout Artifício, sem publicar a capa isolada em alta resolução;
- zoom, lightbox em tamanho real e endpoint de original são proibidos;
- URL deve entregar transformação permitida, não transformação arbitrária;
- cache/CDN deve ser invalidável por retirada.

O limite poderá ser reduzido por design/performance, nunca aumentado para reproduzir o original sem nova decisão. `publisher_cover`, `user_original` e `licensed_media` podem ter outros limites técnicos na spec T5.4, conforme autorização, mas a interface pública ainda usa derivados proporcionais.

### Integridade visual

- capa completa é exibida com `contain`; crop destrutivo não é padrão;
- não remover assinatura, crédito, watermark, aviso ou marca;
- não recolorir, redesenhar ou “melhorar” com IA;
- compressão, resize, conversão de formato e composição neutra são técnicas;
- borda/fundo/sombra do card ficam fora da obra;
- selo Artifício não pode parecer parte da capa;
- badges como “gratuito”, “PWYW” e “fan content” ficam na UI, não gravados sobre a imagem;
- correção de orientação é permitida;
- alteração além disso exige base expressa e registro.

### Crédito e atribuição

A ficha mantém, quando disponível:

- título do material;
- autor(es) da capa/ilustração/fotografia;
- editora/titular;
- fonte da imagem;
- licença e link;
- alterações técnicas;
- aviso de marca/programa.

“Autor desconhecido” não elimina obrigação de fonte. Ausência de crédito na página original é registrada; não se inventa autoria. Licenças CC preservam exatamente BY/SA/NC/ND aplicáveis. Crédito pode aparecer em seção de direitos/mídia sem poluir card, mas deve ser acessível.

### Capas de curadoria e produção de fã

- curador pode indicar capa editorial vinda da página legítima do material;
- curador não declara que possui a arte;
- A10 pode usar capa reduzida somente se ela estiver publicamente apresentada pelo próprio criador na página ligada; caso contrário, fallback;
- fan content mostra rótulo não oficial fora da arte;
- logo oficial só aparece quando política/licença permitir ou como referência nominativa estritamente necessária;
- não criar montagem que pareça produto oficial;
- não copiar trade dress para o shell do Artifício.

### Previews, galerias e páginas internas

Capa editorial não autoriza:

- screenshots de páginas internas;
- amostra de regras/texto;
- mapa em resolução legível;
- ficha, token, handout ou ilustração destacável;
- mockup 3D feito por terceiro;
- contracapa/lombada;
- trailer ou vídeo.

Esses itens exigem autorização/licença específica ou fornecimento oficial destinado à divulgação. Cada asset possui prova própria. Preview deve ser necessário, limitado, não substitutivo e não revelar conteúdo que o destino reserva após cadastro/pagamento.

### Marcas e logotipos

- nome do sistema/editora pode identificar compatibilidade/origem;
- logotipo não é herdado de OGL, ORC, SRD ou CC textual;
- uso depende de política de marca/licença/kit ou necessidade nominativa analisada;
- tamanho/posição não podem sugerir patrocínio;
- marcas não compõem identidade global do Downloads;
- alegação de compatibilidade recebe redação clara e disclaimer quando exigido;
- pedido de titular pode substituir logo por texto sem derrubar ficha.

### Pessoas, privacidade e conteúdo sensível

- imagem de pessoa exige base adequada, especialmente menor;
- documento, email, endereço, assinatura, QR code pessoal e dado sensível são proibidos ou redigidos;
- capa adulta/explícita não aparece em descoberta geral;
- material adulto usa fallback/blur seguro e opt-in conforme T4;
- nudez envolvendo menor ou exploração recebe contenção P0;
- símbolos de ódio/contexto sensível podem exigir fallback e aviso;
- texto alternativo descreve a capa sem expor informação sensível nem fazer julgamento.

### IA visual

Aplica D103:

- imagem generativa só integrada a obra humana substancial;
- declaração de IA fica visível na ficha;
- pacote autônomo de imagens geradas é inelegível;
- proibir imitação enganosa de artista vivo, marca, personagem/titular ou pessoa real;
- origem/termos da ferramenta integram prova;
- IA não “limpa” watermark nem reconstrói original;
- capa editorial de terceiro com possível IA pode ser catalogada como representação do material, registrando informação conhecida; o curador não precisa adivinhar processo não divulgado.

### Upload/importação e Cloudinary

Capas ficam no Cloudinary compartilhado já existente, seguindo o contrato do monorepo:

- upload passa pelo backend autenticado; segredo nunca vai ao browser;
- pasta/namespacing próprio de Downloads e ambiente;
- beta e produção têm isolamento lógico e políticas equivalentes;
- `public_id` e vínculo ao material/versão são persistidos;
- URL remota é baixada pelo backend, nunca hotlink permanente;
- proteção contra SSRF, DNS rebinding, redirects hostis e IP privado;
- allowlist de MIME real; SVG e arquivos ativos são proibidos no fluxo inicial;
- limite de bytes, dimensões e decompression bomb;
- hash/deduplicação;
- scan/decodificação segura;
- upload órfão tem reconciliação/limpeza;
- falha de banco após upload agenda destruição/retry;
- retirada apaga/invalida derivados conforme retenção;
- logs não expõem credenciais nem URL privada.

`packages/media` já oferece upload buffer/URL, limite, timeout, hash, `public_id` e destruição com resultado. Mesas possui defesa mais avançada para URL remota. A futura implementação deve consolidar/reusar o pacote compartilhado, não copiar serviço local inseguro.

### Moderação visual

Checklist:

1. classe e finalidade;
2. origem legítima;
3. relação inequívoca com o material;
4. base/prova exigida;
5. resolução e não substituição;
6. créditos/licença/marca;
7. watermark/integridade;
8. conteúdo adulto, pessoa e dados pessoais;
9. IA;
10. MIME/scan/segurança;
11. duplicidade/asset já retirado;
12. fallback disponível.

Uma ficha pode ser aprovada sem a imagem proposta: moderador remove asset e aplica fallback. Troca de capa cria nova versão/revisão. Alteração puramente técnica de derivado não muda direitos, mas é auditada.

### Denúncia e retirada de imagem

T3.4 aplica-se no nível do asset:

- bloquear imagem específica antes da ficha inteira;
- preservar snapshot/prova privadamente;
- invalidar CDN/derivados;
- usar fallback imediatamente;
- notificar publicador quando seguro;
- permitir contestação;
- restauração revalida fonte, direitos e segurança;
- hash de asset retirado pode impedir reupload automático;
- remoção no Cloudinary precisa de retry/reconciliação; sucesso lógico não pode fingir destruição física confirmada.

### SEO, acessibilidade e UX

- `alt` informativo e curto; capa decorativa repetida pode usar alt vazio conforme contexto;
- dimensões conhecidas evitam layout shift;
- lazy loading fora do conteúdo prioritário;
- sem texto essencial apenas dentro da capa;
- ficha fornece título/créditos em HTML;
- imagem retirada não quebra card/OG;
- sitemap indexa ficha, não asset;
- URLs Cloudinary não são tratadas como páginas canônicas;
- OG usa composição Artifício e respeita restrição adulta/retirada.

### Retenção

T5.6 fechará prazos. Requisitos:

- original transitório somente durante processamento;
- capa editorial conserva apenas derivado canônico reduzido;
- prova/fonte separada do asset público;
- versões substituídas e assets órfãos entram em limpeza controlada;
- retirada jurídica pode preservar hash/evidência privada sem manter entrega pública;
- backups e CDN obedecem expiração documentada;
- exclusão de conta não apaga asset que permaneça legitimamente em ficha curada, mas remove vínculo pessoal desnecessário.

### Critérios de aceite para specs executáveis

1. capa editorial reduzida é classe distinta;
2. capa não autoriza PDF, preview ou arte interna;
3. fonte e finalidade são registradas;
4. editorial cover não conserva original integral;
5. máximo canônico é 800 × 1200, sem upscale;
6. cards/OG usam derivados menores/composição;
7. não há endpoint de original/zoom;
8. proporção/integridade/watermark são preservados;
9. crédito/licença/fonte ficam acessíveis;
10. curador não vira titular;
11. A10 usa capa do próprio criador ou fallback;
12. previews/galeria exigem prova própria;
13. marcas não são presumidas abertas por SRD/OGL/ORC;
14. adulto/sensível usa fallback/controle seguro;
15. D103 é aplicada à IA visual;
16. backend controla upload e segredos;
17. importação remota bloqueia SSRF/rebinding/redirect hostil;
18. MIME/dimensões/bytes/scan são validados;
19. asset órfão/remoção tem retry e reconciliação;
20. denúncia pode retirar imagem sem derrubar ficha;
21. CDN é invalidável;
22. acessibilidade e layout não dependem da imagem;
23. beta/prod têm namespace isolado;
24. implementação reutiliza/evolui `packages/media`;
25. fallback neutro existe para toda ausência/restrição.

### Fontes oficiais consultadas

- Lei 9.610/1998, especialmente arts. 7, 29 e 46: <https://www.planalto.gov.br/ccivil_03/leis/l9610.htm>
- Biblioteca Nacional, direitos autorais: <https://www.gov.br/bn/pt-br/atuacao/direitos-autorais-1/direitos-autorais>
- Biblioteca Nacional, obras visuais protegidas: <https://antigo.bn.gov.br/pergunta-resposta/quais-obras-intelectuais-que-sao-passiveis-serem-protegidas>
- STJ, equilíbrio entre acesso à informação e direitos autorais no ambiente digital: <https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias/2026/25022026-Podcast-STJ-No-Seu-Dia-aborda-o-equilibrio-entre-acesso-a-informacao-e-direitos-autorais-no-mundo-digital.aspx>

T3.5 está concluída e encerra F3. Próximo: F4/T4.1, mapa de páginas e rotas conceituais.

## F4/T4.1 — Mapa de páginas e rotas conceituais

### Princípios de roteamento

- host beta: `downloadsbeta.artificiorpg.com`;
- host produção: `downloads.artificiorpg.com`;
- ambas usam as mesmas rotas na raiz, sem basename;
- plural para coleções de recursos; slug humano para páginas públicas;
- UUID/ID opaco para gestão autenticada;
- URL pública estável mesmo após troca de destino/arquivo;
- filtros vivem em query string compartilhável;
- saída externa/arquivo passa por rota técnica própria;
- rota técnica, painel, gestão e estados transitórios são `noindex`;
- aliases antigos redirecionam permanentemente, nunca duplicam canonical;
- API será definida em T5.2 e não se confunde com páginas.

### Árvore geral

```text
/
├── catalogo
├── materiais/:materialSlug
├── sistemas/:systemSlug
│   └── edicoes/:editionSlug
├── tipos/:typeSlug
├── criadores/:creatorSlug
├── usuarios/:username
├── colecoes/:collectionSlug
├── sobre
├── diretrizes
├── termos
├── privacidade
├── login
├── enviar
├── painel/*
├── gestao/*
├── ir/:destinationId
└── obter/:fileId
```

### Páginas públicas principais

| Rota | Página | Função | Indexação |
|---|---|---|---|
| `/` | Início | proposta, busca principal, destaques, recentes e atalhos | index |
| `/catalogo` | Catálogo | descoberta, filtros, ordenação e paginação | index da base; combinações controladas |
| `/materiais/:materialSlug` | Ficha do material | informação completa, créditos, acesso, interações e histórico público relevante | index se `listed` |
| `/sistemas/:systemSlug` | Landing de sistema | contexto + materiais relacionados | index se conteúdo suficiente |
| `/sistemas/:systemSlug/edicoes/:editionSlug` | Landing de edição | materiais compatíveis com edição canônica 062 | index se conteúdo suficiente |
| `/tipos/:typeSlug` | Landing de tipo | aventura, suplemento, ficha, mapa etc. | index somente vocabulário curado |
| `/criadores/:creatorSlug` | Criador/editora | entidade creditada: pessoa, coletivo, editora ou selo | index |
| `/usuarios/:username` | Perfil comunitário | conta pública, curadoria e contribuições autorizadas | index se público |
| `/colecoes/:collectionSlug` | Coleção pública | lista editorial/pessoal compartilhada | index se pública e substancial |
| `/sobre` | Sobre Downloads | explicar hub, não loja/repositório | index |
| `/diretrizes` | Diretrizes de publicação | elegibilidade, provas, IA, fan content e moderação | index |
| `/termos` | Termos específicos | responsabilidades e regras do produto | index |
| `/privacidade` | Privacidade específica | tratamento do módulo e ligação com política geral | index |

Páginas legais podem ser centralizadas no Site no futuro; enquanto houver rota local, ela deve indicar fonte canônica e não criar textos conflitantes.

### Início `/`

Blocos conceituais:

- busca;
- explicação curta: “hub para catalogar e encontrar materiais”;
- materiais em destaque editorial;
- novidades aprovadas;
- sistemas populares;
- tipos principais;
- coleções editoriais;
- criadores/editoras em destaque;
- CTA para enviar material;
- aviso claro sobre links externos/PWYW;
- conteúdo seguro por padrão.

Início não replica todos os filtros nem vira feed infinito. O CTA principal leva ao catálogo ou ao destino da ficha, nunca inicia pagamento.

### Catálogo `/catalogo`

É a URL canônica de busca/listagem. `/busca` redireciona para `/catalogo`, preservando parâmetros reconhecidos.

Famílias conceituais de query:

- `q`;
- `sistema`;
- `edicao`;
- `cenario`;
- `tipo`;
- `genero`;
- `idioma`;
- `formato`;
- `plataforma`;
- `acesso`;
- `barreira`;
- `licenca`;
- `criacao`;
- `publico`;
- `classificacao`;
- `tag`;
- `ordenar`;
- `pagina`.

Parâmetros usam slugs/IDs públicos estáveis, não rótulos traduzidos. Múltiplos valores têm representação determinística. T4.3 fechará sintaxe, ordem, paginação e UX.

SEO:

- catálogo sem filtros possui canonical próprio;
- busca textual, ordenação, paginação profunda e combinações livres são `noindex,follow`;
- somente landings curadas de sistema/edição/tipo recebem indexação;
- query desconhecida é ignorada com aviso ou rejeitada de modo previsível, nunca gera páginas infinitas.

### Ficha `/materiais/:materialSlug`

Seções:

- capa/fallback, título, resumo e badges;
- CTA de acesso com destino, tipo e barreiras;
- aviso PWYW sem preço;
- descrição;
- sistema/edição/compatibilidade/cenário;
- tipo, idioma, formatos, público e avisos;
- autoria, tradução, editora, demais créditos;
- licença/base, fan content, IA e atribuições;
- arquivos/destinos elegíveis;
- prova pública resumida, sem documento sensível;
- avaliações, comentários, favoritos e coleções;
- materiais relacionados;
- perfil do cadastrante e papel declarado;
- data/versão e changelog público relevante;
- denunciar/link quebrado.

Estados:

- `listed`: página completa e indexável;
- `unlisted`: acessível, `noindex`;
- `temporarily_hidden|suspended`: página neutra sem CTA/asset sensível;
- `withdrawn`: mensagem neutra e eventual histórico permitido;
- slug antigo: `301` para slug atual;
- inexistente: 404 real;
- versão candidata nunca possui URL pública separada indexável.

### Criadores versus usuários

`/criadores/:creatorSlug` representa entidade creditada, mesmo sem conta:

- pessoa autora/tradutora/ilustradora;
- coletivo;
- editora;
- selo.

`/usuarios/:username` representa conta Artifício:

- submissões/curadorias públicas;
- coleções públicas;
- bio/links permitidos;
- vínculo reivindicado com criador/editora;
- métricas públicas autorizadas.

Regras:

- curador não se torna autor;
- um criador pode ser reivindicado por uma ou mais contas/organização após prova;
- conta pode gerir várias entidades;
- perfis são interligados, não fundidos;
- slug de criador não depende de username;
- entidade mesclada redireciona ao canônico e preserva créditos.

### Sistemas, edições e tipos

Downloads só lê IDs canônicos da Spec 062.

- landing de sistema/edição usa dados integrais do serviço central;
- não existe rota de administração local do catálogo de sistemas;
- botão de gestão autorizado leva ao Site, local major da 062;
- cenário permanece classificação própria do Downloads;
- sistema/edição sem materiais suficientes pode existir para navegação, mas fica `noindex`;
- merge/alias no serviço 062 gera redirect/canonical coerente;
- filtros e links internos usam ID; slug serve apresentação/SEO.

### Coleções

| Rota | Uso |
|---|---|
| `/colecoes/:collectionSlug` | coleção pública |
| `/painel/colecoes` | coleções do usuário |
| `/painel/colecoes/nova` | criação |
| `/painel/colecoes/:collectionId/editar` | edição |

Privada não responde como pública. Coleção removida/privatizada retorna estado apropriado sem expor existência/dono indevidamente. Favoritos não são automaticamente coleção pública.

### Entrada e autenticação

| Rota | Comportamento |
|---|---|
| `/login` | inicia SSO em `accounts.artificiorpg.com`; `noindex` |
| `/enviar` | gateway autenticado para novo cadastro; após login retorna ao fluxo |
| `/painel` | visão geral pessoal |

Não haverá cadastro/senha local. Return URL é allowlisted. Usuário já autenticado em `.artificiorpg.com` não enfrenta login duplicado.

### Painel do usuário

```text
/painel
├── materiais
│   ├── novo
│   └── :materialId
│       ├── editar
│       ├── versoes
│       ├── destinos
│       ├── arquivos
│       ├── midias
│       └── provas
├── favoritos
├── colecoes
│   ├── nova
│   └── :collectionId/editar
├── perfil
├── organizacoes
├── notificacoes
├── denuncias
└── configuracoes
```

Definição:

| Rota | Função |
|---|---|
| `/painel` | resumo de envios, pendências, métricas e ações |
| `/painel/materiais` | todos os materiais geridos e seus estados |
| `/painel/materiais/novo` | rascunho inicial |
| `/painel/materiais/:materialId` | detalhe operacional/status |
| `/painel/materiais/:materialId/editar` | nova versão candidata |
| `/painel/materiais/:materialId/versoes` | histórico e decisões |
| `/painel/materiais/:materialId/destinos` | links/barreiras/PWYW |
| `/painel/materiais/:materialId/arquivos` | uploads gerenciados permitidos |
| `/painel/materiais/:materialId/midias` | capa/previews e direitos |
| `/painel/materiais/:materialId/provas` | D100 privada |
| `/painel/favoritos` | favoritos privados |
| `/painel/colecoes` | gestão de coleções |
| `/painel/perfil` | perfil comunitário e vínculos públicos |
| `/painel/organizacoes` | editoras/coletivos e membros |
| `/painel/notificacoes` | eventos editoriais/interações |
| `/painel/denuncias` | casos que o usuário pode acompanhar |
| `/painel/configuracoes` | preferências específicas |

Subrotas podem ser implementadas como páginas ou tabs acessíveis; os conceitos/URLs devem permanecer deep-linkáveis. A forma visual será decidida em T4.4.

### Gestão/moderação

Segue padrão maduro de Mesas: `/gestao` com layout persistente e subseções.

```text
/gestao
├── visao-geral
├── moderacao
│   └── :submissionId
├── materiais
│   └── :materialId
├── denuncias
│   └── :caseId
├── links
├── arquivos
├── midias
├── publicadores
├── taxonomias
├── metricas
├── auditoria
└── configuracoes
```

| Rota | Função |
|---|---|
| `/gestao/visao-geral` | fila, riscos, saúde e atalhos |
| `/gestao/moderacao` | submissões/edições pendentes |
| `/gestao/moderacao/:submissionId` | diff, provas, checks e decisão |
| `/gestao/materiais` | busca administrativa de todas as fichas |
| `/gestao/materiais/:materialId` | histórico/ações administrativas |
| `/gestao/denuncias` | fila T3.4 |
| `/gestao/denuncias/:caseId` | caso, contenção, contraditório e recurso |
| `/gestao/links` | saúde, redirects e PWYW |
| `/gestao/arquivos` | scan, quarentena, providers e reconciliação |
| `/gestao/midias` | capas, direitos e órfãos Cloudinary |
| `/gestao/publicadores` | usuários, organizações, vínculos e capacidades |
| `/gestao/taxonomias` | vocabulários próprios de Downloads |
| `/gestao/metricas` | operação/qualidade/antiabuso |
| `/gestao/auditoria` | eventos e reconstrução de decisões |
| `/gestao/configuracoes` | gates e parâmetros não secretos |

Administração de sistemas/edições **não** mora em `/gestao/taxonomias`. A gestão oferece link contextual para a rota canônica do Site definida pela Spec 062. Downloads, Glossário e Mesas podem acessar essa gestão, mas não criam cópia local.

### Rotas técnicas de saída

| Rota | Função | Regra |
|---|---|---|
| `/ir/:destinationId` | resolver link externo/direto | checks, evento qualificado, aviso/barreira; `noindex` |
| `/obter/:fileId` | resolver arquivo gerenciado | autorização/gates/scan/provider; `noindex` |

Regras:

- CTA da ficha usa uma dessas rotas, não URL de provider crua;
- ID opaco, não URL codificada pelo cliente;
- redirect só para destino aprovado/ativo;
- `/ir` não faz open redirect;
- `/obter` não revela bucket/provider;
- ambos falham fechados e mostram retorno seguro à ficha;
- clique/redirect não é declarado “download concluído”;
- bots/preview não devem inflar métrica;
- PWYW sempre usa `/ir`, nunca `/obter`;
- A10 sempre usa `/ir`.

O nome público do CTA pode ser “Acessar”, “Ver página” ou “Baixar”, conforme destino. A rota técnica não determina a linguagem.

### Rotas auxiliares e estados

| Rota/estado | Comportamento |
|---|---|
| `/404` conceitual | resposta HTTP 404, busca e caminhos úteis; URL inválida não redireciona silenciosamente |
| `/indisponivel` conceitual | fallback de serviço; normalmente renderizado no contexto, não canonical próprio |
| `/sem-acesso` conceitual | 403 autenticado sem revelar dados |
| manutenção | 503 real, `Retry-After`, sem indexação |

Páginas públicas precisam de estados loading/empty/error/degraded. Painel/gestão distinguem 401, 403, 404 e conflito de versão.

### Redirects e canonical

- `/busca` → `/catalogo`;
- `/material/:slug` → `/materiais/:slug`, se legado surgir;
- slug antigo de material/criador/coleção → slug canônico;
- merge de entidade/sistema → entidade canônica;
- filtros normalizados removem parâmetros vazios/duplicados;
- host beta sempre `noindex` e canonical não deve promover beta;
- produção usa HTTPS/host canônico;
- trailing slash segue uma política única da futura implementação;
- UTM/referrer não entram em canonical;
- rotas autenticadas/técnicas não emitem canonical público enganoso.

Não existem redirects do WordPress legado para Downloads nesta fase, pois D090 confirmou ausência de legado Downloads. Qualquer rota futura nasce de inventário explícito.

### Sitemap e descoberta por buscador

Inclui:

- início;
- fichas `listed`;
- criadores públicos;
- usuários públicos elegíveis;
- coleções públicas substanciais;
- landings curadas de sistema/edição/tipo;
- páginas institucionais.

Exclui:

- beta;
- catálogo filtrado livremente;
- busca textual/paginação;
- `unlisted`, suspenso e retirado;
- painel/gestão/login;
- `/ir` e `/obter`;
- drafts/versões candidatas;
- páginas vazias/thin.

Mudança editorial publica/despublica sitemap de modo consistente com estado público.

### Ownership

| Superfície | Dono |
|---|---|
| páginas e rotas Downloads | futuro `apps/downloads` |
| SSO/login/sessão | `accounts.` + `packages/auth` |
| header/nav/design | `packages/ui` |
| sistemas/edições | serviço central Site/Spec 062 |
| capas | Cloudinary shared via `packages/media` |
| arquivos | cadeia R2/B2/Fastio/Cloudinary PDF |
| analytics | contrato compartilhado + domínio Downloads |
| políticas gerais | Site; políticas específicas, Downloads |

### Critérios de aceite para specs executáveis

1. todas as páginas têm rota, público, ownership e indexação;
2. root funciona sem basename em beta/prod;
3. `/catalogo` é busca canônica;
4. `/materiais/:slug` é ficha pública estável;
5. criador creditado e conta comunitária são separados;
6. sistemas/edições vêm exclusivamente da 062;
7. cenário/taxonomias próprias não invadem 062;
8. painel usa IDs opacos;
9. gestão segue `/gestao/*`;
10. moderação e denúncia possuem deep links;
11. provas nunca têm rota pública;
12. drafts/candidatas não são indexáveis;
13. `/ir` não é open redirect;
14. `/obter` oculta provider;
15. PWYW/A10 nunca usam arquivo gerenciado;
16. estados suspenso/retirado preservam resposta coerente;
17. slugs antigos redirecionam;
18. filtros livres não criam indexação infinita;
19. beta é integralmente `noindex`;
20. sitemap reflete estado editorial;
21. 404/403/503 têm semântica HTTP correta;
22. rotas protegidas retornam ao fluxo após SSO;
23. página pública nunca revela nota/prova privada;
24. mapa suporta desktop/mobile sem mudar URLs;
25. futuras APIs não reutilizam rotas de página ambiguamente.

T4.1 está concluída. Próximo: T4.2, submenu abaixo do nav e sidebar desktop/mobile.

## F4/T4.2 — Submenu abaixo do nav e sidebar desktop/mobile

### Referências internas verificadas

`packages/ui/Header` já suporta:

- nav global dos projetos;
- `moduleNav` em segunda linha;
- destaque por `moduleCurrentHref`;
- sessão SSO, menu de usuário, busca, tema, changelog e ações;
- menu responsivo e fechamento por Escape.

Mesas fornece:

- `AppShell` integrando Header/Footer compartilhados;
- `/gestao` com sidebar por recursos, não verbos;
- destaque por rota, grupos e badges;
- catálogo desktop com filtros laterais;
- drawer de filtros no mobile.

Downloads deve reutilizar/evoluir esses contratos. Não cria header paralelo, cores hardcoded ou navegação incompatível.

### Hierarquia pétrea

```text
Header Artifício (global)
└── Submenu Downloads (áreas do projeto)
    └── Shell da página
        ├── Sidebar contextual
        └── Conteúdo principal
```

Responsabilidades:

| Camada | Pergunta respondida | Exemplos |
|---|---|---|
| nav global | “Qual projeto Artifício?” | Site, Glossário, Mesas, Downloads |
| submenu | “Qual área do Downloads?” | Início, Catálogo, Criadores, Coleções |
| sidebar | “Como explorar/operar esta área?” | filtros, seções, status, filas |
| conteúdo | “Qual tarefa/informação atual?” | resultados, ficha, formulário |

Um item não aparece nas três camadas. Sidebar não repete toda a module nav.

### Header global

- usa `Header` de `packages/ui`;
- logo leva ao portal conforme contrato compartilhado;
- `Downloads` aparece ativo no nav global;
- sessão vem de `accounts.` e cookie compartilhado;
- tema respeita cookie global;
- busca do header abre/foca busca do catálogo;
- sino/notificações e changelog usam ações compartilhadas quando existirem;
- menu da conta inclui Perfil Artifício, Conta Downloads/Painel e Gestão somente por permissão;
- header e submenu são sticky como uma unidade;
- altura total é publicada em variável de layout, sem `calc` hardcoded divergente.

O header global não ganha filtros, categorias ou links administrativos específicos.

### Submenu Downloads

Ordem pública:

1. `Início` → `/`;
2. `Catálogo` → `/catalogo`;
3. `Sistemas` → área de descoberta/landings;
4. `Criadores` → listagem/descoberta de criadores;
5. `Coleções` → coleções públicas;
6. `Enviar material` → `/enviar`, com tratamento visual de CTA.

Itens condicionais:

- `Painel` → `/painel`, somente autenticado;
- `Gestão` → `/gestao`, somente com permissão.

Regras:

- rótulos são substantivos/destinos, exceto CTA `Enviar material`;
- item ativo usa rota e `aria-current="page"`;
- pai permanece ativo em subrotas;
- `Sistemas` não abre gestão da 062; leva à descoberta pública;
- gestão central de sistemas é link contextual dentro da Gestão, não item público;
- badges aparecem apenas quando acionáveis: pendências/notificações;
- contagem `99+` evita expansão;
- falha ao buscar contagem não bloqueia navegação.

### Submenu em desktop

- segunda linha imediatamente abaixo da nav global;
- largura alinhada ao container do produto;
- uma linha, sem dropdown para itens principais;
- CTA separado visualmente, sem parecer anúncio;
- estado ativo por contraste, indicador e texto — não somente cor;
- foco visível;
- alvo mínimo de 44 px de altura;
- não encobre título ao navegar por âncora;
- sombra/borda usam tokens do design system.

### Submenu em mobile

- permanece abaixo do header compacto;
- itens prioritários visíveis em faixa horizontal rolável: Início, Catálogo, Enviar;
- demais itens continuam acessíveis na mesma faixa/menu “Mais”, conforme teste de largura;
- posição ativa entra no viewport automaticamente, sem animação excessiva;
- scroll horizontal tem indicação visual, mas não barra intrusiva;
- não depende de hover;
- swipe não substitui controles;
- não cria bottom navigation concorrente no MVP;
- menu global e drawer lateral nunca ficam abertos simultaneamente.

A implementação deve testar nomes em português real, não abreviações obscuras.

### Shell público com sidebar

Em desktop, páginas públicas de descoberta usam sidebar esquerda persistente:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header global                                                │
├──────────────────────────────────────────────────────────────┤
│ Submenu Downloads                                            │
├───────────────┬──────────────────────────────────────────────┤
│ Sidebar       │ Conteúdo principal                           │
│ contextual    │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

Base da sidebar pública:

- `Explorar`;
- todos os materiais;
- recentes;
- populares;
- destaques;
- sistemas;
- tipos;
- idiomas;
- licenças;
- gratuitos/PWYW externo;
- conteúdo para mim, quando autenticado;
- atalhos de favoritos/coleções quando pertinentes.

Ela não exibe lista completa de 1.265 sistemas nem vocabulários gigantes. Mostra itens populares/selecionados e abre busca/seleção adequada.

### Sidebar por contexto

| Contexto | Conteúdo da sidebar |
|---|---|
| Início | atalhos de exploração e coleções editoriais |
| Catálogo | exploração + filtros/facetas |
| Sistema/edição | contexto da entidade, edições e filtros aplicáveis |
| Tipo | tipos relacionados + filtros |
| Criador | navegação do perfil, créditos e coleções relacionadas |
| Usuário | contribuições, curadorias e coleções públicas |
| Coleção | índice/metadata da coleção e coleções relacionadas |
| Ficha | contexto reduzido: seção atual, relacionados e ações secundárias |

Na ficha, CTA de acesso continua no conteúdo principal em posição clara/sticky quando útil; a sidebar não vira espaço publicitário nem duplica CTA em excesso.

### Sidebar do catálogo

T4.3 fechará filtros. T4.2 fixa comportamento:

- grupos expansíveis com resumo de seleções;
- filtros ativos no topo e em chips no conteúdo;
- contador acessível;
- limpar grupo e limpar tudo;
- aplicar imediatamente no desktop após debounce/ação apropriada;
- estado sempre refletido na URL;
- expansão visual não precisa ir à URL;
- loading não desmonta sidebar nem perde foco;
- lista longa tem busca interna/“ver mais”;
- filtros dependentes: edição só após sistema, com opção agnóstica;
- sidebar pode ser sticky e ter scroll próprio somente se não criar armadilha de rolagem.

### Breakpoints conceituais

| Faixa | Navegação lateral |
|---|---|
| `≥ 1280 px` | sidebar completa, ~272 px, sticky |
| `1024–1279 px` | sidebar compacta/recolhível, conteúdo priorizado |
| `< 1024 px` | sidebar fora do canvas, aberta como drawer |

Breakpoints finais devem seguir tokens compartilhados; os números são contrato comportamental inicial, não licença para media queries isoladas em cada página.

### Drawer público/mobile

Um único componente comporta variantes `explorar` e `filtros`.

Requisitos:

- botão visível `Explorar` ou `Filtros`;
- badge com quantidade de filtros ativos;
- abre lateralmente, largura máxima confortável e `100dvh`;
- backdrop;
- título, fechar, conteúdo rolável e rodapé fixo quando houver aplicação;
- respeita safe areas;
- trava scroll do fundo;
- foco inicial no título/primeiro controle;
- focus trap;
- Escape fecha;
- clique no backdrop fecha se não houver operação crítica;
- fechar restaura foco no gatilho;
- background fica `inert`/inacessível;
- mudança de rota fecha;
- botão Voltar do navegador não fica sequestrado de forma surpreendente;
- estado de filtros só é descartado mediante regra explícita.

No catálogo mobile, filtros podem ser alterados em estado temporário e aplicados por botão; cancelar preserva URL anterior. Essa diferença para desktop será explicitada em T4.3.

### Painel

Ao entrar em `/painel/*`, a sidebar pública é substituída por sidebar de conta:

- Visão geral;
- Meus materiais;
- Favoritos;
- Coleções;
- Perfil;
- Organizações;
- Notificações;
- Denúncias;
- Configurações.

Subitens específicos do material aparecem em navegação contextual interna/breadcrumb, não incham permanentemente a rail principal.

Desktop:

- rail esquerda completa;
- item ativo por rota;
- badges de pendências;
- conteúdo com largura apropriada para formulários/tabelas.

Mobile:

- botão `Menu do painel`;
- drawer com identidade da conta e mesmos destinos;
- título/breadcrumb permanecem no conteúdo;
- ações primárias não ficam escondidas somente na drawer.

### Gestão

Segue `/gestao/*` e padrão Mesas, adaptado:

- Visão geral;
- Moderação;
- Materiais;
- Denúncias;
- Links;
- Arquivos;
- Mídias;
- Publicadores;
- Taxonomias;
- Métricas;
- Auditoria;
- Configurações.

Regras:

- sidebar = recursos, não comandos;
- grupos podem ser: Conteúdo, Operação, Comunidade, Sistema;
- contagens por fila no item correspondente;
- P0 usa indicador textual/ícone, não só cor;
- “Sistemas e edições” aponta ao Site/062 com sinal de saída para outro subdomínio;
- permissão filtra visualmente, mas backend continua autoridade;
- botão de contenção/kill switch não mora como item casual da navegação;
- ações destrutivas ficam na página contextual, com confirmação.

Mobile/tablet:

- sidebar vira drawer;
- tabelas não forçam rail aberta;
- P0/pendências continuam perceptíveis no gatilho;
- drawer fecha ao navegar.

### Ficha e CTA sticky

Na ficha:

- capa e resumo ocupam coluna principal;
- bloco de acesso pode ficar sticky no desktop dentro do grid, sem cobrir footer;
- mobile usa CTA no fluxo e, se validado, barra inferior compacta respeitando safe area;
- CTA mostra tipo: página externa, link direto ou arquivo Artifício;
- barreiras e PWYW aparecem antes do clique;
- favorito/coleção/compartilhar/denunciar são secundários;
- sidebar lateral permanece contextual, mas não compete com acesso.

T4.4 definirá composição exata.

### Conteúdo, largura e rolagem

- container máximo usa token comum;
- sidebar não reduz coluna de leitura abaixo do confortável;
- páginas de texto legal/sobre podem omitir sidebar e usar largura de leitura;
- gestão pode usar canvas mais largo;
- footer vem após conteúdo, não dentro do scroll da sidebar;
- sticky calcula header global + submenu dinamicamente;
- nenhuma região cria dois scrolls verticais concorrentes em mobile;
- tabelas usam overflow próprio somente na direção necessária;
- zoom de 200% continua operável.

### Persistência

Pode persistir localmente:

- sidebar desktop recolhida/aberta;
- grupos de filtro expandidos;
- última seção do painel apenas como conveniência.

Não persistir fora da URL:

- filtros aplicados;
- ordenação;
- página;
- material/versão em edição;
- estado de moderação;
- drawer aberto.

Preferências não sincronizadas nunca alteram permissão nem ocultam P0.

### Acessibilidade

- skip links: `Ir para conteúdo`, `Ir para navegação do Downloads`, `Ir para filtros` quando houver;
- landmarks distintos: header/banner, nav global, nav módulo, nav lateral, main, footer;
- cada `<nav>` possui `aria-label` único;
- headings mantêm hierarquia;
- item ativo usa `aria-current`;
- drawers são dialogs adequados;
- foco nunca fica atrás de overlay;
- contraste AA em default/hover/focus/active/disabled;
- alvos mínimos 44×44;
- ícone acompanhado de texto, salvo rail recolhida com nome acessível/tooltip;
- badges têm rótulo completo para leitor de tela;
- animação respeita `prefers-reduced-motion`;
- navegação completa por teclado;
- ordem DOM acompanha leitura, independentemente do grid visual.

### Estados

- sem sessão: CTA Enviar inicia SSO; sidebar não mostra dados privados;
- sessão carregando: espaço reservado evita layout shift;
- offline/degradado: navegação básica permanece e informa falha;
- zero resultados: sidebar/filtros continuam acessíveis;
- 403: não renderiza rapidamente conteúdo protegido antes do guard;
- mudança de role durante sessão atualiza menu;
- item removido/suspenso não deixa link morto na navegação;
- contagem stale é sinalizada/atualizada sem bloquear.

### Telemetria de UX

Eventos conceituais:

- uso do submenu;
- abrir/fechar drawer;
- recolher sidebar;
- aplicar/limpar filtros;
- navegação painel/gestão;
- falha de autorização;
- abandono de drawer/form.

Não registrar texto de busca sensível, conteúdo de prova ou notas administrativas em analytics genérico.

### Critérios de aceite para specs executáveis

1. Header compartilhado permanece fonte única;
2. nav global, submenu e sidebar têm funções distintas;
3. submenu fica abaixo do nav em todas as páginas aplicáveis;
4. submenu possui estado ativo acessível;
5. sidebar pública existe no desktop;
6. catálogo incorpora filtros na sidebar;
7. listas enormes usam busca/“ver mais”;
8. painel e gestão substituem sidebar pública;
9. sidebar gestão usa recursos, não verbos;
10. link 062 aponta ao Site, sem cópia local;
11. mobile usa drawer, não sidebar espremida;
12. drawer trava fundo e gerencia foco;
13. Escape/rota fecham drawer e foco retorna;
14. filtros aplicados vivem na URL;
15. badges não dependem só de cor;
16. ações primárias continuam visíveis no mobile;
17. sticky considera altura real de header + submenu;
18. não há scroll vertical duplo no mobile;
19. legal/sobre podem omitir sidebar;
20. sessão/role não causam flash de conteúdo restrito;
21. navegação funciona com teclado e zoom 200%;
22. contraste e alvos atendem AA;
23. reduced motion é respeitado;
24. beta/prod usam mesma IA visual/navegação;
25. comportamento é coberto por testes de rota, foco e viewport nas specs futuras.

T4.2 está concluída. Próximo: T4.3, busca, filtros, ordenação e paginação.
