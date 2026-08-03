# 26-08-03_1 · Segurança — Snyk: headers HTTP e achados SAST

**Data:** 2026-08-03
**Escopo:** transversal — `apps/accounts`, `apps/downloads`, `apps/glossario`, `apps/links`, `apps/mesas`, `apps/site` + infra Cloudflare
**Origem:** achados Snyk (DAST + SAST) trazidos pelo mantenedor
**Branch:** `fix/seguranca-snyk-headers-sast`, criada de `origin/dev` (`a0fe780`)
**Estado:** aberta · **A e B RESOLVIDOS em produção** (borda Cloudflare) · **C e D13 pendentes, para o Codex**
**Implementação:** A e B foram aplicados pelo Claude na borda Cloudflare via MCP, com autorização nominal por ação. **C e D13 são do Codex** e ainda não têm uma linha de código escrita.

> **Leia isto antes de agir.** As seções §A e §B descrevem trabalho **já executado e validado em produção** — são registro, não instrução. Não refazer. O que está pendente de implementação é **§C (XSS, 3 sinks)** e **§D13 (escrita arbitrária de diretório)**, com as investigações C1–C3 e D1 obrigatórias antes de qualquer código. Além disso, resta **um item de código do achado B** (§D6): remover 4 `add_header` do `nginx.conf` do `downloads` — destravado, a pré-condição foi cumprida.

> **Sessão excepcional.** Criada por pedido nominal do mantenedor em 2026-08-03, fora do fluxo de spec, porque os achados são transversais a 6 apps e não pertencem a nenhuma spec ativa.

---

## Método: por que houve dois passes

Claude fez a triagem inicial. O mantenedor pediu ao Codex uma análise independente, com prompt propositalmente livre dos vereditos do Claude — para que o Codex chegasse sozinho e a divergência tivesse valor.

Deu certo: **o Codex refutou uma premissa central do Claude e achou 3 coisas que o Claude não viu.** As correções estão marcadas abaixo. Este registro mantém o erro visível de propósito — o critério errado do Claude é reutilizável por qualquer agente e precisa ficar refutado por escrito.

**Regra desta sessão:** cada achado recebe **investigação própria antes de implementar**. Nenhum item vai direto para código, nem os CONFIRMADOS. Motivo: os dois passes discordaram em pontos de arquitetura, e a triagem trabalhou por leitura estática — sem captura HTTP, sem consulta ao banco de produção, sem execução. O que está abaixo é hipótese fundamentada, não verdade verificada.

---

## Placar do cruzamento

| Achado | Veredito Claude | Veredito Codex | Consolidado |
|---|---|---|---|
| A — HSTS | Procede, é infra | CONFIRMADO, camada = Cloudflare | **Procede — Cloudflare, não código** |
| B — Helmet ×6 | Procede; 2 grupos por "serve HTML pelo Express" | 6× INDETERMINADO; critério do Claude é falso | **Codex — ver §B** |
| C — XSS `window.open` | CONFIRMADO, 1 sink | CONFIRMADO, +2 sinks | **CONFIRMADO, 3 sinks** |
| D — file inclusion (24) | 0 confirmados; suspeita em `resolveRootDir:50` | 1 CONFIRMADO (D13), alvo diferente | **D13 procede** |

Total: **3 famílias confirmadas**, 23 falso-positivos, 6 indeterminados dependentes de captura HTTP.

### Correções que o Codex fez no Claude

1. **Critério de divisão do item B era falso.** Claude dividiu por "o Express serve HTML". O critério real é **onde o documento HTML sai**. Detalhe em §B.
2. **Alvo do D13 estava errado.** Claude suspeitou de `resolveRootDir:50`. O furo é anterior: `mkdir` roda antes da contenção. Detalhe em §D13.
3. **Dois sinks de XSS não vistos** (X1, X2). Detalhe em §C.
4. **Mecanismo do impacto do C estava impreciso.** Claude sugeriu comprometimento de sessão via cookie. O cookie é `HttpOnly` — não é leitura de cookie, é **ação autenticada em nome da vítima**, com o cookie sendo enviado automaticamente pelo browser. CSRF não protege porque o script roda same-origin.

### Correção que o Claude mantém sobre o Codex

Nenhuma refutação. Um complemento: o Codex identificou a falha em `gmPanel.ts:416` (X2) sem nomear a **causa raiz** — `gmPanel.ts` executa validação manual paralela ao `contactSchema` para os mesmos campos. Duas validações divergentes da mesma entidade explicam por que a falha aparece em dois lugares e reaparecerá no próximo campo. Ver §Aberto item 4.

---

## A · HSTS ausente — CONFIRMADO (infra, não código)

`https://artificiorpg.com` não emite `Strict-Transport-Security`. Confirmado por DAST.

**Camada correta: Cloudflare.** TLS termina no Tunnel. O Express pode adicionar o header às respostas do origin, mas não cobre respostas, redirects, cache e páginas de erro geradas na borda. Correção só em código não fecha o achado.

**Caminho de ataque:** primeiro acesso da vítima, atacante em posição de rede intercepta antes do browser conhecer a política, força/mantém HTTP. Downgrade e SSL stripping.

**Risco operacional — irreversível a curto prazo.** `includeSubDomains` atinge todos os `*.artificiorpg.com`. Qualquer subdomínio HTTP-only, com certificado inválido ou legado fica inacessível, e o `max-age` fica cacheado no browser do usuário — que não consegue limpar isso sozinho. `preload` é decisão separada e praticamente irreversível.

**Nota Helmet:** o `helmet()` default aplica `max-age=31536000; includeSubDomains`. Se o item B ligar Helmet em qualquer app sem desligar `hsts`, o header ganha múltiplos donos e o rollback do item A vira caçada. Ver §Aberto item 1.

**Ação:** executada na borda Cloudflare, via MCP, com autorização nominal do mantenedor. Registro completo abaixo.

### O que não tem volta — vale para os degraus restantes

Desligar HSTS é possível (apagar a regra, ou `Max Age Header = 0` no painel nativo). O que **não** se desfaz é o que **já foi cacheado no browser de quem visitou** — esses clientes seguem forçando HTTPS até o `max-age` original expirar, independentemente do que se faça no painel. Aviso textual da Cloudflare:

> "If you remove HTTPS before disabling HSTS or before waiting for the duration of the original Max Age Header specified in your Cloudflare HSTS configuration, your website becomes inaccessible to visitors for the duration of the Max Age Header or until you enable HTTPS."

Consequência que governa a escada: **o valor vigente define por quanto tempo um erro dói.** É por isso que a escada sobe por degraus em vez de ir direto a 1 ano.

**Duas correções de registro** (afirmações erradas em versões anteriores desta sessão, mantidas visíveis para não serem reintroduzidas):

1. ~~"O painel não aceita segundos arbitrários; só `Disable` ou 1 a 12 meses."~~ **Refutado.** Isso é limite do **dropdown da UI**, não da plataforma. Pela API, `security_header.strict_transport_security.max_age` é inteiro em segundos e aceita `300`. Transform Rule também aceita valor livre.
2. ~~"HSTS é irreversível."~~ **Impreciso.** Reversível na config; o que persiste é o cache já distribuído (acima).

**Mesmo assim, Transform Rule foi a escolha certa** — por um motivo melhor que o inicial: o `security_header` nativo **aplica na zona inteira, sem filtro de hostname**. Sem escopo não existe canário no apex nem a validação negativa que prova a contenção. O nativo só voltaria a ser candidato quando o alvo já fosse a zona toda.

### Investigação A — FECHADA (Codex, 2026-08-03)

**Estado medido.** 11 hostnames ativos, todos com HTTPS funcional e HTTP redirecionando 301 para HTTPS. **HSTS ausente em todos os 11:**

