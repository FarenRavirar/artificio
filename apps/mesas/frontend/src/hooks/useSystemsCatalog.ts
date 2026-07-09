import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { authGet } from '../services/apiClient';
import type { SystemTreeNode } from '../types/systems';

const SYSTEMS_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

const systemTreeNodeSchema: z.ZodType<SystemTreeNode> = z.lazy(() => z.object({
  id: z.string(),
  name: z.string(),
  name_pt: z.string().nullable(),
  slug: z.string(),
  parent_id: z.string().nullable(),
  node_type: z.enum(['system', 'edition', 'variant', 'subsystem']),
  depth: z.number().optional(),
  path_slug: z.string().nullable(),
  logo_filename: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
  aliases: z.array(z.string()).optional(),
  has_children: z.boolean().optional(),
  children_count: z.coerce.number().optional(),
  tables_count: z.coerce.number().optional(),
  aliases_count: z.coerce.number().optional(),
  children: z.array(systemTreeNodeSchema).optional(),
}));

type SystemsCatalogCacheEntry = {
  loadedAt: number;
  promise: Promise<SystemTreeNode[]>;
};

type SystemsCatalogState = {
  tree: SystemTreeNode[];
  loading: boolean;
  error: string | null;
};

export type SystemsCatalogFlatNode = SystemTreeNode & {
  parent: SystemTreeNode | null;
  ancestors: SystemTreeNode[];
};

export type SystemsCatalogResult = SystemsCatalogState & {
  flat: SystemsCatalogFlatNode[];
  forceRefresh: () => Promise<SystemTreeNode[] | undefined>;
};

let systemsCatalogCache: SystemsCatalogCacheEntry | null = null;

export const invalidateSystemsCatalogCache = () => {
  systemsCatalogCache = null;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const normalizeSystemTreeNode = (raw: unknown): SystemTreeNode => {
  const parsed = systemTreeNodeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TypeError('Resposta de sistemas em formato inesperado.');
  }
  return {
    ...parsed.data,
    aliases: parsed.data.aliases ?? [],
    children: parsed.data.children ?? [],
  };
};

const normalizeSystemTree = (raw: unknown): SystemTreeNode[] => {
  if (!Array.isArray(raw)) {
    throw new TypeError('Resposta de sistemas em formato inesperado.');
  }
  return raw.map(normalizeSystemTreeNode);
};

const fetchSystemsCatalog = async (): Promise<SystemTreeNode[]> => {
  const response = await authGet('/api/v1/systems?view=tree');
  if (!response.ok) {
    throw new Error('Erro ao carregar sistemas.');
  }
  const json: unknown = await response.json();
  return normalizeSystemTree(asRecord(json).data);
};

export const loadSystemsCatalog = (forceRefresh = false): Promise<SystemTreeNode[]> => {
  const now = Date.now();
  if (
    forceRefresh
    || !systemsCatalogCache
    || now - systemsCatalogCache.loadedAt > SYSTEMS_CATALOG_CACHE_TTL_MS
  ) {
    systemsCatalogCache = {
      loadedAt: now,
      promise: fetchSystemsCatalog().catch((error) => {
        systemsCatalogCache = null;
        throw error;
      }),
    };
  }
  return systemsCatalogCache.promise;
};

export const flattenSystemsCatalog = (tree: SystemTreeNode[]): SystemsCatalogFlatNode[] => {
  const flat: SystemsCatalogFlatNode[] = [];

  const visit = (
    nodes: SystemTreeNode[],
    parent: SystemTreeNode | null,
    ancestors: SystemTreeNode[],
  ) => {
    for (const node of nodes) {
      flat.push({ ...node, parent, ancestors });
      visit(node.children ?? [], node, [...ancestors, node]);
    }
  };

  visit(tree, null, []);
  return flat;
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error && error.message
    ? error.message
    : 'Erro ao carregar sistemas.'
);

export function useSystemsCatalog(): SystemsCatalogResult {
  const [state, setState] = useState<SystemsCatalogState>({
    tree: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async (forceRefresh = false) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const tree = await loadSystemsCatalog(forceRefresh);
      setState({ tree, loading: false, error: null });
      return tree;
    } catch (error) {
      const message = getErrorMessage(error);
      setState((current) => ({ ...current, loading: false, error: message }));
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadSystemsCatalog()
      .then((tree) => {
        if (!cancelled) {
          setState({ tree, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: getErrorMessage(error),
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const flat = useMemo(() => flattenSystemsCatalog(state.tree), [state.tree]);

  const forceRefresh = useCallback(async () => {
    try {
      return await load(true);
    } catch {
      return undefined;
    }
  }, [load]);

  return {
    ...state,
    flat,
    forceRefresh,
  };
}
