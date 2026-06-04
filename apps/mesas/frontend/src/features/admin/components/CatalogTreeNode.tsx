import { memo } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { NodeTypeBadge } from './NodeTypeBadge';
import { EntityCounters } from './EntityCounters';
import type { System } from '../../../modules/admin/systems/types';

interface Props {
  node: System;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onAddChild: (parent: System) => void;
}

export const CatalogTreeNode = memo(function CatalogTreeNode(props: Props) {
  const { node, depth, expandedIds, selectedId, onToggleExpand, onSelect, onAddChild } = props;
  const expanded = expandedIds.has(node.id);
  const selected = selectedId === node.id;
  const hasChildren = (node.children_count ?? 0) > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.id); }
          if (e.key === 'ArrowRight' && hasChildren && !expanded) onToggleExpand(node.id);
          if (e.key === 'ArrowLeft' && expanded) onToggleExpand(node.id);
        }}
        className={[
          'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
          selected
            ? 'bg-blue-500/15 border-l-2 border-blue-500'
            : 'hover:bg-white/5 border-l-2 border-transparent',
        ].join(' ')}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
            className="text-white/50 hover:text-white shrink-0"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        <NodeTypeBadge type={node.node_type} />

        <div className="min-w-0 flex-1 flex items-center gap-2">
          {node.logo_filename && (
            <img
              src={`/sys-logos/${node.logo_filename}`}
              alt={node.name}
              className="w-4 h-4 object-contain shrink-0"
            />
          )}
          <span className="truncate text-white font-medium">{node.name}</span>
          {node.name_pt && (
            <span className="truncate text-xs text-white/40">· {node.name_pt}</span>
          )}
        </div>

        <EntityCounters
          tables={node.tables_count ?? 0}
          children={node.children_count ?? 0}
          aliases={node.aliases_count ?? 0}
        />

        <button
          onClick={(e) => { e.stopPropagation(); onAddChild(node); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-white/60 hover:text-green-400 transition-opacity"
          title="Adicionar filho"
        >
          <Plus size={14} />
        </button>
      </div>

      {hasChildren && expanded && node.children && (
        <ul role="group">
          {node.children.map(child => (
            <CatalogTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
});
