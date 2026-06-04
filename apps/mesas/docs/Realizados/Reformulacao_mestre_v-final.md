# Auditoria iterativa — Página pública do mestre

## A. Leitura técnica do print atual

**Print 1 — Hero**
- Banner ausente. Fundo liso azul, sem `banner_url` renderizando. O `<img src={profile.banner_url}>` ou não recebeu URL válida, ou a URL quebrou silenciosamente (sem `onError` para aplicar `hero-banner-gradient` de fallback).
- Avatar circular renderiza a foto corretamente.
- Apenas 1 badge ("Mestre"). `covil_verified` = false. OK.
- H1 "Viva aventuras com" + accent laranja "Faren Ravirar". OK.
- Bio renderiza **como parágrafo único corrido**, sem pontuação entre frases: "Mestre há 11 anos Editor do site Toca do Coruja RPG Fanático por The Witcher Mais de 30 feedbacks positivos sobre a forma de narrar." → o banco tem 4 linhas separadas por `\n`, mas o hero renderiza em `<p>` simples sem split. Resultado ilegível.
- Dois CTAs renderizam corretamente ("Entrar em contato" primário / "Ver mesas disponíveis" secundário).
- Trust-row só mostra "14+ anos de experiência". Não mostra "N mesas ativas" nem "Verificado no Covil". `profile.tables_count` está vindo 0/null, apesar de existirem 13 mesas ativas (confirmado no print 3).
- `hero-stats` **não renderiza**. `hasAnyStat = false`. Nenhum de `tables_count`, `avg_rating`, `reviews_count` tem valor preenchido — todos em 0/null no payload público.

**Print 2 — Seção Sobre**
- Foto da bio renderiza à esquerda, bio à direita.
- Bio aparece **corretamente quebrada em 4 parágrafos** ("Mestre há 11 anos" / "Editor do site Toca do Coruja RPG" / "Fanático por The Witcher" / "Mais de 30 feedbacks positivos sobre a forma de narrar."). Confirmação: o split `\n` funciona em `MestreBio.tsx` e não funciona em `MestreHero.tsx`.
- Sem chips de especialidades. Sem chips de idiomas. Sem blockquote de tagline. Esses campos estão vazios no banco para este mestre.
- Seção `MestreSellingPoints` **não existe entre Bio e Final CTA**. `selling_points` é `[]` no banco.

**Print 3 — Final CTA posicionado antes das mesas**
- Card "✨ Vagas abertas para novas aventuras" renderiza no **cenário 4** do `MestreFinalCta` (occupancyRate < 50%).
- Mensagem: "53 vagas disponíveis em 13 mesas ativas" + CTA "Explorar mesas".
- **Posição errada:** o `MestrePage.tsx` linha 102–108 coloca o `MestreFinalCta` **antes** de `MestreTablesSection`. Isso é um erro de hierarquia — o CTA final deve ser o **fechamento** da página, não um intermezzo. Depois do CTA vem "Mesas Disponíveis" com os cards reais, o que destrói a função do elemento de urgência.
- Legenda final "As vagas preenchem rápido. Não perca sua chance!" só faz sentido em cenário de urgência. Em cenário 4 (vagas abertas sem pressão), essa frase é falsa.

**Print 4 — Grade de mesas**
- Cards grid renderizam corretamente.
- Dois cards idênticos lado a lado ("asdfasdfasdfa", "Ashen Stars", "Online", "Faren Ravirar", 4 vagas, R$ 50.00, "Entrar na mesa →"). São mesas de teste duplicadas — não é bug da auditoria, é dado de homologação.
- Badge "⭐ Destaque" não aparece em nenhum card. `featured === true` está em zero mesas deste mestre. O Patch 8/V4 (`MestreFeaturedTable`) não tem oportunidade de renderizar neste mestre específico — tecnicamente correto, não é bug.
- Cards mostram "4 vagas" com dots parcialmente preenchidos. `SlotsIndicator` ok.
- Botão "Entrar na mesa →" laranja ocupando 100% do footer do card. OK.

**Print 5 — Insights (protegido)**
- Banner "🔒 VISÍVEL APENAS PARA VOCÊ" renderiza. OK.
- Título "Insights das suas mesas". OK.
- Cards estruturados com 4 métricas cada (Visualizações, Cliques, Contatos, Favoritos). OK.
- Dois cards visíveis: "Pathfinder: Kingmaker" (47 views, 3 clicks, 0 contatos, 0 favoritos) e "A Voz nas Cartas" (31 views, 26 clicks, 0 contatos, 0 favoritos).
- Ordenação por views desc. OK.
- **Problema:** o backend `gm.ts` em `GET /:slug/insights` retorna **todas as mesas do mestre** (linha 366 — `.where('t.gm_id', '=', gm.id)` sem filtro de status). Se o mestre tem mesas em `draft`, `cancelled`, `ended`, elas vão aparecer nos insights. A screenshot confirma isso: existem 13 mesas ativas, mas insights mostra títulos diferentes do grid público — "Pathfinder: Kingmaker" não aparece no grid público (print 4), o que implica que está em status diferente de `active`.

