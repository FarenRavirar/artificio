# Auditoria 080 — código, Git e produção

Data: 2026-07-23

## Resultado executivo

A spec 080 foi implementada para `site`, `mesas` e `glossario`. O `tasks.md` registra smoke real em produção para sitemaps, OG e GSC, além de lint/build/API verdes. O histórico Git confirma a linha de implementação e seus merges em `origin/dev` e `origin/main`. Portanto, diferente da 081, há evidência documental explícita de produção; ainda assim, este inventário não reexecuta HTTP/GSC hoje.

## Matriz

| Entrega | Código | Produção | Veredito |
|---|---|---|---|
| Sitemap Mesas | rota backend + proxy nginx | `200 application/xml`, mesas reais | concluído |
| Sitemap Glossário | rota backend, só verbetes verificados | `200`, XML válido | concluído |
| Sitemap Site | Astro `sitemap-index.xml`; robots aponta nome correto | `200`, índice e conteúdo completos | concluído; `/sitemap.xml` 404 é esperado |
| OG Mesas | `og.ts` + detecção crawler nginx | preview real em Discord/WhatsApp | concluído |
| OG Glossário | SSR por verbete + fallback + proxy crawler | preview real em Discord/WhatsApp | concluído |
| OG Site | fallback no `Base.astro`, artigo mantém imagem própria | preview real de `/blog/` e artigo | concluído |
| Search Console | domínio verificado; propriedades obsoletas removidas | 3 sitemaps submetidos | concluído |
| Qualidade | ESM/NodeNext, assets runtime, headers/proxy, guards | `verify:api`, lint/build verdes | concluído no aceite registrado |

## O que foi para produção

- Código dos PRs/merges da 080 presente em `origin/dev` e `origin/main` (histórico: PRs #174–#178 e commits associados).
- Sitemaps reais nos três projetos.
- OG real para Mesas, Glossário e Site.
- Configuração operacional do Search Console e submissão dos sitemaps, confirmada pelo mantenedor.
- Correções pós-review necessárias para runtime ESM, cópia de assets e proxy crawler.

## Limites

1. `/sitemap.xml` do Site permanece 404 por decisão correta: Astro serve `/sitemap-index.xml`, e `robots.txt` aponta para ele.
2. O aviso `fb:app_id` de Mesas foi conscientemente aceito como fora de escopo; não impede preview Discord/WhatsApp.
3. O sitemap de Glossário não inclui `/termo/:id`, pois a SPA não possui detalhe público real.
4. Esta auditoria usa evidências registradas na spec/sessão; não afirma nova verificação live em 2026-07-23.

## Conclusão

Spec 080: **implementada, mergeada e registrada como em produção**, com os limites acima. Não há gap técnico aberto dentro do aceite 080; futuras páginas públicas do Glossário e novos projetos exigem specs próprias.
