# Plan 102 — Recuperação de indexação e ranking

Complementa `spec.md` (evidência e critérios de aceite). Aqui fica **como executar**:
ordem, decisão técnica por frente, e o que cada task precisa saber antes de começar.

---

## 1. Ordem de execução e por quê

**Cinco frentes**, listadas na tabela abaixo (a versão anterior dizia "três" e não
batia com as próprias linhas). Elas são independentes **entre si** — dentro de cada
uma há ordem própria, registrada no `tasks.md`. A ordem proposta segue severidade
medida, não conveniência de implementação.

| Ordem | Frente | Achado | Por que nesta posição |
|---|---|---|---|
| 1ª | `mesas` — soft-404 | C, B | Google **exclui** soft-404 da indexação ("Not indexed" no Search Console) e ele drena o crawl budget **do hostname `mesas.`**. Severidade própria, medida: 51 de 92 URLs do sitemap. |
| 2ª | `site` — 301 legados | D | Recupera a autoridade do WordPress. É o que melhor explica o relato do mantenedor (Chris Perkins). Redirect permanente não perde PageRank. |
| 3ª | `site` — canonical | A | Heurística, não bloqueio duro. Correção barata, mas menor impacto isolado. Agrupa com a 2ª por tocar o mesmo app. |
| 4ª | `mesas` — HTML-first + schema | E | Competitividade estrutural. Depende de decisão de arquitetura (§5); é a maior das frentes. |
| 5ª | Facetas + guards | G | Prevenção. Só depois do verde das anteriores. |

**A ordem é invertível.** Se o mantenedor priorizar o blog por valor de negócio,
2ª/3ª sobem sem prejuízo técnico — as frentes não se bloqueiam. Registrado como
inferência a confirmar em `spec.md` §3.

---

## 2. Frente 1 — `mesas`: soft-404 e divergência sitemap/SSR

### 2.1 Decisão técnica: fonte única de visibilidade

O defeito raiz é **duas definições de "mesa visível" no mesmo backend**:

```
routes/sitemap.ts:10   status='active' AND archived_at IS NULL
routes/og.ts:226-230   status='active' AND !archived_at AND !isImportedTableExpired()
```

Isso é exatamente o que `AGENTS.md` §"Compartilhado por padrão" chama de defeito:
mesma regra escrita duas vezes, divergindo em silêncio. A correção **não** é
copiar o filtro para o sitemap — é extrair a regra para um lugar só e os dois
consumirem.

`utils/tableVisibility.ts` já existe e já hospeda `isImportedTableExpired`. É o
destino natural: um predicado SQL (para o `where` do sitemap) e um predicado de
objeto (para o SSR), ambos derivados da mesma definição, com teste que trava a
equivalência entre os dois.

**Solução dinâmica, não caso particular** (§Regras Gerais de Código): nada de
`if (origin === 'imported')` espalhado. A regra vive no helper; o próximo
consumidor herda correto.

### 2.2 Decisão técnica: status HTTP do soft-404

`routes/og.ts:232-238` responde `res.status(200)` para mesa inexistente ou
expirada, com canonical auto-referente. Duas correções:

1. **Status real.** Mesa que nunca existiu → `404`. O HTML pode continuar bonito
   (a documentação do Google é explícita: página de erro customizada não exige 200).
2. **Sem canonical auto-referente** na resposta de erro — declarar-se canônica
   sendo inexistente é o pior dos dois mundos.

**Mesa expirada — DECIDIDO (2026-09-11): `410 Gone` com página útil.** Slug
inexistente devolve `404` (T1.2). Raciocínio completo e aceite: `tasks.md` T1.3.

| Opção | Efeito no Google | Efeito no usuário | Veredito |
|---|---|---|---|
| `404` | Sai do índice | Link antigo → erro | Correto, mas mistura "slug errado" com "mesa encerrada" |
| **`410 Gone`** | Sai do índice (Google trata **igual** a 404) | Página lista mesas vigentes do mesmo sistema | **Escolhido** |
| `301` para listagem do sistema | **Soft-404** — Mueller nomeia redirect de item expirado para categoria | Lista genérica | Descartado por medição |

