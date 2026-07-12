import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { AppShell } from './AppShell';
import { useAdminSummary } from '../hooks/useAdminSummary';

// T1.2 (spec 075) — sidebar de RECURSOS (nao verbos), agrupada em
// Conteudo/Operacao/Comunidade/Sistema, com contagem por fila. P0 (denuncia
// aberta) sinaliza com icone + texto, nunca so cor (criterio de aceite 1/8).
const GESTAO_NAV_GROUPS = [
  {
    label: 'Conteúdo',
    items: [
      { label: 'Materiais', href: '/gestao/materiais' },
      { label: 'Moderação', href: '/gestao/moderacao', countKey: 'moderation_queue' as const },
      { label: 'Auditoria', href: '/gestao/auditoria' },
      { label: 'Taxonomias', href: '/gestao/taxonomias' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { label: 'Links', href: '/gestao/links', countKey: 'degraded_links' as const },
      { label: 'Arquivos', href: '/gestao/arquivos' },
      { label: 'Mídias', href: '/gestao/midias' },
    ],
  },
  {
    label: 'Comunidade',
    items: [
      { label: 'Denúncias', href: '/gestao/denuncias', countKey: 'reports_open' as const },
      { label: 'Publicadores', href: '/gestao/publicadores' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Métricas', href: '/gestao/metricas' },
      { label: 'Configurações', href: '/gestao/configuracoes' },
    ],
  },
];

interface QueueCounts {
  moderation_queue: { count: number };
  reports_open: { count: number };
  degraded_links: { count: number };
}

function GestaoNavLinks({ counts, onNavigate }: { counts?: QueueCounts; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-4">
      <NavLink
        to="/gestao"
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          `min-h-[44px] rounded-md px-3 py-2 text-sm font-semibold ${
            isActive ? 'bg-artificio-orange/20 text-artificio-orange' : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`
        }
      >
        Visão geral
      </NavLink>

      {GESTAO_NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-white/40">{group.label}</p>
          <div className="mt-1 flex flex-col gap-1">
            {group.items.map((item) => {
              const count = item.countKey ? counts?.[item.countKey]?.count : undefined;
              const isP0Queue = item.countKey === 'reports_open' && Boolean(count);
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center justify-between rounded-md px-3 py-2 text-sm ${
                      isActive ? 'bg-artificio-orange/20 text-artificio-orange font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <span className="flex items-center gap-1">
                    {isP0Queue && <span aria-hidden="true">⚠️</span>}
                    {item.label}
                  </span>
                  {Boolean(count) && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs" aria-label={`${count} pendente(s)`}>
                      {count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}

      <a
        href={import.meta.env.VITE_SITE_ADMIN_SYSTEMS_URL ?? 'https://artificiorpg.com/admin/sistemas'}
        target="_blank"
        rel="noreferrer"
        className="mt-2 flex min-h-[44px] items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-sm text-white/60 hover:text-white"
      >
        Sistemas e edições <span aria-hidden="true">↗</span>
        <span className="sr-only">(abre gestão no Site)</span>
      </a>
    </nav>
  );
}

// T1.1/T1.10 (spec 075) — shell de gestao: sidebar desktop fixa + drawer
// mobile, mesmo padrao de PainelShell (074).
export function GestaoShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: summary } = useAdminSummary();

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="hidden w-60 shrink-0 md:block">
          <GestaoNavLinks counts={summary} />
        </aside>

        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-h-[44px] min-w-[44px] rounded-md border border-white/20 px-4 py-2 text-sm text-white"
            aria-expanded={drawerOpen}
          >
            Menu de gestão
          </button>

          {drawerOpen && (
            <div className="fixed inset-0 z-40 flex">
              <button
                type="button"
                aria-label="Fechar menu"
                className="flex-1 bg-black/60"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="w-64 overflow-y-auto bg-[var(--color-artificio-blue)] p-4">
                <GestaoNavLinks counts={summary} onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
