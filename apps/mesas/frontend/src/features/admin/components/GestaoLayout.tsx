import { AdminSidebar } from './AdminSidebar';
import { AdminMain } from './AdminMain';
import { useAdminPendencias } from '../hooks/useAdminPendencias';

/**
 * Shell de navegação da gestão:
 * Sidebar fixa à esquerda + área principal (AdminMain com Outlet).
 * Substitui o layout de abas-topo do GestaoPage.
 * Guard de role admin fica no ProtectedRoute pai (R-A11).
 */
export function GestaoLayout() {
  const { data: pendencias } = useAdminPendencias();
  const pendenciaCount = pendencias && pendencias.total > 0 ? pendencias.total : undefined;

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