O `301` caiu por dado, não por gosto: das **47** mesas expiradas em produção,
**0** têm outra mesa vigente do mesmo mestre — não existe destino "essencialmente
equivalente", que é a condição de mercado para 301. Redirecionar para a listagem do
sistema recriaria o soft-404 que esta spec existe para eliminar. Idade 6–27 dias
também descarta o argumento de preservar autoridade acumulada.

`410` em vez de `404` é escolha de **semântica**, não de velocidade (*"All `4xx`
errors, except `429`, are treated the same"*): separa "mesa existiu e encerrou" de
"slug errado", mantendo o Search Console legível. A camada de UX (corpo com mesas do
mesmo sistema, título da mesa encerrada, busca) é obrigatória — status correto e
página prestativa não são excludentes.

### 2.3 Sitemap

Com o helper unificado, o sitemap passa a excluir as 51 expiradas automaticamente.
Medição esperada: 92 URLs → ~41. Não é perda — são URLs que já não serviam
conteúdo. Retirar sitemap ruim é ganho de crawl budget.

---

## 3. Frente 2 — `site`: 301 dos prefixos legados

### 3.1 Achado que simplifica tudo

Medido em produção:

```sql
SELECT count(*) FROM posts
 WHERE canonical IS NOT NULL
   AND regexp_replace(canonical,'^https?://[^/]+','') <> '/blog/'||slug||'/'
   AND canonical NOT LIKE '%/'||slug||'/';
-- 0
```

**Em todos os 105 casos, o slug final do canonical legado é idêntico ao slug
atual.** Só o prefixo mudou (`/noticias/`, `/dnd/`, `/blog/<cat>/`, etc.).

Consequência: o mapa de redirect é **derivável por regra**, não precisa de planilha
manual de 105 linhas. Regra única:

```
/<qualquer-prefixo>/<slug>/  →  301  →  /blog/<slug>/
```

Validada contra o conjunto real: 0 exceções. O `canonical` gravado é a fonte fiel
das URLs antigas do WordPress e serve para **gerar e testar** o mapa.

### 3.2 Onde implementar o redirect

**Decidido em 2026-09-11 (T2.1): nem Cloudflare, nem nginx — o mecanismo já existe
no repo.** A comparação "Cloudflare × container" que ocupava esta seção partia de uma
premissa falsa. Medido: o `site` tem um subsistema de redirect 301 completo e em
produção — tabela `redirects` (`db/migrations/001_init.sql:75-81`), repo
(`db/repo/redirects.ts`), cache (`server/redirect-cache.ts`), middleware que roda
antes do estático (`server/server.ts:291-296`) e CRUD no admin. Está ligado e
**vazio** (`SELECT COUNT(*) FROM redirects` → 0). Foi construído para este cutover:
*"Mapa de redirects 301 (slug/URL WP -> nova rota). Ativa só no cutover (D047)."*

Consequência: a F2 é `INSERT` em tabela + correção de dois defeitos no middleware
(barra final e query string, detalhados em T2.1), **não** mudança de infra. Não toca
`Dockerfile`, nginx nem Cloudflare, e portanto não dispara a trava de
`docs/agents/deploy-flow.md` §1. As aprovações nominais de infra saem da lista;
resta a do `INSERT` (T2.2).

### 3.3 Exigências do redirect (da pesquisa)

- **301 server-side**, não 302 — a mudança é permanente.
- **1:1 por URL**, nunca blanket para a home.
- **Sem cadeia**: `/noticias/x/` vai direto para `/blog/x/`, não passa por
  `/noticias/x` → `/noticias/x/` → `/blog/x/`. Atenção ao `trailingSlash: "always"`
  do Astro (`astro.config.mjs:19`), que pode introduzir um hop extra.
- **Manter por ≥ 1 ano.**

---

## 4. Frente 3 — `site`: canonical legado

### 4.1 Decisão: corrigir o dado, manter a capacidade de override

Medido: **0 canonicals apontam para domínio externo** — não há sindicação legítima.
Os 21 "corretos" são posts nascidos no stack novo, não override editorial. A coluna
inteira é resíduo de importação.

Mas o código tem um recurso legítimo: `[slug].astro:21` permite override editorial
via admin. **Não remover o recurso.** A correção é no dado, não na capacidade:

- **Limpar** os 105 canonicals divergentes (`UPDATE … SET canonical = NULL`), deixando
  o fallback correto assumir (`${SITE.origin}/blog/${post.slug}/`).
- **Corrigir a origem** no importador, para que reimportação não regrave o valor antigo.
- **Manter** o override para uso editorial futuro e deliberado.

O `UPDATE` é SQL write em produção: exige aprovação nominal + dry-run + rollback
(§Autorização). O `SELECT` que conta o antes/depois já está medido nesta spec.

### 4.2 Rebuild obrigatório

`posts.canonical` → `db/export.ts:66` → `src/data/posts.json` → build Astro → HTML.
Corrigir o banco **não muda produção** sem novo export + build + deploy. Registrar
como passo explícito: "Git atualizado ≠ prod atualizado" vale aqui também.

---

## 5. Frente 4 — `mesas`: HTML-first e schema estruturado

Frente nova, entrou por comparação com o MesaQuest (`spec.md` §2.5). É a maior das
quatro e a única que mexe em arquitetura — por isso a decisão de 5.1 vem antes de
qualquer código.

### 5.1 Arquitetura de renderização — DECIDIDA: SSR universal (caminho 2)

**Decisão do mantenedor, 2026-09-11:** *"o catálogo precisa ser sempre fresco"*.

Isso escolhe o **caminho 2, SSR universal**, e elimina SSG/prerender: HTML gerado no
build mostraria vaga preenchida como aberta até o rebuild seguinte. Esta plan já
previa o critério na versão anterior — *"o caminho 2 é defensável se o mantenedor
quiser contagem de vagas sempre fresca"* — e era exatamente o requisito que faltava.
A recomendação anterior do agente (caminho 1) pesava custo de implementação; frescor
do catálogo é informação que só o mantenedor tinha.

**O problema não é "falta schema".** É que o `mesas` serve HTML diferente por
user-agent (`nginx.conf:5-22` + `@og_proxy`), padrão que o Google deixou de
recomendar, chamando-o de contorno e não de solução. Três defeitos desta
spec são sintomas dessa escolha:

- **B** — sitemap e SSR divergem porque são dois caminhos distintos.
- **C** — o caminho do crawler tem tratamento de erro próprio, que devolve 200.
- **E** — a lista de user-agents está desatualizada: crawler de IA não está nela.

**Por que o caminho 3 (só ampliar a lista de UA) está descartado:** faria o sintoma
sumir sem corrigir a causa — o que `AGENTS.md` §Regras Gerais de Código proíbe
("solução dinâmica, não caso particular"). A lista voltaria a ficar velha no próximo
crawler novo, como já ficou.

**Pesquisa de 2026 que sustenta a urgência.** Nenhum dos crawlers de IA relevantes
executa JavaScript — GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Bytespider,
Meta-ExternalAgent. Eles buscam o HTML bruto e vão embora. Para todos, o `mesas` hoje
é página em branco. O Googlebot renderiza JS e por isso ainda indexa parte, mas:

- Google desaconselha dynamic rendering: *"Dynamic rendering is a workaround and
  not a recommended solution, because it creates additional complexities and resource
  requirements."* (verificado na fonte 2026-09-11; a página **não cita o ano 2022** —
  a versão anterior desta spec atribuía a data sem respaldo).
