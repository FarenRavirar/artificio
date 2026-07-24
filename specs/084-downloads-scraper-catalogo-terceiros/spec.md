# Spec 084 — Downloads: scraper de indexação automática de materiais grátis/PWYW **em português** de terceiros

## Origem

Mantenedor pediu ferramenta pra `apps/downloads` que raspe sites de venda de material de RPG (marketplaces) e indexe automaticamente **apenas** os itens gratuitos ou "pague o quanto quiser" (PWYW), pra resolver o problema de catálogo vazio no lançamento do projeto. Pedido explícito: "quero que no primeiro momento popule com scraper" — sem fila de revisão humana antes de publicar.

Em seguida, o mantenedor fechou uma segunda trava, também pétrea e igualmente prioritária: **`downloads` só aceita material em português — nenhum material em outro idioma é permitido, em nenhum fluxo (manual ou scraper)**, e essa regra precisa aparecer de verdade em todo lugar que representa o produto — schema, validação, scraper, frontend/busca, SEO e página institucional de uso/licença —, não só "ficar no contexto da conversa". Isso está registrado como **D119** (`.specify/memory/decisions.md`) e como item 20 das "Decisões de produto fechadas" da spec 061. Uma auditoria factual do código real (2026-07-24) confirmou que essa regra **não existia em nenhuma camada** antes desta spec: campo `language` era `VARCHAR(20)` livre sem `CHECK`/enum, sem obrigatoriedade, sem filtro/exibição no frontend (comentário no próprio código confirma pendência, `materials.ts` linha ~28-32), sem verificação automática de idioma do conteúdo, e sem nenhuma página institucional de termos/licença/uso em lugar nenhum do app (nem rota, nem spec, nem conteúdo). Por decisão do mantenedor, todo esse gap entra no escopo desta spec 084, junto com o scraper — não vira spec separada.

## Pré-requisito — decisão nominal que redefine o modelo de automação de Downloads

A spec 061 (definição de produto de Downloads) tinha fechado, de forma pétrea, que automação **nunca** cria nem publica material sozinha — só verifica link/saúde (D090, D095, D100, persona P10, matriz de capacidades `spec.md:1638-1668` da 061). Essa regra foi verificada contra o código/specs reais nesta sessão, e o mantenedor decidiu que ela deixa de descrever a realidade do produto: existe agora um segundo ator de criação de conteúdo (o scraper), com regras próprias, ao lado do ator humano.

Isso está registrado em **D118** (`.specify/memory/decisions.md`), que **reescreve por extenso** o modelo de automação de Downloads — não é exceção pontual: D090/D095/D100 foram marcadas como revisadas (cada uma com a cláusula exata que mudou, o resto continua firme), e a persona P10 original passa a cobrir só verificação/saúde/quota; criação/publicação automática vira papel do ator "scraper", descrito por completo em D118. Toda decisão de escopo desta spec deriva de D118 + das perguntas resolvidas nominalmente com o mantenedor em 2026-07-24 (registradas inline nas seções seguintes).

## Objetivo

Um scraper, disparado manualmente por admin, que varre itch.io, DriveThruRPG e DMs Guild, identifica itens **gratuitos ou PWYW-com-opção-zero-real E em português**, e cria+publica `download_material` (`access_kind=external_link`, sempre linkando pro produto original — nunca hospedando cópia), sem revisão humana prévia, com re-checagem periódica de preço reusando o link-checker existente (P10/`download_link_check`) pra suspender automaticamente material que deixou de ser gratuito. Idioma é filtro **de entrada**, tão obrigatório quanto preço zero — item não-português é descartado antes de qualquer outra checagem, nunca publicado "pra revisar depois".

Em paralelo, a spec corrige o gap de idioma que hoje afeta o catálogo inteiro (não só o scraper): schema, validação de submissão humana, frontend e página institucional pública que declara a regra.

## Decisões de escopo já fechadas nominalmente (2026-07-24)

- **Publicação:** só link externo (`access_kind=external_link`). Scraper nunca baixa/hospeda arquivo — reforça D102/D106, sem exceção.
- **Fluxo editorial:** publica direto (`editorial_state=published`), sem fila de moderação humana antes. Divergência frontal com D104 ("todo cadastro e edição publicada passam por moderação") — D118 abre exceção nomeada só pra este fluxo.
- **Fontes no primeiro momento:** itch.io, DriveThruRPG, DMs Guild — ampliadas depois (2026-07-24, mesma sessão) com candidatos brasileiros pesquisados: ver "Fontes ampliadas" abaixo.
- **Trigger de execução — revisado 2026-07-24:** onde não há anti-bot ativo (itch.io hoje), scraper roda em **cron diário automático**, sem precisar de disparo manual. Onde há WAF/anti-bot confirmado (DriveThruRPG/DMs Guild), disparo continua **manual** (Modo 2 tentativo) ou via Modo 3 (browser local) — automatizar contra bloqueio ativo aumentaria a chance de ban de IP do servidor sem necessidade. `POST /admin/scraper/run` continua existindo pra disparo manual/forçado de qualquer fonte, cron é complementar, não substitui a rota.
- **Re-checagem de preço pós-publicação:** reusa e estende `download_link_check` (P10) — não reprocessa do zero, não fica sem re-checagem.
- **Modo 3 é ferramenta fora da IA (revisado 2026-07-24):** script standalone (Python ou Node, decisão em `plan.md`) rodando localmente na máquina do mantenedor, usando o profile real do Chrome (`--user-data-dir` apontando pro diretório de perfil existente, sessão já logada) via Playwright/Puppeteer — **não** via `claude-in-chrome`/Claude em loop. Motivo explícito do mantenedor: IA consome caro demais pra rodar scraping item-a-item repetidamente; Claude Code entra só na fase de **construir** a ferramenta (uma vez), não na de **executá-la** (repetido, todo dia/sob demanda, pelo mantenedor sozinho, sem custo de IA por rodada).
- **DeepSeek (já em uso no projeto, spec 052) como opção pra casos ambíguos de idioma:** quando o detector determinístico (`franc`/heurística) não tem confiança suficiente, uma chamada pontual ao DeepSeek (mesmo padrão multi-provider da spec 052, texto curto, custo baixo) pode servir de segundo opinião antes de descartar/aceitar — nunca como motor principal do pipeline, só desempate de baixo volume.

