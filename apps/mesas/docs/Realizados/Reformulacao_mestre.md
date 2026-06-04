# Auditoria Técnica — Página Pública do Mestre (`/mestre/:slug`) — V3 Final

> **Versão:** V3 — Implementação
> **Escopo:** Redesign e refatoração completa da página pública do mestre
> **Base:** ISO 9241 (Dialogue Principles) como eixo principal; Nielsen e Shneiderman como reforço
> **Status:** Implementação das Etapas 1, 2 e 3 concluída em código; documento mantido para rastreabilidade técnica e referência de decisões.
>
> **Andamento de Implementação (16/04/2026 20:41 BRT):**
> - Etapa 1 validada manualmente: tela pública refeita e insights restritos a owner/admin.
> - Etapa 2 concluída: `MestrePage.tsx` consolidada como orquestradora com hooks e componentes dedicados.
> - Componentes extraídos na pasta `frontend/src/components/mestre/`: loading, erro, notfound, hero, mesas, benefícios, insights, recomendações e CTA final.
> - Blocos protegidos (`insights`/`recommendations`) mantidos com gate de permissão e estilos inline removidos para classes CSS.
> - Validação manual concluída (visitante/owner/admin + desktop/mobile) sem regressões críticas identificadas.
> - Build de validação frontend executado com sucesso e deploy em `dev` concluído (workflow `Deploy Beta` run `24539501158`).
> - **Etapa 3 (backend/contrato) implementada em código:** `GET /api/v1/gm/:slug` com `optionalAuth`, `viewer_context`, `closed_group`, `selling_points`, `features` e sem `metrics_*` no payload público.
> - **Insights protegidos ativos:** `GET /api/v1/gm/:slug/insights` com `authMiddleware` e gate de autorização (owner/admin).
> - **Compatibilidade de painel preservada:** `PainelMestrePage` consome métricas via `GET /api/v1/gm/tables` em `gmPanel.ts`.
> - **Schema de suporte registrado:** `migration_107_gm_public_profile_v2.sql` adiciona campos de `gm_profiles`, `tables.features` e `user_links.embed_url`.

## Índice