- **Claim removido em 2026-09-11 (revisão adversarial):** a versão anterior afirmava
  que "~92% das respostas de busca do ChatGPT vêm do índice do Bing", citando
  `asklantern.com`. A página é renderizada por JS e o fetch não devolveu conteúdo —
  **não foi possível verificar**. Era apoio lateral, não sustentava conclusão: o
  argumento de SSR se apoia no experimento do SEL 485228 (GPTBot rastreou 759 páginas
  do grupo HTML e **0** do grupo JS; ClaudeBot e PerplexityBot idem), esse sim medido.

Fontes consultadas em 2026-09-11:
- https://developers.google.com/search/docs/crawling-indexing/http-network-errors
  (*"All `4xx` errors, except `429`, are treated the same"* — 410 não deindexa mais
  rápido que 404; sustenta T1.3)
- https://www.searchenginejournal.com/the-essential-guide-to-managing-expired-content/318417/
  e https://www.botify.com/blog/expired-content-seo (301 só com substituto
  equivalente; redirect de item expirado para categoria = soft-404, por Mueller)
- https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/
  (experimento controlado, 30/10/2025: preço só em JSON-LD → **0 de 5** sistemas de
  IA extraíram; só HTML visível foi extraído. Sustenta T4.2 e recalibra T4.4)
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
  (alcance da ação manual: perde rich result, **não** afeta ranking)
