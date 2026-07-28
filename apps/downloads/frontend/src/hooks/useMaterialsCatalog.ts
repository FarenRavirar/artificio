import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/apiClient';
import { materialListResponseSchema, type MaterialListFilters, type MaterialListResponse } from '../types/material';

export function buildQueryString(filters: MaterialListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.system_id) params.set('system_id', filters.system_id);
  if (filters.edition_id) params.set('edition_id', filters.edition_id);
  if (filters.material_type) params.set('material_type', filters.material_type);
  if (filters.access_kind) params.set('access_kind', filters.access_kind);
  if (filters.publisher) params.set('publisher', filters.publisher);
  if (filters.author) params.set('author', filters.author);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page) params.set('page', String(filters.page));
  return params.toString();
}

// T4.3 (spec 073) — fetch da listagem publica; filtros/ordenacao/paginacao
// como contrato de URL vivem no componente que le/escreve searchParams.
export function useMaterialsCatalog(filters: MaterialListFilters, options?: { enabled?: boolean }) {
  return useQuery<MaterialListResponse>({
    // Spec 087 (T2.2) — no modo vitrine a listagem principal nao e usada (as
    // prateleiras fazem as proprias consultas), entao o chamador desabilita a
    // query em vez de pagar um fetch cujo resultado ninguem renderiza.
    enabled: options?.enabled ?? true,
    queryKey: ['downloads', 'materials', filters],
    queryFn: async () => {
      const response = await apiGet(`/api/v1/materials?${buildQueryString(filters)}`);
      if (!response.ok) {
        throw new Error(`Falha ao buscar materiais: HTTP ${response.status}`);
      }
      const json = await response.json();
      return materialListResponseSchema.parse(json);
    },
  });
}
