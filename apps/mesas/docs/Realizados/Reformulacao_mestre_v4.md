# Reformulação — Página Pública do Mestre — V4 (Implementação Final)

> **Versão:** V4 — Reexecução cirúrgica
> **Objetivo:** fechar tudo que foi diagnosticado como pendente/incorreto nos Prints 1–7 da Etapa 3, mais Open Graph dinâmico e UI do painel do mestre para os campos novos.
> **Base normativa:** auditoria ISO 9241 + Nielsen + Shneiderman (V3).
> **Escopo:** frontend (UI/UX/SEO), backend (ajustes pontuais em `gm.ts` e Open Graph), painel do mestre (UI de gestão dos campos adicionados na Etapa 3).
> **Fora de escopo:** segurança de dados (Etapa 1, ✅), contrato de API (Etapa 3, ✅), arquitetura modular (Etapa 2, ✅), Cloudinary/storage (já em produção).

# 📋 ÍNDICE DE PENDÊNCIAS - Reformulação V4

**Data da auditoria:** 17/04/2026  
**Status geral:** 21 de 21 patches completos (100%) | Implementação: 100% ✅

---

## Pendências Identificadas

### ✅ PENDÊNCIA 1: MestreFinalCta - Texto dinâmico implementado

**Arquivo:** `frontend/src/components/mestre/MestreFinalCta.tsx`  
**Linha:** 17-28  
**Status:** Resolvida em 17/04/2026.

**Implementação aplicada:**
- Variável `urgencyText` adicionada para definir o título dinamicamente.
- Cenário `hasUrgentTable === true` usa: `🔥 Últimas vagas disponíveis`.
- Cenário de baixa disponibilidade geral (`isLowStock`) usa: `⚡ Vagas limitadas`.
- Título do bloco atualizado para `<h2>{urgencyText}</h2>`.

**Validação técnica executada:**
- `npm run build` (frontend) concluído com sucesso após a alteração.

---

### ✅ PENDÊNCIA 2: TableCard - Altura mínima fixa

**Arquivo:** `frontend/src/components/TableCard.tsx`  
**Linha:** 91  
**Status:** Resolvida em 17/04/2026.

**Implementação aplicada:**
- Removido `min-h-[420px]` da linha 91 do TableCard.tsx
- Cards agora têm altura fluida baseada no conteúdo
- Elimina espaços vazios desnecessários em cards com pouco conteúdo
- Melhora responsividade e consistência de UX

**Validação técnica executada:**
- Busca por `min-h-[420px]` no arquivo retorna zero resultados
- Cards renderizam com altura variável conforme conteúdo
- Documentação atualizada na linha 226 do arquivo principal

---

### ✅ PENDÊNCIA 3: Rota OG extensível

**Arquivo:** `backend/src/routes/og.ts`  
**Linha:** 117  
**Status:** Resolvida em 17/04/2026.

**Implementação aplicada:**
- Rota genérica `/:type/:slug` implementada (linha 117)
- Switch case para tipos extensíveis (linha 124)
- Case 'mestre' implementado com busca de dados, injeção de meta tags e retorno de HTML
- Fallback para tipos desconhecidos retorna meta genérica
- Extensível para futuros tipos (`mesa`, `evento`) sem duplicação de código

**Validação técnica executada:**
- Arquivo `og.ts` confirmado com 7.280 bytes
- Rota registrada como `router.get('/:type/:slug', ...)`
- Switch case permite adicionar novos tipos sem modificar estrutura
- Documentação atualizada na linha 254 do arquivo principal

---

## Instruções Gerais

### Quando uma pendência for resolvida:

1. **Validar manualmente** seguindo os passos descritos na seção "Validação manual"
2. **Confirmar correção** via:
   - Inspeção de código (verificar linha mencionada)
   - Teste funcional (acessar URL e verificar comportamento)
   - DevTools (inspecionar elementos/network)
3. **Atualizar documentação principal:**
   - Abrir `docs/Reformulacao_mestre_v4.md`
   - Localizar linha indicada na pendência
   - Mudar emoji de ⚠️ para ✅
   - Adicionar evidência da correção (ex: "Corrigido em commit abc123")
4. **Remover do índice:**
   - Deletar seção completa da pendência deste arquivo
   - Atualizar contador "Status geral" no topo

### Quando TODAS as pendências forem resolvidas:

1. **Substituir conteúdo deste arquivo por:**
   ```markdown
   # ✅ REFORMULAÇÃO V4 - 100% COMPLETA
   
   **Data de conclusão:** [DATA]  
   **Auditoria finalizada em:** 17/04/2026
   
   Todos os 21 patches implementados e validados.
   
   ## Patches Completos
   
   - ✅ Lote A (3 patches): Fundação
   - ✅ Lote B (15 patches): Componentes Frontend
   - ✅ Lote C (3 patches): Open Graph & Painel
   
   ## Documentação
   
   Ver `docs/Reformulacao_mestre_v4.md` para detalhes completos da implementação.
   ```

2. **Atualizar `RESUMO_EXECUCAO.md`:**
   - Adicionar entrada com data de conclusão
   - Marcar Reformulação V4 como ✅ COMPLETA

---

## Priorização

**Todas as pendências foram resolvidas em 17/04/2026:**

- ✅ PENDÊNCIA 1: MestreFinalCta texto dinâmico (Prioridade MÉDIA)
- ✅ PENDÊNCIA 2: TableCard altura fixa (Prioridade ALTA)
- ✅ PENDÊNCIA 3: Rota OG extensível (Prioridade BAIXA)

---

## Notas

- Este arquivo deve ser mantido atualizado conforme pendências são resolvidas
- Não deletar este arquivo até que todas as pendências sejam resolvidas
- Após resolução completa, manter como registro histórico da auditoria

---

## Índice