**Print 6 — Recomendações**
- Card "Pathfinder: Kingmaker" com todas métricas zeradas aparece **depois** do grid do print 5. Isso é um **terceiro card** do insights, não está ordenado coerentemente — mesa com 0 views vem abaixo de mesa com 31 views. Aparenta ser ordenação correta (decrescente por views), mas o enquadramento do print deixa parecer órfão.
- Banner "🔒 VISÍVEL APENAS PARA VOCÊ" repetido para a seção de recomendações. OK.
- Título "Recomendações personalizadas". OK.
- **3 recomendações de severidade alta** (`AlertTriangle` vermelho, border-left vermelho):
  1. `Mesa "asdfasdfasdfa" (4 instâncias) tem 22 visualizações e zero contatos.`
  2. `Mesa "Pathfinder: Kingmaker" (6 instâncias) tem 56 visualizações e zero contatos.`
  3. `Mesa "A Voz nas Cartas" tem 31 visualizações e zero contatos.`
- **Problema novo:** `buildRecommendations` agrupa por `title.toLowerCase()` (Patch 1/V4 aplicado) e mostra "(N instâncias)". Isso **expõe o dado sujo** (mesas de teste duplicadas) em vez de ocultar. A regra do Patch 1 está correta tecnicamente, mas o label "(4 instâncias)" não tem utilidade para o mestre — ele não sabe o que fazer com essa informação. Ou o label some, ou vira um link de ação.

**Print 7 — LinksDisplay: Conteúdo e Presença**
- Título "🎙️ Conteúdo & Redes" com ícone `Mic2` (Patch 14/V4 aplicado).
- Categorias com ícones Lucide: "📹 Conteúdo" (Video), "🔗 Presença" (Share2). OK.
- Cards de link: YouTube, Instagram.
- **Problema crítico:** o card do YouTube mostra apenas texto "www.youtube.com/@ArtificioRPG" sem embed, sem thumbnail, sem título. O `link.embed_url` que deveria ser gerado pelo `generateEmbedUrl()` em `gm.ts` linha 234 retorna `null` para **URLs de canal** do YouTube (`/@handle`), porque a função só sabe extrair ID de vídeo (`watch?v=`, `youtu.be/`, `embed/`). URL de canal não tem vídeo para fazer embed. Então cai no branch "social preview"... mas o tipo está classificado como `youtube`, não `social`. Resultado: nem embed, nem thumbnail, nem URL clicável útil. Só texto cru.
- Botão "Ver conteúdo ↗" com cor laranja pálido, menor contraste que o resto.

**Print 8 — LinksDisplay: Autoridade**
- Categoria "📖 Autoridade" com cards "WEBSITE" (x2).
- Card 1: Artifício RPG — título + descrição curta com truncate. OK.
- Card 2: "Compartilhe no WhatsApp" — **thumbnail exibe uma imagem genérica do WhatsApp em branco**, não é thumbnail real do conteúdo compartilhado. Provável que `thumbnail_url` tenha sido extraído do Open Graph genérico do api.whatsapp.com.
- Descrição do card 2: "WhatsApp Messenger: mais de dois bilh&#xf5;es de pessoas, em mais de 180 pa&#xed;ses, usam o WhatsApp para mant..." — **entities HTML cruas (`&#xf5;`, `&#xed;`) aparecem sem decodificar**. Deveria ser "bilhões" e "países". O `description` está sendo salvo no banco sem unescape, ou o frontend está renderizando sem decode.
- Rodapé do site renderiza corretamente.

---

## B. Arquivos exatos que devem ser enviados agora

### Bloco 1 — Hero e trust-row (prioridade alta)

**Arquivo:** `frontend/src/components/mestre/MestreHero.tsx`
Camada: frontend — componente.
Motivo objetivo: bio corrida sem split de `\n` no hero (print 1). Confirmar se o componente atual faz o mesmo split que `MestreBio.tsx` faz.
O que será validado: presença/ausência de `.split(/\n\s*\n|\n/)` ou renderização via `<p>{profile.bio_long}</p>` direta. Também o bloco de `hero-trust-row` para confirmar se `tables_count` está sendo lido de `profile.tables_count` diretamente (sem fallback).
Prioridade: alta.

**Arquivo:** consulta no banco do registro `gm_profiles` do mestre testado (`slug = faren-ravirar` ou equivalente)
Camada: backend — dados.
Motivo objetivo: print 1 mostra 0 mesas no trust-row e `hero-stats` vazio, mas print 3 mostra 13 mesas ativas. Hipótese: `gm_profiles.tables_count` está desatualizado no banco (não é recalculado em tempo real, é campo denormalizado que precisa de trigger ou recompute).
O que será validado: `SELECT tables_count, avg_rating, reviews_count FROM gm_profiles WHERE slug = '<slug>';` versus `SELECT COUNT(*) FROM tables WHERE gm_id = '<id>' AND status = 'active';`. Se diverge, o problema é de sincronização.
Prioridade: alta.

**Arquivo:** `backend/src/services/gmProfileService.ts` ou equivalente (se existir)
Camada: backend — serviço.
Motivo objetivo: achar onde `tables_count` deveria ser incrementado/decrementado. Hipótese: ninguém atualiza esse contador. Ele ficou zerado desde a criação do perfil.
O que será validado: presença de lógica de recompute de `tables_count` ao criar/cancelar/deletar mesa.
Prioridade: alta.

### Bloco 2 — Contrato e utilidade do LinksDisplay (prioridade alta)

