# Débitos — 052 Automação Inteligente de Importação de Mesas

> **Começa zerado.** Spec de roadmap futuro/opcional. Débito = só o que aparecer durante implementação real (quando/se algum bloco for ativado). Itens herdados da 048 que pertencem a esta spec:

- **De 048 DEB-048-02** (automação diária exige desenho seguro) → coberto por Bloco A (R2/R3).
- **De 048 DEB-048-05** (script DiscordChatExporter local inseguro) → coberto por TA.2 (versão pinada, token fora de argv).
- **De 048 DEB-048-06** (fallback DeepSeek/IA) → coberto por Bloco B Degrau 1 (IA com schema/timeout/privacidade).
- **De 048 T-C4/C5/C7/C8/C9 + T-B5** (melhorias opcionais de parser "fora do PR-1") → **Bloco C (R15–R20, final da spec)**, transferidas por decisão do mantenedor (2026-06-27). Determinísticas, não bloqueiam A/B.

> **Coordenação Fase E ↔ 053:** a Fase E da 048 (ingestão VM) também ficou ao final da **spec 053 (Frente E)**, que tem prioridade. O **Bloco A** desta spec só roda se a 053 não entregar a ingestão. Não duplicar.

## Débitos ativos

- **DEB-052-01 — ✅ RESOLVIDO (2026-06-30, local, não commitado) — `cleanLabelLine` perdia labels decorados (parser hardening, não-IA).** `parseDiscordAnnouncement.ts:493`. **Fix:** ordem `**`→decoração corrigida, classe de bullets ampliada + emoji, guard `http(s)` no split, URL não-continuação. + `slotsViaLabel` fallback. TC.7/TC.8 fechados. Corpus real: `slots_total` 34→18; sistema decorado recuperado. 90 testes parser + 319 backend verdes. **Resíduo separado (não é este débito):** `start_time` (39) e `day_of_week` (19) faltantes são format-hard, não decoração — fatia futura se priorizada. Dois defeitos: (a) não remove `»` nem bullets/emoji unicode comuns no template da comunidade; (b) ordem `strip-decoração (▬•-–—) → remove **` deixa `▬` órfão em `**▬ label`. Consequência: labels que **já estão** nas listas de sinônimo (sistema/vagas/data) não casam quando decorados.
  - **Evidência (análise read-only dos JSONs reais `temp/exemplo26.06.json` + `temp/extracao_json.json`, 200 msgs / 167 drafts, 2026-06-30):** 100% dos drafts disparam `missing_fields` (IA dispararia em todos). Com `cleanLabelLine` atual sobram não-reconhecidos `▬ sistema` 24, `» sistema` 24, `» vagas disponiveis` 24, `» dias e horarios da mesa` 23. Com cleaner corrigido colapsam em conjunto estável: slots (`vagas disponiveis` 58 + `vagas` 33 + `vagas totais` 26 + `nº de vagas` 21 ≈ 138), dia/hora (`dias e horarios da mesa` 25 + `data e hora` 24 + `data & horario` 12 ≈ 61), plataforma ~78, local ~80.
  - **Origem:** investigação D087 (aprendizado de campo faltante). Veredito: campo faltante é majoritariamente problema de parser (decoração + sinônimo curto), **não** de IA/learning-store.
  - **Próximo passo:** TC.7 (corrigir `cleanLabelLine`) + TC.8 (expandir listas de sinônimo), ambos com fixture de regressão dos 2 JSONs reais. Learning-store por raw text fica como resíduo adiado (baixo ROI pós-fixes — DEB-052-02).
  - **Ruído a tratar junto:** linhas `https:` casam como label (`https` 20) — guardar contra chaves `http`/`https` no split.

- **DEB-052-02 — Learning-store por raw text para campo faltante = resíduo adiado.** A peça original do D087 (aprender campo faltante chaveado por texto cru) só ajuda anúncios free-form fora do template, com alto risco de falso-positivo. Após TC.7/TC.8 cobrirem o template, o ROI cai. Adiado; reabrir só se, pós-fixes determinísticos, a taxa de `missing_fields` em anúncios não-template ainda justificar. Abordagem preferida quando reaberto: aprender sinônimo de label (não cache fuzzy de texto).

## Débitos transferidos para a 057 (D1–D10)

> CodeRabbit encontrou 10 débitos em arquivos do backend DCE durante o review do PR #120 (spec 057). Esses débitos pertencem a esta spec (052) mas foram registrados como **DEB-057-08 a DEB-057-17** no `specs/057-mesas-gestao-redesign/debitos.md`. Serão tratados na **Fase 6 da 057** (absorção do DCE).
>
> Resumo: D1 cookies inválido, D2 path traversal, D3 SIGKILL fallback, D4 allowedBaseDir escape, D5 cleanup sem try/catch, D6 limit inválido, D7 regex time frouxo, D8 updateSchema sobrescreve defaults, D9 truncamento não sinalizado, D10 visibilidade de status.
