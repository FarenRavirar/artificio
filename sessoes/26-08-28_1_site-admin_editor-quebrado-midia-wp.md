# 26-08-28_1 · `site-admin` — editor morto por duas cópias de prosemirror, 124 imagens em URL de WordPress e refresh do SSO em 503

**Estado:** **encerrada.** Defeitos 1 e 2 corrigidos, em produção e validados no navegador; Defeito 3 não se reproduz (era transitório). Editor entrou pela PR #295 (`main` = `dev` = `5f16f00`); `UPDATE` de mídia aplicado direto no banco com autorização nominal.
**Origem:** smoke manual do admin em produção (Chrome logado, autorizado pelo mantenedor) depois do deploy da PR #294. A listagem de posts, que era o alvo do teste, **voltou a funcionar** — os três defeitos abaixo são pré-existentes e independentes daquela correção.

---

## Resultado da investigação, em uma linha

O admin lista, filtra e navega. Três defeitos foram encontrados: editor que não monta (duas cópias de `prosemirror-model` e de `prosemirror-view` no bundle) e 124 imagens em 404 (URLs de um WordPress que não existe mais) — **ambos corrigidos e em produção**; e um `503` no refresh do SSO que **não se reproduz** e era transitório.

## O que foi verificado e está funcionando

| Seção | Estado | Evidência |
|---|---|---|
| Posts (listagem) | ✅ | tabela renderiza com ações Editar/Ver/Despublicar/Arquivar/Lixeira |
| Páginas | ✅ | tabela renderiza |
| Sistemas (catálogo) | ✅ | 1317 nós ativos, v1325, checksum `67a39bb3eef4` |
| Feedback | ✅ | renderiza; 1 item aberto |
| Filtro de status | ✅ | troca para "Lixeira" filtra corretamente (`Nenhum post`) |
| Header do portal | ✅ | nav cross-subdomínio + menu de conta (PR #294) |

**Ressalva de método:** a listagem só apareceu após `Ctrl+Shift+R`. O bundle antigo (`index-BOXOiPmr.js`) estava no cache do navegador do mantenedor; o correto é `index-Del_ExNn.js`. Sem hard reload o admin parecia continuar quebrado.

**Erro de leitura registrado:** numa primeira passagem a Mídia foi reportada como "OK" a partir do screenshot. Era falso — o que a grade exibia era o **alt text** de cada imagem, não a imagem. O mantenedor apontou; a medição abaixo confirmou 404.

---

## Defeito 1 — editor de conteúdo não monta (mais grave)

**Sintoma:** tela branca ao abrir qualquer post (`/admin/posts/18623`) **e também** em `/admin/posts/new`, que não tem conteúdo nenhum — o que descarta dado corrompido como causa.

**Console:**

```
[editor] load falhou RangeError: Can not convert <"Traduzir Dungeons & Dragons..."> to a Fragment
(looks like multiple versions of prosemirror-model were loaded)
```

Seguido de `TypeError: Cannot read properties of undefined (reading 'localsInner')` na montagem e na desmontagem da view — dano secundário do mesmo problema.

**Causa medida** (`rtk pnpm why prosemirror-model`):

| versão | quem puxa |
|---|---|
| `prosemirror-model@1.25.7` | `@blocknote/core@0.51.4` (direto) |
| `prosemirror-model@1.25.11` | `@tiptap/pm@3.26.0` ← `@blocknote/core@0.51.4` |

As duas cópias entram no bundle. O ProseMirror rejeita nó criado pela outra instância, e o documento nunca é construído.

**Consequência:** criar e editar post e página estão indisponíveis. É o que bloqueia, entre outras coisas, a correção do link do glossário (ver Pendências).

**CORRIGIDO e em produção** — PR #295, dois overrides em `pnpm-workspace.yaml`
(`prosemirror-model` e `prosemirror-view`). Unificar só o `model` não bastou: matou o
`RangeError` e o editor seguiu quebrado em `localsInner`, código do `view`. O raciocínio
completo está nos comentários do próprio `pnpm-workspace.yaml`.

**Verificação no bundle servido** — a mensagem `multiple versions of prosemirror-model`
existe uma vez por cópia embutida da lib, então contá-la mede a duplicata direto:

| bundle | ocorrências |
|---|---|
| prod antes (`index-Del_ExNn.js`, 1.485.793 B) | **2** |
| prod agora (`index-gir4h54x.js`, 1.350.988 B) | **1** |

Prod é byte-a-byte idêntico ao validado em beta (`cmp` → igual). Lock com uma versão de
cada: `prosemirror-model@1.25.11`, `prosemirror-view@1.42.2`.

**Validação no Chrome logado, em produção** (autorizada): `/admin/posts/18623` — o post que
dava tela branca — monta completo, com corpo formatado, imagem inline e painéis;
`/admin/posts/new` monta com o placeholder do BlockNote; **console sem uma única mensagem**
após hard reload com tracking ligado desde o load. Digitação testada num parágrafo e
desfeita em seguida — **nada foi salvo**.

## Defeito 2 — as 124 imagens da biblioteca estão quebradas

**Sintoma:** a grade de Mídia mostra alt text no lugar das imagens.

**Medição do payload** (`GET /api/admin/v1/media`, responde `200`):

```json
{ "id": "18625", "source": "wp",
  "url": "https://artificiorpg.com/wp-content/uploads/2026/03/Glossario-Unificado-para-Traducoes-de-DD.webp" }
```

`curl` nessas URLs: **404**. O caminho `/wp-content/uploads/` é do WordPress, que não existe mais — o site é Astro.

**Alcance, medido no banco de produção (read-only):**

```
SELECT source, COUNT(*) FROM media GROUP BY source;  →  wp | 124
```

**O blog público NÃO está afetado.** As imagens dos posts publicados usam Cloudinary (`res.cloudinary.com/dnln0btbo/...`) e respondem `200`. O conteúdo migrou; a tabela `media` do admin ficou para trás.

**Correção proposta (não aplicada):** existe `media_map` (444 linhas, `wp_url` → `cloudinary_url`). Cobertura medida:

```
SELECT COUNT(*) FILTER (WHERE mm.cloudinary_url IS NOT NULL) AS com_mapa,
       COUNT(*) FILTER (WHERE mm.cloudinary_url IS NULL)     AS sem_mapa
FROM media m LEFT JOIN media_map mm ON mm.wp_url = m.url;
→ com_mapa=124 · sem_mapa=0
```

**100% de cobertura**, sem risco de deixar registro órfão.

**CORRIGIDO em produção** (2026-08-28, autorização nominal do mantenedor):

```sql
BEGIN;
UPDATE media SET url = mm.cloudinary_url FROM media_map mm WHERE mm.wp_url = media.url;
COMMIT;
```

`UPDATE 124`. Antes: 124 em `/wp-content/`, 0 em Cloudinary. Depois: **0 em `/wp-content/`,
124 em Cloudinary, total 124** — nenhuma linha perdida.

Backup: `pg_dump -t media --data-only` → `/tmp/media_backup_20260828.sql` na VM (158 linhas).

`source` foi deixado como `wp` de propósito: mudá-lo para `cloudinary` foi levantado como
dúvida ao mantenedor e não houve resposta, então o `UPDATE` mexeu só na URL. Fica como
inferência a confirmar — o campo hoje não descreve a realidade.

**Verificação:** amostra aleatória de 6 URLs gravadas → todas `200`. Reconfirmado no Chrome
logado (2026-08-28, após o deploy de prod): a grade de `/admin/media` renderiza as imagens
de verdade, não mais o alt text.

## Defeito 3 — refresh de sessão do SSO devolveu 503 (transitório)

`GET https://accounts.artificiorpg.com/api/auth/refresh` → **503**, capturado uma vez na aba de rede do admin.

Combina com o que o log do `site-prod-app` já mostrava:

```
[community] falha ao falar com accounts
  path: '/internal/v1/comments?subject_type=site.post&subject_id=17382&sort=best'
  error: 'The operation was aborted due to timeout'
```

A leitura inicial foi de que a sessão quebraria ao expirar o access token. **NÃO SE REPRODUZ.** Medido depois:

| medição | resultado |
|---|---|
| `GET /api/auth/refresh` sem cookie | **401** (correto), 5 chamadas seguidas, nenhum 503 |
| `GET /api/auth/refresh` com cookie inválido | 401 |
| `accounts-api` | up 21h, **healthy**, **0 restarts** |
| log do `accounts-api`, 4h | zero `error`/`503`/`timeout` |
| `falha ao falar com accounts` no `site-prod-app`, 24h | **0 ocorrências** |

O `503` foi transitório. Os timeouts `site→accounts` vinham do log **anterior** ao deploy
do site de hoje; o container foi recriado e o sintoma não voltou. Nada a corrigir —
registrado para o caso de reaparecer.

---

## Correções de borda e código aplicadas antes desta sessão (contexto)

Feitas hoje, já em produção, e **não** são causa dos defeitos acima:

- **PR #293** (mesas): `avg_rating` NUMERIC vindo como string derrubava o catálogo. Cast `::float8` + normalização no `packages/ui`.
- **PR #294** (site + site-admin): `id` BIGINT vindo como string reprovava todo item e deixava o admin inteiro inacessível; `Cache-Control: no-store` em `/api` e `/admin`; Header do portal no admin.
- **Cloudflare, regra de cache `29ec12a0…`** (v55→58): `/api/` e `/admin/` excluídos do "Cache Everything". A regra tinha lista de exceções herdada do WordPress e servia `GET /api/admin/v1/posts` com 50 registros a qualquer anônimo (`HIT`, `Age 482s`).
- **Cloudflare, regra "Teste" `1aa53732…`**: removida (apontava para `teste.artificiorpg.com`, host sem DNS).
- **Cloudflare, redirect novo**: `glossariorpg.artificiorpg.com` → `glossario.artificiorpg.com` (301, path e query preservados). O hostname **nunca existiu**; o link errado foi publicado no post do blog. Há feedback real de usuário reportando o link quebrado (06/07/2026).

---

## Pendências

- **Link do glossário no post** continua `glossariorpg.artificiorpg.com` (3 ocorrências no post `18623`, visíveis no editor). O redirect cobre quem clica, mas o conteúdo segue ensinando o endereço errado. **Desbloqueado** — o editor funciona; falta só editar o conteúdo.
- **`source = 'wp'` na tabela `media`**: o `UPDATE` mexeu só na URL, então o campo não descreve mais a realidade (as URLs são Cloudinary). Inferência a confirmar, não decisão registrada.
- **Débito da sessão `26-08-16_1`**: 6 erros de `eslint-plugin-react-hooks` no `site-admin`, ainda abertos. Não tocados aqui.
- **`Number(id)` no backend do `site`** (`asInt`/`parseId`): achado do Codex na PR #294, deliberadamente não aplicado — sem defeito medido, ids reais longe de 2^53.

## Estado final

| Defeito | Situação |
|---|---|
| 1 · editor não monta | ✅ em produção (PR #295) · validado no Chrome logado |
| 2 · 124 imagens 404 | ✅ em produção (`UPDATE 124`) · backup na VM · grade validada |
| 3 · refresh 503 | ⚪ não se reproduz · era transitório |

**Entrega da correção do editor** (2026-08-28): validação repo-wide antes do commit — lint
26/26, build 26/26, test 43/43 tasks. PR #295 mergeada; `main` = `dev` = `5f16f00`.
Deploy beta (`33196635254`) → promote fast-forward (`33197288000`) → deploy prod
(`33197321262`), os três verdes, os dois deploys com `deploy=true` no log. Admin responde
`200` com `Cache-Control: no-store, private` e `cf-cache-status: DYNAMIC`.

**Armadilha que reapareceu duas vezes nesta sessão:** o navegador serve o bundle antigo do
cache e o admin *parece* continuar quebrado depois de um deploy verde. `Ctrl+Shift+R` antes
de concluir qualquer coisa sobre o estado do admin em produção.
