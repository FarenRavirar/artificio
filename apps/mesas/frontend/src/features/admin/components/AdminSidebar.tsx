import type { CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ShieldCheck,
  Puzzle,
  Settings,
} from 'lucide-react';

interface SidebarGroup {
  label: string;
  slug: string;
  icon: React.ReactNode;
  badge?: number;
}

interface Props {
  pendenciaCount?: number;
}

const groups: SidebarGroup[] = [
  { label: 'Dashboard', slug: 'dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Conteúdo', slug: 'conteudo', icon: <BookOpen size={18} /> },
  { label: 'Comunidade', slug: 'comunidade', icon: <Users size={18} /> },
  { label: 'Moderação', slug: 'moderacao', icon: <ShieldCheck size={18} /> },
  { label: 'Integrações', slug: 'integracoes', icon: <Puzzle size={18} /> },
  { label: 'Sistema', slug: 'sistema', icon: <Settings size={18} /> },
];

export function AdminSidebar({ pendenciaCount }: Props) {
  return (
    <nav
      aria-label="Gestão administrativa"
      className="w-60 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{
        backgroundColor: 'var(--admin-rail, #0E1A38)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Cabeçalho da sidebar */}
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span
          className="eyebrow block"
          style={{ color: 'var(--fg-low)' }}
        >
          Gestão
        </span>
      </div>

      {/* Lista de grupos */}
      <ul className="flex flex-col gap-1 p-3 flex-1">
        {groups.map((group) => (
          <li key={group.slug}>
            <NavLink
              to={`/gestao/${group.slug}`}
              end={group.slug === 'dashboard'}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[var(--brand)]/10 text-[var(--brand)]'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                }`
              }
              style={({ isActive }: { isActive: boolean }): CSSProperties =>
                isActive
                  ? { borderLeft: '3px solid var(--brand, #FF5722)' }
                  : { borderLeft: '3px solid transparent' }
              }
            >
              <span className="shrink-0 opacity-70">{group.icon}</span>
              <span className="truncate">{group.label}</span>
              {group.badge !== undefined && group.badge > 0 && (
                <span
                  className="ml-auto tabular-nums text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--brand)',
                    color: '#fff',
                    minWidth: '1.25rem',
                    textAlign: 'center',
                  }}
                >
                  {group.badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Pendência geral (opcional, vinda de queueStats) */}
      {pendenciaCount !== undefined && pendenciaCount > 0 && (
        <div
          className="px-5 py-3 border-t text-xs tabular-nums"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--fg-faint)',
          }}
        >
          {pendenciaCount} pendente{pendenciaCount !== 1 ? 's' : ''}
        </div>
      )}
    </nav>
  );
}
