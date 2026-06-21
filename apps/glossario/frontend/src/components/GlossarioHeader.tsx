import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, useTheme, useChangelogBadge, CHANGELOG_UPDATE_MARKERS, type UserMenuItem } from '@artificio/ui';
import type { User as ArtificioUser } from '@artificio/auth';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { useUI } from '../context/UIContext';
import { ChangelogModal } from './ChangelogModal';

export function GlossarioHeader() {
  const { user, logout, loading } = useAuth();
  const { openAddTerm } = useUI();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { hasNewUpdate, markSeen } = useChangelogBadge('glossario_last_seen_update', CHANGELOG_UPDATE_MARKERS.glossario);

  const [changelogOpen, setChangelogOpen] = useState(false);

  const openChangelog = () => {
    setChangelogOpen(true);
    markSeen();
  };

  const sessionUser: ArtificioUser | null = user
    ? {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role === 'admin' ? 'admin' : 'user',
        avatar: null,
      }
    : null;

  const userMenu: UserMenuItem[] = [
    { label: 'Revisão de Sugestões', href: '/admin/review', adminOnly: true },
    { label: 'Gestão de Membros', href: '/admin/users', adminOnly: true },
    { label: 'Gestão de Estrutura', href: '/admin/structure', adminOnly: true },
    { label: 'Atividade Admin', href: '/admin/activity', adminOnly: true },
    { label: 'Feedback', href: '/admin/feedback', adminOnly: true },
    { label: 'Importação em Lote', href: '/importar' },
    { label: 'Notificações', href: '/notificacoes' },
    { label: 'Meu Perfil', href: '/perfil' },
  ];

  const handleSearch = () => {
    navigate('/busca');
  };

  return (
    <>
      <Header
        brandHref="https://glossario.artificiorpg.com"
        variant={theme === 'dark' ? 'dark' : 'light'}
        sessionOverride={{ user: sessionUser, loading }}
        userMenu={userMenu}
        showThemeToggle
        showSearch
        onSearch={handleSearch}
        showChangelog
        onOpenChangelog={openChangelog}
        changelogHasBadge={hasNewUpdate}
        serviceAccount={{ label: 'Conta Glossário', href: '/perfil' }}
        onLogout={logout}
        onLoginClick={() => navigate('/login')}
        loginLabel="Entrar"
        actions={
          user ? (
            <button
              type="button"
              className="artificio-header-action"
              title="Adicionar Sugestão"
              aria-label="Adicionar Sugestão"
              onClick={openAddTerm}
            >
              <PlusCircle size={20} />
            </button>
          ) : undefined
        }
      />
      <ChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
}
