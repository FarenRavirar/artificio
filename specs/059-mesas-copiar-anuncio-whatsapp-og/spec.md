# 059 — Mesas: copiar anuncio WhatsApp + Open Graph da mesa

- **App/escopo:** `apps/mesas` (frontend + backend OG + possivel contrato API)
- **Gate:** D mesas; validar em beta antes de prod
- **Modo:** SDD Completo, por decisao do mantenedor (2026-07-08). Motivo: fluxo publico, gestao/admin, SEO/OG, clipboard UX e risco de contrato API.
- **Origem:** pedido direto do mantenedor (2026-07-08)
- **Sessao:** `sessoes/26-07-08_1_mesas_copiar-anuncio-whatsapp-og.md`
- **Status:** **Fases 0-7 concluidas localmente.** Pendente smoke beta (T6.3, T7.5) e deploy. Sem commit/push/PR/merge sem autorizacao nominal.

## Problema

Mestres e admins precisam divulgar uma mesa publicada em grupos de WhatsApp. Hoje o app mostra a mesa, mas nao gera um texto pronto no padrao de anuncio. O usuario precisa copiar campos manualmente, reformatar, remover placeholders e lembrar links fixos.

Tambem ha gap de compartilhamento: `apps/mesas/backend/src/routes/og.ts` tem OG dinamico para `/mestre/:slug`, mas `https://mesas.artificiorpg.com/mesas/:slug` cai no fallback generico. Ao colar a URL da mesa no WhatsApp, preview nao usa o banner da mesa como `og:image`.

## Objetivo

1. Permitir copiar para area de transferencia um anuncio pronto da mesa em formato WhatsApp, com um clique.
2. Expor botao em tres contextos:
   - pagina publica da mesa (`/mesas/:slug`);
   - painel do mestre, no card/lista de mesa publicada;
   - painel de gestao, em "Mesas publicadas".
3. Gerar texto usando dados reais da mesa, sem placeholders entre chaves.
4. Corrigir Open Graph da URL publica da mesa para usar o banner/imagem da propria mesa.

## Modelo de saida WhatsApp

> Nao e Markdown. E texto para WhatsApp. Manter emojis/separadores. Remover colchetes/chaves no texto final.

```text
📢Sistema e edição - Título da Mesa - Campanha ou Oneshot Gratuita ou Comissionada📢

▬ Título: Nome da mesa
▬ Sistema: Sistema e suplementos utilizados
▬ Data e Hora: Dias e horários das sessões
▬ Nº de Vagas: Quantidade de vagas disponíveis
▬ Faixa Etária: Classificação indicativa
▬ Local do Jogo: Servidor ou plataforma utilizada
▬ Plataformas: Ferramentas utilizadas para jogo e comunicação
▬ Mestre: Nome ou apelido do mestre
▬ Estilo: Gêneros e temas da aventura
▬ Duração: One-shot, campanha curta ou campanha longa
▬ Mesa: Comissionada ou gratuita

📖 Sinopse:
Descrição breve do enredo e ambientação da aventura

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

🎭 Sobre o Mestre:
Breve descrição do mestre, experiências e estilo de narrativa

⚔️ Sobre a Mesa:
Detalhes adicionais, como ambientação, foco narrativo, estilo de jogo, house rules e expectativas para os jogadores

📌 Inscrições:
Informações sobre como participar, link da mesa

Anúncios de Mesas de RPG:
Para mais anúncios de vagas em mesas, acesse: https://chat.whatsapp.com/CZZJy5XOYhxAC8pXXOJM7m

Temos um Post para aprofundar os mestres a realizar uma excelente de sua mesa e ajudar a filtrar e recrutar jogadores:
https://artificiorpg.com/blog/como-anunciar-mesa-de-rpg/
```

## Mapeamento inicial de campos

