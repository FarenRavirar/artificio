import { getAccountsOrigin, logout, redirectToLogin, useSession } from "@artificio/auth/client";
import { NotificationBell, StaticChangelogModal, ThemeToggle, useChangelogBadge, CHANGELOG_UPDATE_MARKERS } from "@artificio/ui";
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
  /* A marca vem por prop porque os arquivos são assets do pipeline do Astro (hash no
     nome, resolvidos em build). A ilha renderiza o `<a class="artificio-brand">` para
     ele ser FILHO DIRETO do grid — ver a nota extensa no `return`. */
  logoNavy?: string;
  logoNeg?: string;
  brandName?: string;
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
export function SiteHeaderIsland({
  modules = [],
  sections = [],
  currentHref,
  siteOrigin,
  pathname,
  logoNavy = "",
  logoNeg = "",
  brandName = "Artifício RPG",
}: Readonly<SiteHeaderIslandProps>) {
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

  /* NÃO voltar a chamar `applyHeaderVariant(theme)` daqui (T7.4, spec 102).
     Essa chamada era a causa do FOUC que o mantenedor relatava ("o site sempre
     carrega o branco e troca para o escuro, do nada, a cada F5"): ela só rodava
     depois do `client:idle`, enquanto o corpo já havia escurecido pelo script
     inline do `Base.astro`, que roda antes da primeira pintura. O header ficava
     branco no intervalo. Agora ele escurece por CSS, junto com o corpo —
     `:root[data-theme="dark"] .artificio-header:not([data-variant="light"])`. */

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
  function renderNavList(items: SiteNavItem[], ariaLabel: string, onNavigate?: () => void) {
    return (
      <nav aria-label={ariaLabel}>
        <ul className="artificio-nav-list">
          {items.map((item) => (
            <li key={item.href}>
              <a
                className="artificio-nav-link"
                href={item.href}
                aria-current={isCurrent(item) ? "page" : undefined}
                onClick={onNavigate}
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

  /* A ILHA É DONA DO `<header>` INTEIRO — e isto é o contrato, não preferência de
     organização (correção do aceite 16, 2026-09-14).

     Antes, `SiteHeader.astro` abria `<header>` + `.artificio-header-main` e a ilha
     renderizava um Fragment com nav/ferramentas/sessão/subnav dentro. Parecia
     equivalente e não era, por dois motivos medidos no beta (2026-09-14):

     1. Ao hidratar um componente, o Astro injeta um `<style>` e um `<script>` como
        IRMÃOS do `<astro-island>`, dentro do mesmo pai. Eles são filhos diretos do
        grid e ocupam coluna. Medido: os itens eram `<style>`, `<script>`, nav e tools
        — 5 para as 4 colunas de `styles.css`, 3 em ≤860px. As ferramentas públicas
        caíam fora da área visível ("não tem changelog nem mudar para escuro").
     2. A subnav é 2ª LINHA do header (`.artificio-header` é `flex-direction: column`,
        e ela tem `border-top` próprio). Dentro do grid ela vira coluna.

     O `<astro-island>` em si NÃO era o problema: o Astro já emite
     `astro-island,astro-slot,astro-static-slot{display:contents}` por conta própria
     (conferido no HTML servido), então ele é transparente ao layout. Não adicionar essa
     regra ao CSS do projeto achando que corrige — ela já está lá, e não alcança o
     `<style>`/`<script>` irmãos nem a subnav.

     É também o padrão do único outro header por ilha que funciona: `apps/links`
     (`PortalHeader.astro` → `<LinksHeader client:load />`), onde o `<astro-island>` fica
     FORA do `<header>` e não interfere em grid nenhum.

     A marca continua vindo do Astro por prop (`logoNavy`/`logoNeg`): os arquivos são
     assets importados pelo pipeline do Astro, com hash no nome, e a ilha não os conhece. */
  return (
    <header className="artificio-header" data-sticky="true">
      <div className="artificio-header-main">
        <a className="artificio-brand" href="/">
          <img className="artificio-brand-logo logo-navy" src={logoNavy} alt={brandName} width="300" height="100" />
          <img className="artificio-brand-logo logo-neg" src={logoNeg} alt={brandName} width="300" height="100" />
        </a>
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
      </div>

      {/* 2ª linha (desktop): categorias do blog. IRMÃ do `.artificio-header-main`, porque
          `.artificio-header` é `flex-direction: column` e a subnav tem `border-top`
          próprio — dentro do grid ela virava uma coluna, não uma linha.
          `styles.css:2039` a esconde em ≤860px; os links seguem no painel mobile. */}
      <div className="artificio-subnav">
        {renderNavList(sections, "Seções do blog")}
      </div>

      {/* Painel mobile (T3.5d): é o que devolve os 11 links em ≤860px, onde
          `styles.css:2022` esconde os navs inline. Só aparece com o toggle aberto;
          `.artificio-mobile-nav` já tem estilo pronto no `packages/ui`. Também irmão do
          grid, pelo mesmo motivo da subnav.

          O <div> NÃO escuta evento (Sonar S6847/S1082): quem fecha é o próprio link, pelo
          `onNavigate` passado ao `renderNavList`. O `<a>` é interativo de nascença —
          teclado, toque e mouse de graça —, enquanto `role`+`tabIndex` num <div>
          inventaria um controle que não existe. Primeira tentativa trocou `onClick` por
          `onClickCapture`+`onKeyUp` e o Sonar seguiu acusando, com razão: a regra é sobre
          haver handler no elemento não-interativo, não sobre qual. */}
      {navOpen ? (
        <div className="artificio-mobile-nav">
          {renderNavList(modules, "Projetos do Artifício (menu)", () => setNavOpen(false))}
          {renderNavList(sections, "Seções do blog (menu)", () => setNavOpen(false))}
        </div>
      ) : null}

      <StaticChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} rawChangelogs={rawChangelogs} />
    </header>
  );
}

export default SiteHeaderIsland;
