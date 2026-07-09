# Plano — Spec 062

**Estado:** investigação concluída; implementação não iniciada.

## Fases da investigação

1. Inventário material de `mesas`.
2. Inventário material de `glossario`.
3. Comparação, consumidores e dados reais beta/prod.
4. Ownership, localização, host e trust boundaries.
5. API central integral, dependência direta, disponibilidade e cache transitório.
6. Modelo canônico, fronteira semântica, sugestões, permissões e auditoria.
7. Mapeamento de UUIDs e validação do catálogo principal Mesas.
8. Migração do glossário e preservação dos termos.
9. Compatibilidade, disponibilidade, propagação e falhas.
10. Rollout beta/prod, rollback e provas.
11. Aprovação do mantenedor.
12. Preparação da etapa de código na própria Spec 062.

## Recomendação

Serviço independente com DB próprio, oferecido e gerido pelo `artificiorpg.com`. Gestão principal no admin do Site/sidebar; Mesas, Glossário e Downloads administram como clientes.

Leitura e escrita integrais no serviço central, sem projeções locais. Mesas é catálogo principal correto e base canônica. Glossário mapeia manualmente seus 12 sistemas/17 edições e migra as referências dos termos.

## Etapa II — implementação futura nesta spec

1. Fundação central.
2. Modelo e importação integral do catálogo Mesas.
3. Gestão principal no site.
4. Migração do Mesas para consumo central.
5. Reescrita/migração glossário.
6. Administração distribuída e entrada de downloads.
7. Hardening/remoção de legado.

## Gates

- arquitetura aprovada antes da etapa de código — cumprido;
- IDs e mapa curados antes de consumidores;
- shadow/read beta antes de qualquer cutover;
- contagens, órfãos zero e equivalência antes de remover legado;
- rollback exercitado em beta;
- prod repete esteira canônica, sem snowflake.
