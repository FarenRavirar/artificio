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
// `apps/site/src/pages/[slug].astro:16`:
//
//     const canonical = page.seo.canonical || `${n.origin}/${page.slug}/`;
//
// Ou seja: canonical explícito VENCE o fallback. Um canonical errado no dado não é
// corrigido por código nenhum adiante — é emitido como está. É exatamente por isso que
// a trava precisa ser sobre o dado (`posts.json`), e não sobre o template.
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
const TEMPLATE = "apps/site/src/pages/[slug].astro";

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

/** Caminho de uma URL absoluta ou relativa, sempre com barra inicial e sem query/hash. */
function caminhoDe(url) {
  const semProtocolo = url.replace(/^https?:\/\/[^/]+/i, "");
  const semQuery = semProtocolo.split(/[?#]/)[0];
  const comBarra = semQuery.startsWith("/") ? semQuery : `/${semQuery}`;
  return comBarra.endsWith("/") ? comBarra : `${comBarra}/`;
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

      const esperado = `/${slug}/`;
      const encontrado = caminhoDe(canonical);

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
const template = lerArquivo(TEMPLATE);
if (template && !template.includes("page.seo.canonical ||")) {
  failures.push(
    `${TEMPLATE}: perdeu o fallback \`page.seo.canonical || …\`. Com ele, post sem ` +
      `canonical explícito recebe o auto-referente; sem ele, fica sem canonical — e ` +
      `este guard, que valida só o dado, não acusaria.`,
  );
}

if (failures.length > 0) {
  console.error("G-A — canonical de post divergente da URL real:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("G-A OK — nenhum canonical de post diverge da própria URL.");