| Linha | Fonte proposta |
|---|---|
| Sistema e edicao (cabecalho) | `system_name` somente. `setting_name`, `scenario_name` e `ddal_*` entram na descricao/sobre a mesa, nao na linha de sistema. |
| Titulo | `title` |
| Sistema | `system_name` somente |
| Data e Hora | `schedules[]` quando existir; fallback `schedule_day_hint`, `schedule_time_hint`, `starts_at`; se indefinido, linha fica vazia (decisao: campos vazios = linha vazia, sem texto inventado) |
| Nº de Vagas | `slots_open` ou `slots_total - slots_filled` |
| Faixa Etaria | `age_rating` (campo dedicado, ja exposto em `GET /api/v1/tables/:slug` e tipado em `TableDetail` na Fase 1). Nao usar `audience`. |
| Local do Jogo | `modality` + cidade/UF para presencial/hibrida; "Online" para online |
| Plataformas | `vtt_platform.name`/`game_platform_custom` + `communication_platform` |
| Mestre | `master_display_name`, `gm_display_name`, `actual_gm_name` conforme prioridade |
| Estilo | `setting_styles`, `style_text`, `setting_name` |
| Duracao | `campaign_length`, `type`, `ddal_duration` |
| Mesa | `price_type`: `gratuita` = "Gratuita"; `paga` = "Comissionada" somente na saida copiar/colar (decisao Fase 0). |
| Sinopse | `synopsis_narrative`, fallback `synopsis`, fallback `description` |
| Sobre o Mestre | `table_gm_bio`, fallback `gm_bio_long` |
| Sobre a Mesa | `benefits_text`, `style_text`, `technical_requirements`, `content_warnings`, `safety_tools` |
| Inscricoes | somente URL publica `/mesas/:slug` |

## Escopo de publicacao

O botao de copiar anuncio so precisa funcionar para mesas publicadas/ativas.

- Pagina publica: usa a mesa carregada por `/api/v1/tables/:slug`.
- Painel do mestre: o card busca o detalhe publico por `slug` antes de copiar.
- Gestao: a aba "Mesas publicadas" continua usando `/api/v1/tables`, que retorna apenas mesas `active` e nao arquivadas; portanto basta preservar `slug` no `AdminTableRow` e buscar o detalhe publico por `slug` no clique.
- Nao criar rota admin de detalhe para copiar anuncio nesta spec. Mesa cancelada, encerrada, rascunho, pendente, arquivada ou deletada esta fora do escopo do copiar anuncio.

## Diretriz de qualidade do texto

O humano nao deve precisar editar depois de copiar. O formatter deve produzir anuncio final completo, legivel e publicavel, mesmo com campos faltantes.

- Campos vazios ficam como linha vazia apos o label, nao somem e nao recebem "Nao informado" por padrao.
- A ausencia de campo vira debito de dados para o cadastro/parser, nao texto inventado.
- O texto final nao pode conter placeholders, chaves, colchetes, `undefined`, `null`, `NaN` ou enum cru quando houver label humano.
- `setting_name`, `scenario_name`, `ddal_*`, `level_range`, avisos, requisitos e house rules entram em Sinopse/Sobre a Mesa quando existirem, nao poluem a linha "Sistema".

## Pontos aprofundados

### Faixa Etaria

Problema: `audience` no app pode significar publico-alvo/experiencia ("iniciante", "todos", "adulto", etc.) e nao classificacao indicativa. Classificacao indicativa do template pede algo como "Livre", "+10", "+12", "+14", "+16", "+18". Se usarmos `audience` sem confirmar, o anuncio pode sair semanticamente errado: "Faixa Etaria: iniciante" ou "Faixa Etaria: todos" parece classificacao, mas nao e.

Evidencia de codigo:

- `apps/mesas/backend/src/db/types.ts` tem `tables.age_rating: 'livre' | '+10' | '+12' | '+14' | '+16' | '+18' | null`.
- `apps/mesas/backend/src/hydration/config.ts` lista `age_rating` em `tables`.
- `apps/mesas/backend/src/discord/types.ts` tem `TableDraftAgeRating`.
- `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` extrai `age_rating`.
- `apps/mesas/backend/src/discord/syncHelpers.ts` grava `age_rating: normalizeAgeRating(t.age_rating)` ao sincronizar draft/importacao para `tables`.
- `apps/mesas/backend/src/routes/tables.ts` seleciona `audience`, mas nao seleciona `t.age_rating` nem na lista publica nem no detalhe.
- `apps/mesas/frontend/src/types/tables.ts` nao tem `age_rating` em `TableCard`/`TableDetail`.

Conclusao: nao e caso de inventar campo; `age_rating` ja existe no modelo material e no pipeline. O gap provavel e contrato publico/frontend: expor `t.age_rating` em `GET /api/v1/tables/:slug` e tipar `TableDetail`. Para o anuncio, usar `age_rating` real; se nulo, linha "Faixa Etária:" fica vazia.

