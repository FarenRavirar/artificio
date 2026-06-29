import { getAccountsOrigin, logout, redirectToLogin, useSession } from "@artificio/auth/client";
import { StaticChangelogModal, ThemeToggle, applyHeaderVariant, useChangelogBadge, useTheme, CHANGELOG_UPDATE_MARKERS } from "@artificio/ui";
import { useState, useRef, useEffect } from "react";
import rawChangelogs from "../data/changelogs.json";

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
  const [changelogOpen, setChangelogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { hasNewUpdate, markSeen } = useChangelogBadge("site_last_seen_update", CHANGELOG_UPDATE_MARKERS.site);
  const { theme } = useTheme();

  useEffect(() => {
    applyHeaderVariant(theme);
  }, [theme]);

  const openChangelog = () => {
    setChangelogOpen(true);
    markSeen();
  };

  const openSearch = () => {
    document.dispatchEvent(new CustomEvent("artificio:open-search"));
    window.setTimeout(() => {
      const modal = document.getElementById("search-modal");
      if (modal instanceof HTMLElement && modal.hidden) {
        window.location.assign("/busca/");
      }
    }, 100);
  };

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
        aria-label="Novidades"
        title="Novidades"
        onClick={openChangelog}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8.56 3.69a9 9 0 0 0-2.92 1.95" />
          <path d="M3.69 8.56A9 9 0 0 0 3 12" />
          <path d="M8.56 20.31A9 9 0 0 0 12 21" />
          <path d="M20.31 15.44A9 9 0 0 0 21 12" />
          <polygon points="13 2 13 13 18 11 13 13 13 2" />
        </svg>
        {hasNewUpdate ? (
          <span className="artificio-header-action-badge" aria-label="Novidade" />
        ) : null}
      </button>
      <button
        type="button"
        className="artificio-header-action"
        id="search-toggle"
        aria-label="Buscar"
        title="Buscar"
        onClick={openSearch}
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
      <StaticChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} rawChangelogs={rawChangelogs} />
    </>
  );
}

export default SiteHeaderIsland;
