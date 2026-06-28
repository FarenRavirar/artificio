import { useEffect, useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminMain } from './AdminMain';
import { authGet } from '../../../services/apiClient';
import { discordSyncApi } from '../../../features/discord-sync/api/discordSyncApi';

/**
 * Shell de navegação da gestão:
 * Sidebar fixa à esquerda + área principal (AdminMain com Outlet).
 * Substitui o layout de abas-topo do GestaoPage.
 * Guard de role admin fica no ProtectedRoute pai (R-A11).
 */
export function GestaoLayout() {
  const [pendenciaCount, setPendenciaCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [sysRes, sceRes] = await Promise.all([
          authGet('/api/v1/admin/system-suggestions?status=pending'),
          authGet('/api/v1/admin/scenario-suggestions?status=pending'),
        ]);
        let total = 0;
        for (const res of [sysRes, sceRes]) {
          if (res.ok) {
            const data: unknown = await res.json();
            const rows = data && typeof data === 'object' ? (data as Record<string, unknown>).data : [];
            total += Array.isArray(rows) ? rows.length : 0;
          }
        }
        // ⚠️ limit:1 — backend não expõe total; usamos só para detectar ≥1 pendência
        const drafts = await discordSyncApi.getDrafts({ origin: 'all', status: 'needs_review', limit: 1 });
        if (Array.isArray(drafts) && drafts.length > 0) total += 1;
        if (active) setPendenciaCount(total > 0 ? total : undefined);
      } catch {
        if (active) setPendenciaCount(undefined);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: 'calc(100vh - var(--header-height, 0px))',
        backgroundColor: 'var(--admin-canvas, #0B1430)',
      }}
    >
      <AdminSidebar pendenciaCount={pendenciaCount} />
      <AdminMain />
    </div>
  );
}