`artificiorpg.com` · `www.` · `accounts.` · `beta.` · `mesas.` · `mesasbeta.` · `glossario.` · `glossariobeta.` · `downloads.` · `downloadsbeta.` · `links.`

Sem DNS público: `esferas.`, `srd.`, `glossariorpg.`.

**Ressalva registrada pelo Codex:** isto não substitui inventário autoritativo no painel DNS — pode haver registro que o repositório desconhece. O passo de inventário continua obrigatório antes de `includeSubDomains`.

### Caminho de implementação — Transform Rule (executado)

Documentação: `https://developers.cloudflare.com/rules/transform/response-header-modification/create-dashboard/`

**Fase 1 — canário `sec-hsts-apex-canary`, `max-age=300`, escopo `(http.host eq "artificiorpg.com" and ssl)`: ✅ criada, validada e depois substituída pelo degrau 2.** Serviu ao propósito — provou que o escopo por hostname funcionava (apex recebeu, `accounts.`/`mesas.`/`www.` não). Não recriar.

A validação negativa (confirmar que um subdomínio **não** herdou) foi o passo que deu valor ao canário; fica registrada como técnica para qualquer mudança futura de header com escopo.

**Rollback:** apagar a regra. Pior caso de cache residual: 5 minutos.

### Escada posterior

**Divergência resolvida — mantenedor decidiu 3 degraus (2026-08-03).** O Codex propôs 5 (`300 → 86400 → 604800 → 2592000 → 31536000`); vale a escada de **3**:

| # | `max-age` | `includeSubDomains` | Pré-requisito |
|---|---|---|---|
| 1 | `300` (5 min) | não | canário no apex apenas |
| 2 | `86400` (1 dia) | **sim** | checklist de inventário abaixo fechado |
| 3 | `31536000` (1 ano) | sim | degrau 2 observado sem incidente |

Motivo: cada degrau custa uma ida ao painel, e a diferença de risco entre 7 e 30 dias não justifica um degrau próprio — se algo quebra, quebra no primeiro acesso, não no vigésimo dia. O degrau que carrega risco real é o `includeSubDomains`, não a magnitude do `max-age`.

`includeSubDomains` entra **apenas** no degrau intermediário (`86400`) e **apenas** após o inventário abaixo, nunca junto do canário.

**Checklist obrigatório antes de `includeSubDomains` ou de `31536000`:**
- DNS → Records: todo `A`/`AAAA`/`CNAME`/`MX`/`NS` e hostname terceirizado inventariado.
- Registros web estão **Proxied**.
- Nenhum hostname redireciona HTTPS→HTTP.
- Nenhuma delegação NS depende de serviço HTTP-only.
- Universal SSL ativo.
- Cloudflare não será pausado nem convertido para DNS-only enquanto o `max-age` estiver vigente.

`preload` continua **desligado**. Decisão separada, exige `max-age` de 12 meses e não se desfaz pelo painel.

---

## B · Helmet ausente — RESOLVIDO na borda (não com Helmet)

> **Desfecho:** os 6 subissues começaram INDETERMINADO, foram medidos (§Investigação B1) e resolvidos por Transform Rule na borda — **nenhum app recebeu Helmet**. Resta um item de código: §D6 (`downloads`). O resto desta seção é o raciocínio que levou até lá.

**Premissa refutada.** "Não usa Helmet" é ausência de biblioteca, não caminho source-to-sink. Não prova vulnerabilidade. A configuração efetiva do Cloudflare **não está versionada no repositório** — logo, o estado real dos headers não é determinável por leitura estática. Os 6 permanecem INDETERMINADO até haver captura HTTP.

**Erro do Claude, registrado.** A divisão proposta foi "API pura vs. serve HTML pelo Express", com `mesas`/`downloads`/`glossario` marcados como baixo risco. Falso. O que decide é **onde o documento HTML é servido**:

| App | Documento HTML sai de | Headers já existentes | Efeito de `helmet()` cru |
|---|---|---|---|
| `downloads` | **Nginx** (`frontend/nginx.conf`) | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` — `nginx.conf:15-18` | Não protege o documento. CSP em JSON acrescenta pouco |
| `glossario` | **Nginx** (`nginx.conf.template:14`) | Nenhum no template | Não cobre a SPA. Não resolve clickjacking do documento |
| `mesas` | **Nginx** (`frontend/nginx.conf:41`) | Nenhum de hardening | Cobre só as APIs, não o documento |
| `site` | Express (`server.ts:255`, `/admin` `:248`) | **CSP própria via meta Astro** (`astro.config.mjs:21`) | **Segunda CSP.** Vale a interseção; o default bloqueia Cloudinary, Google, GA4, GTM, WASM/Pagefind que a atual libera de propósito |
| `links` | Express (`server.ts:478`) | **CSP própria via meta Astro** (`astro.config.mjs:22`) | Mesma colisão; bloqueia Cloudinary e conexão com `accounts.` |
| `accounts` | Express (`app.ts:468`) | Nenhuma CSP | CSP default pode bloquear avatar externo em `<img>` (`frontend/src/main.tsx:333`) |

**Consequência: "Helmet nos 6" está errado nos 6.** Em 3 o header pertence ao Nginx; em 2 colidiria com CSP deliberada existente; em 1 (`accounts`) faria sentido, mas ainda depende de saber o que a borda já emite.

**Precedente no repo:** sessão `26-06-29_5_site-accounts_csp-busca-conta` — CSP já quebrou busca do nav, avatar Google e beacon CF, e exigiu allowlist específica. Ligar CSP default repetiria o incidente.

**Restrição fixada (D1):** qualquer Helmet que venha a entrar **entra com `hsts: false`**. O `Strict-Transport-Security` tem um dono só — a Cloudflare. Não é preferência de estilo: é o que mantém o rollback do item A viável.

### Investigação B1 — FECHADA (Claude, 2026-08-03, `curl -sI` read-only em produção)

Captura de headers de segurança nos 6 hostnames. Feita de carona na Investigação A, que mediu status e redirect mas não capturou headers.

| Hostname | Headers de segurança presentes na resposta |
|---|---|
| `artificiorpg.com` | **nenhum** |
| `accounts.artificiorpg.com` | **nenhum** |
| `mesas.artificiorpg.com` | **nenhum** |
| `glossario.artificiorpg.com` | **nenhum** |
| `links.artificiorpg.com` | **nenhum** |
| `downloads.artificiorpg.com` | `x-frame-options: DENY` · `x-content-type-options: nosniff` · `referrer-policy: strict-origin-when-cross-origin` · `permissions-policy: camera=(), microphone=(), geolocation=()` |

**A Cloudflare não injeta header de segurança nenhum.** A pergunta que mantinha os 6 como INDETERMINADO ("o que a borda já emite, já que a config não está no repo?") tem resposta: nada. Os 4 headers do `downloads` são os do `frontend/nginx.conf:15-18` chegando intactos ao browser — prova de que o caminho Nginx funciona e de que nenhum outro app tem esse caminho.

**CSP em meta confirmada em produção** (`curl` do HTML):
- `artificiorpg.com` — `default-src 'self'` com allowlist real: `res.cloudinary.com`, `*.googleusercontent.com`, `google-analytics.com`, `cloudflareinsights.com`, `googletagmanager.com`, `'wasm-unsafe-eval'`.
- `links.artificiorpg.com` — `default-src 'self'` + `res.cloudinary.com`, `accounts.artificiorpg.com`, e hashes SHA-256 de scripts inline.

Confirma o que a leitura estática indicava: `helmet()` default nesses dois criaria uma segunda CSP e a interseção bloquearia exatamente o que a política atual libera de propósito.

**Veredito do item B, agora com dado:** os 6 saem de INDETERMINADO. **Helmet não é a resposta para nenhum dos 6.**

### Achado novo — o `downloads` não é modelo, está furado

Medido em produção, 2026-08-03:

```
GET https://downloads.artificiorpg.com/          → os 4 headers presentes
GET https://downloads.artificiorpg.com/assets/index-Di1vunI3.js
  HTTP/1.1 200 OK
  Cache-Control: public, max-age=31536000, immutable
  (nenhum dos 4 headers)