**Arquivo:** `backend/src/services/linkService.ts`
Camada: backend — serviço.
Motivo objetivo: prints 7 e 8 mostram embed quebrado para URL de canal do YouTube (`/@handle`) e descrição com entities HTML cruas (`&#xf5;`). Preciso ver como `generateEmbedUrl`, `detectLinkType` e o fluxo de metadata scraping funcionam.
O que será validado: 
- `generateEmbedUrl` para YouTube — detecta só vídeo ou detecta canal também? 
- Onde `description` é salvo no banco — tem unescape de entities ou armazena como vem?
- Onde `thumbnail_url` é filtrado — o comentário no MAPA_DE_API diz `fbcdn.net`, `cdninstagram.com`, `twimg.com`, `tiktokcdn.com` são bloqueados, mas WhatsApp OG image passou.
Prioridade: alta.

**Arquivo:** `backend/src/scripts/processLinkMetadataJobs.ts`
Camada: backend — worker.
Motivo objetivo: ver exatamente como a descrição OG é extraída e persistida. Confirmar se tem `html-entities` ou lib equivalente para decode.
O que será validado: função de parse do HTML, onde `title/description` saem do `<meta property="og:description">` e vão para o `db.insertInto('user_links')`.
Prioridade: alta.

**Arquivo:** `frontend/src/components/LinksDisplay.tsx`
Camada: frontend — componente.
Motivo objetivo: confirmar que o tratamento de `link.type === 'youtube'` sem `embed_url` não tem fallback útil. Atualmente só mostra texto cru da URL.
O que será validado: branch de render quando `hasHeavyEmbed = false` mas `type === 'youtube'`. Print 7 evidencia que esse branch não existe e cai no render genérico sem valor.
Prioridade: alta.

### Bloco 3 — Ordem de render e CTA final (prioridade média)

**Arquivo:** `frontend/src/pages/MestrePage.tsx`
Camada: frontend — página.
Motivo objetivo: confirmar que a ordem atual é `Hero → Bio → SellingPoints → FinalCta → TablesSection → ClosedGroup → Insights → Recommendations → Links`. Isso está errado — o `FinalCta` deve ir depois do `TablesSection`.
O que será validado: composição exata em linhas 90–130.
Prioridade: média (já analisei em rodada anterior, mas preciso do arquivo final para garantir que nada mudou).

### Bloco 4 — Insights escopo (prioridade média)

**Arquivo:** `backend/src/routes/gm.ts`
Camada: backend — rota.
Motivo objetivo: print 5/6 mostra mesas no insights que não aparecem no grid público. Hipótese: insights retorna mesas em qualquer status (inclusive `draft`, `cancelled`, `ended`), enquanto grid público filtra `status = 'active'`. Se insights mostrar mesa cancelada com views antigas + recomendação "zero contatos", o mestre vai tentar "otimizar" uma mesa que não está no ar. Esse é o problema operacional real.
O que será validado: linha ~366 do `GET /:slug/insights` — se tem `.where('t.status', '=', 'active')` ou não.
Prioridade: média (já analisado em rodada anterior, confirmar após patches).

---

## C. Problemas confirmados com base em código e prints enviados até agora

### P-HERO-01 — Bio do hero renderiza sem quebra de linha

**Problema:** `MestreHero.tsx` renderiza `<p className="hero-bio">{profile.bio_long}</p>` direto, sem fazer split por `\n`. O texto do banco tem 4 frases separadas por quebra de linha, mas o navegador ignora `\n` dentro de texto HTML — transformando em espaço único.
**Evidência no print:** print 1, linha única "Mestre há 11 anos Editor do site Toca do Coruja RPG Fanático por The Witcher Mais de 30 feedbacks positivos sobre a forma de narrar." sem pontuação nem quebra.
**Origem no frontend:** `MestreHero.tsx`, branch do bio.
**Origem no backend:** nenhuma. O dado está correto no banco.
**Impacto operacional:** primeiro bloco de informação do perfil é ilegível. Violação de ISO 9241 "adequação à tarefa" — o mestre escreveu 4 frases estruturadas, a tela mostra uma blob.
**Mudança exata necessária:** aplicar no `MestreHero.tsx` o mesmo split que o `MestreBio.tsx` já faz. Mas como o hero tem espaço limitado, limitar a **1–2 primeiras frases** ou exibir só a **tagline** se existir, deixando a bio completa para a seção `MestreBio`.

### P-HERO-02 — `tables_count` do perfil público vem zerado

**Problema:** `profile.tables_count` vem 0 no payload público do `GET /api/v1/gm/:slug`, apesar do mestre ter 13 mesas ativas.
**Evidência no print:** print 1 não mostra "N mesas ativas" no `hero-trust-row`, nem `hero-stats`. Print 3 mostra "13 mesas ativas" no CTA final, mas este valor vem de `mappedTables.length`, não de `profile.tables_count`.
**Origem no frontend:** `MestreHero.tsx` lê `profile.tables_count` diretamente. Sem fallback para `mappedTables.length`.
**Origem no backend:** `gm.ts` linha 101 faz `select('gm.tables_count')`. O valor na coluna está desatualizado. Ninguém atualiza esse contador quando mesa é criada/cancelada.
**Impacto operacional:** trust-row e stats do hero ficam vazios. Prova social perdida. O visitante não vê quantas mesas o mestre mantém. Como temos `tables_count` e `mappedTables.length` divergentes, há inconsistência de dados entre camadas.
**Mudança exata necessária:** duas opções — (A) criar migration com trigger em `tables` que incremente/decremente `gm_profiles.tables_count`; (B) substituir a leitura `gm.tables_count` por `COUNT(*)` em tempo de query no `GET /:slug`. Opção B é mais simples e elimina a denormalização quebrada.

