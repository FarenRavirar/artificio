#!/usr/bin/env node
// G-A (spec 102, T5.2) — canonical de post não pode apontar para outra URL que não a
// própria.
//
// ## O defeito que este guard trava
//
// Medido na spec 102 (T3.2): **105 dos 126 posts** tinham `canonical` divergente da URL
// servida — herança da migração do WordPress, apontando para o domínio antigo. Efeito:
// o Google lê "a versão boa desta página está em outro lugar" e tira a URL real do
// índice. Nenhum teste quebrava, nenhum build falhava, e a página abria normalmente no
// navegador — o dano acontecia inteiro dentro do índice de busca.
//
// A limpeza foi `UPDATE posts SET canonical = NULL` nos 105, executada em produção com
// autorização nominal. Este guard existe para a 106ª não voltar em silêncio.
//
// ## Medição que define o formato do check (2026-09-13)
//
// `apps/site/src/data/posts.json` tem **8 posts** e o objeto `seo` carrega apenas
// `description` — **zero canonicals emitidos**, que é o estado pós-T3.2. Então o guard
// nasce verde, e a trava real é *"canonical presente E diferente da URL do post"*, não
// *"canonical ≠ URL"*: `canonical` ausente é o caso CORRETO e majoritário, porque o
// `[slug].astro` cai no fallback auto-referente.
//
// ## Como a URL real é montada, e por que o guard replica isso
//
// **A rota de post é `/blog/<slug>/`, não `/<slug>/`.** `apps/site/src/pages/blog/[slug].astro:21`:
//
//     const canonical = post.seo.canonical || `${SITE.origin}/blog/${post.slug}/`;
//
// A primeira versão deste guard comparava contra `/<slug>/` e apontava para
// `pages/[slug].astro` — que é a rota INSTITUCIONAL (sobre, contato, políticas) e nem
// consome `posts.json`: ele lê `pages` de `lib/content.ts`. Resultado medido: o guard
// **reprovava o canonical CORRETO** (`/blog/x/` → exit 1) e **aprovava o errado**
// (`/x/` → exit 0), ou seja, travava exatamente ao contrário. Achado P2 do Codex na
// PR #320, reproduzido antes de corrigir.
//
// Canonical explícito VENCE o fallback. Um canonical errado no dado não é corrigido
// por código nenhum adiante — é emitido como está. É por isso que a trava precisa ser
// sobre o dado (`posts.json`), e não sobre o template.
//
// ## ⚠️ LIMITE DE ALCANCE — este guard NÃO vê o conteúdo de produção
//
// Medido em 2026-09-14: `ci.yml:125` roda `pnpm smoke:post-canonical`, e **nenhum
// workflow executa `db/export.ts`**. O `posts.json` versionado é seed congelado de 8
// posts (`apps/site/Dockerfile:62-64`), enquanto o banco tem 125 — o conteúdo real só
// é gerado no entrypoint do container, depois do CI. Consequência: um canonical
// divergente persistido pelo admin entra no próximo rebuild de produção sem tocar este
// arquivo, e este guard continua verde.
//
// O que ele trava de fato: regressão introduzida no dado VERSIONADO (seed, fixture, ou
// alguém recommitando export). O que ele NÃO trava: o caminho de escrita do admin, que
// é justamente por onde vieram os 105 canonicals errados da T3.2.
//
// A validação de escrita JÁ EXISTE e está ligada — só não cobre este caso. Medido em
// 2026-09-14: `apps/site/server/admin-api.ts:422` (`rejectBadCanonical`) roda nas quatro
// rotas de escrita (`POST /posts`, `PUT /posts/:id`, `POST /pages`, `PUT /pages/:id`,
// linhas 79/92/142/152) e devolve 400 quando `normalizeCanonical` acusa erro. Mas
// `normalizeCanonical` (`packages/content/src/canonical.ts:41`) valida FORMA — protocolo,
// host permitido, credencial embutida, barra final — e nunca IGUALDADE com a URL do
// post. Medido: ela aceita `https://artificiorpg.com/blog/OUTRO-POST/` e
// `https://artificiorpg.com/qualquer/coisa/` como válidos.
//
// Ou seja: o admin barra canonical para host externo, e deixa passar canonical para
// outra página do próprio site — que é exatamente a forma dos 105 canonicals da T3.2.
//
// Fechar isso é decisão do mantenedor, porque muda comportamento do admin: acrescentar
// a `rejectBadCanonical` a checagem "canonical != URL do próprio post → 400" (o slug já
// está em mãos nas quatro rotas). A alternativa — rodar este guard contra o export real
// — exige banco no CI. Achado P2 do Codex, PR #320, reproduzido antes de registrar.
//
// O `origin` vem de `PUBLIC_SITE_URL` (env), diferente em beta e prod, então o guard
// **não compara host**: compara o CAMINHO. Canonical de post apontando para outro
// caminho é defeito em qualquer ambiente; apontar para o mesmo caminho em outro host é
// a configuração legítima de beta.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const POSTS = "apps/site/src/data/posts.json";
/** Rota que de fato consome `posts.json`. A institucional (`pages/[slug].astro`) não. */
const TEMPLATE = "apps/site/src/pages/blog/[slug].astro";
/** Prefixo da rota de post, preservado no cutover do WordPress (D047/D019). */
const PREFIXO_DA_ROTA = "/blog";

