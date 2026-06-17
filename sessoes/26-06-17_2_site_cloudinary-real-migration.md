# Sessao 26-06-17_2 — site Cloudinary real (BL-QA-SITE-IMAGES)

Data: 2026-06-17
Modulo/projeto: `apps/site`
Gate: Fase C de `BL-QA-SITE-IMAGES`; Gate C/WP raiz fora de escopo

## Objetivo

Executar migracao real controlada das imagens usadas do site beta para Cloudinary, depois de publicar no beta o importador tolerante do PR #49.

## Regras aplicadas

- WP raiz: somente GET/read-only. Nada de write WP/DNS/Tunnel/WAF.
- Escrita separada exige aprovacao nominal: deploy, DB write/import, upload Cloudinary, commit/push.
- Read-only na VM permitido.
- Bug/falha achado vira registro no mesmo turno.

## T0/T1 lidos

- `.specify/memory/project-state.md`
- `docs/agents/context-capsule.md`
- `.specify/memory/decisions.md`
- `specs/backlog.md`
- `sessoes/26-06-17_1_site_cloudinary-codex-handoff.md`
- `docs/agents/infra-map.md`
- `docs/agents/deploy-flow.md`
- `sessoes/index.md`

## Passo 0 — pre-flight read-only

Containers:

```text
site-beta-app Up healthy
site-beta-db  Up healthy
```

Env filtrado:

```text
CLOUDINARY_URL=<present>
SITE_MIGRATE_MEDIA ausente/vazio
```

Clone beta antes do deploy:

```text
/opt/artificio-beta local=d077185c2fd263dc33a82629bc56930e887c62c6
origin/dev=ada1b95a5a8f862ad8ce788f226a8d8c7c2caa01
```

Baseline DB:

```text
media_map=25
media_cloudinary_not_null=16
posts_wp=95
pages_wp=6
```

HTTP antes:

```text
https://beta.artificiorpg.com/ -> 200
/healthz -> {"ok":true,"posts":125}
```

## Passo 1 — deploy beta autorizado

Aprovacao nominal do mantenedor: "autorizado" para deploy beta do site com codigo novo.

Comando previsto no prompt estava obsoleto:

```text
gh workflow run deploy-site.yml --ref dev -f mode=deploy
```

Falha read-only/operacional:

```text
HTTP 422: Workflow does not have 'workflow_dispatch' trigger
```

Diagnostico: `deploy-site.yml` foi deletado/absorvido pela Spec 026 F4; workflow atual e unico `deploy`, via manifesto.

Comando equivalente executado:

```text
gh workflow run deploy --ref dev -f module=site -f mode=deploy -f env=beta
```

Run:

```text
27700261049
```

Resultado:

```text
verde
site-beta-app Up healthy
site-beta-db  Up healthy
home=200
blog=200
/healthz -> {"ok":true,"posts":125}
/opt/artificio-beta local=origin/dev=ada1b95a5a8f862ad8ce788f226a8d8c7c2caa01
container contem failedThisRun/stripSizeSuffix
```

Backlog novo: nenhum. Motivo: a falha do comando antigo foi drift do handoff/prompt versus workflow canonico atual; `docs/agents/deploy-flow.md` e o workflow atual ja documentam `deploy` unico. Registrar aqui basta para retomada desta sessao.

## Proximo gate

Pedir aprovacao nominal separada para:

- backup read-only antes do import;
- import real one-shot com `SITE_MIGRATE_MEDIA=true` (DB write + upload Cloudinary);
- export/build no container como continuidade do mesmo bloco autorizado.

Nao seguir para import sem aprovacao.

## Passo 2/3 — backup + import real + export/build autorizados

Aprovacao nominal do mantenedor: "autorizado" para backup, import real, export/build e smokes read-only.

Backup local antes do import:

```text
C:\projetos\artificiobackup\site-cloudinary\site-beta-before-cloudinary-20260617-123305.sql
tamanho=3954354 bytes
```

Import real:

```text
docker exec -e SITE_MIGRATE_MEDIA=true site-beta-app sh -lc "cd /repo && pnpm --filter @artificio/site run import"
exit=0
migradas=332
falhas=9
```

Falhas relatadas pelo importador:

```text
https://artificiorpg.com/wp-content/uploads/2025/03/Free5e-Players-Guide.webp
https://artificiorpg.com/wp-content/uploads/2025/03/mesa-presencial-2.webp?_t=1741364008
https://artificiorpg.com/wp-content/uploads/2025/03/foundry_demo-2.webp?_t=1741364029
https://artificiorpg.com/wp-content/uploads/2025/03/Exemplo-covil-do-lich-1200x635.webp?_t=1741364045
https://artificiorpg.com/wp-content/uploads/2025/03/larp-exemplo-1.webp?_t=1741364081
https://artificiorpg.com/wp-content/uploads/2025/02/Daggerheart-Core-Set.avif
https://artificiorpg.com/wp-content/uploads/2025/02/Daggerheart-Expanded-Set.avif
https://artificiorpg.com/wp-content/uploads/2025/02/Matt-Mercer-Behind-DM-Screen.avif
https://artificiorpg.com/wp-content/uploads/2025/01/Jason-Bulmahn-1024x577.jpg.webp
```

