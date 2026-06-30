import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, ClipboardList, DownloadCloud, LayoutDashboard, Settings, Users } from 'lucide-react';
import { cn } from './ui/cn';

interface SidebarGroup {
  label: string;
  slug: string;
  icon: ReactNode;
}

interface Props {
  pendenciaCount?: number;
}

// IA nova (057, proposta-ia §2). Sidebar = recursos, não verbos.
const groups: SidebarGroup[] = [
  { label: 'Visão geral', slug: 'visao-geral', icon: <LayoutDashboard size={18} /> },
  { label: 'Mesas', slug: 'mesas', icon: <ClipboardList size={18} /> },
  { label: 'Catálogo', slug: 'catalogo', icon: <BookOpen size={18} /> },
  { label: 'Comunidade', slug: 'comunidade', icon: <Users size={18} /> },
  { label: 'Importação', slug: 'importacao', icon: <DownloadCloud size={18} /> },
  { label: 'Sistema', slug: 'sistema', icon: <Settings size={18} /> },
];

export function AdminSidebar({ pendenciaCount }: Props) {
  return (
    <nav
      aria-label="Gestão administrativa"
      className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--admin-rail)]"
    >
      <div className="border-b border-[var(--border)] px-5 py-4">
        <span className="eyebrow block text-[var(--fg-low)]">Gestão</span>
      </div>

      <ul className="flex flex-1 flex-col gap-1 p-3">
        {groups.map((group) => (
          <li key={group.slug}>
            <NavLink
              to={`/gestao/${group.slug}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-[var(--color-artificio-orange)] bg-[color-mix(in_srgb,var(--color-artificio-orange)_12%,transparent)] text-[var(--color-artificio-orange)]'
                    : 'border-transparent text-[var(--fg-low)] hover:bg-[var(--admin-hover)] hover:text-[var(--fg-muted)]',
                )
              }
            >
              <span className="shrink-0 opacity-80">{group.icon}</span>
              <span className="truncate">{group.label}</span>
              {/* Badge = total global de pendências (sugestões + rascunhos);
                  fica no overview, não num domínio específico. */}
              {group.slug === 'visao-geral' && pendenciaCount !== undefined && pendenciaCount > 0 && (
                <span
                  title="Pendências no total (sugestões + rascunhos)"
                  className="ml-auto min-w-5 rounded-full bg-[var(--color-artificio-orange)] px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-white"
                >
                  {pendenciaCount}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {pendenciaCount !== undefined && pendenciaCount > 0 && (
        <div className="border-t border-[var(--border)] px-5 py-3 text-xs tabular-nums text-[var(--fg-faint)]">
          {pendenciaCount} pendente{pendenciaCount !== 1 ? 's' : ''}
        </div>
      )}
    </nav>
  );
}