```

**Causa:** `apps/downloads/frontend/nginx.conf:34` tem `add_header Cache-Control` dentro da `location` de assets. No Nginx, **`add_header` numa `location` descarta todos os `add_header` herdados do bloco pai** — silenciosamente, sem erro de config. Os 4 headers do `server` (`:15-18`) morrem em todo asset.

**Consequência para o plano anterior:** copiar o `nginx.conf` do `downloads` para `mesas` e `glossario` propagaria o defeito. Os dois já têm `add_header Cache-Control` em location (`mesas:96,103`; `glossario:19,67,73`), então herdariam o furo no mesmo commit.

O `downloads` precisa de correção **independentemente da decisão abaixo** — hoje ele emite hardening só no HTML.

### Por que a correção não é por app

Três caminhos de resposta distintos, não dois: Nginx (`mesas`, `glossario`, `downloads`), Express servindo HTML (`site`, `links`, `accounts`), Express servindo API. Correção por app = **6 lugares em sincronia**, cada um falhando de um jeito diferente (o do Nginx nem avisa).

E `esferas`/`srd` **ainda não existem** — vão nascer nesta arquitetura. Solução que dependa de "lembrar de adicionar headers no app novo" já falhou nos dois. É o mesmo mecanismo de E016/E017: dependência nova, Dockerfile não copia, CI verde, quebra em produção.

---

## D5 · Decisão do mantenedor (2026-08-03): headers de hardening vão para a borda

**Response Header Transform Rule na zona `artificiorpg.com`, filtro `(true)` — zona inteira.**

```
nome:   sec-headers-baseline
filtro: (true)

Set static:
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**O que isso resolve:**
- Um lugar em vez de 6 (indo para 8 com `esferas`/`srd`).
- Cobre **toda classe de resposta** — HTML, asset, API, redirect, página de erro. Fecha o furo dos assets do `downloads` sem tocar no Nginx.
- Cobre **hostname que ainda não existe**: `esferas.`/`srd.` recebem no dia em que o DNS subir, sem ninguém lembrar.
- Mesmo mecanismo e mesmo rollback do HSTS (decisão D1) — um dono só para header de borda.

**Exceção explícita: CSP não vai para a borda.** `site` e `links` têm allowlist específica com hashes SHA-256 de scripts inline, que **mudam a cada build**. CSP continua por app, em meta Astro, onde já está.

**Custos aceitos, registrados:**
1. **Config de produção fora do git.** A regra não é versionada nem revisável por PR. Mitigação: documentada aqui e no `docs/agents/deploy-runbook.md`. Não equivale a versionar — é o preço da escolha.
2. **Ausente em dev local.** Quem roda o app localmente não vê os headers. Não afeta produção, mas afeta teste local de comportamento dependente de header.

**Alternativas descartadas:**
- **Pacote `@artificio/http-headers`** — resolveria os 3 Express, não os 3 Nginx; manteria dois mecanismos e o problema do app novo.
- **`nginx-security.conf` compartilhado via `include`** — bom para os 3 Nginx, mas exige `always` e repetição em **cada** `location` com `add_header` próprio (a armadilha que já furou o `downloads`); não cobre Express nem app novo.

### D6 · `downloads` — `add_header` removidos (✅ edição feita, deploy pendente)

**Decidido e executado (2026-08-03):** os 4 `add_header` de `apps/downloads/frontend/nginx.conf:15-18` foram **removidos**. Com a borda assumindo eles são redundantes, e mantê-los recria o problema que a decisão D1 evitou no HSTS: dois donos para o mesmo header.

**A ordem foi respeitada — a remoção não veio primeiro.** Antes da Transform Rule, o `downloads` emitia os 4 headers no HTML (só o asset falhava); removê-los naquele momento abriria uma janela sem hardening nenhum. Sequência de fato executada:

1. ✅ Transform Rule `sec-headers-baseline` criada na zona.
2. ✅ Validada — incluindo o **asset**, que passou de 0/4 para 4/4.
3. ✅ Só então os 4 `add_header` saíram do `nginx.conf`.

**Estado atual:** edição feita na branch, **não deployada**. O `downloads` em produção ainda roda o Nginx antigo — sem prejuízo, já que a borda cobre os 4 headers de qualquer forma. O deploy entra pelo fluxo normal (PR → merge → esteira).

No lugar dos `add_header` ficou um comentário explicando por que saíram, o comportamento de `add_header` em `location` que causou o furo, a medição (HTML 4/4, asset 0/4) e o aviso de não readicionar.

`mesas` e `glossario` não precisaram de mudança de Nginx — nunca tiveram esses headers, e a borda passou a cobri-los.

### EXECUTADO — 2026-08-03, via MCP `cloudflare`, autorização nominal do mantenedor

**Zona:** `artificiorpg.com` · `70b679c176ba36d67759a7b660359081` · plano Free · ativa, não pausada. **Zona única da conta.**

**Leitura prévia (read-only), antes de qualquer escrita:**
- Fase `http_response_headers_transform`: **não existia** (`10003: could not find entrypoint ruleset`). Nenhuma Transform Rule de header na zona — o `PUT` criou a fase do zero, sem sobrescrever nada. A preocupação de `PUT` destrutivo era real como classe, mas não se aplicava aqui.
- Regras existentes em outras fases, nenhuma tocando header de resposta: 2 redirects (`/amp` 301; `www`→apex), 2 de firewall (bloqueio XML-RPC; bypass de crawler OG).
- TLS já satisfazia os pré-requisitos de HSTS: `always_use_https: on` · `ssl: strict` · `min_tls_version: 1.2` · `automatic_https_rewrites: on`.
- `security_header` nativo: `enabled: false`, tudo zerado.

**Correção de registro.** Esta sessão afirmava que o `max-age` mínimo era 1 mês. Isso é limite do **dropdown do painel**, não da plataforma — pela API, `security_header.strict_transport_security.max_age` é inteiro em segundos e aceita `300`. Mesmo assim, Transform Rule continua sendo a escolha certa para o canário, por um motivo melhor: **o `security_header` nativo aplica na zona inteira, sem filtro**, e não permite restringir ao apex. Sem escopo não existe canário nem a validação negativa. O nativo volta a ser candidato no degrau 3, quando o alvo já é a zona toda.

**Escritas — duas chamadas separadas, para rollback independente.**

Ruleset criado: `eeb763923283467aae249675d4c4a8bc`

| Regra | ID | Expressão | Efeito |
|---|---|---|---|
| `sec-headers-baseline` | `c92488d8ade94e5c8c58cf2128a0fa86` | `true` | 4 headers de hardening, zona inteira |
| `sec-hsts-apex-canary` | `7a10ec1e7e3d4e0188b3d3d5c554ef67` | `(http.host eq "artificiorpg.com" and ssl)` | `Strict-Transport-Security: max-age=300` |

**Validação — headers de hardening, medida real:**

| Alvo | Antes | Depois |
|---|---|---|
| `downloads.` **asset** `/assets/index-Di1vunI3.js` | **0/4** | **4/4** |
| `downloads.` HTML | 4/4 (via Nginx) | 4/4 |
| `artificiorpg.com` · `accounts.` · `mesas.` · `glossario.` · `links.` | 0/4 | **4/4** |

O asset do `downloads` é o resultado que importa: era o furo de herança do `add_header` no Nginx, e a borda o cobriu sem tocar em uma linha de config do app.