const failures = [];

function lerArquivo(caminhoRelativo) {
  try {
    return readFileSync(resolve(ROOT, caminhoRelativo), "utf8");
  } catch (error) {
    failures.push(
      `${caminhoRelativo}: não foi possível ler (${error.code ?? error.message}). ` +
        `Se o arquivo mudou de lugar, atualize este guard — não o remova.`,
    );
    return null;
  }
}

/**
 * Partes de um canonical absoluto, via `new URL()` — nunca por recorte de string.
 *
 * Duas coisas que o recorte errava, ambas medidas (achados P2 do Codex, PR #320):
 *
 *   1. Descartar query/fragmento fazia `…/blog/foo/?variant=wrong` comparar igual a
 *      `/blog/foo/` e o guard devolvia `G-A OK` exit 0. E passar era errado:
 *      `normalizeCanonical` (`packages/content/src/canonical.ts:41`) nunca toca em
 *      `url.search`, e `[slug].astro:21,43` publica o valor literal — a página se
 *      declarava canônica para uma variante que não é a URL real.
 *   2. `replace(/^https?:\/\/[^/]+/i, "")` descartava a AUTORIDADE inteira, então
 *      `https://accounts.artificiorpg.com/blog/x/` e `https://artificiorpg.com:444/blog/x/`
 *      passavam como se fossem `/blog/x/` — canonical para URL que não existe.
 *
 * `URL` resolve as duas por construção: `origin` carrega esquema, host e porta, e
 * `search`/`hash` vêm separados em vez de sumirem.
 *
 * O guard NÃO compara origem contra uma allowlist fixa: `PUBLIC_SITE_URL` difere entre
 * prod e beta, e um canonical `https://beta.…` em beta é a configuração legítima. O que
 * ele compara é CAMINHO, e quem valida a origem é o caminho de escrita
 * (`apps/site/server/admin-api.ts`), que conhece o `SITE.origin` do próprio ambiente.
 */
