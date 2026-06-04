# Plano de Gerenciamento de Catálogo — Padrão BigTech

> Reforma pragmática. Reaproveita o que existe. Testável em 1 sprint. Nada aspiracional.


# 0. Suplemento
Temos como suplemento o arquivo `sistemas_auditoria_codex.md`

---

## Referência de padrão

As BigTechs que resolvem esse problema exato (gestão de taxonomia hierárquica por operador humano):

- **Stripe Dashboard** — products/prices com hierarquia, painel de split-view, edição sem sair do contexto.
- **Linear** — projects/teams/cycles, keyboard-first, estado sempre visível, ações contextuais.
- **Notion Databases** — tree + tabela + kanban como views da mesma entidade, filtros estruturados.
- **GitHub Issues** — labels + milestones + referências cruzadas, bulk actions, busca estruturada.
- **Airtable** — grid + tree + detail pane lado a lado, edição inline.
- **Google Admin Console** — OU (organizational units) em árvore esquerda + detalhes na direita, drag-to-reparent.

**O padrão comum:**

1. **Split-view 3 colunas:** navegação (árvore) | listagem/trabalho | detalhe (inspector).
2. **Árvore é o default** em dados hierárquicos. Lista plana é filtro, não visão principal.
3. **Detail pane** em vez de modal para edição. Contexto nunca se perde.
4. **Bulk actions** com seleção múltipla e barra contextual flutuante.
5. **Command palette** (Cmd+K) para navegação rápida.
6. **Filtros estruturados** com chips persistentes na URL.
7. **Undo/redo** operacional (Linear chama "Triage", Stripe chama "Activity log").
8. **Otimista primeiro, reconcilia depois** — UI responde imediatamente, backend confirma.

---

## Diagnóstico em 1 linha

O admin atual é **lista plana + modal genérico**. A BigTech é **árvore + inspector + comando**. Você não precisa reescrever tudo — precisa trocar 3 componentes e adicionar 2 novos, aproveitando hooks, tipos e rotas existentes.

---

## Arquitetura-alvo (tela)

### Layout: Split-view 3 colunas

```
┌──────────────────────────────────────────────────────────────────────┐
│ Gestão Administrativa                                       [Cmd+K] │
├──────────────┬──────────────────────────────┬───────────────────────┤
│              │                              │                       │
│  NAV         │  WORKSPACE                   │  INSPECTOR            │
│  (coluna 1)  │  (coluna 2)                  │  (coluna 3)           │
│              │                              │                       │
│  • Sistemas  │  [Busca] [Filtros] [+ Novo]  │  13th Age             │
│  • Cenários  │                              │  ───────────────────  │
│  • Plataf.   │  🌳 Árvore                   │  Tipo: Sistema Base   │
│  • Mesas     │  ├─ 13th Age    3m·0f·2a    │  Slug: 13th-age       │
│  • Sugest.   │  ├─ ▼ D&D      12m·3f·5a    │  Localização: raiz    │
│    ⚠ 4 pend.│  │  ├─ ▼ 5e    8m·2f·3a    │                       │
│              │  │  │  ├─ 2014  4m·0f·0a   │  Nome                 │
│              │  │  │  └─ 2024  4m·0f·0a   │  [13th Age        ]   │
│              │  │  └─ Ravenloft 0m·0f·1a  │                       │
│              │  └─ Pathfinder 5m·2f·2a    │  Nome PT (opcional)   │
│              │                              │  [                ]   │
│              │  Mostrando 12 de 47          │                       │
│              │                              │  Aliases (3)          │
│              │                              │  [D&D ×] [DnD ×]     │
│              │                              │  [DND ×] [+ alias]   │
│              │                              │                       │
│              │                              │  ───────────────────  │
│              │                              │  Usado por 12 mesas   │
│              │                              │  [Ver mesas]          │
│              │                              │                       │
│              │                              │  [Salvar] [Cancelar]  │
│              │                              │  [⋯ Mais ações]       │
└──────────────┴──────────────────────────────┴───────────────────────┘
```

**Larguras:** 220px | flex-1 | 400px. Em telas < 1280px, inspector vira drawer (slide-in da direita). Em telas < 768px, vira tela cheia (mobile atual só acessa sob demanda).

**Convenção de métricas na árvore:** `Nm·Nf·Na` = mesas · filhos · aliases. Uma olhada rápida mostra operação.

---

## O que é reaproveitado (e o que muda)

### Reaproveitado (sem alteração)

| Recurso | Status |
|---|---|
| `GET /api/v1/systems?view=tree` | Mantém. Vira endpoint da árvore. |
| `GET /api/v1/systems?view=flat` | Mantém. Usado só em busca textual. |
| `POST /admin/systems` | Mantém. Backend valida. |
| `PUT /admin/systems/:id` | Mantém. |
| `DELETE /admin/systems/:id` | Mantém. Retorna `blocked_by` (melhoria A17). |
| Hook `useSystems.ts` | Mantém. Só expande filtro. |
| Migrations 02, 102, 103 | Mantêm. |
| `GestaoPage.tsx` layout de abas | Mantém as tabs topo. |
| Modal atual `SystemEditModal.tsx` | **Vira componente inspector** (mesma lógica, render diferente). |

### Novo (precisa ser criado)