**Validação — canário HSTS, incluindo a verificação negativa:**

```
https://artificiorpg.com/          → Strict-Transport-Security: max-age=300
https://accounts.artificiorpg.com/ → (ausente)
https://mesas.artificiorpg.com/    → (ausente)
https://www.artificiorpg.com/      → (ausente)
```

O escopo ficou contido no apex, como pretendido. `www` não recebe (redireciona 301 para o apex antes).

**Rollback disponível:** `sec-headers-baseline` — apagar a regra, efeito imediato, sem resíduo. `sec-hsts-apex-canary` — apagar a regra; até 5 minutos de cache HSTS no browser de quem acessou o apex nesse intervalo.

### Inventário DNS — checklist fechado (2026-08-03, leitura via MCP)

24 registros na zona. 12 web (`CNAME`), **todos `proxied: true`**. Nenhum `A`/`AAAA`.

| Item do checklist | Resultado |
|---|---|
| Registro web não-proxied | **nenhum** |
| Hostname fora do Tunnel | 1 — `arquivos.` → `public.r2.dev`, mas **proxied**, HTTP→HTTPS 301, e já recebe os 4 headers (4/4) |
| Redirect HTTPS→HTTP | nenhum |
| Delegação `NS` dependente de HTTP | nenhuma (só `CAA`×4, `TXT`×7, `MX`×1) |
| Universal SSL / modo | `ssl: strict`, `min_tls_version: 1.2` |
| `always_use_https` | `on` |

11 dos 12 apontam para o **mesmo Cloudflare Tunnel** (`6417d3a0-…cfargotunnel.com`) — mesma terminação TLS, mesmo comportamento. `esferas.` e `srd.` não resolvem: não existem ainda, e nascerão já sob a política.

**Consequência: a escada de 3 degraus virou 2.** O `includeSubDomains` é o passo perigoso **quando existe subdomínio que possa quebrar**. Aqui não existe — 12 de 12 são o mesmo Tunnel proxied. Um degrau intermediário só reprovaria o que o inventário já provou. E `max-age=300` não protege contra downgrade em primeiro acesso, que é o ataque: ficar parado ali mantinha o achado aberto de fato.

---

## Degrau 2 EXECUTADO — 2026-08-03, autorização nominal do mantenedor

Regra `sec-hsts-apex-canary` **substituída** por `sec-hsts-zone` (id `cc00dff4c7e4434c9693fade2ccd7a59`), ruleset version `3`:

| | antes (canário) | agora |
|---|---|---|
| Expressão | `(http.host eq "artificiorpg.com" and ssl)` | `ssl` — zona inteira |
| Valor | `max-age=300` | `max-age=86400; includeSubDomains` |

`sec-headers-baseline` preservada intacta na mesma operação.

**Validação — 12/12 hostnames com `max-age=86400; includeSubDomains`:**
`artificiorpg.com` · `www.` · `accounts.` · `mesas.` · `mesasbeta.` · `glossario.` · `glossariobeta.` · `downloads.` · `downloadsbeta.` · `links.` · `beta.` · `arquivos.`

Inclui o `301` do `www` (o header sai no próprio redirect) e o `404` do `arquivos.` — confirma que a borda aplica em toda classe de resposta, não só em `200`.

### Armadilha de validação encontrada — cache de borda serve header antigo

Na primeira varredura, três hostnames pareceram falhar. Nenhum era falha de regra:

- `mesasbeta.` reportou "SEM HSTS", mas com cache-bust (`?n=<random>`) trouxe o header correto.
- **`artificiorpg.com` oscilou entre `max-age=300` e `max-age=86400`** conforme a query string — a pior das três, porque parece regra intermitente.

**Causa:** o apex serve com `Cache-Control: public, max-age=7200`. A resposta cacheada na borda foi congelada **com o header HSTS antigo dentro**. Cada variação de query string sorteava entre um objeto cacheado velho e um MISS novo.

**Resolvido** com purge de `https://artificiorpg.com/` e `https://www.artificiorpg.com/`. Após o purge: 4 leituras consecutivas, todas `max-age=86400; includeSubDomains`.

**Regra operacional para o próximo degrau:** ao alterar header de resposta em hostname com `Cache-Control` longo, **purgar o cache antes de validar** — ou a medição mente nas duas direções (mostra o valor velho, ou alterna). Vale para o degrau 3.

### Escada revisada — 4 degraus (decisão do mantenedor, 2026-08-03)

O mantenedor reintroduziu um degrau intermediário de 7 dias. A escada final:

| Degrau | `max-age` | Estado | Resíduo máximo no rollback |
|---|---|---|---|
| 1 | `300` (5 min), só apex | ✅ concluído — substituído pelo degrau 2 | — |
| 2 | `86400` (1 dia) + `includeSubDomains`, zona | ✅ **no ar desde 2026-08-03** | 1 dia |
| 3 | `604800` (7 dias) + `includeSubDomains` | ⏳ pendente | 7 dias |
| 4 | `31536000` (1 ano) + `includeSubDomains` | ⏳ pendente | 1 ano |

**Quando aplicar o degrau 3:** após observar o degrau 2 em produção. O degrau 2 subiu em 2026-08-03; aplicar o 3 no mesmo dia anularia a razão de o 2 existir — a janela com resíduo de apenas 1 dia é o que permite detectar quebra barato. **Sem data fixa; o mantenedor decide quando pedir.** Nenhuma escrita foi feita neste ponto.

**Ao aplicar o degrau 3 ou 4, lembrar:** purgar o cache dos hostnames com `Cache-Control` longo **antes** de validar (§Armadilha de validação acima) — o apex serve com `max-age=7200` e devolve o header antigo congelado na resposta cacheada.

`preload` continua **fora** da escada. Exige 12 meses e a entrada nas listas dos browsers não se desfaz pelo painel.

**Compromisso assumido com `includeSubDomains`, registrado:** a política agora vale para **qualquer subdomínio futuro**, inclusive os que ainda não existem. Se `esferas.` ou `srd.` subirem com HTTPS quebrado, ficam inacessíveis — erro de conexão, não aviso. Na arquitetura atual (tudo pelo mesmo Tunnel, `ssl: strict`) isso é improvável, mas é o custo real do degrau.

### Comandos de reverificação (para os degraus 3 e 4, ou auditoria futura)

```powershell
# HTML
curl.exe -sI https://downloads.artificiorpg.com/ | Select-String "x-frame|x-content|referrer|permissions"
# ASSET — era o caso que falhava antes da borda
curl.exe -sI https://downloads.artificiorpg.com/assets/<hash>.js | Select-String "x-frame|x-content|referrer|permissions"
# HSTS em todos os hostnames
curl.exe -sI https://<host>/ | Select-String "Strict-Transport-Security"
```

**Sempre purgar o cache antes de medir** em hostname com `Cache-Control` longo (§Armadilha de validação) — senão a leitura devolve o header antigo congelado e a medição mente.

**Trava mantida:** `accounts` atravessa SSO. Se algum dia a CSP dele for tratada, exige smoke de login/me/logout e de ao menos um app consumidor (`AGENTS.md` §Isolamento de App).

---

## C · Stored XSS via `discord_server_url` — CONFIRMADO, 3 sinks

### Fluxo do dado

1. Mestre autenticado controla `contacts`.
2. Escrita via `createTableSchema`/`updateTableSchema` (`gmPanel.ts:704`, `:818`).
3. `tableValidators.ts:24` valida com `z.url()` — **sintaxe, não esquema**. `javascript:...` é URL sintaticamente válida e passa.
4. Escrita alternativa em `gmPanel.ts:416` — apenas `trim().slice(0,500)`, **sem validação nenhuma**.
5. `tableRepository.ts:80` insere sem revalidar.
6. Rota pública devolve cru (`tables.ts:372`, `:498`).
7. Mapper copia para `actionUrl` (`tableViewMapper.ts:44`).

