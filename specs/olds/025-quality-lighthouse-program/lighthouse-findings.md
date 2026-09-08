# Achados Lighthouse — anexos 2026-06-15

## Nota de confiabilidade

Os tres relatórios avisam que extensoes do Chrome afetaram performance. Portanto:

- scores brutos nao devem ser usados como meta final;
- achados de extensoes (Quillbot, HoverZoom, jQuery de extensao, DevTools etc.) nao sao debito do produto;
- achados de primeira parte continuam validos quando apontam asset/API/CSS/HTML do Artificio.

Conclusao: refazer baseline com harness limpo e obrigatorio antes de fechar qualquer metrica.

## `mesasbeta.artificiorpg.com`

Scores anexados:

- Performance 43
- Accessibility 91
- Best Practices 77
- SEO 92

Metricas:

- FCP 4.0s
- LCP 4.7s
- TBT 6140ms
- CLS 0.012
- Speed Index 4.2s

Achados de primeira parte:

- CSS render-blocking:
  - `/assets/index-C4rrafOr.css` 32.9 KiB, ~1000ms
  - `/assets/vendor-re....css` 12.8 KiB, ~240ms
- Cadeia critica:
  - navegacao inicial ~426ms
  - `/assets/index-eaVJPdHV.js` 309.74 KiB em ~709ms
  - CSS principal e vendor no caminho critico
- Main thread ~12.6s total; parte relevante:
  - script evaluation ~6365ms
  - parse script ~1611ms
- JS first-party unused:
  - 429.1 KiB transfer
  - 303.5 KiB savings estimado
  - app JS 304.8 KiB, ~237 KiB unused
  - vendor React 124.3 KiB, ~66.6 KiB unused
- Image delivery: economia estimada ~530 KiB.
- Acessibilidade:
  - contraste insuficiente;
  - touch targets pequenos;
  - links com mesmo texto/finalidade ambigua.
- Best Practices:
  - APIs depreciadas;
  - source maps ausentes;
  - CSP/HSTS/COOP/XFO/Trusted Types ausentes/fracos.
- SEO:
  - `robots.txt` com 42 erros.

Debitos derivados:

- `BL-QA-MESAS-PERF`
- `BL-QA-A11Y-SWEEP`
- `BL-QA-ROBOTS-SEO`
- `BL-QA-SECURITY-HEADERS`

## `glossariobeta.artificiorpg.com`

Scores anexados:

- Performance 5
- Accessibility 90
- Best Practices 73
- SEO 92

Metricas:

- FCP 8.3s
- LCP 12.8s
- TBT 2300ms
- CLS 0.652
- Speed Index 8.3s

Achados de primeira parte:

- CSS/font render-blocking:
  - Google Fonts CSS ~1.0 KiB, ~850ms
  - `/assets/index-DEbhBPrc.css` 43.2 KiB, ~500ms
- CLS:
  - `footer.artificio-footer` ~0.647
  - `img.artificio-footer-logo` sem dimensao reservada
  - `div.artificio-session` ~0.005
- Cadeia critica:
  - navegacao inicial ~626ms
  - `/assets/index-DHKaioVW.js` 1141.57 KiB em ~777ms
  - `/api/terms` 612.59 KiB em ~1892ms
  - chamadas `auth/me` em accounts e glossario ~1.4-1.6s
  - CSS principal 43.19 KiB
  - Google Fonts CSS/fontes ~21+47 KiB
- Main thread ~12.1s total:
  - script evaluation ~5767ms
  - parse script ~1368ms
- JS first-party unused:
  - 1139.1 KiB transfer
  - 761.2 KiB savings estimado
- CSS unused:
  - ~28.2 KiB savings estimado
- Acessibilidade:
  - botoes sem nome acessivel;
  - contraste insuficiente;
  - links iguais com finalidade distinta.
- Best Practices:
  - APIs depreciadas em `main.js`/terceiro;
  - erro de console relacionado a recurso Cloudflare bloqueado pelo cliente;
  - source maps ausentes;
  - CSP/HSTS/COOP/XFO/Trusted Types ausentes/fracos.
- SEO:
  - `robots.txt` com 37 erros.

Observacao local:

