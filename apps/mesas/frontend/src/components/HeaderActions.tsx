import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { NotificationBell } from './NotificationBell';
import { ChangelogModal } from './ChangelogModal';

const UPDATE_MARKER = '2026-04-08-ux-improvements';

/**
 * Ações do header do mesas injetadas no slot `actions` do `@artificio/ui` Header:
 * - Changelog (público) com badge de "novidade" via localStorage.
 * - Sino de notificações (só logado).
 */
export function HeaderActions() {
  const { user } = useAuth();
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('mesas_last_seen_update') !== UPDATE_MARKER;
  });

  const openChangelog = () => {
    setIsChangelogOpen(true);
    setHasNewUpdate(false);
    try {
      window.localStorage.setItem('mesas_last_seen_update', UPDATE_MARKER);
    } catch {
      /* localStorage indisponível: ignora */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openChangelog}
        className="artificio-header-action"
        title="Notas de Atualização"
        aria-label={
          hasNewUpdate
            ? 'Notas de Atualização — nova atualização disponível'
            : 'Notas de Atualização'
        }
      >
        <Zap size={20} aria-hidden="true" />
        {hasNewUpdate ? (
          <span className="artificio-header-action-badge" aria-hidden="true" />
        ) : null}
      </button>

      {user ? <NotificationBell /> : null}

      <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </>
  );
}
