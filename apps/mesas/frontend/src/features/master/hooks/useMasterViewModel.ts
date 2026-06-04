import { useMemo } from 'react';
import type { MasterViewModel, MasterResponse } from '../types/masterView.types';
import { mapMasterToView } from '../mappers/masterViewMapper';

/**
 * Hook para transformar MasterResponse em MasterViewModel
 * 
 * Segue o mesmo padrão do useTableViewModel:
 * - Aceita null para respeitar regras do React (hooks incondicionais)
 * - Usa useMemo para otimização
 * - Centraliza lógica de transformação
 * 
 * @param master - Dados do mestre da API (ou null)
 * @param currentUserId - ID do usuário logado (para determinar ownership)
 * @returns ViewModel ou null
 */
export function useMasterViewModel(
  master: MasterResponse | null,
  currentUserId?: string
): MasterViewModel | null {
  return useMemo(() => {
    if (!master) return null;
    return mapMasterToView(master, currentUserId);
  }, [master, currentUserId]);
}
