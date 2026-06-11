import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, type UserMenuItem } from '@artificio/ui';
import type { User as ArtificioUser } from '@artificio/auth';
import { Zap, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../App';
import { ChangelogModal } from './ChangelogModal';

/**
 * Chrome do glossário = shell compartilhado @artificio/ui (Header).
 * NÃO redefine layout/nav: reusa o Header do domínio (nav cross-módulo +
 * marca + menu de conta) e injeta as ESPECIALIDADES do glossário via props
 * (userMenu, actions, sessionOverride, onLogout, onLoginClick).
 *
 * Auth = legado (AuthContext localStorage/JWT) até a spec 015 (SSO accounts).
 * A sessão legada entra via `sessionOverride`; logout/login via handlers.
 */
export function GlossarioHeader() {
  const { user, logout, loading } = useAuth();
  const { openAddTerm } = useUI();
  const navigate = useNavigate();

  const [changelogOpen, setChangelogOpen] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem('glossario_last_seen_update');
    if (!lastSeen || lastSeen !== '2026-03-30-db-sanitize-script') {
      setHasNewUpdate(true);
    }
  }, []);

  const openChangelog = () => {
    setChangelogOpen(true);
    setHasNewUpdate(false);
    localStorage.setItem('glossario_last_seen_update', '2026-03-30-db-sanitize-script');
  };

  // Adapta o usuário legado ao contrato @artificio/auth (name/role/avatar).
  const sessionUser: ArtificioUser | null = user
    ? {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role === 'admin' ? 'admin' : 'user',
        avatar: null,
      }
    : null;

  // Menu de conta = especialidade do glossário (D043). Itens adminOnly só
  // aparecem para admin (filtro do próprio Header).
  const userMenu: UserMenuItem[] = [
    { label: 'Revisão de Sugestões', href: '/admin/review', adminOnly: true },
    { label: 'Gestão de Membros', href: '/admin/users', adminOnly: true },
    { label: 'Gestão de Estrutura', href: '/admin/structure', adminOnly: true },
    { label: 'Atividade Admin', href: '/admin/activity', adminOnly: true },
    { label: 'Importação em Lote', href: '/importar' },
    { label: 'Notificações', href: '/notificacoes' },
    { label: 'Meu Perfil', href: '/profile' },
  ];

  const actions = user ? (
    <>
      <button
        type="button"
        className="artificio-header-action"
        title="Adicionar Sugestão"
        aria-label="Adicionar Sugestão"
        onClick={openAddTerm}
      >
        <PlusCircle size={20} />
      </button>
      <button
        type="button"
        className="artificio-header-action"
        title="Notas de Atualização"
        aria-label="Notas de Atualização"
        onClick={openChangelog}
        style={{ position: 'relative' }}
      >
        <Zap size={20} />
        {hasNewUpdate ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '9999px',
              background: '#ef4444',
            }}
          />
        ) : null}
      </button>
    </>
  ) : (
    <button
      type="button"
      className="artificio-header-action"
      title="Notas de Atualização"
      aria-label="Notas de Atualização"
      onClick={openChangelog}
    >
      <Zap size={20} />
    </button>
  );

  return (
    <>
      <Header
        brandHref="https://artificiorpg.com"
        sessionOverride={{ user: sessionUser, loading }}
        userMenu={userMenu}
        actions={actions}
        onLogout={logout}
        onLoginClick={() => navigate('/login')}
        loginLabel="Entrar"
      />
      <ChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
}