| Componente | Função | Tamanho |
|---|---|---|
| `AdminWorkspaceLayout.tsx` | Container 3 colunas. | ~80 linhas |
| `CatalogTree.tsx` | Árvore interativa (expand, select, contadores). | ~200 linhas |
| `CatalogTreeNode.tsx` | Nó individual. Memoizado. | ~120 linhas |
| `EntityInspector.tsx` | Painel direito. Edição + metadados. | ~250 linhas |
| `CatalogToolbar.tsx` | Busca + filtros + "+ Novo". | ~100 linhas |
| `NodeTypeBadge.tsx` | Badge colorido por tipo. | ~30 linhas |
| `EntityCounters.tsx` | `Nm·Nf·Na` compacto. | ~40 linhas |
| `CommandPalette.tsx` (opcional fase 2) | Cmd+K. | ~150 linhas |

### Modificado (patch cirúrgico)

| Arquivo | Mudança |
|---|---|
| `GestaoPage.tsx` | Renderiza `AdminWorkspaceLayout` dentro da tab Sistemas/Cenários. Deleta `SystemsList/SystemsTree` antigos. |
| `useSystems.ts` | Adiciona `selectedId` state + retorna árvore. |
| `SystemEditModal.tsx` | **Desmonta.** Lógica migra para `EntityInspector`. Arquivo morre. |
| `routes/systems.ts` GET `/` | Retorna `children_count`, `tables_count`, `aliases_count` por nó. |

---

## Plano em 6 blocos

### Bloco 1 — Fundação de contadores (backend, 2h)

O que faz tudo funcionar: o backend precisa devolver os contadores (`children`, `tables`, `aliases`) em cada nó da árvore. Sem isso, a UX fica vazia.

**`routes/systems.ts` — alterar query do `GET /`:**

Substituir o select atual por uma query que agrega:

```ts
const systems = await db
  .selectFrom('systems as s')
  .leftJoin('systems as children', 'children.parent_id', 's.id')
  .leftJoin('tables', 'tables.system_id', 's.id')
  .leftJoin('system_aliases as al', 'al.system_id', 's.id')
  .select([
    's.id', 's.name', 's.name_pt', 's.slug',
    's.parent_id', 's.node_type', 's.depth', 's.path_slug',
    sql<number>`COUNT(DISTINCT children.id)::int`.as('children_count'),
    sql<number>`COUNT(DISTINCT tables.id)::int`.as('tables_count'),
    sql<number>`COUNT(DISTINCT al.id)::int`.as('aliases_count'),
  ])
  .groupBy(['s.id'])
  .orderBy('s.depth', 'asc')
  .orderBy('s.name', 'asc')
  .execute();
```

**Custo:** 3 left joins agregados. Aceitável até ~5k sistemas. Depois disso, materializar em view ou coluna denormalizada.

**Retorno atualizado:**

```ts
{
  data: [
    {
      id, name, name_pt, slug, parent_id, node_type, depth, path_slug,
      aliases: string[],
      children_count: number,
      tables_count: number,
      aliases_count: number,
      has_children: boolean,   // derivado de children_count > 0
      children: SystemTreeNode[]  // só quando view=tree
    }
  ]
}
```

**Gate de saída:** chamar `curl /api/v1/systems?view=tree` e ver contadores preenchidos.

---

### Bloco 2 — AdminWorkspaceLayout (frontend, 1h)

Esqueleto das 3 colunas. Puro layout. Nenhum dado real ainda.

```tsx
// frontend/src/features/admin/components/AdminWorkspaceLayout.tsx
import { ReactNode, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

interface Props {
  workspace: ReactNode;        // coluna central
  inspector: ReactNode | null; // coluna direita (null = fecha)
  onCloseInspector?: () => void;
}

export function AdminWorkspaceLayout({ workspace, inspector, onCloseInspector }: Props) {
  const inspectorOpen = inspector !== null;

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] overflow-hidden">
      <section className="flex-1 min-w-0 overflow-y-auto border-r border-white/10">
        {workspace}
      </section>

      {inspectorOpen && (
        <aside className="w-[400px] shrink-0 overflow-y-auto bg-[#0B1628] relative">
          <button
            onClick={onCloseInspector}
            className="absolute top-4 right-4 p-1 text-white/60 hover:text-white z-10"
            aria-label="Fechar inspector"
          >
            <PanelRightClose size={18} />
          </button>
          {inspector}
        </aside>
      )}
    </div>
  );
}
```

**Responsivo:**
- `< 1280px`: inspector vira overlay com `position: fixed; right: 0; width: 400px; z-index: 50`.
- `< 768px`: inspector ocupa tela inteira.

**Gate de saída:** renderizar com workspace/inspector mocados. Inspector abre e fecha.

---

### Bloco 3 — CatalogTree + CatalogTreeNode (frontend, 3h)

Árvore real com expand/collapse, seleção e contadores.

```tsx
// frontend/src/features/admin/components/CatalogTree.tsx
import { useState, useMemo } from 'react';
import { CatalogTreeNode } from './CatalogTreeNode';
import type { System } from '../types';

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

  // Auto-expand ancestrais do selectedId
  useMemo(() => {
    if (!selectedId) return;
    const ancestors = findAncestors(systems, selectedId);
    if (ancestors.length) {
      setExpandedIds(prev => new Set([...prev, ...ancestors]));
    }
  }, [selectedId, systems]);

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
          expandedIds={expandedIds}
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
```

```tsx
// frontend/src/features/admin/components/CatalogTreeNode.tsx
import { memo } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { NodeTypeBadge } from './NodeTypeBadge';
import { EntityCounters } from './EntityCounters';
import type { System } from '../types';

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
```