function partesDe(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  return {
    origem: u.origin,
    caminho: u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`,
    sufixo: `${u.search}${u.hash}`,
  };
}

const cru = lerArquivo(POSTS);

if (cru) {
  let posts;
  try {
    posts = JSON.parse(cru);
  } catch (error) {
    failures.push(`${POSTS}: JSON inválido (${error.message}).`);
    posts = null;
  }

  if (posts && !Array.isArray(posts)) {
    failures.push(`${POSTS}: esperado um array de posts, veio ${typeof posts}.`);
    posts = null;
  }

  if (posts) {
    // Artefato gerado pelo export contra o banco. Vazio significa export que não rodou
    // ou rodou contra banco vazio — e um guard sobre lista vazia passa verde provando
    // nada, que é o modo de falha deste tipo de check.
    if (posts.length === 0) {
      failures.push(
        `${POSTS}: nenhum post. É artefato do export (\`pnpm --filter @artificio/site ` +
          `export\`); vazio aqui significa export não executado, e este guard não teria ` +
          `o que verificar.`,
      );
    }

    for (const post of posts) {
      const slug = typeof post?.slug === "string" ? post.slug : null;
      if (!slug) {
        failures.push(`${POSTS}: post sem \`slug\` — não dá para derivar a URL real.`);
        continue;
      }

      const canonical = post?.seo?.canonical;
      // Ausente é o caso correto: o template cai no fallback auto-referente.
      if (canonical == null || canonical === "") continue;

      if (typeof canonical !== "string") {
        failures.push(`${slug}: \`seo.canonical\` não é string (${typeof canonical}).`);
        continue;
      }

      const esperado = `${PREFIXO_DA_ROTA}/${slug}/`;
      const partes = partesDe(canonical);
      if (!partes) {
        failures.push(`${slug}: \`seo.canonical\` não é uma URL válida (${canonical}).`);
        continue;
      }
      const { caminho: encontrado, sufixo } = partes;

      // Query/fragmento no canonical é sempre defeito, mesmo com o caminho certo: a
      // página se declara canônica para uma VARIANTE dela mesma, e o Google segue a
      // declaração. `?utm_source=` colado pelo admin é o caso real.
      if (sufixo) {
        failures.push(
          `${slug}: canonical carrega \`${sufixo}\` — canonical auto-referente não tem ` +
            `query nem fragmento.\n` +
            `    \`normalizeCanonical\` preserva os dois e o template publica literal, ` +
            `então a página\n` +
            `    aponta para uma variante em vez da própria URL. Remova o sufixo (ou o ` +
            `canonical inteiro,\n` +
            `    se a intenção é auto-referente).`,
        );
      }

      if (encontrado !== esperado) {
        failures.push(
          `${slug}: canonical aponta para \`${encontrado}\`, e a URL do post é ` +
            `\`${esperado}\`.\n` +
            `    Canonical explícito VENCE o fallback (${TEMPLATE}), então isto é ` +
            `emitido como está\n` +
            `    e tira a URL real do índice. Foi o defeito de 105 dos 126 posts ` +
            `(spec 102 T3.2).\n` +
            `    Se a intenção é auto-referente, o certo é NÃO emitir canonical.`,
        );
      }
    }
  }
}

// O guard acima é sobre o dado. Se o template deixar de usar o fallback auto-referente,
// post sem canonical passa a não ter canonical nenhum — e o dado limpo deixa de bastar.
//
// Casa a ATRIBUIÇÃO INTEIRA, com comentário removido antes: `includes("post.seo.canonical ||")`
// sozinho aceitaria o texto sobrevivendo num comentário depois de a atribuição sumir, e
// aceitaria também um fallback apontando para outro caminho (achado do CodeRabbit,
// PR #320). O prefixo da rota entra no padrão porque é ele que define a URL correta.
const template = lerArquivo(TEMPLATE);
if (template) {
  const codigo = template.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  // O prefixo sai de `PREFIXO_DA_ROTA`, não literal: com `/blog/` escrito aqui, mudar a
  // constante deixaria o check do dado e o do template medindo rotas diferentes — e o
  // template passaria verde apontando para a rota antiga (achado do CodeRabbit, PR #320).
  const prefixoNaRegex = PREFIXO_DA_ROTA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const atribuicao = new RegExp(
    String.raw`const\s+canonical\s*=\s*post\.seo\.canonical\s*\|\|\s*` +
      String.raw`\`\$\{SITE\.origin\}${prefixoNaRegex}/\$\{post\.slug\}/\``,
  );

  if (!atribuicao.test(codigo)) {
    failures.push(
      `${TEMPLATE}: não tem mais a atribuição\n` +
        "    `const canonical = post.seo.canonical || `${SITE.origin}/blog/${post.slug}/`;`\n" +
        `    Com o fallback, post sem canonical explícito recebe o auto-referente; sem ` +
        `ele, fica\n` +
        `    sem canonical — e este guard, que valida o dado, não acusaria. Se a rota ` +
        `mudou,\n` +
        `    atualize PREFIXO_DA_ROTA aqui junto.`,
    );
  }
}

if (failures.length > 0) {
  console.error("G-A — canonical de post divergente da URL real:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("G-A OK — nenhum canonical de post diverge da própria URL.");