Status HTTP das falhas:

```text
404 Free5e-Players-Guide.webp
404 mesa-presencial-2.webp?_t=1741364008
404 foundry_demo-2.webp?_t=1741364029
404 Exemplo-covil-do-lich-1200x635.webp?_t=1741364045
404 larp-exemplo-1.webp?_t=1741364081
200 Daggerheart-Core-Set.avif
200 Daggerheart-Expanded-Set.avif
200 Matt-Mercer-Behind-DM-Screen.avif
404 Jason-Bulmahn-1024x577.jpg.webp
```

Export/build:

```text
pnpm --filter @artificio/site run export
pnpm --filter @artificio/site run build
exit=0
export: 125 posts, 10 pages
build: 220 pages, Pagefind 125 pages
```

## Passo 4 — verificacao pos-import

Smokes HTTP:

```text
home=200
post_lunatar=200
page_sobre=200
/healthz -> {"ok":true,"posts":125}
```

Contagens DB:

```text
media_map: 25 -> 357
media.cloudinary_url NOT NULL: 16 -> 124
posts com wp-content/uploads: 95 -> 40
pages com wp-content/uploads: 6 -> 0
media rows=124
```

Refs WP restantes:

```text
distinct_posts_wp_urls=58
distinct_pages_wp_urls=0
dist grep: wpcontent_lines=179, wpcontent_files=125
```

Discrepancia versus expectativa: o handoff esperava cerca de 6 URLs WP irrecuperaveis, mas restaram 58 URLs distintas no conteudo de posts. Analise: a maior parte nao e imagem alvo desta fatia (`.ogg`, `.mp3`, `.pdf`, `.webm`); alem disso 9 URLs de imagem ficaram em WP por falha de upload. O importador tambem relatou motivo como `[object Object]`, insuficiente para diagnostico fino.

## Backlog

Atualizado:

- `BL-QA-SITE-IMAGES` fica `parcial-beta`: migracao real executada e beta OK, mas residual de 9 imagens + midias nao-imagem WP impede fechamento.
- Novo debito registrado dentro do mesmo BL: melhorar serializacao de erro Cloudinary (`[object Object]`) e decidir politica para AVIF 200 que falhou.

## Retomada — fix local de serializacao + diagnostico AVIF

Pedido do mantenedor: corrigir `failureReason` e diagnosticar os 3 AVIF. Nao houve aprovacao nominal para novo upload/import real; portanto a investigacao AVIF ficou read-only.

### Bug `failureReason`

Causa confirmada:

- Cloudinary retorna erro como objeto comum (`{ message, http_code, ... }`), nao necessariamente `Error`.
- `failureReason` so lia `.message` se `error instanceof Error`; caso contrario fazia `String(error)`.
- Resultado: `[object Object]` no relatorio.
- Impacto de seguranca/operacao: `isFatalCloudinaryError` usa regex sobre `failureReason`; erro global sem `http_code`, mas com `.message` de credencial/config, poderia virar toleravel.

Fix local aplicado em `apps/site/importer/media.ts`:

- extrai `.message`;
- extrai `.error.message`;
- fallback `JSON.stringify(error)`;
- fallback final `Object.prototype.toString.call(error)`.

Regressoes adicionadas em `apps/site/importer/media.test.ts`:

- objeto comum `{ message: "Invalid API key" }` e propagado como fatal;
- objeto comum `{ message: "Resource not found" }` registra motivo legivel em falha toleravel.

Validacoes:

```text
pnpm --filter @artificio/site test  -> 9/9
pnpm --filter @artificio/site build -> OK
```

### Diagnostico AVIF read-only

URLs:

```text
https://artificiorpg.com/wp-content/uploads/2025/02/Daggerheart-Core-Set.avif
https://artificiorpg.com/wp-content/uploads/2025/02/Daggerheart-Expanded-Set.avif
https://artificiorpg.com/wp-content/uploads/2025/02/Matt-Mercer-Behind-DM-Screen.avif
```

Resultado:

```text
HTTP 200
content-type: text/plain
bytes iniciais: 0000 001c 6674 7970 6176 6966 ... ("ftypavif")
```

Hipotese principal: arquivos sao AVIF validos, mas origem WP/Cloudflare serve MIME errado (`text/plain`), o que provavelmente fez o upload remoto da Cloudinary rejeitar/classificar mal o asset. Proximo diagnostico real exige upload controlado apos publicar a serializacao melhorada, com aprovacao nominal.

### Debitos nomeados

- `BL-SITE-MEDIA-ERR-SERIAL`
- `BL-SITE-AVIF-FAIL`
- `BL-SITE-NONIMG-MEDIA`