### P-LINKS-01 — Embed quebrado para URL de canal do YouTube

**Problema:** URL `https://www.youtube.com/@ArtificioRPG` é classificada como `type = 'youtube'` no backend, mas `generateEmbedUrl()` não gera `embed_url` (só funciona para vídeos individuais). No frontend, o branch `hasHeavyEmbed = false && type === 'youtube'` não tem render útil — mostra só texto da URL.
**Evidência no print:** print 7, card YouTube mostra `www.youtube.com/@ArtificioRPG` como string pura, sem player, sem preview.
**Origem no frontend:** `LinksDisplay.tsx` linha ~70 — não há branch específico para YouTube sem embed.
**Origem no backend:** `linkService.ts.generateEmbedUrl()` retorna `null` para canais.
**Impacto operacional:** mestre adiciona canal do YouTube esperando um card visualmente rico; recebe um texto cru com botão "Ver conteúdo". Desestimula uso da feature.
**Mudança exata necessária:** no `LinksDisplay.tsx`, adicionar branch específico: se `type === 'youtube'` e `!embed_url`, renderizar card com ícone grande YouTube + handle extraído (`@ArtificioRPG`) + botão "Abrir canal". Tratar URL de canal como equivalente a redes sociais (preview leve), não tentar forçar embed.

### P-LINKS-02 — Descrição OG com entities HTML cruas

**Problema:** o card do WhatsApp (print 8) mostra descrição com `&#xf5;`, `&#xed;` literais. São entities HTML hexadecimais ("ō", "í") que não foram decodificadas antes de salvar ou antes de renderizar.
**Evidência no print:** print 8, "mais de dois bilh&#xf5;es de pessoas, em mais de 180 pa&#xed;ses".
**Origem no frontend:** `LinksDisplay.tsx` renderiza `{link.description}` em `<p>`. Não decodifica.
**Origem no backend:** `processLinkMetadataJobs.ts` (precisa confirmar) — está salvando `og:description` sem unescape.
**Impacto operacional:** card de link fica visualmente quebrado, com caracteres encode-crus expostos. Violação de ISO 9241 "conformidade às expectativas do usuário".
**Mudança exata necessária:** no backend, no worker que extrai OG, adicionar chamada a uma função de decode de entities (lib `html-entities` ou `he`). Aplicar a `title` e `description` antes de persistir. Para registros já poluídos no banco, rodar script de migração que corrige descrições existentes (`SELECT id, description FROM user_links WHERE description LIKE '%&#%' → decode → UPDATE`).

### P-CTA-01 — Final CTA posicionado antes das mesas

**Problema:** o `MestreFinalCta` aparece **antes** do `MestreTablesSection` no `MestrePage.tsx`. Isso destrói a função de elemento de fechamento — o CTA final existe para capturar o usuário depois que ele viu as mesas; colocá-lo antes gera um intermezzo sem sentido.
**Evidência no print:** print 3 mostra o card "Vagas abertas" acima de "Mesas Disponíveis". Usuário é convidado a "Explorar mesas" em um card destacado, depois rola e encontra as mesas de fato. Redundância ruidosa.
**Origem no frontend:** `MestrePage.tsx` linhas ~102–115 — o `MestreFinalCta` está posicionado **antes** de `MestreTablesSection`.
**Origem no backend:** nenhuma.
**Impacto operacional:** violação de Nielsen "consistência e padrões" — CTA final em produto maduro vem ao fim da página, não no meio.
**Mudança exata necessária:** trocar a ordem no `MestrePage.tsx`. `MestreTablesSection` vem **antes** de `MestreClosedGroupSection`, e `MestreFinalCta` vem **depois** de `LinksDisplay` (último bloco antes do footer). Ordem final: `Hero → Bio → SellingPoints → TablesSection → ClosedGroup → Insights → Recommendations → Links → FinalCta`.

### P-CTA-02 — Legenda de urgência renderiza em cenário sem urgência

**Problema:** o `MestreFinalCta` sempre renderiza o rodapé "⏰ As vagas preenchem rápido. Não perca sua chance!" independente do cenário. No cenário 4 (occupancyRate < 50%, sem mesa urgente), essa frase **contradiz** o título "Vagas abertas para novas aventuras".
**Evidência no print:** print 3 tem título "Vagas abertas" (cenário calmo) + legenda "preenchem rápido" (cenário de pressão). Mensagem ambígua.
**Origem no frontend:** `MestreFinalCta.tsx` linhas finais, `<p className="final-cta-hint">` está fora do switch de cenários.
**Origem no backend:** nenhuma.
**Impacto operacional:** quebra de confiança. Usuário percebe mensagem forçada.
**Mudança exata necessária:** mover a legenda para dentro do objeto `ctaData`, uma `hint` por cenário:
- Cenário 1 (lotado): "Vamos te avisar assim que uma vaga abrir."
- Cenário 2 (urgente): "As vagas preenchem rápido. Não perca sua chance!"
- Cenário 3 (preenchendo): "A maioria das mesas já tem jogadores confirmados."
- Cenário 4 (aberto): `null` (não renderizar hint).