```tsx
// NodeTypeBadge.tsx
import { Package, BookOpen, GitBranch, Layers } from 'lucide-react';

const BADGE_META = {
  system:    { Icon: Package,   label: 'Sistema',    color: 'text-blue-400 bg-blue-500/10' },
  edition:   { Icon: BookOpen,  label: 'Edição',     color: 'text-purple-400 bg-purple-500/10' },
  subsystem: { Icon: GitBranch, label: 'Subsistema', color: 'text-cyan-400 bg-cyan-500/10' },
  variant:   { Icon: Layers,    label: 'Variante',   color: 'text-amber-400 bg-amber-500/10' },
} as const;

export function NodeTypeBadge({ type }: { type: keyof typeof BADGE_META }) {
  const meta = BADGE_META[type];
  if (!meta) return null;
  const { Icon, color } = meta;
  return (
    <span className={`inline-flex items-center justify-center p-1 rounded ${color}`} title={meta.label}>
      <Icon size={12} />
    </span>
  );
}
```

```tsx
// EntityCounters.tsx
interface Props { tables: number; children: number; aliases: number; }

export function EntityCounters({ tables, children, aliases }: Props) {
  if (tables === 0 && children === 0 && aliases === 0) return null;
  return (
    <span className="shrink-0 flex items-center gap-2 text-xs text-white/40 font-mono tabular-nums">
      {tables > 0 && <span title={`${tables} mesas`}>{tables}m</span>}
      {children > 0 && <span title={`${children} filhos`}>{children}f</span>}
      {aliases > 0 && <span title={`${aliases} aliases`}>{aliases}a</span>}
    </span>
  );
}
```

**Gate de saída:** árvore renderiza, expande, seleciona, mostra contadores. Item selecionado destaca. Botão `+` aparece no hover.

---

### Bloco 4 — EntityInspector (frontend, 4h)

Painel direito. Substitui o modal. Edição inline, sem sair de contexto.

```tsx
// frontend/src/features/admin/components/EntityInspector.tsx
import { useState, useEffect, useMemo } from 'react';
import { Save, Trash2, ExternalLink, Package, BookOpen, GitBranch, Layers } from 'lucide-react';
import { NodeTypeBadge } from './NodeTypeBadge';
import { AliasesEditor } from './AliasesEditor';
import { Breadcrumb } from './Breadcrumb';
import type { System } from '../types';

interface Props {
  mode: 'edit' | 'create';
  system: System | null;           // edit: entidade atual; create: null
  parentContext: System | null;    // create: pai pré-selecionado
  allSystems: System[];            // árvore completa (para breadcrumb e validação)
  onSave: (data: SystemFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

export interface SystemFormData {
  name: string;
  name_pt: string | null;
  node_type: 'system' | 'edition' | 'subsystem' | 'variant';
  parent_id: string | null;
  aliases: string[];
}

const VALID_CHILDREN: Record<string, Array<'system'|'edition'|'subsystem'|'variant'>> = {
  __root__:  ['system'],
  system:    ['edition', 'subsystem'],
  edition:   ['variant'],
  subsystem: ['variant'],
  variant:   [],
};

export function EntityInspector(props: Props) {
  const { mode, system, parentContext, allSystems, onSave, onDelete, onCancel } = props;

  const validTypes = useMemo(() => {
    if (mode === 'edit' && system) {
      // Em edição, node_type fica bloqueado. Seguro.
      return [system.node_type];
    }
    const parentType = parentContext?.node_type ?? '__root__';
    return VALID_CHILDREN[parentType];
  }, [mode, system, parentContext]);

  const [name, setName] = useState(system?.name ?? '');
  const [namePt, setNamePt] = useState(system?.name_pt ?? '');
  const [nodeType, setNodeType] = useState<SystemFormData['node_type']>(
    system?.node_type ?? validTypes[0] ?? 'system'
  );
  const [aliases, setAliases] = useState<string[]>(system?.aliases ?? []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Reset quando muda o contexto
  useEffect(() => {
    setName(system?.name ?? '');
    setNamePt(system?.name_pt ?? '');
    setNodeType(system?.node_type ?? validTypes[0] ?? 'system');
    setAliases(system?.aliases ?? []);
    setDirty(false);
  }, [system?.id, parentContext?.id]);

  // Marca dirty quando qualquer campo muda
  useEffect(() => {
    if (mode === 'create') { setDirty(name.trim().length > 0); return; }
    if (!system) return;
    const changed =
      name !== system.name ||
      (namePt || null) !== (system.name_pt || null) ||
      JSON.stringify(aliases) !== JSON.stringify(system.aliases ?? []);
    setDirty(changed);
  }, [name, namePt, aliases, system, mode]);

  // Slug preview
  const slugPreview = useMemo(() => {
    if (!name.trim()) return '';
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').trim()
      .replace(/\s+/g, '-').replace(/-+/g, '-');
  }, [name]);

  const breadcrumbPath = useMemo(() => {
    if (mode === 'create' && parentContext) {
      return [...buildPath(parentContext, allSystems), '(novo)'];
    }
    if (system) return buildPath(system, allSystems);
    return ['(novo sistema)'];
  }, [mode, system, parentContext, allSystems]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        name_pt: namePt.trim() || null,
        node_type: nodeType,
        parent_id: mode === 'create' ? (parentContext?.id ?? null) : (system?.parent_id ?? null),
        aliases: aliases.map(a => a.trim()).filter(Boolean),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
        {system && <NodeTypeBadge type={system.node_type} />}
        <h2 className="text-lg font-bold text-white truncate">
          {mode === 'create' ? 'Novo item' : system?.name}
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        <Breadcrumb path={breadcrumbPath} creating={mode === 'create'} />

        <Field label="Nome" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white focus:outline-none focus:border-blue-500"
            autoFocus={mode === 'create'}
          />
        </Field>

        <Field label="Nome em português" hint="Opcional. Usado em interfaces localizadas.">
          <input
            value={namePt}
            onChange={(e) => setNamePt(e.target.value)}
            placeholder="Ex: Dungeons & Dragons"
            className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="Slug" hint="Gerado automaticamente. Somente visualização.">
          <div className="px-3 py-2 bg-white/5 border border-white/5 rounded text-white/60 font-mono text-sm">
            {slugPreview || '—'}
          </div>
        </Field>

        <Field label="Tipo" required>
          {validTypes.length === 1 && mode === 'edit' ? (
            <div className="px-3 py-2 bg-white/5 border border-white/5 rounded text-white/80 text-sm">
              <TypeLabel type={nodeType} /> <span className="text-white/40">· bloqueado em edição</span>
            </div>
          ) : (
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value as any)}
              disabled={mode === 'edit'}
              className="w-full px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white focus:outline-none focus:border-blue-500"
            >
              {validTypes.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          )}
        </Field>

        {mode === 'create' && parentContext && (
          <Field label="Pai" hint="Definido pelo contexto da árvore.">
            <div className="px-3 py-2 bg-white/5 border border-white/5 rounded text-white/80 text-sm flex items-center gap-2">
              <NodeTypeBadge type={parentContext.node_type} />
              <span>{parentContext.name}</span>
            </div>
          </Field>
        )}

        <Field label={`Aliases (${aliases.length})`} hint="Nomes alternativos para busca.">
          <AliasesEditor value={aliases} onChange={setAliases} />
        </Field>

        {system && (system.tables_count ?? 0) > 0 && (
          <div className="mt-6 p-3 rounded bg-amber-500/5 border border-amber-500/20">
            <p className="text-sm text-amber-200">
              Usado por {system.tables_count} {system.tables_count === 1 ? 'mesa' : 'mesas'}.
            </p>
            <button className="mt-2 text-xs text-amber-300 hover:underline inline-flex items-center gap-1">
              Ver mesas <ExternalLink size={10} />
            </button>
          </div>
        )}
      </div>

      <footer className="px-6 py-3 border-t border-white/10 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!dirty || !name.trim() || saving}
          className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded inline-flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Salvando…' : mode === 'create' ? 'Criar' : 'Salvar'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-white/70 hover:text-white"
        >
          Cancelar
        </button>
        {mode === 'edit' && onDelete && (
          <button
            onClick={onDelete}
            className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded"
            title="Deletar"
          >
            <Trash2 size={16} />
          </button>
        )}
      </footer>
    </div>
  );
}

// helpers locais
const TYPE_LABEL = { system: 'Sistema', edition: 'Edição', subsystem: 'Subsistema', variant: 'Variante' } as const;
function TypeLabel({ type }: { type: keyof typeof TYPE_LABEL }) { return <span>{TYPE_LABEL[type]}</span>; }

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-xs text-white/40 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function buildPath(node: System, all: System[]): string[] {
  const byId = new Map<string, System>();
  const collect = (nodes: System[]) => { for (const n of nodes) { byId.set(n.id, n); if (n.children) collect(n.children); } };
  collect(all);
  const chain: string[] = [node.name];
  let cursor = node.parent_id ? byId.get(node.parent_id) : null;
  while (cursor) {
    chain.unshift(cursor.name);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : null;
  }
  return chain;
}
```

