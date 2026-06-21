import { getAccountsOrigin, logout, redirectToLogin, useSession } from "@artificio/auth/client";
import type { User } from "@artificio/auth";
import { BRAND_ORIGIN } from "@artificio/config";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { defaultNavItems, type NavItem } from "./modules.js";
import { Nav } from "./Nav.js";
import { ThemeToggle } from "./theme.js";

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
  /** Nav principal = projetos do portal (cross-subdomínio). */
  navItems?: NavItem[];
  /** Nav secundário = rotas internas do projeto (ex.: Catálogo/Painel). 2ª linha. */
  moduleNav?: NavItem[];
  /** Href ativo do nav de projeto (ex.: pathname). Highlight do subnav. */
  moduleCurrentHref?: string;
  /** "light" (padrão, logo navy sobre branco) ou "dark" (sobre charcoal). */
  variant?: "light" | "dark";
  /** Header fixo no topo ao rolar (default true). */
  sticky?: boolean;
  /** URL do logo ao clicar (padrão: portal). */
  brandHref?: string;
  /** Itens do menu de conta (avatar). "Sair" é sempre adicionado. */
  userMenu?: UserMenuItem[];
  /** Ações do projeto antes do avatar (ex.: sino de notificações). */
  actions?: ReactNode;
  sessionOverride?: {
    user: User | null;
    loading?: boolean;
  };
  /**
   * Handler de logout. Default = logout SSO (`@artificio/auth/client`).
   * Módulos com auth legado (ex.: glossário pré-SSO) injetam o próprio.
   */
  onLogout?: () => void;
  /**
   * Handler do botão "Entrar". Default = redirect SSO (`redirectToLogin`).
   * Módulos com auth legado injetam o próprio (ex.: navegar p/ /login).
   */
  onLoginClick?: () => void;
  /** Rótulo do botão de login (default "Entrar"). */
  loginLabel?: string;
  /**
   * Exibe o toggle de tema (lua/sol) reusando o cookie cross-subdomínio
   * `artificio_theme`. Default false — só habilitar em projetos com CSS dark.
   */
  showThemeToggle?: boolean;
  /** Exibe o botão de busca do header (ícone lupa). Ação injetada pelo app. */
  showSearch?: boolean;
  /** Handler acionado ao clicar no botão de busca. Sem handler, o botão não é renderizado. */
  onSearch?: () => void;
  /** Exibe o botão de changelog central (ícone raio + badge de novidade). Conteúdo/modal é do app. */
  showChangelog?: boolean;
  /** Handler acionado ao clicar no botão de changelog. */
  onOpenChangelog?: () => void;
  /** Mostra o badge de "novidade" no botão de changelog. */
  changelogHasBadge?: boolean;
  /** Conta local do serviço: label e href p/ o item "Conta <Serviço>" no menu. */
  serviceAccount?: { label: string; href: string };
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
  moduleNav,
  moduleCurrentHref,
  variant = "light",
  sticky = true,
  brandHref = BRAND_ORIGIN,
  userMenu,
  actions,
  sessionOverride,
  onLogout,
  onLoginClick,
  loginLabel = "Entrar",
  showThemeToggle = false,
  showSearch = false,
  onSearch,
  showChangelog = false,
  onOpenChangelog,
  changelogHasBadge = false,
  serviceAccount,
}: HeaderProps) {
  const session = useSession();
  const { user, loading } = sessionOverride ?? session;
  const logo = variant === "dark" ? brandLogoNeg : brandLogoNavy;
  const hasModuleNav = Boolean(moduleNav && moduleNav.length > 0);

  const [open, setOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
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

  useEffect(() => {
    if (!navOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const globalMenuItems: UserMenuItem[] = [
    {
      label: "Perfil Artifício",
      href: `${getAccountsOrigin()}/conta`,
      external: true,
    },
    ...(serviceAccount
      ? [{ label: serviceAccount.label, href: serviceAccount.href }]
      : []),
  ];

  const appItems = (userMenu ?? []).filter(
    (item) => !item.adminOnly || user?.role === "admin",
  );

  const items = [...globalMenuItems, ...appItems];

  function renderSession() {
    if (loading) {
      return <span className="artificio-session-muted">Carregando</span>;
    }
    if (user) {
      return (
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
                onClick={() => (onLogout ? onLogout() : logout(window.location.origin))}
              >
                Sair
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <button
        className="artificio-login-button"
        type="button"
        onClick={() => (onLoginClick ? onLoginClick() : redirectToLogin())}
      >
        {loginLabel}
      </button>
    );
  }

  return (
    <header
      className="artificio-header"
      data-variant={variant}
      data-sticky={sticky ? "true" : undefined}
    >
      <div className="artificio-header-main">
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
          {showSearch && onSearch ? (
            <button
              type="button"
              className="artificio-header-action"
              aria-label="Buscar"
              title="Buscar"
              onClick={onSearch}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          ) : null}
          {showChangelog && onOpenChangelog ? (
            <button
              type="button"
              className="artificio-header-action"
              aria-label="Changelog"
              title="Changelog"
              onClick={onOpenChangelog}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8.56 3.69a9 9 0 0 0-2.92 1.95" />
                <path d="M3.69 8.56A9 9 0 0 0 3 12" />
                <path d="M8.56 20.31A9 9 0 0 0 12 21" />
                <path d="M20.31 15.44A9 9 0 0 0 21 12" />
                <polygon points="13 2 13 13 18 11 13 13 13 2" />
              </svg>
              {changelogHasBadge ? (
                <span className="artificio-header-action-badge" aria-label="Novidade" />
              ) : null}
            </button>
          ) : null}
          {showThemeToggle ? <ThemeToggle /> : null}
          {actions ? (
            <div className="artificio-header-actions">{actions}</div>
          ) : null}
          {renderSession()}
          <button
            type="button"
            className="artificio-menu-toggle"
            aria-label="Menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((value) => !value)}
          >
            ☰
          </button>
        </div>
      </div>

      {hasModuleNav ? (
        <div className="artificio-subnav">
          <Nav currentHref={moduleCurrentHref} items={moduleNav as NavItem[]} />
        </div>
      ) : null}

      {navOpen ? (
        <div className="artificio-mobile-nav" onClick={() => setNavOpen(false)}>
          <Nav currentHref={currentHref} items={navItems} />
          {hasModuleNav ? (
            <Nav currentHref={moduleCurrentHref} items={moduleNav as NavItem[]} />
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
