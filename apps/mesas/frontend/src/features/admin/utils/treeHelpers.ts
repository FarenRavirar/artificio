import type { System } from '../../../modules/admin/systems/types';

export function findInTree(nodes: System[], targetId: string): System | null {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (node.children) {
      const found = findInTree(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

export function countVisibleInTree(
  nodes: System[],
  search: string,
  typeFilter: Array<System['node_type']>
): number {
  let count = 0;
  const q = search.trim().toLowerCase();
  const noSearch = q.length === 0;
  const noTypeFilter = typeFilter.length === 0;

  const visit = (node: System): boolean => {
    const children = (node.children ?? []).map(visit).filter(Boolean);
    const matchesSearch = noSearch
      || node.name.toLowerCase().includes(q)
      || (node.name_pt ?? '').toLowerCase().includes(q)
      || (node.aliases ?? []).some((a: string) => a.toLowerCase().includes(q));
    const matchesType = noTypeFilter || typeFilter.includes(node.node_type);

    if (!matchesSearch && children.length === 0) return false;
    if (!matchesType && children.length === 0) return false;

    count++;
    return true;
  };

  nodes.forEach(visit);
  return count;
}