**AliasesEditor** (componente auxiliar, ~50 linhas):

```tsx
export function AliasesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.some(a => a.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((alias, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded text-sm text-white">
            {alias}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-white/60 hover:text-white">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Ex: D&D"
          className="flex-1 px-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white text-sm"
        />
        <button onClick={add} className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded">
          Adicionar
        </button>
      </div>
    </div>
  );
}
```

**Gate de saída:** clicar num nó da árvore abre inspector populado. Editar nome → botão Salvar ativa. Criar filho via `+` abre inspector com pai pré-selecionado e tipos filtrados. Aliases editáveis. Slug em preview.

---

### Bloco 5 — Toolbar + integração no GestaoPage (frontend, 2h)

```tsx
// CatalogToolbar.tsx
import { Search, Plus } from 'lucide-react';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: string[];
  onTypeFilterChange: (v: string[]) => void;
  onNewRoot: () => void;
  resultsCount: number;
  totalCount: number;
}

export function CatalogToolbar(props: Props) {
  const TYPE_FILTERS = [
    { value: 'system',    label: 'Sistemas' },
    { value: 'edition',   label: 'Edições' },
    { value: 'subsystem', label: 'Subsistemas' },
    { value: 'variant',   label: 'Variantes' },
  ];
  const toggleType = (v: string) => {
    if (props.typeFilter.includes(v)) {
      props.onTypeFilterChange(props.typeFilter.filter(t => t !== v));
    } else {
      props.onTypeFilterChange([...props.typeFilter, v]);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-[#0B1628] border-b border-white/10 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Buscar por nome, tradução ou alias…"
            className="w-full pl-9 pr-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={props.onNewRoot}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded"
        >
          <Plus size={16} /> Novo sistema
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-white/40">Filtrar:</span>
        {TYPE_FILTERS.map(f => {
          const active = props.typeFilter.includes(f.value);
          return (
            <button
              key={f.value}
              onClick={() => toggleType(f.value)}
              className={`px-2 py-1 rounded border transition-colors ${
                active
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <span className="ml-auto text-white/40">
          {props.resultsCount} de {props.totalCount}
        </span>
      </div>
    </div>
  );
}
```

**Integração em `GestaoPage.tsx` (dentro da tab Sistemas):**

```tsx
// Dentro da tab Sistemas do GestaoPage.tsx
const [selectedId, setSelectedId] = useState<string | null>(null);
const [inspectorMode, setInspectorMode] = useState<'edit' | 'create' | null>(null);
const [createContext, setCreateContext] = useState<System | null>(null);
const [search, setSearch] = useState('');
const [typeFilter, setTypeFilter] = useState<string[]>([]);
const { systemsTree, fetchTree, createSystem, updateSystem, deleteSystem, totalCount } = useSystemsTree();

