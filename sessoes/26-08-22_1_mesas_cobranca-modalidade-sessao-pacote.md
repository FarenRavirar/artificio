# 26-08-22_1 · mesas — modalidade de cobrança no cadastro (sessão avulsa ou pacote mensal)

**Estado:** implementada no working tree, aguardando commit · sem commit.
**Origem:** feedback de usuário do cadastro de mesa, repassado pelo mantenedor em 2026-08-22.

## O pedido

No cadastro de mesa, no bloco de cobrança, permitir escolher **sessão avulsa** ou **pacote mensal** — a maioria dos narradores comissionados trabalha assim; o valor mensal costuma ter desconto sobre a sessão avulsa. Pesquisa de mercado confirmou avulso-por-sessão como o padrão principal do mercado (StartPlaying cobra por sessão/jogador); o pacote mensal é diferencial do produto. Dinheiro nunca em float (`NUMERIC(10,2)`, já usado no mesas).

## Decisões do mantenedor (2026-08-22, acumulado)

1. **Valor Avulso é sempre o principal** — obrigatório para mesa paga (CHECK `price_value_required`).
2. **Pacote Mensal é adicional e opcional** — valor individual por sessão dentro do pacote, dado de entrada explícito (nunca percentual). Expor os dois quando ambos preenchidos; só avulso mostra só avulso.
3. **Card do catálogo: só avulso.** Página da mesa: os dois. **Sort por preço segue pelo avulso.**
4. **Sem CHECK de relação** avulso × mensal (não registrar quem é menor/maior); economia % derivada só na exibição.
5. **A3 — mantém `min(0)`** (não endurecer validação).
6. **A2 — DECIDIDO: ENDURECER.** Mesa gratuita não pode ter `price_value`/`price_value_monthly`; doação tem campo próprio. (Dado de produção medido via `psql` read-only na VM: gratuita 77 / 0 com valor órfão; paga 23 / 23 com valor; 0 com freq mensal.)
7. **Doações:** exclusivas de mesa gratuita; valor sugerido opcional; gratuita sem valor → banner claro "Gratuita" (lastro de mercado: doação sugerida é apoio voluntário, nunca preço).
8. `campanha` não é exposta no form (fora do pedido; enum inalterado) — **inferência a confirmar**.

## O que foi entregue (working tree, sem commit)

- **Migration `migration_161_add_price_value_monthly.sql`** — online-safe, header 5 campos, idempotente: 3 colunas aditivas em `tables` (`price_value_monthly NUMERIC(10,2)`, `accepts_donations boolean NOT NULL DEFAULT false`, `suggested_donation_value NUMERIC(10,2)`); `@author: sessao-26-08-22_1-mesas-cobranca` (origem é a sessão, não há spec). Sem CHECK de relação/positividade no banco — validação numérica vive no Zod (`min(0)`); mesas existentes ficam NULL/false.
- **Backend:** types; validador com refines (mensal→paga; doação→gratuita; valor sugerido→aceita doações; `.optional()` no update preserva Kysely; A2 endurecido — gratuita com preço → 400 em create e update); service; gmPanel updateData + selects; `tables.ts` só detalhe; hydration allowlist. Testes validador 56/56.
- **Frontend:** StepConfig (bloco doação p/ gratuita + handler A1: virar paga limpa doações; desmarcar checkbox limpa sugestão); hook; mapper por modalidade (`parseClearablePriceValue` — A4 anti-NaN; A2 — paga zera doações, gratuita zera preços); mapTableApiToInitialData; TableActionPanel PricePanel por `priceType` (banner "Gratuita" + bloco doação; paga intacta); StepReview; WhatsApp (linhas de doação só p/ gratuita). Testes 59/59.
- **Validação real:** backend tsc 0; frontend tsc app/test 0/0 (tsconfig raiz vacuous — usar app/test); rotas 57/57; lint limpo; `rtk pnpm verify:api` exit 0 com breaking=0 nos 6 apps. 2 auditorias adversariais realizadas; vereditos e porquês (A1/A2/A4, correções de limpeza null, StepReview) registrados como comentários no código.
- **Cruzamento com `.specify/memory/errors.md` (E001-E021): nenhum erro conhecido se replica no código novo.** Medido: migration 161 sem DDL destrutivo (E010 não barra), header 5 campos nas linhas 1-5 (E011), única pendente além da 160 aplicada em prod (E012: 1 ≤ 5), sem referência a coluna existente (E014), sem index (E015), sem import/dependência nova nem Dockerfile (E016/E017/E021), sem segredo no diff (E007, grep).

## Blast radius conhecido (intocados de propósito)

Catálogo, sort `price_asc/desc`, `gm.ts`, `TableCard` e `MestreFeaturedTable` **intocados de propósito** — card do catálogo continua mostrando só o valor avulso (decisão do mantenedor, item 3). VM legado sem `priceType` preserva comportamento antigo.

## Achados laterais pré-existentes (reportados, não corrigidos)

- **(a) PUT parcial sem `price_type` rebaixava paga→gratuita:** fechado parcialmente pelo refine do A2 — agora 400 quando envia preço; **o caso sem preço continua degradando** (registrado; correção de raiz segue pendente).
- **(b) default `'free'` do hook não casa com options do select (`'gratuita'`/`'paga'`):** pré-existente; fora do escopo da feature.
- **(c) `/ sessão` hardcoded em `TableCard`/`MestreFeaturedTable`:** **correto manter** — card só avulso é decisão; sem correção.

## Pendências para o commit

- **2 arquivos de outras frentes no working tree** (`specs/095-infra-blue-green-prod/plan.md`, `.claude/settings.local.json`) — decisão de inclusão no commit é do mantenedor.
- **`price_value` opcional vs obrigatório no `CreateTablePayload`:** implementador usou opcional preservando semântica (refine "Valor obrigatório para mesas pagas" em `tableValidators.ts`) — **confirmado**.

## Próxima fase

Commit (aguarda autorização nominal).
