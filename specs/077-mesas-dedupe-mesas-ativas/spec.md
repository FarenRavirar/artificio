# 077 — Detecção de mesas duplicadas entre mesas ativas/publicadas

- **Módulo/Pacote:** apps/mesas (backend + frontend)
- **Gate relacionado:** D (mesas)

## Problema

Existe dedupe hoje (`discord_duplicate_candidates`, migration_137, spec 058
Fase 5), mas escopo é só **draft-contra-draft** dentro da importação
Discord: compara `discord_parse_cases` entre si (hash de texto, link de
inscrição, canal, autor), nunca toca a tabela `tables`. Fluxo de decisão
(`DuplicatesTab.tsx`) só aparece dentro do editor de 1 rascunho específico
(`DraftEditorTab`), aba própria — não existe na listagem
`/gestao/mesas/rascunhos` (`DiscordDraftReviewTable`).

Resultado: nenhuma ferramenta hoje detecta duplicata entre:
1. Mesa ativa × mesa ativa (ex.: duas publicações da mesma campanha por
   erro de operador, ou reimportação manual).
2. Draft novo × mesa **já publicada** (o candidato atual só olha outros
   `discord_parse_cases`, nunca a tabela `tables` final).

Sem isso, mesa duplicada só é achada por acaso (usuário reportando) — sem
apontamento automático, sem link direto entre as duas ocorrências, sem
gestão centralizada.

Achado consolidado a partir de investigação read-only nesta sessão
(2026-07-14) — ver `sessoes/` da data para o achado original.

## Requisitos

1. Detectar candidatos de duplicata entre mesas com `status = 'active'`
   (reaproveitando sinais já usados em `discord_duplicate_candidates`:
   hash de texto normalizado, mesmo link de inscrição/form, mesmo
   sistema+título aproximado — adaptado pra campos de `tables`, que não
   tem `normalized_text`/`signals_json` prontos).
2. Detectar candidato de duplicata entre draft novo (rascunho em revisão)
   e mesa **já ativa** — não só entre drafts.
3. Expor indicador visual (badge/contador) de duplicata na listagem
   `/gestao/mesas/rascunhos` (`DiscordDraftReviewTable`), sem exigir abrir
   cada draft pra descobrir.
4. Tela de gestão de duplicatas com link direto clicável pra cada lado do
   par (mesa ativa → `/mesas/:slug` público + rota de edição admin; draft
   → editor do rascunho).
5. Decisão manual do admin (mesmo padrão dos 3 estados existentes:
   confirma duplicata / rejeita / marca pra atualizar existente),
   reaproveitando `discord_parse_feedback` como trilha de aprendizado
   quando aplicável.

## Critérios de aceite

- Rodar detecção contra o conjunto de mesas ativas em produção (ou dump
  local) acha pelo menos os pares duplicados conhecidos manualmente
  reportados pelo mantenedor (caso existam no momento do smoke).
- Listagem `/gestao/mesas/rascunhos` mostra badge de "possível duplicata"
  quando o draft bate com mesa ativa existente.
- Tela de gestão de duplicatas (nova ou `DuplicatesTab` estendida) lista
  pares mesa×mesa e draft×mesa, cada um com link clicável pras duas
  pontas.
- `pnpm run lint` + `pnpm run build` verdes (backend + frontend mesas).
- Smoke manual: criar/simular 2 mesas ativas com título+sistema
  parecidos, confirmar que aparecem como candidato na tela de gestão.

## Fora de escopo

- Merge automático de mesas duplicadas (ação sempre manual, nunca delete
  automático — regra pétrea de dado do usuário).
- Alterar o dedupe draft-contra-draft existente (`discord_duplicate_candidates`
  fase 5) — esta spec **estende** a cobertura, não substitui.
- Detecção de duplicata em outros módulos (glossário, downloads) — só
  `apps/mesas`.

## Riscos e impacto em outros módulos

- Query de comparação mesa×mesa pode ficar cara se rodar full-scan a cada
  publish — decidir em `plan.md` se roda sob demanda (botão manual) ou
  trigger assíncrono, evitando o mesmo custo do scrape de OG síncrono já
  identificado como risco em specs anteriores.
- Reaproveitar tabela `discord_duplicate_candidates` pode exigir migration
  (FK hoje só aponta pra `discord_parse_cases`, não pra `tables`) — avaliar
  se cria tabela nova (`table_duplicate_candidates`) em vez de forçar
  reuso, pra não acoplar dois domínios diferentes na mesma FK.
- Rota nova de listagem ampla de duplicatas — restringir a `role === 'admin'`,
  mesmo padrão de `requireAdmin` já usado nas rotas de duplicatas atuais.