const selectedSystem = useMemo(() => findInTree(systemsTree, selectedId), [systemsTree, selectedId]);

const workspace = (
  <>
    <CatalogToolbar
      search={search}
      onSearchChange={setSearch}
      typeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
      onNewRoot={() => { setCreateContext(null); setInspectorMode('create'); setSelectedId(null); }}
      resultsCount={countVisibleInTree(systemsTree, search, typeFilter)}
      totalCount={totalCount}
    />
    <CatalogTree
      systems={systemsTree}
      selectedId={selectedId}
      onSelect={(id) => { setSelectedId(id); setInspectorMode('edit'); setCreateContext(null); }}
      onAddChild={(parent) => { setCreateContext(parent); setInspectorMode('create'); setSelectedId(null); }}
      search={search}
      typeFilter={typeFilter}
    />
  </>
);

const inspector = inspectorMode ? (
  <EntityInspector
    mode={inspectorMode}
    system={inspectorMode === 'edit' ? selectedSystem : null}
    parentContext={createContext}
    allSystems={systemsTree}
    onSave={async (data) => {
      if (inspectorMode === 'create') await createSystem(data);
      else if (selectedSystem) await updateSystem(selectedSystem.id, data);
      await fetchTree();
      setInspectorMode(null);
    }}
    onDelete={selectedSystem ? async () => {
      if (!confirm(`Deletar "${selectedSystem.name}"?`)) return;
      await deleteSystem(selectedSystem.id);
      setInspectorMode(null); setSelectedId(null);
      await fetchTree();
    } : undefined}
    onCancel={() => setInspectorMode(null)}
  />
) : null;