Decisao tecnica para a implementacao: expor `age_rating` real no detalhe publico e rodar API governance. Nao usar `audience` como substituto automatico.

### Comissionada

Problema: `price_type=paga` diz que ha pagamento, mas "Comissionada" tem nuance comercial especifica. Uma mesa paga pode ser sessao avulsa, campanha paga, valor mensal, colaboracao, vaquinha, taxa de plataforma ou outra modalidade descrita em `billing_text`. Chamar tudo de "Comissionada" pode ser forte demais ou errado.

O template publico, porem, pede binario "Comissionada ou gratuita". Para manter anuncio completo e sem edicao humana, precisamos de regra deterministica. Proposta para decidir na implementacao:

- `price_type=gratuita` = "Gratuita".
- `price_type=paga` = "Comissionada" somente na saida copiada/colada do anuncio, porque o template contrapoe diretamente com gratuita. No codigo, banco, API e UI da mesa, o valor interno continua `paga`.
- Detalhe financeiro real nao fica nesse campo; entra em "Sobre a Mesa" com `billing_text`, `price_value`, `price_frequency` e `session_zero_free` quando existirem.

Risco controlado: a traducao para "Comissionada" e apenas apresentacional no formatter WhatsApp. Nenhum enum, contrato interno ou persistencia deve trocar `paga` por `comissionada`.

## Decisoes propostas

- Formatter fica no frontend local de `apps/mesas`, perto da feature `table`, para evitar pacote compartilhado prematuro.
- Texto deve manter labels do template; campos sem dado ficam vazios, nunca com `[placeholder]`, `undefined`, `null`, `N/A` cru.
- Clipboard usa `navigator.clipboard.writeText` com fallback por `textarea` oculto e `document.execCommand('copy')`.
- Feedback visual via toast: sucesso, erro de permissao, erro de carga de detalhe.
- Botao deve usar icone `Copy` de `lucide-react` e texto curto.
- OG deve responder HTTP 200 com HTML renderizado e meta dinamica para `/mesas/:slug`, igual estrategia atual de `/mestre/:slug`.
- `og:image` deve usar imagem publica sanitizada da mesa: `banner_url`/`cover_url` quando existir; fallback `DEFAULT_OG_IMAGE`.

## Perguntas abertas

1. ~~**Faixa Etaria:**~~ **Resolvido na Fase 1.** `age_rating` exposto em `GET /api/v1/tables/:slug` e tipado em `TableDetail`.
2. ~~**Comissionada:**~~ **Decidido na Fase 0.** `price_type=paga` vira "Comissionada" somente no texto copiado; dado interno permanece `paga`.
3. ~~**Gestao:**~~ **Decidido na Fase 1.** Copiar anuncio na gestao e somente para mesas publicadas/ativas; nao precisa rota admin para mesas nao ativas.

Nenhuma pergunta aberta restante. Decisoes registradas em `tasks.md` Fase 0 e Fase 1.

## Fora de escopo

- Criar editor visual do texto antes de copiar.
- Persistir versoes customizadas do anuncio.
- Enviar direto para WhatsApp.
- Mexer em `packages/ui` ou design system compartilhado.
- Deploy, push, PR, merge ou VM write sem aprovacao nominal propria.

## Criterios de aceite

- Em `/mesas/:slug`, usuario consegue copiar texto completo com um clique.
- Em painel do mestre, uma mesa publicada consegue copiar o mesmo texto, buscando detalhe se necessario.
- Em `/gestao` "Mesas publicadas", admin consegue copiar o mesmo texto.
- Texto final nao contem colchetes de placeholder, `undefined`, `null`, `NaN`, markdown tecnico nem campos crus de enum quando houver label humano.
- URL da mesa compartilhada em WhatsApp usa `og:image` do banner/imagem da mesa quando existe.
- Testes unitarios cobrem formatter com mesa completa e mesa com campos faltantes.
- Teste backend cobre OG `/mesas/:slug` usando imagem da mesa e fallback quando mesa nao existe.
- Validacao minima: `pnpm --filter @artificio/mesas-frontend run build`, testes pontuais frontend/backend afetados, `pnpm --filter @artificio/mesas-backend run build`, `pnpm verify:api` se contrato mudar.