### Os 3 sinks

| ID | Local | Sink | Observação |
|---|---|---|---|
| C | `features/table/utils/uiHelpers.ts:51` | `window.open(cta.actionUrl, '_blank', 'noopener,noreferrer')` | Achado original do Snyk |
| X1 | `features/table/components/TableContactsBlock.tsx:49` e `:65` | `href={contact.discord_server_url}` | **Não reportado pelo Snyk.** Dois `<a>` na mesma tela |
| X2 | `components/mestre/MestreContactMethods.tsx:97` e `:169` | `window.open(contact.value)` (canal `form`) e `href` | **Não reportado.** Superfície diferente: perfil público do mestre |

**X2 é o pior dos três.** `window.open(contact.value, '_blank')` na linha 97 **não tem `noopener`**. `contact.value` só é validado quando o canal é `whatsapp` (regex de telefone) ou `email`; o canal `form` passa livre. Escrita em `gmPanel.ts:308` → `:416`, mesma validação frouxa. Perfil público servido por `gm.ts:105` e `:157`.

### Impacto — corrigido pelo Codex

Não é roubo de cookie: o cookie de sessão é `HttpOnly` (`accounts/src/cookies.ts:7`). É **execução de script em origem autenticada da suíte**. O cookie tem `Domain=.artificiorpg.com` (`accounts/src/env.ts:15`) e é enviado automaticamente pelo browser — o script age **como a vítima**, lendo respostas e fazendo requisições autenticadas. CSRF não bloqueia: origens permitidas passam direto (`packages/auth/src/csrf.ts:34`).

`noopener,noreferrer` **não mitiga**. Remove `window.opener` e `Referer` — protege contra tabnabbing, não contra esquema de URL.

Nenhuma CSP versionada no frontend de `mesas` para servir de barreira secundária.

### Escritas que não são vetor (verificadas)

- `syncHelpers.ts:219` — grava `discord_server_url: null`.
- `adminEnrichment.ts:151` — URL fixa `https://discord.gg/dummy`.

Não quebram nem mitigam a rota manual.

### Dado já gravado

As linhas existentes passaram por `gmPanel.ts:416` sem validação. **Corrigir a escrita não neutraliza o que já está no banco** — daí a validação no frontend ser obrigatória, não defesa redundante.

---

## Investigações C1, C2, C3 — FECHADAS (Codex, 2026-08-03)

**Resultado geral:** C/X1/X2 confirmados; **nenhum sink explorável adicional**; produção **sem** `javascript:`, `data:` ou `vbscript:`. Zero código escrito.

### C1 — superfície real: 4 sinks exploráveis, não 3

A contagem subiu porque `X1` e `X2` eram **dois `href` cada**, não um:

| ID | Sink | Origem | Validação atual |
|---|---|---|---|
| C | `uiHelpers.ts:51` — `window.open(actionUrl)` | `table_contacts.discord_server_url` via `tableViewMapper.ts:44` | `z.url()`, aceita qualquer esquema (`tableValidators.ts:24`) |
| X1a / X1b | `TableContactsBlock.tsx:46` e `:64` — dois `href` | mesmo campo | mesma |
| X2a | `MestreContactMethods.tsx:96` — `window.open(contact.value)`, canal `form` | `gm_profiles.contact_methods[].value` | `trim().slice(0,500)` (`gmPanel.ts:389`), **sem esquema**. Também sem `noopener` |
| X2b | `MestreContactMethods.tsx:167` — `href` Discord | `contact_methods[].discord_server_url` | `trim().slice(0,500)` (`gmPanel.ts:416`) |

**Dois consumos verificados e NÃO exploráveis** (registrados para não voltarem como suspeita):
- `TableContacts.tsx:18` — prefixa `https://` quando a entrada não começa com HTTP(S); `javascript:...` vira `https://javascript:...`, inerte. Componente exportado (`:78`) mas **sem importador** no frontend atual.
- `TableContactsBlock.tsx:116` — mesmo tratamento para os demais canais.

**Escritas mapeadas:** criação (`gmPanel.ts:704` → `tableRepository.ts:105`), edição (`:818` → `:162`), perfil (`:307` → `:439`, a rota divergente de D3), syncs Discord/inbox (só admin — gravam `discord_server_url: null`, mas `syncHelpers.ts:144` não valida esquema de `value`, **então precisam passar pela validação unificada**), enriquecimento admin (só fora de produção, URL fixa — não é vetor).

**Leituras cruas:** `tables.ts:272`, `:498`; `gm.ts:246`, `:343`; `gmPanel.ts:500`, `:562`. **Nenhum outro app** referencia esses campos.

### C2 — produção limpa, sem incidente

`SELECT` read-only no `mesas-db`. Saída restrita a campo/esquema/contagem.

| Resultado crítico | Contagem |
|---|---|
| `javascript:` | **0** |
| `data:` | **0** |
| `vbscript:` | **0** |
| `http:` em campo navegável | **0** |
| Host Discord fora de `discord.gg`/`discord.com` | **0** |

**Não há incidente ativo.** A correção é preventiva.

**Compatibilidade com D3, medida:** 15 métodos (6 Discord, 6 WhatsApp, 2 form, 1 email). Zero vazios, zero acima de 500/100 caracteres, zero rejeitados pela validação manual atual, zero campos extras, zero `contact_methods` não-array. **A unificação não exige limpeza de dado.**

**Único ponto de atenção:** 3 formulários de mesa (`table_contacts.value`, canal `form`) **sem esquema**. Precisam ser canonicalizados para `https://` — sem isso, uma validação que exija esquema os ocultaria.

### C3 — a decisão D3 estava certa na direção, errada no alvo

**Correção do Codex sobre a sessão.** Esta sessão dizia "`gmPanel.ts:416` passa a usar o `contactSchema`". Aplicado literalmente, **pioraria a segurança**:

| | Validação manual (`gmPanel`) | `contactSchema` atual |
|---|---|---|
| Canais | 4 (`whatsapp`, `email`, `discord`, `form`) | **7** (+`phone`, `facebook`, `instagram`) |
| WhatsApp / email | **valida** (`:401`) | não valida |
| Limite de `value` / `label` | 500 / 100 (`:416`) | **nenhum** |
| `discord_server_url` | sem esquema | `z.url()`, qualquer esquema |

Trocar um pelo outro **perderia** a validação de e-mail/WhatsApp e **admitiria 3 canais novos** no perfil. E o frontend indexa `CHANNEL_CONFIG[contact.channel]` direto (`MestreContactMethods.tsx:79`), usando `config.icon` na linha seguinte **sem guarda** — canal fora dos 4 deixa `config` como `undefined` e **quebra a página pública do mestre**.

**D3 continua válida como princípio** — uma entidade, um schema-base, nada de validação manual paralela. O que muda: **fortalecer o `contactSchema` primeiro**, depois unificar. Não unificar no schema fraco.

**Proposta aceita:**
1. Fortalecer e exportar `contactSchema`: trims, limites, validação discriminada por canal, URL HTTPS, host Discord.
2. Criar `contactMethodsSchema` como array do mesmo base, restrito aos **4 canais** que o frontend suporta.
3. Preservar o parse de JSON-string apenas como compatibilidade de transporte; depois do parse, tudo passa pelo schema. JSON inválido → **400**, não atualização silenciosamente ignorada.
4. Payload com uma entrada inválida **rejeita a operação inteira**.

