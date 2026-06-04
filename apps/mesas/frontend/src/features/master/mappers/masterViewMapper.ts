import type { MasterViewModel, MasterResponse } from '../types/masterView.types';
import { mapTableToView } from '../../table/mappers/tableViewMapper';

/**
 * Resolve avatar com fallback: custom → google → default
 */
function resolveAvatar(master: MasterResponse): string {
  return master.avatar_url || master.google_avatar_url || '/default-avatar.png';
}

/**
 * Mapeia MasterResponse (API) para MasterViewModel (UI)
 * 
 * Responsabilidades:
 * - Resolver avatar com fallback
 * - Mapear mesas usando tableViewMapper (REUSO)
 * - Ordenar mesas por vagas disponíveis (UX)
 * - Determinar ownership
 */
export function mapMasterToView(
  master: MasterResponse,
  currentUserId?: string
): MasterViewModel {
  // Mapear mesas e ordenar: vagas disponíveis primeiro
  const tables = (master.tables || [])
    .map(mapTableToView)
    .sort((a, b) => b.slotsLeft - a.slotsLeft);

  return {
    id: master.id,
    name: master.name,
    avatar: resolveAvatar(master),
    banner: master.banner_url,
    bio: master.bio,
    
    isCovil: master.is_covil || false,
    
    stats: {
      tablesCount: master.stats.tables_count,
      activeTables: master.stats.active_tables,
      totalPlayers: master.stats.total_players,
      rating: master.stats.rating,
    },
    
    tables,
    
    isOwner: currentUserId === master.id,
  };
}