## Achados de investigação (verificados nesta sessão, não assumidos)

### Estado do repo — greenfield total

- Não existe hoje, em `apps/downloads`, nenhuma tabela, rota, dependência ou infraestrutura de scraping. `download_material` (schema atual, `apps/downloads/backend/src/db/types.ts`) não tem campo de origem/fonte externa (`source_platform`, `source_url` de origem, `imported_at`) — todo material hoje nasce de `POST /` feito por humano autenticado (`materials.ts`), sem processo de import.
- Zero dependência de scraping (`puppeteer`, `playwright`, `cheerio`, `axios`, `crawlee`, `jsdom`) em qualquer `package.json` do monorepo hoje. Runtime usa `fetch` nativo (padrão já em `accountsClient.ts`, spec 083).
- Rate-limit hoje é só de **entrada** (`express-rate-limit` em `apps/downloads/backend/src/middleware/rateLimit.ts`, por IP) — nada de rate-limit de **saída** (taxa de requisição contra terceiro) existe.
- Já existe `download_link_check` (persona P10) — health/status de link, criado pela spec 061/07x. Esta spec estende essa tabela/serviço em vez de criar um paralelo.

### Marketplaces-alvo — estrutura de dados, API, robots.txt, bloqueio (pesquisa 2026-07-24)

**DriveThruRPG / DMs Guild (mesma plataforma, OneBookShelf):**
- **Sem API pública oficial documentada.**
- Existe rota de browse filtrável por preço via URL: `/en/browse/freebies` (grátis) e `/en/browse?pwyw=true` (PWYW) — confirmado só via resultado de busca, não via fetch direto.
- **Achado crítico, verificado empiricamente nesta sessão:** toda tentativa de `fetch`/`WebFetch` simples contra `drivethrurpg.com` e `dmsguild.com` retornou **HTTP 403**, em qualquer path — inclusive `/robots.txt`. Isso indica bloqueio de edge (WAF/Cloudflare) contra requisição sem fingerprint de browser real, **antes mesmo de qualquer challenge JS aparecer**. Não é "eventualmente vai bloquear" — bloqueia de cara, todo request.
- Não foi possível confirmar conteúdo de `robots.txt` nem do Terms of Use (ambos bloqueados por 403) — cláusula explícita proibindo scraping (se existir) não foi confirmada nem descartada.
- Conteúdo do DMs Guild tem regime de IP mais restrito: publicar lá cede direitos de revenue-share à WotC — reforça que linkar (nunca copiar) é o único modo aceitável.

**itch.io:**
- Tem API server-side oficial (`itch.io/docs/api/serverside`), mas cobre só recursos de "meus jogos"/dev autenticado (`/profile/games`, `/games/{id}/download_keys` etc.) — **nenhum endpoint de busca/listagem pública de catálogo por preço**.
- Descoberta de free/PWYW só via páginas HTML públicas de browse (`itch.io/games/free`, `/games/newest/free`).
- `robots.txt` confirmado (fetch funcionou, sem bloqueio): `Disallow` em `/embed/`, `/embed-upload/`, `/search`, `/checkout/`, `/game/download/`, `/bundle/download/`, `/register-for-purchase/`, `/email-feedback/`. **`/search` está vetado** — crawlear via busca textual violaria robots.txt; páginas `/games/free` não estão na lista de disallow.
- ToS não tem cláusula explícita proibindo scraping/bot — cláusula mais próxima é genérica ("hacking, maliciously manipulating, or misrepresenting itch.io's interface").
- Sem bloqueio de fetch simples observado nesta pesquisa — mas sem garantia de que escala maior não aciona rate-limit/Cloudflare depois.

### Direito autoral e licenciamento (pesquisa 2026-07-24)

- **Ser grátis/PWYW no marketplace não é licença de redistribuição.** O autor mantém copyright integral; free/PWYW é só modelo de preço de venda, não licença aberta (OGL/ORC é coisa totalmente separada e cobre só texto de regras/mecânica, não o PDF/arte/diagramação do produto).
- **Linkar ≠ copiar, do ponto de vista de risco legal.** Hospedar cópia do PDF é infração direta; linkar pro produto original (sem paywall na origem) é geralmente seguro — mas não é zero-risco incondicional (há precedente de linkar-com-intenção-comercial-de-lucro sendo tratado como infração; Artifício é sem fins lucrativos, o que reduz mas não zera o risco).
- Nenhuma fonte confirma nem descarta se algum ToS proíbe **link automatizado** (deep-linking) especificamente — a preocupação de copyright encontrada recai sobre hospedar cópia, não sobre indexar com link de saída.
- **Lacuna explícita não resolvida:** implicação jurídica precisa de licenças abertas (OGL/ORC) sobre redistribuição de arquivo completo vs. só texto de regras não foi resolvida com fonte primária — tratar como risco jurídico aberto, registrado no backlog, não fingir resolvido.

