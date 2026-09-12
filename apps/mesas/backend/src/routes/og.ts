import { Router, Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { sql } from 'kysely';
import escapeHtmlLib from 'escape-html';
import { db } from '../db/index.js';
import { upgradeGoogleImageQuality } from '@artificio/media/image-kinds';
import { classifyTablePublicDisposition } from '../utils/tableVisibility.js';
import { sanitizePublicImageUrl } from '../utils/publicImageUrl.js';
import { hydrateTableSystemFields } from '../services/systemCatalogProvider.js';
import { buildTableDescription, buildGmDescription } from '../utils/ogDescription.js';

const router = Router();

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';
const SITE_NAME = 'Artifício Mesas';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
const INDEX_HTML_PATH = process.env.INDEX_HTML_PATH || '/app/frontend-dist/index.html';

let cachedIndexHtml: string | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

async function loadIndexHtml(): Promise<string> {
  const now = Date.now();
  if (cachedIndexHtml && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedIndexHtml;
  }

  const raw = await readFile(INDEX_HTML_PATH, 'utf-8');
  cachedIndexHtml = raw;
  cacheLoadedAt = now;
  return raw;
}

// Lib padrao escape-html (achado SonarCloud "reflected XSS" PR #151,
// 2026-07-12): a implementacao custom escapava os mesmos caracteres, mas o
// Sonar nao reconhece funcao local como sanitizador confiavel no seu
// data-flow — trocado pra lib conhecida fecha o alerta sem mudar o
// comportamento (mesmo conjunto de entidades: & < > " ').
function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return escapeHtmlLib(String(input));
}

interface MetaFields {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
  ogType: 'website' | 'profile';
  extraProfile?: Record<string, string>;
}

function injectMetaTags(html: string, meta: MetaFields): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const imageUrl = escapeHtml(meta.imageUrl);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);

  let profileExtra = '';
  if (meta.extraProfile) {
    for (const [key, value] of Object.entries(meta.extraProfile)) {
      profileExtra += `\n    <meta property="${escapeHtml(key)}" content="${escapeHtml(value)}">`;
    }
  }

  const metaBlock = `
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="${meta.ogType}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
    <meta property="og:locale" content="pt_BR">${profileExtra}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
  `.trim();

  // Remove meta tags OG/Twitter duplicadas do index.html
  let output = html
    .replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?\s*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?\s*>/gi, '')
    .replace(/<!--\s*Open Graph fallback[\s\S]*?-->/gi, '')
    .replace(/<!--\s*Twitter Card fallback[\s\S]*?-->/gi, '');

  // Substitui o <title> pelas novas meta tags
  output = output.replace(/<title>[\s\S]*?<\/title>/i, metaBlock);

  if (output === html) {
    output = html.replace('</head>', `${metaBlock}\n  </head>`);
  }

  return output;
}

/**
 * Remove o `<link rel=canonical>` do HTML servido em resposta de erro
 * (spec 102, T1.2/T1.3).
 *
 * `injectMetaTags` emite canonical sempre, porque para página existente ele é
 * obrigatório. Em `404`/`410` ele é ativamente nocivo: a página se declara a
 * versão canônica da própria URL que está sendo removida do índice, reafirmando
 * ao crawler o endereço que o status manda esquecer.
 *
 * Retirar aqui, e não tornar o campo opcional em `MetaFields`, mantém canonical
 * como padrão não-negociável — só o caminho de erro abre exceção, e ela fica
 * visível num lugar só.
 */
function stripCanonical(html: string): string {
  return html.replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '');
}

function toAbsoluteSiteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${SITE_URL}${path}`;
}

function resolveOgImageUrl(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const sanitized = sanitizePublicImageUrl(candidate);
    if (!sanitized) continue;
    const absolute = toAbsoluteSiteUrl(upgradeGoogleImageQuality(sanitized, 400));
    if (absolute) return absolute;
  }
  return DEFAULT_OG_IMAGE;
}

function getFallbackMeta(pathname = '/'): MetaFields {
  return {
    title: 'Artifício Mesas — Encontre sua próxima aventura de RPG',
    description:
      'Plataforma gratuita para encontrar mesas de RPG. Descubra mestres e aventuras de D&D, Pathfinder e outros sistemas.',
    imageUrl: DEFAULT_OG_IMAGE,
    canonicalUrl: `${SITE_URL}${pathname}`,
    ogType: 'website',
  };
}

router.get('/:type/:slug', async (req: Request, res: Response) => {
  const { type, slug } = req.params;

  try {
    const html = await loadIndexHtml();

    // Tipos de entidade com páginas OG dinâmicas
    if (type === 'mestre') {
      const gm = await db
          .selectFrom('gm_profiles as gm')
          .innerJoin('users as u', 'u.id', 'gm.user_id')
          // `profiles` é opcional (ver GET /gm/perfis/:slug). Aqui o custo do
          // `innerJoin` era o maior dos quatro: esta rota serve CRAWLER
          // (Google, WhatsApp, Discord), então 22 dos 48 mestres estavam sendo
          // indexados como "Mestre não encontrado" — dano de SEO invisível na
          // navegação normal. Medido em produção 2026-08-27.
          .leftJoin('profiles as p', 'p.user_id', 'u.id')
          .select([
            sql<string>`COALESCE(gm.nickname, p.display_name, gm.slug)`.as('display_name'),
            'gm.bio_long',
            'gm.tagline',
            sql<string>`COALESCE(gm.avatar_url, p.avatar_url)`.as('avatar_url'),
            'gm.banner_url',
            'gm.slug',
          ])
          .where('gm.slug', '=', slug)
          .executeTakeFirst();

        if (!gm) {
          // Mesmo soft-404 das mesas (T1.2): slug de mestre inexistente
          // devolvia `200` com "Mestre não encontrado" e canonical
          // auto-referente. Perfil não tem estado "encerrado" — ou o slug
          // existe, ou nunca existiu —, então aqui só há `404`, sem `410`.
          const htmlNotFound = stripCanonical(
            injectMetaTags(html, {
              ...getFallbackMeta(`/mestre/${encodeURIComponent(slug)}`),
              title: 'Mestre não encontrado — Artifício Mesas',
            }),
          );

          return res.status(404).type('html').send(htmlNotFound);
        }

        const displayName = gm.display_name || 'Mestre de RPG';
        const title = `${displayName} — Mestre de RPG | ${SITE_NAME}`;
        const description = buildGmDescription({
          tagline: gm.tagline,
          bioLong: gm.bio_long,
          displayName,
          siteName: SITE_NAME,
        });
        
        // Aumenta tamanho de imagens do Google para atender requisitos do Facebook (mínimo 200x200)
        let imageUrl = gm.avatar_url || gm.banner_url || DEFAULT_OG_IMAGE;
        imageUrl = upgradeGoogleImageQuality(imageUrl, 400);

        const output = injectMetaTags(html, {
          title,
          description,
          imageUrl,
          canonicalUrl: `${SITE_URL}/mestre/${encodeURIComponent(gm.slug)}`,
          ogType: 'profile',
          extraProfile: {
            'profile:username': gm.slug,
          },
        });

        return res.status(200).type('html').send(output);
    } else if (type === 'mesas') {
      // Achado Codex (PR #145): system_id agora referencia o catalogo central,
      // leftJoin('systems' LOCAL) sempre NULL pra mesas do fluxo novo — join
      // removido, hidratacao via hydrateTableSystemFields apos a query.
      const rawTable = await db
        .selectFrom('tables as t')
        .leftJoin('gm_profiles as gm', 'gm.id', 't.gm_id')
        .leftJoin('users as u', 'u.id', 'gm.user_id')
        .leftJoin('profiles as p', 'p.user_id', 'u.id')
        .select([
          't.slug',
          't.title',
          't.description',
          't.banner_url',
          sql<string | null>`t.banner_url`.as('cover_url'),
          't.status',
          't.archived_at',
          't.origin',
          't.created_at',
          't.starts_at',
          't.listing_excerpt',
          't.synopsis',
          't.synopsis_narrative',
          't.system_id',
          sql<string>`COALESCE(gm.nickname, p.display_name)`.as('gm_display_name'),
        ])
        .where('t.slug', '=', slug)
        .executeTakeFirst();

      const table = rawTable ? (await hydrateTableSystemFields([rawTable]))[0] : rawTable;

      // T1.2/T1.3 (spec 102). Antes, este ramo respondia `200` para tudo que
      // não fosse visível — inclusive slug inexistente. Isso é soft-404: o
      // Google não indexa a URL E segue gastando crawl budget do domínio nela.
      // Medido em produção: 51 das 92 URLs do sitemap do `mesas` devolviam
      // `200` com "Mesa não encontrada", que é a origem das 736 páginas em
      // "Rastreada, mas não indexada" que abriu esta spec.
      //
      // A classificação é a MESMA de `routes/tables.ts` de propósito — ambas
      // chamam `classifyTablePublicDisposition`. Crawler e API divergirem sobre
      // o que é uma mesa encerrada foi o defeito que criou o problema.
      // Sem `<link rel=canonical>` auto-referente nas respostas de erro abaixo:
      // a URL declarar-se canônica enquanto é removida reafirma ao índice
      // exatamente o endereço que o status manda esquecer. `injectMetaTags`
      // sempre emite canonical, então a remoção é explícita.
      const renderErro = (title: string, description?: string): string =>
        stripCanonical(
          injectMetaTags(html, {
            ...getFallbackMeta(`/mesas/${encodeURIComponent(slug)}`),
            title,
            ...(description ? { description } : {}),
          }),
        );

      if (!table) {
        return res
          .status(404)
          .type('html')
          .send(renderErro('Mesa não encontrada — Artifício Mesas'));
      }

      const disposicao = classifyTablePublicDisposition(table);

      if (disposicao !== 'ok') {
        const encerrada = disposicao === 'gone';

        const htmlErro = encerrada
          ? renderErro(
              `${table.title} — mesa encerrada | ${SITE_NAME}`,
              `Esta mesa foi encerrada e não recebe mais inscrições. Veja outras mesas de RPG abertas no ${SITE_NAME}.`,
            )
          : renderErro('Mesa não encontrada — Artifício Mesas');

        // `410 Gone` para mesa que existiu e saiu do ar; `404` para slug que
        // nunca existiu. O Google trata todos os `4xx` (exceto `429`) igual,
        // então a escolha é de SEMÂNTICA, não de velocidade: no Search Console
        // `404` passa a significar "slug errado" e `410`, "mesa encerrada" —
        // dois defeitos com causas diferentes, que num código só ficariam
        // indistinguíveis.
        //
        // O corpo segue sendo o app completo: o `index.html` monta a tela "Mesa
        // Encerrada" a partir do `410` da API (`buildClosedTablePayload`), com
        // título, data e a conversa preservada. Status de erro e página útil
        // não são excludentes — o link antigo no WhatsApp/Discord não pode
        // terminar em beco sem saída.
        return res
          .status(encerrada ? 410 : 404)
          .type('html')
          .send(htmlErro);
      }

      const title = `${table.title} — Mesa de RPG | ${SITE_NAME}`;
      const description = buildTableDescription(table);
      const imageUrl = resolveOgImageUrl(table.banner_url, table.cover_url);

      const output = injectMetaTags(html, {
        title,
        description,
        imageUrl,
        canonicalUrl: `${SITE_URL}/mesas/${encodeURIComponent(table.slug)}`,
        ogType: 'website',
      });

      return res.status(200).type('html').send(output);
    } else {
      // Tipo não suportado - retorna fallback
        const htmlFallback = injectMetaTags(html, getFallbackMeta(`/${type}/${slug}`));
        return res.status(200).type('html').send(htmlFallback);
    }
  } catch (error: unknown) {
    console.error('[GET /og/:type/:slug]', { type, slug }, error);

    try {
      // Falha de banco/query cai aqui. Responder 200 com canonical auto-referente é o soft-404
      // que esta spec corrige: o Google indexaria a página de erro como se fosse a mesa. 503 diz
      // "tente de novo" e não consome orçamento de rastreio (achado de review, PR #315).
      const html = await loadIndexHtml();
      const output = stripCanonical(injectMetaTags(html, getFallbackMeta(`/${type}/${slug}`)));
      return res.status(503).type('html').send(output);
    } catch {
      return res.status(500).send('Internal error');
    }
  }
});

router.get('/{*splat}', async (req: Request, res: Response) => {
  try {
    const html = await loadIndexHtml();
    const output = injectMetaTags(html, getFallbackMeta(req.path));
    return res.status(200).type('html').send(output);
  } catch {
    return res.status(500).send('Internal error');
  }
});

export default router;