### P-INSIGHTS-01 — Insights retorna mesas fora de `status = 'active'`

**Problema:** `GET /:slug/insights` em `gm.ts` não filtra por `status = 'active'`. Retorna **todas** as mesas do mestre, incluindo `draft`, `cancelled`, `ended`. O grid público filtra `active`. Consequência: o mestre vê recomendações para mesas que não estão no ar.
**Evidência no print:** prints 5/6 mostram "Pathfinder: Kingmaker" e "A Voz nas Cartas" com views e recomendação de "zero contatos". Essas mesas não aparecem no grid público (print 4 só mostra "asdfasdfasdfa" e "Teste teste"). Isso significa que `Pathfinder: Kingmaker` está em status diferente de `active`. Mestre recebe orientação para otimizar mesa cancelada.
**Origem no frontend:** nenhuma. Frontend só exibe o que o backend retorna.
**Origem no backend:** `gm.ts` linha ~367, `GET /:slug/insights` — query de métricas sem filtro de status.
**Impacto operacional:** risco operacional — mestre gasta tempo editando mesa inativa. Insights perdem credibilidade.
**Mudança exata necessária:** adicionar `.where('t.status', '=', 'active')` na query de insights, OU adicionar coluna `t.status` no `select` e renderizar badge "Inativa" em cada `insight-card` para a mesa correspondente. A decisão depende da regra de negócio: **se métricas de mesas canceladas têm valor histórico, manter e badge; se não, filtrar.** Recomendo filtrar e deixar só `active` — mesa cancelada não tem o que recomendar.

### P-RECS-01 — Label "(N instâncias)" não tem utilidade acionável

**Problema:** o Patch 1/V4 deduplica recomendações agrupando por título e adiciona "(N instâncias)". Na UI (print 6) o mestre lê `Mesa "asdfasdfasdfa" (4 instâncias)` sem saber o que isso significa ou o que fazer.
**Evidência no print:** print 6, 3 recomendações mostrando "(4 instâncias)", "(6 instâncias)" sem contexto.
**Origem no frontend:** nenhuma — o texto vem do backend.
**Origem no backend:** `gm.ts` `buildRecommendations()`, geração de mensagem.
**Impacto operacional:** informação ruidosa. Usuário não entende se precisa deletar duplicatas, consolidar ou ignorar.
**Mudança exata necessária:** **ou** remover o suffix "(N instâncias)" e mostrar só a recomendação (sem agrupamento visível), **ou** transformar a recomendação em acionável: "Mesa 'X' está duplicada em 4 publicações ativas. Considere consolidar em uma única mesa." Diferente de "tem 22 visualizações e zero contatos". A regra de dedupe interna continua, mas o texto exibido deve ser prático.

### P-HERO-03 — Banner do hero não renderiza e não cai no fallback

**Problema:** `banner_url` no banco está nulo ou quebrado. O `MestreHero.tsx` renderiza `<img src={profile.banner_url}>` quando `banner_url` é truthy. Se a URL responde erro, a imagem fica quebrada visualmente ou ativa só o fundo escuro, mas **não aciona** o `hero-banner-gradient` de fallback.
**Evidência no print:** print 1, fundo azul liso sem banner.
**Origem no frontend:** `MestreHero.tsx` não tem `onError` no `<img>` do banner.
**Origem no backend:** não há. Hipótese principal: `banner_url` é `null` no banco para este mestre — correto, `<img>` não renderiza, cai no gradient. Nesse caso **não é bug**, é estado vazio esperado.
**Impacto operacional:** se banner é só um gradient sempre que vazio, o hero fica com muito espaço vazio e pouco conteúdo visual. Pode ser uma escolha de design, mas é difícil confirmar sem ver o CSS renderizado.
**Mudança exata necessária:** nenhuma se intencional. Se não intencional, adicionar `onError={() => setBannerFailed(true)}` no `<img>` e fallback ao gradient quando falha o carregamento.

---

## D. Mudanças práticas por arquivo

### Arquivo: `frontend/src/components/mestre/MestreHero.tsx`
Camada: frontend — componente.
Alterar: 
1. Bloco da bio no hero.
2. Fallback de banner com `onError`.
Objetivo: bio legível + banner resiliente a URL quebrada.
Mudança concreta:
- Trocar `<p className="hero-bio">{profile.bio_long}</p>` por: **se `profile.tagline` existe, renderizar só tagline no hero** (1 linha, max 200 chars conforme schema do banco); **se não, pegar primeira frase da bio** (até primeiro ponto final, ou primeiros 140 chars com reticências). Bio completa continua em `MestreBio`.
- Adicionar `useState<boolean>` para `bannerFailed`. No `<img>` do banner, `onError={() => setBannerFailed(true)}`. Condicional de render: se `profile.banner_url && !bannerFailed` → renderiza `<img>`; senão → renderiza `hero-banner-gradient`.
Dependências: nenhuma nova.
Restrições: não tocar no `hero-avatar`, `hero-badges`, `hero-title`, `hero-ctas`, `hero-trust-row`, `hero-stats`. Dual-CTA já está correto.
Resultado esperado: hero com frase curta legível no lugar da bio longa, banner com fallback confiável.