### Idioma — estado real do produto hoje (auditoria 2026-07-24, verificado no código)

- `download_material_metadata.language` (`apps/downloads/database/migration_002_download_material_metadata.sql:15`): `VARCHAR(20)`, **nullable, sem default, sem `CHECK`**. Confirmado por listagem completa de `CHECK`/`CONSTRAINT` em todas as 21 migrations de `apps/downloads/database/*.sql` — nenhuma restringe `language`.
- Validação em `apps/downloads/backend/src/routes/materialMetadata.ts:20`: `z.string().trim().max(20).nullable().optional()` — aceita qualquer string, não é enum. `materials.ts` (rota principal de criação) **não trata `language` em nenhum ponto**.
- `moderation.ts` não lê nem valida `language` — moderador humano hoje não tem nem sinal técnico de idioma pra conferir.
- Frontend: `MaterialListFilters` (`apps/downloads/frontend/src/types/material.ts`) não tem campo de idioma; `useMaterialsCatalog.ts` não monta esse parâmetro; comentário no próprio `materials.ts:28-32` confirma explicitamente que filtro de idioma "fica para quando a UI de filtro exigir o join" — nunca implementado. Nenhuma exibição de idioma em card (`MaterialCard.tsx`) ou ficha (`MaterialPage.tsx`) hoje.
- SEO: `apps/downloads/frontend/index.html` tem meta description/og genéricas ("Catálogo gratuito de materiais de RPG...") sem menção a idioma; `og:locale=pt_BR` é metadado técnico de locale da página, não declaração de escopo de conteúdo.
- Não existe, em nenhuma rota do frontend (`App.tsx:47-76`), página `/termos`, `/licenca`, `/sobre`, `/como-funciona` ou equivalente — zero página institucional pública hoje. A spec 061 (linha 834) só menciona "aceite das declarações" como campo de formulário (checkbox + versão + timestamp), nunca implementado no schema (`types.ts` não tem `terms_version`/`terms_accepted_at`), e nunca como página de conteúdo.
- Conclusão: sem esta spec, o mecanismo que mais provavelmente introduziria material não-português em massa — o próprio scraper — rasparia itch.io/DriveThruRPG/DMs Guild (majoritariamente inglês) sem filtro nenhum. A trava de idioma **precisa** nascer junto com o scraper, não depois.

### Precedente/ferramentas conhecidas

- Nenhum agregador conhecido e ativo de conteúdo grátis/PWYW de RPG do DriveThruRPG/DMs Guild foi encontrado.
- Projetos scraper de itch.io existentes (ex. `0xDevansh/itch-scraper`) extraem metadado geral mas **não** extraem preço/status free-PWYW — não há solução pronta de "detectar preço programaticamente" pra reusar.
- Nenhum caso documentado publicamente de cease-and-desist/bloqueio de IP contra scraper terceiro de itch.io/DriveThruRPG foi encontrado — ausência de achado não é confirmação de que nunca aconteceu; o 403 observado nesta própria sessão já é evidência direta e suficiente de bloqueio ativo no domínio OneBookShelf.

### Bibliotecas — pesquisa dedicada 2026-07-24, escolha justificada

**Detecção de idioma:**
- **`itch.io` já tem filtro nativo `lang-pt-BR`** (`itch.io/games/lang-pt-BR`, combinável com `/genre-rpg/lang-pt-BR`) — metadado declarado pelo autor na própria plataforma, não inferido. Pra essa fonte, o filtro nativo é a fonte primária de decisão de idioma; detecção própria vira só validação secundária (autor pode marcar errado).
- Pra fontes sem esse metadado nativo (DriveThruRPG/DMs Guild e a maioria dos sites BR novos, que são pt-BR "by design" mas sem declaração formal): `franc-min` (npm, ESM-only, sem binário nativo, cobre `pt`) é a escolha — leve, mantido (atividade recente no monorepo, mar/2026), mas com ponto fraco confirmado: perde confiabilidade em textos curtos (título de produto) pra distinguir `pt` de `es`. Mitigação: concatenar título+descrição completa antes de rodar detecção (nunca só o título isolado), e tratar confiança baixa como `skipped_parse_error` (rejeita na dúvida), nunca como aprovação.
- **DeepSeek como segunda opinião pontual** (ver decisão de escopo acima) só entra pros casos que `franc-min` classificar como baixa confiança — não roda em todo item.