- `packages/ui/src/styles.css` ja nao tem `@import` Google Fonts depois da B12.
- `apps/accounts/frontend/src/styles.css` ainda tem Google Fonts, fora do shell publico/site.
- Busca local nao confirmou Google Fonts no codigo atual do glossario; pode ser build beta stale, CSS gerado antigo ou fonte indireta. A spec deve exigir `rg`, HTML/CSS live e Lighthouse limpo antes de corrigir.

Debitos derivados:

- `BL-QA-GLOSSARIO-PERF`
- `BL-QA-SHELL-CLS`
- `BL-QA-A11Y-SWEEP`
- `BL-QA-ROBOTS-SEO`
- `BL-QA-SECURITY-HEADERS`

## `beta.artificiorpg.com`

Scores anexados:

- Performance 62
- Accessibility 95
- Best Practices 73
- SEO 100

Metricas:

- FCP 2.0s
- LCP 3.1s
- TBT 6710ms
- CLS 0
- Speed Index 2.4s

Achados de primeira parte:

- Image delivery: economia estimada ~472 KiB.
- Cards Cloudinary servem imagens muito maiores que o tamanho exibido:
  - banner 1200x677 exibido ~362x205, ~142.5 KiB savings.
  - Glossario 1200x800 exibido ~362x241, ~121.9 KiB savings.
  - outras imagens 76-78 KiB cada exibidas ~362x241.
- Render-blocking requests: economia estimada ~480ms.
- Main thread ~10.0s, mas grande parte poluida por extensoes.
- Primeira parte observada:
  - documento inicial ~1212ms CPU;
  - `main.js`/beacon ~414ms, provavelmente Cloudflare/terceiro.
- Imagens sem width/height:
  - `img.artificio-footer-logo.logo-neg` data-uri.
- Acessibilidade:
  - contraste em `a.see-all` e body.
- Best Practices:
  - APIs depreciadas em script terceiro;
  - recurso Cloudflare bloqueado;
  - CSP/HSTS/COOP/XFO/Trusted Types ausentes/fracos.
- SEO:
  - score 100 no anexo.

Observacao local:

- `apps/site/src/components/SiteFooter.astro` renderiza logos sem `width`/`height`.
- `apps/site/src/components/Card.astro` usa `<img src={post.image} alt="" loading="lazy" />`, sem `width`/`height`, `srcset` ou `sizes`.
- `apps/site/src/pages/blog/[slug].astro` tem `width="1200"`/`height="630"` no cover, mas ainda nao usa transform responsivo.

Debitos derivados:

- `BL-QA-SITE-IMAGES`
- `BL-QA-SHELL-CLS`
- `BL-QA-A11Y-SWEEP`
- `BL-QA-SECURITY-HEADERS`
- `BL-QA-THIRD-PARTY`

## Achados transversais

### Medicao

Problema: relatórios foram tirados em ambiente com extensoes.  
Acao: criar harness limpo antes de fechar score.

### Compartilhamento

Problema: nem toda classe local dos apps esta coberta pelo CSS compartilhado.  
Acao: compartilhar somente contratos comprovados, nao tentar cobrir todo CSS local em um golpe.

### Fontes

Problema: B12 removeu Google Fonts do CSS compartilhado/site, mas Lighthouse ainda viu Google Fonts no glossario.  
Acao: validar build vivo e grep. Se for residual real, abrir fatia por app. Se for build stale, registrar evidencia.

### Robots

Problema: Lighthouse acusou `robots.txt` invalido em glossario/mesas.  
Hipoteses:

- host SPA retorna `index.html` para `/robots.txt`;
- content-type errado;
- helper de robots gera diretiva que Lighthouse nao aceita;
- ambiente beta/prod stale.

Acao: spec propria com `curl -i`, conteudo bruto, validador e smoke por host.

### Headers

Problema: CSP/HSTS/COOP/XFO/Trusted Types aparecem ausentes.  
Acao: spec infra/app separada. Cuidado com OAuth, Cloudinary, Pagefind, analytics e WP raiz.

### Analytics/terceiros

Problema: relatórios misturam extensoes, Cloudflare beacon e scripts do produto.  
Acao: inventario de terceiros por host; decidir se Cloudflare Web Analytics/RUM fica; glossario/mesas devem convergir para `@artificio/analytics` quando aplicavel.
