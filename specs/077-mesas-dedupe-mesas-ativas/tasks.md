# Tasks — 077 mesas dedupe mesas ativas

Execução: Codex. Ordem estrita — Fase 0 completa (com evidência) antes de
qualquer task de código de feature.

## Fase 0 — Investigação (bloqueia tudo abaixo)

- [x] Atualizar `specs/backlog.md` e `project-state.md` (abertura da spec).
- [x] Confirmar schema real de `tables` (campos usáveis pra hash/score) —
      registrar evidência (arquivo:linha) em `sessoes/`.
- [x] Levantar volume real de mesas ativas (`count(*)`, read-only) —
      registrar número e se full-scan síncrono é viável.
- [x] Escrever teste exploratório do algoritmo de score contra amostra real
      de `tables` — registrar quantos pares candidatos aparecem hoje.
- [x] Propor e registrar em `plan.md`: tabela nova vs. extensão de
      `discord_duplicate_candidates`.
- [x] Propor e registrar em `plan.md`: gatilho sob demanda vs. automático.
- [x] Levar decisões ao mantenedor e obter aprovação explícita antes de
      migration/rota nova.

## Fase 1+ — Implementação (só após Fase 0 aprovada)

- [x] Migration: tabela de candidatos mesa×mesa (ou ajuste decidido).
- [x] Backend: serviço de comparação/score mesa×mesa.
- [x] Backend: rota `GET /admin/tables/duplicates`.
- [x] Backend: rota `PATCH /admin/table-duplicate-candidates/:id`.
- [x] Backend: estender detecção draft×mesa ativa (não só draft×draft).
- [x] Frontend: badge de duplicata em `DiscordDraftReviewTable.tsx`.
- [x] Frontend: tela/aba de gestão de duplicatas com link direto pras duas
      pontas (mesa pública + admin + draft).

## Fase 2 — Testes e validação

- [x] Teste unitário do serviço de score (par idêntico, par parecido só no
      sistema, par sem relação).
- [x] Teste de rota (`GET`/`PATCH`) cobrindo `requireAdmin` e payload
      inválido.
- [x] `pnpm run lint` + `pnpm run build` (backend + frontend mesas).
- [ ] Smoke manual real: par de mesas ativas semelhantes aparece como
      candidato na tela de gestão (não fechar só com teste unitário).
- [ ] Atualizar `specs/backlog.md` e `project-state.md` (fechamento/status).

## Frente parser — ampliação de escopo (2026-07-14)

- [x] P0.1 Ler handoff/arquitetura e confirmar caminho do parser, learning e dois
      modos DeepSeek.
- [x] P0.2 Rodar baseline em `D:\teste.json` e `D:\teste [part 2].json`.
      Evidência: 200 mensagens, 169 drafts, 63 sinais de requisito e 0 capturas
      pelo extrator atual sem catálogo.
- [x] P0.3 Registrar antes do avanço: aliases ativos só chegavam a título/sistema;
      `field_value` chegava só a `_ai_suggestions`; inferência VTT/Discord era
      insegura.
- [x] P1.1 Consumir aliases aprendidos em preço, vagas, dia, horário, contato e
      descrição.
- [x] P1.2 Implementar tri-state de PC/câmera/microfone com ambiguidade explícita.
- [x] P1.3 Registrar checkpoint P1 e casos de teste antes de executar validação.
- [x] P2.1 Definir e registrar guardas da aplicação automática de regra humana
      ativa antes de editar o fluxo de learning.
- [x] P2.2 Aplicar learning ativo no campo do draft, recalcular sistema/missing/status
      e manter proveniência, sem auto-publicar.
- [x] P2.3 Provar com DeepSeek automático desligado.
- [x] P3.1 Testes focados parser/backend (155/155).
- [x] P3.2 Reexecutar auditoria dos 2 corpora: 0/63 -> 47/63 capturados (74,6%).
- [x] P3.3 Registrar checkpoint P3 antes dos gates globais.
- [x] P4.1 `pnpm run lint` (21/21).
- [x] P4.2 `pnpm run build` (21/21).
- [x] P4.3 Revisar diff e registrar estado final; sem commit/push/deploy.

## Frente parser P5 — autonomia segura

