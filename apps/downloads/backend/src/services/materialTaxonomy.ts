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

function validateSystem(systemId: string | null, byId: Map<string, FlatCatalogSystem>): void {
  if (systemId && byId.get(systemId)?.node_type !== 'system') {
    throw new MaterialTaxonomyValidationError('Sistema inválido ou não selecionável.');
  }
}

function validateEdition(
  editionId: string | null,
  systemId: string | null,
  byId: Map<string, FlatCatalogSystem>,
  nodes: FlatCatalogSystem[],
): void {
  if (!editionId) return;
  if (!systemId) {
    throw new MaterialTaxonomyValidationError('Selecione um sistema antes da edição.');
  }
  const edition = byId.get(editionId);
  if (!edition || edition.node_type === 'system') {
    throw new MaterialTaxonomyValidationError('Edição ou variante inválida.');
  }
  if (resolveTaxonomyIds(editionId, nodes).systemId !== systemId) {
    throw new MaterialTaxonomyValidationError('A edição não pertence ao sistema selecionado.');
  }
}

function editionBelongsToSystem(
  editionId: string,
  systemId: string | null,
  byId: Map<string, FlatCatalogSystem>,
  nodes: FlatCatalogSystem[],
): boolean {
  const edition = byId.get(editionId);
  if (!edition || edition.node_type === 'system') return false;
  return resolveTaxonomyIds(editionId, nodes).systemId === systemId;
}

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

  // Achado real (review PR #228, Sonar): validações independentes extraídas
  // mantêm as mesmas mensagens e reduzem a complexidade do resolvedor.
  validateSystem(systemId, byId);
  if (hasEdition) validateEdition(editionId, systemId, byId, nodes);

  if (hasSystem && !hasEdition && editionId) {
    if (!editionBelongsToSystem(editionId, systemId, byId, nodes)) editionId = null;
  }

  if (!systemId) {
    editionId = null;
  }

  return {
    ...(hasSystem ? { system_id: systemId } : {}),
    ...(hasEdition || editionId !== current.edition_id ? { edition_id: editionId } : {}),
  };
}