### Arquivo: `backend/src/routes/gm.ts`
Camada: backend — rota pública.
Alterar: 
1. Query do `GET /:slug` — recalcular `tables_count` em tempo real.
2. Query do `GET /:slug/insights` — filtrar por `status = 'active'`.
3. Mensagem de `buildRecommendations` — remover "(N instâncias)" ou tornar acionável.
Objetivo: corrigir divergência de contagem + escopo de insights + utilidade de recomendações.
Mudança concreta:
- No `GET /:slug`, trocar `gm.tables_count` no select por subquery `(SELECT COUNT(*) FROM tables t WHERE t.gm_id = gm.id AND t.status = 'active')::int AS tables_count` via `sql` literal do Kysely. Remover `gm.tables_count` do select original.
- No `GET /:slug/insights`, linha ~367 na query de `metrics`, adicionar `.where('t.status', '=', 'active')`.
- Em `buildRecommendations`, trocar a lógica de mensagens quando `count > 1`:
  - Caso `count > 1`: gerar recomendação **separada** de severidade `medium`: `Mesa "X" está publicada ${count} vezes com status ativo. Consolide em uma única publicação para concentrar métricas.` Ignorar o caso duplicado nos outros branches (não recomendar otimização de capa/preço quando o problema é duplicação).
  - Caso `count === 1`: manter os 3 branches atuais (views sem contato, cliques sem contato, zero tráfego), sem suffix.
Dependências: nenhuma migração nova. Query só muda ordem de leitura.
Restrições: não alterar o `viewer_context`, não alterar `closed_group`, não tocar em `POST /:slug/view`, não tocar em `links` enrichment.
Resultado esperado: `tables_count` sempre correto, insights só para mesas ativas, recomendações claras e acionáveis.

### Arquivo: `frontend/src/pages/MestrePage.tsx`
Camada: frontend — página.
Alterar: ordem de composição dos componentes.
Objetivo: CTA final no fechamento, não no meio.
Mudança concreta:
- Ordem nova: `<MestreHero /> → <MestreBio /> → <MestreSellingPoints /> → <MestreTablesSection /> → <MestreClosedGroupSection /> → {canSeeInsights && <MestreInsightsSection />} → {canSeeInsights && <MestreRecommendationsSection />} → {links.length > 0 && <LinksDisplay />} → {mappedTables.length > 0 && <MestreFinalCta />}`.
- Remover o `MestreFinalCta` atual do meio. Manter apenas a nova posição final.
Dependências: nenhuma.
Restrições: não tocar no `useEffect` de telemetria (`POST /gm/:slug/view`). Manter `id="contato"` na seção de links.
Resultado esperado: hierarquia de conversão linear.

### Arquivo: `frontend/src/components/mestre/MestreFinalCta.tsx`
Camada: frontend — componente.
Alterar: legenda `final-cta-hint` condicional por cenário.
Objetivo: remover mensagem de urgência em cenário sem urgência.
Mudança concreta:
- Adicionar campo `hint: string | null` ao objeto `ctaData` em cada um dos 4 cenários:
  - Cenário 1: `hint: 'Vamos te avisar assim que uma vaga abrir.'`
  - Cenário 2: `hint: '⏰ As vagas preenchem rápido. Não perca sua chance!'`
  - Cenário 3: `hint: 'A maioria das mesas já tem jogadores confirmados.'`
  - Cenário 4: `hint: null`
- No JSX final, trocar `<p className="final-cta-hint">⏰ As vagas preenchem rápido...</p>` por `{ctaData.hint && <p className="final-cta-hint">{ctaData.hint}</p>}`.
Dependências: nenhuma.
Restrições: não alterar detecção de `isUrgent` nem `occupancyRate`.
Resultado esperado: CTA final coerente entre título e legenda em todos os 4 cenários.

### Arquivo: `frontend/src/components/LinksDisplay.tsx`
Camada: frontend — componente.
Alterar: branch de render para YouTube sem `embed_url`.
Objetivo: cards de canal YouTube úteis em vez de texto cru.
Mudança concreta:
- Adicionar constante `isChannelLike` no corpo do `LinkCard`: `const isChannelLike = link.type === 'youtube' && !link.embed_url;`.
- Acima do branch `hasHeavyEmbed`, adicionar novo branch exclusivo:
```tsx
{isChannelLike && (
  <div className="link-card-channel-preview">
    <Icon className="w-10 h-10" />
    <div>
      <p className="link-card-channel-handle">
        {(() => {
          try {
            const pathname = new URL(link.url).pathname;
            const handle = pathname.replace(/^\/+/, '').split('/')[0];
            return handle.startsWith('@') ? handle : `@${handle}`;
          } catch {
            return 'Canal';
          }
        })()}
      </p>
      <p className="link-card-channel-label">Abrir canal no YouTube</p>
    </div>
  </div>
)}
```
- Ajustar a condição do branch `isSocial`: `isSocial && !hasHeavyEmbed && !isChannelLike`.
- Adicionar CSS (no `LinksDisplay.css`, arquivo já existente) com `.link-card-channel-preview`, `.link-card-channel-handle`, `.link-card-channel-label` — layout horizontal, ícone grande, handle destacado, label cinza.
Dependências: estilos CSS novos (arquivo existente de LinksDisplay).
Restrições: não tocar em Twitch/Spotify (continuam usando `embed_url`). Não alterar iframes.
Resultado esperado: canal do YouTube renderiza card visual com handle (`@ArtificioRPG`), não URL crua.

