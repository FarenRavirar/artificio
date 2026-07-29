import { resolveTaxonomyIds, type FlatCatalogSystem } from './catalogClient';

export interface MaterialTaxonomyState {
  system_id: string | null;
  edition_id: string | null;
}

export interface MaterialTaxonomyPatch {
  system_id?: string | null;
  edition_id?: string | null;
}

export class MaterialTaxonomyValidationError extends Error {}

export function resolveMaterialTaxonomyPatch(
  current: MaterialTaxonomyState,
  patch: MaterialTaxonomyPatch,
  nodes: FlatCatalogSystem[],
): MaterialTaxonomyPatch {
  const hasSystem = Object.hasOwn(patch, 'system_id');
  const hasEdition = Object.hasOwn(patch, 'edition_id');
  if (!hasSystem && !hasEdition) return {};

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const systemId = hasSystem ? patch.system_id ?? null : current.system_id;
  let editionId = hasEdition ? patch.edition_id ?? null : current.edition_id;

  if (systemId) {
    const system = byId.get(systemId);
    if (!system || system.node_type !== 'system') {
      throw new MaterialTaxonomyValidationError('Sistema inválido ou não selecionável.');
    }
  }

  if (hasEdition && editionId && !systemId) {
    throw new MaterialTaxonomyValidationError('Selecione um sistema antes da edição.');
  }

  if (hasEdition && editionId) {
    const edition = byId.get(editionId);
    if (!edition || edition.node_type === 'system') {
      throw new MaterialTaxonomyValidationError('Edição ou variante inválida.');
    }
    if (resolveTaxonomyIds(editionId, nodes).systemId !== systemId) {
      throw new MaterialTaxonomyValidationError('A edição não pertence ao sistema selecionado.');
    }
  }

  if (hasSystem && !hasEdition && editionId) {
    const edition = byId.get(editionId);
    const belongsToSystem = edition
      && edition.node_type !== 'system'
      && resolveTaxonomyIds(editionId, nodes).systemId === systemId;
    if (!belongsToSystem) editionId = null;
  }

  if (!systemId) {
    editionId = null;
  }

  return {
    ...(hasSystem ? { system_id: systemId } : {}),
    ...(hasEdition || editionId !== current.edition_id ? { edition_id: editionId } : {}),
  };
}
