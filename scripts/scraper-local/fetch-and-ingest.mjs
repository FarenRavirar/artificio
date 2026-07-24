#!/usr/bin/env node
// T6.1 (spec 084) — Modo 3: script standalone FORA da IA/backend, roda
// localmente no PC do mantenedor usando o perfil real do Chrome (sessão
// logada, cookies reais) via --user-data-dir do patchright. Motivo (decisão
// do mantenedor, 2026-07-24): custo de IA por execução repetida é alto
// demais para scraping item-a-item; este script é construído uma vez,
// executado quantas vezes o mantenedor quiser depois, sem custo de IA por
// rodada, e sem rodar via claude-in-chrome/MCP de browser.
//
// Risco documentado explicitamente (D-084-02): usar sessão logada pessoal
// para scraping pode levar à suspensão da conta se o marketplace detectar
// como automação. O mantenedor decide, por execução, se aceita esse risco.
//
// IMPORTANTE — SELETORES NÃO CONFIRMADOS: nunca conseguimos ver uma página
// de listagem do DriveThruRPG/DMs Guild desbloqueada (403 em Modo 1 e Modo
// 2a mesmo com patchright headless puro — ver driveThruRpgScraper.ts). Com
// sessão logada real, o resultado pode ser diferente, mas os seletores
// abaixo (extractItemsFromPage) são um PONTO DE PARTIDA a ajustar depois de
// rodar 1x e inspecionar o HTML real — não confiar neles sem confirmar.
//
// Uso:
//   node scripts/scraper-local/fetch-and-ingest.mjs \
//     --url "https://www.drivethrurpg.com/en/browse?filters=100000&price=0" \
//     --source-platform drivethrurpg \
//     --user-data-dir "C:\Users\SEU_USUARIO\AppData\Local\Google\Chrome\User Data" \
//     --profile "Default" \
//     --api-url "https://downloads.artificiorpg.com/api/v1/admin/scraper/ingest" \
//     --auth-token "SEU_TOKEN_DE_SESSAO_ADMIN" \
//     --dry-run

import { chromium } from 'patchright';
import { writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const REQUIRED_ARGS = ['url', 'source-platform', 'user-data-dir'];
for (const required of REQUIRED_ARGS) {
  if (!args[required]) {
    console.error(`Argumento obrigatório ausente: --${required}`);
    process.exit(1);
  }
}

const VALID_SOURCE_PLATFORMS = ['drivethrurpg', 'dms_guild'];
if (!VALID_SOURCE_PLATFORMS.includes(args['source-platform'])) {
  console.error(`--source-platform deve ser um de: ${VALID_SOURCE_PLATFORMS.join(', ')}`);
  process.exit(1);
}

// AJUSTAR APÓS 1ª EXECUÇÃO REAL — estrutura especulativa baseada no padrão
// visto em OPERA RPG/itch.io (título + link + indicador de preço), nunca
// confirmada contra uma página real destes 2 marketplaces.
function extractItemsFromPage() {
  const cards = Array.from(document.querySelectorAll('[data-testid="product-card"], .product-card, .search-result'));
  return cards
    .map((card) => {
      const linkEl = card.querySelector('a[href]');
      const titleEl = card.querySelector('[class*="title"], h3, h2');
      const priceEl = card.querySelector('[class*="price"]');
      const imgEl = card.querySelector('img');

      const href = linkEl?.getAttribute('href');
      const title = titleEl?.textContent?.trim();
      const priceText = priceEl?.textContent?.trim() ?? '';

      if (!href || !title) return null;

      return {
        sourceUrl: href.startsWith('http') ? href : new URL(href, window.location.origin).toString(),
        title,
        description: null,
        // Heurística conservadora: só marca free/PWYW se o texto de preço
        // contiver explicitamente "free"/"pay what you want"/"$0.00" — nunca
        // assume gratuito pela ausência de preço visível nesta fonte
        // (diferente de OPERA RPG, onde a ausência de mecanismo de cobrança
        // no domínio é o próprio sinal — aqui o domínio é majoritariamente
        // pago, então omissão de preço é ambíguo, não gratuito).
        isFreeOrPwyw: /\bfree\b|pay what you want|\$0\.00/i.test(priceText),
        coverImageUrl: imgEl?.getAttribute('src') ?? null,
        publisherName: null,
        sourceLanguageHint: null,
      };
    })
    .filter((item) => item !== null);
}

async function main() {
  const browser = await chromium.launchPersistentContext(args['user-data-dir'], {
    headless: false,
    channel: 'chrome',
    ...(args.profile ? { args: [`--profile-directory=${args.profile}`] } : {}),
  });

  try {
    const page = await browser.newPage();
    console.log(`Navegando para ${args.url} (usando sessão real do Chrome)...`);
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    console.log('Aguardando 3s para conteúdo dinâmico carregar...');
    await page.waitForTimeout(3000);

    const items = await page.evaluate(extractItemsFromPage);
    console.log(`${items.length} itens extraídos.`);

    if (items.length === 0) {
      console.warn('AVISO: 0 itens extraídos — os seletores em extractItemsFromPage provavelmente precisam de ajuste. Inspecione a página manualmente (F12) e atualize o script antes de confiar no resultado.');
    }

    const payload = { source_platform: args['source-platform'], items };

    if (args['dry-run']) {
      const outputPath = `scraper-local-dry-run-${Date.now()}.json`;
      writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
      console.log(`--dry-run: payload salvo em ${outputPath}, nada enviado ao backend.`);
      return;
    }

    if (!args['api-url'] || !args['auth-token']) {
      console.error('Sem --dry-run, --api-url e --auth-token são obrigatórios para enviar o payload.');
      process.exit(1);
    }

    const response = await fetch(args['api-url'], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args['auth-token']}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    console.log(`Resposta do backend (HTTP ${response.status}):`, JSON.stringify(body, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Falha na execução:', error);
  process.exit(1);
});