1. [Estado real confirmado após análise do código enviado](#1-estado-real-confirmado-após-análise-do-código-enviado)
2. [Mapa dos 13 problemas ativos](#2-mapa-dos-13-problemas-ativos)
3. [Arquitetura de componentes (target V4)](#3-arquitetura-de-componentes-target-v4)
4. [Open Graph dinâmico — decisão técnica e plano](#4-open-graph-dinâmico--decisão-técnica-e-plano)
5. [Patches em ordem de execução](#5-patches-em-ordem-de-execução)
6. [UI do Painel do Mestre para novos campos](#6-ui-do-painel-do-mestre-para-novos-campos)
7. [Plano de execução (10 passos)](#7-plano-de-execução-10-passos)
8. [Checklist de validação pós-deploy](#8-checklist-de-validação-pós-deploy)
9. [Prompt final para Sonnet 4.5](#9-prompt-final-para-sonnet-45)
10. [Rollback plan](#10-rollback-plan)

---

## 1. Estado real confirmado após análise do código enviado

Evidências cruzadas entre código e Prints 1–7:

### Frontend da página pública

| Arquivo | Estado real |
|---|---|
| `MestrePage.tsx` | ✅ **COMPOSIÇÃO FINAL COMPLETA E AUDITADA (17/04/2026).** Ordem de renderização: MestreHero (93) → MestreBio (99) → MestreSellingPoints (101) → MestreTablesSection (103) → MestreClosedGroupSection (105) → MestreInsightsSection (107-109, condicional) → MestreRecommendationsSection (111-113, condicional) → LinksDisplay (115-121, condicional) → MestreFinalCta (123-129, condicional). Patch 15 validado. |
| `MestreHero.tsx` | ✅ **REESCRITO E AUDITADO (17/04/2026).** Dual-CTA (linhas 86-103). Stats reais sem derivadas (linhas 128-156). Título com `hero-title-accent` (linha 79). Trust row com 3 badges condicionais (linhas 105-126). Promo badge com Sparkles (linhas 45-50). Avatar com fallback para inicial (linhas 52-64). |
| `MestreWhySection.tsx` | ✅ **REMOVIDO (17/04/2026).** Substituído por `MestreSellingPoints` + `MestreBio`. Não há mais referências no código. |
| `MestreSellingPoints.tsx` | ✅ **CRIADO (17/04/2026).** Itera `profile.selling_points` data-driven. Renderiza cards estruturados. |
| `MestreTablesSection.tsx` | ✅ **ATUALIZADO E AUDITADO (17/04/2026).** Importa MestreFeaturedTable e MestreTablesGrid (linhas 2-3). Separa featured (linha 10) e outras mesas (linha 11). Subtítulo condicional (linhas 20-24): só renderiza se `hasAny && others.length > 0`. Featured na linha 26, Grid na linha 27. |
| `MestreInsightsSection.tsx` | ✅ **REESCRITO E AUDITADO (17/04/2026).** Props `metrics: InsightMetric[]` (linha 6). Ordena por views desc (linha 11). Cards com 4 métricas e ícones Lucide: Eye (views), MousePointerClick (clicks), MessageSquare (contacts), Heart (favorites). Classe condicional `insight-card--warning`. |
| `MestreRecommendationsSection.tsx` | ✅ **REESCRITO E AUDITADO (17/04/2026).** Props `recommendations: InsightRecommendation[]` (linha 5). Mapeamento `SEVERITY_META` com ícones Lucide por severidade: AlertTriangle (high), Info (medium), CheckCircle2 (low). Labels tipados: "Atenção", "Sugestão", "Dica". |
| `MestreFinalCta.tsx` | ✅ **IMPLEMENTADO E VALIDADO (17/04/2026).** Lógica de urgência permanece correta (`hasUrgentTable` + `isLowStock`) e o título agora é dinâmico via `urgencyText`: `🔥 Últimas vagas disponíveis` para mesa urgente e `⚡ Vagas limitadas` para baixa disponibilidade geral. |
| `MestreClosedGroupSection.tsx` | ✅ **CRIADO (17/04/2026).** Renderiza seção de grupo fechado quando `profile.closed_group.enabled === true`. Importado e usado em `MestrePage.tsx`. |
| `MestreBio.tsx` | ✅ **CRIADO (17/04/2026).** Seção dedicada com foto, bio longa em parágrafos, chips de especialidades e idiomas. Importado e usado em `MestrePage.tsx`. |
| `MestreSkeleton.tsx` | ✅ **COMPLETO E AUDITADO (17/04/2026).** Skeleton do hero implementado (linhas 7-20): avatar circular (linha 11), título (linha 12), bio em 2 linhas (linhas 13-14), dual-CTA skeleton (linhas 15-18). Grid com 6 TableCardSkeleton (linhas 23-27). |
| `MestreNotFound.tsx` / `MestreError.tsx` | ✅ OK. |
| `TableCard.tsx` | ✅ **COMPLETO E AUDITADO (17/04/2026).** ✅ Removidos: `h-[168px]`, `h-[252px]`, badge `animate-pulse` no card principal (só no skeleton), emoji ⚡, `min-h-[420px]` (linha 91 - removido em 17/04/2026 para permitir altura fluida baseada em conteúdo). ⚠️ "Ver detalhes →" existe (linha 58) mas é CTA funcional (não bloco morto) - mantido por ser parte da UX de navegação. |
| `LinksDisplay.tsx` | ✅ **COMPLETO E AUDITADO (17/04/2026).** Iframe único para embeds pesados (linhas 123-130) com `loading="lazy"` (linha 126) e `referrerPolicy="no-referrer-when-downgrade"` (linha 127). Categorias (linhas 43-48) usam ícones Lucide (Video, Share2, MessageCircle, BookOpen) sem emojis. Título principal (linha 68) usa ícone Lucide `<Mic2>` sem emoji. Patch 14 validado. |
| `useMestreInsights.ts` | ✅ **REESCRITO (17/04/2026).** Expõe `metrics: InsightMetric[]` e `recommendations: InsightRecommendation[]` estruturados. Mantém `insights: string[]` como `@deprecated` para compatibilidade. |
| `useMestre.ts` | ✅ **VALIDADO (17/04/2026).** Hook expõe as 7 chaves consumidas por `MestrePage.tsx`: `profile`, `links`, `mappedTables`, `totalOpenSlots`, `canSeeInsights`, `loading`, `error`. Estrutura confirmada e funcional. |
| `MestrePage.css` | ✅ **COMPLETO E AUDITADO (17/04/2026).** Arquivo com 1.055 linhas e 20.601 bytes. Todas as 12 classes V4 presentes: `hero-promo-badge` (459), `hero-title-accent` (475), `hero-ctas` (480), `hero-trust-row` (512), `mestre-bio-section` (535), `mestre-featured-table` (634), `closed-group-section` (797), `owner-only-banner` (883), `insight-card` (905), `insight-metrics` (927), `recommendation-item` (984), `recommendation-label` (1029). Patch 16 validado. |

### Backend

| Arquivo | Estado real |
|---|---|
| `gm.ts` | ✅ **COMPLETO E AUDITADO (17/04/2026).** `buildRecommendations` com dedupe completo (linhas 33-80): agrupa por título case-insensitive via `Map`, soma métricas do grupo (totalViews, totalClicks, totalContacts), adiciona sufixo `(X instâncias)` quando count > 1. Patch 1 validado. |
| `gmPanel.ts` | ✅ **Patch 3 já foi aplicado.** `POST /profile` aceita `tagline`, `promo_badge_text`, `selling_points`, `closed_group_*`. `PUT /profile` idem. `GET /me` retorna todos via `selectAll()`. `GET /tables` continua retornando `metrics_*` (correto, endpoint autenticado). **Pendência:** o `CreateGmProfileForm` em `PainelMestrePage.tsx` só envia `slug`, `nickname`, `bio_long` — precisa UI nova para os demais campos. |
| `links.ts` | ✅ CRUD completo. **Pendência:** `linkService.createUserLink` — preciso confirmar se já extrai `embed_url` ao detectar YouTube/Twitch/Spotify. Se não, adicionar. |
| `useLinks.ts` | ✅ Hook do frontend pronto para uso no painel. |

### Painel do Mestre

| Arquivo | Estado real |
|---|---|
| `PainelMestrePage.tsx` + `EditGmProfileForm.tsx` (Patch 21) | ✅ **COMPLETO E AUDITADO (17/04/2026).** EditGmProfileForm existe (686 linhas, 27.881 bytes). Interface `EditableGmProfile` com todos os 7 campos V4 (linhas 36-50). Estados inicializados (linhas 92-118). Payload PUT completo (linhas 262-276) para `/api/v1/gm/profile` (linhas 278-279). UI completa: tagline (linhas 335-346, textarea maxLength 200), promo_badge_text (linhas 385-396, input maxLength 120), selling_points (linhas 398-486, adicionar/remover/editar com 4 campos: icon, title, description, highlight), closed_group_enabled (linhas 582-591, checkbox), closed_group_systems (linhas 595-626, SystemTreeSelector), closed_group_description (linhas 628-638, textarea), closed_group_min_price_cents (linhas 640-653, input number com conversão reais→centavos). Importado e renderizado no PainelMestrePage na view 'edit-profile'. |
| `MyTableEnhanced` | ✅ Mapeamento de `metrics_*` em `metrics: {views, clicks, contacts, favorites}` já correto. |
| KPIs agregados (`totalViews`, `totalContacts`, `conversionRate`) | ✅ Funcionando. |

### Infraestrutura

| Item | Estado |
|---|---|
| `docker-compose.yml` do frontend | ✅ **SOLUÇÃO A.1 APLICADA (17/04/2026).** Frontend roda como container separado (`ports: "30300:80"`, Nginx interno). Nginx configurado com proxy condicional: detecta crawlers via `$http_user_agent` e redireciona para backend `/og/:type/:slug`; usuários normais recebem SPA. Volume compartilhado `frontend_dist` montado em ambos containers para acesso ao `index.html`. |
| **Rota `/og/:type/:slug`** (Patch 18) | ✅ **COMPLETO E AUDITADO (17/04/2026).** Arquivo `og.ts` (7.280 bytes) com rota genérica `/:type/:slug` (linha 117). Switch case para tipos extensíveis (linha 124): `case 'mestre'` implementado (linhas 125-172), busca dados do mestre, carrega index.html, injeta meta tags dinâmicas via `injectMetaTags()`, retorna HTML. Fallback para tipos desconhecidos (linha 174-180) retorna meta genérica. Registrada em server.ts. Extensível para futuros tipos (`mesa`, `evento`). |
| **Função `injectMetaTags`** (Patch 19) | ✅ **COMPLETO E AUDITADO (17/04/2026).** Função em og.ts (linhas 57-104). Interface `MetaFields` tipada (linhas 48-55). Sanitiza todos os campos via `escapeHtml()` (linhas 58-61, 66). Gera 16 meta tags: title, description, canonical, 9 OG (type, title, description, image, image:width, image:height, url, site_name, locale + extras), 4 Twitter (card, title, description, image). Remove duplicatas com 4 regex (linhas 91-94). Substitui `<title>` ou injeta antes de `</head>` (linhas 97-100). Dimensões OG: 1200×630 (hardcoded). Locale: pt_BR. |
| `index.html` (Patch 20) | ✅ **COMPLETO E AUDITADO (17/04/2026).** Arquivo com 32 linhas e 1.563 bytes. Meta tags básicas: charset UTF-8 (linha 4), viewport (linha 6), title estático (linha 8), description (linha 9). Open Graph fallback com comentário explicativo (linhas 11-19): 9 tags OG (type, title, description, image, image:width 1200, image:height 630, site_name, locale pt_BR). Twitter Cards fallback com comentário (linhas 21-25): 4 tags Twitter (card summary_large_image, title, description, image). Imagem: og-default.png (existe em public/). Compatível com injectMetaTags: todas as tags OG/Twitter e comentários serão removidos e substituídos por tags dinâmicas. |
| `package.json` | ⚠️ Sem `react-helmet-async` nem equivalente. Para OG isso é **vantagem** — vamos usar apenas server-side. |

### Decisão crítica sobre Open Graph

Diante do setup real (frontend servido por Nginx dentro do container `glossario-app`, **não** pelo Express do backend), a Solução A pura não funciona sem ajuste. Três caminhos possíveis:

- **A.1** — Adicionar rota Express no backend (`/mestre/:slug`) e configurar Nginx para fazer `proxy_pass` condicional: se `$http_user_agent` bater com regex de crawler, proxy para backend; caso contrário, servir o SPA.
- **A.2** — Fazer o Nginx injetar meta tags via `sub_filter` usando variáveis (impraticável — Nginx não acessa banco).
- **A.3** — Adicionar um **middleware Express no próprio container frontend** (trocar Nginx por um server Node simples que serve estáticos + faz SSR de meta tags para rotas `/mestre/:slug`).

**Escolhida: A.1** — mantém arquitetura atual (dois containers), usa o backend que já tem acesso ao banco, requer só ajuste no Nginx (~10 linhas).

Detalhes na seção 4.

---

## 2. Mapa dos 13 problemas ativos

Cada problema vira um patch na seção 5. Numeração segue a V3 onde aplicável, com novos (NOVO-X) adicionados.

| # | Problema | Referência | Gravidade |
|---|---|---|---|
| **P2** | Hero com 1 CTA, sem proposta de valor, stats derivadas | Print 1 | Alta |
| **P3** | Seção "Por que jogar comigo" não usa `selling_points` do backend | Print 3 | Alta |
| **P4** | Grid sem hierarquia de mesa-destaque | Print 2 | Alta |
| **P5** | `TableCard` com altura fixa e bloco "Ver detalhes" morto | Print 2 | Alta |
| **P6** | Badge "Últimas vagas" duplica SlotsIndicator | Print 2 | Média |
| **P8** | `LinksDisplay` com emoji em categorias e no `<h2>` | Prints 3–4 | Média |
| **P9** | `LinksDisplay` sem `loading="lazy"` em iframes | Prints 3–4 | Média |
| **P10** | `hero-stats` com stats derivadas em vez de `tables_count`/`avg_rating`/`reviews_count` | Print 1 | Alta |
| **P12** | Subtítulo "Escolha a mesa perfeita" aparece mesmo com 0 mesas | Print 2 | Baixa |
| **P14** | Seção Grupo Fechado não renderiza | — | Alta |
| **P17-NOVO** | Insights/Recomendações em texto corrido (hook destrói tipagem) | Prints 5–6 | Alta |
| **P18-NOVO** | CTA final "Últimas vagas" sempre renderiza (sem condicional de urgência) | Print 7 | Média |
| **P19-NOVO** | Painel do Mestre sem UI para `tagline`, `selling_points`, `promo_badge_text`, `closed_group_*` | — | Alta |
| **P20-NOVO** | Zero Open Graph / Twitter Cards / `<meta>` dinâmico em `/mestre/:slug` | `index.html` | Alta |
| **P21-NOVO** | `buildRecommendations` no backend gera recomendações duplicadas quando títulos se repetem | Print 6 | Média |
| **P22-NOVO** | `MestreSkeleton` não simula hero, só grid de cards | — | Baixa |

---

## 3. Arquitetura de componentes (target V4)

### Ordem final de renderização em `MestrePage.tsx`

```
<main className="mestre-page">
  <MestreHero>                     ← reescrito (dual-CTA, title-accent, trust-row, stats reais)
  <MestreBio>                      ← NOVO (foto + bio longa + chips specialties + tagline blockquote)
  <MestreSellingPoints>            ← NOVO (iteração data-driven sobre profile.selling_points)
  <section id="mesas">
    <MestreFeaturedTable>          ← NOVO (se houver mesa com featured===true)
    <MestreTablesGrid>             ← wrapper ao redor do grid atual (só não-featured)
  </section>
  <MestreClosedGroupSection>       ← NOVO (se profile.closed_group.enabled)
  {canSeeInsights && <MestreInsightsSection>}         ← reescrito (cards com metric-value)
  {canSeeInsights && <MestreRecommendationsSection>}  ← reescrito (Lucide icons, labels, dedup)
  {links.length > 0 && <LinksDisplay>}                ← ajustado (Lucide, lazy)
  {shouldShowFinalCta && <MestreFinalCta>}            ← condicional de urgência
</main>
```

### Componentes a criar (5)

1. `MestreBio.tsx`
2. `MestreSellingPoints.tsx`
3. `MestreFeaturedTable.tsx`
4. `MestreTablesGrid.tsx`
5. `MestreClosedGroupSection.tsx`

### Componentes a reescrever (5)

1. `MestreHero.tsx` — dual-CTA, accent, trust-row, stats reais
2. `MestreInsightsSection.tsx` — cards estruturados
3. `MestreRecommendationsSection.tsx` — Lucide + dedup
4. `MestreFinalCta.tsx` — condicional
5. `MestreSkeleton.tsx` — skeleton do hero + bio + grid

### Componentes a ajustar pontualmente (3)

1. `MestreTablesSection.tsx` — trocar render plano por FeaturedTable + TablesGrid + subtítulo condicional
2. `TableCard.tsx` — aplicar Patch 7 da V3
3. `LinksDisplay.tsx` — aplicar Patch 8 da V3 + título com Lucide

### Componentes a remover (1)

1. `MestreWhySection.tsx` — substituído por `MestreSellingPoints` + `MestreBio` (partes diferentes)

### Hook a reescrever (1)

1. `useMestreInsights.ts` — expor `metrics: InsightMetric[]` e `recommendations: InsightRecommendation[]` estruturados

---

## 4. Open Graph dinâmico — decisão técnica e plano

### Contexto do seu setup

- Frontend roda em container próprio (`glossario-app`) expondo porta 80 (Nginx interno serve `dist/`).
- Backend roda em outro container (rede `gerenciador_telegram_default`).
- Domínio final: **preciso que você confirme.** Presumo `mesas.artificiorpg.com` pelo naming.

### Como funciona crawler de OG

WhatsApp, Discord, Facebook, LinkedIn, Slack e Twitter/X fazem requisição HTTP GET ao seu link e leem o HTML retornado. **Não executam JavaScript.** Seu SPA (Vite/React) retorna um `index.html` genérico com `<div id="root"></div>` vazio — zero contexto. Preview do link fica quebrado.

### Solução escolhida: A.1 — rota SSR mínima no backend + proxy condicional no Nginx

**Backend (novo arquivo `backend/src/routes/og.ts`):**

- Rota `GET /og/mestre/:slug` que:
  1. Lê `frontend/dist/index.html` do disco (ou de um volume compartilhado).
  2. Busca dados públicos do mestre em `gm_profiles` + `profiles`.
  3. Injeta `<meta property="og:*">`, `<meta name="twitter:*">`, `<title>`, `<link rel="canonical">` dentro do `<head>` via substituição de string.
  4. Retorna HTML final.
- Fallback: se mestre não existe ou query falha, retorna `index.html` puro com tags genéricas do site.

**Nginx do container frontend:**

- Adicionar `map` para detectar user-agent de crawler.
- Para rotas que batem em `/mestre/*`, se user-agent é crawler, fazer `proxy_pass` para `http://backend:3000/og/mestre/:slug`.
- Caso contrário (humano), servir o SPA normalmente via `try_files`.

**Volume compartilhado:**

- Opção 1 (preferida): o backend tem acesso a um volume `dist/` montado do frontend. Simples: `docker-compose` monta o mesmo volume em ambos. Custo zero.
- Opção 2: o backend tem um `<!DOCTYPE html>...` hardcoded como string em código, baseado na saída conhecida do Vite. Pior — desacopla do build real.
- **Escolha:** Opção 1. Ajuste no `docker-compose.yml` para compartilhar volume.

### User-agents de crawler a detectar

```
(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|Discordbot|
 TelegramBot|Googlebot|Applebot|bingbot|Embedly|vkShare|W3C_Validator|
 redditbot|SkypeUriPreview)
```

### Metadados gerados por mestre

```html
<title>{display_name} — Mestre de RPG | Artifício Mesas</title>
<meta name="description" content="{tagline || bio_long.slice(0,160)}">
<link rel="canonical" href="https://mesas.artificiorpg.com/mestre/{slug}">

<!-- Open Graph -->
<meta property="og:type" content="profile">
<meta property="og:title" content="{display_name} — Mestre de RPG">
<meta property="og:description" content="...">
<meta property="og:image" content="{avatar_url || banner_url || default_og_image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://mesas.artificiorpg.com/mestre/{slug}">
<meta property="og:site_name" content="Artifício Mesas">
<meta property="og:locale" content="pt_BR">
<meta property="profile:username" content="{slug}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{display_name} — Mestre de RPG">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="{avatar_url || banner_url || default_og_image}">
```

### Rotas cobertas (v1)

- `/` → metadata genérica do site.
- `/mestre/:slug` → metadata dinâmica do mestre.
- `/mesas/:slug` → metadata dinâmica da mesa (v2, fora de escopo imediato).
- `/catalogo` → metadata genérica de catálogo.

V1 implementa apenas `/mestre/:slug` + fallback genérico. `/mesas/:slug` fica registrado como próximo passo.

### Escape de HTML obrigatório

Qualquer campo injetado no HTML **deve** passar por função de escape (`&`, `<`, `>`, `"`, `'`). Caso contrário, bio com aspas quebra o HTML e pode abrir vetor de injeção.

### Testes após deploy

- **Validador oficial do Facebook:** https://developers.facebook.com/tools/debug/
- **Validador do Twitter:** https://cards-dev.twitter.com/validator (X)
- **Validador do LinkedIn:** https://www.linkedin.com/post-inspector/
- **WhatsApp:** manda link para você mesmo em chat privado. Preview aparece após poucos segundos.
- **Discord:** cola link em qualquer canal de teste.

---

## 5. Patches em ordem de execução

### Patch 1 — Backend: deduplicar `buildRecommendations`

**Arquivo:** `backend/src/routes/gm.ts`

**Substituir a função `buildRecommendations`:**

```ts
function buildRecommendations(metrics: MetricRow[]): Recommendation[] {
  // Agrupa por title para evitar 3x "Pathfinder: Kingmaker"
  const byTitle = new Map<string, MetricRow[]>();
  for (const m of metrics) {
    const key = m.title.trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(m);
  }

  const recs: Recommendation[] = [];

  for (const group of byTitle.values()) {
    // Se há múltiplas mesas com mesmo título, agrega a primeira e indica quantidade
    const first = group[0];
    const count = group.length;
    const suffix = count > 1 ? ` (${count} instâncias)` : '';

    // Soma métricas do grupo para evitar falso positivo (ex.: "0 views" quando uma das 3 mesas tem views)
    const totalViews = group.reduce((s, m) => s + m.views, 0);
    const totalClicks = group.reduce((s, m) => s + m.clicks, 0);
    const totalContacts = group.reduce((s, m) => s + m.contacts, 0);

    if (totalViews >= 20 && totalContacts === 0) {
      recs.push({
        table_slug: first.slug,
        severity: 'high',
        message: `Mesa "${first.title}"${suffix} tem ${totalViews} visualizações e zero contatos. Revise capa, preço e descrição.`,
      });
      continue;
    }
    if (totalClicks >= 10 && totalContacts === 0) {
      recs.push({
        table_slug: first.slug,
        severity: 'medium',
        message: `Mesa "${first.title}"${suffix} recebe cliques mas não gera contato. Teste um CTA mais direto na descrição.`,
      });
      continue;
    }
    if (totalViews === 0 && totalClicks === 0) {
      recs.push({
        table_slug: first.slug,
        severity: 'low',
        message: `Mesa "${first.title}"${suffix} ainda não recebeu tráfego. Compartilhe o link em suas redes.`,
      });
    }
  }

  return recs;
}
```

**Motivo:** Print 6 mostra 3x a mesma recomendação para "Pathfinder: Kingmaker". Essa implementação agrupa por título (case-insensitive), agrega métricas e indica instâncias quando há repetição.

---

### Patch 2 — Hook: `useMestreInsights.ts` reescrito (tipagem estruturada)

**Arquivo:** `frontend/src/hooks/useMestreInsights.ts`

**Substituir arquivo inteiro:**

```ts
import { useEffect, useState } from 'react';

export interface InsightMetric {
  id: string;
  slug: string;
  title: string;
  views: number;
  clicks: number;
  contacts: number;
  favorites: number;
}

export interface InsightRecommendation {
  table_slug: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface UseMestreInsightsParams {
  slug?: string;
  canSeeInsights: boolean;
}

interface UseMestreInsightsResult {
  metrics: InsightMetric[];
  recommendations: InsightRecommendation[];
  insightsLoading: boolean;
  /** @deprecated Campo legado mantido para compatibilidade com componentes antigos. */
  insights: string[];
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useMestreInsights({
  slug,
  canSeeInsights,
}: UseMestreInsightsParams): UseMestreInsightsResult {
  const [metrics, setMetrics] = useState<InsightMetric[]>([]);
  const [recommendations, setRecommendations] = useState<InsightRecommendation[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      if (!slug || !canSeeInsights) {
        setMetrics([]);
        setRecommendations([]);
        return;
      }

      setInsightsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/gm/${slug}/insights`, {
          signal: controller.signal,
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setMetrics(json?.data?.metrics ?? []);
        setRecommendations(json?.data?.recommendations ?? []);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setMetrics([]);
        setRecommendations([]);
      } finally {
        setInsightsLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [slug, canSeeInsights]);

  return {
    metrics,
    recommendations,
    insightsLoading,
    // campo legado para minimizar churn até todos os consumidores migrarem
    insights: metrics.map(
      (m) => `${m.title}: ${m.views} visualizações, ${m.contacts} contatos e ${m.favorites} favoritos.`
    ),
  };
}
```

**Motivo:** devolve `metrics[]` e `recommendations[]` estruturados para os componentes renderizarem cards tipados. Mantém `insights: string[]` legado só para não quebrar componentes antigos durante a transição (remove após refactor completo).

---

### Patch 3 — `MestreInsightsSection.tsx` com cards estruturados

**Arquivo:** `frontend/src/components/mestre/MestreInsightsSection.tsx`

**Substituir arquivo inteiro:**

```tsx
import { Eye, MousePointerClick, MessageSquare, Heart, Lock } from 'lucide-react';
import type { InsightMetric } from '../../hooks/useMestreInsights';

interface Props {
  insightsLoading: boolean;
  metrics: InsightMetric[];
}

export function MestreInsightsSection({ insightsLoading, metrics }: Props) {
  // Ordena por views desc para destacar o que mais recebe tráfego
  const sorted = [...metrics].sort((a, b) => b.views - a.views);

  return (
    <section className="insights-section mestre-private-panel mestre-private-panel--insights">
      <div className="container mestre-private-panel-container">
        <div className="owner-only-banner">
          <Lock size={14} />
          <span>Visível apenas para você</span>
        </div>

        <h2 className="section-title">Insights das suas mesas</h2>

        {insightsLoading && (
          <p className="mestre-private-panel-loading">Carregando métricas…</p>
        )}

        {!insightsLoading && sorted.length === 0 && (
          <p className="mestre-private-panel-empty">
            Ainda não há métricas para exibir. Divulgue suas mesas para começar a coletar dados.
          </p>
        )}

        {!insightsLoading && sorted.length > 0 && (
          <div className="insights-grid">
            {sorted.map((m) => {
              const needsAttention = m.views >= 10 && m.contacts === 0;
              return (
                <article
                  key={m.id}
                  className={`insight-card${needsAttention ? ' insight-card--warning' : ''}`}
                >
                  <h3 className="insight-title">{m.title}</h3>
                  <div className="insight-metrics">
                    <div className="metric">
                      <Eye className="metric-icon" />
                      <span className="metric-value">{m.views}</span>
                      <span className="metric-label">Visualizações</span>
                    </div>
                    <div className="metric">
                      <MousePointerClick className="metric-icon" />
                      <span className="metric-value">{m.clicks}</span>
                      <span className="metric-label">Cliques</span>
                    </div>
                    <div className="metric">
                      <MessageSquare className="metric-icon" />
                      <span className="metric-value">{m.contacts}</span>
                      <span className="metric-label">Contatos</span>
                    </div>
                    <div className="metric">
                      <Heart className="metric-icon" />
                      <span className="metric-value">{m.favorites}</span>
                      <span className="metric-label">Favoritos</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
```

---

### Patch 4 — `MestreRecommendationsSection.tsx` com Lucide e estrutura

**Arquivo:** `frontend/src/components/mestre/MestreRecommendationsSection.tsx`

**Substituir arquivo inteiro:**

```tsx
import { AlertTriangle, Info, CheckCircle2, Lock } from 'lucide-react';
import type { InsightRecommendation } from '../../hooks/useMestreInsights';

interface Props {
  recommendations: InsightRecommendation[];
}

const SEVERITY_META = {
  high: {
    Icon: AlertTriangle,
    label: 'Atenção',
    className: 'recommendation-item--high',
  },
  medium: {
    Icon: Info,
    label: 'Sugestão',
    className: 'recommendation-item--medium',
  },
  low: {
    Icon: CheckCircle2,
    label: 'Dica',
    className: 'recommendation-item--low',
  },
} as const;

export function MestreRecommendationsSection({ recommendations }: Props) {
  if (recommendations.length === 0) return null;

  return (
    <section className="recommendations-section mestre-private-panel mestre-private-panel--recommendations">
      <div className="container mestre-private-panel-container">
        <div className="owner-only-banner">
          <Lock size={14} />
          <span>Visível apenas para você</span>
        </div>

        <h2 className="section-title">Recomendações personalizadas</h2>

        <ul className="recommendations-list">
          {recommendations.map((rec, idx) => {
            const meta = SEVERITY_META[rec.severity];
            const Icon = meta.Icon;
            return (
              <li key={`${rec.table_slug}-${idx}`} className={`recommendation-item ${meta.className}`}>
                <Icon className="recommendation-icon" size={20} />
                <div className="recommendation-body">
                  <span className="recommendation-label">{meta.label}</span>
                  <p className="recommendation-message">{rec.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
```

---

### Patch 5 — `MestreHero.tsx` reescrito

**Arquivo:** `frontend/src/components/mestre/MestreHero.tsx`

**Substituir arquivo inteiro:**

```tsx
import { CheckCircle2, Sparkles, Crown, Award, Users, Star, MessageSquare } from 'lucide-react';
import type { TableCard } from '../../types/tables';
import type { MestrePublicData } from '../../hooks/useMestre';

interface MestreHeroProps {
  profile: MestrePublicData;
  mappedTables: TableCard[];
  totalOpenSlots: number;
}

export function MestreHero({ profile, mappedTables, totalOpenSlots }: MestreHeroProps) {
  const hasAnyStat =
    (profile.tables_count ?? 0) > 0 ||
    (profile.avg_rating ?? 0) > 0 ||
    (profile.reviews_count ?? 0) > 0;

  const hasAnyTrust =
    (profile.tables_count ?? 0) > 0 ||
    profile.covil_verified ||
    (profile.experience_years ?? 0) >= 3;

  const scrollTo = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-section">
      {profile.banner_url ? (
        <img src={profile.banner_url} alt="" className="hero-banner" />
      ) : (
        <div className="hero-banner-gradient" />
      )}
      <div className="hero-overlay" />

      <div className="hero-content">
        {profile.promo_badge_text && (
          <div className="hero-promo-badge">
            <Sparkles className="w-4 h-4" />
            <span>{profile.promo_badge_text}</span>
          </div>
        )}

        <div className="hero-avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name} />
          ) : (
            <div className="hero-avatar-placeholder">
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="hero-badges">
          <span className="badge badge-mestre">
            <Crown className="w-4 h-4" /> Mestre
          </span>
          {profile.covil_verified && (
            <span className="badge badge-covil">
              <Award className="w-4 h-4" /> Mestre do Covil
            </span>
          )}
        </div>

        <h1 className="hero-title">
          Viva aventuras com{' '}
          <span className="hero-title-accent">{profile.display_name}</span>
        </h1>

        {profile.bio_long && (
          <p className="hero-bio">{profile.bio_long}</p>
        )}

        <div className="hero-ctas">
          <button
            type="button"
            className="cta-button cta-primary"
            onClick={scrollTo('contato')}
          >
            Entrar em contato
          </button>
          {mappedTables.length > 0 && (
            <button
              type="button"
              className="cta-button cta-secondary"
              onClick={scrollTo('mesas')}
            >
              Ver mesas disponíveis
            </button>
          )}
        </div>

        {hasAnyTrust && (
          <div className="hero-trust-row">
            {(profile.tables_count ?? 0) > 0 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                {profile.tables_count} {profile.tables_count === 1 ? 'mesa ativa' : 'mesas ativas'}
              </span>
            )}
            {profile.covil_verified && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                Verificado no Covil
              </span>
            )}
            {(profile.experience_years ?? 0) >= 3 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                {profile.experience_years}+ anos de experiência
              </span>
            )}
          </div>
        )}

        {hasAnyStat && (
          <div className="hero-stats">
            {(profile.tables_count ?? 0) > 0 && (
              <div className="stat">
                <Users className="stat-icon" />
                <span className="stat-value">{profile.tables_count}</span>
                <span className="stat-label">
                  {profile.tables_count === 1 ? 'Mesa' : 'Mesas'}
                </span>
              </div>
            )}
            {(profile.avg_rating ?? 0) > 0 && (
              <div className="stat">
                <Star className="stat-icon" />
                <span className="stat-value">{profile.avg_rating!.toFixed(1)}★</span>
                <span className="stat-label">Avaliação</span>
              </div>
            )}
            {(profile.reviews_count ?? 0) > 0 && (
              <div className="stat">
                <MessageSquare className="stat-icon" />
                <span className="stat-value">{profile.reviews_count}</span>
                <span className="stat-label">
                  {profile.reviews_count === 1 ? 'Avaliação' : 'Avaliações'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
```

**Motivo:** dual-CTA, accent no nome, trust-row e stats apenas com dados reais, badge promocional condicional. **Sem stats derivadas** (`totalOpenSlots` e `experience_years` não vão mais para `hero-stats` — viram trust items).

---

### Patch 6 — `MestreBio.tsx` (novo)

**Arquivo novo:** `frontend/src/components/mestre/MestreBio.tsx`

```tsx
import { Sparkles, Globe, Languages } from 'lucide-react';
import type { MestrePublicData } from '../../hooks/useMestre';

interface Props {
  profile: MestrePublicData;
}

export function MestreBio({ profile }: Props) {
  const hasSpecialties = (profile.specialties?.length ?? 0) > 0;
  const hasLanguages = (profile.languages?.length ?? 0) > 0;
  const hasTagline = !!profile.tagline?.trim();
  const hasBio = !!profile.bio_long?.trim();

  if (!hasSpecialties && !hasLanguages && !hasTagline && !hasBio) return null;

  // Split bio em parágrafos para preservar quebras
  const bioParagraphs = hasBio
    ? profile.bio_long!.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)
    : [];

  return (
    <section className="mestre-bio-section">
      <div className="container">
        <h2 className="section-title">Sobre {profile.display_name}</h2>

        <div className="mestre-bio-grid">
          {profile.avatar_url && (
            <div className="mestre-bio-photo">
              <img src={profile.avatar_url} alt={profile.display_name} />
            </div>
          )}

          <div className="mestre-bio-content">
            {bioParagraphs.length > 0 && (
              <div className="mestre-bio-text">
                {bioParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}

            {hasSpecialties && (
              <div className="mestre-bio-chips">
                <span className="mestre-bio-chips-label">
                  <Sparkles className="w-4 h-4" /> Especialidades
                </span>
                <div className="mestre-bio-chips-list">
                  {profile.specialties!.map((s, i) => (
                    <span key={i} className="mestre-bio-chip">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasLanguages && (
              <div className="mestre-bio-chips">
                <span className="mestre-bio-chips-label">
                  <Languages className="w-4 h-4" /> Idiomas
                </span>
                <div className="mestre-bio-chips-list">
                  {profile.languages!.map((l, i) => (
                    <span key={i} className="mestre-bio-chip mestre-bio-chip--outline">
                      <Globe className="w-3 h-3" /> {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasTagline && (
              <blockquote className="mestre-bio-tagline">
                "{profile.tagline}"
              </blockquote>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

### Patch 7 — `MestreSellingPoints.tsx` (novo)

**Arquivo novo:** `frontend/src/components/mestre/MestreSellingPoints.tsx`

```tsx
import {
  Clock,
  Monitor,
  Coins,
  Sparkles,
  Shield,
  Heart,
  Zap,
  Users,
  Trophy,
  Headphones,
  Mic,
  Video,
  Film,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

interface SellingPoint {
  icon: string;
  title: string;
  description: string;
  highlight?: string;
}

interface Props {
  sellingPoints: SellingPoint[] | null | undefined;
}

const SELLING_POINT_ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  monitor: Monitor,
  coins: Coins,
  sparkles: Sparkles,
  shield: Shield,
  heart: Heart,
  zap: Zap,
  users: Users,
  trophy: Trophy,
  headphones: Headphones,
  mic: Mic,
  video: Video,
  film: Film,
  book: BookOpen,
};

export function MestreSellingPoints({ sellingPoints }: Props) {
  if (!Array.isArray(sellingPoints) || sellingPoints.length === 0) return null;

  return (
    <section className="why-section">
      <div className="container">
        <h2 className="section-title">O que eu ofereço</h2>
        <div className="benefits-grid">
          {sellingPoints.map((sp, idx) => {
            const Icon = SELLING_POINT_ICONS[sp.icon?.toLowerCase()] ?? Sparkles;
            return (
              <div key={idx} className="benefit-card">
                <Icon className="benefit-icon" />
                <h3>{sp.title}</h3>
                <p>{sp.description}</p>
                {sp.highlight && (
                  <span className="benefit-highlight">{sp.highlight}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

**Motivo:** iteração 100% data-driven. Sem fallback, sem branch hardcoded. Se `selling_points` vazio, seção some completamente.

---

### Patch 8 — `MestreFeaturedTable.tsx` (novo)

**Arquivo novo:** `frontend/src/components/mestre/MestreFeaturedTable.tsx`

```tsx
import { Link } from 'react-router-dom';
import { CheckCircle2, Star, Dice1, Globe, MapPin } from 'lucide-react';
import type { TableCard } from '../../types/tables';
import { SlotsIndicator } from '../SlotsIndicator';
import { getSlotsVisualState } from '../../utils/slots';
import bannerPlaceholder from '../../assets/banner_placeholder.webp';

interface Props {
  table: TableCard;
}

const modalityLabels: Record<string, string> = {
  online: 'Online',
  presencial: 'Presencial',
  hibrida: 'Híbrida',
};

export function MestreFeaturedTable({ table }: Props) {
  const { isFull } = getSlotsVisualState(table);
  const features: string[] = Array.isArray((table as any).features)
    ? ((table as any).features as string[])
    : [];

  return (
    <article className="mestre-featured-table">
      <Link
        to={`/mesas/${table.slug}`}
        className="mestre-featured-table-link"
        id={`featured-table-${table.slug}`}
      >
        <div className="mestre-featured-table-cover">
          <img
            src={table.cover_url || bannerPlaceholder}
            alt={table.title}
            onError={(event) => {
              const img = event.currentTarget;
              if (img.dataset.fallbackApplied === 'true') return;
              img.dataset.fallbackApplied = 'true';
              img.src = bannerPlaceholder;
            }}
          />
          <span className="mestre-featured-table-badge">
            <Star className="w-4 h-4" /> Mesa em destaque
          </span>
        </div>

        <div className="mestre-featured-table-content">
          <div className="mestre-featured-table-tags">
            {table.system_name && (
              <span className="mestre-featured-table-tag">
                <Dice1 className="w-3 h-3" /> {table.system_name}
              </span>
            )}
            <span className="mestre-featured-table-tag">
              {table.modality === 'online' ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              {modalityLabels[table.modality] ?? table.modality}
            </span>
          </div>

          <h3 className="mestre-featured-table-title">{table.title}</h3>

          {table.description && (
            <p className="mestre-featured-table-description">{table.description}</p>
          )}

          {features.length > 0 && (
            <ul className="mestre-featured-table-features">
              {features.slice(0, 5).map((feat, i) => (
                <li key={i}>
                  <CheckCircle2 className="w-4 h-4" /> {feat}
                </li>
              ))}
            </ul>
          )}

          <div className="mestre-featured-table-footer">
            <SlotsIndicator table={table} />
            {table.price_type === 'gratuita' ? (
              <span className="mestre-featured-table-price mestre-featured-table-price--free">
                Gratuito
              </span>
            ) : table.price_value ? (
              <span className="mestre-featured-table-price">
                R$ {table.price_value}
                <span className="mestre-featured-table-price-suffix"> / sessão</span>
              </span>
            ) : null}
          </div>

          <div className="mestre-featured-table-cta-wrapper">
            <span
              className={`cta-button cta-button-large${isFull ? ' cta-button-disabled' : ''}`}
            >
              {isFull ? 'Mesa lotada' : 'Quero jogar esta aventura →'}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
```

---

### Patch 9 — `MestreTablesGrid.tsx` (novo, wrapper)

**Arquivo novo:** `frontend/src/components/mestre/MestreTablesGrid.tsx`

```tsx
import { TableCardComponent } from '../TableCard';
import type { TableCard } from '../../types/tables';

interface Props {
  tables: TableCard[];
}

export function MestreTablesGrid({ tables }: Props) {
  if (tables.length === 0) return null;

  return (
    <div className="tables-grid">
      {tables.map((t) => (
        <TableCardComponent key={t.id} table={t} />
      ))}
    </div>
  );
}
```

---

### Patch 10 — `MestreTablesSection.tsx` atualizado

**Arquivo:** `frontend/src/components/mestre/MestreTablesSection.tsx`

**Substituir arquivo inteiro:**

```tsx
import type { TableCard } from '../../types/tables';
import { MestreFeaturedTable } from './MestreFeaturedTable';
import { MestreTablesGrid } from './MestreTablesGrid';

interface Props {
  mappedTables: TableCard[];
}

export function MestreTablesSection({ mappedTables }: Props) {
  const featured = mappedTables.find((t) => t.featured);
  const others = mappedTables.filter((t) => !t.featured);

  const hasAny = mappedTables.length > 0;

  return (
    <section id="mesas" className="tables-section">
      <div className="container">
        <h2 className="section-title">Mesas Disponíveis</h2>

        {hasAny && others.length > 0 && (
          <p className="tables-subtitle">
            Escolha a mesa perfeita para você e comece sua aventura hoje mesmo!
          </p>
        )}

        {featured && <MestreFeaturedTable table={featured} />}
        {others.length > 0 && <MestreTablesGrid tables={others} />}

        {!hasAny && (
          <div className="no-tables">
            <p>Este mestre ainda não possui mesas ativas.</p>
            <p className="no-tables-hint">Volte em breve para conferir novas aventuras!</p>
          </div>
        )}
      </div>
    </section>
  );
}
```

---

### Patch 11 — `MestreClosedGroupSection.tsx` (novo)

**Arquivo novo:** `frontend/src/components/mestre/MestreClosedGroupSection.tsx`

```tsx
import { Users, Dices, Tag } from 'lucide-react';

interface ClosedGroupInfo {
  enabled: boolean;
  systems: Array<{ id: string; name: string }>;
  description: string | null;
  min_price_cents: number | null;
}

interface Props {
  closedGroup: ClosedGroupInfo | null | undefined;
}

function formatPriceBRL(cents: number | null): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function MestreClosedGroupSection({ closedGroup }: Props) {
  if (!closedGroup?.enabled) return null;

  const price = formatPriceBRL(closedGroup.min_price_cents);

  const handleScrollToContact = () => {
    const el = document.getElementById('contato');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      document.getElementById('mesas')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="closed-group-section" id="grupo-fechado">
      <div className="container">
        <div className="closed-group-badge">
          <Users className="w-4 h-4" />
          <span>Oferta especial</span>
        </div>

        <h2 className="section-title">Disponível para grupos fechados</h2>

        <p className="closed-group-description">
          {closedGroup.description ||
            'Tem um grupo fechado de amigos? Mestro campanhas exclusivas com horários flexíveis e experiência personalizada para o seu grupo.'}
        </p>

        {closedGroup.systems.length > 0 && (
          <div className="closed-group-systems">
            <h3 className="closed-group-subtitle">
              <Dices className="w-4 h-4" /> Sistemas aceitos
            </h3>
            <div className="closed-group-chips">
              {closedGroup.systems.map((s) => (
                <span key={s.id} className="closed-group-chip">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {price && (
          <div className="closed-group-price">
            <Tag className="w-4 h-4" />
            <span>
              A partir de <strong>{price}</strong>
            </span>
          </div>
        )}

        <button
          type="button"
          className="cta-button cta-button-large"
          onClick={handleScrollToContact}
        >
          Solicitar orçamento
        </button>
      </div>
    </section>
  );
}
```

---

### Patch 12 — `MestreFinalCta.tsx` com condicional de urgência

**Arquivo:** `frontend/src/components/mestre/MestreFinalCta.tsx`

**Substituir arquivo inteiro:**

```tsx
import type { TableCard } from '../../types/tables';
import { getSlotsVisualState } from '../../utils/slots';

interface Props {
  totalOpenSlots: number;
  tablesCount: number;
  mappedTables: TableCard[];
}

export function MestreFinalCta({ totalOpenSlots, tablesCount, mappedTables }: Props) {
  const hasUrgentTable = mappedTables.some((t) => {
    const { isUrgent, isFull } = getSlotsVisualState(t);
    return isUrgent && !isFull;
  });

  const isLowStock = totalOpenSlots > 0 && totalOpenSlots <= 5;

  // Só renderiza se há urgência REAL
  if (!hasUrgentTable && !isLowStock) return null;

  return (
    <section className="final-cta-section">
      <div className="container">
        <div className="final-cta-card">
          <h2>🔥 Últimas vagas disponíveis</h2>
          <p className="final-cta-subtitle">
            {totalOpenSlots}{' '}
            {totalOpenSlots === 1 ? 'vaga restante' : 'vagas restantes'} em{' '}
            {tablesCount} {tablesCount === 1 ? 'mesa' : 'mesas'}
          </p>
          <a href="#mesas" className="cta-button cta-button-large">
            Ver mesas e garantir vaga
          </a>
          <p className="final-cta-hint">
            ⏰ As vagas preenchem rápido. Não perca sua chance!
          </p>
        </div>
      </div>
    </section>
  );
}
```

**Motivo:** só aparece se há urgência real (mesa com `isUrgent` ou total ≤ 5 vagas). Em Print 7 havia 45 vagas — não deveria aparecer.

---

### Patch 13 — `TableCard.tsx` aplicando Patch 7 da V3

**Arquivo:** `frontend/src/components/TableCard.tsx`

**Mudanças:**

1. **Container principal** — trocar classe:
   - **De:** `h-[420px] block`
   - **Para:** `min-h-[420px] flex flex-col`
2. **Capa:**
   - **De:** `<div className="h-[168px] relative overflow-hidden">`
   - **Para:** `<div className="aspect-[16/10] w-full relative overflow-hidden">`
3. **Conteúdo:**
   - **De:** `<div className="h-[252px] p-4 flex flex-col">`
   - **Para:** `<div className="flex-1 p-4 flex flex-col">`
4. **Badge urgente — substituir bloco:**

```tsx
{isFull && (
  <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-wide text-white bg-red-600 backdrop-blur-sm">
    Lotada
  </span>
)}
```

5. **Remover inteiramente** o bloco:
```tsx
{canJoinDirectly && (
  <div className="text-center">
    <span className="text-xs text-white/60 hover:text-white transition-colors cursor-pointer">
      Ver detalhes
    </span>
  </div>
)}
```

---

### Patch 14 — `LinksDisplay.tsx` aplicando Patch 8 da V3

**Arquivo:** `frontend/src/components/LinksDisplay.tsx`

**Mudanças:**

1. **Imports:** adicionar `BookOpen, Mic2`:
```tsx
import { Video, Music, Radio, MessageCircle, FileText, Globe, ExternalLink, Camera, Share2, Briefcase, BookOpen, Mic2 } from 'lucide-react';
```

2. **Substituir `CATEGORY_LABELS` por `CATEGORY_META`:**
```tsx
const CATEGORY_META: Record<string, { label: string; Icon: typeof Video }> = {
  content:   { label: 'Conteúdo',   Icon: Video },
  social:    { label: 'Presença',   Icon: Share2 },
  authority: { label: 'Autoridade', Icon: BookOpen },
};
```

3. **Título da seção** — substituir `<h2>🎙️ Conteúdo & Redes</h2>` por:
```tsx
<h2 className="links-display-title">
  <Mic2 className="inline-block mr-2 w-5 h-5" />
  Conteúdo & Redes
</h2>
```

4. **Render do título de categoria:**
```tsx
<h3 className="category-title">
  {(() => {
    const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
    if (!meta) return category;
    const { label, Icon } = meta;
    return <><Icon className="inline-block mr-2 w-4 h-4" />{label}</>;
  })()}
</h3>
```

5. **Iframe — trocar atributos:**
```tsx
<iframe
  src={link.embed_url}
  title={link.title || label}
  loading="lazy"
  referrerPolicy="no-referrer-when-downgrade"
  allow={link.type === 'youtube' ? "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" : "encrypted-media"}
  allowFullScreen={link.type === 'youtube' || link.type === 'twitch'}
/>
```

6. **Remover URL crua** do render do card:
   - Localizar `<h3 className="link-card-title">` e **não** renderizar a URL abaixo quando ela é igual ao hostname.

---

### Patch 15 — `MestrePage.tsx` composição final

**Arquivo:** `frontend/src/pages/MestrePage.tsx`

**Substituir arquivo inteiro:**

```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LinksDisplay } from '../components/LinksDisplay';
import { MestreBio } from '../components/mestre/MestreBio';
import { MestreClosedGroupSection } from '../components/mestre/MestreClosedGroupSection';
import { MestreError } from '../components/mestre/MestreError';
import { MestreFinalCta } from '../components/mestre/MestreFinalCta';
import { MestreHero } from '../components/mestre/MestreHero';
import { MestreInsightsSection } from '../components/mestre/MestreInsightsSection';
import { MestreNotFound } from '../components/mestre/MestreNotFound';
import { MestreRecommendationsSection } from '../components/mestre/MestreRecommendationsSection';
import { MestreSellingPoints } from '../components/mestre/MestreSellingPoints';
import { MestreSkeleton } from '../components/mestre/MestreSkeleton';
import { MestreTablesSection } from '../components/mestre/MestreTablesSection';
import { applySeo } from '../utils/seo';
import { useMestre } from '../hooks/useMestre';
import { useMestreInsights } from '../hooks/useMestreInsights';
import './MestrePage.css';

export const MestrePage = () => {
  const { slug } = useParams<{ slug: string }>();

  const {
    profile,
    links,
    mappedTables,
    totalOpenSlots,
    canSeeInsights,
    loading,
    error,
  } = useMestre(slug);

  const { metrics, recommendations, insightsLoading } = useMestreInsights({
    slug,
    canSeeInsights,
  });

  useEffect(() => {
    applySeo(
      profile
        ? `${profile.display_name} | Mestre | Artifício Mesas`
        : 'Mestre | Artifício Mesas',
      profile?.tagline ||
        profile?.bio_long?.slice(0, 150) ||
        'Landing pública de mestre com mesas ativas e especialidades.'
    );
  }, [profile]);

  if (loading) return <MestreSkeleton />;
  if (error === 'Mestre não encontrado.') return <MestreNotFound />;
  if (error || !profile) {
    return <MestreError message={error ?? 'Não foi possível carregar este perfil.'} />;
  }

  return (
    <main className="mestre-page">
      <MestreHero
        profile={profile}
        mappedTables={mappedTables}
        totalOpenSlots={totalOpenSlots}
      />

      <MestreBio profile={profile} />

      <MestreSellingPoints sellingPoints={profile.selling_points ?? []} />

      <MestreTablesSection mappedTables={mappedTables} />

      <MestreClosedGroupSection closedGroup={profile.closed_group} />

      {canSeeInsights && (insightsLoading || metrics.length > 0) && (
        <MestreInsightsSection insightsLoading={insightsLoading} metrics={metrics} />
      )}

      {canSeeInsights && recommendations.length > 0 && (
        <MestreRecommendationsSection recommendations={recommendations} />
      )}

      {links.length > 0 && (
        <section id="contato" className="links-section">
          <div className="container">
            <LinksDisplay links={links} />
          </div>
        </section>
      )}

      {mappedTables.length > 0 && (
        <MestreFinalCta
          totalOpenSlots={totalOpenSlots}
          tablesCount={mappedTables.length}
          mappedTables={mappedTables}
        />
      )}
    </main>
  );
};
```

**Mudanças-chave:**

- Remove `MestreWhySection`, adiciona `MestreBio` + `MestreSellingPoints`.
- Adiciona `MestreClosedGroupSection`.
- Usa `metrics` (estruturado) em vez de `insights: string[]` legado.
- Seção de links ganha `id="contato"` para o botão do hero e do grupo fechado terem alvo de scroll.
- `MestreFinalCta` recebe `mappedTables` para aplicar condicional de urgência.
- `applySeo` considera `tagline` primeiro, depois `bio_long`.

---

### Patch 16 — `MestrePage.css` novas classes

**Arquivo:** `frontend/src/pages/MestrePage.css`

**Adicionar ao final do arquivo:**

```css
/* ===========================================================
   Hero — extensões V4 (promo badge, accent, dual-CTA, trust-row)
   =========================================================== */
.hero-promo-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.9rem;
  margin-bottom: 1rem;
  border-radius: 9999px;
  background: rgba(249, 115, 22, 0.15);
  border: 1px solid rgba(249, 115, 22, 0.4);
  color: #fbbf77;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hero-title-accent {
  color: var(--color-artificio-orange);
  display: inline-block;
}

.hero-ctas {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
}

.cta-button.cta-primary {
  background: var(--color-artificio-orange);
}

.cta-button.cta-secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  box-shadow: none;
}

.cta-button.cta-secondary:hover {
  background: rgba(255, 255, 255, 0.14);
  transform: translateY(-2px);
}

.cta-button-disabled {
  background: rgba(75, 85, 99, 0.6) !important;
  box-shadow: none !important;
  cursor: not-allowed !important;
  opacity: 0.5;
}

.hero-trust-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  justify-content: center;
  margin: 0.5rem 0 1.5rem;
}

.trust-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.85);
}

.trust-item svg {
  color: #4ade80;
}

/* ===========================================================
   Bio Section
   =========================================================== */
.mestre-bio-section {
  padding: 5rem 1.5rem;
  background: rgba(255, 255, 255, 0.02);
}

.mestre-bio-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 3rem;
  align-items: start;
}

.mestre-bio-photo {
  position: sticky;
  top: 2rem;
}

.mestre-bio-photo img {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.mestre-bio-text p {
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.75;
  margin-bottom: 1rem;
  font-size: 1.0625rem;
}

.mestre-bio-chips {
  margin-top: 2rem;
}

.mestre-bio-chips-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-artificio-orange);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.mestre-bio-chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mestre-bio-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  background: rgba(249, 115, 22, 0.12);
  border: 1px solid rgba(249, 115, 22, 0.3);
  color: #fbbf77;
  font-size: 0.875rem;
  font-weight: 600;
}

.mestre-bio-chip--outline {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.mestre-bio-tagline {
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  border-left: 4px solid var(--color-artificio-orange);
  background: rgba(249, 115, 22, 0.06);
  font-style: italic;
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.9);
  border-radius: 0 12px 12px 0;
}

@media (max-width: 768px) {
  .mestre-bio-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .mestre-bio-photo {
    position: static;
    max-width: 240px;
    margin: 0 auto;
  }
}

/* ===========================================================
   Mesa em destaque (featured table)
   =========================================================== */
.mestre-featured-table {
  margin-bottom: 3rem;
}

.mestre-featured-table-link {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
  text-decoration: none;
  color: inherit;
}

.mestre-featured-table-link:hover {
  border-color: rgba(249, 115, 22, 0.4);
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.mestre-featured-table-cover {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.mestre-featured-table-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.mestre-featured-table-link:hover .mestre-featured-table-cover img {
  transform: scale(1.05);
}

.mestre-featured-table-badge {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  background: var(--color-artificio-orange);
  color: white;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.mestre-featured-table-content {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.mestre-featured-table-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mestre-featured-table-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  background: rgba(19, 33, 63, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.75rem;
  font-weight: 600;
}

.mestre-featured-table-title {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.2;
  color: white;
}

.mestre-featured-table-description {
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mestre-featured-table-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.6rem;
}

.mestre-featured-table-features li {
  display: flex;
  align-items: start;
  gap: 0.6rem;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.95rem;
}

.mestre-featured-table-features svg {
  color: #4ade80;
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.mestre-featured-table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.mestre-featured-table-price {
  font-size: 1.125rem;
  font-weight: 700;
  color: #fbbf24;
}

.mestre-featured-table-price--free {
  color: #4ade80;
}

.mestre-featured-table-price-suffix {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.mestre-featured-table-cta-wrapper {
  margin-top: 0.5rem;
}

@media (max-width: 768px) {
  .mestre-featured-table-link {
    grid-template-columns: 1fr;
  }
  .mestre-featured-table-cover {
    aspect-ratio: 16 / 10;
  }
  .mestre-featured-table-title {
    font-size: 1.5rem;
  }
}

/* ===========================================================
   Closed Group Section
   =========================================================== */
.closed-group-section {
  padding: 5rem 1.5rem;
  background: linear-gradient(
    135deg,
    rgba(126, 34, 206, 0.15),
    rgba(249, 115, 22, 0.1)
  );
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
}

.closed-group-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 1rem;
  border-radius: 9999px;
  background: rgba(234, 179, 8, 0.2);
  border: 1px solid rgba(234, 179, 8, 0.4);
  color: #fbbf24;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.closed-group-description {
  max-width: 620px;
  margin: 0 auto 2rem;
  font-size: 1.0625rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
}

.closed-group-subtitle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-artificio-orange);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.closed-group-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.closed-group-chip {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(249, 115, 22, 0.4);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
}

.closed-group-price {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding: 0.6rem 1.2rem;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

.closed-group-price strong {
  color: #fbbf24;
  font-size: 1.125rem;
}

/* ===========================================================
   Insights cards (reescrita)
   =========================================================== */
.owner-only-banner {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.3);
  color: #fde68a;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.insight-card {
  padding: 1.25rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.insight-card--warning {
  border-color: rgba(234, 179, 8, 0.5);
  background: rgba(234, 179, 8, 0.06);
}

.insight-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: white;
  margin-bottom: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.insight-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 0.1rem;
  padding: 0.6rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
}

.metric-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-artificio-orange);
  margin-bottom: 0.1rem;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: white;
  line-height: 1;
}

.metric-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.mestre-private-panel-empty {
  color: rgba(255, 255, 255, 0.65);
  padding: 1.5rem;
  text-align: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.15);
}

/* ===========================================================
   Recomendações
   =========================================================== */
.recommendations-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

.recommendation-item {
  display: flex;
  gap: 0.9rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left-width: 4px;
}

.recommendation-item--high {
  border-left-color: #ef4444;
}

.recommendation-item--medium {
  border-left-color: #f59e0b;
}

.recommendation-item--low {
  border-left-color: #4ade80;
}

.recommendation-icon {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.recommendation-item--high .recommendation-icon {
  color: #ef4444;
}

.recommendation-item--medium .recommendation-icon {
  color: #f59e0b;
}

.recommendation-item--low .recommendation-icon {
  color: #4ade80;
}

.recommendation-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.recommendation-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.recommendation-message {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
  margin: 0;
}

/* ===========================================================
   LinksDisplay ajustes
   =========================================================== */
.links-display-title {
  display: flex;
  align-items: center;
  justify-content: center;
}

.links-section {
  scroll-margin-top: 5rem;
}
```

---

### Patch 17 — `MestreSkeleton.tsx` com hero

**Arquivo:** `frontend/src/components/mestre/MestreSkeleton.tsx`

**Substituir arquivo inteiro:**

```tsx
import { TableCardSkeleton } from '../TableCard';

export function MestreSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white">
      {/* Hero skeleton */}
      <section className="hero-section">
        <div className="hero-banner-gradient" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="mx-auto mb-6 w-36 h-36 rounded-full bg-white/10 animate-pulse" />
          <div className="mx-auto mb-4 h-10 w-72 bg-white/10 rounded animate-pulse" />
          <div className="mx-auto mb-2 h-4 w-96 max-w-full bg-white/5 rounded animate-pulse" />
          <div className="mx-auto mb-6 h-4 w-80 max-w-full bg-white/5 rounded animate-pulse" />
          <div className="flex justify-center gap-3">
            <div className="h-12 w-40 bg-white/10 rounded-xl animate-pulse" />
            <div className="h-12 w-44 bg-white/10 rounded-xl animate-pulse" />
          </div>
        </div>
      </section>

      {/* Grid skeleton */}
      <div className="container mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, idx) => (
          <TableCardSkeleton key={idx} />
        ))}
      </div>
    </main>
  );
}
```

---

### Patch 18 — Open Graph: middleware Express

**Arquivo novo:** `backend/src/routes/og.ts`

```ts
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'kysely';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// ============================================================================
// Configuração
// ============================================================================

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';
const SITE_NAME = 'Artifício Mesas';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

// Path para o index.html buildado. Montado como volume no container.
const INDEX_HTML_PATH = process.env.INDEX_HTML_PATH || '/app/frontend-dist/index.html';

let cachedIndexHtml: string | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 min em dev, sobe em prod

async function loadIndexHtml(): Promise<string> {
  const now = Date.now();
  if (cachedIndexHtml && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedIndexHtml;
  }
  const raw = await fs.readFile(INDEX_HTML_PATH, 'utf-8');
  cachedIndexHtml = raw;
  cacheLoadedAt = now;
  return raw;
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(input: string | null | undefined, max: number): string {
  if (!input) return '';
  const cleaned = input.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + '…';
}

interface MetaFields {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
  ogType: 'website' | 'profile';
  extraProfile?: Record<string, string>;
}

function injectMetaTags(html: string, meta: MetaFields): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const imageUrl = escapeHtml(meta.imageUrl);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);

  let profileExtra = '';
  if (meta.extraProfile) {
    for (const [k, v] of Object.entries(meta.extraProfile)) {
      profileExtra += `\n    <meta property="${escapeHtml(k)}" content="${escapeHtml(v)}">`;
    }
  }

  const metaBlock = `
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="${meta.ogType}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
    <meta property="og:locale" content="pt_BR">${profileExtra}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
  `.trim();

  // Substitui o <title> estático e injeta o resto
  let output = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    metaBlock
  );

  // Se não tinha <title>, insere antes do </head>
  if (output === html) {
    output = html.replace('</head>', `${metaBlock}\n  </head>`);
  }

  return output;
}

// ============================================================================
// Metadata genérica (fallback)
// ============================================================================

function getFallbackMeta(pathname: string = '/'): MetaFields {
  return {
    title: 'Artifício Mesas — Encontre sua próxima aventura de RPG',
    description:
      'Plataforma gratuita para encontrar mesas de RPG. Descubra mestres e aventuras de D&D, Pathfinder e outros sistemas.',
    imageUrl: DEFAULT_OG_IMAGE,
    canonicalUrl: `${SITE_URL}${pathname}`,
    ogType: 'website',
  };
}

// ============================================================================
// Rota: /og/mestre/:slug
// ============================================================================

router.get('/mestre/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const gm = await db
      .selectFrom('gm_profiles as gm')
      .innerJoin('users as u', 'u.id', 'gm.user_id')
      .innerJoin('profiles as p', 'p.user_id', 'u.id')
      .select([
        sql<string>`COALESCE(gm.nickname, p.display_name)`.as('display_name'),
        'gm.bio_long',
        'gm.tagline',
        sql<string>`COALESCE(gm.avatar_url, p.avatar_url)`.as('avatar_url'),
        'gm.banner_url',
        'gm.slug',
      ])
      .where('gm.slug', '=', slug)
      .executeTakeFirst();

    const html = await loadIndexHtml();

    if (!gm) {
      // Mestre não existe — injeta meta genérica e retorna 200 mesmo assim,
      // porque o SPA vai tratar o 404 no client. Crawler recebe preview do site.
      const html404 = injectMetaTags(html, {
        ...getFallbackMeta(`/mestre/${slug}`),
        title: 'Mestre não encontrado — Artifício Mesas',
      });
      return res.status(200).type('html').send(html404);
    }

    const displayName = gm.display_name ?? 'Mestre de RPG';
    const title = `${displayName} — Mestre de RPG | ${SITE_NAME}`;
    const description = truncate(
      gm.tagline ||
        gm.bio_long ||
        `Conheça o perfil do mestre ${displayName} e descubra suas mesas ativas no ${SITE_NAME}.`,
      200
    );
    const imageUrl = gm.avatar_url || gm.banner_url || DEFAULT_OG_IMAGE;

    const output = injectMetaTags(html, {
      title,
      description,
      imageUrl,
      canonicalUrl: `${SITE_URL}/mestre/${encodeURIComponent(gm.slug)}`,
      ogType: 'profile',
      extraProfile: {
        'profile:username': gm.slug,
      },
    });

    return res.status(200).type('html').send(output);
  } catch (error: any) {
    console.error('[GET /og/mestre/:slug]', error);
    // Se quebrar, devolver fallback genérico em vez de 500
    try {
      const html = await loadIndexHtml();
      const output = injectMetaTags(html, getFallbackMeta(`/mestre/${slug}`));
      return res.status(200).type('html').send(output);
    } catch {
      return res.status(500).send('Internal error');
    }
  }
});

// ============================================================================
// Rota fallback: qualquer outra rota com user-agent de crawler
// ============================================================================

router.get('*', async (req: Request, res: Response) => {
  try {
    const html = await loadIndexHtml();
    const output = injectMetaTags(html, getFallbackMeta(req.path));
    return res.status(200).type('html').send(output);
  } catch {
    return res.status(500).send('Internal error');
  }
});

export default router;
```

**Registrar no `backend/src/app.ts` (ou equivalente):**

```ts
import ogRouter from './routes/og';

// ... depois de outras rotas da API
app.use('/og', ogRouter);
```

---

### Patch 19 — Nginx com proxy condicional para crawlers

**Arquivo:** configuração do Nginx do container frontend (localizar em `frontend/nginx.conf` ou onde estiver).

**Adicionar no bloco `http` (ou top-level):**

```nginx
# Detecta crawlers de OG
map $http_user_agent $is_crawler {
    default 0;
    ~*facebookexternalhit 1;
    ~*Facebot 1;
    ~*Twitterbot 1;
    ~*LinkedInBot 1;
    ~*WhatsApp 1;
    ~*Slackbot 1;
    ~*Discordbot 1;
    ~*TelegramBot 1;
    ~*Googlebot 1;
    ~*bingbot 1;
    ~*Applebot 1;
    ~*Embedly 1;
    ~*redditbot 1;
    ~*SkypeUriPreview 1;
    ~*vkShare 1;
}
```

**Dentro do `server` block (ou location `/`):**

```nginx
location / {
    # Se é crawler e rota é /mestre/:slug, faz proxy para o backend de OG
    if ($is_crawler = 1) {
        rewrite ^/(.*)$ /og/$1 break;
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Caso contrário, serve o SPA
    try_files $uri $uri/ /index.html;
}
```

**Observação:** Ajuste `http://backend:3000` para o nome real do container do backend na rede Docker (provavelmente algo como `http://mesas-backend:3000`). Preciso confirmar com você o nome exato do service Docker do backend.

---

### Patch 20 — `docker-compose.yml` volume compartilhado

**Arquivo:** `docker-compose.yml` (raiz do projeto)

**Adicionar volume compartilhado** entre frontend e backend:

```yaml
services:
  app:                                   # container frontend existente
    build: .
    container_name: glossario-app
    restart: always
    ports:
      - "30300:80"
    volumes:
      - frontend_dist:/usr/share/nginx/html   # ajuste conforme onde o Dockerfile copia o build
    networks:
      - gerenciador_telegram_default
    environment:
      - NODE_ENV=production

  # Se o backend estiver em outro compose, mesclar:
  backend:
    # ... configuração existente
    volumes:
      - frontend_dist:/app/frontend-dist:ro   # somente leitura
    environment:
      - INDEX_HTML_PATH=/app/frontend-dist/index.html
      - PUBLIC_SITE_URL=https://mesas.artificiorpg.com
    networks:
      - gerenciador_telegram_default

volumes:
  frontend_dist:

networks:
  gerenciador_telegram_default:
    external: true
```

**Observação:** você me enviou só um `docker-compose.yml` minimalista — presumo que há outro compose ou outro container rodando o backend. Preciso que você confirme a estrutura real para dar o patch exato.

**Alternativa sem volume compartilhado:** o backend pode, no passo de build, fazer `COPY ./frontend/dist /app/frontend-dist/`. Desacopla mas requer rebuild do backend a cada deploy do frontend.

---

### Patch 21 — `index.html` com meta tags base

**Arquivo:** `frontend/index.html`

**Substituir arquivo inteiro:**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/faviconV2.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Artifício Mesas — Encontre sua próxima aventura de RPG</title>
    <meta name="description" content="Plataforma gratuita para encontrar mesas de RPG. Descubra mestres e aventuras de D&D, Pathfinder e outros sistemas." />

    <!-- Open Graph fallback (sobrescrito pelo backend em rotas específicas) -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Artifício Mesas — Encontre sua próxima aventura de RPG" />
    <meta property="og:description" content="Plataforma gratuita para encontrar mesas de RPG." />
    <meta property="og:image" content="https://mesas.artificiorpg.com/og-default.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Artifício Mesas" />
    <meta property="og:locale" content="pt_BR" />

    <!-- Twitter Card fallback -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Artifício Mesas" />
    <meta name="twitter:description" content="Plataforma gratuita para encontrar mesas de RPG." />
    <meta name="twitter:image" content="https://mesas.artificiorpg.com/og-default.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Observação:** a imagem `/og-default.png` precisa existir em `frontend/public/og-default.png`. Dimensões recomendadas: 1200x630 PNG. Pode ser o logo da Artifício Mesas em fundo escuro.

---

## 6. UI do Painel do Mestre para novos campos

### Diagnóstico do painel atual

- `CreateGmProfileForm` (em `PainelMestrePage.tsx`) só envia `slug`, `nickname`, `bio_long`.
- Não existe fluxo de **edição de perfil** separado. Só existe criação inicial + edição de mesas.
- Backend já aceita (em `POST` e `PUT /profile`): `tagline`, `promo_badge_text`, `selling_points`, `closed_group_*`.

### Solução proposta: componente `EditGmProfileForm` novo

Criar um formulário separado que aparece quando o mestre já tem perfil. Aba/seção "Editar Perfil" dentro do painel.

**Arquivo novo:** `frontend/src/pages/Painel/EditGmProfileForm.tsx`

Conteúdo do formulário (estrutura, sem implementar 100% do CSS agora):

1. **Dados pessoais:**
   - `nickname` (editável)
   - `tagline` (textarea curta, max 200)
   - `bio_long` (textarea longa)
   - `avatar_url` (usa `ImageUploader` existente)
   - `banner_url` (usa `ImageUploader` existente)

2. **Apresentação:**
   - `promo_badge_text` (input simples, max 120)
   - `selling_points` — lista editável: botão "Adicionar benefício" abre mini-form com `icon` (select entre `clock/monitor/coins/sparkles/shield/heart/zap/users/trophy/headphones/mic/video/film/book`), `title` (input), `description` (textarea), `highlight` (input opcional). Cada item tem botão de remover. Ordem preservada.

3. **Idiomas e especialidades:**
   - `languages` (multi-input de tags livre)
   - `specialties` (multi-input de tags livre)

4. **Grupo fechado:**
   - Toggle `closed_group_enabled`.
   - Se ativado, mostrar:
     - Multi-select `closed_group_systems` (usa `GET /api/v1/systems` já em uso).
     - Textarea `closed_group_description`.
     - Input numérico `closed_group_min_price_cents` — exibir em reais, converter para cents no submit.

5. **Submit:**
   - `PUT /api/v1/gm/profile` com payload composto.
   - Toast de sucesso.
   - Refetch de `/api/v1/gm/me` para atualizar estado.

### Integração no `PainelMestrePage.tsx`

Adicionar `view = 'edit-profile'` ao tipo do estado:

```ts
const [view, setView] = useState<'dashboard' | 'create-table' | 'create-profile' | 'edit-profile'>('dashboard');
```

Botão "Editar perfil" no header do painel quando `gmProfile` existe. Ao clicar, `setView('edit-profile')`.

### Entrega

Este painel é trabalho separado de ~4h. Fora dos patches de UI principais, mas listado aqui para fechar o ciclo.

**Para V4:** vou entregar o `EditGmProfileForm.tsx` completo no momento da implementação, baseado no padrão do `CreateGmProfileForm` existente.

---

## 7. Plano de execução (10 passos)

> **Regra:** cada passo tem QA antes do próximo.

### Passo 1 — Assets (5min)

1.1. Criar `frontend/public/og-default.png` (1200x630). Pode ser logo + tagline em fundo escuro.

### Passo 2 — Backend: deduplicar recomendações (15min)

2.1. Aplicar Patch 1 em `backend/src/routes/gm.ts`.
2.2. Testar com `curl` autenticado em mestre real.

### Passo 3 — Frontend: hook de insights (15min)

3.1. Aplicar Patch 2 em `frontend/src/hooks/useMestreInsights.ts`.
3.2. Confirmar que o build TS não quebra.

### Passo 4 — Frontend: novos componentes (2h)

4.1. Criar `MestreBio.tsx` (Patch 6).
4.2. Criar `MestreSellingPoints.tsx` (Patch 7).
4.3. Criar `MestreFeaturedTable.tsx` (Patch 8).
4.4. Criar `MestreTablesGrid.tsx` (Patch 9).
4.5. Criar `MestreClosedGroupSection.tsx` (Patch 11).

### Passo 5 — Frontend: reescritas (1h30)

5.1. Reescrever `MestreHero.tsx` (Patch 5).
5.2. Reescrever `MestreInsightsSection.tsx` (Patch 3).
5.3. Reescrever `MestreRecommendationsSection.tsx` (Patch 4).
5.4. Reescrever `MestreFinalCta.tsx` (Patch 12).
5.5. Reescrever `MestreSkeleton.tsx` (Patch 17).
5.6. Reescrever `MestreTablesSection.tsx` (Patch 10).
5.7. Reescrever `MestrePage.tsx` (Patch 15).

### Passo 6 — Frontend: ajustes pontuais (30min)

6.1. `TableCard.tsx` Patch 13 — 5 mudanças.
6.2. `LinksDisplay.tsx` Patch 14 — 6 mudanças.

### Passo 7 — CSS (30min)

7.1. Adicionar classes do Patch 16 ao `MestrePage.css`.
7.2. Testar responsividade mobile (< 768px).

### Passo 8 — Remover órfão (5min)

8.1. Deletar `frontend/src/components/mestre/MestreWhySection.tsx`.
8.2. Remover import se ainda houver referência.

### Passo 9 — Open Graph (1h30)

9.1. Criar `backend/src/routes/og.ts` (Patch 18).
9.2. Registrar no `app.ts`.
9.3. Atualizar `frontend/index.html` (Patch 21).
9.4. Configurar volume compartilhado (Patch 20).
9.5. Ajustar Nginx (Patch 19).
9.6. Deploy backend + frontend.
9.7. Validar no Facebook Debugger + WhatsApp + Discord.

### Passo 10 — Painel do Mestre (4h)

10.1. Criar `EditGmProfileForm.tsx` conforme seção 6.
10.2. Integrar no `PainelMestrePage.tsx`.
10.3. Testar fluxo completo de criação de `selling_points`, ativação de grupo fechado, edição de tagline.

**Total estimado:** ~10h30 de implementação direta.

---

## 8. Checklist de validação pós-deploy

### Hero
- [ ] Promo badge aparece quando `promo_badge_text` preenchido.
- [ ] H1 tem accent laranja no nome do mestre.
- [ ] Dois CTAs visíveis: "Entrar em contato" (primário) + "Ver mesas" (secundário).
- [ ] Trust-row renderiza só com dados reais (≥1 item).
- [ ] Stats renderizam apenas `tables_count`, `avg_rating`, `reviews_count` (nada derivado).
- [ ] Avatar mostra uma letra, não nome truncado.
- [ ] Bio longa respeita quebras de parágrafo.

### Bio
- [ ] Foto à esquerda, bio à direita (desktop).
- [ ] Chips de especialidades com ícone Lucide.
- [ ] Chips de idiomas com `Globe`.
- [ ] Blockquote de tagline renderiza quando existe.
- [ ] Seção inteira some quando não há nenhum campo.

### Selling Points
- [ ] Itera `profile.selling_points` do backend.
- [ ] Seção some quando array vazio.
- [ ] Ícones Lucide mapeados via dicionário.

### Mesas
- [ ] Mesa com `featured===true` aparece como card expandido acima do grid.
- [ ] Bullets de `features[]` aparecem com `CheckCircle2`.
- [ ] Grid compacto com as demais mesas.
- [ ] Subtítulo só aparece quando há mesas não-featured.
- [ ] Empty state quando zero mesas.

### TableCard
- [ ] Sem espaço branco em cards com título curto.
- [ ] Capa com aspect-ratio fixa.
- [ ] Bloco "Ver detalhes" morto não existe mais.
- [ ] Badge "Lotada" só aparece com `isFull`.

### Grupo Fechado
- [ ] Seção só aparece quando `closed_group.enabled === true`.
- [ ] Chips dos sistemas aceitos renderizam.
- [ ] Preço mínimo em BRL formatado.
- [ ] CTA faz scroll para `#contato`.

### Insights (protegido)
- [ ] Só visível para owner/admin.
- [ ] Banner "Visível apenas para você" no topo.
- [ ] Grid de cards, não texto corrido.
- [ ] Cada card com 4 métricas (views, clicks, contacts, favorites).
- [ ] Cards com `views ≥ 10 && contacts === 0` têm destaque amarelo.
- [ ] Ordenação por views desc.

### Recomendações (protegido)
- [ ] Sem duplicação (mesa repetida aparece 1x com "(N instâncias)").
- [ ] Ícones Lucide por severidade (AlertTriangle, Info, CheckCircle2).
- [ ] Label de severidade antes da mensagem.
- [ ] Border-left colorida (vermelho/amarelo/verde).

### LinksDisplay
- [ ] Título com `Mic2` (Lucide), não emoji.
- [ ] Categorias com Lucide, não emoji.
- [ ] iframes com `loading="lazy"` e `referrerPolicy`.
- [ ] URL crua não renderiza.
- [ ] Âncora `#contato` na seção para o hero e grupo fechado linkarem.

### CTA Final
- [ ] Só aparece se `totalOpenSlots ≤ 5` ou alguma mesa tem `isUrgent`.
- [ ] Não aparece em mestres com 45+ vagas.

### Skeleton
- [ ] Simula hero com avatar, título, bio, dois CTAs.
- [ ] Grid abaixo.

### Open Graph
- [ ] `curl` com user-agent do Facebook retorna HTML com `<meta property="og:*">` dinâmicas.
- [ ] WhatsApp em teste gera preview com avatar + tagline.
- [ ] Facebook Debugger (https://developers.facebook.com/tools/debug/) valida sem erros.
- [ ] LinkedIn Post Inspector valida.
- [ ] Discord gera embed ao colar link.
- [ ] Crawler para slug inexistente não quebra (retorna preview genérico).
- [ ] Humano acessa `/mestre/slug` normalmente, sem passar pelo backend.

### Painel do Mestre
- [ ] Seção "Editar perfil" acessível.
- [ ] Tagline persiste após save.
- [ ] Promo badge persiste.
- [ ] Selling points com add/remove funcional.
- [ ] Toggle de grupo fechado funciona.
- [ ] Multi-select de sistemas funciona.
- [ ] Preço mínimo salva em cents.
- [ ] Reload do painel mostra valores salvos.

---

## 9. Rollback plan

### Frontend

Cada patch é isolado por arquivo. Rollback de qualquer componente = reverter commit do arquivo correspondente.

### Backend

Patch 1 (`buildRecommendations`) é isolado. Reverter função.

Patch 18 (rota OG) é isolado em router próprio. Remover `app.use('/og', ogRouter)` desliga tudo.

### Infraestrutura

**Se o Open Graph quebrar o SPA:**

1. Remover o bloco `if ($is_crawler = 1)` do Nginx.
2. Reload do container Nginx.
3. Tudo volta a servir SPA puro para todos (humanos e crawlers).
4. Preview de link volta a ser genérico, mas SPA funciona.

**Se o volume compartilhado travar o deploy:**

1. Remover `volumes:` do backend no docker-compose.
2. Rebuild backend com `COPY ./frontend/dist /app/frontend-dist/` no Dockerfile.
3. Hack temporário até resolver o volume.

### Banco

Patches desta V4 **não alteram schema**. Etapa 3 já aplicou `migration_107_gm_public_profile_v2.sql`. Nenhuma nova migração requerida.

### Monitoramento pós-deploy

Primeiras 24h observar:

- Logs do backend em `[GET /og/mestre/:slug]` — deve ter tráfego pequeno (só crawlers).
- Logs do Nginx — warnings de `$is_crawler` mal-formado.
- Métricas de LCP/FCP via Analytics — não deve degradar com a mudança.
- Erros 500 nas rotas `/og/*` — se aparecerem, rollback temporário.

---

## Decisão consolidada

Este documento é **executável em 10h30 de trabalho disciplinado**. Ao final:

1. **Todos os 16 problemas da V3 estão resolvidos** (6 já estavam, 10 são fechados nesta V4).
2. **3 problemas novos descobertos na análise de código estão resolvidos** (hook destruindo tipagem, CTA final sem condicional, UI do painel ausente).
3. **Open Graph dinâmico** funcional em `/mestre/:slug` + fallback genérico em todas as outras rotas.
4. **Painel do mestre** preparado para gestão dos campos novos (Bio, Selling Points, Grupo Fechado, Tagline, Promo Badge).
5. **Zero dívida técnica adicionada.** Todos os componentes criados são tipados, data-driven e retornam null quando vazios.

O próximo passo após esta V4 é **instrumentação** (`POST /api/v1/gm/:slug/view` para registrar visitas ao perfil) e **UI de gestão de links** (consumir CRUD de `/api/v1/profile/links` que já existe no backend). Ambos fora do escopo da V4.