- [x] P5.0 Registrar objetivo e ordem antes da auditoria.
- [x] P5.1 Auditar unidade/escopo de `field_value`, `label_alias` e store legado.
- [x] P5.2 Classificar campos em fatos, categorias, entidades e sinais semânticos.
- [x] P5.3 Mapear lacunas de aprendizado, promoção, conflito e rollback.
- [x] P5.3a Desligar gravação/consumo do store legado no fluxo vivo.
- [x] P5.3b Restringir `field_value` autoaplicável a `system_name`.
- [x] P5.3c Adicionar regressões de não-generalização de fatos por anúncio.
- [x] P5.4 Propor ondas priorizadas com gates mensuráveis de autonomia.
- [x] P5.4a Validar hardening: backend completo + lint/build repo-wide.
- [x] P5.5 Mantenedor escolheu Onda A — feedback confiável (2026-07-14).
- [x] P5.6 Localizar contratos/schema dos quatro fluxos da Onda A: aplicação,
      recorreção, confirmação explícita e persistência observável.
- [x] P5.7 Definir e registrar contrato material da Onda A antes do código.
- [x] P5.8 Implementar Onda A sem liberar automação operacional.
  - [x] P5.8a Migration/tipos + `_learning_applied` auditável.
  - [x] P5.8b Outbox transacional, recorreção e feedback de confirmação.
  - [x] P5.8c API/UI observável + retry explícito.
- [x] P5.9 Validar testes focados, corpora reais, backend/frontend, lint/build e
      diff-check, com checkpoint antes de cada gate.
- [ ] P5.10 Smoke real em beta/Postgres: curadoria grava confirmação/correção,
      outbox fica observável, retry conclui falha simulada e novo draft consome o
      learning com DeepSeek automático desligado; anexar evidência.

## Frente parser P6 — vagas X/Y

- [x] P6.0 Registrar regra canônica antes da investigação.
- [x] P6.1 Localizar todas as interpretações X/Y e testes existentes.
- [x] P6.2 Reusar implementação correta; remover divergência filled/open.
- [x] P6.3 Validar nos corpora reais e regressões: 28/28 drafts elegíveis,
      149/149 focados, backend 477/477, lint/build 21/21.
- [x] P6.4 Substituir regra max/min por cascata semântica de rótulo;
      genérico `X/Y` volta a ser ambíguo.
  - [x] P6.4a Implementar open/filled/generic e regressões focadas (175/175).
  - [x] P6.4b Reauditar corpora e gates completos: 28/28 coerentes; backend
        487/487; frontend 177/177; lint/build 21/21.

## Frente parser P7 — sistema e alternativas

- [x] P7.0 Registrar relato, separar seleção de exibição e definir rastreio.
- [x] P7.1 Reproduzir sistema incorreto e ausência de sugestões no código/dados.
- [x] P7.2 Corrigir causa material e adicionar regressões.
  - [x] P7.2a Backend: ordem de match, candidatos determinísticos e learning
        seguro `system_entity` (174/174 focados).
  - [x] P7.2b Frontend: exibir candidatos abaixo do picker e testar aplicação
        (16/16 focados).
- [x] P7.3 Auditar corpora reais e validar backend/frontend/lint/build.
  - [x] P7.3a Auditoria inicial: 200 mensagens; revelou colisão D&D→Gamma
        World e comprovou transporte de alternativas em 74 drafts.
  - [x] P7.3b Corrigir desempate de alias colidente e repetir regressão/corpus:
        175/175 focados; 200 mensagens; 100 vínculos; 69 com alternativas.
  - [x] P7.3c Executar suites completas, lint, build e diff-check: backend
        483/483; frontend 176/176; lint/build 21/21; diff-check verde.