**Allowlist definida:**
- Formulários e URLs navegáveis: **só `https:`**. `http:` rejeitado (produção não usa; aceitar manteria downgrade sem motivo).
- Entrada **sem** esquema: aceita por compatibilidade, prefixando `https://` antes de persistir/servir.
- Esquema explícito diferente de `https:`: **rejeitar**. Nunca prefixar `https://` sobre valor que já declara outro esquema.
- `discord_server_url`: `https:` + host exato `discord.gg`, `discord.com` ou `www.discord.com`; em `discord.com`, só caminho de convite.

**Camadas e o que cada uma cobre:**

| Camada | Cobre | Não cobre |
|---|---|---|
| Escrita (schema compartilhado em criação, edição, perfil, sync/import) | dado novo, todas as rotas | legado |
| Leitura/API (serializador único de contatos) | legado e escrita indireta futura | o dado no banco |
| Frontend (helper único → `https URL \| null`) | regressão e API antiga | outros consumidores da API |
| Dado existente | — | sem payload perigoso hoje; API canonicaliza os 3 form sem esquema |

**Mudança de comportamento observável, marcada:** hoje entrada inválida é **descartada em silêncio** — o mestre acredita ter salvo. Passa a retornar erro. É o comportamento correto, mas é visível ao usuário.

**Migração de dados não é necessária agora.** Uma futura canonicalização do armazenamento exigiria autorização própria para SQL write.

---

## C · IMPLEMENTADO — 2026-08-03 (Codex), verificado por Claude

**Sem commit/push/PR.** 26 arquivos: 20 modificados, 6 novos.

### Arquitetura da correção — 3 camadas

| Camada | Arquivo | Papel |
|---|---|---|
| Escrita | `backend/src/validators/tableValidators.ts:29` | `contactSchema` fortalecido + `contactMethodsSchema` unificado (D3) |
| Leitura | `backend/src/utils/contactSerializer.ts` (novo) | neutraliza legado hostil em todas as rotas que servem contatos |
| Frontend | `frontend/src/utils/safeExternalUrl.ts` (novo) | helper único; um só `window.open` em toda a base |

### Verificação independente do Claude

**Os 4 sinks passam pelo helper** — conferido arquivo por arquivo:
`uiHelpers.ts:52` (`openSafeExternalUrl`) · `TableContactsBlock.tsx:51` e `:67` (`safeDiscordServerUrl`) · `MestreContactMethods.tsx:171` (`href`) e `:92` (agora `mailto:`).

**22 vetores hostis testados contra o validador — nenhum bypass de execução:**
`javascript:` (simples, case misto, maiúsculo, com espaço à frente), `data:`, `vbscript:`, `http:` (minúsculo e maiúsculo), esquema com TAB/LF/CR/NUL no meio, `https:javascript:`, colon Unicode (`：`), `javascript:` vazio. Todos bloqueados.

**Validador de convite Discord resiste a spoofing de host** — testado:
`https://discord.gg@evil.com/x` (userinfo), `https://discord.com@evil.com/invite/x`, `https://discord.gg.evil.com/abc` (subdomínio), `https://evil.com/discord.gg/abc` (path). **Todos bloqueados.** Aceita apenas `discord.gg/<1 segmento>` e `discord.com|www.discord.com/invite/<slug>`.

**Prova por remoção — validada de fato, não só declarada.** Removendo a checagem `parsed.protocol !== 'https:'` de `safeExternalUrl.ts`, a suíte cai de **12/12 para 9 passam / 3 falham**. Arquivo restaurado idêntico depois (`git diff` vazio).

Nota de método: a primeira tentativa de remoção (só a guarda `EXPLICIT_SCHEME`) **não** derrubou o teste — `new URL('javascript:...')` preserva `protocol: 'javascript:'` e a checagem seguinte barra sozinha. Ou seja, as duas verificações são redundantes por desenho, e a redundância é intencional. Prova por remoção precisa mirar a defesa real, não a primeira linha que parece defesa.

**Validação (números do Codex, testes de segurança reconferidos localmente):**
backend 699/699 · frontend 203/203 · lint 2/2 · build 2/2 · `verify:api` 513 rotas, 411 operações, zero breaking · `git diff --check` OK.
Reconferidos aqui: `tableValidators.test.ts` + `contactSerializer.test.ts` = **39/39**; `contactXss.test.tsx` = **12/12**.

**Arquivo fora do escopo aparente, justificado:** `gmPanel.orphanTable.test.ts` (+99 linhas) recebeu os testes de rejeição das rotas manuais. Reúso do harness já existente em vez de duplicar setup de `supertest`/mocks. Verificado: são só os casos `javascript:`/`data:`/`vbscript:`/`http:`/host Discord falso contra `POST` e `PUT`.

### D9 · Deep link Discord por `@usuário` removido — instrução direta do mantenedor

Não foi iniciativa do Codex: **o mantenedor instruiu essa mudança**, fora do prompt registrado nesta sessão.

`discord.com/users/<username>` não resolve — o Discord só aceita ID numérico nessa rota. Construir esse link produzia URL quebrada. O username/ID passa a ser o contato principal (para copiar), e o convite de servidor vira o único link navegável, opcional.

Texto corrigido em `ContactsFormBlock.tsx:128` e `ContactMethodsEditor.tsx:254`.

### Descartado pelo Codex, com motivo

- **Migração de dados:** produção limpa (§C2), desnecessária.
- **Promoção automática `http://` → `https://`:** rejeitada conforme D8.2.
- **Syncs Discord, D4, D13, headers, Cloudflare:** intocados (D8.4).
- **`TableContacts.tsx`:** contém construtores antigos, mas está **morto** — zero import/caller. Não é sink executável. **Ver D10 abaixo: a classificação "arquivo morto, decidir se apaga" estava errada.**

---

## D10 · `phone`, `facebook` e `instagram` estão quebrados em produção (2026-08-03)

**Descoberto porque o mantenedor disse que os 3 canais continuam válidos** — "não ter sido usado não negativa essa possibilidade". Até então este registro os tratava como resquício.

**Não é regressão do trabalho do Codex.** `TableContactsBlock` sempre tratou de forma especial apenas `whatsapp` e `email`; os demais caem no fallback genérico de URL (`:138`). A correção do XSS trocou um prefixo `https://` cru por `toSafeHttpsUrl`, mais estrito — o que mudou o sintoma de "link quebrado" para "não renderiza" no caso do telefone numérico.

**Medido** (reprodução de `getValidUrl` em `TableContactsBlock.tsx:118-139`):

| Canal | Mestre digita | Hoje | Deveria |
|---|---|---|---|
| `phone` | `11999999999` | **não renderiza** — contato some | `https://wa.me/5511999999999` |
| `phone` | `+5511999999999` | `https://+5511999999999/` (quebrado) | `https://wa.me/5511999999999` |
| `facebook` | `meuperfil` | `https://meuperfil/` (quebrado) | `https://fb.com/meuperfil` |
| `facebook` | `facebook.com/meuperfil` | `https://facebook.com/meuperfil` (funciona) | `https://fb.com/meuperfil` |
| `instagram` | `@meuperfil` | `https://meuperfil/` (quebrado) | `https://instagr.am/meuperfil` |
| `instagram` | `instagram.com/meuperfil` | funciona | `https://instagr.am/meuperfil` |

Só funciona quando o mestre digita a URL completa. Username puro — a forma natural de escrever — quebra.

**`getChannelConfig` (`:203-247`) já cobre os 7 canais** com fallback seguro; não há crash. O buraco é só na construção da URL.

**A implementação correta existe — no arquivo dado como morto.** `TableContacts.tsx:23-76` (`buildMainHref`) trata os 3 canais: `phone` via `wa.me` com `+55` automático, `facebook` com strip de `facebook.com`/`fb.com`, `instagram` com strip de `instagram.com`/`instagr.am`. **Apagar o arquivo apagaria a única cópia dessa lógica** — e também o comentário datado de 2026-07-07 sobre snowflake do Discord.

### Decisões do mantenedor

