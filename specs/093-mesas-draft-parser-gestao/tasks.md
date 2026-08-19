# Tasks 093 — Mesas: draft, parser e gestão

**Estado:** aberta, nenhuma fase iniciada · **Criada:** 2026-08-19 · **Fases:** 8

Legenda: 🔁 = gate de fase (obrigatório, penúltima task antes do PR).

---

## Pendências que precisam de resposta do mantenedor

**1 — Fase 2 (T2.7): aprovação de ação.** Registro em `schema_migrations` é escrita em banco
de VM (§Autorização). O agente chega com o comando montado e a idempotência já medida — a
pergunta é a aprovação da **ação**, não do achado.

**2 — Fase 5 (D5): decisão de produto, aberta pela auditoria.** Reclassificada de técnica
para produto (auditoria, transversal 8):
(a) para onde volta um descartado — R13 diz `draft`/`needs_review`, a task fixou
`needs_review`; **inferência a confirmar**;
(b) R12 promete "editar" descartado, mas `registerDraftCorrection` devolve **422**
(`utils.ts:184`) — afrouxar o guard é chamada do mantenedor, ou R12 vira "ver, restaurar,
limpar";
(c) `POST /:id/reparse` sobrescreve `rejected` sem gate — segundo caminho de des-descartar,
manter ou barrar é decisão dele.

**3 — Fase 6 (T6.14): validação visual** antes do PR, já prevista.

D1 e D4 respondidas em 2026-08-19. D2 e D3 são técnicas, decididas por medição —
ver `spec.md` §Decisões.

---

## Fase 1 — Parser: vagas lidas de data (R7, R8, R9)

- [ ] T1.0 — **Criar a fixture sintética** em
      `apps/mesas/backend/src/discord/__tests__/fixtures/`, copiando o texto do bloco em
      `spec.md` §Gap 4 — **não** inventar variação. O texto original não será recuperado
      (decisão do mantenedor, 2026-08-19); a fixture é reconstrução mínima, já validada:
      a linha de prosa entrega o par `[25, 08]` e a linha da vaga não casa em estratégia
      alguma. Comentário no arquivo dizendo que é sintética e por quê — para ninguém depois
      tratá-la como captura de produção.
- [ ] T1.1 — Escrever teste **que falha hoje** com essa fixture: espera
      **`{total: 4, open: 1}`** — não `25`, e **não `{null, null}`**. Guard sozinho devolve
      nulo e não atende R9.
- [ ] T1.2 — **Camada A** — guard de data em `slotsLabeledNumericPair`
      (`:1003-1018`). Sinais **1, 2 e 4** do `plan.md` §Fase 1 (contexto, zero à esquerda,
      `DD/MM/AAAA`). O sinal 3 ("faixa plausível") foi **descartado** — rejeitava
      `"Participantes: 30/24 restando 6 vagas"` (`real.txt:179`) e `"4/1 Vagas Abertas"`
      (teste `:684`), ambos vaga legítima.
- [ ] T1.2b — **Rodar cada sinal contra `discord-announcements-real.txt` inteiro antes de
      aceitá-lo**, contando falsos positivos. Sinal que rejeite vaga legítima do corpus está
      fora. Foi assim que o sinal 3 caiu — a mesma medição não foi feita para os outros três.
- [ ] T1.3 — **Camada B** — restringir o filtro da linha 1008: o token
      `vagas?|lugares?|jogadores?` precisa estar próximo do par. Medir a janela contra o
      corpus — `real.txt:671-672` tem data adjacente a linha de vaga.
- [ ] T1.4 — **Camada C** — trocar o `return` da linha 1015 por coleta + precedência
      (semântico > genérico). **Rebaixada**: a auditoria (Fase 1 achado 1) provou que o
      mecanismo alegado era falso — a regex da linha 1009 exige `/` literal, e
      `"1 disponível de 4"` nunca seria candidata desta função. Continua valendo como
      robustez para texto com dois pares `/`, não como causa do bug.
- [ ] T1.4b — **Camada D — a que de fato entrega R9** (auditoria, Fase 1 achado 2).
      Nenhuma das 9 estratégias reconhece `"N <qualificador> de M"`: `RE_SLOT_X_DE_Y`
      (`:913`) exige o número colado ao `de`. Estender `slotsXdeY` (`:935-944`) para aceitar
      o qualificador no meio, **reusando** o vocabulário de `classifySlotPairLine`
      (`:986-987`) — `disponíveis|abertas|livres|restantes|sobrando` e
      `ocupadas|preenchidas|inscritos` — sem escrever lista paralela.
- [ ] T1.5 — **Escrever** os testes de `8/25` e `"1 vaga / grupo de 5 pessoas"`, que a
      spec dava por existentes e **não existem** (auditoria, Fase 1 achado 3:
      `rtk rg "8/25|grupo de 5|slotsGroupSize"` nos testes → zero; `slotsGroupSize` é função
      viva sem teste). `1/4` e `"Vagas Disponíveis: 1/4"` já têm teste — só não regredir.
- [ ] T1.5b — Não regredir: `"Participantes: 30/24 restando 6 vagas"` e `"4/1 Vagas
      Abertas"` mantêm o resultado atual.
- [ ] T1.6 — Testes novos: `"dia 25/08"` em linha com "jogadores" → nenhum par;
      `"25/08/2026"` → nenhum par; dois pares `/` na mesma mensagem, genérico antes e
      semântico depois → vence a semântica (Camada C); `"2 abertas de 6"` e
      `"3 ocupadas de 5"` → Camada D nos dois sentidos.
- [ ] T1.7 — Comentário no código explicando o guard de data e a precedência, citando o
      anúncio real (`message_id 1539593774265671751`) — padrão `Achado real (…)` já usado
      nesta base. Preservar os comentários existentes das linhas 895-926 e 1053-1058.
- [ ] T1.8 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
      Reler os requisitos **R7, R8 e R9** da `spec.md` e a seção §"Fase 1" do `plan.md`, e
      confirmar item por item que a implementação bate. Verificar em especial: (a) as
      **quatro** camadas entraram — e que a **Camada D** existe, sem a qual R9 é
      inalcançável (o guard sozinho devolve `{null,null}`); (b) a ordem da cascata de
      `extractSlots` (1067-1080) **não** foi alterada; (c) o teste do Gap 4 espera
      `{total:4, open:1}`, não apenas "não 25"; (d) o sinal de faixa **não** voltou ao
      guard; (e) `8/25` e `grupo de 5 pessoas` ganharam teste de fato. Divergência achada aqui = corrigir antes do PR,
      ou perguntar ao mantenedor se a spec é que está errada — nunca seguir o `tasks.md`
      contra a `spec.md` calado.