**Headless/anti-detecção (Modo 2) — decisão 2026-07-24: usar os dois engines em cascata, não escolher um só ainda:**
- `puppeteer-extra-plugin-stealth` e `playwright-extra` (stealth): **descartados** — sem release há ~3 anos, tratados como deprecated pela própria comunidade, múltiplas issues confirmam falha documentada contra Cloudflare atual (a proteção evoluiu, o plugin não).
- **`patchright`** (`Kaliiiiiiiiii-Vinyzu/patchright-nodejs`) — Modo 2a: fork/patch ativo do Playwright (não plugin), release recente confirmada nesta pesquisa, acompanha releases do Playwright upstream automaticamente, remove os leaks óbvios de automação (CDP `Runtime.enable`, flag `--disable-blink-features=AutomationControlled`). Só Chromium. Mais rápido, tentado primeiro.
- **`Camoufox`** (`daijro/camoufox`) — Modo 2b: fork/patch do motor Firefox (nível C++, não JS injection), fingerprint via `BrowserForge`, mais robusto contra detecção de fingerprint que patchright, mas mais lento (dado de mercado: ~42s médio de bypass de Turnstile) e é Python (o resto do stack é Node/TS — precisa de processo separado + IPC/subprocess, não é lib importável direto no backend). Tentado quando 2a falha.
- **Estratégia:** os dois engines compartilham a mesma interface de adapter (`HeadlessEngine`: `fetchRendered(url): Promise<{html, status}>`), o pipeline tenta 2a primeiro (mais barato/rápido), cai pra 2b se 2a falhar, e registra em `download_scraper_run`/log **qual engine teve sucesso** por fonte — isso vira dado real (não achismo) pra decidir, depois de rodar contra DriveThruRPG/DMs Guild de verdade, se vale manter os dois, ficar só com um, ou que nenhum resolve (aí é 100% Modo 3). Não duplicar lógica de parsing/extração entre os dois — só o motor de renderização (`fetchRendered`) muda, o parser de HTML resultante é o mesmo código pra qualquer engine.
- **FlareSolverr está arquivado desde dezembro/2025** (confirmado: aviso oficial no repo, "none of the captcha solvers work") — não é mais opção viável, apesar de ser a resposta historicamente mais citada. Não usar, nem forks de comunidade sem manutenção confirmada.
- **Conclusão honesta, sem forçar otimismo:** nenhuma ferramenta open source dá garantia real contra Cloudflare Turnstile moderno. Isso reforça — não substitui — a necessidade do Modo 3 (browser real do mantenedor) pra DriveThruRPG/DMs Guild. Se Modo 2a e 2b falharem em teste real contra esses dois domínios, não é bug a "consertar", é resultado esperado documentado (mesmo critério de aceite 9c já registrado).

**Achado de segurança (fora do pedido original, reportado por obrigação de reporte de achado suspeito):** durante a pesquisa apareceram dois repositórios GitHub com padrão de golpe/typosquat visando agentes de IA — `jo-inc/camofox-browser` (nome quase idêntico a `daijro/camoufox`, contém `AGENTS.md` no repo, padrão clássico de prompt-injection mirando agentes que leem esse tipo de arquivo automaticamente) e `CloakHQ/CloakBrowser` (claims absolutos + stars possivelmente infladas pra repo muito novo). **Nenhum dos dois foi usado ou seguido nesta pesquisa.** Registrar como alerta permanente: qualquer dependência nova de scraping/anti-bot recomendada por busca deve ser conferida contra o repo oficial correto (conferir organização/autor, não só nome parecido) antes de instalar.

### Fontes ampliadas — candidatos brasileiros confirmados (pesquisa 2026-07-24)

Pedido do mantenedor de ampliar a lista de sites além de itch.io/DriveThruRPG/DMs Guild. Candidatos abaixo foram **verificados existir de fato** via busca/fetch (nomes do pedido original tipo "Systema Old School", "Você e o RPG", "Segredos de RPG", "Traduzindo RPG", "Retropunk" **não foram confirmados como sites reais** — provavelmente confusão de nome, não incluídos):

| Fonte | URL | Filtro grátis/PWYW nativo | Filtro idioma nativo | Observação |
|---|---|---|---|---|
| **RPG Grátis** | rpggratis.wordpress.com | Critério de inclusão do próprio índice é gratuidade | Site 100% pt-BR | Não hospeda arquivo — é índice/descoberta, linka pra página do autor. Fonte de **descoberta**, scraper precisaria seguir o link de saída, não parar no índice. |
| **Grimórios & Dados** | grimorios-e-dados.itch.io | PWYW via Pix voluntário (fora do mecanismo nativo itch) | Maioria pt-BR confirmado | Dentro do domínio itch.io — mesma política de robots.txt/acesso do itch. |
| **OPERA RPG** | operarpg.com.br/downloads/aventuras/ | Sem licença/gratuidade explícita na página — **checar antes de scrapear em massa** | Site 100% pt-BR | Domínio próprio pequeno, sem dado de robots.txt coletado nesta pesquisa. |
| **RedeRPG** | rederpg.com.br | Seção `/downloads/` dedicada | Site 100% pt-BR | **Exige cadastro/login pra baixar** — scraping simples não passa da autenticação; fora de escopo do MVP (mesmo problema técnico de DriveThruRPG, mas por login, não WAF). |
| **Catarse** (crowdfunding) | catarse.com.br | Não tem filtro nativo — material grátis pós-campanha geralmente é distribuído fora da própria página | Plataforma BR nativa | Serve como fonte de **descoberta de projeto**, não hospedagem — mesmo padrão do RPG Grátis. |
| **Newton Rocha / NitroDungeon** (blog) | newtonrocha.wordpress.com | Downloads diretos de PDF linkados no blog | pt-BR nativo | WordPress.com, sem indício de bloqueio; fonte de descoberta+link direto. |

**Conclusão prática:** a maioria dos candidatos BR novos não tem filtro de preço/idioma nativo tão limpo quanto itch.io — mas são pt-BR "by design" (site inteiro é em português), então o filtro de idioma nessas fontes vira confirmatório, não decisório. Duas categorias distintas de adapter serão necessárias: (a) fontes que **hospedam listagem própria com preço visível** (itch.io, Grimórios & Dados, OPERA RPG) — adapter de descoberta+extração direto; (b) fontes que são **índices/agregadores que linkam pra outro lugar** (RPG Grátis, Catarse, Newton Rocha) — adapter de descoberta que segue o link de saída antes de confirmar preço/idioma, adiciona uma camada de indireção que os adapters de itch.io/DriveThruRPG não têm. RedeRPG fica fora do MVP (exige login).

