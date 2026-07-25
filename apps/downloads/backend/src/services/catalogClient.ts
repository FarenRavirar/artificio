import { catalogFetch } from '@artificio/catalog-client';
import { z } from 'zod';

// Downloads acessa o catalogo central da spec 062 via @artificio/catalog-client
// (packages/catalog-client) — mesmo pacote ja usado por apps/mesas e
// apps/glossario. Este arquivo hoje cobre so LEITURA (getCatalogNodeById);
// escrita ainda nao foi implementada aqui, mas NAO e proibida.
//
// Correcao de debito documental (spec 086, 2026-07-25): a versao anterior deste
// comentario afirmava "consome (nunca escreve) [...] escrita de sistema/edicao
// continua proibida aqui", citando D097 — leitura errada da decisao. D097
// ("catalogo central, administracao distribuida") e D099 dizem o oposto:
// sistemas/edicoes podem ser administrados a partir de mesas, glossario OU
// downloads, sempre pelo mesmo servico/API/permissoes/auditoria, e "todos leem
// e escrevem integralmente nele, sem bancos/projecoes locais do catalogo". O
// que D097 reserva ao admin do site e a gestao PRINCIPAL/completa (hub
// administrativo), nao a exclusividade de escrita.
//
// Modelo alvo de escrita em Downloads (decisao do mantenedor, spec 086), igual
// ao que apps/mesas ja opera em producao: usuario comum SUGERE, admin aprova/
// recusa/ajusta numa tela de gestao — nunca escrita direta e cega no catalogo
// canonico. Contrato de referencia em mesas: POST /api/v1/system-suggestions
// (auth user) para sugerir; GET /api/v1/admin/system-suggestions,
// GET .../{id}/candidates (casamento com node existente),
// PATCH .../{id}/approve, PATCH .../{id}/reject e POST .../{id}/resolve
// (auth admin) para triagem. Downloads replica esse fluxo em vez de criar node
// direto a partir de dado raspado de marketplace.

const catalogNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  node_type: z.enum(['system', 'edition', 'variant']),
});

export type CatalogNode = z.infer<typeof catalogNodeSchema>;

export async function getCatalogNodeById(id: string): Promise<CatalogNode | null> {
  try {
    const node = await catalogFetch<unknown>(`/api/catalog/v1/nodes/${encodeURIComponent(id)}`);
    return catalogNodeSchema.parse(node);
  } catch {
    return null;
  }
}
