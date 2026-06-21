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

  // AGENTS.md: validar payload de query antes de .length/for..of.
  const raw = await Groups.listGroups({ status: "active" });
  if (!Array.isArray(raw)) {
    throw new Error("[rehydrate-logos] payload inválido: esperado array de grupos.");
  }
  const groups = raw;
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

      // updateGroup pode falhar após o upload (resolveLogo já subiu ao Cloudinary).
      // Se falhar, remove o asset órfão para não deixar lixo sem referência no banco.
      try {
        await Groups.updateGroup(g.id, {
          logo_url: stored.logo_url,
          logo_public_id: stored.logo_public_id,
        });
      } catch (updateErr) {
        await deleteLogo(stored.logo_public_id);
        throw updateErr;
      }
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
