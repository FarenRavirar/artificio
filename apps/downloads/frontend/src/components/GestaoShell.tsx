import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Drawer } from '@artificio/ui';
import { AdminMain, AdminSidebar, type AdminSidebarGroup, type AdminSidebarItem } from '@artificio/ui/admin';
import { AppShell } from './AppShell';
import { useAdminSummary } from '../hooks/useAdminSummary';
import { useCreatorRole } from '../hooks/useCreatorRole';

interface GestaoNavItem {
  label: string;
  href: string;
  countKey?: 'moderation_queue' | 'reports_open' | 'degraded_links' | 'system_suggestions_pending';
  adminOnly?: boolean;
}

// T1.2 (spec 075) — sidebar de RECURSOS (nao verbos), agrupada em
// Conteudo/Operacao/Comunidade/Sistema, com contagem por fila. P0 (denuncia
// aberta) sinaliza com icone + texto, nunca so cor (criterio de aceite 1/8).
// Fase 5C (spec 086): reconstruida sobre AdminSidebar/AdminMain do kit
// compartilhado (packages/ui/src/admin), preservando os 6 pontos de
// nao-regressao do T5C.3 — ver GestaoShell.test.tsx.
const GESTAO_NAV_GROUPS: { label: string; items: GestaoNavItem[] }[] = [
  {
    label: 'Conteúdo',
    items: [
      { label: 'Materiais', href: '/gestao/materiais' },
      { label: 'Importar de HTML', href: '/gestao/materiais/importar' },
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
      { label: 'Sugestões de sistema', href: '/gestao/sugestoes-sistema', countKey: 'system_suggestions_pending', adminOnly: true },
      // D-D (spec 085, Fase 6/8) — cadastro de plataforma e configuracao do
      // sistema (registry em banco), nao parte do fluxo de importar material.
      // Achado real (review PR #201, Codex, P2): rota exige requiredRole
      // "admin" (RequireGestaoAuth), mas moderator continuava vendo o item
      // e caindo na tela de "sem permissão" ao clicar — adminOnly filtra
      // aqui, espelhando o guard da rota.
      { label: 'Plataformas', href: '/gestao/plataformas', adminOnly: true },
    ],
  },
];

interface QueueCounts {
  moderation_queue: { count: number };
  reports_open: { count: number };
  degraded_links: { count: number };
  system_suggestions_pending: { count: number };
}

const OVERVIEW_GROUP: { label: string; items: GestaoNavItem[] } = {
  label: '',
  items: [{ label: 'Visão geral', href: '/gestao' }],
};

function buildSidebarGroups(counts: QueueCounts | undefined, isAdmin: boolean): AdminSidebarGroup[] {
  return [OVERVIEW_GROUP, ...GESTAO_NAV_GROUPS].map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => !item.adminOnly || isAdmin)
      .map((item): AdminSidebarItem => {
        const count = item.countKey ? counts?.[item.countKey]?.count : undefined;
        // P0 (denuncia aberta) precisa de icone + texto, nunca so cor
        // (criterio de aceite 1/8, spec 075) — AdminSidebar so oferece
        // badge numerico, entao o alerta vira parte do label visivel.
        const isP0Queue = item.countKey === 'reports_open' && Boolean(count);
        return {
          label: isP0Queue ? `⚠️ ${item.label}` : item.label,
          href: item.href,
          badge: count,
          badgeLabel: count ? `${count} pendente(s)` : undefined,
        };
      }),
  }));
}

// T1.1/T1.10 (spec 075) — shell de gestao: sidebar desktop fixa + drawer
// mobile, mesmo padrao de PainelShell (074). Fase 5C: sidebar/main vem do
// kit compartilhado; drawer mobile usa o Drawer de packages/ui (foco preso
// resolvido no primitivo — T5C.4).
export function GestaoShell({ children }: Readonly<{ children: ReactNode }>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: summary } = useAdminSummary();
  const { data: creatorRole } = useCreatorRole();
  const { pathname } = useLocation();
  const isAdmin = creatorRole?.role === 'admin';
  const groups = buildSidebarGroups(summary, isAdmin);

  const sidebar = (
    <div className="flex h-full flex-col">
      <AdminSidebar
        groups={groups}
        currentHref={pathname}
        LinkComponent={NavLink}
        onItemSelect={() => setDrawerOpen(false)}
        className="h-full border-r-0"
      />
      <a
        href={import.meta.env.VITE_SITE_ADMIN_SYSTEMS_URL ?? 'https://artificiorpg.com/admin/sistemas'}
        target="_blank"
        rel="noreferrer"
        className="m-3 flex min-h-11 items-center gap-1 rounded-md border border-[var(--admin-border)] px-3 py-2 text-sm text-[var(--admin-fg-low)] hover:text-[var(--admin-fg)]"
      >
        Sistemas e edições <ExternalLink size={14} aria-hidden="true" />
        <span className="sr-only">(abre gestão no Site)</span>
      </a>
    </div>
  );

  return (
    <AppShell>
      <div className="flex" style={{ minHeight: 'calc(100vh - var(--header-height, 0px))' }}>
        <div className="hidden md:block">{sidebar}</div>

        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-h-[44px] min-w-[44px] rounded-md border border-[var(--admin-border)] px-4 py-2 text-sm text-[var(--admin-fg)]"
            aria-expanded={drawerOpen}
          >
            Menu de gestão
          </button>

          <Drawer open={drawerOpen} title="Gestão" side="left" onClose={() => setDrawerOpen(false)}>
            {sidebar}
          </Drawer>
        </div>

        <AdminMain groupEyebrow="Gestão">{children}</AdminMain>
      </div>
    </AppShell>
  );
}