### Arquivo: `backend/src/scripts/processLinkMetadataJobs.ts` + `backend/src/services/linkService.ts`
Camada: backend — worker e serviço.
Alterar: decode de HTML entities em `title` e `description` extraídos do OG.
Objetivo: eliminar `&#xf5;`, `&#xed;`, `&amp;` etc. no banco.
Mudança concreta:
- Instalar `he` (`npm install he` + `@types/he`).
- No `processLinkMetadataJobs.ts`, na função de extração, aplicar `he.decode(ogTitle)` e `he.decode(ogDescription)` antes de persistir.
- Criar migration de correção para registros existentes: script separado que `SELECT id, title, description FROM user_links WHERE title ~ '&#' OR description ~ '&#'`, aplica `he.decode()` em memória, `UPDATE user_links SET title = $1, description = $2 WHERE id = $3`. Rodar uma vez após deploy. Script idempotente.
Dependências: lib `he` + `@types/he`.
Restrições: não alterar lógica de retry, de throttle de 6h, nem de cleanup 30d.
Resultado esperado: descrições legíveis sem entities cruas, tanto para novos links quanto para os existentes.

---

## E. Lacunas que ainda precisam ser validadas

1. **`tables_count` desatualizado é o problema real ou existe algum campo de `role`/`published` que filtra?**
   Arquivo adicional necessário: `backend/src/services/gmProfileService.ts` se existir, senão qualquer service/repository que toque `gm_profiles`.
   Camada: backend.
   Motivo objetivo: confirmar que `tables_count` é realmente um contador estático sem trigger, e que a solução de subquery em `GET /:slug` é segura.
   O que precisa ser validado: se há código em qualquer lugar do backend que incrementa/decrementa `tables_count`. Se existe, a substituição por subquery elimina o uso.

2. **WhatsApp OG image passou pelo filtro de domínios**
   Arquivo adicional necessário: `backend/src/scripts/processLinkMetadataJobs.ts`.
   Camada: backend.
   Motivo objetivo: o MAPA_DE_API diz que thumbnails de `fbcdn.net`, `cdninstagram.com`, `twimg.com`, `tiktokcdn.com` são bloqueados. WhatsApp (`api.whatsapp.com` ou `wa.me`) não está na lista e o print 8 mostra thumbnail genérica. Validar se existe lista de domínios de thumbnail bloqueados e se WhatsApp precisa entrar.
   O que precisa ser validado: blocklist de `thumbnail_url` no worker.

3. **Decisão sobre "(N instâncias)"**
   Sem lacuna técnica — é decisão de produto. Minha recomendação é a mudança exata descrita em D (separar em recomendação própria, tipo `medium`, com texto acionável). Confirmar se essa é a direção antes de implementar.

4. **Banner do hero — comportamento de fallback é intencional?**
   Sem lacuna técnica se `banner_url` é `null` por padrão. Se o design prevê gradient sempre como fallback visual aceitável, nada muda.

---

## F. Prompt final para Sonnet 4.5

```
CONTEXTO
========
Rodada de ajustes incrementais sobre a página pública de mestre (/mestre/:slug) já funcional em produção. A estrutura modular da V4 já está aplicada (MestreHero, MestreBio, MestreSellingPoints, MestreFeaturedTable, MestreTablesSection, MestreClosedGroupSection, MestreInsightsSection, MestreRecommendationsSection, MestreFinalCta). Os 21 patches anteriores estão no código.

Agora são 7 correções pontuais de fluxo, contrato e render, identificadas por auditoria cruzada de prints + código.

ARQUIVOS A ALTERAR
==================

1. frontend/src/components/mestre/MestreHero.tsx
   - Camada: frontend, componente.
   - Problema: bio longa renderiza corrida no hero, sem quebras de linha do banco.
   - Mudança:
     a) Substituir `<p className="hero-bio">{profile.bio_long}</p>` por lógica:
        • Se `profile.tagline` existe (truthy), renderizar só `<p className="hero-bio">{profile.tagline}</p>`.
        • Senão, extrair primeira frase de `profile.bio_long` (até primeiro `.` ou 140 chars + '…').
     b) Adicionar useState `bannerFailed` e onError no <img> do banner para cair no `hero-banner-gradient`.
   - Restrição: não tocar em hero-avatar, hero-badges, hero-title, hero-ctas, hero-trust-row, hero-stats. Dual-CTA está correto.

2. backend/src/routes/gm.ts
   - Camada: backend, rota.
   - Problemas:
     a) `gm.tables_count` vem desatualizado no payload público.
     b) `GET /:slug/insights` retorna mesas de qualquer status.
     c) Mensagem de `buildRecommendations` com "(N instâncias)" não é acionável.
   - Mudanças:
     a) No select do `GET /:slug`, trocar `gm.tables_count` por subquery:
        `sql<number>\`(SELECT COUNT(*)::int FROM tables WHERE gm_id = gm.id AND status = 'active')\`.as('tables_count')`.
        Remover `gm.tables_count` do select original para evitar colisão.
     b) No `GET /:slug/insights`, linha ~367, adicionar `.where('t.status', '=', 'active')` na query de metrics.
     c) Em `buildRecommendations`:
        • Quando `count > 1`, gerar apenas uma recomendação: severidade `medium`, mensagem `Mesa "${first.title}" está publicada ${count} vezes com status ativo. Consolide em uma única publicação para concentrar métricas.` — não rodar os outros branches para mesas duplicadas.
        • Quando `count === 1`, manter os 3 branches atuais (views≥20 sem contato, clicks≥10 sem contato, zero tráfego) mas remover o `suffix` das mensagens.
   - Restrição: não alterar `viewer_context`, `closed_group`, rota `/view`, enrichment de `links`, middleware `optionalAuth`.