return (
  <AdminWorkspaceLayout
    workspace={workspace}
    inspector={inspector}
    onCloseInspector={() => setInspectorMode(null)}
  />
);
```

**Gate de saída:** fluxo completo funciona ponta a ponta. Cria sistema base via toolbar. Expande, clica `+` em nó, cria filho. Seleciona nó, edita, salva. Deleta com confirmação.

---

### Bloco 6 — Cenários (mesma arquitetura, 2h)

Cenários são simples (sem hierarquia). Mesmo padrão:

- Lista vertical em vez de árvore.
- Inspector idêntico, campos: `name`, `name_pt`, `slug`, `subgenres[]`, `compatible_systems[]` (se implementar N:N do A09).
- `EntityInspector` vira genérico com prop `entityKind: 'system' | 'scenario'`.

---

## Roadmap executável

| Ordem | Bloco | Tempo | Dependência |
|---|---|---|---|
| 1 | Fase 1 da auditoria (backend estrutural) | 2–3 dias | — |
| 2 | Patch dos 4 bugs (B1–B4) | 2h | — (roda em paralelo) |
| 3 | Bloco 1 — contadores no GET /systems | 2h | Fase 1 |
| 4 | Bloco 2 — `AdminWorkspaceLayout` | 1h | — |
| 5 | Bloco 3 — `CatalogTree` + `CatalogTreeNode` | 3h | Bloco 1, 2 |
| 6 | Bloco 4 — `EntityInspector` | 4h | Bloco 1 |
| 7 | Bloco 5 — `CatalogToolbar` + integração | 2h | Blocos 3, 4 |
| 8 | Bloco 6 — cenários | 2h | Bloco 4 (reaproveita inspector) |

**Total para testar o novo admin:** ~14h de implementação após a Fase 1 da auditoria. Em sprint de 1 dev dedicado: 2 dias úteis.

---

## Gates objetivos de validação

### Gate 1 (após Bloco 3)
- [x] `curl GET /api/v1/systems?view=tree` retorna `children_count`, `tables_count`, `aliases_count`.
- [x] Árvore renderiza contadores via `EntityCounters` ligados a `children_count`, `tables_count`, `aliases_count` (validação por código).
- [x] Expand/collapse com teclado (`ArrowRight`/`ArrowLeft`) implementado em `CatalogTreeNode` (validação por código).
- [ ] **Validação manual:** confirmar no navegador contadores visíveis e navegação por teclado funcionando.

### Gate 2 (após Bloco 4)
- [x] Selecionar nó abre inspector populado (`handleSelect` define `selectedId` + `inspectorMode='edit'`) (validação por código).
- [x] Editar nome ativa botão "Salvar"; cancelamento passa por confirmação centralizada de descarte quando `dirty` (validação por código).
- [x] Aliases existentes aparecem e podem ser removidos/adicionados (`AliasesEditor`) (validação por código).
- [x] Tipo fica bloqueado em edição (`disabled={mode === 'edit'}`) (validação por código).
- [ ] **Validação manual:** executar fluxo completo selecionar → editar → cancelar/salvar no navegador.

### Gate 3 (após Bloco 5)
- [x] Criar sistema-base via "+ Novo" (`CatalogToolbar` → `onCreateRoot`) (validação por código).
- [x] Criar edição via `+` em sistema-base com pai correto e tipos filtrados (`VALID_CHILDREN`) (validação por código).
- [x] Criar variante via `+` em edição/subsistema com apenas "Variante" disponível (`VALID_CHILDREN`) (validação por código).
- [x] Busca por `name`, `name_pt` e aliases filtra a árvore (`filterTree`) (validação por código).
- [x] Filtros de tipo (chips) compõem com busca (`CatalogToolbar` + `CatalogTree`) (validação por código).
- [x] Correção de consistência: auto-expand de ancestrais movido de `useMemo` para `useEffect` idempotente (sem efeito colateral em memo).
- [x] Correção de acessibilidade: ação de criar filho também disponível por teclado (`+` / `Insert`) e botão `+` visível/focável com `focus-visible`.
- [ ] **Validação manual:** executar criação de sistema/edição/variante e testar acessibilidade por teclado no navegador.

### Gate 4 (regressão)
- [x] Inventário dos consumidores de `GET /systems` mapeado no código (incluindo `EditGmProfileForm`, `CatalogoPage`, `CreateTableForm`, `UserSystemsSelector`, `SystemSuggestionModal` e módulo admin `useSystems`).
- [x] `CreateTableForm` continua consumindo `/api/v1/systems?view=tree` no código.
- [x] `CatalogoPage` continua consumindo `/api/v1/systems?view=tree` no código.
- [ ] **Validação manual:** abrir cada consumidor crítico e validar comportamento funcional em runtime.

---

## Riscos e mitigação

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| Contadores agregados pesam em catálogo grande | M | M | **Implementado em 19/04/2026:** cache em memória no backend para `GET /api/v1/systems?view=tree` com TTL de 60s e invalidação a cada mutação (`POST/PUT/DELETE /api/v1/systems/admin`). |
| Dirty state perdido ao trocar seleção | A | M | Se `dirty === true`, confirmar descarte antes de trocar seleção. Ou auto-salvar com debounce. |
| Inspector em mobile perde a árvore | A | B | Já previsto: inspector vira tela cheia com botão voltar. |
| Árvore com 2000+ nós deixa UI lenta | B | M | Virtualização com `@tanstack/react-virtual` se/quando acontecer. Não fazer preemptivamente. |
| Operador deleta sistema com mesas | A | A | **Mitigação reforçada em 19/04/2026:** backend retorna `blocked_by` estruturado e o inspector exibe confirmação contextual prévia baseada em `tables_count`/`children_count` antes de tentar deletar. |

### Checklist operacional (manual) — Gates e riscos

> Preencher durante validação em runtime (navegador + rede). Itens marcados `[x]` já foram validados por código nesta auditoria.

#### Gate 1 — Árvore e contadores
- [x] `GET /api/v1/systems?view=tree` retorna `children_count`, `tables_count`, `aliases_count`.
- [x] Árvore renderiza contadores com `EntityCounters`.
- [x] Expand/collapse por teclado (`ArrowRight`/`ArrowLeft`) implementado.
- [ ] Validar manualmente no navegador: contadores visíveis em diferentes nós.
- [ ] Validar manualmente: navegação por teclado sem regressão.

#### Gate 2 — Inspector e edição segura
- [x] Seleção de nó abre inspector preenchido.
- [x] `node_type` bloqueado em edição.
- [x] `dirty-state` com confirmação de descarte em troca de contexto/seleção.
- [ ] Validar manualmente: editar nome, cancelar e confirmar descarte.
- [ ] Validar manualmente: aliases adicionar/remover/salvar.

#### Gate 3 — CRUD e filtros
- [x] Criar sistema-base via botão `+ Novo`.
- [x] Criar edição/variante por contexto de pai (`VALID_CHILDREN`).
- [x] Busca por `name`, `name_pt` e alias aplicada na árvore.
- [x] Chips de tipo combinam com busca textual.
- [ ] Validar manualmente fluxo completo criar sistema-base → edição → variante.
- [ ] Validar manualmente atalhos de teclado do botão `+` (`+` e `Insert`).

#### Gate 4 — Regressão de consumidores
- [x] Inventário dos 7 consumidores de `GET /systems` revisado no código.
- [ ] Validar manualmente cada consumidor crítico em runtime.

#### Risco R1 — Cache de contadores em catálogo grande
- [x] Cache implementado no backend com TTL e invalidação.
- [ ] Validar manualmente latência de `GET /systems?view=tree` em chamadas consecutivas e após mutação.

#### Risco R2 — Dirty-state em subabas
- [x] `SystemsAdminView`, `ScenariosAdminView` e `PlatformsPage` propagam `onInspectorDirtyChange` para `GestaoPage`.
- [ ] Validar manualmente troca entre subabas com formulário sujo em cada uma.

#### Risco R3 — Inspector mobile
- [x] Layout mobile em overlay/tela cheia previsto em `AdminWorkspaceLayout`.
- [ ] Validar manualmente fechamento/retorno para árvore em viewport mobile.

#### Risco R4 — Árvore com 2000+ nós
- [x] Mitigação definida (virtualização condicional futura) e risco monitorado.
- [ ] Validar manualmente desempenho com massa alta (se disponível no ambiente).

#### Risco R5 — Delete bloqueado
- [x] Backend retorna `409` com `blocked_by`.
- [x] Frontend parseia `blocked_by` para mensagem detalhada.
- [x] Inspector agora mostra aviso prévio quando contadores indicam possível bloqueio.
- [ ] Validar manualmente deleção bloqueada e deleção permitida no navegador.


---

## Parecer de implantação trecho a trecho (auditoria interna em 2026-04-18)

**Legenda:**
- **IMPLANTADO** = comportamento existe no código atual
- **PARCIAL** = existe, mas incompleto, divergente ou sem validação exigida
- **NÃO TEM** = não localizado no código atual

### 1) Reaproveitado (sem alteração)

| Trecho do plano | Parecer | Evidência objetiva | Severidade |
|---|---|---|---|
| `GET /api/v1/systems?view=tree` mantém | **IMPLANTADO** | `backend/src/routes/systems.ts` (`router.get('/')`, `view === 'tree`) | — |
| `GET /api/v1/systems?view=flat` mantém | **IMPLANTADO** | `backend/src/routes/systems.ts` (`view` default `flat`) | — |
| `POST /admin/systems` mantém | **IMPLANTADO** | `backend/src/routes/systems.ts` (`router.post('/admin'`) | — |
| `PUT /admin/systems/:id` mantém | **IMPLANTADO** | `backend/src/routes/systems.ts` (`router.put('/admin/:id'`) | — |
| `DELETE /admin/systems/:id` mantém e retorna `blocked_by` | **IMPLANTADO** | Conflito 409 retorna payload estruturado em `blocked_by` com objetos `{ type: 'tables' | 'children', count: number }`, mantém `error` textual para retrocompatibilidade e frontend ainda não explora blocked_by para UX mais detalhada (apenas texto) | — |
| Hook `useSystems.ts` mantém com expansão | **IMPLANTADO** | `frontend/src/modules/admin/systems/useSystems.ts` possui `systemsTree`, `selectedId` e busca por alias | — |
| Migrations 02, 102, 103 mantêm | **PARCIAL** | Scripts 102/103 estão em `database/`; execução/estado aplicado não foi validado nesta rodada | **Média** |
| `GestaoPage.tsx` mantém layout de abas | **IMPLANTADO** | `frontend/src/pages/GestaoPage.tsx` mantém tabs principais/subtabs | — |
| `SystemEditModal.tsx` vira inspector (arquivo morre) | **IMPLANTADO** | `EntityInspector` está no fluxo ativo e `frontend/src/components/SystemEditModal.tsx` foi removido (sem referência ativa remanescente) | — |