**D10.1 · `phone` usa `wa.me`**, como no arquivo morto — padrão brasileiro.

**D10.2 · Corrigir agora**, no mesmo trabalho. O Codex já está nesses arquivos e o helper de URL acabou de nascer; adiar significaria reabrir o mesmo código.

**D10.3 · `phone` sai do formulário e é exibido como WhatsApp.** Fundamento do mantenedor: *"telefone é whatsapp. ninguém liga ou chama sms hoje no Brasil"*.

Com D10.1, `phone` e `whatsapp` passam a ter **destino idêntico** — o formulário oferecia duas escolhas para a mesma coisa, e o rótulo "Telefone" prometia ligação que ninguém faz.

**`phone` não pode ser removido do enum.** O parser do Discord o cria automaticamente:
- `syncHelpers.ts:187` — `tel:` no texto → canal `phone`
- `syncHelpers.ts:204` — número brasileiro solto (`BR_PHONE_PATTERN`) → canal `phone`

Mesa importada do Discord recebe `phone` sem ninguém escolher. Tirar do enum quebraria a importação — e o parser será reformulado depois (D8.4), então mexer nele agora é retrabalho.

Separação decidida: **`phone` continua existindo como dado; deixa de existir como escolha.**

| Camada | O que muda |
|---|---|
| Enum / tipos / validador | **nada** — `phone` continua válido |
| Parser Discord (`syncHelpers`) | **nada** — continua gravando `phone` (D8.4) |
| Formulário (`ContactsFormBlock.tsx:20`) | opção "Telefone" **sai** da lista |
| Página da mesa | `phone` renderiza **como WhatsApp** — mesmo destino `wa.me`, mesmo ícone, mesmo texto |

Dado já gravado com canal `phone` (manual ou importado) segue funcionando, sem migração.

---

## D8 · Decisões do mantenedor sobre C (2026-08-03)

**D8.1 · L1 e L2 entram no mesmo trabalho.** Ambos vivem em arquivo que a correção do XSS já toca. Deixar PII vazando em log enquanto se corrige XSS na mesma função seria incoerente.

**D8.2 · `http:` rejeitado, com mensagem explícita.** A recusa **não pode ser genérica**: quando o mestre enviar uma URL `http://`, o erro deve dizer que **somente `https://` é aceito**. Sem isso, ele reescreve o link várias vezes sem entender o motivo. Vale para a mensagem da API e para o que o frontend exibe.

Distinguir os dois casos, que têm tratamento oposto:
- **`http://` explícito** → rejeitar com o aviso acima. Nunca "promover" silenciosamente para `https://`: o mestre pediu um esquema e receberia outro sem saber.
- **sem esquema** (ex.: `forms.gle/abc`) → aceitar e canonicalizar para `https://`. É o caso dos 3 formulários já em produção.

**D8.3 · A exigência de HTTPS precisa ficar clara no frontend, não só na API.** Validação server-side que devolve erro genérico na tela não cumpre D8.2 — o mestre tenta de novo sem saber o que mudar. O formulário de contatos deve comunicar a regra **antes** do envio (rótulo, placeholder ou texto de ajuda) **e** exibir a mensagem específica quando a API recusar. Sem isso, a decisão fica só no backend e o usuário paga o custo.

**D8.4 · Syncs Discord ficam FORA deste trabalho.** `syncHelpers.ts:144`/`:209` não validam esquema de `value`, mas serão **reformulados por completo depois** (decisão do mantenedor). Aplicar a validação unificada agora seria trabalho jogado fora. Rota só de admin, e produção não tem payload perigoso (§C2) — risco aceito conscientemente até a reformulação. **Não é débito esquecido: é adiamento decidido.**

---

## Achados laterais do Codex — ambos APROVADOS para correção (D8.1)

**L1 · Vazamento de PII em log — `gmPanel.ts:373-374`.**

```ts
// DEBUG: Log para verificar o tipo de contact_methods
console.log('[PUT /gm/profile] contact_methods type:', typeof contact_methods);
console.log('[PUT /gm/profile] contact_methods value:', contact_methods);
```

Imprime o **objeto inteiro** — e-mail e telefone do mestre em texto puro no log do container, a cada `PUT /gm/profile`. O próprio comentário diz `DEBUG`: é código temporário que ficou. Há um `HOTFIX` na mesma função (`:377`), do mesmo lote.

Não é XSS. É exposição de dado pessoal em log, com peso de LGPD — os compromissos de produto incluem "sem coleta desnecessária de dados".

**L2 · `TableContactsBlock.tsx:116` transforma e-mail em `https://email`.** Só trata WhatsApp antes do fallback; contato de e-mail vira URL inválida. Bug funcional, não segurança.

---

## D · File inclusion — 1 confirmado de 24

**Contenção comum do importador** (`chatExporterFolderImportService.ts`): `ensureInsideBaseDir` (`:39`) usa `resolve` + `relative` e rejeita fuga lexical; `jsonFiles` (`:58`) exige `.json` e rejeita `/` e `\`.

### D13 · `chatExporterCliRunner.ts:27` — CONFIRMADO

**Erro do Claude, registrado.** O Claude suspeitou de `resolveRootDir:50` (contenção ausente quando `allowedBaseDir` é `undefined`). Alvo errado. O furo é anterior e mais direto:

```ts
// chatExporterAutomation.ts:58 — aceita qualquer caminho
importDir: z.string().trim().min(1),

// :628 — cria o diretório ANTES de qualquer contenção
const incomingDir = path.join(parsed.data.importDir, 'incoming');
await mkdir(incomingDir, { recursive: true });