## Escopo

### 1. Estratégia de acesso em camadas (sem caminho feliz — bloqueio é esperado, não exceção)

O scraper precisa de 4 modos de acesso, escalando conforme bloqueio, cada um com critério explícito de quando usar o próximo:

- **Modo 1 — fetch HTTP simples** (`fetch` nativo, sem browser). Tentativa padrão pra itch.io (sem bloqueio observado) e pra fontes BR novas sem anti-bot conhecido (RPG Grátis, Grimórios & Dados, OPERA RPG, Catarse, Newton Rocha). **Esperado falhar com 403 direto contra DriveThruRPG/DMs Guild** — não é fallback eventual, é o resultado default já confirmado nesta investigação.
- **Modo 2a — headless Chromium via `patchright`** (fork ativo do Playwright, sem os leaks de automação do Playwright puro). Tentativa seguinte quando Modo 1 recebe 403/challenge. Mais rápido que 2b, tentado primeiro.
- **Modo 2b — headless Firefox via `Camoufox`** (fork do motor Firefox, fingerprint via `BrowserForge`, mais robusto mas mais lento — Python, processo separado do backend Node). Tentado quando 2a falha. Mesmo assim pode não passar de um WAF de edge que bloqueia por IP/ASN de datacenter antes do desafio JS — nenhum dos dois engines tem garantia contra Cloudflare Turnstile moderno (ver achados de pesquisa acima). O pipeline registra qual dos dois (se algum) teve sucesso por fonte, dado real pra decidir depois se mantém os dois, fica só com um, ou nenhum resolve.
- **Modo 3 — script local fora da IA, rodando na máquina do mantenedor com o Chrome/Firefox real dele.** Decisão explícita do mantenedor (2026-07-24): **não** usar `claude-in-chrome`/Claude em loop de execução — IA consome caro demais pra scraping repetitivo item-a-item. É uma ferramenta separada (script Python ou Node standalone, com Playwright/Puppeteer apontando `--user-data-dir` pro profile real do Chrome do mantenedor, sessão já logada) que Claude Code ajuda a **construir uma vez**; quem **executa**, quando quiser (manual, sob demanda), é o mantenedor sozinho, sem custo de IA por rodada. Quando Modo 1/2a/2b falham (IP de servidor/datacenter bloqueado por WAF), esse script roda localmente e:
  - não é serviço/cron no backend de produção — é ferramenta local, disparada manualmente;
  - produz um payload (JSON) de itens raspados no formato esperado por `POST /admin/scraper/ingest`, reusando o mesmo pipeline de criação/dedupe/filtro-de-idioma do modo automático;
  - fica documentado como *tier 4*, não como plano principal — o objetivo é que Modo 1/2a/2b resolvam itch.io e as fontes BR sem anti-bot; Modo 3 é o fallback pra quando WAF bloqueia infra de servidor de qualquer engine headless.
  - **Risco explícito:** rodar scraping a partir de sessão logada do mantenedor levanta a possibilidade de a conta pessoal do mantenedor no marketplace ser suspensa/banida se detectada como automação — isso precisa estar documentado como risco aceito, não escondido. Critério de aceite cobre isso abaixo.

### 2. Schema novo

- `download_material` ganha `source_platform` (enum: `itch_io | drivethrurpg | dms_guild | rpg_gratis | grimorios_e_dados | opera_rpg | catarse | newton_rocha | manual`, default `manual` pra não quebrar registros existentes — lista extensível, adicionar fonte nova é migration futura, não redesenho) e `source_url` (URL original raspada, nullable, só preenchido quando `source_platform != manual`) e `source_scraped_at` (timestamp da última raspagem que confirmou o item).
- Tabela nova `download_scraper_run` — audita cada disparo (manual ou cron): `id`, `triggered_by` (user_id do admin, nullable quando disparado por cron), `source_platform`, `mode` (`fetch|headless_patchright|headless_camoufox|local_browser`), `trigger_kind` (`manual|cron`), `status` (`running|completed|failed`), `items_found`, `items_created`, `items_skipped_duplicate`, `items_skipped_price_changed`, `items_skipped_not_portuguese`, `error_detail`, `started_at`, `finished_at`.
- Tabela nova `download_scraper_item_log` — 1 linha por item processado numa run: `id`, `run_id` (FK `download_scraper_run`), `source_url`, `outcome` (`created|skipped_duplicate|skipped_price_not_zero|skipped_parse_error|skipped_blocked|skipped_not_portuguese`), `material_id` (FK nullable, preenchido quando `outcome=created`), `raw_price_captured` (texto livre — o que o scraper leu na página, pra auditoria/debug), `detected_language` (texto livre — código/idioma que o detector automático leu, mesmo quando descartado, pra auditoria), `created_at`. Existe pra responder "por que este item específico não entrou" sem precisar reprocessar.
- `download_link_check` (P10, já existente) ganha `source_platform`/`is_scraper_origin` (bool) — permite o link-checker saber que aquele material veio de scraper e aplicar a regra de suspensão automática por mudança de preço (item 4 abaixo), sem precisar duplicar lógica.
- **`download_material_metadata.language` deixa de ser `VARCHAR(20)` livre (D119):** migration adiciona `CHECK (language = 'pt')` (enum de valor único nesta fase — sem multilíngue no MVP) e `NOT NULL` com backfill de registros existentes (auditar quantos hoje têm `language` nulo/diferente de `pt` antes de aplicar `NOT NULL` — se houver dado legado divergente, vira decisão do mantenedor: backfill pra `pt` ou expurgo, não assumir). Validação Zod correspondente em `materialMetadata.ts` (e em `materials.ts`, que hoje nem trata o campo) vira `z.literal('pt')`.