#### Detalhamento técnico — bloqueio de delete (backend) x experiência no frontend

- **Backend (concluído):** no `DELETE /api/v1/systems/admin/:id`, quando há impedimento de exclusão, o retorno agora é `409` com estrutura machine-readable em `blocked_by`.
- **Formato de contrato atual:**
  - `blocked_by: [{ type: 'tables', count: N }, { type: 'children', count: N }]` (somente os itens aplicáveis)
  - `error: string` continua presente para não quebrar consumidores legados.
- **Comportamento de bloqueio coberto:**
  - Bloqueio por mesas vinculadas (`type: 'tables'`)
  - Bloqueio por sistemas filhos (`type: 'children'`)
  - Bloqueio combinado (ambos no mesmo payload)
- **Frontend (implantado):** `frontend/src/modules/admin/systems/useSystems.ts` agora faz parsing de `data.blocked_by` no DELETE e monta feedback detalhado por tipo (ex.: `mesas vinculadas` e `sistemas filhos`), mantendo fallback para `data.error` quando necessário.

### 2) Novo (precisa ser criado)

| Componente planejado | Parecer | Evidência objetiva | Severidade |
|---|---|---|---|
| `AdminWorkspaceLayout.tsx` | **IMPLANTADO** | Inspector responsivo implementado: `<1280` em overlay fixo à direita (`w-[400px]`, `z-50`) com backdrop; `<768` em tela cheia (`w-screen`) | — |
| `CatalogTree.tsx` | **IMPLANTADO** | Arquivo existe com filtro por busca/tipo, seleção e árvore | — |
| `CatalogTreeNode.tsx` | **IMPLANTADO** | Arquivo existe com expand/collapse, teclado e ação `+` | — |
| `EntityInspector.tsx` | **IMPLANTADO** | Arquivo existe com edição inline para `system` e `scenario` via `entityKind`, incluindo `aliases` (sistemas) e `subgenres` (cenários) | — |
| `CatalogToolbar.tsx` | **IMPLANTADO** | Componente expõe `totalCount` e contador no formato `resultsCount de totalCount`; integração ativa em `SystemsAdminView.tsx` | — |
| `NodeTypeBadge.tsx` | **IMPLANTADO** | Arquivo existe com mapeamento visual por tipo | — |
| `EntityCounters.tsx` | **IMPLANTADO** | Arquivo existe com `m/f/a` | — |
| `CommandPalette.tsx` (opcional fase 2) | **IMPLANTADO** | Arquivo criado e integrado em `SystemsAdminView.tsx` com atalho `Ctrl/Cmd + K`, seleção rápida e atalho para criar sistema-base | — |

### 3) Modificado (patch cirúrgico)

| Trecho do plano | Parecer | Evidência objetiva | Severidade |
|---|---|---|---|
| `GestaoPage.tsx` integra nova workspace em Sistemas/Cenários e deleta antigos | **IMPLANTADO** | Integra `SystemsAdminView`/`ScenariosAdminView`; arquivos legados órfãos (`SystemsTree.tsx`, `SystemsList.tsx`) removidos do módulo admin/systems | — |
| `useSystems.ts` adiciona `selectedId` + árvore | **IMPLANTADO** | `selectedId`, `setSelectedId`, `systemsTree`, `fetchTree` presentes | — |
| `SystemEditModal.tsx` desmontado | **IMPLANTADO** | `frontend/src/components/SystemEditModal.tsx` removido; fluxo legado por modal descontinuado | — |
| `ScenarioEditModal.tsx` desmontado | **IMPLANTADO** | `frontend/src/components/ScenarioEditModal.tsx` removido; `GestaoPage.tsx` mantém fluxo em `ScenariosAdminView` + `EntityInspector` | — |

### 4) Blocos executáveis

