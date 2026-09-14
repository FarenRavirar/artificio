import { getAccountsOrigin, logout, redirectToLogin, useSession } from "@artificio/auth/client";
import { NotificationBell, StaticChangelogModal, ThemeToggle, applyHeaderVariant, useChangelogBadge, useTheme, CHANGELOG_UPDATE_MARKERS } from "@artificio/ui";
import { useState, useRef, useEffect } from "react";
import rawChangelogs from "../data/changelogs.json";

export interface SiteNavItem {
  label: string;
  href: string;
}

export interface SiteHeaderIslandProps {
  /** Projetos do portal (MODULES). Vem do Astro como dado estático — ver nota de SSR abaixo. */
  modules?: SiteNavItem[];
  /** Categorias do blog (SECTIONS), 2ª linha no desktop. */
  sections?: SiteNavItem[];
  /** Href da seção ativa, para o `aria-current` da subnav. */
  currentHref?: string;
  /** Origem pública do site (`BRAND_ORIGIN`): marca o item "Portal" como página atual. */
  siteOrigin?: string;
  /** Caminho da página sendo renderizada, para destacar a categoria ativa na subnav. */
  pathname?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/*
  Header do `site` (T3.5d + T3.5g, spec 102).

  O `site` NÃO usa `packages/ui/src/Header.tsx` — tem marcação própria. As duas subfases
  foram implementadas no mesmo trabalho porque mexem nos mesmos arquivos: T3.5d move o
  nav para dentro da ilha (o toggle do mobile precisa de estado), T3.5g redistribui os
  itens entre esquerda e direita. Feitas em separado, a segunda reescreveria a primeira.

  ⚠️ Os 11 links do nav PRECISAM continuar no HTML servido (aceite 13). Eles chegam como
  props de dado estático e são renderizados no SSR do React — `client:idle` hidrata
  depois, mas a marcação já saiu no HTML. NÃO trocar por `client:only` nem condicionar o
  render à hidratação: o toggle passaria no aceite e os 11 links sumiriam para o crawler,
  que é exatamente a regressão que o item 13 existe para impedir.

  Regra de acesso (T3.5g): ferramenta pública à esquerda; a sessão — e a porta para ela —
  à direita. Por isso "Entrar" fica na direita apesar de público: é onde o avatar aparece
  depois do login. O sino exige sessão (`NotificationBell.tsx:266`), então também fica.
*/
export function SiteHeaderIsland({ modules = [], sections = [], currentHref, siteOrigin, pathname }: SiteHeaderIslandProps) {
  /* Seção ativa da subnav. `currentHref` continua aceito (o `Base.astro` o repassa),
     mas nenhuma rota o preenche hoje — medido. O fallback pelo pathname faz a categoria
     atual destacar sem exigir que cada página passe a prop, que é o defeito que deixava
     a subnav inteira sem `aria-current` em produção. */
  function isCurrent(item: SiteNavItem): boolean {
    if (currentHref && currentHref === item.href) return true;
    /* "Portal" aponta para a origem do próprio site: é a página atual em toda rota. */
    if (siteOrigin && item.href === siteOrigin) return true;
    if (!pathname) return false;
    return item.href.startsWith("/") && item.href !== "/" && pathname.startsWith(item.href);
  }

  const { user, loading } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Exclusão mútua dos dois painéis (mesma regra do `packages/ui/src/Header.tsx`):
     menu do avatar e painel mobile não abrem juntos. O dropdown é absoluto sobre a
     barra e o painel mobile é irmão em fluxo — sobrepostos, disputam a mesma
     extremidade. O clique-fora do avatar já o fechava ao tocar no hambúrguer; faltava
     o sentido inverso. */
  const toggleUserMenu = () => {
    setMenuOpen((v) => {
      if (!v) setNavOpen(false);
      return !v;
    });
  };

  const toggleNav = () => {
    setNavOpen((v) => {
      if (!v) setMenuOpen(false);
      return !v;
    });
  };

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
      if (!(modal instanceof HTMLElement) || modal.hidden) {
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

  useEffect(() => {
    if (!navOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  /* `aria-current` do nav de PROJETOS: o item "Portal" aponta para `BRAND_ORIGIN`
     (`packages/ui/src/modules.ts:9`), que é a origem deste próprio site — logo ele é a
     página atual em qualquer rota daqui. A versão anterior deste header comparava
     `label === "Portal"`; a comparação por href diz a mesma coisa sem depender do
     rótulo. NÃO trocar por `currentHref`: nenhuma rota do site passa essa prop
     (medido), e o atributo simplesmente sumiria do nav — foi o que aconteceu na
     primeira versão de T3.5d. */
  function renderNavList(items: SiteNavItem[], ariaLabel: string) {
    return (
      <nav aria-label={ariaLabel}>
        <ul className="artificio-nav-list">
          {items.map((item) => (
            <li key={item.href}>
              <a
                className="artificio-nav-link"
                href={item.href}
                aria-current={isCurrent(item) ? "page" : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  /* Ferramentas públicas — esquerda (T3.5g). Não exigem sessão: nenhuma delas lê `user`. */
  const ferramentasPublicas = (
    <div className="artificio-header-tools">
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
    </div>
  );

  /* Sessão — direita (T3.5g): avatar, menu, sino e o botão "Entrar". */
  const sessao = (() => {
    if (loading) return <span className="artificio-session-muted">Carregando</span>;
    if (user) {
      return (
        <div className="artificio-usermenu" ref={menuRef}>
          <button
            type="button"
            className="artificio-avatar-link"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
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
          {menuOpen ? (
            <div className="artificio-usermenu-dropdown" role="menu">
              {user.role === "admin" ? (
                <a role="menuitem" className="artificio-usermenu-item" href="/admin/">
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
        </div>
      );
    }
    return (
      <button
        className="artificio-login-button"
        type="button"
        onClick={() => redirectToLogin()}
      >
        Entrar
      </button>
    );
  })();

  /* A marca (logo) NÃO vive aqui: as imagens são assets importados pelo Astro
     (`logos` em `lib/content.ts`), e o `SiteHeader.astro` continua dono dela. A ilha
     entra depois do brand, como irmã dele dentro de `.artificio-header-main`. */
  return (
    <>
      {renderNavList(modules, "Projetos do Artifício")}
      {ferramentasPublicas}
      <div className="artificio-session" aria-live="polite">
        <NotificationBell sourceApp="site" />
        {sessao}
        <button
          type="button"
          className="artificio-menu-toggle"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={toggleNav}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* 2ª linha (desktop): categorias do blog. `styles.css:2023` a esconde em ≤860px —
          os links continuam alcançáveis pelo painel mobile abaixo. */}
      <div className="artificio-subnav">
        {renderNavList(sections, "Seções do blog")}
      </div>

      {/* Painel mobile (T3.5d): é o que devolve os 11 links em ≤860px, onde
          `styles.css:2022` esconde os navs inline. Só aparece com o toggle aberto;
          `.artificio-mobile-nav` já tem estilo pronto no `packages/ui`. */}
      {navOpen ? (
        <div className="artificio-mobile-nav" onClick={() => setNavOpen(false)}>
          {renderNavList(modules, "Projetos do Artifício (menu)")}
          {renderNavList(sections, "Seções do blog (menu)")}
        </div>
      ) : null}

      <StaticChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} rawChangelogs={rawChangelogs} />
    </>
  );
}

export default SiteHeaderIsland;
