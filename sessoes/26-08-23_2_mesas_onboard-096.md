# Sessão 26-08-23_2 — Mesas: onboard 096 (levantamento + auditoria)

- **Spec:** `specs/096-mesas-onboard-criacao/`
- **Fase:** Fase 0 (levantamento inicial) — concluída; auditoria interna contra o código — concluída.
- **Fluxo definido pelo mantenedor:** (1) levantamento inicial (orquestrador) → (2) conferência externa Claude → (3) protótipos/fluxos + pesquisa de mercado + grill → (4) implementação.

## O que foi feito

Levantamento read-only em 2 rodadas (subagentes investigador/revisor + medição no banco de
produção via `ssh faren docker exec mesas-db psql -U admin -d mesas_rpg` — só SELECT).

### Gap 1 — wizard e edição
- Wizard = `CreateTableForm` + `form-steps/` (6 etapas, 1.474 linhas) + `useStepNavigation`.
- `OnboardingPage` é onboarding de **preferências** (rota `/onboarding`), não de mesa.
- Edição reutiliza 100% o form; `step=1`/`maxStepUnlocked=1` sempre; botão "Publicar Mesa"
  na edição; `synopsisNarrative` sem editor (perda de edição).

### Gap 2 — PC/mic/câmera
- Colunas `requires_pc/camera/microphone` + `technical_requirements` já existem
  (`migration_11:32-35`); UI só no colapsável do StepFinal; **nenhuma regra VTT→requisitos**
  existe. 10 VTTs (seed `migration_158:53-63`); 6 plataformas de comunicação em produção
  (5 no seed `migration_105:22-28` + "Meet" do backfill legado — par redundante).

### Gap 3 — preço 39,96 — ENCERRADO por conferência do mantenedor
- Mantenedor conferiu 3×: campo de edição mostra 40. Nenhuma fórmula gera 39,96 de 55/40
  (economia só %, 27%, correta). Learning-store descartado por medição em produção
  (`discord_field_learning`: 0 regras de `price_value`; 37 regras totais). Permanece teste
  de regressão (R4).

### Gap 4 — parser
- 8 falhas medidas (catálogos nunca passados ao preview; chave `schedules` vs `sessions`;
  corte de parêntese; @username; regex mic com coordenação; ambiguidades chegam no payload
  mas o front não lê; mensal/doações não extraídos; 1º segmento só). Corrigido pela
  auditoria: o mecanismo da Falha 6 era "não chegam ao front" — na verdade **chegam** e o
  front é que não mapeia.

### Gap 5 — obrigatório/opcional
- Decisão do mantenedor (2026-08-23): borda vermelha por campo ao interagir sem completar
  e ao fechar sem preencher; mensagens por campo (hoje: só 1ª da etapa, `StepActions:18-22`).

### Gap 6 — backend não usado (aprofundado com banco)
- `age_rating`/`table_level`: UI coleta, payload descarta, banco grava default
  ('livre'/'todos') — **41 manuais 100% default; público vê faixa errada**.
- 2 bugs de edição: `is_covil_mesa` nunca existe → edição desmarca Covil (2 mesas em
  produção); `data.sessions` nunca existe → horários múltiplos colapsam (0 mesas com 2+
  hoje, 90 schedules/90 mesas).
- Notificações: 12 escritores, 0 leitores; 66 registros, 62 não lidos.
- Rotas sem consumidor reclassificadas (valiosa/duplicada/admin/morta); `tableSchedules.ts`
  morto; `verify-covil` morta.
- Produção (107 mesas): 66 imported / 41 manual; 79 gratuita / 28 paga; 5 mensal; 0 doações;
  `content_warnings`/`safety_tools` com dado real = 0; `city/state` = 0; `starts_at` = 0;
  `price_frequency` = 1.

## Auditoria interna (subagente revisor, autorizada pelo mantenedor 2026-08-23)

Status: **aprovado com ressalvas**. 7 divergências, todas documentais:
- D1: soma de linhas dos steps errada (2.438 → **1.474**).
- D2: mecanismo da Falha 6 do Gap 4 incorreto (sinais chegam no payload; front não lê) — corrigido.
- D3-D7: deslocamentos de citação (notificações: 10→12 pontos; `me.ts:91-101`; `validation.ts:226,233`;
  `useStepNavigation.ts:19-20`; `StepActions.tsx:18-22`; `migration_11:32-35`;
  `SessionRepeater.tsx:94`; `StepConfig.tsx:415,428`).
- **Números de produção: 24/24 idênticos na revalidação.**
- Não verificado pelo revisor: reexecução do anúncio sintético do parser e das suítes de
  teste (medidas originais citadas nos relatórios dos subagentes A-E).

## Decisões do mantenedor registradas na spec
1. Gap 3 encerrado por conferência (2026-08-23).
2. Gap 5: validação por campo com borda vermelha (2026-08-23).

## Próximo passo
- Fase 1: conferência externa (Claude) — mantenedor leva `spec.md` + `plan.md`.
- Depois: Fase 2 (pesquisa de mercado + grill) — perguntas já listadas em `tasks.md` §Pendências.