3. frontend/src/pages/MestrePage.tsx
   - Camada: frontend, página.
   - Problema: `MestreFinalCta` está antes de `MestreTablesSection`.
   - Mudança: reordenar para:
     Hero → Bio → SellingPoints → TablesSection → ClosedGroupSection → Insights (condicional) → Recommendations (condicional) → LinksDisplay (condicional) → FinalCta (condicional).
   - Restrição: preservar `useEffect` de telemetria `POST /gm/:slug/view`. Manter `<section id="contato">` na seção de links.

4. frontend/src/components/mestre/MestreFinalCta.tsx
   - Camada: frontend, componente.
   - Problema: legenda "As vagas preenchem rápido" renderiza em cenário de mesas abertas sem urgência.
   - Mudança: adicionar `hint: string | null` ao objeto `ctaData` em cada cenário:
     • Cenário 1 (lotado): `hint: 'Vamos te avisar assim que uma vaga abrir.'`
     • Cenário 2 (urgente): `hint: '⏰ As vagas preenchem rápido. Não perca sua chance!'`
     • Cenário 3 (preenchendo): `hint: 'A maioria das mesas já tem jogadores confirmados.'`
     • Cenário 4 (aberto): `hint: null`
     No JSX, trocar `<p className="final-cta-hint">⏰...</p>` por `{ctaData.hint && <p className="final-cta-hint">{ctaData.hint}</p>}`.
   - Restrição: não mexer em occupancyRate, isUrgent, totalOpenSlots.

5. frontend/src/components/LinksDisplay.tsx
   - Camada: frontend, componente.
   - Problema: canal do YouTube (URL com /@handle) classificado como type=youtube mas sem embed_url renderiza apenas URL crua.
   - Mudança:
     a) Declarar `const isChannelLike = link.type === 'youtube' && !link.embed_url;` no corpo do LinkCard.
     b) Adicionar branch antes de `hasHeavyEmbed`:
        ```tsx
        {isChannelLike && (
          <div className="link-card-channel-preview">
            <Icon className="w-10 h-10" />
            <div>
              <p className="link-card-channel-handle">{extrairHandle(link.url)}</p>
              <p className="link-card-channel-label">Abrir canal no YouTube</p>
            </div>
          </div>
        )}
        ```
        A função `extrairHandle` lê `new URL(link.url).pathname`, remove leading `/`, pega primeiro segmento, prefixa `@` se não tiver.
     c) Atualizar condição de `isSocial` para `isSocial && !hasHeavyEmbed && !isChannelLike`.
     d) Adicionar CSS em LinksDisplay.css:
        `.link-card-channel-preview` (flex row, gap 1rem, padding),
        `.link-card-channel-handle` (font-weight 700, cor laranja),
        `.link-card-channel-label` (font-size 0.875rem, cor branca 70%).
   - Restrição: não tocar no tratamento de Twitch/Spotify.

6. backend/src/services/linkService.ts + backend/src/scripts/processLinkMetadataJobs.ts
   - Camada: backend, worker e serviço.
   - Problema: descrições do OG vêm com entities HTML cruas (`&#xf5;`, `&#xed;`).
   - Mudança:
     a) `npm install he` + `@types/he`.
     b) No worker, onde `title` e `description` são extraídos do HTML antes de persistir, aplicar `he.decode(rawText)`.
     c) Criar script novo `backend/src/scripts/fixEncodedLinkMetadata.ts` que:
        • Seleciona `id, title, description` de `user_links` onde `title LIKE '%&#%' OR description LIKE '%&#%'`.
        • Decode em memória via `he.decode()`.
        • UPDATE seletivo.
        • Loga count de registros corrigidos.
        Script idempotente. Rodar uma vez manualmente após deploy.
   - Restrição: não alterar retry/backoff, nem throttle de 6h, nem cleanup 30d.

REGRAS GERAIS
=============
- Nenhuma mudança deve quebrar os patches V4 aplicados (MestreBio, MestreSellingPoints, Patch 7 do TableCard, Patch 14 do LinksDisplay).
- Nenhum refactor estético. Somente as mudanças descritas acima.
- Preservar tipagens exportadas: MestrePublicData, InsightMetric, InsightRecommendation.
- Compilar `tsc --noEmit` no backend e `npm run build` no frontend antes de abrir PR.
- Cada arquivo alterado deve ter commit próprio para rollback granular.

FORA DE ESCOPO
==============
- Nada sobre Open Graph dinâmico (já funcional).
- Nada sobre migration nova de `tables_count` (usar subquery, não trigger).
- Nada sobre EditGmProfileForm (já existe).
- Nada sobre PainelMestrePage (já tem todos os campos).

SOLICITAÇÃO FINAL
=================
Devolver 6 patches prontos (arquivos completos quando a reescrita for >30% do arquivo; `str_replace` quando for pontual). Sem pseudo-código. Sem "exemplo de implementação". Só código executável.
```