# 025 — Programa Lighthouse e Qualidade Publica

- **Modulo/Pacote:** apps/site, apps/glossario, apps/mesas, packages/ui, packages/content, infra
- **Gate relacionado:** D por projeto; Gate C continua fora de escopo

## Problema

Os anexos Lighthouse recebidos em 2026-06-15 mostram resultado ruim em paginas publicas/beta:

- `mesasbeta`: Performance 43, Accessibility 91, Best Practices 77, SEO 92.
- `glossariobeta`: Performance 5, Accessibility 90, Best Practices 73, SEO 92.
- `beta.artificiorpg.com`: Performance 62, Accessibility 95, Best Practices 73, SEO 100.

As execucoes estao poluidas por extensoes do navegador e estado local (`Chrome extensions negatively affected this page's load performance`, storage/IndexedDB), entao os scores brutos nao podem virar meta operacional sozinhos. Ainda assim, os relatórios trazem problemas reais de primeira parte:

- JS/CSS bloqueando renderizacao e main thread longa em SPAs.
- Bundle inicial grande, em especial glossario.
- `/api/terms` grande e no caminho critico do glossario.
- Imagens sem responsividade suficiente no site.
- Layout shift por imagens/logos sem dimensao reservada.
- Acessibilidade: contraste, nomes acessiveis, alvos de toque, links indistinguiveis.
- `robots.txt` invalido em hosts de apps.
- Headers de seguranca/politica ausentes ou fracos.
- Dependencias de terceiros/analytics/beacons sem auditoria unica.

## Diretriz de compartilhamento

Todos os projetos devem compartilhar o **contrato comum real e aprovado**, nao o CSS local bruto de um app nem um design system especulativo.

Quando um problema de Lighthouse revelar um padrao comum necessario, o caminho e:

1. provar o problema em consumidor real;
2. criar primitiva/contrato compartilhado pequeno;
3. migrar uma fatia piloto;
4. validar metrica, acessibilidade e regressao visual;
5. so entao expandir para outros consumidores.

## Requisitos

1. O programa deve separar ruido de ferramenta de problema de produto, com execucao Lighthouse limpa, reproduzivel e versionada.
2. Cada app publico (`site`, `glossario`, `mesas`) deve ter baseline proprio, mobile e desktop, com artefatos JSON/HTML preservados.
3. Toda correcao deve declarar qual metrica melhora: LCP, FCP, TBT/INP, CLS, acessibilidade, Best Practices ou SEO.
4. Qualquer mudanca em `packages/*`, infra, headers, robots, analytics ou contrato publico deve seguir SDD Completo.
5. O site publico Astro deve preservar zero-JS de shell; scripts/islands so entram quando a funcao exigir.
6. SPAs podem continuar React, mas devem reduzir JS inicial, trabalho de main thread e chamadas criticas antes da primeira interacao.
7. Imagens publicas devem ter dimensoes reservadas, formatos/tamanhos adequados, `srcset`/`sizes` quando aplicavel e prioridade correta.
8. `robots.txt`, sitemap, canonical e meta SEO devem ser validos por host/subdominio, sem tocar raiz WordPress antes do Gate C.
9. Headers de seguranca devem ser tratados por contrato infra/app, com cuidado para nao quebrar OAuth, admin, assets, Cloudinary, Pagefind ou WP raiz.
10. Acessibilidade deve mirar WCAG AA praticavel: contraste, nome acessivel, foco, alvo de toque e links distinguiveis.

## Critérios de aceite

- Harness Lighthouse limpo documentado e executavel, sem extensoes do navegador do mantenedor.
- Baseline inicial refeito para `beta`, `glossariobeta` e `mesasbeta`, com 3 execucoes por alvo e mediana registrada.
- Backlog de qualidade criado com fatias independentes e ordem recomendada.
- Cada fatia tem prova de fechamento: build/test, Lighthouse/axe quando aplicavel, busca final (`rg`) e sessao atualizada.
- Nenhuma pendencia nova fica so no chat.

## Fora de escopo

- Cutover da raiz `artificiorpg.com` ou desligar WordPress.
- Deploy, VM write, DNS/tunnel write, commit/push sem aprovacao nominal.
- Reescrever todos os apps de uma vez.
- Copiar o layout completo de um app para outro sem evidencia de contrato comum.
- Instalar dependencia nova sem aprovacao quando exigido.

## Riscos e impacto em outros modulos

- Correcoes de headers/CSP podem quebrar OAuth, analytics, Cloudinary, Pagefind, admin ou assets inline.
- Reduzir bundle SPA pode mudar timing de auth, cache e busca.
- Otimizacao de imagem pode afetar SEO/social preview se alterar URLs canonicas ou OG.
- Migrar UI para `packages/ui` pode aumentar blast radius; usar piloto pequeno.
- Resultados Lighthouse podem variar; usar mediana e ambiente limpo.
