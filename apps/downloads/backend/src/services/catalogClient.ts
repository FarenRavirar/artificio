import { catalogFetch } from '@artificio/catalog-client';
import { z } from 'zod';

// Downloads consome (nunca escreve) o catalogo central da spec 062 via
// @artificio/catalog-client (packages/catalog-client) — mesmo pacote ja
// usado por apps/mesas e apps/glossario. Escrita de sistema/edicao continua
// proibida aqui; qualquer necessidade de administrar o catalogo passa pelo
// site-admin (D097).

const catalogNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  node_type: z.enum(['system', 'edition', 'variant']),
});

export type CatalogNode = z.infer<typeof catalogNodeSchema>;

export async function getCatalogNodeById(id: string): Promise<CatalogNode | null> {
  try {
    const node = await catalogFetch<unknown>(`/api/catalog/v1/systems/${encodeURIComponent(id)}`);
    return catalogNodeSchema.parse(node);
  } catch {
    return null;
  }
}
