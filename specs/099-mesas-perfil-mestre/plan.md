# Plano 099 — Perfil do mestre

**Status:** grill concluído (2026-08-27); decisões D1-D5 resolvidas. **Nenhuma fase
executada.**

---

## Decisões que este plano aplica (spec §4)

- **D1:** modelo de informação não mexe — sem migration, sem campo novo; usa o que existe
  desde a `migration_107`.
- **D2:** dobra respondida por pesquisa (§3.2/§3.3): `tagline` + etiquetas de atributos;
  headline gerada vira fallback; `featured` continua do admin.
- **D3:** seção de Avaliações permanece como está (feature recente); trade-off registrado
  em spec §4.
- **D4:** `Preço Médio` sai do front; migration e banco intactos.
- **D5:** mantém as 3 telas; que funcionem (C3, C9, prévia). Coleta progressiva não entra.
- **Escopo:** 099 independente — leva C4-C7 (T11-T13); nenhuma coordenação com a 098.

---

## Fase A — Inventário sobre os campos existentes (D1 decidida)

Sem migration (D1). Entrega:

1. Inventário fechado sobre o que já existe: para cada informação que um jogador usa para
   escolher mestre, qual campo existente a carrega — `tagline`, `specialties`,
   `languages`, `selling_points`, `badges`, `links`, `experience_years`.
2. Resolução de C1: qual fonte manda em "anos de experiência", e o que acontece com o
   texto que hoje contradiz (`Mestre há 11 anos` dentro da bio).
3. Normalização na fronteira (C2), antes de qualquer JSONB entrar em props.

**Trava:** nada aqui toca layout. Se a fase A produzir mudança visual, saiu do escopo.

## Fase B — Porta de entrada (o mestre insere)

Só começa com A fechada. Entrega o editor sobre os campos existentes: cada campo do
inventário tem onde ser preenchido, e o mestre vê o que preencheu.

Inclui: C3 (autosave que não some), C9 (sistemas listados, não só contados), remoção do
campo `Preço Médio` do front (D4), prévia do perfil público, e as 3 telas mantidas e
funcionando (D5).

**Medida de aceite da fase:** a busca de A1 (§6 da spec) volta sem lacuna.

**Decidido no grill:** coleta progressiva (§3.4) **não** entra nesta passada.

## Fase C — Exibição (o sistema expõe)

Só começa com B fechada — a dobra nova depende do mestre ter onde preencher `tagline`.

Entrega a página pública: dobra = `tagline` + etiquetas de atributos, com fallback para
a headline atual enquanto vazia (D2); Avaliações como está (D3); sem preço no perfil
(D4); e a ordem das seções como consequência do inventário.

Inclui C8 (vãos de seção sem regra).

**Medida de aceite:** A2 e A3 da spec, medidas em 1366×768 e 1920×1080, nos dois temas.

## Fase D — Correções que pertencem ao pacote

**Independente de A/B/C — pode correr em paralelo, e provavelmente deve.**

C4, C5, C6, C7: alvo de clique abaixo de 24px, largura de campo por tamanho de resposta,
escala de altura.

**Decisão de escopo (grill, 2026-08-27):** pertencem à 099, **independente da 098** —
sem coordenação nem dependência entre as duas specs.

**Esta fase é a que a regra pétrea governa.** Antes de corrigir, responder medindo:
o defeito existe fora do `mesas`? Onde a correção impede a recorrência? Entrega do tipo
"ajustei os N valores do `mesas`" reprova A7.

**Trava de autorização:** mudança em `packages/ui` exige aprovação nominal da ação e
verificação de impacto nos consumidores (AGENTS.md §Autorização). Chegar com o conserto
medido e pronto, pedir a aprovação da ação — não apresentar o achado como bifurcação.

---

## O que este plano deliberadamente não faz

- **Não cria campo, migration nem vocabulário novo** (D1).
- **Não mexe no sistema de avaliações.** D3: seção mantida; trade-off registrado em spec
  §4.
- **Não assume que o perfil deve encolher.** 5,55 telas é sintoma, não diagnóstico: a
  098 §6.7 mediu que a resposta da literatura para densidade é agrupar, não cortar. Se a
  fase B acrescentar preenchimento, a página pode legitimamente crescer.