### 3. Filtro de idioma no scraper (D119 — pétreo, aplicado antes de qualquer outra checagem)

- Todo item candidato passa por detecção automática de idioma (biblioteca de detecção real, ex. `franc` ou equivalente — decisão de implementação em `plan.md`) sobre título+descrição raspados **antes** de checar preço/dedupe.
- Item detectado como não-português: `outcome=skipped_not_portuguese`, `detected_language` gravado no log, **nunca cria `download_material`**. Não existe modo "publica mesmo assim marcado como não-pt" — item reprovado nesse filtro é descartado da run, ponto.
- **Cenário obrigatório de teste:** produto com título em inglês mas descrição parcialmente em português (comum em itens traduzidos por fã, com metadata mista) — detector roda sobre texto combinado; limiar de confiança e desempate ficam definidos em `plan.md`, mas o padrão é **rejeitar na dúvida** (falso negativo de "é português" é pior que perder um item válido).
- **Cenário obrigatório de teste:** item cujo título é só o nome próprio do produto (sem palavras detectáveis, ex. título em nome fictício) — detector não tem sinal suficiente; tratado como `skipped_parse_error` (não confirma português, então não publica), nunca como aprovação por omissão.
- Esse filtro é aplicado igualmente em Modo 1/2/3 (fetch, headless, browser local) — é parte do pipeline comum de ingestão (`scraperIngest.ts`, ver `plan.md`), não lógica duplicada por adapter.

### 4. Dedupe (sem caminho feliz — mesmo item aparece de novo)

- Chave de dedupe: `(source_platform, source_url)` único. Antes de criar, scraper consulta se já existe `download_material` com essa combinação.
- **Cenário obrigatório de teste:** mesma run processa a mesma URL duas vezes (paginação sobreposta, retry) — segunda ocorrência é `skipped_duplicate`, não erro, não duplicata.
- **Cenário obrigatório de teste:** item já existe mas mudou de slug/URL no marketplace de origem (reposted) — como o scraper não tem forma confiável de saber que é "o mesmo produto" sob URL nova, trata como item novo (aceita duplicata potencial de conteúdo; mitigação fica pra revisão humana futura via denúncia, D105) — documentar essa limitação explicitamente, não fingir resolvido.

### 5. Re-checagem de preço e suspensão automática (reusa P10/link-checker)

- Job periódico já existente do link-checker passa a, para materiais com `source_platform != manual`, re-visitar `source_url` e comparar preço atual contra "grátis/PWYW-zero" da captura original.
- Se preço mudou pra pago (deixou de ter opção zero real): material muda pra `editorial_state=withdrawn` automaticamente, evento registrado em `download_material_version` (histórico já existente), e-mail **não** é disparado pro autor (não existe autor humano — `creator_id` é o ator de sistema, ver item 5) mas o evento fica auditável.
- **Cenário obrigatório de teste:** marketplace bloqueia a re-visita (403 voltou) — o link-checker não pode concluir "virou pago" a partir de um bloqueio; precisa distinguir "confirmei que é pago agora" de "não consegui verificar" (`download_link_check.error_detail` populado, material continua publicado, mas fica marcado pra reforço de checagem — nunca deriva pra "suspenso" só por falha técnica de acesso).

### 6. Ator de sistema (`creator_id`)

- `download_creator` já suporta `user_id` nullable (crédito de autor terceiro sem conta) — mas aqui não é crédito de autor, é o próprio agente que cadastrou. Criar `download_creator` de sistema (`role=admin`, `display_name` tipo "Indexação automática", `user_id=NULL`) reusado por todo material de origem scraper — não inventar `creator_id` novo por item.
- Autoria real (nome do criador do produto original) vai nos metadados (`download_material_metadata.publisher_name`/`credits`), extraído da página raspada — nunca é confundida com o `creator_id`/dono técnico do registro.

### 7. Rota admin e disparo

- `POST /admin/scraper/run` — body `{ source_platform, mode }`. Síncrono ou fire-and-forget com polling por `GET /admin/scraper/run/:id`? **Decisão de implementação pendente de detalhamento em `plan.md`** (scraping de um marketplace inteiro pode levar minutos — rota não deve bloquear request HTTP; ver padrão fire-and-forget já usado na spec 083 pra e-mail).
- `POST /admin/scraper/ingest` — recebe payload JSON já coletado localmente (Modo 3, browser do mantenedor), mesmo pipeline de criação/dedupe do modo automático.
- Ambas exigem `role=admin` (não moderador — ação de maior impacto/risco que criação manual).

### 8. Rate-limit de saída (proteção contra o próprio Artifício ser bloqueado/banido)

- Scraper precisa de rate-limit próprio **contra o terceiro** (delay entre requests, não só contra abuso de entrada na própria API) — sem isso, uma run cria uma rajada de requests que acelera detecção/bloqueio.
- **Cenário obrigatório de teste:** run é cancelada/falha no meio (timeout, erro de rede) — próxima run não deve recomeçar do zero varrendo tudo de novo sem necessidade; usar paginação com checkpoint ou pelo menos logar até onde chegou (`download_scraper_run.items_found` parcial + status `failed` já cobre auditoria, mas retomada de onde parou é decisão de implementação a detalhar em `plan.md`).

