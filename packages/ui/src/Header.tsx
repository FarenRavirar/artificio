import { getAccountsOrigin, logout, redirectToLogin, useSession } from "@artificio/auth/client";
import type { User } from "@artificio/auth";
import { BRAND_ORIGIN } from "@artificio/config";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { defaultNavItems, type NavItem } from "./modules.js";
import { Nav } from "./Nav.js";
import { NavToggle } from "./NavToggle.js";
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
  /**
   * FORÇA o chrome claro ou escuro, ignorando o tema do documento.
   *
   * ⚠️ Não passar é o caso normal (T7.4, spec 102). Sem esta prop o header segue
   * `:root[data-theme="dark"]`, que o script inline de cada app já aplica antes da
   * primeira pintura — sem JS, sem esperar hidratação. Passar `variant={theme}`,
   * como os 6 apps faziam até 2026-09-15, é reimplementar em JS o que o CSS faz
   * antes, e foi a causa do FOUC: o corpo escurecia na hora e o header só depois.
   *
   * Existe para header/footer sobre o navy do hero num documento claro.
   */
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
  /**
   * Handler legado do botão de lupa. Continua aditivo para módulos que ainda
   * navegam a uma página própria de busca.
   */
  onSearch?: () => void;
  /** Valor controlado do campo de busca embutido. */
  searchValue?: string;
  /**
   * Habilita o campo de busca embutido. O app continua dono do estado, do
   * debounce e da URL; o Header não conhece router nem contrato de query.
   */
  onSearchChange?: (value: string) => void;
  /** Placeholder do campo embutido. */
  searchPlaceholder?: string;
  /** Nome acessível do campo embutido. */
  searchLabel?: string;
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
  variant,
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
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar",
  searchLabel = "Buscar",
  showChangelog = false,
  onOpenChangelog,
  changelogHasBadge = false,
  serviceAccount,
}: HeaderProps) {
  const session = useSession();
  const { user, loading } = sessionOverride ?? session;
  /* As DUAS marcas saem no HTML e o CSS mostra uma (`.logo-navy`/`.logo-neg`,
     `styles.css`). Escolher em JS — como era até 2026-09-15 — só funcionava com
     `variant` explícito: quando o escuro vem do tema do documento, o React não tem
     como saber antes de hidratar, e o wordmark navy ficava sobre o navy. É o mesmo
     padrão que `apps/site` já usava no seu header próprio. */
  const hasModuleNav = Boolean(moduleNav && moduleNav.length > 0);
  const hasEmbeddedSearch = showSearch && Boolean(onSearchChange);

  const [open, setOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Exclusão mútua dos dois painéis do header: menu do avatar e painel mobile.
     Só um pode estar aberto — o dropdown é `position:absolute; z-index:50`
     (`styles.css:842-856`) e o painel mobile é irmão em fluxo normal, então abertos
     juntos eles se sobrepõem na mesma extremidade da barra.

     Não bastava o clique-fora que já existia: ele fecha o avatar ao clicar no
     hambúrguer (o toggle está fora do `menuRef`), mas o caminho inverso não tinha
     nada — o painel mobile só escutava `Escape`, então abrir o avatar com ele aberto
     deixava os dois. Fechar pelo setter cobre os dois sentidos numa regra só. */
  const toggleUserMenu = () => {
    setOpen((value) => {
      if (!value) setNavOpen(false);
      return !value;
    });
  };

  const toggleNav = () => {
    setNavOpen((value) => {
      if (!value) setOpen(false);
      return !value;
    });
  };


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
      return <span className="artificio-session-loading" aria-busy="true">Verificando acesso…</span>;
    }
    if (user) {
      return (
        <div className="artificio-usermenu" ref={menuRef}>
          <button
            type="button"
            className="artificio-avatar-link"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={toggleUserMenu}
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
      /* `undefined` OMITE o atributo, e a omissão é o contrato (T7.4): o CSS casa
         `:root[data-theme="dark"] .artificio-header:not([data-variant="light"])`, que
         um `data-variant="light"` literal bloquearia. Emitir o default — como era até
         2026-09-15 — deixava os 5 apps SPA permanentemente claros mesmo no tema escuro. */
      data-variant={variant}
      data-sticky={sticky ? "true" : undefined}
    >
      <div className="artificio-header-main" data-has-search={hasEmbeddedSearch ? "true" : undefined}>
        {/*
          Hambúrguer PÚBLICO — 1º slot em ≤860px (T7.1, spec 102). Abre o painel com a
          navegação entre módulos, as opções do módulo atual e o rodapé de ferramentas
          (changelog e tema), que T7.2 preenche.

          É filho DIRETO do grid e vem antes da marca no DOM porque a ordem do documento
          é a ordem do leitor de tela e do Tab — e na tela ele está à esquerda de tudo.
          Posicioná-lo por `order` do CSS divergiria as duas, que é o defeito que o
          `order` costuma introduzir.

          `display: none` no desktop (regra base de `.artificio-nav-toggle`): a nav
          inline dá conta ali, e o painel só existe abaixo de 860px.
        */}
        <NavToggle
          className="artificio-nav-toggle"
          label="Menu de navegação"
          expanded={navOpen}
          onClick={toggleNav}
        />
        <a className="artificio-brand" href={brandHref}>
          <img
            alt={brandLogoNavy.alt}
            className="artificio-brand-logo logo-navy"
            height={brandLogoNavy.height}
            src={brandLogoNavy.src}
            width={brandLogoNavy.width}
          />
          <img
            alt={brandLogoNeg.alt}
            className="artificio-brand-logo logo-neg"
            height={brandLogoNeg.height}
            src={brandLogoNeg.src}
            width={brandLogoNeg.width}
          />
        </a>
        <Nav currentHref={currentHref} items={navItems} />
        {hasEmbeddedSearch ? (
          <label className="artificio-header-search">
            <svg
              className="artificio-header-search-icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              className="artificio-header-search-input"
              aria-label={searchLabel}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
            />
          </label>
        ) : null}
        {/*
          Ferramentas PÚBLICAS — esquerda (T3.5e, spec 102). Busca, changelog e tema
          não exigem sessão: nenhuma delas lê `user`/`loading`. Estavam dentro de
          `.artificio-session`, que é a faixa da sessão, por uma organização antiga por
          TIPO ("navegação à esquerda, ferramentas à direita"). A regra do mantenedor é
          por ACESSO: ferramenta pública à esquerda; a sessão — e a porta para ela — à
          direita.

          Container próprio mesmo quando vazio não é criado: sem nenhuma das três
          ligadas, o app não ganha coluna sobrando no grid.

          A condição espelha o que cada filho de fato renderiza, e não as props soltas:
          `showSearch` com `onSearchChange` liga a busca EMBUTIDA, que vive fora daqui
          (`hasEmbeddedSearch` desliga a lupa). Checar `showSearch` sozinho criava a
          coluna vazia justamente no consumidor com busca embutida e nenhuma outra
          ferramenta — o `mesas`.
        */}
        {(showSearch && !hasEmbeddedSearch && onSearch) ||
        (showChangelog && onOpenChangelog) ||
        showThemeToggle ? (
          <div className="artificio-header-tools">
            {showSearch && !hasEmbeddedSearch && onSearch ? (
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
          </div>
        ) : null}
        <div className="artificio-session" aria-live="polite">
          {/*
            Fica na direita, cada um por um motivo diferente (aceite 15):
            `actions` é conteúdo do app consumidor (o `mesas` injeta o sino por ela, e o
            sino exige sessão); `renderSession()` cobre avatar+menu (exige sessão) e o
            botão "Entrar", que é público mas é a PORTA da sessão — vai onde o avatar
            aparecerá depois do login; o `menu-toggle` é o controle do painel mobile, e
            a extremidade da barra é o lugar convencional dele.
          */}
          {actions ? (
            <div className="artificio-header-actions">{actions}</div>
          ) : null}
          {renderSession()}
          <NavToggle
            className="artificio-menu-toggle"
            label="Menu"
            expanded={navOpen}
            onClick={toggleNav}
          />
        </div>
      </div>

      {hasModuleNav ? (
        <div className="artificio-subnav">
          <Nav currentHref={moduleCurrentHref} items={moduleNav as NavItem[]} />
        </div>
      ) : null}

      {/* O <div> do painel NÃO escuta evento (Sonar S6847/S1082): quem fecha é o próprio
          link, via `onNavigate` do `Nav`. O `<a>` é interativo de nascença — teclado,
          toque e mouse de graça —, enquanto `role`+`tabIndex` num <div> inventaria um
          controle que não existe. Primeira tentativa trocou `onClick` por
          `onClickCapture`+`onKeyUp` e o Sonar seguiu acusando, com razão: a regra é sobre
          haver handler no elemento não-interativo, não sobre qual. */}
      {navOpen ? (
        <div className="artificio-mobile-nav">
          <Nav currentHref={currentHref} items={navItems} onNavigate={() => setNavOpen(false)} />
          {hasModuleNav ? (
            <Nav
              currentHref={moduleCurrentHref}
              items={moduleNav as NavItem[]}
              onNavigate={() => setNavOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
