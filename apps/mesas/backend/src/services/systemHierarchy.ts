import type { SystemNodeType } from '../db/types.js';

export const SYSTEM_PARENT_TYPE: Record<SystemNodeType, SystemNodeType | null> = {
  system: null,
  edition: 'system',
  variant: 'edition',
};

export function validateSystemParentType(
  nodeType: SystemNodeType,
  parentType: SystemNodeType | null,
): 'parent_required' | 'root_parent_forbidden' | 'hierarchy_invalid' | null {
  const expected = SYSTEM_PARENT_TYPE[nodeType];
  if (expected === null) return parentType === null ? null : 'root_parent_forbidden';
  if (parentType === null) return 'parent_required';
  return parentType === expected ? null : 'hierarchy_invalid';
}

export type SystemSuggestionHierarchyItem = {
  node_type: SystemNodeType;
  parent_id: string | null;
  parent_suggestion_index: number | null;
};

export function validateSystemSuggestionHierarchy(
  items: SystemSuggestionHierarchyItem[],
  catalogTypesById: ReadonlyMap<string, SystemNodeType>,
): string | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const hasParent = Boolean(item.parent_id) || item.parent_suggestion_index !== null;
    if (item.node_type === 'system') {
      if (hasParent) return `Sistema no item ${index + 1} não pode ter pai.`;
      continue;
    }
    if (!hasParent) return `${item.node_type} no item ${index + 1} precisa de pai.`;
    const parentType = item.parent_suggestion_index !== null
      ? items[item.parent_suggestion_index]?.node_type ?? null
      : catalogTypesById.get(item.parent_id ?? '') ?? null;
    if (validateSystemParentType(item.node_type, parentType) !== null) {
      return item.node_type === 'edition'
        ? `Edição no item ${index + 1} precisa ser filha de sistema.`
        : `Variante no item ${index + 1} precisa ser filha de edição.`;
    }
  }
  return null;
}