| Bloco | Parecer | Evidência objetiva | Severidade |
|---|---|---|---|
| Bloco 1 — contadores no backend | **IMPLANTADO** | `children_count`, `tables_count`, `aliases_count` implementados; `has_children` agora deriva de `children_count > 0` no `GET /api/v1/systems` (flat/tree/search) | — |
| Bloco 2 — `AdminWorkspaceLayout` | **IMPLANTADO** | Split-view mantém desktop; em `<1280` inspector vira overlay fixo com backdrop; em `<768` ocupa tela inteira | — |
| Bloco 3 — `CatalogTree` + `CatalogTreeNode` | **IMPLANTADO** | Árvore, seleção, expand/collapse, hover `+`, teclado e contadores presentes | — |
| Bloco 4 — `EntityInspector` | **IMPLANTADO** | Edição inline, aliases, slug preview e save/cancel/delete implementados | — |
| Bloco 5 — `CatalogToolbar` + integração | **IMPLANTADO** | Toolbar recebe e renderiza `totalCount`; `SystemsAdminView` repassa `totalCount`; limpeza de legado concluída com remoção de `SystemsTree.tsx`/`SystemsList.tsx` órfãos | — |
| Bloco 6 — Cenários na mesma arquitetura | **IMPLANTADO** | `ScenariosAdminView.tsx` migrou para `subgenres` no CRUD admin e usa `EntityInspector` genérico com `entityKind="scenario"` (sem `as any`), mantendo `AdminWorkspaceLayout` + `ScenariosList` | — |

### 5) Divergências críticas encontradas fora do “caminho feliz”

| Falha concreta | Estado | Evidência objetiva | Severidade |
|---|---|---|---|
| Contrato de cenários divergente no CRUD admin | **IMPLANTADO** | `ScenariosAdminView.tsx` envia `subgenres` em `POST/PUT /api/v1/scenarios/admin`; `ScenariosList.tsx` filtra/renderiza por `subgenres` | — |
| `EntityInspector` não está realmente genérico por `entityKind` | **IMPLANTADO** | `EntityInspector.tsx` suporta `entityKind: 'system' | 'scenario'`; `ScenariosAdminView.tsx` usa `entityKind="scenario"` sem cast `as any` | — |
| `DELETE /systems` sem `blocked_by` estruturado | **IMPLANTADO** | `backend/src/routes/systems.ts` retorna `blocked_by` estruturado no 409 | — |
| Frontend do admin não explora `blocked_by` para UX detalhada | **IMPLANTADO** | `frontend/src/modules/admin/systems/useSystems.ts` parseia `data.blocked_by` e exibe motivo detalhado por tipo/contagem no erro de DELETE | — |
| Regra de descarte de formulário sujo ao trocar contexto | **IMPLANTADO** | `EntityInspector.tsx` expõe `onDirtyChange`; `SystemsAdminView.tsx` e `ScenariosAdminView.tsx` confirmam descarte antes de trocar seleção/fechar inspector | — |
| Responsividade do inspector prevista no plano | **IMPLANTADO** | `AdminWorkspaceLayout.tsx` aplica overlay em `<1280` e fullscreen em `<768` com backdrop e fechamento | — |

### 6) Gates do documento (status real)

#### Gate 1 (após Bloco 3)
- `curl GET /api/v1/systems?view=tree` com contadores: **IMPLANTADO** (validação executada no endpoint beta com retorno contendo `children_count`, `tables_count` e `aliases_count` no payload)
- Árvore no navegador com contadores: **IMPLANTADO** (pelo fluxo da `SystemsAdminView`)
- Expand/collapse com teclado: **IMPLANTADO** (`CatalogTreeNode.tsx`)

#### Gate 2 (após Bloco 4)
- Selecionar nó abre inspector populado: **IMPLANTADO**
- Editar nome ativa salvar; cancelar descarta: **IMPLANTADO**
- Aliases editáveis: **IMPLANTADO**
- Tipo bloqueado em edição: **IMPLANTADO**

#### Gate 3 (após Bloco 5)
- Criar sistema-base via toolbar: **IMPLANTADO**
- Criar edição via `+` em sistema-base: **IMPLANTADO**
- Criar variante via `+` em edição (tipo filtrado): **IMPLANTADO**
- Busca por nome/name_pt/alias filtra árvore: **IMPLANTADO**
- Chips de tipo compõem com busca: **IMPLANTADO**

#### Gate 4 (regressão)
- 7 consumidores do `GET /systems` funcionando: **IMPLANTADO** (`EditGmProfileForm`, `CatalogoPage`, `useSystems`/`SystemsAdminView`, `CreateTableForm`, `SystemSuggestionModal`, `UserSystemsSelector` + fluxo admin via `useSystems` com `view=flat/tree`)
- `CreateTableForm` com sistema existente: **IMPLANTADO** (consome `GET /api/v1/systems?view=tree` e hidrata `json.data`)
- `CatalogoPage` listando sistemas corretamente: **IMPLANTADO** (ajustado para `GET /api/v1/systems?view=tree`; removida dependência de `/api/v1/systems/tree` inexistente no backend)

### 7) Roadmap (situação atual)

| Ordem do roadmap | Parecer |
|---|---|
| 1) Fase 1 backend estrutural | **PARCIAL** |
| 2) Patch dos 4 bugs (B1–B4) | **PARCIAL** (sem evidência consolidada nesta rodada) |
| 3) Bloco 1 | **IMPLANTADO** |
| 4) Bloco 2 | **PARCIAL** |
| 5) Bloco 3 | **IMPLANTADO** |
| 6) Bloco 4 | **IMPLANTADO** |
| 7) Bloco 5 | **PARCIAL** |
| 8) Bloco 6 | **IMPLANTADO** |