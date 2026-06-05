import type { ReactNode } from 'react';
import { Footer, Header, type UserMenuItem } from '@artificio/ui';
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

export const AppShell = ({ children }: AppShellProps) => {
  const publicOrigin = getMesasPublicOrigin();

  return (
    <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col">
      <Header
        variant="dark"
        brandHref={publicOrigin}
        currentHref={publicOrigin}
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
