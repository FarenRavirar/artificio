import { NotificationBell } from "@artificio/ui";
import { useAuth } from "../contexts/useAuth";

export function HeaderActions() {
  const { user } = useAuth();
  if (!user) return null;
  return <NotificationBell sourceApp="mesas" />;
}