- [ ] P7.4 REABERTA: resolver sistema em duas etapas, base → edição/filho,
      restringindo tokens de versão à árvore da base reconhecida.
  - [x] P7.4a Implementar raiz→descendente e regressões focadas (176/176).
    - [x] P7.4a.1 Raiz, descendência, aliases seguros e ranking posicional.
    - [x] P7.4a.2 Corrigir gate de folha nomeada só pela edição; `D&D 5e`
          seleciona `dnd-5e`, sem Gamma entre alternativas.
  - [x] P7.4b Reauditar corpora e gates completos.
    - [x] P7.4b.1 Seleção: 98/155, D&D 5e correto, Gamma ausente.
    - [x] P7.4b.2 Resolver alternativas cartesianas impossíveis dentro da raiz;
          2014/2024 são variantes sob 5e, nunca edições irmãs nem filhas de 1e.
      - [x] P7.4b.2a Localizar perda da cadeia ancestral antes do código:
            parser achata descendentes da raiz e scorer busca filho entre irmãos.
      - [x] P7.4b.2b Restringir candidatos à cadeia raiz→edição→variante
            (26/26 testes focados).
      - [x] P7.4b.2c Auditar contrato universal no backend: parser, scorer,
            loaders, CRUD, moderação, sugestões, imports e migrations.
      - [x] P7.4b.2d Auditar contrato universal no frontend: tipos, árvore,
            picker, criação/sugestão e editor de draft.
      - [x] P7.4b.2e Corrigir resíduos e provar com testes genéricos de outro
            sistema além de D&D, incluindo variante textual.
      - [x] P7.4b.2f Endurecer fonte central (`apps/site`) para validar pai em
            create/update; alinhar Mesas e impedir novo legado cartesiano.
      - [ ] P7.4b.2g Remover conceito legado `subsystem` de código/API/frontend;
            auditar e reclassificar dados existentes antes da constraint final.
        - [x] P7.4b.2g.1 Remover de `packages/catalog-ui`, `site-admin`, clientes
              `downloads`/`glossario` e todo texto operacional de `mesas`.
        - [x] P7.4b.2g.2 Garantir `system → edition → variant` em validação de
              escrita e banco; migration aborta diante de legado não auditado.
        - [x] P7.4b.2g.3 Busca global final: nenhuma ocorrência operacional;
              apenas histórico imutável ou guarda explícita de rejeição.
          - [x] Código ativo/frontend/clientes compartilhados sem quarto tipo.
          - [x] Neutralizar `apply_migrations_06_07.sql` e criar guarda final de DB.
        - [x] P7.4b.2g.4 Remover importação cartesiana e validar cadeia de sugestão.
        - [x] P7.4b.2g.5 Testes focados backend/frontend/pacote compartilhado.
        - [x] P7.4b.2g.6 Auditar catálogo existente por classificação semântica
              errada e preparar correções explícitas, sem regra universal por ano.
          - [x] Auditoria pública: 2 violações estruturais + 5 grupos candidatos.
          - [x] Preparar correção D&D 1e e merge D&D 2024 sem perda (não aplicada).
          - [ ] Mantenedor decidir Mage/Mothership/OSE/Shadowrun após evidência.
        - [x] P7.4b.2g.7 Reauditar 200 anúncios contra catálogo público atual.
          - [x] Rodada 1: 122/155; expôs nomes de filhos com prefixo ancestral.
          - [x] Corrigir prefixo ancestral e podar raízes concorrentes/aliases genéricos.
          - [x] Rodada 2 após testes focados reais.
          - [x] Rodada final: casos comuns D&D corretos; 33 ausentes do catálogo.
          - [x] Remover irmãos/raízes concorrentes após seleção conclusiva.
          - [x] Inferência genérica de variante por descendente único (14/24).
          - [x] Inferência única + decimal/ano curto validada em corpus/controle.
        - [x] P7.4b.2g.9 Gate API: dois mounts de `retry-learning` declarados no
              overlay canônico; `pnpm verify:api` verde, 360 operações, 0 breaking.
        - [ ] P7.4b.2g.8 Antes de qualquer merge/migration na VM: backup completo
              dos bancos afetados, restauração/integridade verificada e cópia
              off-VM em `C:\projetos\artificiobackup`; anexar evidência. BLOQUEANTE.
          - [x] Corrigir metadata da migration 148 para `manual-risk` e
                `requires-backup: true`; descoberta ordenada 146–148 confirmada.
          - [x] Impedir autoexecução de site 008/009: adicionar metadata
                `manual-risk`/backup e gate fail-closed no runner de migrations do
                site, com testes; deploy comum não aplica merge (26/26).
          - [ ] Definir e implementar caminho de deploy manual do site: encaminhar
                autorização/atestados e montar backup não vazio no container para
                executar 008/009; deploy comum deve continuar bloqueado.
          - [ ] Aplicar, com autorização nominal e evidência, Mesas 146 → 147 →
                148 antes de site 008 → 009 no ambiente alvo.
        - [ ] P7.4b.2g.10 Após migrations em beta: smoke `D&D 5e`, `5e 2014`,
              `5e 2024`, ano sem edição e alternativas; nenhum Gamma/Drakar e
              `D&D 2024` não pode permanecer na raiz.
