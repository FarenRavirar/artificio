import { getAccountsOrigin, logout, redirectToLogin, useSession } from "@artificio/auth/client";
import { ThemeToggle, applyHeaderVariant, type Theme } from "@artificio/ui";
import { useState, useRef, useEffect } from "react";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function SiteHeaderIsland() {
  const { user, loading } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = (document.documentElement.dataset.theme || "light") as Theme;
    applyHeaderVariant(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <button
        type="button"
        className="artificio-header-action"
        id="search-toggle"
        aria-label="Buscar"
        title="Buscar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      <ThemeToggle />
      {(() => {
        if (loading) return <span className="artificio-session-muted">Carregando</span>;
        if (user) return (
        <div className="artificio-usermenu" ref={menuRef}>
          <button
            type="button"
            className="artificio-avatar-link"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
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
          {menuOpen ? (
            <div className="artificio-usermenu-dropdown" role="menu">
              {user.role === "admin" ? (
                <a
                  role="menuitem"
                  className="artificio-usermenu-item"
                  href="/admin/"
                >
                  Admin
                </a>
              ) : null}
              <a
                role="menuitem"
                className="artificio-usermenu-item"
                href={`${getAccountsOrigin()}/conta`}
                rel="noreferrer"
              >
                Perfil Artifício
              </a>
              <button
                type="button"
                role="menuitem"
                className="artificio-usermenu-item artificio-usermenu-item-danger"
                onClick={() => logout(globalThis.location.href)}
              >
                Sair
              </button>
            </div>
          ) : null}
        </div>);
        return (
        <button
          className="artificio-login-button"
          type="button"
          onClick={() => redirectToLogin()}
        >
          Entrar
        </button>
        );
      })()}
    </>
  );
}

export default SiteHeaderIsland;
