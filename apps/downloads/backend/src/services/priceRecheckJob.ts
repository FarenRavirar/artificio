import { db } from '../db';
import { fetchSimple } from './scrapers/httpFetch';
import { parseItchIsFreeOrPwyw } from './scrapers/itchIoParser';
import { assertValidTransition } from './editorialStateMachine';
import { getOrCreateScraperCreatorId } from './scraperCreator';
import type { DownloadSourcePlatform } from '../db/types';

// Fase 7 (spec 084) — re-checagem de preco/status pos-publicacao pra
// material de origem scraper (spec.md §5): reusa e estende download_link_check
// (P10), NAO cria mecanismo de verificacao paralelo. Regra petrea: falha de
// ACESSO (403/timeout/rede) NUNCA deriva pra withdrawn — so confirmacao
// POSITIVA de preco pago move o material. As 2 fontes com parser de preco
// confiavel hoje sao itch.io/grimorios_e_dados (parseItchIsFreeOrPwyw) e
// opera_rpg (dominio proprio sem paywall, tratado como sempre gratuito por
// omissao de mecanismo de cobranca — mesma logica do adapter). Fontes sem
// adapter de preco confiavel (drivethrurpg/dms_guild sem parser real ainda;
// rpg_gratis/newton_rocha/catarse sem adapter nenhum) sao puladas: sem forma
// de reconfirmar preco = nunca suspende automaticamente, so fica auditavel
// via is_healthy/error_detail do link-check basico ja existente.
const PRICE_CHECKABLE_PLATFORMS = new Set<DownloadSourcePlatform>(['itch_io', 'grimorios_e_dados']);

export interface PriceRecheckResult {
  checked: number;
  withdrawn: number;
  blockedOrUnconfirmed: number;
}

async function confirmsPaid(sourcePlatform: DownloadSourcePlatform, html: string): Promise<boolean | null> {
  if (sourcePlatform === 'itch_io' || sourcePlatform === 'grimorios_e_dados') {
    return parseItchIsFreeOrPwyw(html) === false ? true : null;
  }
  return null;
}

export async function runPriceRecheck(): Promise<PriceRecheckResult> {
  const materials = await db
    .selectFrom('download_material')
    .select(['id', 'source_platform', 'source_url', 'editorial_state'])
    .where('editorial_state', '=', 'published')
    .where('source_platform', '!=', 'manual')
    .where('source_url', 'is not', null)
    .execute();

  let checked = 0;
  let withdrawn = 0;
  let blockedOrUnconfirmed = 0;

  for (const material of materials) {
    if (!material.source_url || !PRICE_CHECKABLE_PLATFORMS.has(material.source_platform)) {
      continue;
    }

    checked += 1;

    let response: { html: string; status: number };
    try {
      response = await fetchSimple(material.source_url);
    } catch (error: unknown) {
      const errorDetail = error instanceof Error ? error.message : 'Falha de rede desconhecida.';
      await db
        .insertInto('download_link_check')
        .values({
          material_id: material.id,
          checked_url: material.source_url,
          http_status: null,
          is_healthy: false,
          error_detail: errorDetail,
          is_scraper_origin: true,
        })
        .execute();
      blockedOrUnconfirmed += 1;
      continue;
    }

    if (response.status >= 400) {
      // Falha de ACESSO (403/404/5xx) — nunca confirma "virou pago" a
      // partir disso. Registra auditoria, material continua published.
      await db
        .insertInto('download_link_check')
        .values({
          material_id: material.id,
          checked_url: material.source_url,
          http_status: response.status,
          is_healthy: false,
          error_detail: `HTTP ${response.status} — bloqueio/erro de acesso, não confirma mudança de preço.`,
          is_scraper_origin: true,
        })
        .execute();
      blockedOrUnconfirmed += 1;
      continue;
    }

    const paidConfirmed = await confirmsPaid(material.source_platform, response.html);

    await db
      .insertInto('download_link_check')
      .values({
        material_id: material.id,
        checked_url: material.source_url,
        http_status: response.status,
        is_healthy: true,
        error_detail: paidConfirmed ? 'Preço mudou para pago — material suspenso automaticamente.' : null,
        is_scraper_origin: true,
      })
      .execute();

    if (paidConfirmed) {
      try {
        assertValidTransition(material.editorial_state, 'withdrawn');
      } catch {
        // Transição inválida no estado atual — não força, só audita a
        // tentativa via download_link_check já gravado acima.
        continue;
      }

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

      withdrawn += 1;
    }
  }

  return { checked, withdrawn, blockedOrUnconfirmed };
}
