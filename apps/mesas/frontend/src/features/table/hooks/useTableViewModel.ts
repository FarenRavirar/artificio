import { useMemo } from 'react';
import type { TableDetail } from '../../../types/tables';
import type { TableViewModel } from '../types/tableView.types';
import { mapTableToView } from '../mappers/tableViewMapper';

/**
 * Hook para transformar TableDetail em TableViewModel
 * 
 * Ponto de extensão para:
 * - Feature flags
 * - Tracking/analytics
 * - Data enrichment (ranking, score)
 * - A/B experiments
 * 
 * Usa useMemo para otimização (evita recalcular em cada render)
 * 
 * IMPORTANTE: Aceita null para respeitar regras do React (hooks incondicionais)
 */
export function useTableViewModel(table: TableDetail | null): TableViewModel | null {
  return useMemo(() => {
    if (!table) return null;
    return mapTableToView(table);
  }, [table]);
}