- https://www.seroundtable.com/chatgpt-perplexity-structured-data-text-40862.html
  (experimento contrário — LLM tokeniza JSON-LD como texto cru, não como estrutura)
- https://searchengineland.com/google-no-longer-recommends-using-dynamic-rendering-for-google-search-387054
- https://www.asklantern.com/blogs/ai-crawlers-do-not-render-javascript
- https://searchoptimo.com/blog/do-ai-crawlers-render-javascript
- https://nuxtseo.com/learn-seo/spa-seo

**Medição que confirma no nosso app (2026-09-11):** ClaudeBot recebe **3.328 B** de
casca, sem `<title>` de mesa e sem `ld+json`, porque o `nginx.conf` não lista crawler
de IA nenhum.

**Escopo da obra — NÃO INICIADA.** Sair de Vite client-only (`react-router-dom` 7,
sem adapter SSR) para SSR universal mexe em entry point, data fetching e deploy.
Exige autorização nominal para começar.

**Precedente no monorepo:** o `site` roda Astro em modo estático na raiz. Serve de
referência de build/deploy, **não** de arquitetura para o `mesas` — o requisito de
frescor é diferente.

**Dependência para T4.2 (medida).** `og.ts` **não faz join com `table_contacts`**;
mesmo o HTML que hoje vai ao Googlebot não tem dado de contato, necessário para
`Offer`. E os normalizadores (`getWhatsAppUrl` em `apps/mesas/frontend/src/features/table/mappers/tableViewMapper.ts:79`,
`toSafeDiscordInviteUrl`) vivem só no frontend. Por §"Compartilhado por padrão",
sobem para pacote compartilhado — não se reimplementam no backend.

### 5.2 Schema — `Product`+`Offer` no `@graph`, sem `Event`

**Premissa anterior desta seção estava FALSA.** A versão de 2026-09-11 afirmava que
"o Google **exige** `VirtualLocation` para evento só-online". Verificado na fonte em
2026-09-11 (`developers.google.com/search/docs/appearance/structured-data/event`):
`eventAttendanceMode` e `VirtualLocation` **não aparecem na página**. Não são
exigidos — não são oferecidos. A regra citada era da flexibilização de março/2020
(COVID) e saiu da documentação.

O que a página diz hoje:

> "Virtual experiences with no real-world component aren't supported. Events must
> take place in a physical location."

> "Events that require membership, invitation or prior purchasing of a ticket for
> attending the event are ineligible for the event experience."

**Consequência medida:** o catálogo é **100% online** — `SELECT modality, COUNT(*)`
devolve `online | 168`, zero `presencial`, zero `hibrida` (2026-09-11). Logo
**nenhuma mesa do acervo é elegível a rich result de `Event`**, por duas razões
independentes: é virtual sem componente físico, e passa por seleção do mestre.

Isso **elimina** a opção "emitir `Event` só onde houver componente físico": cobriria
0 de 168 mesas.

