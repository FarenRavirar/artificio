import type { MasterViewModel, MasterResponse } from '../types/masterView.types';
import { mapTableToView } from '../../table/mappers/tableViewMapper';

/**
 * Resolve avatar com fallback para a imagem padrão.
 *
 * O fallback anterior lia `master.google_avatar_url`, campo que nenhum backend
 * do repositório emite (busca em `apps/` e `packages/` só encontrava a
 * declaração e este uso). Foto do Google chega em `avatar_url` como qualquer
 * outra, resolvida no servidor — o campo extra nunca teve valor e apenas
 * sugeria um caminho de dados inexistente para quem lesse o mapper.
 */
function resolveAvatar(master: MasterResponse): string {
  return master.avatar_url || '/default-avatar.png';
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
    avatarCrop: master.avatar_crop_data ?? null,
    avatarWidth: master.avatar_width ?? null,
    avatarHeight: master.avatar_height ?? null,
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
