# 059 — Reviews

> Somente reviews externos: mantenedor, bots, PRs ou checks. Achados internos entram em `debitos.md`.

## 2026-07-08 — mantenedor

- Pedido inicial: criar spec para copiar anuncio de mesa em formato WhatsApp a partir da pagina publica, painel do mestre e gestao; corrigir Open Graph da mesa para mostrar banner no preview.
- Ajuste de processo: spec deve ser **SDD Completo**, pois "sem que vai ter problemas".
- Decisoes de produto: sistema deve ser so sistema; setting e DDAL entram na descricao; inscricoes deve ser so link da mesa; campos vazios devem permanecer vazios; objetivo e gerar texto completo para o humano nao editar.
- Pedidos de aprofundamento: faixa etaria (`audience` vs `age_rating`) e comissionada (`price_type=paga` vs nuance comercial).
- Decisao final de comissionada: `price_type=paga` vira "Comissionada" apenas na saida copiar/colar; dado interno continua `paga`.
