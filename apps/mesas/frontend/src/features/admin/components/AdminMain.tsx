import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Breadcrumb } from './Breadcrumb';

interface Props {
  /** Nome do grupo atual (ex.: "Moderação") */
  groupLabel?: string;
  /** Eyebrow uppercase do grupo (ex.: "MODERAÇÃO") */
  groupEyebrow?: string;
  /** Breadcrumb path (ex.: ["Integrações", "Discord", "Canais monitorados"]) */
  breadcrumbPath?: string[];
  /** Se true, breadcrumb indica "criando" */
  breadcrumbCreating?: boolean;
  /** Zona de ações principais (botões inline) */
  actions?: ReactNode;
  /** Subnavegação local (abas/filtros da seção) */
  subnav?: ReactNode;
}

export function AdminMain({
  groupLabel,
  groupEyebrow,
  breadcrumbPath,
  breadcrumbCreating = false,
  actions,
  subnav,
}: Props) {
  const hasHeader = groupEyebrow || (breadcrumbPath && breadcrumbPath.length > 0) || groupLabel || actions;

  return (
    <div
      className="flex-1 flex flex-col min-w-0 overflow-y-auto"
      style={{ backgroundColor: 'var(--admin-canvas, #0B1430)' }}
    >
      {/* Header contextual — só renderiza se houver conteúdo */}
      {hasHeader && (
        <div
          className="sticky top-0 z-10 px-8 py-4 border-b"
          style={{
            backgroundColor: 'var(--admin-canvas, #0B1430)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Eyebrow + breadcrumb */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3 min-w-0">
              {groupEyebrow && (
                <span
                  className="eyebrow shrink-0"
                  style={{ color: 'var(--fg-low)' }}
                >
                  {groupEyebrow}
                </span>
              )}
              {breadcrumbPath && breadcrumbPath.length > 0 && (
                <Breadcrumb path={breadcrumbPath} creating={breadcrumbCreating} />
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {actions}
              </div>
            )}
          </div>

          {/* Título */}
          {groupLabel && (
            <h1
              className="text-xl font-bold mt-1"
              style={{ color: 'var(--fg)' }}
            >
              {groupLabel}
            </h1>
          )}
        </div>
      )}

      {/* Subnavegação local */}
      {subnav && (
        <div
          className="px-8 py-3 border-b"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--admin-surface, #16223E)',
          }}
        >
          {subnav}
        </div>
      )}

      {/* Outlet — conteúdo da subrota */}
      <div className="flex-1 px-8 py-6">
        <Outlet />
      </div>
    </div>
  );
}