- [ ] T1.9 — Verde local (`cd apps/mesas/backend && rtk pnpm vitest run parseDiscordAnnouncement.test.ts`,
      `rtk tsc -p tsconfig.json --noEmit`) + `rtk pnpm verify:api` + PR contra `dev`.

---

## Fase 2 — Migrations: trazer os dois órfãos para o contrato (R14, R15)

Precede a Fase 3 de propósito: a Fase 3 cria tabela nova, e criar migration num diretório
com passivo fora do contrato seria construir sobre o defeito.

- [ ] T2.1 — Ler `006_create_vtt_platforms.sql` e `007_click_tracking.sql` **inteiros** e
      inventariar cada objeto que criam/alteram (tabela, coluna, índice, comentário, seed).
      Nada pode se perder na transposição.
- [ ] T2.2 — Confirmar que cada objeto **já existe em produção**. **Correções da auditoria
      (Fase 2 achados 1 e 2, transversal 4):**
      (a) `tables.ts:830` é evidência **fraca** — o insert está sob
      `if (variant && (variant === 'with_metrics' || ...))` (`:828`), em `try/catch`. A
      evidência forte não citada é `gmPanel.ts:1636`, `selectFrom('table_click_events')`
      **incondicional**.
      (b) `shared.ts:77` tem defasagem de 1 linha: o `selectFrom` está na **78**.
      (c) `clicks_count` **não é órfão** — `migration_16_table_metrics.sql:14` já a cria; o
      `ADD COLUMN` do `007_` é redundante e não é passivo a sanar.
      (d) Referência de código **não é medição de produção** (§Evidência). Se o mantenedor
      autorizar `psql` read-only, confirmar com `\d`; senão, registrar explicitamente que a
      existência é inferida, não medida.
- [ ] T2.3 — Escrever `apps/mesas/database/migration_158_reconcile_orphan_backend_migrations.sql`
      (158 = próxima livre, medido: última é `migration_157_profile_image_crop.sql`), com
      header de 5 campos copiado do vizinho verde mais recente. Arquivo **único**, conforme
      `plan.md` §Fase 2 — é uma operação só, sanar o diretório.
- [ ] T2.4 — **Idempotência é o requisito central desta fase**, não um detalhe: a migration
      roda contra banco que já tem tudo. Toda instrução em forma `IF NOT EXISTS`/`ON
      CONFLICT DO NOTHING`. **A suspeita anterior apontava o statement errado** (auditoria,
      Fase 2 achado 5): o `ALTER TABLE table_metrics` é `ADD COLUMN IF NOT EXISTS`, já
      idempotente. O risco real é `006_:51-54` — `UPDATE tables SET game_platform_legacy =
      game_platform WHERE ...`, backfill sobre a coluna **depreciada** `game_platform`
      (`types.ts:258`): se ela for dropada, a transcrição quebra.
- [ ] T2.5 — **Provar a idempotência rodando o SQL duas vezes** contra banco local, e
      registrar a saída. `AGENTS.md` §Migrations item 2 exige; e é isto que decide T2.7.
- [ ] T2.6 — Remover `apps/mesas/backend/migrations/` (os dois `.sql` e o diretório). Zero
      referências no repo — medido por `rtk rg`. Preservar dentro da 158 os
      `COMMENT ON TABLE` do `006_` (linhas 62-66), única documentação desses objetos.
- [ ] T2.7 — ⚠️ **APROVAÇÃO NOMINAL DO MANTENEDOR** — registro em `schema_migrations`.
      Se T2.5 provar idempotência total, a esteira normal basta e **não há** ação perigosa a
      aprovar. Se não, o caminho é
      `scripts/deploy/reconcile_migrations.sh --mark-applied …` (`AGENTS.md` §Migrations
      item 5) — escrita em banco de VM, §Autorização. Chegar com o comando montado e o
      resultado de T2.5 em mãos; **não executar sem a palavra dele**.
- [ ] T2.8 — Fechar o ponto cego do guard (R15): `_enforce-migration-dir.yml:75` valida só
      `--diff-filter=AM`. Acrescentar varredura de todo `.sql` rastreado, reusando
      `is_allowed_sql_path` (linhas 41-51), e self-tests no padrão das linhas 53-68.
- [ ] T2.9 — Rodar a varredura localmente antes de torná-la bloqueante (`AGENTS.md`
      §Bug achado). **Medido pela auditoria (Fase 2 achado 6):** dos ~180 `.sql` rastreados,
      os **únicos** fora da allowlist são os dois órfãos — não há passivo de outros apps a
      resolver. R15 é mais simples do que a spec enquadrava.
- [ ] T2.9b — **Segunda classe de SQL invisível ao runner** (auditoria, Fase 2 achado 7):
      dentro de `apps/mesas/database/` há 4 arquivos que **não** casam o glob
      `migration_*.sql` — `init.sql`, `backfill_slots_open.sql`, `changelog_ux_catalogo.sql`,
      `apply_migrations_06_07.sql` (este com `RAISE EXCEPTION`). Estão na allowlist, logo
      fora de R14/R15, mas o diagnóstico "dois órfãos" é incompleto. Levantar o que são e
      relatar ao mantenedor — não alterar sem palavra dele.
- [ ] T2.10 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
      Reler os requisitos **R14 e R15** da `spec.md`, o **Gap 8** do §Problema, e a seção
      §"Fase 2" do `plan.md`. Verificar em especial: (a) a migration **não recria** objeto
      que já existe — T2.5 provou rodando duas vezes; (b) nenhum objeto do inventário de
      T2.1 se perdeu na transposição; (c) `apps/mesas/backend/migrations/` não existe mais e
      `find . -name '*.sql'` fora da allowlist devolve vazio; (d) o guard novo foi rodado
      localmente **antes** de virar bloqueante (T2.9); (e) o header da 158 tem os 5 campos e
      `@class` corresponde ao conteúdo real. Divergência = corrigir antes do PR.
- [ ] T2.11 — Verde local + `rtk pnpm verify:api` + PR contra `dev`.

---

## Fase 3 — Parser: rótulo "Tema(s)", aliases e normalização (R3, R4, R10, R16, R19)

- [ ] T3.0 — **R19 migrou da Fase 6 para cá** (auditoria, transversal 3): a normalização de
      `setting_styles` na escrita entra **no mesmo PR** que abre `Tema(s)` como fonte nova.
      Separá-las deixaria o sistema pior entre os dois merges — fonte nova de dado sujo, sem
      normalização.
- [ ] T3.1 — Teste que falha hoje: `"Tema(s): a, b, c"` → `setting_styles` **capitalizado**
      (`['A','B','C']` conforme a regra de R19), **e** descrição sem a linha do rótulo.
      A versão anterior fixava minúsculo — asserção que a Fase 6 quebraria.
