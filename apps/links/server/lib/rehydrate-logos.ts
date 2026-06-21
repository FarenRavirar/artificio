import * as Groups from "../repo/groups.js";
import { resolveLogo, deleteLogo } from "./cloudinary.js";

export interface RehydrateResult {
  updated: number;
  unchanged: number;
  failed: number;
  skipped: number;
}

export async function rehydrateLogos(opts?: { force?: boolean }): Promise<RehydrateResult> {
  const result: RehydrateResult = { updated: 0, unchanged: 0, failed: 0, skipped: 0 };

  const groups = await Groups.listGroups({ status: "active" });
  console.log(`[rehydrate-logos] ${groups.length} grupos ativos.`);

  for (const g of groups) {
    try {
      const stored = await resolveLogo(g.invite_url, "rehydrate");
      if (!stored) {
        if (!g.logo_url) {
          result.skipped += 1;
        } else {
          result.unchanged += 1;
        }
        continue;
      }

      if (stored.logo_public_id === g.logo_public_id && !opts?.force) {
        result.unchanged += 1;
        continue;
      }

      await Groups.updateGroup(g.id, {
        logo_url: stored.logo_url,
        logo_public_id: stored.logo_public_id,
      });
      if (g.logo_public_id && g.logo_public_id !== stored.logo_public_id) {
        await deleteLogo(g.logo_public_id);
      }
      result.updated += 1;
      console.log(`[rehydrate-logos] logo atualizada: "${g.name}" (${stored.logo_public_id})`);
    } catch (e) {
      result.failed += 1;
      console.error(`[rehydrate-logos] falha em "${g.name}":`, String(e));
    }
  }

  console.log(
    `[rehydrate-logos] resultado: ${result.updated} atualizados, ${result.unchanged} sem alteração, ${result.failed} falhos, ${result.skipped} sem imagem`,
  );
  return result;
}
