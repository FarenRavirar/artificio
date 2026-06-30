import { useState, useMemo } from 'react';
import { CatalogTreeNode } from './CatalogTreeNode';
import type { System } from '../systems/types';

interface Props {
  systems: System[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parent: System) => void;
  search: string;
  typeFilter: Array<System['node_type']>;
}

export function CatalogTree({ systems, selectedId, onSelect, onAddChild, search, typeFilter }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleTree = useMemo(
    () => filterTree(systems, search, typeFilter),
    [systems, search, typeFilter]
  );

  const selectedAncestorIds = useMemo(
    () => (selectedId ? findAncestors(systems, selectedId) : []),
    [selectedId, systems]
  );

  const visibleExpandedIds = useMemo(
    () => new Set([...expandedIds, ...selectedAncestorIds]),
    [expandedIds, selectedAncestorIds]
  );

  if (visibleTree.length === 0) {
    return (
      <div className="py-12 text-center text-white/40">
        <p>Nenhum resultado para os filtros atuais.</p>
      </div>
    );
  }

  return (
    <ul role="tree" className="py-2">
      {visibleTree.map(node => (
        <CatalogTreeNode
          key={node.id}
          node={node}
          depth={0}
          expandedIds={visibleExpandedIds}
          selectedId={selectedId}
          onToggleExpand={toggleExpand}
          onSelect={onSelect}
          onAddChild={onAddChild}
        />
      ))}
    </ul>
  );
}

function filterTree(nodes: System[], search: string, typeFilter: string[]): System[] {
  const q = search.trim().toLowerCase();
  const noSearch = q.length === 0;
  const noTypeFilter = typeFilter.length === 0;

  const visit = (node: System): System | null => {
    const children = (node.children ?? []).map(visit).filter(Boolean) as System[];
    const matchesSearch = noSearch
      || node.name.toLowerCase().includes(q)
      || (node.name_pt ?? '').toLowerCase().includes(q)
      || (node.aliases ?? []).some(a => a.toLowerCase().includes(q));
    const matchesType = noTypeFilter || typeFilter.includes(node.node_type);

    if (!matchesSearch && children.length === 0) return null;
    if (!matchesType && children.length === 0) return null;

    return { ...node, children };
  };

  return nodes.map(visit).filter(Boolean) as System[];
}

function findAncestors(all: System[], targetId: string): string[] {
  const byId = new Map<string, System>();
  const collect = (nodes: System[]) => {
    for (const n of nodes) {
      byId.set(n.id, n);
      if (n.children) collect(n.children);
    }
  };
  collect(all);

  const result: string[] = [];
  let current = byId.get(targetId);
  while (current?.parent_id) {
    result.push(current.parent_id);
    current = byId.get(current.parent_id);
  }
  return result;
}
