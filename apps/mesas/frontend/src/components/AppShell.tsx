import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Footer, Header, type NavItem, type UserMenuItem } from '@artificio/ui';
import { getAccountsOrigin } from '@artificio/auth/client';
import { FeedbackButton } from '../features/dev-feedback/FeedbackButton';
import { HeaderActions } from './HeaderActions';
import { getMesasPublicOrigin } from '../utils/auth';

interface AppShellProps {
  children: ReactNode;
}

const userMenu: UserMenuItem[] = [
  { label: 'Meu Perfil', href: '/perfil' },
  { label: 'Painel', href: '/painel' },
  { label: 'Gestão', href: '/gestao', adminOnly: true },
  { label: 'Conta', href: getAccountsOrigin(), external: true },
];

const moduleNav: NavItem[] = [
  { label: 'Início', href: '/' },
  { label: 'Catálogo', href: '/catalogo' },
  { label: 'Painel', href: '/painel' },
];

export const AppShell = ({ children }: AppShellProps) => {
  const publicOrigin = getMesasPublicOrigin();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col">
      <Header
        variant="dark"
        brandHref={publicOrigin}
        currentHref={publicOrigin}
        moduleNav={moduleNav}
        moduleCurrentHref={pathname}
        userMenu={userMenu}
        actions={<HeaderActions />}
      />
      <div className="flex-1 pt-6">
        {children}
      </div>
      <Footer variant="dark" />
      <FeedbackButton />
    </div>
  );
};