**Decisão do mantenedor (2026-09-11, final): emitir só `Product`+`Offer`.** Houve
decisão intermediária de emitir `Event` assim mesmo (*"tudo que puder fazer pessoas
chegarem nos sites, é válido"*), sob a premissa de que crawlers de IA leem `Event`.
A premissa foi refutada por medição no mesmo dia; a decisão foi revista com os
estudos na mão. Raciocínio completo: `tasks.md` T4.4.

**A medição que virou a decisão.** Experimento controlado SearchVIU (30/10/2025 —
5 sistemas, 8 variantes de entrega do mesmo preço, 5 repetições cada): o preço
presente **só em JSON-LD** foi extraído por **0 de 5** sistemas (ChatGPT, Claude,
Perplexity, Gemini, Google AI Mode), antes e depois de indexar. O mesmo preço em
HTML visível foi extraído por 3 de 5. Conclusão textual: *"Current AI chatbots do NOT
use JSON-LD Schema Markup in direct retrieval"*. Ou seja, o público-alvo do `Event`
não o consome — o benefício que justificava o risco não existe na fase medida.

E o risco recai sobre o que funciona: ação manual de structured data **retira
elegibilidade a rich result** (não afeta ranking — `sd-policies`), logo ameaçaria o
próprio `Product`+`Offer`.

**Entrega: um `@graph` com um tipo.**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Product",
      "name": "<título>",
      "description": "<por mesa, ver T4.5>",
      "image": "<≥720px>",
      "offers": { "@type": "Offer",
                  "price": "<de price_value>", "priceCurrency": "BRL",
                  "availability": "<InStock|SoldOut, de slots_total/slots_filled>",
                  "url": "https://mesas.artificiorpg.com/mesas/<slug>" } }
  ]
}
```

**Regra pétrea: nenhum fato só no JSON-LD.** Preço, vagas e data têm de estar no
**HTML visível** da mesa. É o que os crawlers de IA leem (0 de 5 leram JSON-LD puro;
3 de 5 leram HTML visível) e é o critério pelo qual a ação manual é aplicada —
*"Don't mark up content that is not visible to readers of the page"* (`sd-policies`).
Markup que espelha a página não é punível e alcança IA; markup escondido falha nas
duas pontas.

**Onde o objetivo de busca generativa é atendido:** §5.1 (HTML-first/SSR, T4.2) e
`description` por mesa (T4.5) — não no tipo de schema. Sem SSR, nenhum schema
entrega nada para IA, porque nenhum crawler de IA executa JS em fetch direto.

**Se o catálogo ganhar mesa presencial** (hoje `online | 168`, zero presenciais),
`Event` volta a ser discutível — aí há componente real-world e a inelegibilidade cai.
Condição de reabertura e mapa `modality`→`eventAttendanceMode`: `tasks.md` T4.4.

**Regra de preço, por medição.** `price` sai de `price_value`/`price_type`, **nunca**
do rótulo do contato: "Ticket / Inscrição" aparece em 106 contatos, mas 101 dessas
mesas são `gratuita`. Derivar do rótulo geraria preço falso em 95% dos casos. Das 5
pagas, só 1 tem `price_frequency` — para as outras 4, não emitir frequência.

**Ordem obrigatória: schema depois de SSR (T4.1).** Medido: ClaudeBot recebe 3.328 B
de casca. Schema injetado por JS é invisível para crawler de IA — nenhum executa
JavaScript. Emitir schema antes do SSR entrega zero do objetivo desta seção.

### 5.3 `description` por mesa

Hoje toda URL do app repete a description institucional. O MesaQuest gera por mesa,
concatenando o que a pessoa de fato busca:

> `<sinopse truncada> | <sistema> • <modalidade> • <nível> • <preço> • <vagas>`

Os dados já existem no nosso schema (`tables`: `title`, `synopsis`,
`listing_excerpt`, `system_id`, mais preço/vagas). É montagem de string a partir de
campo existente, não coleta nova.

### 5.4 `robots.txt` e crawler de IA

Nosso robots é `User-agent: * / Allow: /` — tecnicamente já permite GPTBot e
ClaudeBot. **Permitir não basta**: eles não executam JS (medido em `spec.md` §2.5.2 e
sustentado por estudo da Vercel e experimento do Search Engine Land). O ganho real
vem do HTML-first de 5.1; nomear os bots no robots é cosmético por si só.

**Fechado em 2026-09-11: sim, queremos ser citados por busca generativa** — e a
pergunta sai daqui. Não é escolha em aberto: `spec.md` §2.5 registra a comparação
medida com o MesaQuest, e o próprio objetivo da spec é recuperar descoberta de
conteúdo. O que estava de fato em aberto era o *meio*, e ele já está decidido: HTML-
first (§5.1/T4.2) é o que entrega; nomear os agentes no `robots.txt` é o passo
complementar, executado em T4.6 na ordem T4.1 → T4.2 → T4.3 → T4.6.

A redação anterior devolvia ao mantenedor uma pergunta que a própria spec já
respondia — corrigido para não ser redecidido a cada retomada.

---

## 6. Frente 5 — facetas e guards

### 6.1 Facetas de filtro (`?system=`)

**Medido em 2026-09-11 (detalhe e aceite em `tasks.md` T5.1).** São **10 parâmetros**
serializados em `catalogFilters.ts:85-104`, com 1.269 sistemas cadastrados e apenas
**73** com mesa — 1.196 facetas de `?system=` renderizariam catálogo vazio. Decidido:
**canonical para a URL limpa em todas as facetas, nenhuma indexável.** Faceta com
demanda de busca comprovada viraria rota própria (`/sistemas/<slug>`), não parâmetro
indexável, e em outra spec.

### 6.2 Guards (impedir reintrodução)

Os três defeitos são invisíveis em code review e não quebram teste nenhum — é por
isso que sobreviveram. Guard automatizado em CI:

| Guard | O que trava |
|---|---|
| G-A | Nenhum post com canonical ≠ URL real (query sobre `posts.json` gerado) |
| G-B | Toda URL do sitemap devolve página real ao UA de crawler (equivalência sitemap↔SSR) |
| G-C | Slug inexistente sob `/mesas/` responde 404, nunca 200 |

G-B é o mais valioso: trava a classe inteira de "sitemap anuncia o que o SSR nega",
que é o defeito que ninguém veria sem esta investigação.

---

## 7. Validação

Conforme T0: durante as rodadas, **só o pacote afetado**
(`cd apps/mesas/backend && rtk pnpm vitest run <arquivo>`, `rtk tsc -p tsconfig.json --noEmit`).
Repo-wide (`test`/`lint`/`build`) só no fim, um comando por vez, quando o mantenedor
disser que não vem mais review.

Validação externa (produção), depois do deploy de cada frente:

```bash
# C1 — soft-404 corrigido
curl -s -o /dev/null -w '%{http_code}\n' https://mesas.artificiorpg.com/mesas/nao-existe-zzz   # espera 404

