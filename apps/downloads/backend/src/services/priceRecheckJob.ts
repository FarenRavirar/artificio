import { db } from '../db';
import { fetchSimple } from './scrapers/httpFetch';
import { parseItchIsFreeOrPwyw } from './scrapers/itchIoParser';
import { assertValidTransition } from './editorialStateMachine';
import { getOrCreateScraperCreatorId } from './scraperCreator';
import type { DownloadSourcePlatform, DownloadEditorialState } from '../db/types';

// Fase 7 (spec 084) — re-checagem de preco/status pos-publicacao pra
// material de origem scraper (spec.md §5): reusa e estende download_link_check
// (P10), NAO cria mecanismo de verificacao paralelo. Regra petrea: falha de
// ACESSO (403/timeout/rede) NUNCA deriva pra withdrawn — so confirmacao
// POSITIVA de preco pago move o material. Spec 085 (Fase 6, T6.3): quais
// fontes tem parser de preco confiavel deixa de ser hardcode — vem do
// registry (download_scraper_platform.supports_price_recheck). Hoje so
// itch.io/grimorios_e_dados tem a flag TRUE (parseItchIsFreeOrPwyw), mesmo
// comportamento de antes; admin pode ligar a flag pra plataforma nova sem
// deploy quando existir parser de preco pra ela.
async function getPriceCheckablePlatforms(): Promise<Set<DownloadSourcePlatform>> {
  const rows = await db
    .selectFrom('download_scraper_platform')
    .select('slug')
    .where('supports_price_recheck', '=', true)
    .execute();
  return new Set(rows.map((row) => row.slug));
}

export interface PriceRecheckResult {
  checked: number;
  withdrawn: number;
  blockedOrUnconfirmed: number;
}

async function confirmsPaid(
  sourcePlatform: DownloadSourcePlatform,
  html: string,
  priceCheckablePlatforms: Set<DownloadSourcePlatform>,
): Promise<boolean | null> {
  if (!priceCheckablePlatforms.has(sourcePlatform)) return null;
  return parseItchIsFreeOrPwyw(html) === false ? true : null;
}

type MaterialRow = { id: string; source_platform: DownloadSourcePlatform; source_url: string | null; editorial_state: DownloadEditorialState };

async function recordLinkCheck(material: MaterialRow, checkedUrl: string, httpStatus: number | null, errorDetail: string | null): Promise<void> {
  await db
    .insertInto('download_link_check')
    .values({
      material_id: material.id,
      checked_url: checkedUrl,
      http_status: httpStatus,
      is_healthy: httpStatus !== null && httpStatus < 400,
      error_detail: errorDetail,
      is_scraper_origin: true,
    })
    .execute();
}

async function withdrawMaterial(material: MaterialRow): Promise<void> {
  const scraperCreatorId = await getOrCreateScraperCreatorId();

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('download_material')
      .set({ editorial_state: 'withdrawn', updated_at: new Date() })
      .where('id', '=', material.id)
      .execute();

    await trx
      .insertInto('download_material_version')
      .values({
        material_id: material.id,
        field_name: 'editorial_state',
        old_value: material.editorial_state,
        new_value: 'withdrawn',
        // Ator de sistema (mesmo download_creator reusado pela criação
        // do material) — não há autor humano executando esta ação.
        changed_by: scraperCreatorId,
      })
      .execute();
  });
}

// Achado de review SonarQube (PR #193): funcao original tinha complexidade
// cognitiva 17 (limite 15) por acumular fetch+erro+status+preco+transicao+
// persistencia num so bloco. Extraida em recordLinkCheck/withdrawMaterial —
// mesmo comportamento, so redistribuido.
async function recheckOneMaterial(
  material: MaterialRow,
  priceCheckablePlatforms: Set<DownloadSourcePlatform>,
): Promise<'withdrawn' | 'blocked' | 'ok'> {
  if (!material.source_url) return 'ok';

  let response: { html: string; status: number };
  try {
    response = await fetchSimple(material.source_url);
  } catch (error: unknown) {
    const errorDetail = error instanceof Error ? error.message : 'Falha de rede desconhecida.';
    await recordLinkCheck(material, material.source_url, null, errorDetail);
    return 'blocked';
  }

  if (response.status >= 400) {
    // Falha de ACESSO (403/404/5xx) — nunca confirma "virou pago" a partir
    // disso. Registra auditoria, material continua published.
    await recordLinkCheck(material, material.source_url, response.status, `HTTP ${response.status} — bloqueio/erro de acesso, não confirma mudança de preço.`);
    return 'blocked';
  }

  const paidConfirmed = await confirmsPaid(material.source_platform, response.html, priceCheckablePlatforms);

  // Achado de review PR #193 (codeRabbit): validar a transição ANTES de
  // gravar o audit log — o texto "suspenso automaticamente" não pode ser
  // escrito em download_link_check se a suspensão de fato não aconteceu
  // (ex.: material já não está mais 'published' por corrida com moderação).
  let transitionApplied = false;
  if (paidConfirmed) {
    try {
      assertValidTransition(material.editorial_state, 'withdrawn');
      transitionApplied = true;
    } catch {
      transitionApplied = false;
    }
  }

  await recordLinkCheck(
    material,
    material.source_url,
    response.status,
    transitionApplied ? 'Preço mudou para pago — material suspenso automaticamente.' : null,
  );

  if (!transitionApplied) return 'ok';

  await withdrawMaterial(material);
  return 'withdrawn';
}

export async function runPriceRecheck(): Promise<PriceRecheckResult> {
  const priceCheckablePlatforms = await getPriceCheckablePlatforms();

  if (priceCheckablePlatforms.size === 0) {
    return { checked: 0, withdrawn: 0, blockedOrUnconfirmed: 0 };
  }

  const materials = await db
    .selectFrom('download_material')
    .select(['id', 'source_platform', 'source_url', 'editorial_state'])
    .where('editorial_state', '=', 'published')
    .where('source_platform', 'in', [...priceCheckablePlatforms])
    .where('source_url', 'is not', null)
    .execute();

  let checked = 0;
  let withdrawn = 0;
  let blockedOrUnconfirmed = 0;

  for (const material of materials) {
    if (!material.source_url) continue;
    checked += 1;

    const outcome = await recheckOneMaterial(material, priceCheckablePlatforms);
    if (outcome === 'withdrawn') withdrawn += 1;
    else if (outcome === 'blocked') blockedOrUnconfirmed += 1;
  }

  return { checked, withdrawn, blockedOrUnconfirmed };
}