### 9. Verificação cruzada de idioma na submissão humana (D119 — corrige o gap existente, não só o scraper)

- Fluxo de submissão manual (`materials.ts`/`materialMetadata.ts`) ganha a mesma verificação automática de idioma do conteúdo (título+descrição) do item 3, rodando **no momento da submissão** (draft→in_review) e reexecutada na moderação.
- Divergência entre `language='pt'` declarado pelo usuário e idioma detectado no conteúdo: bloqueia avanço pra `in_review`/publicação com mensagem clara, ou (decisão de implementação em `plan.md`) sinaliza alerta visível pro moderador — mas nunca aceita a auto-declaração sozinha como hoje.
- **Cenário obrigatório de teste:** usuário cadastra material com título/descrição em português mas o material em si (arquivo, fora do escopo de leitura automática) é noutro idioma — a verificação automática cobre só o texto submetido (título/descrição/metadados), não o conteúdo do arquivo linkado; isso é uma limitação a documentar explicitamente, não a fingir resolvida — moderação humana continua sendo a defesa final contra esse caso.

### 10. Frontend/busca pública — idioma deixa de ser invisível

- Filtro de idioma no catálogo público (`/catalogo`) deixa de ficar pendente de "quando a UI exigir o join" (comentário hoje em `materials.ts`) — como só existe `pt` nesta fase, o filtro em si é dispensável no MVP (não há o que filtrar), mas a **exibição** do idioma na ficha (`MaterialPage.tsx`) e o texto de apresentação do catálogo devem declarar "material em português" como característica do catálogo, não ficar omissos.
- `MaterialListFilters`/`useMaterialsCatalog.ts` recebem o campo preparado (mesmo que hoje só aceite `pt`) pra não repetir o mesmo "fica pendente" quando o catálogo eventualmente virar multilíngue (fora de escopo desta spec, mas o campo não deve renascer com o mesmo problema de hoje).

### 11. SEO e página institucional pública de uso/licença (não existe hoje — nasce nesta spec)

- Auditoria confirmou: **nenhuma página institucional pública existe** em `apps/downloads/frontend` (nem `/termos`, `/licenca`, `/sobre`, `/como-funciona`) e nenhuma spec anterior (061/070-076) planejou uma — só existia menção a "aceite de termos" como campo de formulário, nunca implementado. Por pedido explícito do mantenedor, esta spec cria a página que faltava.
- Nova rota pública `/sobre` (ou `/termos`, a definir em `plan.md` alinhado com D107/convenção de rotas já fechada em Downloads) com conteúdo real declarando: (a) catálogo é só material em português — regra pétrea D119, sem exceção; (b) catálogo é hub de descoberta/redirecionamento, nunca hospeda arquivo pago (reforça D095/D102 pro usuário final); (c) como funciona o scraper (transparência: parte do catálogo é indexada automaticamente de itch.io/DriveThruRPG/DMs Guild, sempre linkando pro produto original); (d) diretrizes de submissão humana (evidência de gratuidade, D100).
- Meta description/og:description do app (`apps/downloads/frontend/index.html`) deixam de ser genéricas — passam a declarar "catálogo gratuito de RPG em português" explicitamente, não só "catálogo gratuito de materiais de RPG".
- Nav/rodapé do app ganha link pra essa página nova (reuso do shell compartilhado, sem inventar componente novo).

## Fora de escopo (nesta spec)

- Baixar/hospedar cópia do arquivo (D102/D106 continuam valendo sem exceção).
- Scraping de sites além dos listados nesta spec (itch.io, DriveThruRPG, DMs Guild, RPG Grátis, Grimórios & Dados, OPERA RPG, Catarse, Newton Rocha) — adicionar fonte nova é spec/débito futuro, migration de enum, não redesenho.
- RedeRPG — exige cadastro/login, scraping automatizado bateria em autenticação; fora do MVP.
- Cron automático pra fontes com anti-bot confirmado (DriveThruRPG/DMs Guild) — só manual/Modo 3 pra essas.
- Resolver a lacuna jurídica de OGL/ORC sobre redistribuição de arquivo completo — registrar como débito, não bloquear implementação do scraper (que só linka, nunca copia).
- Suporte multilíngue (catálogo em outros idiomas além de português) — D119 é `pt`-somente nesta fase; schema/UI não devem se preparar pra "idioma B" além de deixar o campo como enum extensível no futuro.
- Detecção de idioma do **arquivo/conteúdo do material em si** (só título/descrição/metadados submetidos são verificados automaticamente) — moderação humana continua sendo a defesa final contra material com metadado em português mas arquivo em outro idioma.
- Reformular o fluxo de submissão humana existente além da verificação de idioma (spec 061/070-076/083 continuam valendo) — este scraper é um segundo fluxo de entrada, paralelo, não substitui o manual.

## Critérios de aceite