// :636 — ensureInsideBaseDir só entra aqui, tarde demais
const importResult = await runFolderImport(parsed.data.importDir, req.user?.userId);
```

**Impacto real: criação/escrita arbitrária de diretório**, não leitura nem inclusão de arquivo — o rótulo do Snyk está errado. Exige admin da aplicação (`requireAdmin`, `:614`). Nome do arquivo limitado a `discord-export-<channel>-<timestamp>.json`. Sem shell injection: execução usa comando e argumentos separados (`chatExporterCliRunner.ts:57`). Sem caminho comprovado para RCE.

**Correção:** conter `importDir` **antes** do `mkdir` e antes de executar a CLI — base canônica, `realpath` para symlink, rejeitar fora da base.

### Falso-positivos (23) — resumo

| Grupo | Itens | Motivo |
|---|---|---|
| `media-store.ts:32` | 1 | Nome é `randomUUID()+ext`; extensão derivada de validação por conteúdo (`feedback-validator.ts:18`, `admin-api.ts:220`). Snyk marcou "easily exploitable" — incorreto |
| `chatExporterFolderImportService.ts` | 11 (`:50,74,85,97,114,116,127,128,129,130,149`) | Subdiretórios são literais de `FOLDERS`; nomes vêm de `readdir` já filtrado; root contido por `ensureInsideBaseDir`. Symlink no volume atravessaria a contenção lexical, mas exige escrita prévia — nenhuma superfície HTTP oferece isso |
| `chatExporterProfileRunner.ts:57`, `chatExporterAutomation.ts:323`, `:546` | 3 | `import_dir` do perfil é **gerado pelo backend** (`:102`), não aceito no `PATCH` (`:68`). `binary` vem de env, não de request |
| `scripts/api/*`, `scripts/quality/*`, `specs/*/migrate-*.mjs` | 8 | Ferramentas locais/CI. Entrada é a árvore do repositório, não requisição. Sem boundary de atacante remoto |

---

## Ordem de execução — aprovada pelo mantenedor

### ✅ Concluído — não refazer

| Achado | O que foi feito | Onde |
|---|---|---|
| **A** — HSTS | Transform Rule `sec-hsts-zone`, `max-age=86400; includeSubDomains`, 12/12 hostnames. Degraus 3 (`604800`) e 4 (`31536000`) pendentes de decisão do mantenedor | Borda Cloudflare |
| **B** — headers | Transform Rule `sec-headers-baseline`, 4 headers, zona inteira, todas as classes de resposta. **Nenhum app recebeu Helmet** | Borda Cloudflare |
| **D6** — `downloads` | 4 `add_header` removidos do `nginx.conf` (edição na branch, deploy pendente) | `apps/downloads/frontend/nginx.conf` |

### ⏳ Pendente — trabalho do Codex

| # | Achado | Pré-requisito | Executor |
|---|---|---|---|
| 1 | **C + X1 + X2** — stored XSS, **incluindo fortalecimento + unificação do `contactSchema` (D3)** | ✅ C1, C2, C3 fechadas — **liberado para implementar** | Codex |
| 2 | **D13** — escrita arbitrária de diretório | Investigação D1 | Codex |
| 3 | **D4** — `confirm()`/`alert()` para o design system | — (não é segurança) | Codex |

Justificativa da ordem: C é o único explorável por **qualquer usuário com conta de mestre**, contra qualquer visitante, com o alcance da sessão SSO. D13 exige admin. D4 é UX e vai em diff separado — não misturar com correção de vulnerabilidade.

**Nenhuma linha de código foi escrita para C, D13 ou D4.** As investigações abaixo são pré-requisito, não formalidade.

---

## Investigações obrigatórias antes de implementar

**Cada bloco abaixo é pré-requisito da implementação do achado correspondente.** Nenhum código antes da investigação correspondente estar respondida. Motivo: a triagem foi estática e os dois passes divergiram em arquitetura — implementar sobre hipótese não verificada repetiria o erro do critério B.

### Investigação C1 — extensão real da superfície (antes de tocar em C/X1/X2)

O Snyk reportou 1 sink; a análise cruzada achou 3. Não há garantia de que sejam todos.

1. Enumerar **todo** consumo de `discord_server_url` e de `contact_methods[].value` no frontend de `mesas` — `href`, `src`, `window.open`, `window.location`, `action`, `formAction`, atributos dinâmicos.
2. Verificar se o mesmo campo é consumido por outro app (`site`, `glossario`) via API ou hidratação.
3. Enumerar **todas** as rotas de escrita que persistem `contacts` e `contact_methods`, incluindo importação/sync do Discord e enriquecimento admin.
4. Entregar: tabela sink × origem × validação atual. Se aparecer sink fora dos 3 mapeados, ele entra no escopo antes de qualquer código.

### Investigação C2 — dado já gravado em produção (read-only)

Corrigir a escrita não limpa o banco. **Antes** de decidir a correção, medir:

1. `SELECT` read-only em `table_contacts.discord_server_url` e no JSONB `gm_profiles.contact_methods` de produção, contando valores cujo esquema não seja `http`/`https`.
2. Read-only é livre por `AGENTS.md`. Registrado aqui por ser dado de produção.
3. **Se houver linha com `javascript:`, `data:` ou `vbscript:`, isto é incidente, não correção preventiva** — parar e reportar ao mantenedor antes de qualquer código.
4. Entregar: contagem por tabela e por esquema. Sem imprimir conteúdo de payload no relatório.

### Investigação C3 — forma da correção

1. Definir a allowlist: só `https:`? `http:` também? Restringir host a `discord.gg`/`discord.com` para o campo Discord?
2. **Unificação decidida (D3), não é mais pergunta.** `gmPanel.ts:416` passa a usar o `contactSchema`; a validação manual paralela sai. Investigar: quais campos a validação manual cobre que o schema não cobre (e vice-versa), e o que quebra ao unificar — em especial se a rota aceita hoje payload que o schema rejeitaria, e se existe dado em produção que só passou por causa da divergência.
3. Definir o comportamento para dado legado inválido no momento da leitura: neutralizar na API, no frontend, ou migração de dados?
4. Confirmar que o canal `form` de `contact_methods` recebe a mesma validação — hoje não tem nenhuma.
5. Entregar: proposta de correção por camada (escrita, leitura, frontend, dado existente), com o que cada uma cobre e o que não cobre.

### Investigação D1 — contenção do `importDir`

1. Determinar a base canônica legítima para `importDir` — existe diretório previsto, ou é livre por design?
2. Verificar se `chatExporterProfileRunner` e o cron passam pelo mesmo caminho ou por outro.
3. Confirmar se `realpath`/symlink precisa de tratamento explícito, dado que `ensureInsideBaseDir` é contenção **lexical**.
4. Verificar se a configuração global tem outros campos de caminho sem contenção.
5. Entregar: ponto exato onde a contenção deve entrar e o que quebra se `importDir` legado atual estiver fora da base.

### ~~Investigação B1~~ — ✅ FECHADA em 2026-08-03

Executada e registrada em §Investigação B1 (dentro do §B). Resultado: a Cloudflare não injetava header de segurança nenhum; só o `downloads` tinha os 4, e só no HTML. Levou à decisão D5 (borda) e ao fechamento do item B. **Nada a fazer aqui.**

---

## Decisões do mantenedor — 2026-08-03

Respondidas nominalmente. Passam a valer como restrição da implementação, não como sugestão.

**D1 · HSTS fica na Cloudflare.** O header tem **um dono só: a borda**. Consequência para o item B: qualquer Helmet que venha a entrar em qualquer app **entra com `hsts: false`**. Motivo registrado: com 6 apps emitindo o header, o rollback do item A viraria caçada em 7 lugares, e `max-age` cacheado no browser não tem desfazer rápido.

**D2 · Sessão indexada** em `sessoes/index.md`.

**D3 · Unificar a validação de contatos.** `gmPanel.ts:416` deixa de validar em paralelo; passa a usar o `contactSchema`. Esta é a **causa raiz** de C e X2 — duas validações divergentes da mesma entidade. Sem isso, a correção do XSS conserta dois sinks e deixa a fábrica de sinks funcionando. Entra no Achado 1, não é débito.

**D4 · `confirm()`/`alert()` nativos: corrigir.** `uiHelpers.ts:81,90,106,121` passam a usar o design system (`packages/ui`). Não é segurança; entra como item próprio, separado dos achados de segurança, para não misturar diff de UX com diff de correção de vulnerabilidade.

**D5 · Headers de hardening vão para a borda** (Transform Rule na zona). Detalhe e custos aceitos em §D5. CSP fica por app.

**D6 · `downloads` — remover os `add_header`**, depois da regra existir e ser validada. Sequência em §D6.

**D7 · Falso-positivos do Snyk: não registrar.** Os 23 falso-positivos desta rodada vão reaparecer no próximo scan e serão triados de novo. O mantenedor decidiu **não** criar fonte durável para isso. Sem ação, sem débito, sem entrada em `AGENTS.md`. Registrado aqui só para que a ausência seja deliberada e não pareça esquecimento.

---

## Evidência — leitura read-only, zero escrita

**Claude:**
`uiHelpers.ts` (1-131) · `tableViewMapper.ts` (25-72) · `tableValidators.ts` (1-55) · `gmPanel.ts` (395-434) · `chatExporterFolderImportService.ts` (30-104) · `media-store.ts` (1-40) · `TableContactsBlock.tsx` (35-74) · `MestreContactMethods.tsx` (85-179) · `chatExporterAutomation.ts` (44-73, 605-639) · `downloads/frontend/nginx.conf` · `rtk rg` sobre `helmet`, `express.static|sendFile`, `actionUrl`, `discord_server_url`, `storeUpload`, `csp`

**Codex:** 32/32 subissues, com citação arquivo:linha por veredito.

Nenhum arquivo modificado. Nenhum comando de escrita. Nenhum PoC. Nenhuma requisição dinâmica contra produção.
