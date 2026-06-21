import { useAuth } from '../contexts/useAuth';
import { NotificationBell } from './NotificationBell';

export function HeaderActions() {
  const { user } = useAuth();
  if (!user) return null;
  return <NotificationBell />;
}