1. `POST /admin/scraper/run` com `source_platform=itch_io` executa Modo 1 (fetch simples), encontra itens da página `/games/free`, filtra os que são realmente `$0`/PWYW-com-opção-zero, cria `download_material` (`access_kind=external_link`, `editorial_state=published`, `source_platform`/`source_url`/`source_scraped_at` preenchidos) para os itens novos, e regista `download_scraper_run`+`download_scraper_item_log` completo (inclusive itens pulados e por quê).
2. Mesma run rodada duas vezes não duplica material — segunda run só produz `skipped_duplicate` pros itens já indexados.
3. `POST /admin/scraper/run` com `source_platform=drivethrurpg` (ou `dms_guild`) tenta Modo 1, recebe 403, escalona pra Modo 2a (patchright), depois Modo 2b (Camoufox) se 2a falhar — teste cobre o caso de ambos falharem (WAF bloqueia mesmo com fingerprint), registrando `download_scraper_run.status=failed` com `error_detail` claro e `mode` indicando o último tentado, sem quebrar o processo, sem criar material nenhum a partir de dado que não confirmou preço.
4. `POST /admin/scraper/ingest` aceita payload coletado via Modo 3 (script local fora da IA, rodando no PC do mantenedor com Chrome/Firefox real dele) e roda o mesmo pipeline de dedupe/criação/filtro-de-idioma do modo automático — sem endpoint/rota paralela duplicando a lógica de criação.
15. `source_platform=itch_io` tem job de cron diário funcionando sem intervenção manual (`trigger_kind=cron`); `source_platform=drivethrurpg`/`dms_guild` **não têm** cron — só disparo manual — teste confirma que o agendador não inclui as fontes com anti-bot conhecido.
16. Fontes BR novas (RPG Grátis, Grimórios & Dados, OPERA RPG, Catarse, Newton Rocha) têm pelo menos um adapter funcional em Modo 1 (fetch simples) — RedeRPG fica fora do MVP (exige login, documentado como fora de escopo).
5. Job de re-checagem de preço (extensão do link-checker P10) roda contra material `source_platform != manual`, muda `editorial_state=withdrawn` quando confirma preço pago, e **não** muda o estado quando só falha em acessar o destino (bloqueio ≠ confirmação de mudança de preço) — os dois casos são testados separadamente.
6. Nenhum material criado por scraper tem `access_kind` diferente de `external_link` — teste explícito garantindo que não existe caminho de código que permita `managed_upload` a partir do fluxo de scraper.
7. `download_creator` de sistema é criado uma única vez (idempotente) e reusado por todo material de scraper — não há um `download_creator` novo por item raspado.
8. `pnpm verify:api`, lint, tsc e testes passam nos 3 projetos tocados (`apps/downloads/backend`, e qualquer pacote novo de scraping se extraído).
9. Documentação da spec registra explicitamente, na seção de risco: (a) lacuna jurídica de OGL/ORC não resolvida — vira item de `specs/backlog.md`; (b) risco de suspensão de conta pessoal do mantenedor ao usar Modo 3 — aceito conscientemente, não escondido; (c) qualquer bloqueio 403 do DriveThruRPG/DMs Guild em Modo 1/2 é resultado esperado documentado, não falha de implementação a "consertar".
10. Item scrapeado detectado como não-português nunca cria `download_material` — teste explícito cobrindo título em inglês, título em português com descrição em inglês, e item ambíguo (sem sinal suficiente); todos os três casos resultam em log de `skipped_not_portuguese`/`skipped_parse_error`, nunca em `outcome=created`.
11. `download_material_metadata.language` no schema tem `CHECK (language = 'pt')` + `NOT NULL`, e nenhuma rota (`materials.ts`/`materialMetadata.ts`) aceita valor diferente de `'pt'` — teste de rota confirma rejeição de payload com `language` diferente de `pt`.
12. Submissão humana com divergência entre `language` declarado e idioma detectado no título/descrição é bloqueada/sinalizada antes de publicar — teste cobre o caso de declaração falsa (`language='pt'` com conteúdo em inglês).
13. Página institucional pública nova existe, é acessível pela navegação do app, e seu conteúdo real (não placeholder) declara a regra de só-português, a natureza de hub/redirecionamento do catálogo, e a existência do scraper — validado por teste de rota/render, não só por leitura de código.
14. Meta description/og:description de `apps/downloads/frontend/index.html` mencionam explicitamente "português"/"em português" — não ficam genéricas como hoje.

## Dependências

- Mantenedor autorizou instalar qualquer dependência necessária desta spec (2026-07-24) — segue a lista concreta escolhida por pesquisa, não mais pergunta em aberto:
  - `patchright` (Node) — Modo 2a, headless Chromium anti-detecção.
  - `camoufox`/`camoufox-python` — Modo 2b, headless Firefox anti-detecção (Python, processo separado — avaliar em `plan.md` se roda via subprocess/IPC a partir do backend Node, ou como serviço auxiliar próprio).
  - `franc-min` (Node) — detecção de idioma determinística, fallback pras fontes sem metadado nativo de idioma.
  - Nenhuma dependência nova pra itch.io (usa filtro nativo `lang-pt-BR` + fetch simples).
- Reusa `download_link_check`/link-checker (P10) já existente — não cria mecanismo de verificação de saúde paralelo.
- Reusa padrão fire-and-forget + rate-limit já estabelecido na spec 083.
- Reusa infraestrutura multi-provider de IA da spec 052 (DeepSeek) pra desempate pontual de idioma de baixa confiança — sem criar integração nova, adapter já existe.
- Modo 3 (script local fora da IA) roda com Playwright/Puppeteer + `--user-data-dir` do profile Chrome real do mantenedor — não usa `claude-in-chrome`/MCP de browser em loop de execução (só na fase de construção da ferramenta, uma vez, com Claude Code).
- **Alerta de segurança registrado** (ver achados acima): antes de instalar qualquer dependência de scraping/anti-bot, confirmar que o pacote/repo é o oficial (organização/autor corretos) — pesquisa encontrou repos com padrão de typosquat visando agentes de IA (`jo-inc/camofox-browser` imitando `daijro/camoufox`).
