import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Footer, Header, ThemeIcon, setTheme, type NavItem, type UserMenuItem, type Theme } from '@artificio/ui';
import { getAccountsOrigin } from '@artificio/auth/client';
import { FeedbackButton } from '../features/dev-feedback/FeedbackButton';
import { HeaderActions } from './HeaderActions';
import { getMesasPublicOrigin } from '../utils/auth';

/** Tema inicial = o que o boot (main.tsx, default-dark) já aplicou no <html>. */
function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

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
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next); // persiste (cookie canônico + dataset + localStorage)
    setThemeState(next);
  };

  const themeBtn = (
    <button
      type="button"
      className="artificio-header-action"
      title="Alternar tema"
      aria-label="Alternar tema"
      onClick={toggleTheme}
    >
      <ThemeIcon theme={theme} />
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex flex-col">
      <Header
        variant={theme === 'light' ? 'light' : 'dark'}
        brandHref={publicOrigin}
        currentHref={publicOrigin}
        moduleNav={moduleNav}
        moduleCurrentHref={pathname}
        userMenu={userMenu}
        actions={<>{themeBtn}<HeaderActions /></>}
      />
      <div className="flex-1 pt-6">
        {children}
      </div>
      <Footer variant={theme === 'light' ? 'light' : 'dark'} />
      <FeedbackButton />
    </div>
  );
};