- [ ] T3.2 — Acrescentar `tema`, `temas`, `tema(s)` em `extractLabelValue`
      (`parseDiscordAnnouncement.ts:2578`). Confirmar por teste que `normalizeLabelKey`
      (linha 1630) **remove** parênteses: `normalize:197` faz `.replace(/[^a-z0-9\s]/g,' ')`,
      e `normalizeLabelKey("Tema(s)")` → `"tema s"` (medido pela auditoria, Fase 3 achado 1
      — a spec afirmava o oposto). Descobrir por teste **qual** forma o Set precisa conter.
- [ ] T3.3 — Acrescentar as mesmas formas em `FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS`
      (linhas 1949-1960). **Obrigatório junto com T3.2**: só uma das duas troca um sintoma
      pelo outro. Acrescentar também **`classificacao indicativa`**, ausente do Set e por
      isso sobrando na descrição do mesmo anúncio (auditoria, Fase 3 achado 2 — a spec usava
      esse caso como "prova de coerência"; era outra ocorrência do bug). Não tocar no grupo
      de `settingName` (2584) — tema não é cenário.
- [x] T3.4 — ~~Verificar como `findPlatformMatch` delimita a correspondência~~ **Já medido
      na investigação de 2026-08-19** (ver §A3): `allowShortAliases = true`
      (`parseDiscordAnnouncement.ts:626`) desliga o guard de comprimento da linha 269;
      `candidateMatchesText` (linha 243) delimita por `[\s,;:]`, mais restritivo que `\b`;
      `findPlatformMatchFuzzy` (linha 569) descarta tokens < 4 chars. **Decisão: siglas de
      2 letras (`TS`, `FG`, `R20`) ficam FORA** — zero ocorrência em 1030 linhas de
      anúncios reais e risco documentado no próprio código. **Ressalva da auditoria (Fase 3
      achado 6):** o guard desligado protege `length < 4`, então `FGC` (3 chars) corre o
      mesmo risco que `TS`. A fronteira "3+" não decorre do argumento — decidir por medição
      de falso positivo no corpus, não por número redondo.
- [ ] T3.5 — Migration de aliases (**D2**): `vtt_platform_aliases` e
      `communication_platform_aliases`, espelhando a forma de `system_aliases`
      (`migration_02:61-71`) e `scenario_aliases` (`migration_107:18-30`) — conferir as duas
      antes de escrever, incluindo índice em `alias_slug` e decisão sobre `UNIQUE`.
      Numeração: a seguinte à 158 da Fase 2. Header de 5 campos.
- [ ] T3.6 — Seed dos aliases na migration: os 6 conjuntos hoje em `VTT_ALIASES`, mais
      `Roll 20`, `Tale Spire`, `QuestPortal`, `Table Plop`, `FGC`,
      `Fantasy Grounds Classic`. **Só 3+ caracteres** (T3.4). Idempotente
      (`ON CONFLICT DO NOTHING`).
- [ ] T3.7 — Seed de comunicação (R16): antes de fixar a lista, rodar a mesma contagem de
      §A3 sobre `discord-announcements-real.txt` para as 5 plataformas de
      `migration_105:22-29`, e semear só o que aparece ou é grafia óbvia. Não assumir que
      existem apenas as 5 — o backfill (linhas 36-51) pode ter criado outras.
- [ ] T3.8 — `loadVttPlatformsForParser` (`shared.ts:76-87`) e
      `loadCommunicationPlatformsForParser` (linhas 90-97) passam a ler alias do banco via
      `LEFT JOIN`, no lugar do `Record` e do `aliases: []` fixo. Manter o carregamento
      único por batch (`routes/discord/utils.ts:48-50` registra que é assim para evitar N+1).
- [ ] T3.9 — Remover `VTT_ALIASES` (`shared.ts:60-73`) e o comentário das linhas 57-59, que
      descreve um risco que a tabela elimina — comentário que descreve código inexistente
      engana o próximo agente. Substituir por comentário curto citando spec 093 / D2.
- [ ] T3.10 — Expor aliases no CRUD admin de VTT (`vttPlatforms.ts:202/265/359`), para que
      plataforma criada pelo painel possa receber alias. Sem isto, D2 resolve metade do
      problema — é o fundamento 2 da decisão.
- [ ] T3.11 — Testes: cada uma das 10 VTTs reconhecida; `"Fantasy Grounds Classic"` →
      `fantasy-grounds-unity`; as 5 plataformas de comunicação reconhecidas; **alias
      cadastrado pelo CRUD passa a ser reconhecido pelo parser** (o que o mapa hardcoded
      nunca permitiu testar).
- [ ] T3.11b — **R19 — normalizar `setting_styles` na escrita, nos 4 pontos** (era T6.8-T6.10):
      `splitFreeTextList` (`:1422-1428`), editor de draft (`draftFormUtils.ts:451-452`),
      formulário (`mapper.ts:150`) e painel do mestre (`gmPanel.ts:968`). Função única,
      testável e compartilhada (`AGENTS.md` §Compartilhado por padrão). Forma canônica: a da
      `migration_152` (capitalizar cada palavra, preservar preposição interna, remover
      pontuação terminal).
- [ ] T3.12 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
      Reler os requisitos **R3, R4, R10 e R16** da `spec.md`, a decisão **D2**, e a seção
      §"Fase 3" do `plan.md`. Verificar em especial: (a) T3.2 **e** T3.3 foram ambas feitas
      — um sintoma sem o outro é fase incompleta; (b) **nenhuma sigla de 2 letras** entrou
      no seed (T3.4/§A3); (c) `VTT_ALIASES` foi removido de fato, não deixado morto ao lado
      da tabela; (d) o CRUD expõe alias (T3.10) — sem isso o defeito se reproduz pelo uso
      normal do produto; (e) a migration de alias é idempotente e tem header de 5 campos.
      Divergência = corrigir antes do PR.
- [ ] T3.13 — Verde local + `rtk pnpm verify:api` + PR contra `dev`.

---

## Fase 4 — Copiar no draft: anúncio e JSON (R1, R2, R11)

- [ ] T4.1 — Botão único de copiar servindo as abas Bruto e Normalizado
      (`DiscordDraftPreview.tsx:362-366` — mesmo bloco, mesma variável `selectedPayload`
      da linha 91). **Não** criar componente por aba.
- [ ] T4.2 — Colocação fora do container que rola (`div.flex-1.overflow-auto`, linha 317),
      ou `sticky top-0` com fundo opaco. O botão precisa estar alcançável sem rolagem, que
      é o requisito **R11**.
