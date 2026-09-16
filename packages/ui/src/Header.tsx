import { getAccountsOrigin, logout, redirectToLogin, useSession } from "@artificio/auth/client";
import type { User } from "@artificio/auth";
import { BRAND_ORIGIN } from "@artificio/config";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { brandLogoNavy, brandLogoNeg } from "./brand.js";
import { ChangelogButton } from "./ChangelogButton.js";
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
   * Nome do módulo, usado como rótulo da `moduleNav` (T7.5, spec 102).
   *
   * Nomeia a região no desktop (`aria-label` do `<nav>` da subnav) e titula o bloco
   * dentro do painel público, onde os dois navs aparecem empilhados e nada dizia de
   * quem era cada um. Sem esta prop os dois `<nav>` do painel saíam com o MESMO nome
   * acessível — duas regiões de navegação indistinguíveis para o leitor de tela.
   *
   * O default é genérico de propósito: `moduleNav` sem `moduleLabel` continua válido e
   * ganha um nome distinto do nav de projetos, que é o defeito que esta prop corrige.
   */
  moduleLabel?: string;
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
  moduleLabel = "Neste módulo",
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
  /* O rodapé do painel só existe se houver ferramenta para pôr nele (T7.2). A condição
     espelha o que cada filho de fato renderiza — `showChangelog` sem handler não vira
     botão —, pela mesma razão do wrapper de `.artificio-header-tools`: container vazio
     aqui cobraria o `border-top` do separador sem nada abaixo dele.

     A BUSCA não entra: ela continua exposta na barra em ≤860px (aceite 2 de T7.1), e
     repeti-la daria dois controles para a mesma ação. */
  const hasPanelTools = Boolean((showChangelog && onOpenChangelog) || showThemeToggle);
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
              {/*
                PAINEL DE SESSÃO (T7.3, spec 102) — o que era irmão do avatar na barra
                passa a viver aqui dentro.

                Decisão do mantenedor, dada na F7: "notificação fica dentro do direito,
                pois é notificação de quem fica logado". O código não a implementava: o
                sino entrava por `actions` e virava `.artificio-header-actions`, IRMÃO de
                `renderSession()`, ocupando a faixa ao lado do avatar.

                ⚠️ `actions` é slot EXTENSÍVEL, não "o sino". Medido em 2026-09-15:
                `mesas` passa `<HeaderActions />` (sino com gate próprio), `downloads`
                passa o sino direto e `glossario` passa um botão "Adicionar Sugestão" e
                NENHUM sino. Contar quantos itens cabem na faixa é o erro — a lista cresce
                com o tempo, e a barra de 320px não acompanha. No celular ela desce inteira
                para cá e rola, como qualquer menu.

                Fica ANTES dos itens de conta: é o conteúdo que o módulo injeta, e o
                usuário chega nele primeiro. `Sair` continua por último.
              */}
              {actions ? (
                <div className="artificio-usermenu-actions">{actions}</div>
              ) : null}
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
              <ChangelogButton hasBadge={changelogHasBadge} onClick={onOpenChangelog} />
            ) : null}
            {showThemeToggle ? <ThemeToggle /> : null}
          </div>
        ) : null}
        <div className="artificio-session" aria-live="polite">
          {/*
            Só a PORTA da sessão fica na faixa (T7.3, spec 102): o avatar, que abre o
            painel, ou o "Entrar" quando deslogado.

            ⚠️ `actions` saiu daqui. Era `.artificio-header-actions`, IRMÃO de
            `renderSession()`, e é o que fazia a faixa medir 72px (sino de 40 + avatar de
            32) em vez de 40px — o estouro de 2px em 320. Agora vive dentro do dropdown,
            em `.artificio-usermenu-actions`. Não devolver para cá: a faixa é de largura
            fixa e `actions` é slot extensível, então o que cresce tem de crescer no
            painel, que rola.

            O `menu-toggle` continua no DOM e escondido em ≤860px (`styles.css`): o
            controle do painel de sessão é o próprio avatar, e um hambúrguer ao lado dele
            seria um segundo controle para a mesma gaveta.
          */}
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
          {/* `label` nomeia a REGIÃO (T7.5): sem ele este `<nav>` herdava "Módulos do
              Artifício", o nome do nav de projetos, e o `mesas` anunciava "Catálogo" sob
              o rótulo dos subdomínios. */}
          <Nav
            currentHref={moduleCurrentHref}
            items={moduleNav as NavItem[]}
            label={moduleLabel}
          />
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
          {/* 2º bloco do painel — as rotas DESTE módulo (T7.5, spec 102).

              Os dois navs empilham sem separação, e até aqui saíam com o MESMO nome
              acessível: duas regiões de navegação que o leitor de tela não distinguia
              (WCAG 2.4.1). O rótulo visível resolve os dois lados de uma vez — ele titula
              o bloco na tela e vira o nome acessível do `<nav>` por `aria-labelledby`,
              em vez de repetir o texto num `aria-label` que sairia da sincronia. */}
          {hasModuleNav ? (
            <>
              <p className="artificio-mobile-nav-module-label" id="artificio-module-nav-label">
                {moduleLabel}
              </p>
              <Nav
                currentHref={moduleCurrentHref}
                items={moduleNav as NavItem[]}
                labelledBy="artificio-module-nav-label"
                onNavigate={() => setNavOpen(false)}
              />
            </>
          ) : null}
          {/*
            3º bloco do painel — o RODAPÉ de ferramentas públicas (T7.2, spec 102).

            Ele fecha o bloqueador aberto por T7.1: a regra
            `.artificio-header-tools > *:not([aria-label="Buscar"])` tirou changelog e tema
            da barra em ≤860px, e até aqui não havia destino — nos 6 apps os dois ficaram
            inalcançáveis no celular, e no `accounts` (que liga só `showThemeToggle`) o
            usuário perdia o ÚNICO jeito de trocar para escuro.

            É IRMÃO dos navs, com separador próprio, e não um item de lista: os navs são
            navegação e estes são controles de ferramenta — enfiá-los num `<ul>` de links
            anunciaria "item 3 de 12" para um botão que não navega.

            Os mesmos componentes da barra, não cópias: `ChangelogButton` e `ThemeToggle`
            renderizam aqui e lá. O painel só existe em ≤860px, onde a barra já os
            escondeu, então nunca há dois controles ativos na tela ao mesmo tempo.
          */}
          {hasPanelTools ? (
            <div className="artificio-mobile-nav-footer">
              {showChangelog && onOpenChangelog ? (
                <ChangelogButton
                  hasBadge={changelogHasBadge}
                  onClick={() => {
                    setNavOpen(false);
                    onOpenChangelog();
                  }}
                />
              ) : null}
              {showThemeToggle ? <ThemeToggle /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