# B1 — sitemap ↔ SSR concordam
# varrer /sitemap.xml com UA Googlebot; esperar 0 ocorrências de "não encontrada"

# D1 — 301 sem cadeia
curl -sIL https://artificiorpg.com/noticias/chris-perkins-aposentadoria-dnd/   # 301 → 200, 1 hop

# A2 — canonical bate com URL servida
# varrer os 126 posts; esperar 0 mismatches (hoje: 105)

# F1 — crawler de IA recebe conteúdo real (hoje: 3.328 B de casca)
for ua in GPTBot/1.1 ClaudeBot/1.0 PerplexityBot/1.0; do
  curl -s -A "$ua" https://mesas.artificiorpg.com/mesas/<slug-valido> | wc -c
done   # espera HTML completo, equivalente ao do usuário

# F5 — schema no HTML inicial, não injetado por JS
curl -s -A GPTBot/1.1 https://mesas.artificiorpg.com/mesas/<slug> | grep -c 'ld+json'   # espera >= 1
```

Schema valida no **Rich Results Test** do Google (erro crítico = inelegível) e depois
no relatório de Eventos do Search Console — ideal é item válido subindo sem item
inválido subindo junto.

---

## 8. Ações que exigem aprovação nominal

Nenhuma foi executada. Listadas aqui para o mantenedor autorizar por ação, quando
cada task chegar (§Autorização — aprovação não acumula):

1. `UPDATE posts SET canonical = NULL …` nos 105 divergentes, em `site` — SQL write
   em produção.
2. `INSERT` de 105 linhas em `redirects`, em `site` (§3.2). Rollback por `DELETE`.
3. Deploy do `mesas` (mudança de status HTTP é comportamento observável; leva também
   o sitemap corrigido ao Google).
4. Deploy do `site` + rebuild/export.
5. Mudança de arquitetura de renderização do `mesas` para SSR (§5.1) — altera build e
   deploy. Decisão tomada em 2026-09-11; falta autorizar a execução, e ler
   `deploy-flow.md` se tocar `Dockerfile`/nginx.

**Saíram em 2026-09-11** (achado de auditoria): `Dockerfile`/nginx para os 301 e
mudança em Cloudflare. O mecanismo de redirect já existe no repo — a F2 é `INSERT`
em tabela, não mudança de infra.

---

## 9. Expectativa de recuperação

A pesquisa é consistente: reindexação leva **semanas a meses**; migrações menores,
1–3 meses. O deploy entrega a correção; o ranking volta no tempo do Google.

Isso importa para o combinado com o mantenedor: **não medir sucesso pela semana
seguinte ao deploy**. O sinal de que funcionou é a queda da contagem de "Rastreada,
mas não indexada" no Search Console e a saída das URLs de soft-404, não o tráfego
imediato.
