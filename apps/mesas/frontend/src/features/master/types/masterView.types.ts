import type { TableViewModel } from '../../table/types/tableView.types';
import type { TableDetail } from '../../../types/tables';

/**
 * ViewModel para o perfil público do mestre
 * Segue o mesmo padrão do TableViewModel
 */
export interface MasterViewModel {
  id: string;
  name: string;
  avatar: string;  // Já resolvido (custom || google || default)
  banner?: string;
  bio?: string;
  
  isCovil: boolean;
  
  stats: {
    tablesCount: number;
    activeTables: number;
    totalPlayers?: number;
    rating?: number;
  };
  
  tables: TableViewModel[];  // REUSA TableViewModel
  
  isOwner: boolean;
}

/**
 * Resposta da API /api/v1/masters/:id
 */
export interface MasterResponse {
  id: string;
  name: string;
  avatar_url?: string;
  google_avatar_url?: string;
  banner_url?: string;
  bio?: string;
  is_covil: boolean;
  
  stats: {
    tables_count: number;
    active_tables: number;
    rating?: number;
    total_players?: number;
  };
  
  tables: TableDetail[];
}
