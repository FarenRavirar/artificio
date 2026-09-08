# 024 — Auditoria documental de specs, tasks e backlog
- **Modulo/Pacote:** governanca documental
- **Gate relacionado:** nenhum

## Problema
O mapa `specs/backlog.md`, os `tasks.md`, `specs/README.md`, `project-state.md` e as sessoes podem divergir apos varias execucoes, promocoes e decisoes posteriores. Isso cria risco de agentes seguirem instrucao documental antiga, reabrirem debito fechado ou deixarem pendencia acionavel presa em spec/sessao.

## Requisitos
1. Auditar tasks e debitos com busca inteligente, sem transformar grep bruto em backlog.
2. Comparar backlog, tasks, sessoes, `project-state.md` e decisoes recentes, preferindo evidencia mais nova.
3. Separar ativo de fechado, absorvido, futuro, validacao e bloqueado.
4. Registrar quando tarefa/spec antiga foi superada por decisao posterior ou outro caminho.
5. Reforcar regra de manutencao documental no topo dos arquivos que agentes leem primeiro.

## Criterios de aceite
- `specs/backlog.md` representa pendencias acionaveis atuais, com origem, escopo, falta para fechar e proximo passo.
- Specs com tasks abertas relevantes possuem linha no backlog ou justificativa de historico/fora de escopo.
- Itens fechados em `project-state.md`/sessoes recentes nao permanecem como ativos.
- Sessao da auditoria registra buscas, decisoes e validacao.
- Buscas finais confirmam ausencia de divergencias conhecidas.

## Fora de escopo
- Implementar debitos de produto, infra, UI ou codigo.
- Commit, push, PR, deploy, VM write, DNS/Cloudflare ou SQL write.
- Reescrever historico antigo sem necessidade operacional.

## Riscos e impacto em outros modulos
- Risco baixo: mudancas documentais locais.
- Risco principal: classificar item aberto como fechado por leitura incompleta. Mitigacao: preferir sessao mais recente e manter itens duvidosos como `validacao`, `futuro` ou `bloqueado`.
