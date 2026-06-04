import { redirectToLogin, useSession } from "@artificio/auth";
import type { User } from "@artificio/auth";
import { defaultNavItems, type NavItem } from "./modules.js";
import { Nav } from "./Nav.js";

export interface HeaderProps {
  currentHref?: string;
  navItems?: NavItem[];
  sessionOverride?: {
    user: User | null;
    loading?: boolean;
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Header({
  currentHref,
  navItems = defaultNavItems,
  sessionOverride,
}: HeaderProps) {
  const session = useSession();
  const { user, loading } = sessionOverride ?? session;

  return (
    <header className="artificio-header">
      <a className="artificio-brand" href="https://beta.artificiorpg.com">
        <span aria-hidden="true" className="artificio-brand-mark">
          A
        </span>
        <span>Artificio G1</span>
      </a>
      <Nav currentHref={currentHref} items={navItems} />
      <div className="artificio-session" aria-live="polite">
        {loading ? (
          <span className="artificio-session-muted">Carregando</span>
        ) : user ? (
          <a
            className="artificio-avatar-link"
            href="https://accounts.artificiorpg.com"
          >
            {user.avatar ? (
              <img alt="" className="artificio-avatar" src={user.avatar} />
            ) : (
              <span className="artificio-avatar artificio-avatar-fallback">
                {getInitials(user.name)}
              </span>
            )}
            <span className="artificio-user-name">{user.name}</span>
          </a>
        ) : (
          <button
            className="artificio-login-button"
            type="button"
            onClick={() => redirectToLogin()}
          >
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}
