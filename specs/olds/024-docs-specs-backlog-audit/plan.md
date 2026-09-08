# Plano — 024

## Arquitetura da solucao
Auditoria documental em camadas:

1. Ler T0 e mapas centrais.
2. Usar `rg` para localizar tasks abertas, status divergentes e termos de pendencia.
3. Abrir arquivos completos apenas quando a busca indicar risco real.
4. Atualizar backlog/README/sessoes/project-state com estado consolidado.

## Arquivos afetados
- `specs/backlog.md`
- `specs/README.md`
- `specs/024-docs-specs-backlog-audit/*`
- `sessoes/26-06-15_2_docs-specs-backlog-audit.md`
- `sessoes/index.md`
- `.specify/memory/project-state.md`, se o estado operacional documental mudar.
- `AGENTS.md` e `.agents/skills/new-spec/SKILL.md`, se a regra de manutencao precisar reforco.

## Contratos/interfaces tocados
Nenhum contrato runtime. Apenas governanca documental.

## Impacto em consumidores
Afeta agentes futuros: reduz retrabalho, evita instrucao stale e torna `specs/backlog.md` a fila acionavel.

## Rollback
Reverter os arquivos documentais alterados antes de qualquer commit. Sem deploy ou mudanca externa.

## Validacao
- `git diff --check`.
- `rg` para tasks abertas e itens sem backlog.
- `rg` para confirmar referencias a `specs/backlog.md`.
- Revisao manual dos gaps encontrados.
