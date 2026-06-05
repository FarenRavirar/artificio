import { redirectToLogin, useSession } from "@artificio/auth/client";
import type { User } from "@artificio/auth";
import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { defaultNavItems, type NavItem } from "./modules.js";
import { Nav } from "./Nav.js";

export interface HeaderProps {
  currentHref?: string;
  navItems?: NavItem[];
  /** "light" (padrão, logo navy sobre branco) ou "dark" (sobre charcoal). */
  variant?: "light" | "dark";
  /** URL do logo ao clicar (padrão: portal). */
  brandHref?: string;
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
  variant = "light",
  brandHref = "https://beta.artificiorpg.com",
  sessionOverride,
}: HeaderProps) {
  const session = useSession();
  const { user, loading } = sessionOverride ?? session;
  const logo = variant === "dark" ? brandLogoNeg : brandLogoNavy;

  return (
    <header className="artificio-header" data-variant={variant}>
      <a className="artificio-brand" href={brandHref}>
        <img
          alt={logo.alt}
          className="artificio-brand-logo"
          height={logo.height}
          src={logo.src}
          width={logo.width}
        />
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
