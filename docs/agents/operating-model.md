# Modelo de Operação — quando usar cada nível de SDD

Escolha o **menor** processo que controle o risco. Em dúvida, suba um nível.

## Árvore de decisão

1. **Toca `packages/*` (auth, ui, analytics, config, content, crosslink), infra (Cloudflare Tunnel/DNS), `accounts.` (SSO), CI/CD, migration, banco, permissões, dados pessoais, upload/Cloudinary, importador WP, contrato público/API, SEO estrutural, ou é feature/refator grande?**
   → **SDD Completo.** Sempre. Tudo que é compartilhado ou de alto risco.

2. **É bug moderado, feature pequena ou ajuste localizado dentro de UM `apps/*`, sem tocar compartilhado?**
   → **SDD Lite.**

3. **É pergunta, ajuste de documentação, correção pontual sem risco?**
   → **Sem SDD.**

## Artefatos por nível

| Nível | Artefatos |
|---|---|
| Sem SDD | sessão + evidência |
| SDD Lite | mini-spec (problema, solução, escopo) + checklist + evidência + sessão |
| SDD Completo | `specs/NNN-<modulo>-<slug>/` com `spec.md` + `plan.md` + `tasks.md` + validação + sessão |

## Fluxo SDD Completo

`spec → plan → tasks → implement`, atualizando a sessão continuamente.

- **spec.md** — o quê e por quê. Problema, requisitos, critérios de aceite, fora de escopo. Sem solução técnica.
- **plan.md** — como. Arquitetura, arquivos afetados, contratos, riscos, rollback, impacto em outros módulos.
- **tasks.md** — passos executáveis e verificáveis, em ordem, com critério de "feito".
- **implement** — executar tasks, registrar evidência, fechar checklist.

Quando houver PR, criar `pr-description.md`: sumário executivo, evidências de teste, checklist pós-merge.

## Numeração de specs

`specs/NNN-<modulo>-<slug>/`. Ex: `001-infra-backup-runbook`, `002-monorepo-bootstrap`, `010-site-importador-wp`, `020-srd-tooltips`. `NNN` é sequencial global; `<modulo>` ancora o escopo.

## Regra de ouro do monorepo

Escopo isolado num módulo → pode ser Lite. Qualquer toque no compartilhado → Completo + smoke dos consumidores. Nunca ampliar escopo pra outro módulo/pacote sem aprovação.
