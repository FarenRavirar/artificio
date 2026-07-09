# Tasks — Spec 062

## F1 — Mesas

- [x] S1 — Localizar schema/migrations/tipos de sistemas e edições.
- [x] S2 — Mapear CRUD/admin, APIs e validações.
- [x] S3 — Mapear consumidores frontend/backend e relações de domínio.
- [x] S4 — Registrar dados-semente, IDs, aliases, hierarquia e constraints.

## F2 — Glossário

- [x] G1 — Localizar schema/migrations/tipos de sistemas e edições.
- [x] G2 — Mapear CRUD/admin, APIs e validações.
- [x] G3 — Mapear consumidores frontend/backend e relações de domínio.
- [x] G4 — Registrar dados-semente, IDs, aliases, hierarquia e constraints.

## F3 — Comparação

- [x] C1 — Matriz campo/status/ID/semântica.
- [x] C2 — Mapa de consumidores e contratos API.
- [x] C3 — Duplicatas, conflitos, lacunas e compatibilidade.

## F4 — Arquitetura

- [x] A1 — Comparar ownership/localização/serviço/API/cache/projeções.
- [x] A2 — Threat model, disponibilidade e blast radius.
- [x] A3 — Propor decisão recomendada e alternativas.

## F5 — Decisões

- [x] D1 — Definir superfícies de administração: site/sidebar como principal; mesas/glossário/downloads também podem administrar pelo serviço central.
- [x] D2 — Produzir recomendação fundamentada sobre owner/host, API×projeção, cenários e sugestões.
- [x] D3 — Obter decisões do mantenedor para o pacote arquitetural.

## F6–F8 — Saída

- [x] O1 — Modelo canônico conceitual.
- [x] O1a — Contrato de capacidades administrativas compartilhadas e integração da sidebar do site.
- [x] O1b — Definir fronteira semântica e tratamento de cenários.
- [x] O1c — Definir API central integral, sem projeções locais.
- [x] O2 — Plano de migração/rollout/rollback.
- [x] O2a — Planejar reescrita do subsistema de sistemas/edições do glossário e remoção segura do CRUD local.
- [x] O2b — Definir prova de integridade dos termos: contagem, mapeamento, órfãos zero e rollback.
- [x] O2c — Plano de UUIDs legados e validação dos 1.265 nós do Mesas.
- [x] O2d — Compatibilidade temporária das APIs e payloads históricos.
- [x] O2e — Disponibilidade, falhas, propagação e separação beta/prod.
- [x] O3 — Testes, gates e critérios de aceite conceituais.
- [x] O4 — Organizar duas etapas na própria 062: investigação e código.
- [x] O5 — Atualizar backlog, specs README, project-state e sessão.

## Etapa II — código

- [ ] I0 — Detalhar fases executáveis, critérios de aceite, arquivos, migrations, APIs, testes, deploy e rollback.
- [ ] I1 — Fundação do serviço/banco/API central dentro do `artificiorpg.com`.
- [ ] I2 — Modelo completo e importação do catálogo Mesas.
- [ ] I3 — Gestão principal na sidebar do Site.
- [ ] I4 — Migrar Mesas para leitura/escrita integral no serviço central.
- [ ] I5 — Mapear manualmente sistemas/edições do Glossário e migrar referências.
- [ ] I6 — Administração contextual pelos projetos consumidores.
- [ ] I7 — Compatibilidade, observabilidade, beta, rollback e produção.

## Bloqueio

- Etapa I concluída e aprovada; zero pergunta arquitetural bloqueante.
- Nenhum código começa antes de I0 transformar decisões em plano executável verificável.
