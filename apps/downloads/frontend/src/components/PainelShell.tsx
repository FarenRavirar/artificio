import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { AppShell } from './AppShell';

const PAINEL_NAV = [
  { label: 'Visão geral', href: '/painel' },
  { label: 'Meus materiais', href: '/painel/materiais' },
  { label: 'Favoritos', href: '/painel/favoritos' },
  { label: 'Coleções', href: '/painel/colecoes' },
  { label: 'Perfil', href: '/painel/perfil' },
  { label: 'Organizações', href: '/painel/organizacoes' },
  { label: 'Notificações', href: '/painel/notificacoes' },
  { label: 'Denúncias', href: '/painel/denuncias' },
  { label: 'Configurações', href: '/painel/configuracoes' },
];

function PainelNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {PAINEL_NAV.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === '/painel'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `min-h-[44px] rounded-md px-3 py-2 text-sm ${
              isActive ? 'bg-artificio-orange/20 text-artificio-orange font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

// T1.10 (spec 074) — sidebar de conta desktop + drawer mobile, substitui a
// sidebar publica (073) dentro de /painel/*.
export function PainelShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <PainelNavLinks />
        </aside>

        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-h-[44px] min-w-[44px] rounded-md border border-white/20 px-4 py-2 text-sm text-white"
            aria-expanded={drawerOpen}
          >
            Menu da conta
          </button>

          {drawerOpen && (
            <div className="fixed inset-0 z-40 flex">
              <button
                type="button"
                aria-label="Fechar menu"
                className="flex-1 bg-black/60"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="w-64 bg-[var(--color-artificio-blue)] p-4">
                <PainelNavLinks onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
