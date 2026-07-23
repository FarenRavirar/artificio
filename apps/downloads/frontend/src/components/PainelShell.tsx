import { useEffect, useRef, useState, type ReactNode } from 'react';
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

function PainelNavLinks({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
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
              isActive ? 'bg-artificio-orange/20 text-artificio-orange font-semibold' : 'text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--fg)]'
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
export function PainelShell({ children }: Readonly<{ children: ReactNode }>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;

    drawerRef.current?.focus();
    const triggerButton = menuButtonRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      triggerButton?.focus();
    };
  }, [drawerOpen]);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <PainelNavLinks />
        </aside>

        <div className="md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)]"
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
              <div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Menu da conta"
                tabIndex={-1}
                className="w-64 bg-[var(--surface)] p-4 outline-none"
              >
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
