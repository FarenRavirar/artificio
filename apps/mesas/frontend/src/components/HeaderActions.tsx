import { NotificationBell } from "@artificio/ui";
import { useAuth } from "../contexts/useAuth";

export function HeaderActions() {
  // Gate próprio do mesas (não o useSession() interno do NotificationBell):
  // mantém o AppShell consistente com o resto do app, que já decide sessão
  // por este contexto local antes de montar qualquer ação do header.
  const { user } = useAuth();
  if (!user) return null;
  return <NotificationBell sourceApp="mesas" />;
}
