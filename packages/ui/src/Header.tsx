import { logout, redirectToLogin, useSession } from "@artificio/auth/client";
import type { User } from "@artificio/auth";
import { useEffect, useRef, useState } from "react";
import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { defaultNavItems, type NavItem } from "./modules.js";
import { Nav } from "./Nav.js";

export interface UserMenuItem {
  label: string;
  href: string;
  /** Link externo (outro subdomínio); abre via href normal. */
  external?: boolean;
  /** Só aparece para `role === "admin"`. */
  adminOnly?: boolean;
  variant?: "default" | "danger";
}

export interface HeaderProps {
  currentHref?: string;
  navItems?: NavItem[];
  /** "light" (padrão, logo navy sobre branco) ou "dark" (sobre charcoal). */
  variant?: "light" | "dark";
  /** URL do logo ao clicar (padrão: portal). */
  brandHref?: string;
  /** Itens do menu de conta (avatar). "Sair" é sempre adicionado. */
  userMenu?: UserMenuItem[];
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
  userMenu,
  sessionOverride,
}: HeaderProps) {
  const session = useSession();
  const { user, loading } = sessionOverride ?? session;
  const logo = variant === "dark" ? brandLogoNeg : brandLogoNavy;

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = (userMenu ?? []).filter(
    (item) => !item.adminOnly || user?.role === "admin",
  );

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
          <div className="artificio-usermenu" ref={menuRef}>
            <button
              type="button"
              className="artificio-avatar-link"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {user.avatar ? (
                <img alt="" className="artificio-avatar" src={user.avatar} />
              ) : (
                <span className="artificio-avatar artificio-avatar-fallback">
                  {getInitials(user.name)}
                </span>
              )}
              <span className="artificio-user-name">{user.name}</span>
            </button>
            {open ? (
              <div className="artificio-usermenu-dropdown" role="menu">
                {items.map((item) => (
                  <a
                    key={`${item.href}:${item.label}`}
                    role="menuitem"
                    className={
                      item.variant === "danger"
                        ? "artificio-usermenu-item artificio-usermenu-item-danger"
                        : "artificio-usermenu-item"
                    }
                    href={item.href}
                    {...(item.external ? { rel: "noreferrer" } : {})}
                  >
                    {item.label}
                  </a>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  className="artificio-usermenu-item artificio-usermenu-item-danger"
                  onClick={() => logout(window.location.origin)}
                >
                  Sair
                </button>
              </div>
            ) : null}
          </div>
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
