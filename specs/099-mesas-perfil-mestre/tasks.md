# Tasks 099 — Perfil do mestre

**Status: grill concluído (2026-08-27); decisões D1-D5 resolvidas. NENHUMA TASK
EXECUTADA.**

---

## Tasks destravadas pelo grill

| # | task | fase | decide |
|---|---|---|---|
| T1 | Fechar o inventário de campos do perfil **sobre os campos existentes** | A | D1 decidida: sem campo novo |
| T3 | Editor: campo para cada item do inventário (3 telas mantidas) | B | D1, D5 decididas |
| T4 | Dobra da página pública: `tagline` + etiquetas de atributos, fallback para a headline atual | C | D2 decidida por pesquisa |
| T6 | Remover o campo `Preço Médio` do front (editor); banco/migration intactos | B | D4 decidida |
| T7 | Fazer as 3 telas funcionarem juntas: prévia do perfil público em cada uma | B | D5 decidida |

## Tasks encerradas pelo grill (sem trabalho)

| # | task | motivo |
|---|---|---|
| T2 | Migration, se D1 exigir campo novo | **cancelada** — D1: modelo não mexe, sem migration |
| T5 | Seção de Avaliações sem avaliações | **cancelada** — D3: manter como está; trade-off registrado em spec §4 |

## Conserto — não depende de decisão, mas depende de autorização

Entram seja qual for a resposta do grill (spec §5). Cada um exige aprovação nominal da
**ação** quando tocar `packages/*`.

| # | task | onde | trava |
|---|---|---|---|
| T8 | Uma fonte só para "anos de experiência" (C1) | `mesas` | — |
| T9 | Normalizar `selling_points` na fronteira (C2) | investigar a causa antes | — |
| T10 | Indicador de autosave visível em página longa (C3) | `mesas` (CSS) | — |
| T11 | Alvos < 24px: `Manter link direto`, nav, rodapé (C4, C5) | **`packages/ui`** | aprovação + impacto |
| T12 | Largura de campo por tamanho de resposta (C6) | componente de campo | aprovação + impacto |
| T13 | Escala de altura de campo (C7) | componente de campo | aprovação + impacto |
| T14 | Vãos de seção com regra (C8) | `mesas` | — |
| T15 | Listar os sistemas escolhidos, não só contar (C9) | `mesas` | — |

**Decisão de escopo (grill, 2026-08-27):** T11-T13 pertencem à 099, **independente da
098** — sem coordenação nem dependência entre as duas specs.

## Medição obrigatória antes de fechar qualquer task

- Teste que falha sem a correção, **verificado reintroduzindo o defeito** (A9).
- Para T11-T13: a resposta medida de *onde este defeito pertence* (A7), e o cruzamento
  com os outros apps (A8).
- Medição antes/depois nos 20 perfis reais, não só no `mestre-hermes` (A10).
- Mobile (719px) e tema claro — **não medidos nesta investigação**, precisam entrar.

## Pendências desta investigação

| o quê | estado |
|---|---|
| causa de `selling_points` voltar `{}` em 7/20 perfis | **não medida** |
| comportamento da página com perfil cheio | **impossível hoje** — nenhum dos 20 está preenchido |
| mobile e tema claro | **não medidos** |