- [ ] T4.3 — Reusar `copyTextToClipboard`
      (`features/table/share/whatsappAnnouncement.ts:379`); não escrever novo helper de
      clipboard. Feedback por `toast` + rótulo transitório, no padrão `isCopying` do
      `CopyAnnouncementButton`.
- [ ] T4.4 — `aria-label` distinguindo a aba copiada ("Copiar JSON bruto" / "Copiar JSON
      normalizado"), já que o mesmo botão serve as duas.
- [ ] T4.5 — Medir se `/api/v1/tables/:slug` (rota pública usada por
      `fetchTableDetailBySlug`) responde para admin autenticado. Registrar o resultado.
      Se não responder, usar a rota admin + `normalizeTableDetailPayload` e comentar a
      divergência de shape no código.
- [ ] T4.6 — Renderizar `CopyAnnouncementButton` no preview sob a condição `publishedSlug`
      (linhas 158-176 já setam esse estado só quando `status === 'active'`), ao lado de
      "Ver Mesa Publicada" (linhas 416-425). Passar `loadTable` conforme decidido em T4.5.
      **Decisão D1: sem estado desabilitado, sem tooltip — o botão simplesmente não existe
      antes de publicar.**
- [ ] T4.7 — Teste: draft `synced` + mesa `active` → botão presente; draft `synced` + mesa
      `draft` → botão **ausente** (não desabilitado); cópia do JSON em ambas as abas.
- [ ] T4.8 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
      Reler os requisitos **R1, R2 e R11** da `spec.md`, a decisão **D1**, e a seção
      §"Fase 4" do `plan.md`. Verificar em especial: (a) o botão está **ausente** (não
      desabilitado) quando a mesa não está publicada — D1 foi explícita; (b) o gerador de
      anúncio **não** foi reimplementado — é o quarto ponto de reuso do mesmo componente,
      não uma quarta cópia; (c) o texto copiado é idêntico ao da aba Mesas do catálogo
      (critério de aceite 1); (d) o botão de JSON é alcançável sem rolar, com JSON longo
      de verdade. Divergência = corrigir antes do PR.
- [ ] T4.9 — Verde local (frontend) + `rtk pnpm verify:api` + PR contra `dev`.

---

## Fase 5 — Aba Descartados (R12, R13)

- [ ] T5.1 — `ModSubTab` (`ModeracaoSection.tsx:22`) ganha `'descartados'`; botão na barra
      (153-163); entrada em `SUB_TAB_CONTENT` (24); **duas** cadeias de sub-aba, não uma:
      o `else setSubTab('rascunhos')` da linha 91 **e** o initializer do `useState`
      (`:78-83`), que repete a mesma cadeia e a spec não citava (auditoria, Fase 5).
- [ ] T5.2 — Confirmar **por navegação real** que `mesas/:sub?` (`App.tsx:73`) aceita
      `/gestao/mesas/descartados` sem alteração de rota. Não fechar por leitura.
- [ ] T5.3 — Prop nova em `DiscordDraftReviewTable` (ex.: `lockedStatus`) fixando
      `statusFilter` em `rejected` (linha 101) e escondendo o seletor (linha 324) —
      **condicionalmente**: `DiscordDraftReviewTable.test.tsx:193-201` e `:271-289` renderizam
      sem a prop e dependem do seletor (16/16 PASS hoje). Esconder incondicionalmente quebra
      os dois (auditoria, Fase 5 achado 4).
- [ ] T5.4 — Purge sempre visível na aba (hoje depende de `hasRejected`, linha 261).
      Manter o `confirm` destrutivo (linhas 264-269) e **manter a ausência de contagem**,
      preservando o comentário das linhas 257-260 que explica por quê (página traz 100,
      purge apaga todos).
- [ ] T5.5 — **Restaurar (R13) — atalho, não capacidade nova.** A auditoria (Fase 5
      achado 1) provou que restaurar **já funciona**: preview → "Editar status"
      (`DiscordDraftPreview.tsx:299-303`, gate só em `synced`) → `needs_review` → Salvar.
      As linhas 426/505 escondem apenas checkbox e botões **de linha**. R13 adiciona atalho.
      O destino (`draft` vs `needs_review`) é **decisão de produto** — ver T5.5b.
- [ ] T5.6 — **Mapear os vetores de mutação que o preview expõe para `rejected`**
      (auditoria, Fase 5 achado 2): "Reparsar" (`:383`), "Salvar campos" (`:395`) e "Editar
      status" (`:299`) **não** têm gate de status. "Salvar campos" bate em 422
      (`utils.ts:184`); mas `POST /:id/reparse` (`drafts.ts:372-386`) bloqueia só `synced`,
      **re-deriva o status e sobrescreve `rejected`** — segundo caminho de des-descartar,
      não previsto. Decidir se fica, e registrar.
- [ ] T5.6b — **R12 promete "editar" e o backend recusa** (auditoria, Fase 5 achado 3):
      `registerDraftCorrection` devolve 422 "Draft rejeitado não pode ser corrigido"
      (`utils.ts:184`). Afrouxar esse guard é decisão de produto — **perguntar ao mantenedor**
      antes, ou reescrever R12 para "ver, restaurar e limpar".
- [ ] T5.7 — Testes: aba lista só `rejected`; seletor de status ausente; restaurar move o
      draft para a fila certa e ele some da aba; purge chama a rota certa e pede confirmação.
- [ ] T5.8 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
      Reler os requisitos **R12 e R13** da `spec.md`, a decisão **D3**, e a seção §"Fase 5"
      do `plan.md`. Verificar em especial: (a) nenhuma rota de backend foi criada — as
      quatro já existiam, conforme tabela do Gap 7; (b) `DiscordDraftReviewTable` foi
      **reusado**, não duplicado (D3 descartou componente próprio); (c) restaurar existe de
      fato — é o único item do Gap 7 que não existia; (d) o comentário das linhas 257-260
      sobre não exibir contagem sobreviveu à edição. Divergência = corrigir antes do PR.
- [ ] T5.9 — Verde local + `rtk pnpm verify:api` + PR contra `dev`.

---

## Fase 6 — Filtros do catálogo: geometria, ruído e estoque sujo (R17, R18, R20)

Origem: relato do mantenedor (2026-08-19) + auditoria externa (Gemini). Três dos cinco
achados externos procedem, um não existe no fonte e um está diagnosticado errado — ver
`spec.md` §Gap 10 e §Auditoria externa em `tasks.md`.

- [ ] T6.1 — **Alvo não existe no fonte — e a origem que a spec deu era inventada.**
      `rtk rg "Cada nível" apps/mesas/frontend/src` → zero (correto). Mas a spec também
      afirmava que o texto "vem de `CatalogSystemFilter`" — **falso**: esse componente
      (definido em `CatalogoPage.tsx:72`) só renderiza `<p>` de loading e de erro
      (auditoria, Fase 6 achado 1). Afirmar "não existe" **e** dar-lhe origem é contradição
      lógica. Se o texto aparecer no DOM em produção, medir a origem real antes de agir.
- [ ] T6.2 — **Altura única por token** (R17), não `py-` avulso. **Alvos corrigidos pela
      auditoria (Fase 6 achado 2):** `.app-select` **não** é a terceira altura — no catálogo
      os `<select>` levam `app-select ... py-2.5` (`:483,:496,:508`), e a utility vence o
      padding base, renderizando 42px, igual ao input. As alturas reais divergentes são
      `SealToggle:22` (~30px), input `:462` (~42px) e o botão **"Limpar"** (`:542`, ~38px),
      que a spec citava só por borda. Medir a altura renderizada, não o padding.
- [ ] T6.3 — **Medir consumidores de `.app-select` antes de alterar** (`rtk rg "app-select"`):
      é classe global usada fora do catálogo, então mudar altura ali tem raio maior que
      esta section.
- [ ] T6.4 — Ruído de borda (R18): substituir traço por superfície nos pontos contados
      (`:462`, `index.css:153`, `SealToggle.tsx:22`, `:542`, `StyleFacetPicker.tsx:72`,
      `:100`). **Preservar sem exceção**: (a) `focus:border-[var(--artificio-brand)]` —
      indicador de foco, exigência de acessibilidade (`AGENTS.md` §Regras de Produto);
      (b) as bordas coloridas de estado ativo (`border-orange-500`, `border-amber-300/50`,
      `border-purple-300/50`), que carregam a seleção. Removê-las é perder informação.
- [ ] T6.5 — Conferir contraste e tokens contra `packages/ui` antes de inventar valor de
      superfície — divergir do design system por app é proibido (`AGENTS.md` §Regras de
      Produto).
- [ ] T6.6 — Rótulo "Estilos" (`StyleFacetPicker.tsx:63`): **medir depois de T6.2 antes de
      aplicar `items-baseline`**. Com alturas já unificadas o desalinhamento pode
      desaparecer sozinho, e `items-baseline` sobre itens iguais pode reintroduzi-lo.
- [ ] T6.7 — **Rejeitar `class="capitalize"`** (proposta 5 da auditoria externa). Fundamento
      medido: `tables.ts:372` faz `GROUP BY style` sobre string exata, logo `exploração` e
      `Exploração` já são duas facetas com contagens separadas. `capitalize` deixaria dois
      chips idênticos na tela com números diferentes — pior que hoje. Registrar o descarte
      em comentário no código, com o porquê.
- [ ] T6.7b — **"Causa raiz = parser" não está medido** (auditoria, Fase 6 achado 3;
      transversal 5). Há **4** pontos de escrita de `setting_styles`, não um: parser,
      editor de draft (`draftFormUtils.ts:451-452`, texto livre sem normalização), formulário
      (`mapper.ts:150`) e painel do mestre (`gmPanel.ts:968`). E a `152` **nunca** capitalizou
      `exploração` — só removeu o ponto de `Exploração.` —, então o minúsculo de hoje pode ser
      dado **pré-existente**, não prova de que "o produtor seguiu produzindo". Medir antes de
      afirmar causa; a correção (normalizar nos 4) vale de qualquer forma.
- [ ] T6.8 — **Normalização na escrita (R19)** — em todos os 4 pontos. `splitFreeTextList`
      (`parseDiscordAnnouncement.ts:1422-1428`) faz só `split` + `trim`. Acrescentar
      normalização para a forma canônica que a `migration_152` definiu: capitalização e
      remoção de pontuação terminal. Cuidados: nome composto (`Dark Fantasy` — cada palavra)
      e preposição interna (`Fatia de vida` não vira `Fatia De Vida`).
- [ ] T6.9 — Extrair a regra de T6.8 para função **testável e compartilhada**; a mesma regra
      escrita em dois lugares diverge (`AGENTS.md` §Compartilhado por padrão).
- [ ] T6.10 — **Medir os outros pontos de escrita de `setting_styles`** — formulário de
      criação de mesa, edição no painel do mestre, editor de draft — e aplicar a mesma
      função. Normalizar só o parser deixaria as outras portas abertas.
- [ ] T6.11 — **Medir o estoque real antes de escrever a migration**:
      `SELECT DISTINCT unnest(setting_styles) FROM tables`, e também `created_at`/`origin`
      das mesas afetadas — sem isso não há como saber **qual** dos 4 pontos de escrita
      produziu o `exploração` atual. Nem o agente nem a auditoria acessaram produção.
      **Correção (auditoria, Fase 6 achado 4):** a `migration_152` fez **9** substituições
      (8 no primeiro UPDATE + `Miastério`→`Mistério` no segundo), não 8; e dos 8 só um é
      typo. A spec contou e categorizou errado.
- [ ] T6.12 — Migration de normalização (R20), **regra genérica + lista de typos**:
      capitalização e trim de pontuação cobrem uma das duas classes que a `migration_152`
      tratava; a outra é **typo** (`Saobrevivência`, `Miastério`), que `initcap` não corrige
      (auditoria, Fase 6 achado 5). Regra genérica sozinha deixa R20 incompleto. Dedup via
      `array_agg(DISTINCT …)` como a `152:16`. Header de 5 campos, idempotente.
- [ ] T6.13 — Teste: duas mesas com `exploração` e `Exploração` produzem **um** chip após a
      migration; e o parser passa a gravar a forma canônica.
- [ ] T6.14 — ⚠️ **VALIDAÇÃO VISUAL COM O MANTENEDOR antes do PR.** R17/R18 mexem em
      aparência de página pública; direção estética é decisão de produto dele, não do agente.
      Levar o antes/depois. Defeito objetivo (alturas desiguais, chip duplicado) é conserto;
      densidade, quanto de borda vira superfície e identidade visual são dele.
- [ ] T6.15 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
      Reler os requisitos **R17, R18 e R20** da `spec.md` (R19 migrou para a Fase 3), o
      **Gap 10** do §Problema, e a seção §"Fase 6" do `plan.md`. Verificar em especial:
      (a) `capitalize` **não** foi usado como correção do dado (T6.7); (b) **R19 já entrou
      na Fase 3** — sem isso esta fase não pode fechar, pois a migration limparia um estoque
      que segue sujando; (c) indicador de foco e bordas de estado ativo sobreviveram (T6.4);
      (d) o estoque foi medido antes da migration (T6.11), não enumerado de memória; (e) a
      migration cobre **typo** além de capitalização (T6.12) — `initcap` sozinho deixa R20
      incompleto; (f) a atribuição de altura não voltou a culpar `.app-select` (T6.2), que
      renderiza 42px por causa do `py-2.5` das linhas 483/496/508.
      Divergência = corrigir antes do PR.
- [ ] T6.16 — Verde local + `rtk pnpm verify:api` + PR contra `dev`.

---

## Fase 7 — Campos que o mestre preenche e a página esconde (R21, R22, R23, R24)

Origem: relato do mantenedor (2026-08-19) sobre `mesas/kingmaker-mt0fk7lb`. Regra dele, que
vale para a página inteira: **tudo que é preenchido aparece; o que fica vazio, some.**

- [ ] T7.1 — **Medir o preenchimento real em produção** antes de escolher a ordem:
      `SELECT` de contagem por campo (`slots_total`, `slots_open`, `city`, `state`,
      `language`, `scenario_id`, `actual_gm_name`) sobre mesas `active`. Leitura, não precisa
      de aprovação. Serve para priorizar e para descobrir campo sumido que o levantamento por
      código não pegou.
- [ ] T7.2 — **Vagas com total (R22)** — restaurar a linha em `TableActionPanel.tsx:128-129`
      no formato **"2 de 5 vagas"**. O total nunca apareceu na página. Dados já estão no
      ViewModel (`tableViewMapper.ts:232-234`) — só renderizar, nada a acrescentar ao mapper.
- [ ] T7.3 — **Não repetir o erro da remoção.** Ela supunha que `vm.urgency` cobria o dado;
      cobre em 3 dos 6 ramos (`tableViewMapper.ts:96-141`) — em "Mesa lotada", "desativada" e
      "encerrada" o número some. Manter `vm.urgency` (alerta) **e** a linha nova (ficha
      técnica): não são duplicata.
- [ ] T7.4 — **Reescrever o comentário das linhas 128-129** explicando por que a linha
      voltou, citando os 3 ramos sem número. Não apagar silenciosamente (`AGENTS.md`
      §Regras Gerais de Código).
- [ ] T7.5 — Caso a decidir: mesa com `slots_total` preenchido e `slots_open` nulo. Pela
      regra, mostrar o que existe ("Mesa de 5 jogadores") em vez de esconder tudo.
- [ ] T7.6 — **Local (R23)** — `city`/`state` no `TableActionPanel`, abaixo de Modalidade,
      só quando preenchidos. **É o item mais grave da fase**: mesa presencial sem local
      publicado é inútil para quem lê.
- [ ] T7.7 — **Idioma (R24)** — junto de Experiência. Antes, medir se há default `'pt-BR'`
      em toda mesa: se houver, exibir só quando **diferente** do padrão, senão vira ruído em
      100% das mesas.
- [ ] T7.8 — **Cenário (R24)** — em `TableContent`, junto de `settingName`, que já é exibido
      ali.
- [ ] T7.9 — **Nome real do mestre (R24)** — no bloco do mestre. Medir a relação com
      `masterName`: se coincidirem na maioria, exibir só quando divergirem.
- [ ] T7.10 — Seguir o padrão de renderização condicional que já existe
      (`TableTechnical.tsx:34-45`, `{vm.campaignLength && (…)}`). **Nunca** rótulo com valor
      vazio, "—" ou "Não informado".
- [ ] T7.11 — Testes: mesa com campo preenchido → aparece; mesa sem → **não** aparece nem o
      rótulo; mesa lotada/cancelada/encerrada → vagas continuam visíveis (é o buraco que
      motivou R22).
- [ ] T7.12 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
      Reler **R21, R22, R23 e R24** da `spec.md`, o **Gap 11** do §Problema, e §"Fase 7" do
      `plan.md`. Verificar em especial: (a) vagas aparecem **também** nos 3 ramos em que
      `vm.urgency` não mostra número; (b) o **total** aparece, não só o restante — era a
      lacuna principal; (c) nenhum campo vazio renderiza rótulo; (d) nenhum campo novo foi
      criado no formulário ou no banco — a fase só exibe o que já é coletado; (e) o
      comentário das linhas 128-129 foi reescrito, não apagado. Divergência = corrigir
      antes do PR.
- [ ] T7.13 — Verde local + `rtk pnpm verify:api` + PR contra `dev`.

---

## Fase 8 — Consolidar aba "Mesas" em `/gestao/mesas` (R5, R6) + fechamento

- [ ] T8.1 — Extrair a aba `tables` de `ConteudoSection.tsx:257-306` para componente próprio
      (ex.: `AdminTablesPanel`), levando junto os handlers `handleDeleteTable` (:109),
      `handleToggleTableStatus` (:124), `handleToggleCovil` (:148), `handleCopyAnnouncement`
      (:158), `handleTablesBatch` (:184), `tableColumns` (:195) e o estado de fetch
      (`fetchAllTables` :83, `tables`, `tablesLoading`, `tablesError`, `copyingTableId`
      :78-81). **Extrair, não copiar** — dois lugares divergem depois, que é o defeito
      que esta fase corrige.
- [ ] T8.2 — Montar o componente em `/gestao/mesas` como sub-aba. Conferir uma a uma as
      **10 funções** da tabela do `plan.md` §Fase 8. Perda de qualquer uma = R5 não atendido.
- [ ] T8.3 — Preservar o `hidden` da linha 298 (`status !== 'active' || !table.slug`) na
      ação "Copiar anúncio" — é a mesma trava de D1/R2.
- [ ] T8.4 — Adaptar o efeito da linha 104 (`if (tab !== 'tables') return;`): a condição
      equivalente é a sub-aba ativa. A nova aba não pode buscar mesas enquanto o admin
      está em "Rascunhos".
- [ ] T8.5 — Remover `'tables'` de `CatalogTab` (:25), `TAB_LABEL` (:33) e `TAB_VALUES`
      (:69) em `ConteudoSection.tsx`.
- [ ] T8.6 — Redirecionar `/gestao/catalogo?tab=tables` para a aba nova em vez de deixar
      cair no default (linhas 74-75), seguindo o padrão de `Navigate` já usado em
      `App.tsx:79-82` e `LegacyModeracaoRedirect` (:41-45).
- [ ] T8.7 — `rtk rg` por `gestao/catalogo` no frontend e corrigir links internos. Já
      medidos: `DashboardSection.tsx:35` e `TableDuplicatesPanel.tsx:96` — este traz
      comentário registrando que `?tableId=` **não** é rota tratada; ler antes de mexer.
- [ ] T8.8 — Testes do componente extraído: as 10 funções, mais o gate de T8.3 e a
      condição de fetch de T8.4.
- [ ] T8.9 — 🔁 **GATE FINAL — varredura completa.** Percorrer **todos** os requisitos
      **R1–R24** e os critérios de aceite da `spec.md` um por um, mais os **11 gaps**
      do §Problema, e reconferir as travas objetivas — não assumir que os gates de fase
      cobriram. Verificar em especial: (a) as decisões D1–D4 foram respeitadas como
      escritas, não como o agente preferiria; (b) `find . -name '*.sql'` fora da allowlist
      devolve vazio (R14) e o guard novo pega isso (R15); (c) `git diff` não mostra
      alteração na ordem da cascata de `extractSlots`; (d) nenhum comentário explicativo
      pré-existente foi apagado nas seis fases (`AGENTS.md` §Regras Gerais de Código);
      (e) não resta aba "Mesas" nas duas rotas (R6); (f) `VTT_ALIASES` não sobreviveu ao
      lado da tabela nova; (g) `setting_styles` é normalizado na escrita, e não por CSS
      (`capitalize` rejeitado em T6.7); (h) a página da mesa não esconde campo preenchido,
      e as vagas mostram o total (R21/R22). Requisito não atendido = spec não está pronta, mesmo com todas
      as tasks marcadas.
- [ ] T8.10 — **Auditoria de cobertura de teste**, por tabela: cada arquivo novo/alterado
      com seu `.test` correspondente, separando **novos** de **estendidos**, nomeando o
      caminho de cada um. Arquivo tocado sem teste = task reaberta, não fechada.

      | Arquivo alterado | Teste | Novo/Estendido |
      |---|---|---|
      | _(preencher na execução)_ | | |

- [ ] T8.11 — Repo-wide, **um comando de cada vez, esperando o anterior**:
      `rtk pnpm run lint`, depois `rtk pnpm run build`, depois `rtk pnpm run test`.
      Nunca encadeados nem em paralelo (`AGENTS.md` §T0 — trava a máquina do mantenedor).
- [ ] T8.12 — `rtk pnpm verify:api` final.
- [ ] T8.13 — Achados de review de bot resolvidos: fix que procede vira commit normal **com
      comentário no próprio código** citando origem (PR + bot + severidade), no padrão
      `Achado real (review PR #NNN, <bot>, <P1|P2|nitpick>): …`. O que não virou código
      (descartado ou débito) é registrado aqui com o porquê. **Nunca** responder, comentar,
      resolver thread ou reagir no PR.
- [ ] T8.14 — Conferir que nenhuma pendência desta spec ficou só no chat. Registro em
      `specs/backlog.md`, sessão ou `project-state.md` **somente** se o mantenedor mandar.
- [ ] T8.15 — Smoke real pós-deploy dos itens cujo aceite exige execução (aceites 8 e 9 da
      `spec.md` envolvem migration e guard — dry-run não fecha task executável,
      `AGENTS.md` §Erros que não podem se repetir).
- [ ] T8.16 — PR contra `dev`.

---

## Evidência de investigação (2026-08-19)

Medições que sustentam decisões acima e que o executor não deve refazer do zero. Os antigos
"achados laterais" A1 e A2 **viraram requisitos** (R14/R15 e R16) por decisão **D4** do
mantenedor — "tudo nessa spec". A3 permanece aqui: é evidência, não achado a corrigir.

### A3 — Aliases curtos: evidência contra adicioná-los

Contagem literal case-insensitive sobre
`apps/mesas/backend/src/inbox/__tests__/fixtures/discord-announcements-real.txt`
(1030 linhas de anúncios reais):

| Termo | Ocorrências | | Termo | Ocorrências |
|---|---|---|---|---|
| Foundry | 16 | | Roll 20 | **0** |
| Owlbear | 8 | | R20 | **0** |
| **Roll20** | **6** | | TaleSpire / Tale Spire | **0** |
| FoundryVTT | 3 | | Fantasy Grounds / FGU / FG | **0** |
| | | | TTS / Tableplop / Quest Portal / Alchemy | **0** |

Duas consequências, ambas aplicadas ao plano:

1. **Roll20 já é reconhecido.** O `name` no banco é exatamente `Roll20`
   (`006_create_vtt_platforms.sql:38`) e é assim que aparece nas 6 ocorrências. Ter zero
   alias é fato; o impacto que se poderia supor — "a VTT mais citada não resolve" — **não
   se observa nesta amostra**. A correção vale como defesa para grafias futuras, não como
   conserto de falha observada.
2. **Sigla de 2 letras não entra.** `findPlatformMatch` chama `findEntryMatch` com
   `allowShortAliases = true` (`parseDiscordAnnouncement.ts:626`), o que **desliga** o guard
   `length < 4` da linha 269 — cujo comentário (linhas 267-268) registra que aliases curtos
   "geram falsos positivos". Sobra só `length < 2` (linha 270). A fronteira de
   `candidateMatchesText` (linha 243) é `(?:^|[\s,;:])…(?:[\s,;:]|$)`, mais restritiva que
   `\b`, então a sigla não casa dentro de outra palavra — mas casa qualquer ocorrência
   isolada dela no corpo. Ganho medido zero, risco documentado pelo próprio código.

### A4 — Auditoria externa do painel de filtros (Gemini), cruzada com o fonte

O mantenedor trouxe uma auditoria externa do painel de filtros de `mesas.artificiorpg.com`
(2026-08-19). Ela foi feita sobre o **DOM renderizado**, não sobre o fonte — e o fonte não é
markup inline, e sim componentes. Veredito por item, medido:

| # | Achado externo | Veredito | Evidência |
|---|---|---|---|
| 1 | `<p>` "Cada nível é um nó…" quebra `items-center` | **Não existe** | `grep -rn "Cada nível" apps/mesas/frontend/src` → zero. Vem de dentro de `CatalogSystemFilter`, não da section |
| 2 | `py-1.5` vs `py-2.5` | **Procede** | `SealToggle.tsx:22` vs `CatalogoPage.tsx:462` vs `index.css:156` — três alturas |
| 3 | "Estilos" desalinhado → `items-baseline` | **Procede parcialmente** | `StyleFacetPicker.tsx:63` usa `items-center` com `text-[11px]` ao lado de `text-xs`. Unificar altura pode resolver sem `items-baseline` |
| 4 | Excesso de borda | **Procede** | 6 pontos contados: `:462`, `index.css:153`, `SealToggle.tsx:22`, `:542`, `StyleFacetPicker.tsx:72`, `:100` |
| 5 | Adicionar `capitalize` | **Diagnosticado errado** | Ver abaixo |

**Por que o item 5 é maquiagem, não conserto.** A duplicação de chip não é visual, é de dado:
`tables.ts:372` faz `GROUP BY style` sobre string exata, então `exploração` e `Exploração`
são **duas facetas** com contagens separadas. `capitalize` deixaria dois chips idênticos na
tela com números diferentes — leitura pior que a atual.

Causa raiz: `splitFreeTextList` (`parseDiscordAnnouncement.ts:1422-1428`) faz `split` +
`trim` e nada mais. Precedente medido: `migration_152_normalize_setting_styles.sql`
(spec 081, 2026-07-17) já limpou à mão 8 variantes sujas — `'dark fantasy'`,
`'Exploração.'`, `'fantasia'`, `'sobrevivência'`, `'suspense'`, `'terror'`, `'Macabro.'`,
`'Saobrevivência'` — com o cabeçalho registrando *"auditoria visual identificou via SELECT
em prod"*. A migration limpou o estoque; o produtor seguiu produzindo. Ver requisitos
**R19/R20** e Fase 6.

Valor da auditoria externa: os itens 2 e 4 são defeitos objetivos reais que não haviam sido
levantados. O item 5 mostra por que auditoria de DOM não substitui leitura do fonte — o
sintoma estava certo, a causa não.

### Erros do agente, registrados

**2026-08-19 — auditoria adversarial: 48 achados, 8 auditores.** Resultados integrais em
`HANDOFF-AUDITORIA.md` §Resultados. Os que mudaram o desenho da spec, por gravidade:

| # | Erro | Onde estava | Correção |
|---|---|---|---|
| 1 | **Camada C com mecanismo falso** — afirmei que o `return` da `:1015` impedia `"1 disponível de 4"` de ser avaliada. A regex da `:1009` exige `/` literal; a frase nunca seria candidata. | Gap 4, `plan.md` §Fase 1 | Camada C rebaixada a robustez |
| 2 | **R9 inalcançável pelo plano** — nenhuma das 9 estratégias casa `"N disponível de M"`; o guard sozinho devolve `{null,null}`. | Fase 1 inteira | **Camada D** criada (T1.4b) |
| 3 | **Cobertura de teste inventada** — dei `8/25` e `"grupo de 5 pessoas"` como cobertos; não existem. `slotsGroupSize` é função viva sem teste. | `plan.md:88`, T1.5 | Virou tarefa, não pressuposto |
| 4 | **Guard de faixa com falso positivo** — `"Participantes: 30/24"` (`real.txt:179`) e `"4/1 Vagas Abertas"` (teste `:684`) são vagas legítimas que ele rejeitaria; e eu mesmo listava `8/25` como formato a preservar. | `plan.md` sinal 3 | Sinal **descartado** |
| 5 | **"Restaurar não existe"** — falso: "Editar status" (`:299-303`) tem gate só em `synced`, logo aparece para `rejected`. O fluxo já funciona pelo preview. | Gap 7, R13, 4 lugares | R13 vira atalho; **D5** aberta |
| 6 | **Predicado de D1 errado** — `publishedSlug` vem de rota admin (só `status`), mas eu mandava buscar pela rota pública, que aplica `archived_at` + expiração. Toda mesa do fluxo é `imported` e expira. | `plan.md` §4b, T4.5 | Rota **admin** vira primária |
| 7 | **Prova de coerência refutada** — usei `Classificação Indicativa` como exemplo de rótulo extraído e removido. Não é removido (`classificacao indicativa` ≠ `classificacao`), e `age_rating` vem de outro caminho. | Gap 5 | Virou **mais um caso** do bug |
| 8 | **`normalizeLabelKey` preserva parênteses** — afirmei o oposto do que `normalize:197` faz (`[^a-z0-9\s]` → espaço). | Gap 5, T3.2 | Corrigido e medido |
| 9 | **Contradição D2** — `plan.md` dizia "Sem migration nesta spec (decisão D2)" enquanto três fases criam migration, e D2 **exige** migration. | `plan.md:535` | Reescrito |
| 10 | **Acoplamento Fase 3↔6 escrito e não corrigido** — a spec dizia que separá-las piora o sistema entre merges, e as separava assim mesmo. | ordem das fases | **R19 migrou para a Fase 3** |
| 11 | **Contagens erradas**: `migration_106` lista 9 VTTs (não 10, e `tableplop.webp` nem existe); `ConteudoSection` tem 4 abas de taxonomia (não 5); a aba lista mesas de qualquer status (não "publicadas"); `CopyAnnouncementButton` tem 2 usos (não 3/4); `migration_152` fez 9 substituições (não 8); `.app-select` renderiza 42px, igual ao input. | vários | Todos corrigidos |
| 12 | **Inferência de produção fraca** — `tables.ts:830` está sob `if (variant …)` em `try/catch`; a evidência forte (`gmPanel.ts:1636`, incondicional) eu não tinha achado. E referência de código não é medição de produção (§Evidência). | Gap 8, T2.2 | T2.2 reescrita |

Erros laterais também corrigidos: `shared.ts:77` → `:78`; `clicks_count` não é órfão
(`migration_16:14` já cria); a não-idempotência real é o `UPDATE` de `006_:51-54`, não o
`ALTER TABLE`; a varredura de R15 acusa **só** os 2 órfãos; o initializer de `useState`
(`:78-83`) precisa da mesma cadeia de sub-abas; a origem que dei ao `<p>` "Cada nível é um
nó" era **inventada** — afirmei que não existe e ao mesmo tempo lhe atribuí origem.



**2026-08-19 — contagem errada das funções da aba Mesas (R5).** A spec afirmou "9 funções"
em quatro pontos (`spec.md` R5 e aceite 5, `plan.md` §Fase 8, `tasks.md` T8.2/T8.8). A
contagem real é **10**: busca (`ConteudoSection.tsx:263-264`), 2 facetas (`:265-284`),
3 ações em lote (`:288-292`), 4 ações por linha (`:293-304`). O erro veio da tabela do
`plan.md`, que listou a quarta ação de linha (`Apagar`) numa linha sem número, e o "9" foi
repetido sem recontagem. Achado pelo próprio agente ao redigir o handoff de auditoria, e
corrigido nos quatro pontos. Fica registrado porque a classe do erro — número propagado
entre documentos sem reconferência — pode ter outras ocorrências.

### Correção de erro do agente, registrada

Na primeira volta desta investigação o agente afirmou que "`vtt_platforms` não é criada nem
semeada por migration alguma no repo". **Errado** — é criada e semeada por
`apps/mesas/backend/migrations/006_create_vtt_platforms.sql`; a busca inicial cobriu apenas
`apps/mesas/database/`. O problema real não é ausência de migration, e sim migration
existente em diretório que nem o guard nem o runner alcançam (Gap 8).