1. [Método adotado](#1-método-adotado)
2. [Identificação da tela no projeto](#2-identificação-da-tela-no-projeto)
3. [Diagnóstico técnico da interface e do fluxo real](#3-diagnóstico-técnico-da-interface-e-do-fluxo-real)
4. [Mapeamento código → problema](#4-mapeamento-código--problema)
5. [Estado confirmado do backend (schema + consumidores)](#5-estado-confirmado-do-backend-schema--consumidores)
6. [Arquitetura recomendada da tela](#6-arquitetura-recomendada-da-tela)
7. [Correções priorizadas](#7-correções-priorizadas)
8. [Código acionável (patches prontos para colar)](#8-código-acionável-patches-prontos-para-colar)
9. [Plano de execução ordenado (ordem obrigatória)](#9-plano-de-execução-ordenado-ordem-obrigatória)
10. [Checklist de validação pós-deploy](#10-checklist-de-validação-pós-deploy)
11. [Prompt final para implementação por Sonnet 4.5](#11-prompt-final-para-implementação-por-sonnet-45)
12. [Anexo A — Evolução V1 → V2 → V3](#anexo-a--evolução-v1--v2--v3)

---

## 1. Método adotado

**ISO 9241 — Dialogue Principles** como eixo principal. Justificativa: a tela é **pública, operacional e comercial**. O visitante precisa avaliar o mestre e decidir por uma mesa em tempo curto, com múltiplos estados condicionais (featured/others, mesa lotada, links categorizados, permissões admin/dono, seções que somem sem dados). Os princípios aplicáveis:

- **Adequação à tarefa** — cada seção só aparece quando tem função real.
- **Auto-descritividade** — o visitante entende sem tutorial o que é cada bloco.
- **Conformidade com expectativas** — CTAs primário/secundário coerentes com padrões de landing.
- **Controlabilidade** — dono e admin controlam o que aparece; visitante não vê dado interno.
- **Tolerância a erro** — estados de loading, erro e 404 explícitos.

**Nielsen (H1, H2, H4, H5, H6, H8)** reforça feedback visível, consistência, prevenção de erro e hierarquia. **Shneiderman (R2, R3, R5, R6)** reforça consistência de ações, prevenção de erro e reversibilidade. **Rams** e **Weinschenk/Barker** descartados como núcleo — a tela não é peça emocional nem vitrine estética: é **painel público operacional com conversão comercial embutida**.

---

## 2. Identificação da tela no projeto

**Arquivo que renderiza a tela auditada:** `frontend/src/pages/MestrePage.tsx` (~91 linhas, orquestração modular com hooks e componentes).

**Rota:** Registrada no `App.tsx` como `/mestre/:slug`.

### Arquivos e função objetiva

| Arquivo | Função na tela | Estado confirmado |
|---|---|---|
| `frontend/src/pages/MestrePage.tsx` | Orquestra dados e renderização da página pública via hooks/componentes | ✅ Arquitetura modular ativa (Etapa 2) |
| `frontend/src/pages/MestrePage.css` | Layout, gradientes, grid responsivo | ✅ Em uso; sem inline styles nos blocos de insights/recomendações |
| `frontend/src/components/TableCard.tsx` | Card de mesa no grid | ✅ Em uso |
| `frontend/src/components/SlotsIndicator.tsx` | Bolinhas de vaga + texto | ✅ Em uso |
| `frontend/src/utils/slots.ts` | Estado visual de vagas (fonte única de verdade) | ✅ Em uso |
| `frontend/src/components/LinksDisplay.tsx` | Seção "Conteúdo & Redes" | ✅ Contrato backend público atualizado com `type`, `description`, `embed_url`, `thumbnail_url`, `sort_order` |
| `frontend/src/components/LinksDisplay.css` | Estilo da seção de links | ✅ Em uso |
| `frontend/src/components/SiteHeader.tsx` | Cabeçalho global (sticky) | ✅ Em uso |
| `frontend/src/components/AppShell.tsx` | Wrapper com header/footer | ✅ Em uso |
| `frontend/src/index.css` | Tokens `--color-artificio-*` | ✅ Em uso |
| `frontend/src/pages/PainelMestrePage.tsx` | Painel privado do mestre | ✅ Consome métricas via `GET /api/v1/gm/tables` |
| `backend/src/routes/gm.ts` | `GET /api/v1/gm/:slug` e `GET /api/v1/gm/:slug/insights` | ✅ Contrato público protegido + insights privados implementados |
| `backend/src/middleware/auth.ts` | `authMiddleware`, `optionalAuth`, `requireAdmin` | ✅ `optionalAuth` aplicado no endpoint público |
| `MAPA_DE_API.md` | Fonte de verdade de rotas | ✅ Sincronizado com contratos da Etapa 3 |

### Descobertas críticas (confirmadas via leitura de código)

1. **Fetch da página pública está modularizado** em `useMestre.ts` (`/api/v1/gm/:slug`) e `useMestreInsights.ts` (`/api/v1/gm/:slug/insights`).
2. **Gate de permissão para insights está ativo no frontend** por `viewer_context` (`canSeeInsights = owner/admin`).
3. **Endpoint público não expõe `metrics_*`** no payload de `tables`.
4. **Endpoint protegido de insights está ativo** com `authMiddleware` e checagem explícita `owner || admin`.
5. **`PainelMestrePage.tsx` permanece íntegro** consumindo métricas de `GET /api/v1/gm/tables` (rota privada `gmPanel.ts`).
6. **Contrato público inclui `viewer_context`** para orientar render condicional no frontend.
7. **Contrato público inclui `closed_group` e `selling_points`** no payload final do mestre.
8. **Contrato público de links inclui `embed_url`** (além de `type`, `description`, `thumbnail_url`, `sort_order`).
9. **`migration_107_gm_public_profile_v2.sql` já existe no repositório** para suportar campos novos da Etapa 3.
10. **Não há pendência de patch de backend para segurança do endpoint público** no estado atual de código.

---

## 3. Diagnóstico técnico da interface e do fluxo real

> **Nota de contexto:** esta seção preserva o diagnóstico original pré-implementação para histórico de decisão. O estado vigente da Etapa 3 está consolidado no bloco "Andamento de Implementação" e no contrato atual de `gm.ts`/`MAPA_DE_API.md`.

Problemas priorizados por impacto operacional. Estrutura obrigatória por problema: evidência, impacto, princípio, origem, correção.

---

### Problema 1 — Insights e Recomendações abertos a todos (CRÍTICO — segurança/privacidade)

**Evidência no código (`MestrePage.tsx`):** Seções renderizadas por `gmData.insights && (...)`. Gate é "tem dados", não "tem permissão". Todo visitante vê:
- Semana de views com delta percentual
- Top performer ("sua melhor mesa")
- Needs attention ("sua mesa pior")
- Benchmark contra a plataforma
- Recomendações operacionais ("aumente seu preço", "revise a capa")

**Evidência no backend (`gm.ts`, estado anterior à Etapa 3):** o endpoint público já retornou `metrics_views/clicks/contacts/favorites` dentro de cada `table`. **Estado atual validado:** `GET /api/v1/gm/:slug` não retorna `metrics_*`; esses dados ficam no endpoint protegido `GET /api/v1/gm/:slug/insights`.

**Impacto operacional:**
- Competidores veem métricas comerciais do mestre.
- Jogadores veem "sua mesa X tem baixo desempenho" — queima credibilidade.
- Vazamento de recomendações internas.
- **Questão de privacidade de dados comerciais, não apenas UX.**

**Princípio violado:** ISO 9241 — *controlabilidade*, *conformidade com expectativas*; Nielsen H5 (prevenção de erro sistêmico).

**Origem provável no código:** `MestrePage.tsx` (blocos de renderização ~520–920) + `gm.ts` (select de tables com `metrics_*`).

**Correção concreta (3 frentes obrigatórias juntas):**

**3.1 Backend (`gm.ts`) — endpoint público**
- Remover `metrics_views`, `metrics_clicks`, `metrics_contacts`, `metrics_favorites` do select de tables.
- Aplicar `optionalAuth` na rota (middleware já existe).
- Computar `viewer_context: { is_owner, is_admin }` no backend e incluir no payload.

**3.2 Backend — novo endpoint protegido**
- Criar `GET /api/v1/gm/:slug/insights` com `authMiddleware`.
- Checagem manual: `user.userId === gm.user_id || user.role === 'admin'`.
- Retornar `metrics` (agregadas por mesa) e `recommendations` (array calculado).

**3.3 Frontend (`MestrePage.tsx`)**
- Calcular `canSeeInsights = !!gmData?.viewer_context?.is_owner || !!gmData?.viewer_context?.is_admin`.
- Fetch separado em `/insights` só quando `canSeeInsights === true`.
- Banner persistente no topo de cada bloco: **"🔒 Visível apenas para você"**.

**Efeito colateral (RESOLVIDO):** `PainelMestrePage.tsx` não depende de `metrics_*` do `/gm/:slug`; o painel já consome métricas via `GET /api/v1/gm/tables` (`gmPanel.ts`).

---

### Problema 2 — Hero com um único CTA e sem proposta de valor destacada

**Evidência no código (`MestrePage.tsx`):** `.hero-content` tem:
- Avatar
- Dois `.hero-badges` (mestre sempre + covil se verificado)
- `.hero-title` = `{display_name}` puro (só nome, sem proposta de valor)
- `.hero-bio`
- `.hero-stats` (3 stats fixos, sempre renderizam)
- **Um único** botão `.cta-button` "Ver Mesas Disponíveis" → `#mesas`

**Comparação com modelo de referência (print 1):** Badge promocional no topo, H1 com proposta de valor e termo destacado em cor, bio curta, **dois CTAs** (primário WhatsApp verde, secundário escuro), **trust signals com checkmark** abaixo.

**Impacto operacional:**
- Zero ação de contato direto no hero — visitante precisa descer até o card da mesa.
- Sem proposta de valor destacada, o hero vende a pessoa, não o serviço.

**Princípio violado:** ISO 9241 — *adequação à tarefa*; Nielsen H1, H6.

**Origem provável no código:** `MestrePage.tsx`, bloco `.hero-content`.

**Correção concreta:**

1. **Extrair `MestreHero.tsx`** (novo componente). Estrutura:
   ```
   MestreHero
   ├── .hero-promo-badge (condicional: gm.promo_badge_text)
   ├── .hero-avatar (existente)
   ├── .hero-badges (existente, condicional)
   ├── .hero-title-group
   │   └── h1 com prefix + {display_name} destacado em span laranja + suffix opcional
   ├── .hero-bio (existente)
   ├── .hero-ctas (NOVO — dual)
   │   ├── button primário "Entrar em Contato" (scroll para #contato OU link direto do whatsapp se disponível)
   │   └── button secundário "Ver Mesas Disponíveis" (#mesas)
   ├── .hero-trust-row (condicional — só se ≥1 válido)
   │   ├── check + "{tables_count} mesa{s} ativa{s}" (se > 0)
   │   ├── check + "Verificado no Covil" (se covil_verified)
   │   └── check + "{experience_years}+ anos de experiência" (se ≥ 3)
   └── .hero-stats (condicional — só se ≥1 valor > 0, com unidade embutida)
   ```

2. **Backend:** Adicionar coluna `gm_profiles.promo_badge_text VARCHAR(120)` opcional, gerenciável no painel.

3. **Contato direto:** Para v1, o CTA primário faz `scroll behavior: smooth` para `#contato` (seção futura do rodapé da página) ou, se não houver ainda, para o primeiro `TableCard` com foco (primeira mesa é a mais provável de ser contatada). Evitar depender de `whatsapp` sem endpoint garantido.

---

### Problema 3 — Seção de benefícios hardcoded (mostra Foundry VTT para todos)

**Evidência no código (`MestrePage.tsx`, linhas ~300–400):**
```tsx
<div className="benefit-card">
  <Clock className="benefit-icon" />
  <h3>+{gmData.experience_years || 10} anos de RPG</h3>
  <p>Mais de {gmData.experience_years || 10} anos de experiência...</p>
</div>
<div className="benefit-card">
  <Monitor className="benefit-icon" />
  <h3>Foundry VTT Premium</h3>
  <p>Experiência de jogo imersiva com Foundry VTT...</p>
</div>
<div className="benefit-card">
  <Coins className="benefit-icon" />
  <h3>A partir de R$ {gmData.average_price || 40}/sessão</h3>
  <p>Preço acessível...</p>
</div>
```

**Impacto operacional:**
- Texto sobre Foundry VTT sempre exibido, mesmo para mestres presenciais ou que usam Roll20.
- `experience_years || 10` **inventa dado** — publicidade enganosa.
- `average_price || 40` idem.

**Princípio violado:** ISO 9241 — *individualização*, *conformidade com expectativas*; Nielsen H2.

**Origem provável no código:** `MestrePage.tsx` com array estático + fallbacks.

**Origem provável no backend:** `gm.ts` não retorna `selling_points`.

**Correção concreta:**

**Backend:** Criar coluna `gm_profiles.selling_points JSONB NOT NULL DEFAULT '[]'::jsonb`. Cada item: `{ icon: string, title: string, description: string, highlight?: string }`.

**Frontend:** Extrair `MestreSellingPoints.tsx`. Se `gm.selling_points.length === 0`, **não renderizar a seção** (retornar `null`). Se houver, iterar com dicionário `SELLING_POINT_ICONS: Record<string, LucideIcon>`.

**Remover todos os fallbacks `|| 10`, `|| 40`** — se o dado não existe, não renderizar, não inventar.

---

### Problema 4 — Grid de mesas sem hierarquia (featured tratada igual às outras)

**Evidência:** `MestrePage.tsx` renderiza `gmData.tables.map(t => <TableCardComponent table={t} />)` em grid único `.tables-grid`. `TableCard.tsx` tem flag `featured` mas só adiciona selo pequeno, não muda layout.

**Modelo (prints 4 e 5):** Mesa-âncora com capa expandida + vídeo embed + descrição estendida + bullets de features + CTA próprio. Restantes em grid 3x2 compacto ao final.

**Impacto operacional:** Mestre não tem como empurrar a mesa âncora. Atenção do usuário dispersa entre cards equivalentes.

**Princípio violado:** ISO 9241 — *adequação à tarefa*; Nielsen H8 (hierarquia).

**Origem provável no código:** `MestrePage.tsx` itera linearmente.

**Origem provável no backend:** `gm.ts` ordena por `created_at DESC` apenas; `tables.featured` existe mas não é usado para ordenar nem para bullets.

**Correção concreta:**

1. **Backend (`gm.ts`):** Adicionar `ORDER BY t.featured DESC, t.created_at DESC`.
2. **Backend (migração):** Adicionar `tables.features JSONB NOT NULL DEFAULT '[]'::jsonb` para bullets.
3. **Frontend:**
   ```tsx
   const featuredTable = gmData.tables.find(t => t.featured);
   const otherTables = gmData.tables.filter(t => !t.featured);
   ```
4. **Criar `MestreFeaturedTable.tsx`** (novo componente) — layout 2 colunas, capa 1:1, bullets de `features[]`, CTA próprio grande. Reusa `SlotsIndicator` e `slots.ts`.
5. **Criar `MestreTablesGrid.tsx`** (novo, wrapper) — renderiza `otherTables` com `TableCardComponent`. Se `otherTables.length === 0` e `featuredTable` existe, ocultar subtítulo "Outras mesas". Se ambos vazios, renderizar empty state.

---

### Problema 5 — `TableCard` com altura fixa 420px e link morto "Ver detalhes"

**Evidência (`TableCard.tsx`):**
- Container com `h-[420px]` (fixa — trunca ou gera espaço branco).
- Capa com `h-[168px]` (fixa — não responde ao container).
- Bloco final:
  ```tsx
  {canJoinDirectly && (
    <div className="text-center">
      <span className="text-xs text-white/60 hover:text-white cursor-pointer">
        Ver detalhes
      </span>
    </div>
  )}
  ```
  `<span>` com `cursor-pointer` **sem `onClick` nem rota**. O `<Link>` externo já cobre o card inteiro.

**Impacto operacional:** Cliques no "Ver detalhes" disparam a mesma navegação (span é filho do `<Link>`). Percepção de bug. Espaço branco em cards com título curto.

**Princípio violado:** ISO 9241 — *auto-descritividade*, *tolerância a erro*; Nielsen H3.

**Correção concreta:**
- Trocar `h-[420px]` por `min-h-[420px]` + `flex flex-col`.
- Trocar `h-[168px]` da capa por `aspect-[16/10] w-full`.
- Trocar `h-[252px]` do conteúdo por `flex-1`.
- **Remover inteiramente** o bloco `{canJoinDirectly && <div><span>Ver detalhes</span></div>}`.

---

### Problema 6 — Badge "Últimas vagas" duplica `SlotsIndicator`

**Evidência (`TableCard.tsx`):**
```tsx
{isUrgent && (
  <span className="... animate-pulse">
    ⚡ {slotsLeft === 1 ? 'Última vaga' : 'Últimas vagas'}
  </span>
)}
```
E no footer, `<SlotsIndicator table={table} />` **já mostra** bolinhas + texto colorido.

**Impacto operacional:** Em mesa com 1 vaga, 3 sinais simultâneos (badge pulsante + bolinhas + texto em laranja). Carga cognitiva excessiva.

**Princípio violado:** ISO 9241 — *adequação à tarefa*; Nielsen H8.

**Correção concreta:** Manter badge **só para `isFull`** com texto "Lotada" em `bg-red-600` sem `animate-pulse`. `SlotsIndicator` já comunica urgência em laranja.

---

### Problema 7 — `LinksDisplay` consome campos que o backend não retorna

**Evidência (`LinksDisplay.tsx`):** Componente lê `link.type`, `link.embed_url`, `link.description`, `link.thumbnail_url`.

**Evidência (`gm.ts`):**
```ts
.select([
  'user_links.id',
  'user_links.url',
  'user_links.title',
  'user_links.sort_order',
])
```
**4 campos faltam no select.**

**Schema real (confirmado via psql):** Tabela `user_links` **já tem** `type`, `title`, `description`, `thumbnail_url`. **Falta apenas** `embed_url`.

**Confirmação no `MAPA_DE_API.md`:** CRUD `/links` está 100% "❌ Pendente/Front" — mestre não tem UI para criar links. Seção `LinksDisplay` sempre renderiza vazia hoje.

**Impacto operacional:** Seção quebrada em 2 níveis: contrato API incompleto + sem UI de inserção.

**Princípio violado:** ISO 9241 — *tolerância a erro*; contrato frontend↔backend quebrado.

**Correção concreta (4 frentes):**

1. **Backend (`gm.ts`):** Completar select:
   ```ts
   .select([
     'user_links.id',
     'user_links.url',
     'user_links.title',
     'user_links.description',
     'user_links.type',
     'user_links.embed_url',
     'user_links.thumbnail_url',
     'user_links.sort_order',
   ])
   ```
2. **Backend (migração):** Adicionar `user_links.embed_url TEXT` (única coluna faltante confirmada).
3. **Frontend:** `LinksDisplay` já está correto — corrigir contrato basta.
4. **UI de gestão de links no painel (bloqueador externo):** Criar task separada para implementar CRUD no frontend. **Fora do escopo desta auditoria**, mas registrado. Enquanto não existir, adicionar no `MestrePage`: se `gm.links.length === 0`, não renderizar `<LinksDisplay>`.

---

### Problema 8 — `LinksDisplay` com emoji em category labels quebra design system

**Evidência:** `CATEGORY_LABELS = { content: '🎥 Conteúdo', social: '🌐 Presença', authority: '🧠 Autoridade' }`. Resto da página usa Lucide icons.

**Impacto operacional:** Quebra consistência visual. Emojis renderizam diferente por SO/browser.

**Princípio violado:** ISO 9241 — *consistência*; Nielsen H4.

**Correção concreta:** Substituir por componentes Lucide:
```tsx
const CATEGORY_META: Record<string, { label: string; Icon: LucideIcon }> = {
  content:   { label: 'Conteúdo',   Icon: Video },
  social:    { label: 'Presença',   Icon: Share2 },
  authority: { label: 'Autoridade', Icon: BookOpen },
};
```

---

### Problema 9 — `LinksDisplay` sem lazy-load em iframes

**Evidência:** `<iframe src={link.embed_url} ... />` sem `loading="lazy"`, sem `referrerPolicy`.

**Impacto operacional:** Em mestres com 3+ embeds (YouTube + Twitch + Spotify), ~500KB de scripts extras no primeiro paint. LCP degradado principalmente em mobile.

**Princípio violado:** ISO 9241 — *adequação à tarefa* (tempo de resposta).

**Correção concreta:**
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

Facade pattern completo (thumbnail → click → iframe) fica para v2.

---

### Problema 10 — `hero-stats` renderiza sempre, inclusive com zeros

**Evidência (`MestrePage.tsx`):**
```tsx
<div className="hero-stats">
  <div className="stat">
    <Users className="stat-icon" />
    <span className="stat-value">{gmData.tables_count || 0}</span>
    <span className="stat-label">Mesas Ativas</span>
  </div>
  ...
</div>
```
Mestre novo: `0 Mesas`, `0.0 Avaliação`, `0 Avaliações`.

**Impacto operacional:** Queima credibilidade antes do visitante conhecer o mestre.

**Princípio violado:** Nielsen H6 (reconhecimento — evitar sinalizar "vazio").

**Correção concreta:**
```tsx
const hasAnyStat =
  (gmData.tables_count ?? 0) > 0 ||
  (gmData.avg_rating ?? 0) > 0 ||
  (gmData.reviews_count ?? 0) > 0;

{hasAnyStat && (
  <div className="hero-stats">
    {(gmData.tables_count ?? 0) > 0 && <Stat ... />}
    {(gmData.avg_rating ?? 0) > 0 && <Stat ... />}
    {(gmData.reviews_count ?? 0) > 0 && <Stat ... />}
  </div>
)}
```
Adicionar unidade embutida: `4.8★`, `12 mesas`, `47 avaliações`.

---

### Problema 11 — Endpoint `POST /:slug/view` não existe para perfil de mestre

**Evidência (`MAPA_DE_API.md`):** `POST /tables/:slug/view` existe e é consumido. **Não há equivalente para a página do mestre.**

**Impacto operacional:** Métrica de visita ao perfil não é registrada. Seção de insights (quando liberada ao dono) mostra apenas views de mesas individuais.

**Princípio violado:** Nenhum — lacuna de instrumentação.

**Correção concreta:**
- Criar `POST /api/v1/gm/:slug/view` em `gm.ts` ou em nova tabela `gm_profile_metrics`.
- Frontend dispara POST no `useEffect` do `MestrePage` uma vez por sessão (dedupe por `sessionStorage`).
- Atualizar `MAPA_DE_API.md`.

**Priorização:** Média. Não bloqueia refator de UI.

---

### Problema 12 — Seções vazias renderizam subtítulos órfãos

**Evidência (`MestrePage.tsx`):** Seção `tables-section` tem subtítulo fixo "Escolha a aventura...". Se mestre não tem mesas ativas, aparece subtítulo sem grid, apenas `.no-tables` empty state.

**Impacto operacional:** Subtítulo promete conteúdo que não existe.

**Princípio violado:** ISO 9241 — *conformidade com expectativas*.

**Correção concreta:**
```tsx
{(gmData.tables?.length ?? 0) > 0 && (
  <p className="tables-subtitle">Escolha a aventura...</p>
)}
```
Empty state fica, mas sem subtítulo falso.

---

### Problema 13 — Ausência de estados de carregamento, erro e 404 padronizados

**Evidência (`MestrePage.tsx`):**
```tsx
if (loading) return <div>Carregando...</div>;
if (error) return <div>Erro</div>;
if (!gmData) return <div>Não encontrado</div>;
```
Três strings soltas sem design.

**Impacto operacional:** Visitante em conexão ruim vê tela piscando sem pista visual. 404 (mestre removido ou slug inexistente) sem direcionamento para catálogo.

**Princípio violado:** Nielsen H1 (visibilidade de status), H9 (recuperação de erro).

**Correção concreta:**
- Criar `MestreSkeleton.tsx` — skeleton do hero (avatar circular + 2 linhas) + skeleton do grid (reaproveitar `TableCardSkeleton` existente em `TableCard.tsx`).
- Criar `MestreNotFound.tsx` — mensagem + CTA para `/catalogo` (rota existe no `SiteHeader`).
- Criar `MestreError.tsx` — mensagem + botão `onRetry`.

---

### Problema 14 — Bloco "Grupo Fechado" opt-in via painel

**Escopo (conforme instrução do usuário):** Não fica no hero. É seção opcional controlada pelo mestre no painel, com lista de sistemas que ele aceita.

**Evidência:** Não existe no `MestrePage.tsx`. Não existe nos campos de `gm_profiles`.

**Impacto operacional:**
- Perde conversão premium (grupos fechados têm ticket médio 3-5x maior).
- Mestre não controla explicitamente quais sistemas aceita para grupo fechado, gerando leads desqualificados.

**Princípio violado:** ISO 9241 — *adequação à tarefa*, *controlabilidade*.

**Correção concreta:**

**Backend — schema:**
```sql
ALTER TABLE gm_profiles
  ADD COLUMN IF NOT EXISTS closed_group_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_group_systems JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS closed_group_description TEXT,
  ADD COLUMN IF NOT EXISTS closed_group_min_price_cents INTEGER;
```

Semântica:
- `closed_group_enabled`: toggle master.
- `closed_group_systems`: array de `system_id` (FK lógica para `systems.id`).
- `closed_group_description`: texto curto opcional — "Grupos de 4-6 jogadores, horários flexíveis".
- `closed_group_min_price_cents`: valor base opcional.

**Backend (`gm.ts`) — endpoint público:** Incluir esses 4 campos. Fazer query separada para resolver nomes dos sistemas (não faz JOIN inline em JSONB):
```ts
let closedGroupSystems: Array<{ id: string; name: string }> = [];
if (
  gm.closed_group_enabled &&
  Array.isArray(gm.closed_group_systems) &&
  gm.closed_group_systems.length > 0
) {
  closedGroupSystems = await db
    .selectFrom('systems')
    .select(['id', 'name'])
    .where('id', 'in', gm.closed_group_systems as string[])
    .execute();
}
```
Retornar `closed_group: { enabled, systems, description, min_price_cents }`.

**Frontend — UI pública:** Criar `MestreClosedGroupSection.tsx`. Renderizar **apenas** se `gm.closed_group?.enabled === true`. Layout:
- Título "Disponível para Grupos Fechados"
- Descrição (ou fallback padrão)
- Chips com nomes dos sistemas aceitos
- Bloco de valor mínimo formatado (se `min_price_cents`)
- CTA "Solicitar orçamento" → scroll para `#contato` ou modal

**Frontend — UI painel do mestre (`PainelMestrePage.tsx`):** Precisa:
- Toggle on/off (`closed_group_enabled`)
- Multi-select de sistemas (usa `GET /systems` já em uso)
- Textarea curta (`closed_group_description`)
- Input de valor mínimo (`closed_group_min_price_cents`)
- Submit via `PUT /api/v1/gm/profile` (endpoint existe em `gmPanel.ts` como "❌ Pendente/Front" — **ativar o consumo** e atualizar `MAPA_DE_API.md`).

**Alternativa mais simples (recomendada):** Estender o `POST /api/v1/gm/profile` existente para aceitar esses 4 novos campos, já que o fluxo de criação/edição de perfil do painel atualmente envia `{ slug, nickname, bio_long }`. Menor atrito que criar PUT separado.

---

### Problema 15 — `gm.ts` não retorna `user_id` do mestre (mas expor bruto é desnecessário)

**Evidência:** Select atual não inclui `gm.user_id`. Sem isso, frontend não calcula ownership.

**Solução escolhida (mais limpa que expor `user_id` bruto):** Aplicar `optionalAuth` no endpoint e **computar `viewer_context` no backend**, retornando apenas booleanos:
```ts
const viewer_context = {
  is_owner: req.user?.userId === gm.user_id,
  is_admin: req.user?.role === 'admin',
};
```
Frontend recebe só `{ is_owner: boolean, is_admin: boolean }`. Reduz superfície de exposição.

---

### Problema 16 — Contrato quebrado com `PainelMestrePage.tsx` ao remover `metrics_*`

**Evidência (código atual validado):** `GET /api/v1/gm/:slug` é consumido no frontend por:
- `useMestre.ts` (orquestrado por `MestrePage.tsx`)
- `useMestreInsights.ts` para `GET /api/v1/gm/:slug/insights`

`PainelMestrePage.tsx` consome `GET /api/v1/gm/tables` para KPIs/métricas e não depende de `GET /api/v1/gm/:slug`.

**Risco atual:** Remover `metrics_*` de `/gm/:slug` **não** quebra `PainelMestrePage.tsx` no estado atual.

**Ação obrigatória ANTES do patch do backend:**

1. `grep -r "metrics_views\|metrics_clicks\|metrics_contacts\|metrics_favorites" frontend/src/`
2. Verificar se `GET /api/v1/gm/tables` (endpoint privado do painel, consumido pelo próprio `PainelMestrePage.tsx`) retorna os mesmos `metrics_*`. O MAPA_DE_API.md lista a rota como "Em Uso" e indica retorno de "campos canônicos/legados da tabela". **Checar código de `gmPanel.ts` para confirmar se os metrics já estão presentes.**
3. **Validação contínua:** confirmar em regressão que `PainelMestrePage.tsx` segue lendo métricas de `/api/v1/gm/tables`.
4. **Fallback técnico:** se `/gm/tables` deixar de retornar `metrics_*` em alteração futura, estender `gmPanel.ts` antes de qualquer mudança no contrato público de `/gm/:slug`.
5. `useCreateTableForm.ts` e `uiHelpers.ts`: **confirmado** que não consomem `GET /api/v1/gm/:slug`; usam rotas de `gm/tables` no fluxo atual.

---

## 4. Mapeamento código → problema

| Arquivo | Camada | Componente/função | Tipo | Alteração |
|---|---|---|---|---|
| `backend/src/routes/gm.ts` | backend/route | `GET /:slug` — select de tables | segurança/contrato | Remover `metrics_*`. Aplicar `optionalAuth`. Adicionar `viewer_context`. |
| `backend/src/routes/gm.ts` | backend/route | `GET /:slug` — select de gm | contrato | Adicionar `user_id` (uso interno), `tagline`, `selling_points`, `promo_badge_text`, `closed_group_*` (4), ordenar mesas por `featured DESC`. |
| `backend/src/routes/gm.ts` | backend/route | `GET /:slug` — select de tables | contrato | Adicionar `features`. |
| `backend/src/routes/gm.ts` | backend/route | `GET /:slug` — select de links | contrato | Adicionar `type`, `embed_url`, `thumbnail_url`, `description`. |
| `backend/src/routes/gm.ts` (NOVO) | backend/route | `GET /:slug/insights` | permissão | Criar protegido por `authMiddleware` + checagem ownership/admin. |
| `backend/src/routes/gm.ts` (NOVO, v2) | backend/route | `POST /:slug/view` | tracking | Criar para métrica de visita ao perfil. Priorização Média. |
| `backend/src/routes/gmPanel.ts` | backend/route | `POST /profile` ou novo PUT | contrato | Estender para aceitar `selling_points`, `promo_badge_text`, `closed_group_*`, `tagline`. |
| `backend/src/routes/gmPanel.ts` | backend/route | `GET /tables` | contrato (condicional) | Se não retornar `metrics_*`, estender. Validar primeiro. |
| `database/` | backend/schema | migração | contrato | `gm_profiles`: +7 campos. `tables`: +`features`. `user_links`: +`embed_url`. Índice `idx_tables_gm_featured_created`. |
| `frontend/src/pages/MestrePage.tsx` | frontend/view | orquestração modular (~91 linhas) | estrutura | ✅ Componentização aplicada; página coordena hooks e componentes. |
| `frontend/src/pages/MestrePage.tsx` | frontend/view | hook de dados modular | estrutura | `useMestre(slug)` e `useMestreInsights(...)` ativos; página atua como orquestração. |
| `frontend/src/pages/MestrePage.tsx` | frontend/view | insights/recomendações | permissão | Gate `canSeeInsights`. Fetch separado `/insights`. |
| `frontend/src/pages/MestrePage.tsx` | frontend/view | hero stats | estado | Só renderizar se ≥1 > 0. Remover `\|\| 10`, `\|\| 40`. |
| `frontend/src/pages/MestrePage.tsx` | frontend/view | benefit-cards | contrato | Iterar `gm.selling_points`; vazio → ocultar. |
| `frontend/src/pages/MestrePage.tsx` | frontend/view | loading/error/notFound | estado | Substituir strings por componentes. |
| `frontend/src/pages/PainelMestrePage.tsx` | frontend/view | consumo de `metrics_*` | contrato | ✅ Já consome `/api/v1/gm/tables` (não depende de `/gm/:slug`). |
| `frontend/src/pages/PainelMestrePage.tsx` | frontend/view | formulário de perfil | contrato | Estender para gerenciar `selling_points`, `promo_badge_text`, `closed_group_*`, `tagline`. |
| `frontend/src/components/TableCard.tsx` | frontend/component | container | estilo | `min-h-[420px]` + `flex flex-col`; capa `aspect-[16/10]`; conteúdo `flex-1`. |
| `frontend/src/components/TableCard.tsx` | frontend/component | "Ver detalhes" | fluxo | Remover inteiramente. |
| `frontend/src/components/TableCard.tsx` | frontend/component | badge urgente | composição | Só para `isFull` → "Lotada" em `bg-red-600`. |
| `frontend/src/components/LinksDisplay.tsx` | frontend/component | iframes | performance | `loading="lazy"` + `referrerPolicy`. |
| `frontend/src/components/LinksDisplay.tsx` | frontend/component | `CATEGORY_LABELS` | consistência | Substituir emojis por Lucide. |
| `MAPA_DE_API.md` | documentação | seção GM | contrato | Adicionar `/:slug/insights` e futuramente `/:slug/view`. Atualizar nota do `/:slug`. |

---

## 5. Estado confirmado do backend (schema + consumidores)

### 5.1 `gm_profiles` — schema atual

| Coluna | Tipo | Estado |
|---|---|---|
| `id` | uuid | ✅ existe |
| `user_id` | uuid | ✅ existe |
| `slug` | text | ✅ existe |
| `bio_long` | text | ✅ existe |
| `avatar_url` | text | ✅ existe |
| `banner_url` | text | ✅ existe |
| `languages` | text[] | ✅ existe |
| `specialties` | text[] | ✅ existe |
| `badges` | text[] | ✅ existe |
| `tables_count` | integer | ✅ existe |
| `avg_rating` | numeric | ✅ existe |
| `reviews_count` | integer | ✅ existe |
| `nickname` | varchar | ✅ existe |
| `discord_connected` | boolean | ✅ existe |
| `discord_username` | text | ✅ existe |
| `discord_id` | text | ✅ existe |
| `covil_verified` | boolean | ✅ existe |
| `covil_verified_at` | timestamptz | ✅ existe |
| `covil_verified_by` | uuid | ✅ existe |
| `experience_years` | integer | ✅ existe |
| `average_price` | numeric | ✅ existe |
| `gm_style` | jsonb | ✅ existe |
| `tools` | jsonb | ✅ existe |
| `game_format` | jsonb | ✅ existe |
| `created_at` / `updated_at` | timestamptz | ✅ existe |
| **`tagline`** | text | ❌ **faltando — criar** |
| **`selling_points`** | jsonb | ❌ **faltando — criar** |
| **`promo_badge_text`** | varchar(120) | ❌ **faltando — criar** |
| **`closed_group_enabled`** | boolean | ❌ **faltando — criar** |
| **`closed_group_systems`** | jsonb | ❌ **faltando — criar** |
| **`closed_group_description`** | text | ❌ **faltando — criar** |
| **`closed_group_min_price_cents`** | integer | ❌ **faltando — criar** |

### 5.2 `tables` — schema atual (resumo dos relevantes)

Colunas existentes de interesse: `id`, `slug`, `gm_id`, `system_id`, `title`, `description`, `cover_url`, `banner_url`, `status`, `type`, `audience`, `modality`, `price_type`, `price_value`, `slots_total`, `slots_filled`, `slots_open`, `featured`, `synopsis_narrative`, `is_ddal`, `ddal_*`, `publisher_role`, `actual_gm_name`, `experience_level`, `language`.

Colunas faltando:
| Coluna | Tipo | Estado |
|---|---|---|
| **`features`** | jsonb | ❌ **faltando — criar** |

### 5.3 `user_links` — schema atual

| Coluna | Tipo | Estado |
|---|---|---|
| `id` | uuid | ✅ existe |
| `user_id` | uuid | ✅ existe |
| `url` | text | ✅ existe |
| `type` | text | ✅ **existe** (não precisa migração) |
| `title` | text | ✅ existe |
| `description` | text | ✅ **existe** (não precisa migração) |
| `thumbnail_url` | text | ✅ **existe** (não precisa migração) |
| `sort_order` | integer | ✅ existe |
| `created_at` / `updated_at` | timestamp | ✅ existe |
| **`embed_url`** | text | ❌ **faltando — criar (única coluna nova)** |

### 5.4 `table_metrics` — schema atual

Completo. Colunas: `id`, `table_id`, `views_count`, `clicks_count`, `contacts_count`, `favorites_count`, `created_at`, `updated_at`. **Nenhuma migração necessária.**

### 5.5 Índices

| Índice | Estado |
|---|---|
| `idx_tables_gm_featured_created` | ❌ **não existe — criar** |

### 5.6 Consumidores confirmados de `/gm/:slug`

| Arquivo | Usa `metrics_*`? | Ação necessária |
|---|---|---|
| `MestrePage.tsx` | Não (dados sensíveis via `/insights`) | ✅ Fluxo segregado ativo (`useMestre` + `useMestreInsights`) |
| `PainelMestrePage.tsx` | Não (consome `gm/tables`) | ✅ Sem dependência de `GET /api/v1/gm/:slug` |
| `useCreateTableForm.ts` | Não | ✅ Usa rotas de `gm/tables` |
| `uiHelpers.ts` | Não | ✅ Usa rotas de `gm/tables` |

---

## 6. Arquitetura recomendada da tela

### 6.1 Ordem de seções (top → bottom)

1. **`<MestreHero>`** — promo-badge (opcional) + avatar + badges + H1 com proposta de valor + bio + **dual-CTA** + trust-row condicional + stats condicionais.
2. **`<MestreSellingPoints>`** — renderiza se `gm.selling_points.length > 0`.
3. **`<MestreBio>`** — foto + texto longo + chips de especialidades (Lucide) + blockquote de `tagline` (se houver).
4. **`<MestreFeaturedTable>`** — renderiza se `featuredTable` existir. Layout 2 colunas, CTA próprio.
5. **`<MestreTablesGrid>`** — renderiza se `otherTables.length > 0`. Grid compacto com `TableCardComponent` corrigido.
6. **`<MestreClosedGroupSection>`** — renderiza se `gm.closed_group?.enabled`. Chips de sistemas + CTA de orçamento.
7. **`<MestreInsightsSection>`** 🔒 — **apenas** se `canSeeInsights`. Banner "Visível apenas para você". Fetch em `/gm/:slug/insights`.
8. **`<MestreRecommendationsSection>`** 🔒 — **apenas** se `canSeeInsights`. Mesma origem.
9. **`<MestreLinksSection>`** — wrapper condicional de `<LinksDisplay>`. Renderiza se `gm.links.length > 0`.
10. **`<MestreContactSection>`** (opcional, v2) — canais + CTA WhatsApp.

### 6.2 Estados da página (hook `useMestre`)

- `status: 'loading'` → `<MestreSkeleton />`
- `status: 'error'` → `<MestreError onRetry={refetch} />`
- `status: 'not_found'` (404) → `<MestreNotFound slug={slug} />` com CTA → `/catalogo`
- `status: 'success'` → renderização condicional seção-a-seção

### 6.3 Permissões

- `GET /api/v1/gm/:slug` → `optionalAuth` → payload público + `viewer_context`.
- `GET /api/v1/gm/:slug/insights` → `authMiddleware` + gate manual `user.userId === gm.user_id || user.role === 'admin'`.
- Frontend: `canSeeInsights = !!(data?.viewer_context?.is_owner || data?.viewer_context?.is_admin)`.

### 6.4 Tracking (v2)

- `POST /api/v1/gm/:slug/view` disparado uma vez por sessão no `useEffect` do `MestrePage` (dedupe por `sessionStorage.setItem('mestre_view_' + slug, '1')`).

### 6.5 Estrutura de arquivos proposta

```
frontend/src/
├── hooks/
│   └── useMestre.ts                           (NOVO — fetch + estados)
├── pages/
│   └── MestrePage.tsx                          (REFATORADO — orquestração)
└── components/
    └── mestre/                                  (NOVO — pasta)
        ├── MestreHero.tsx                       (NOVO)
        ├── MestreSellingPoints.tsx              (NOVO)
        ├── MestreBio.tsx                        (NOVO)
        ├── MestreFeaturedTable.tsx              (NOVO)
        ├── MestreTablesGrid.tsx                 (NOVO)
        ├── MestreClosedGroupSection.tsx         (NOVO)
        ├── MestreInsightsSection.tsx            (NOVO, 🔒)
        ├── MestreRecommendationsSection.tsx     (NOVO, 🔒)
        ├── MestreLinksSection.tsx               (NOVO, wrapper)
        ├── MestreSkeleton.tsx                   (NOVO)
        ├── MestreNotFound.tsx                   (NOVO)
        ├── MestreError.tsx                      (NOVO)
        └── OwnerOnlyBanner.tsx                  (NOVO, compartilhado entre 🔒)

backend/src/
├── db/
│   └── migrations/
│       └── <timestamp>_gm_public_profile_v2.sql (NOVO)
└── routes/
    ├── gm.ts                                    (REFATORADO)
    └── gmPanel.ts                               (ESTENDIDO — perfil aceita novos campos)
```

---

## 7. Correções priorizadas

### Prioridade ALTA

**A1 — Validar consumidores de `metrics_*` antes de qualquer remoção (CONCLUÍDO)**
- **Objetivo:** Evitar quebra no painel após endurecimento do contrato público.
- **Regra aplicada:** validação de consumidores + isolamento de métricas em rota protegida.
- **Resultado:** `PainelMestrePage.tsx` usa `/api/v1/gm/tables`; `useCreateTableForm.ts` e `uiHelpers.ts` não dependem de `GET /api/v1/gm/:slug`.
- **Impacto atual:** risco de regressão nesse ponto está mitigado.

**A2 — Segurança de dados: isolar insights e recomendações**
- **Objetivo:** Impedir vazamento de métricas e recomendações ao público.
- **Regra:** Só admin ou dono vê.
- **Alteração:** Remover `metrics_*` de `/gm/:slug`. Criar `GET /gm/:slug/insights` protegido. Aplicar `optionalAuth` no público. Gate no frontend.
- **Arquivos:** `gm.ts`, `MestrePage.tsx`, `MAPA_DE_API.md`.
- **Impacto:** Corrige privacidade + limpa tela pública.

**A3 — Corrigir contrato de links backend↔frontend**
- **Objetivo:** Fazer `LinksDisplay` funcionar.
- **Regra:** Backend retorna `type`, `embed_url`, `thumbnail_url`, `description`.
- **Alteração:** Completar select em `gm.ts`. Migrar `user_links.embed_url` (única coluna faltante).
- **Arquivos:** `gm.ts`, migração.
- **Impacto:** Categorização e embeds voltam a funcionar.

**A4 — Adicionar `viewer_context` ao payload público**
- **Objetivo:** Habilitar ownership no frontend sem expor `user_id` bruto.
- **Alteração:** Aplicar `optionalAuth`; computar `{ is_owner, is_admin }` no backend.
- **Arquivos:** `gm.ts`.
- **Impacto:** Habilita A2 + mantém superfície de dados mínima.

**A5 — Separar mesa-destaque do grid**
- **Objetivo:** Criar hierarquia de venda.
- **Regra:** `featured === true` vira card expandido; demais no grid.
- **Alteração:** Split JSX + novo `MestreFeaturedTable.tsx`. Backend ordena `featured DESC`. Migração `tables.features JSONB`.
- **Arquivos:** `MestrePage.tsx`, `MestreFeaturedTable.tsx`, `gm.ts`, migração.
- **Impacto:** Conversão dirigida para mesa âncora.

**A6 — Componentização + `useMestre` (CONCLUÍDO)**
- **Objetivo:** Manutenibilidade + refatoração segura.
- **Resultado:** `MestrePage.tsx` atua como orquestração modular com hooks (`useMestre`, `useMestreInsights`) e componentes dedicados.
- **Arquivos:** `MestrePage.tsx`, `components/mestre/*`, `hooks/useMestre.ts`, `hooks/useMestreInsights.ts`.
- **Impacto:** Base estável para evolução incremental sem reintroduzir monolito.

### Prioridade MÉDIA

**M1 — Hero reestruturado** (Problemas 2, 10)
- Dual-CTA, promo-badge condicional, H1 com proposta de valor, trust-row e stats condicionais, remover fallbacks inventados.
- Arquivos: `MestreHero.tsx`, `MestrePage.css`, `gm.ts` (coluna `promo_badge_text`).

**M2 — Selling points data-driven** (Problema 3)
- Iteração sobre `gm.selling_points`; ocultar seção se vazio; remover hardcoded Foundry VTT.
- Arquivos: `MestreSellingPoints.tsx`, `gm.ts`, migração.

**M3 — Bloco de grupo fechado + UI no painel** (Problema 14)
- Pública: renderiza se `gm.closed_group?.enabled`. Chips de sistemas, descrição, valor mínimo, CTA.
- Painel: toggle + multi-select + textarea + input de preço + submit via `POST /api/v1/gm/profile` estendido.
- Arquivos: `MestreClosedGroupSection.tsx`, `PainelMestrePage.tsx` (formulário), `gm.ts`, `gmPanel.ts`, migração.

**M4 — `TableCard` `min-h` + remover link morto + badge só para `isFull`** (Problemas 5, 6)
- Arquivo: `TableCard.tsx`.

**M5 — `LinksDisplay` lazy-load + Lucide em categorias** (Problemas 8, 9)
- Arquivo: `LinksDisplay.tsx`.

**M6 — Estados de loading/erro/404 padronizados** (Problema 13)
- Skeletons, `<MestreNotFound>`, `<MestreError>`.

### Prioridade BAIXA

**B1 — Tracking de view da página do mestre** (Problema 11)
- Nova rota `POST /gm/:slug/view`, hook no `useEffect` com dedupe por sessão.

**B2 — Subtítulos órfãos em seções vazias** (Problema 12)
- Condicionar subtítulos à existência de conteúdo.

**B3 — UI de gestão de links no painel do mestre** (bloqueador externo)
- Consumir `/links` (hoje `❌ Pendente/Front`). Fora do escopo direto desta auditoria.

---

## 8. Código acionável (patches prontos para colar)

### Patch 0 — Validação preventiva (ANTES de qualquer patch)

**Executar no terminal do repositório:**

```bash
cd frontend/src
grep -rn "metrics_views\|metrics_clicks\|metrics_contacts\|metrics_favorites" .
```

**Resultado esperado:** no estado atual, as ocorrências relevantes aparecem no backend (`gmPanel.ts`) e no fluxo protegido de insights; não deve haver dependência de `metrics_*` em `PainelMestrePage.tsx` via `/gm/:slug`.

**Verificação do `gmPanel.ts`** — abrir o arquivo e confirmar se `GET /api/v1/gm/tables` já retorna os `metrics_*`. Se não retornar, estender o select desse endpoint:

```ts
// Em backend/src/routes/gmPanel.ts, no GET /tables
.leftJoin('table_metrics as tm', 'tm.table_id', 't.id')
.select([
  // ...campos existentes...
  sql<number>`COALESCE(tm.views_count, 0)`.as('metrics_views'),
  sql<number>`COALESCE(tm.clicks_count, 0)`.as('metrics_clicks'),
  sql<number>`COALESCE(tm.contacts_count, 0)`.as('metrics_contacts'),
  sql<number>`COALESCE(tm.favorites_count, 0)`.as('metrics_favorites'),
])
```

**Validação em `PainelMestrePage.tsx`:** confirmar que o painel permanece usando `/api/v1/gm/tables` para métricas (estado já aplicado no código atual).

**Só avançar para os patches seguintes depois disso.**

---

### Patch 1 — Backend: migração SQL (rodar PRIMEIRO)

**Arquivo de referência (já existente no projeto):** `database/migration_107_gm_public_profile_v2.sql`

```sql
-- ================================================================
-- Migração: gm_public_profile_v2
-- Objetivo: suportar refatoração da página pública do mestre
--           (selling_points, grupo fechado, tagline, promo badge,
--            features em mesa-destaque, embed_url em links,
--            índice de ordenação por destaque)
-- Idempotente: todas as cláusulas usam IF NOT EXISTS
-- ================================================================

-- gm_profiles: apresentação e oferta de grupo fechado
ALTER TABLE gm_profiles
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS selling_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promo_badge_text VARCHAR(120),
  ADD COLUMN IF NOT EXISTS closed_group_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_group_systems JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS closed_group_description TEXT,
  ADD COLUMN IF NOT EXISTS closed_group_min_price_cents INTEGER;

-- tables: bullets para mesa-destaque
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;

-- user_links: única coluna faltante confirmada via schema atual
ALTER TABLE user_links
  ADD COLUMN IF NOT EXISTS embed_url TEXT;

-- Índice para ordenação de mesas ativas por destaque
CREATE INDEX IF NOT EXISTS idx_tables_gm_featured_created
  ON tables (gm_id, featured DESC, created_at DESC)
  WHERE status = 'active';
```

**Motivo:** Pré-requisito para os patches do backend e frontend. Idempotente.
**Dependência:** Nenhuma. Rodar ANTES do deploy do backend.

---

### Patch 2 — Backend: `gm.ts` refatorado

**Arquivo:** `backend/src/routes/gm.ts`
**Camada:** backend/route
**Substituir arquivo inteiro por:**

```ts
import { Router, Request, Response } from 'express';
import { sql } from 'kysely';
import { db } from '../db';
import { optionalAuth, authMiddleware } from '../middlewares/auth';

const router = Router();

type PublicTableContact = {
  channel: string;
  value: string;
  label: string | null;
  discord_server_url: string | null;
  sort_order: number;
};

// ================================================================
// GET /api/v1/gm/:slug
// Perfil público do mestre.
// `optionalAuth` é usado para computar `viewer_context` (is_owner/is_admin)
// sem expor `user_id` bruto no payload.
// NÃO retorna `metrics_*` — essas informações vivem em /:slug/insights.
// ================================================================
router.get('/:slug', optionalAuth, async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const gm = await db
      .selectFrom('gm_profiles as gm')
      .innerJoin('users as u', 'u.id', 'gm.user_id')
      .innerJoin('profiles as p', 'p.user_id', 'u.id')
      .select([
        'gm.id',
        'gm.user_id',
        'gm.slug',
        sql<string>`COALESCE(gm.nickname, p.display_name)`.as('display_name'),
        'gm.bio_long',
        'gm.tagline',
        sql<string>`COALESCE(gm.avatar_url, p.avatar_url)`.as('avatar_url'),
        'gm.banner_url',
        'gm.languages',
        'gm.specialties',
        'gm.badges',
        'gm.selling_points',
        'gm.promo_badge_text',
        'gm.closed_group_enabled',
        'gm.closed_group_systems',
        'gm.closed_group_description',
        'gm.closed_group_min_price_cents',
        'gm.tables_count',
        'gm.avg_rating',
        'gm.reviews_count',
        'gm.created_at',
        'gm.discord_connected',
        'gm.discord_username',
        'gm.covil_verified',
        'gm.experience_years',
        'gm.average_price',
      ])
      .where('gm.slug', '=', slug)
      .executeTakeFirst();

    if (!gm) {
      return res.status(404).json({ error: 'Mestre não encontrado.' });
    }

    // Computa viewer_context no backend — não expõe user_id bruto
    const viewerUserId = req.user?.userId ?? null;
    const viewerRole = req.user?.role ?? null;
    const viewer_context = {
      is_owner: viewerUserId === gm.user_id,
      is_admin: viewerRole === 'admin',
    };

    // Remove user_id do payload público
    const { user_id: _ownerId, ...gmPublic } = gm;

    // Mesas ativas — SEM metrics_*
    const tables = await db
      .selectFrom('tables as t')
      .leftJoin('systems as s', 's.id', 't.system_id')
      .select([
        't.id',
        't.slug',
        't.title',
        't.description',
        't.cover_url',
        't.status',
        't.type',
        't.audience',
        't.modality',
        't.price_type',
        't.price_value',
        't.slots_total',
        't.slots_filled',
        't.slots_open',
        't.language',
        't.experience_level',
        't.publisher_role',
        't.actual_gm_name',
        't.featured',
        't.is_ddal',
        't.ddal_code',
        't.ddal_name',
        't.ddal_tier',
        't.created_at',
        't.synopsis_narrative',
        't.features',
        's.name as system_name',
        's.slug as system_slug',
      ])
      .where('t.gm_id', '=', gm.id)
      .where('t.status', '=', 'active')
      .orderBy('t.featured', 'desc')
      .orderBy('t.created_at', 'desc')
      .execute();

    let tablesWithContacts: any[] = [];
    if (tables.length > 0) {
      const tableIds = tables.map((t) => t.id);
      const contacts = await db
        .selectFrom('table_contacts')
        .select(['table_id', 'channel', 'value', 'label', 'discord_server_url', 'sort_order'])
        .where('table_id', 'in', tableIds)
        .orderBy('sort_order', 'asc')
        .execute();

      const byTable = new Map<string, PublicTableContact[]>();
      for (const c of contacts) {
        if (!byTable.has(c.table_id)) byTable.set(c.table_id, []);
        byTable.get(c.table_id)!.push({
          channel: c.channel,
          value: c.value,
          label: c.label,
          discord_server_url: c.discord_server_url,
          sort_order: c.sort_order,
        });
      }

      tablesWithContacts = tables.map((t) => ({
        ...t,
        contacts: byTable.get(t.id) ?? [],
      }));
    }

    // Links públicos — contrato completo
    const links = await db
      .selectFrom('user_links')
      .innerJoin('users as u', 'u.id', 'user_links.user_id')
      .innerJoin('gm_profiles as gm_check', 'gm_check.user_id', 'u.id')
      .select([
        'user_links.id',
        'user_links.url',
        'user_links.title',
        'user_links.description',
        'user_links.type',
        'user_links.embed_url',
        'user_links.thumbnail_url',
        'user_links.sort_order',
      ])
      .where('gm_check.id', '=', gm.id)
      .orderBy('user_links.sort_order', 'asc')
      .execute();

    // Resolve nomes dos sistemas aceitos em grupo fechado
    let closedGroupSystems: Array<{ id: string; name: string }> = [];
    if (
      gm.closed_group_enabled &&
      Array.isArray(gm.closed_group_systems) &&
      gm.closed_group_systems.length > 0
    ) {
      closedGroupSystems = await db
        .selectFrom('systems')
        .select(['id', 'name'])
        .where('id', 'in', gm.closed_group_systems as string[])
        .execute();
    }

    const closed_group = {
      enabled: !!gm.closed_group_enabled,
      systems: closedGroupSystems,
      description: gm.closed_group_description,
      min_price_cents: gm.closed_group_min_price_cents,
    };

    return res.json({
      data: {
        ...gmPublic,
        closed_group,
        tables: tablesWithContacts,
        links,
        viewer_context,
      },
    });
  } catch (error: any) {
    console.error('[GET /gm/:slug]', error);
    return res.status(500).json({ error: 'Erro ao buscar perfil do mestre.' });
  }
});

// ================================================================
// GET /api/v1/gm/:slug/insights
// Protegido: somente dono ou admin.
// Retorna métricas agregadas por mesa + recomendações derivadas.
// ================================================================
router.get('/:slug/insights', authMiddleware, async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const gm = await db
      .selectFrom('gm_profiles')
      .select(['id', 'user_id'])
      .where('slug', '=', slug)
      .executeTakeFirst();

    if (!gm) {
      return res.status(404).json({ error: 'Mestre não encontrado.' });
    }

    const isOwner = req.user!.userId === gm.user_id;
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const metrics = await db
      .selectFrom('tables as t')
      .leftJoin('table_metrics as tm', 'tm.table_id', 't.id')
      .select([
        't.id',
        't.slug',
        't.title',
        sql<number>`COALESCE(tm.views_count, 0)`.as('views'),
        sql<number>`COALESCE(tm.clicks_count, 0)`.as('clicks'),
        sql<number>`COALESCE(tm.contacts_count, 0)`.as('contacts'),
        sql<number>`COALESCE(tm.favorites_count, 0)`.as('favorites'),
      ])
      .where('t.gm_id', '=', gm.id)
      .execute();

    const recommendations = buildRecommendations(metrics);

    return res.json({
      data: {
        metrics,
        recommendations,
      },
    });
  } catch (error: any) {
    console.error('[GET /gm/:slug/insights]', error);
    return res.status(500).json({ error: 'Erro ao buscar insights.' });
  }
});

type MetricRow = {
  id: string;
  slug: string;
  title: string;
  views: number;
  clicks: number;
  contacts: number;
  favorites: number;
};

type Recommendation = {
  table_slug: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
};

function buildRecommendations(metrics: MetricRow[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const m of metrics) {
    if (m.views >= 20 && m.contacts === 0) {
      recs.push({
        table_slug: m.slug,
        severity: 'high',
        message: `Mesa "${m.title}" tem ${m.views} visualizações e zero contatos. Revise capa, preço e descrição.`,
      });
    }
    if (m.clicks >= 10 && m.contacts === 0) {
      recs.push({
        table_slug: m.slug,
        severity: 'medium',
        message: `Mesa "${m.title}" recebe cliques mas não gera contato. Teste um CTA mais direto na descrição.`,
      });
    }
    if (m.views === 0 && m.clicks === 0) {
      recs.push({
        table_slug: m.slug,
        severity: 'low',
        message: `Mesa "${m.title}" ainda não recebeu tráfego. Compartilhe o link em suas redes.`,
      });
    }
  }
  return recs;
}

export default router;
```

**Motivo:** Remove vazamento, corrige contrato de links, adiciona `viewer_context`, cria endpoint dedicado `/insights` protegido, expõe `closed_group` com sistemas resolvidos, ordena por `featured DESC`.

**Dependência:** Patch 1 (migração) + `optionalAuth`/`authMiddleware` já existem.

---

### Patch 3 — Backend: estender `gmPanel.ts` para aceitar novos campos de perfil

**Arquivo:** `backend/src/routes/gmPanel.ts`
**Camada:** backend/route
**Ação:** Estender `POST /api/v1/gm/profile` (já em uso pelo `PainelMestrePage.tsx`) e o `GET /api/v1/gm/me` para aceitar/retornar os novos campos.

**Exemplo de estrutura (adaptar ao código real do `gmPanel.ts` existente):**

```ts
// Schema de validação do body (Zod ou similar)
const upsertProfileBodySchema = z.object({
  slug: z.string().min(1),
  nickname: z.string().optional(),
  bio_long: z.string().optional(),
  tagline: z.string().max(200).optional().nullable(),
  promo_badge_text: z.string().max(120).optional().nullable(),
  selling_points: z.array(z.object({
    icon: z.string(),
    title: z.string(),
    description: z.string(),
    highlight: z.string().optional(),
  })).optional().default([]),
  closed_group_enabled: z.boolean().optional().default(false),
  closed_group_systems: z.array(z.string().uuid()).optional().default([]),
  closed_group_description: z.string().optional().nullable(),
  closed_group_min_price_cents: z.number().int().nonnegative().optional().nullable(),
});

// No handler de POST /profile, mesclar com o upsert existente
await db
  .insertInto('gm_profiles')
  .values({
    user_id: req.user!.userId,
    slug: body.slug,
    nickname: body.nickname,
    bio_long: body.bio_long,
    tagline: body.tagline,
    promo_badge_text: body.promo_badge_text,
    selling_points: JSON.stringify(body.selling_points),
    closed_group_enabled: body.closed_group_enabled,
    closed_group_systems: JSON.stringify(body.closed_group_systems),
    closed_group_description: body.closed_group_description,
    closed_group_min_price_cents: body.closed_group_min_price_cents,
  })
  .onConflict((oc) =>
    oc.column('user_id').doUpdateSet({
      slug: body.slug,
      nickname: body.nickname,
      bio_long: body.bio_long,
      tagline: body.tagline,
      promo_badge_text: body.promo_badge_text,
      selling_points: JSON.stringify(body.selling_points),
      closed_group_enabled: body.closed_group_enabled,
      closed_group_systems: JSON.stringify(body.closed_group_systems),
      closed_group_description: body.closed_group_description,
      closed_group_min_price_cents: body.closed_group_min_price_cents,
      updated_at: new Date(),
    })
  )
  .execute();
```

**No `GET /me`:** Adicionar todos os novos campos ao select para que o painel possa renderizar o estado atual do formulário.

**Motivo:** Viabiliza a UI de gerenciamento no painel.
**Dependência:** Patch 1.
**Observação:** Implementação real depende do código atual do `gmPanel.ts` não enviado em detalhes. Pedir arquivo se o agente não conseguir mesclar.

---

### Patch 4 — Frontend: hook `useMestre`

**Arquivo novo:** `frontend/src/hooks/useMestre.ts`

```ts
import { useEffect, useState, useCallback } from 'react';

export interface SellingPoint {
  icon: string;
  title: string;
  description: string;
  highlight?: string;
}

export interface ClosedGroupInfo {
  enabled: boolean;
  systems: Array<{ id: string; name: string }>;
  description: string | null;
  min_price_cents: number | null;
}

export interface ViewerContext {
  is_owner: boolean;
  is_admin: boolean;
}

export interface MestrePublicData {
  id: string;
  slug: string;
  display_name: string;
  bio_long: string | null;
  tagline: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  languages: string[] | null;
  specialties: string[] | null;
  badges: string[] | null;
  selling_points: SellingPoint[];
  promo_badge_text: string | null;
  closed_group: ClosedGroupInfo;
  tables_count: number;
  avg_rating: number | null;
  reviews_count: number;
  discord_connected: boolean | null;
  discord_username: string | null;
  covil_verified: boolean | null;
  experience_years: number | null;
  average_price: number | null;
  tables: any[]; // tipar com interface TableCard compartilhada
  links: any[];  // tipar com UserLink
  viewer_context: ViewerContext;
}

type Status = 'idle' | 'loading' | 'success' | 'error' | 'not_found';

interface UseMestreResult {
  data: MestrePublicData | null;
  status: Status;
  error: string | null;
  refetch: () => void;
}

export function useMestre(slug: string | undefined): UseMestreResult {
  const [data, setData] = useState<MestrePublicData | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!slug) {
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setError(null);

    fetch(`/api/v1/gm/${slug}`, {
      signal: controller.signal,
      credentials: 'include', // necessário para optionalAuth ler cookie am_session
    })
      .then(async (res) => {
        if (res.status === 404) {
          setStatus('not_found');
          return null;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        setData(json.data);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if ((err as any)?.name === 'AbortError') return;
        console.error('[useMestre]', err);
        setError((err as Error).message || 'Erro desconhecido');
        setStatus('error');
      });

    return () => controller.abort();
  }, [slug, reloadKey]);

  return { data, status, error, refetch };
}
```

---

### Patch 5 — Frontend: `useMestreInsights` (carregado só quando `canSeeInsights`)

**Arquivo novo:** `frontend/src/hooks/useMestreInsights.ts`

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

export interface InsightsPayload {
  metrics: InsightMetric[];
  recommendations: InsightRecommendation[];
}

interface UseMestreInsightsResult {
  data: InsightsPayload | null;
  loading: boolean;
  error: string | null;
}

export function useMestreInsights(
  slug: string | undefined,
  enabled: boolean
): UseMestreInsightsResult {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !slug) {
      setData(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/v1/gm/${slug}/insights`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json.data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as any)?.name === 'AbortError') return;
        console.error('[useMestreInsights]', err);
        setError((err as Error).message || 'Erro ao carregar insights');
        setLoading(false);
      });

    return () => controller.abort();
  }, [slug, enabled]);

  return { data, loading, error };
}
```

---

### Patch 6 — Frontend: `MestrePage.tsx` refatorado (orquestração)

**Arquivo:** `frontend/src/pages/MestrePage.tsx`
**Substituir conteúdo por:**

```tsx
import { useParams } from 'react-router-dom';
import { useMestre } from '../hooks/useMestre';
import { useMestreInsights } from '../hooks/useMestreInsights';
import { MestreHero } from '../components/mestre/MestreHero';
import { MestreSellingPoints } from '../components/mestre/MestreSellingPoints';
import { MestreBio } from '../components/mestre/MestreBio';
import { MestreFeaturedTable } from '../components/mestre/MestreFeaturedTable';
import { MestreTablesGrid } from '../components/mestre/MestreTablesGrid';
import { MestreClosedGroupSection } from '../components/mestre/MestreClosedGroupSection';
import { MestreInsightsSection } from '../components/mestre/MestreInsightsSection';
import { MestreRecommendationsSection } from '../components/mestre/MestreRecommendationsSection';
import { MestreLinksSection } from '../components/mestre/MestreLinksSection';
import { MestreSkeleton } from '../components/mestre/MestreSkeleton';
import { MestreNotFound } from '../components/mestre/MestreNotFound';
import { MestreError } from '../components/mestre/MestreError';
import './MestrePage.css';

export default function MestrePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: gm, status, error, refetch } = useMestre(slug);

  const canSeeInsights = !!(
    gm?.viewer_context?.is_owner || gm?.viewer_context?.is_admin
  );

  const insights = useMestreInsights(slug, canSeeInsights);

  if (status === 'loading' || status === 'idle') return <MestreSkeleton />;
  if (status === 'not_found') return <MestreNotFound slug={slug ?? ''} />;
  if (status === 'error') return <MestreError message={error} onRetry={refetch} />;
  if (!gm) return <MestreSkeleton />;

  const featuredTable = gm.tables.find((t) => t.featured);
  const otherTables = gm.tables.filter((t) => !t.featured);

  return (
    <div className="mestre-page">
      <MestreHero gm={gm} />
      <MestreSellingPoints sellingPoints={gm.selling_points} />
      <MestreBio gm={gm} />

      <section id="mesas" className="tables-section">
        <div className="container">
          <h2 className="section-title">Mesas Disponíveis</h2>
          {featuredTable && <MestreFeaturedTable table={featuredTable} />}
          {otherTables.length > 0 && <MestreTablesGrid tables={otherTables} />}
        </div>
      </section>

      <MestreClosedGroupSection closedGroup={gm.closed_group} gmSlug={gm.slug} />

      {canSeeInsights && (
        <>
          <MestreInsightsSection
            gmSlug={gm.slug}
            data={insights.data}
            loading={insights.loading}
          />
          <MestreRecommendationsSection
            recommendations={insights.data?.recommendations ?? []}
            loading={insights.loading}
          />
        </>
      )}

      <MestreLinksSection links={gm.links} />
    </div>
  );
}
```

---

### Patch 7 — Frontend: `TableCard` ajustes pontuais

**Arquivo:** `frontend/src/components/TableCard.tsx`

**Mudança 1 — container:**
Substituir:
```tsx
className="group relative block w-full h-[420px] rounded-2xl overflow-hidden bg-[#1B2A4A] border border-white/10 hover:border-[var(--color-artificio-orange)]/40 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_0_30px_rgba(232,82,26,0.15)] hover:-translate-y-1"
```
Por:
```tsx
className="group relative flex flex-col w-full min-h-[420px] rounded-2xl overflow-hidden bg-[#1B2A4A] border border-white/10 hover:border-[var(--color-artificio-orange)]/40 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_0_30px_rgba(232,82,26,0.15)] hover:-translate-y-1"
```

**Mudança 2 — capa:**
Substituir `<div className="h-[168px] relative overflow-hidden">`
Por: `<div className="aspect-[16/10] w-full relative overflow-hidden">`

**Mudança 3 — conteúdo:**
Substituir `<div className="h-[252px] p-4 flex flex-col">`
Por: `<div className="flex-1 p-4 flex flex-col">`

**Mudança 4 — badge urgente (substituir bloco inteiro):**
```tsx
{isFull && (
  <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-wide text-white bg-red-600 backdrop-blur-sm">
    Lotada
  </span>
)}
```

**Mudança 5 — remover bloco morto:**
Remover inteiramente:
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

### Patch 8 — Frontend: `LinksDisplay` lazy-load e Lucide

**Arquivo:** `frontend/src/components/LinksDisplay.tsx`

**Mudança 1 — import:**
```tsx
import { Video, Music, Radio, MessageCircle, FileText, Globe, ExternalLink, Camera, Share2, Briefcase, BookOpen } from 'lucide-react';
```

**Mudança 2 — substituir `CATEGORY_LABELS` por `CATEGORY_META`:**
```tsx
const CATEGORY_META: Record<string, { label: string; Icon: typeof Video }> = {
  content:   { label: 'Conteúdo',   Icon: Video },
  social:    { label: 'Presença',   Icon: Share2 },
  authority: { label: 'Autoridade', Icon: BookOpen },
};
```

**Mudança 3 — render do título de categoria:**
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

**Mudança 4 — iframe:**
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

---

### Patch 9 — Frontend: `MestreHero.tsx`

**Arquivo novo:** `frontend/src/components/mestre/MestreHero.tsx`

```tsx
import { Link } from 'react-router-dom';
import { CheckCircle2, Sparkles, Star, Users, MessageSquare, ShieldCheck, Clock } from 'lucide-react';
import type { MestrePublicData } from '../../hooks/useMestre';

interface MestreHeroProps {
  gm: MestrePublicData;
}

export function MestreHero({ gm }: MestreHeroProps) {
  const hasAnyStat =
    (gm.tables_count ?? 0) > 0 ||
    (gm.avg_rating ?? 0) > 0 ||
    (gm.reviews_count ?? 0) > 0;

  const hasAnyTrust =
    (gm.tables_count ?? 0) > 0 ||
    gm.covil_verified ||
    (gm.experience_years ?? 0) >= 3;

  const handleContactScroll = () => {
    const el = document.getElementById('contato');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      const mesas = document.getElementById('mesas');
      mesas?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleMesasScroll = () => {
    document.getElementById('mesas')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-section">
      {gm.banner_url ? (
        <img src={gm.banner_url} alt="" className="hero-banner" />
      ) : (
        <div className="hero-banner-gradient" />
      )}
      <div className="hero-overlay" />

      <div className="hero-content">
        {gm.promo_badge_text && (
          <div className="hero-promo-badge">
            <Sparkles className="w-4 h-4" />
            <span>{gm.promo_badge_text}</span>
          </div>
        )}

        <div className="hero-avatar">
          {gm.avatar_url ? (
            <img src={gm.avatar_url} alt={gm.display_name} />
          ) : (
            <div className="hero-avatar-placeholder">
              {gm.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="hero-badges">
          <span className="badge badge-mestre">Mestre Profissional</span>
          {gm.covil_verified && (
            <span className="badge badge-covil">
              <ShieldCheck className="w-4 h-4" /> Verificado no Covil
            </span>
          )}
        </div>

        <h1 className="hero-title">
          Viva campanhas inesquecíveis com{' '}
          <span className="hero-title-accent">{gm.display_name}</span>
        </h1>

        {gm.bio_long && <p className="hero-bio">{gm.bio_long}</p>}

        <div className="hero-ctas">
          <button
            type="button"
            className="cta-button cta-primary"
            onClick={handleContactScroll}
          >
            Entrar em Contato
          </button>
          <button
            type="button"
            className="cta-button cta-secondary"
            onClick={handleMesasScroll}
          >
            Ver Mesas Disponíveis
          </button>
        </div>

        {hasAnyTrust && (
          <div className="hero-trust-row">
            {(gm.tables_count ?? 0) > 0 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                {gm.tables_count} {gm.tables_count === 1 ? 'mesa ativa' : 'mesas ativas'}
              </span>
            )}
            {gm.covil_verified && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Verificado no Covil
              </span>
            )}
            {(gm.experience_years ?? 0) >= 3 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                {gm.experience_years}+ anos de experiência
              </span>
            )}
          </div>
        )}

        {hasAnyStat && (
          <div className="hero-stats">
            {(gm.tables_count ?? 0) > 0 && (
              <div className="stat">
                <Users className="stat-icon" />
                <span className="stat-value">{gm.tables_count}</span>
                <span className="stat-label">
                  {gm.tables_count === 1 ? 'Mesa' : 'Mesas'}
                </span>
              </div>
            )}
            {(gm.avg_rating ?? 0) > 0 && (
              <div className="stat">
                <Star className="stat-icon" />
                <span className="stat-value">{gm.avg_rating!.toFixed(1)}★</span>
                <span className="stat-label">Avaliação</span>
              </div>
            )}
            {(gm.reviews_count ?? 0) > 0 && (
              <div className="stat">
                <MessageSquare className="stat-icon" />
                <span className="stat-value">{gm.reviews_count}</span>
                <span className="stat-label">
                  {gm.reviews_count === 1 ? 'Avaliação' : 'Avaliações'}
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

---

### Patch 10 — Frontend: `MestreSellingPoints.tsx`

**Arquivo novo:** `frontend/src/components/mestre/MestreSellingPoints.tsx`

```tsx
import { Clock, Monitor, Coins, Sparkles, Shield, Heart, Zap, type LucideIcon } from 'lucide-react';
import type { SellingPoint } from '../../hooks/useMestre';

const SELLING_POINT_ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  monitor: Monitor,
  coins: Coins,
  sparkles: Sparkles,
  shield: Shield,
  heart: Heart,
  zap: Zap,
};

interface Props {
  sellingPoints: SellingPoint[];
}

export function MestreSellingPoints({ sellingPoints }: Props) {
  if (!Array.isArray(sellingPoints) || sellingPoints.length === 0) return null;

  return (
    <section className="why-section">
      <div className="container">
        <h2 className="section-title">O que eu ofereço</h2>
        <div className="benefits-grid">
          {sellingPoints.map((sp, idx) => {
            const Icon = SELLING_POINT_ICONS[sp.icon] ?? Sparkles;
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

---

### Patch 11 — Frontend: `MestreClosedGroupSection.tsx`

**Arquivo novo:** `frontend/src/components/mestre/MestreClosedGroupSection.tsx`

```tsx
import { Users, Dices, Tag } from 'lucide-react';
import type { ClosedGroupInfo } from '../../hooks/useMestre';

interface Props {
  closedGroup: ClosedGroupInfo;
  gmSlug: string;
}

function formatPrice(cents: number | null): string | null {
  if (cents == null) return null;
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function MestreClosedGroupSection({ closedGroup }: Props) {
  if (!closedGroup?.enabled) return null;

  const price = formatPrice(closedGroup.min_price_cents);

  const handleRequestQuote = () => {
    document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="closed-group-section" id="grupo-fechado">
      <div className="container">
        <div className="closed-group-badge">
          <Users className="w-4 h-4" />
          <span>Oferta Especial</span>
        </div>

        <h2 className="section-title">Disponível para Grupos Fechados</h2>

        <p className="closed-group-description">
          {closedGroup.description ||
            'Tem um grupo fechado de amigos? Mestra campanhas exclusivas com horários flexíveis e experiência personalizada.'}
        </p>

        {closedGroup.systems.length > 0 && (
          <div className="closed-group-systems">
            <h3 className="closed-group-subtitle">
              <Dices className="w-4 h-4" /> Sistemas aceitos
            </h3>
            <div className="system-chips">
              {closedGroup.systems.map((s) => (
                <span key={s.id} className="system-chip">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {price && (
          <div className="closed-group-price">
            <Tag className="w-4 h-4" />
            <span>A partir de <strong>{price}</strong></span>
          </div>
        )}

        <button
          type="button"
          className="cta-button cta-primary cta-button-large"
          onClick={handleRequestQuote}
        >
          Solicitar orçamento para grupo fechado
        </button>
      </div>
    </section>
  );
}
```

---

### Patch 12 — Frontend: `MestreInsightsSection.tsx` + `OwnerOnlyBanner`

**Arquivo novo:** `frontend/src/components/mestre/OwnerOnlyBanner.tsx`

```tsx
import { Lock } from 'lucide-react';

export function OwnerOnlyBanner() {
  return (
    <div className="owner-only-banner">
      <Lock size={14} />
      <span>Visível apenas para você</span>
    </div>
  );
}
```

**Arquivo novo:** `frontend/src/components/mestre/MestreInsightsSection.tsx`

```tsx
import type { InsightsPayload } from '../../hooks/useMestreInsights';
import { OwnerOnlyBanner } from './OwnerOnlyBanner';

interface Props {
  gmSlug: string;
  data: InsightsPayload | null;
  loading: boolean;
}

export function MestreInsightsSection({ data, loading }: Props) {
  return (
    <section className="insights-section">
      <div className="container">
        <OwnerOnlyBanner />
        <h2 className="section-title">Insights das suas mesas</h2>

        {loading && <p className="insights-loading">Carregando métricas…</p>}

        {!loading && data && data.metrics.length > 0 && (
          <div className="insights-grid">
            {data.metrics.map((m) => (
              <div key={m.id} className="insight-card">
                <h3 className="insight-title">{m.title}</h3>
                <div className="insight-metrics">
                  <div className="metric">
                    <span className="metric-value">{m.views}</span>
                    <span className="metric-label">Visualizações</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">{m.clicks}</span>
                    <span className="metric-label">Cliques</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">{m.contacts}</span>
                    <span className="metric-label">Contatos</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">{m.favorites}</span>
                    <span className="metric-label">Favoritos</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (!data || data.metrics.length === 0) && (
          <p className="insights-empty">
            Ainda não há métricas para exibir. Divulgue suas mesas para começar a coletar dados.
          </p>
        )}
      </div>
    </section>
  );
}
```

---

### Patch 13 — Frontend: `MestreRecommendationsSection.tsx`

**Arquivo novo:** `frontend/src/components/mestre/MestreRecommendationsSection.tsx`

```tsx
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { InsightRecommendation } from '../../hooks/useMestreInsights';
import { OwnerOnlyBanner } from './OwnerOnlyBanner';

interface Props {
  recommendations: InsightRecommendation[];
  loading: boolean;
}

const SEVERITY_META = {
  high:   { Icon: AlertTriangle, label: 'Atenção',    className: 'recommendation-high' },
  medium: { Icon: Info,          label: 'Sugestão',   className: 'recommendation-medium' },
  low:    { Icon: CheckCircle2,  label: 'Dica',       className: 'recommendation-low' },
} as const;

export function MestreRecommendationsSection({ recommendations, loading }: Props) {
  if (loading) return null;
  if (recommendations.length === 0) return null;

  return (
    <section className="recommendations-section">
      <div className="container">
        <OwnerOnlyBanner />
        <h2 className="section-title">Recomendações personalizadas</h2>
        <ul className="recommendations-list">
          {recommendations.map((rec, idx) => {
            const meta = SEVERITY_META[rec.severity];
            const Icon = meta.Icon;
            return (
              <li key={idx} className={`recommendation-item ${meta.className}`}>
                <Icon className="w-5 h-5 shrink-0" />
                <div>
                  <span className="recommendation-label">{meta.label}</span>
                  <p>{rec.message}</p>
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

### Patch 14 — Frontend: componentes restantes

**`MestreBio.tsx`** — foto + texto longo + chips de especialidades (Lucide) + blockquote de `tagline`. Usar `gm.specialties` e `gm.tagline`. Renderizar chips só se `specialties.length > 0`.

**`MestreFeaturedTable.tsx`** — layout 2 colunas. Capa 1:1 à esquerda. À direita: título, descrição, bullets de `table.features` com `CheckCircle2`, `SlotsIndicator`, preço, CTA próprio linkando a `/mesas/${table.slug}`.

**`MestreTablesGrid.tsx`** — wrapper. Se `tables.length === 0`, retorna `null`. Grid responsivo com `TableCardComponent` para cada mesa.

**`MestreLinksSection.tsx`** — wrapper. Se `links.length === 0`, retorna `null`. Renderiza `<LinksDisplay links={links} />`.

**`MestreSkeleton.tsx`** — skeleton do hero + skeleton do grid (reaproveitar `TableCardSkeleton`).

**`MestreNotFound.tsx`** — mensagem + CTA para `/catalogo`.

**`MestreError.tsx`** — mensagem + botão `onRetry`.

---

### Patch 15 — Atualização do `MAPA_DE_API.md`

**Substituir a seção `### GM` por:**

```markdown
### GM (`routes/gm.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/:slug` | ✅ Em Uso | useMestre.ts (via MestrePage.tsx) — `optionalAuth` aplicado; retorna `viewer_context { is_owner, is_admin }`, `closed_group`, `selling_points`, `features` em tables; NÃO retorna `metrics_*` (migrado para `/:slug/insights`) |
| **GET** | `/:slug/insights` | ✅ Em Uso | useMestreInsights.ts (via MestrePage.tsx) — protegido por `authMiddleware`; retorna `metrics` e `recommendations`; acesso apenas para dono ou admin |
```

---

## 9. Plano de execução ordenado (ordem obrigatória)

> **Regra de ouro:** cada passo só pode começar depois que o anterior estiver concluído e validado. Nenhum atalho.

### Passo 0 — Validação preventiva (1h)

1. Rodar `grep -rn "metrics_views\|metrics_clicks\|metrics_contacts\|metrics_favorites" frontend/src/`.
2. Registrar ocorrências encontradas em cada arquivo.
3. Abrir `backend/src/routes/gmPanel.ts` e verificar se `GET /tables` retorna os `metrics_*`.
4. Se **não retornar**: estender o select desse endpoint (é autenticado, sem risco de vazamento).
5. Validar que `PainelMestrePage.tsx` continua consumindo `metrics_*` via `/api/v1/gm/tables` (confirmado no estado atual).
6. Validar ausência de dependência de `GET /api/v1/gm/:slug` em `useCreateTableForm.ts` e `uiHelpers.ts` (confirmado no estado atual).
7. Deploy dessa migração preventiva **antes** de tocar no `gm.ts` público.

### Passo 1 — Migração SQL (15min + rollback testado)

1. Rodar migração do Patch 1 em ambiente de staging.
2. Validar:
   ```sql
   \d+ gm_profiles
   \d+ tables
   \d+ user_links
   \d+ idx_tables_gm_featured_created
   ```
3. Confirmar que todas as colunas e o índice foram criados.
4. Promover para produção.

### Passo 2 — Backend: `gm.ts` + `gmPanel.ts` (2h)

1. Aplicar Patch 2 (`gm.ts` refatorado).
2. Aplicar Patch 3 (`gmPanel.ts` estendido).
3. Testar manualmente com `curl` ou Postman:
   - `GET /api/v1/gm/<slug>` anônimo → `viewer_context: { is_owner: false, is_admin: false }`, sem `metrics_*`.
   - `GET /api/v1/gm/<slug>` com cookie do dono → `viewer_context: { is_owner: true, ... }`.
   - `GET /api/v1/gm/<slug>/insights` sem auth → 401.
   - `GET /api/v1/gm/<slug>/insights` com auth do dono → 200 com `metrics` e `recommendations`.
   - `GET /api/v1/gm/<slug>/insights` com auth de outro usuário → 403.
4. Atualizar `MAPA_DE_API.md` (Patch 15).

### Passo 3 — Frontend: hooks + orquestração (2h)

1. Criar `hooks/useMestre.ts` (Patch 4).
2. Criar `hooks/useMestreInsights.ts` (Patch 5).
3. Refatorar `pages/MestrePage.tsx` para orquestração (Patch 6) — temporariamente com stubs dos componentes novos.

### Passo 4 — Frontend: componentes um a um (4-6h)

Ordem:
1. `MestreSkeleton.tsx`, `MestreNotFound.tsx`, `MestreError.tsx` (simples, desbloqueiam estados).
2. `MestreHero.tsx` (Patch 9).
3. `MestreSellingPoints.tsx` (Patch 10).
4. `MestreBio.tsx`.
5. `MestreFeaturedTable.tsx`.
6. `MestreTablesGrid.tsx`.
7. `MestreClosedGroupSection.tsx` (Patch 11).
8. `MestreInsightsSection.tsx` + `OwnerOnlyBanner.tsx` (Patch 12).
9. `MestreRecommendationsSection.tsx` (Patch 13).
10. `MestreLinksSection.tsx`.

Validar cada um em dev antes de passar para o próximo.

### Passo 5 — Frontend: ajustes em `TableCard` e `LinksDisplay` (1h)

1. Patch 7 — `TableCard.tsx`.
2. Patch 8 — `LinksDisplay.tsx`.

### Passo 6 — Painel do mestre: UI de gestão (4h)

1. Em `PainelMestrePage.tsx`, estender formulário de perfil com campos:
   - `tagline` (textarea curta)
   - `promo_badge_text` (input)
   - `selling_points` (lista editável: adicionar/remover cards)
   - `closed_group_enabled` (toggle)
   - `closed_group_systems` (multi-select usando `GET /systems`)
   - `closed_group_description` (textarea)
   - `closed_group_min_price_cents` (input numérico em reais, converter para cents no submit)
2. Submit via `POST /api/v1/gm/profile` estendido.
3. Pré-popular estado via `GET /api/v1/gm/me`.

### Passo 7 — QA completo (2h)

Ver checklist seção 10.

### Passo 8 — Deploy produção

1. Backend primeiro.
2. Frontend depois.
3. Monitorar logs dos middlewares `optionalAuth` e `authMiddleware` por 24h.

---

## 10. Checklist de validação pós-deploy

### Segurança de dados
- [ ] Visitante anônimo em `/mestre/<slug>` **não vê** bloco de Insights.
- [ ] Visitante anônimo em `/mestre/<slug>` **não vê** bloco de Recomendações.
- [ ] `GET /api/v1/gm/<slug>` anônimo **não retorna** `metrics_*` em nenhum lugar do JSON.
- [ ] `GET /api/v1/gm/<slug>/insights` sem token retorna **401**.
- [ ] `GET /api/v1/gm/<slug>/insights` com token de outro usuário retorna **403**.
- [ ] `GET /api/v1/gm/<slug>/insights` com token do dono retorna **200** com `metrics` + `recommendations`.
- [ ] Admin autenticado vê Insights/Recomendações de qualquer mestre.

### UI pública
- [ ] Hero mostra 2 CTAs quando há ambos; primário destaca.
- [ ] `hero-stats` não aparece para mestre com todos os valores zerados.
- [ ] Seção "O que eu ofereço" não aparece se `selling_points` vazio.
- [ ] Seção "Grupo Fechado" só aparece se `closed_group.enabled === true`.
- [ ] Mesa com `featured === true` aparece antes do grid de outras.
- [ ] `TableCard` com título curto não tem espaço branco.
- [ ] Bloco "Ver detalhes" dentro do card não existe mais.
- [ ] Badge "Últimas vagas" não aparece mais (só "Lotada" quando `isFull`).
- [ ] `LinksDisplay` renderiza embeds com `loading="lazy"`.
- [ ] Categorias de link usam ícones Lucide.

### Estados
- [ ] Slug inexistente → `MestreNotFound` com CTA para `/catalogo`.
- [ ] Erro de rede → `MestreError` com botão "Tentar novamente".
- [ ] Loading → `MestreSkeleton`.

### Painel do mestre
- [ ] `PainelMestrePage` continua mostrando métricas das mesas (agora vindas de `/api/v1/gm/tables` ou endpoint equivalente).
- [ ] Formulário de perfil permite editar `tagline`, `promo_badge_text`, `selling_points`, `closed_group_*`.
- [ ] Salvar perfil persiste os novos campos.
- [ ] Reload mostra os valores salvos.

### Tracking (v2, opcional)
- [ ] `POST /api/v1/gm/:slug/view` dispara 1 vez por sessão.
- [ ] Incrementa contador no banco.

### Documentação
- [ ] `MAPA_DE_API.md` atualizado com `/:slug/insights` e nota sobre `/:slug` sem `metrics_*`.
- [ ] Commit único ou PR com migração + backend + frontend + doc.

---

## 11. Prompt final para implementação por Sonnet 4.5

```
CONTEXTO
========
Você vai implementar a refatoração completa da página pública do mestre (/mestre/:slug)
em um projeto React (Vite + TS + Tailwind) com backend Node/Express/Kysely/Postgres.

Middlewares já existentes em backend/src/middleware/auth.ts:
- authMiddleware (exige token, popula req.user: { userId, role })
- optionalAuth (popula req.user quando tem token; não bloqueia sem)
- requireAdmin
- requireRole

Interface AuthDecoded: { userId: string; role: UserRole; iat?; exp? }

O MAPA_DE_API.md é fonte de verdade de rotas. Qualquer rota nova/alterada exige
atualização do arquivo na mesma PR. Sem exceções.

Schema confirmado via psql no banco beta (mesas-beta-db):
- gm_profiles NÃO TEM: tagline, selling_points, promo_badge_text, closed_group_enabled,
  closed_group_systems, closed_group_description, closed_group_min_price_cents.
- tables NÃO TEM: features.
- user_links JÁ TEM: type, title, description, thumbnail_url, sort_order, url.
- user_links NÃO TEM: embed_url.
- table_metrics está completo.
- Índice idx_tables_gm_featured_created não existe.

Consumidores confirmados de GET /api/v1/gm/:slug:
- useMestre.ts (consumido por MestrePage.tsx)
- useMestreInsights.ts — consome GET /api/v1/gm/:slug/insights para dados sensíveis

Observação confirmada:
- PainelMestrePage.tsx usa GET /api/v1/gm/tables para KPIs/métricas
- useCreateTableForm.ts e uiHelpers.ts usam rotas de gm/tables

ORDEM DE EXECUÇÃO (obrigatória, sem pular passos)
=================================================

PASSO 0 — VALIDAÇÃO PREVENTIVA
  0.1. Rodar: grep -rn "metrics_views\|metrics_clicks\|metrics_contacts\|metrics_favorites" frontend/src/
  0.2. Listar cada ocorrência.
  0.3. Abrir backend/src/routes/gmPanel.ts. Verificar se GET /tables retorna metrics_*.
  0.4. Se NÃO retornar: estender o select do gmPanel.ts para incluir metrics_*
       (COALESCE(tm.*, 0) com LEFT JOIN em table_metrics). Endpoint é autenticado,
       sem risco de vazamento.
  0.5. Validar que PainelMestrePage.tsx lê metrics_* de /api/v1/gm/tables
       (já aplicado no estado atual).
  0.6. Validar ausência de dependência de /api/v1/gm/:slug em
       useCreateTableForm.ts e uiHelpers.ts (já confirmado).
  0.7. Só avançar depois de confirmar que o painel compila sem depender de
       metrics_* no /gm/:slug.

PASSO 1 — MIGRAÇÃO SQL
  1.1. Usar a migration existente `database/migration_107_gm_public_profile_v2.sql`
       com TODAS as cláusulas do Patch 1 da auditoria.
  1.2. Rodar em staging primeiro.
  1.3. Confirmar via \d+ no psql que todas as colunas existem.

PASSO 2 — BACKEND gm.ts
  2.1. Substituir backend/src/routes/gm.ts pelo conteúdo do Patch 2.
  2.2. Não remover nenhum comportamento existente que ainda é necessário
       (se houver rotas adicionais no arquivo, preservar).
  2.3. Testar manualmente:
       - GET /api/v1/gm/<slug> anônimo retorna viewer_context com is_owner/is_admin false.
       - GET /api/v1/gm/<slug> com cookie do dono retorna is_owner: true.
       - GET /api/v1/gm/<slug>/insights sem token → 401.
       - GET /api/v1/gm/<slug>/insights com token de outro user → 403.
       - GET /api/v1/gm/<slug>/insights com dono ou admin → 200 com metrics e recommendations.

PASSO 3 — BACKEND gmPanel.ts (aceitar novos campos de perfil)
  3.1. Estender POST /api/v1/gm/profile para aceitar: tagline, promo_badge_text,
       selling_points (array), closed_group_enabled, closed_group_systems (array
       de UUIDs), closed_group_description, closed_group_min_price_cents.
  3.2. Validar tipos com Zod (ou o validador em uso).
  3.3. Estender GET /api/v1/gm/me para retornar esses campos.
  3.4. JSONB deve ser serializado com JSON.stringify no insert/update.

PASSO 4 — FRONTEND hooks
  4.1. Criar frontend/src/hooks/useMestre.ts (Patch 4 da auditoria).
  4.2. Criar frontend/src/hooks/useMestreInsights.ts (Patch 5 da auditoria).
  4.3. Tipos MestrePublicData, ViewerContext, SellingPoint, ClosedGroupInfo,
       InsightsPayload devem ser exportados para reuso.

PASSO 5 — FRONTEND MestrePage orquestração
  5.1. Substituir frontend/src/pages/MestrePage.tsx pelo conteúdo do Patch 6.
  5.2. Criar componentes stub temporários em frontend/src/components/mestre/
       apenas para não quebrar compilação.

PASSO 6 — FRONTEND componentes (ordem)
  6.1. MestreSkeleton.tsx, MestreNotFound.tsx, MestreError.tsx (simples).
  6.2. MestreHero.tsx (Patch 9).
  6.3. MestreSellingPoints.tsx (Patch 10).
  6.4. MestreBio.tsx — foto + bio + chips de specialties + blockquote de tagline.
  6.5. MestreFeaturedTable.tsx — layout 2 colunas com bullets de features.
  6.6. MestreTablesGrid.tsx — wrapper de TableCardComponent.
  6.7. MestreClosedGroupSection.tsx (Patch 11).
  6.8. OwnerOnlyBanner.tsx + MestreInsightsSection.tsx (Patch 12).
  6.9. MestreRecommendationsSection.tsx (Patch 13).
  6.10. MestreLinksSection.tsx — wrapper de LinksDisplay.

PASSO 7 — FRONTEND ajustes em componentes existentes
  7.1. TableCard.tsx: aplicar Patch 7 (5 mudanças pontuais).
  7.2. LinksDisplay.tsx: aplicar Patch 8 (4 mudanças pontuais).

PASSO 8 — PAINEL DO MESTRE (UI de gestão)
  8.1. Em PainelMestrePage.tsx, estender formulário de perfil com todos os novos
       campos: tagline, promo_badge_text, selling_points (lista editável),
       closed_group_enabled (toggle), closed_group_systems (multi-select via
       GET /systems), closed_group_description (textarea),
       closed_group_min_price_cents (input em reais, converter para cents no submit).
  8.2. Popular estado inicial via GET /api/v1/gm/me.
  8.3. Submit via POST /api/v1/gm/profile estendido.

PASSO 9 — DOCUMENTAÇÃO
  9.1. Atualizar MAPA_DE_API.md com a nova rota /:slug/insights e nota no /:slug
       (Patch 15 da auditoria).

PASSO 10 — VALIDAÇÃO
  10.1. Rodar checklist da seção 10 da auditoria inteiro.
  10.2. Só abrir PR quando todos os checks passarem.

STATUS EXECUTADO — ETAPA 1 (16/04/2026)
========================================
- ✅ Migration criada: `database/migration_107_gm_public_profile_v2.sql`.
- ✅ Tipagem Kysely atualizada em `backend/src/db/types.ts`.
- ✅ Rota pública `GET /api/v1/gm/:slug` refatorada com `optionalAuth`,
     `viewer_context`, `closed_group`, `selling_points`, `features` e sem `metrics_*`.
- ✅ Nova rota protegida `GET /api/v1/gm/:slug/insights` implementada com
     `authMiddleware` e bloqueio por owner/admin.
- ✅ `MAPA_DE_API.md` atualizado com o contrato novo.
- ✅ `MestrePage.tsx` ajustada para consumir `/insights` apenas quando
     `viewer_context` permitir.
- ✅ Painel permanece consumindo métricas da origem autenticada
     `GET /api/v1/gm/tables`.

PENDÊNCIAS IMEDIATAS PÓS-ETAPA 1
================================
- [ ] Aplicar `migration_107_gm_public_profile_v2.sql` no ambiente alvo antes de validar em runtime os novos campos da rota pública.
- [ ] Executar validação manual de cenários (visitante, owner e admin) com sessão autenticada real.
- [ ] Iniciar Etapa 2 (componentização e redesign visual) somente após confirmação da validação funcional da Etapa 1.

REGRAS NÃO-NEGOCIÁVEIS
======================
- Respostas e comentários em português do Brasil.
- Não inventar nomes de colunas, rotas ou tipos. Se algo faltar, PARAR e PERGUNTAR.
- Preservar lógica correta existente: prefetch/click tracking do TableCard,
  SlotsIndicator, slots.ts, SiteHeader, AuthContext, SiteFooter.
- Não alterar tokens de cor (index.css).
- Não adicionar libs novas sem pedir.
- Usar JSON.stringify para campos JSONB em Kysely inserts/updates.
- Fetch no frontend deve incluir credentials: 'include' para que optionalAuth
  consiga ler o cookie am_session.
- Entregar código pronto para colar, sem pseudo-código.
- Respeitar estrutura de pastas proposta na auditoria (components/mestre/).
- Atualizar MAPA_DE_API.md na mesma PR.
- Passo 0 é obrigatório e vem antes de qualquer patch. Pular é bug de produção.

SE ALGO NÃO BATER COM O CÓDIGO REAL
====================================
- Se algum arquivo mencionado não existir na estrutura do projeto, PERGUNTE antes
  de criar em local alternativo.
- Se uma coluna do schema não bater com o schema confirmado, PERGUNTE.
- Se um endpoint mencionado no MAPA_DE_API.md tiver assinatura diferente do que
  a auditoria assume, PERGUNTE.
- Se encontrar comportamento não previsto (ex.: middleware customizado entre
  auth e handler), PERGUNTE.

PRIMEIRA AÇÃO: Executar Passo 0 inteiro e reportar os achados antes de qualquer
implementação. Só prosseguir após receber luz verde do usuário.
```

---

## Anexo A — Evolução V1 → V2 → V3

| Mudança | V1 | V2 | V3 |
|---|---|---|---|
| Rota `/mestre/:slug` registrada? | Ausente no App.tsx | Ausente (router filho?) | **Registrada em `App.tsx` (`/mestre/:slug`)** |
| Hook de fetch | Desconhecido | Desconhecido | **Confirmado: `useMestre.ts` + `useMestreInsights.ts`** |
| Problema principal | Hero sem prova social | Insights vazados | **Insights protegidos por `canSeeInsights` + rota `/insights`** |
| Grupo fechado | Bloco fixo no hero | Opt-in via painel | **Opt-in + multi-select de sistemas (instrução do usuário)** |
| `user_id` no payload | Expor bruto | `viewer_context` computado | **`viewer_context` + `optionalAuth` já existente** |
| Contrato de links | Tabela desconhecida | Falta 4 colunas | **Contrato público inclui `type`, `description`, `thumbnail_url`, `embed_url`, `sort_order`** |
| Consumidores de `metrics_*` | Não verificado | Alerta genérico | **Confirmado: painel usa `gm/tables`; sem dependência de `/gm/:slug`** |
| Schema de `gm_profiles` | Desconhecido | Desconhecido | **Confirmado via psql, 7 colunas novas** |
| Patches | Teóricos | Código Kysely + alguns TSX | **Código completo: backend + migração + hooks + 12 componentes + painel + doc** |
| Ordem de execução | Vaga | Ordem geral | **10 passos granulares com pré-requisitos explícitos** |
| Checklist de validação | Ausente | Básico | **Completo, organizado por área (segurança, UI, estados, painel, tracking, doc)** |

