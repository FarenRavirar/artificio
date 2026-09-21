import { Header, StaticChangelogModal, useChangelogBadge, CHANGELOG_UPDATE_MARKERS, type NavItem, type UserMenuItem } from "@artificio/ui";
import { useState } from "react";
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
  /* `logoNavy`/`logoNeg`/`brandName` saíram em 2026-09-21, com a troca para o `Header`
     do pacote: ele importa a marca de `packages/ui/src/brand.ts` e emite as duas `<img>`
     com `src`, `width`, `height` e `alt` próprios (`Header.tsx:353-368`) — é por onde os
     outros 6 apps já recebem o logo. Passá-los daqui duplicaria a fonte da marca. */
}


/*
  Header do `site` (spec 102 T3.5d/T3.5g; troca para o componente compartilhado em
  2026-09-21).

  ESTE ARQUIVO É UMA PONTE, NÃO UM HEADER. Ele resolve o que é específico do portal —
  dados de navegação do Astro, href ativo por pathname, changelog estático e a ponte com
  o `SearchModal.astro` — e entrega tudo ao `Header` de `@artificio/ui`, que é quem
  renderiza o `<header>`.

  ⚠️ NÃO voltar a montar `<header class="artificio-header">` aqui. Foi assim até
  2026-09-21, e o comentário que justificava a duplicação dizia que só a ilha conseguia
  pôr a subnav como IRMÃ de `.artificio-header-main`. Medido nessa data, isso deixou de
  ser verdade: o `Header` do pacote fecha o grid em `Header.tsx:462` e abre
  `.artificio-subnav` em `:465`, fora dele — exatamente a estrutura que o comentário
  pedia. Ela chega por `moduleNav`/`moduleCurrentHref`/`moduleLabel` e nasceu na spec 102
  T7.5, depois do comentário que a declarava impossível.

  O custo da marcação própria foi medido: os achados de cor, peso e subnav da spec 103
  (T5) eram todos o mesmo defeito — um app reimplementando o componente compartilhado
  com as classes CSS dele. Header próprio também significou levar sozinho cada regra
  nova de ≤860px do pacote, e um P1 do Codex (PR #323) nasceu disso.

  ⚠️ Os 11 links do nav PRECISAM continuar no HTML servido (aceite 13, spec 102). Eles
  chegam como props de dado estático e saem no SSR do React — `client:idle` hidrata
  depois, mas a marcação já foi. NÃO trocar por `client:only`.
*/
export function SiteHeaderIsland({
  modules = [],
  sections = [],
  currentHref,
  siteOrigin,
  pathname,
}: Readonly<SiteHeaderIslandProps>) {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const { hasNewUpdate, markSeen } = useChangelogBadge("site_last_seen_update", CHANGELOG_UPDATE_MARKERS.site);

  const openChangelog = () => {
    setChangelogOpen(true);
    markSeen();
  };

  /* Href ativo da subnav, resolvido AQUI e não pelo `Nav` do pacote.
     `Nav.normalizeHref` compara por igualdade (hostname para URL absoluta, string para
     path), e as categorias do blog precisam de PREFIXO: `/rpg/algum-post` destaca
     `/rpg`. Resolvendo o item ativo antes, o `Nav` recebe um href exato e a comparação
     dele basta.

     `currentHref` continua tendo precedência (o `Base.astro` o repassa), mas nenhuma
     rota o preenche hoje — medido na spec 102. O fallback por pathname é o que faz a
     categoria atual destacar sem exigir a prop em cada página. */
  const secaoAtiva =
    (currentHref && sections.some((s) => s.href === currentHref) ? currentHref : undefined) ??
    (pathname
      ? sections.find((s) => s.href.startsWith("/") && s.href !== "/" && pathname.startsWith(s.href))?.href
      : undefined);

  /* Ponte com o `SearchModal.astro`: o evento, nunca o `id`.

     O botão do pacote não emite `id="search-toggle"`, e o modal casa os DOIS caminhos
     (`SearchModal.astro:104` pelo id, `:106` pelo evento). Disparar o evento direto
     dispensa o id e não pede prop nova no `Header`.

     O fallback para `/busca/` espera o EVENTO `artificio:search-unavailable`, emitido
     pelo modal quando o carregamento falha — nunca um prazo fixo. A primeira versão
     esperava 100ms e então checava `isOpen`: o bundle do Pagefind tem 171 KB, e num
     primeiro clique sem cache ele ainda está baixando aos 100ms; carregamento em
     andamento era lido como falha e a navegação abortava o modal prestes a abrir.

     Os listeners são registrados aqui e removidos na primeira resposta, em vez de
     viverem num `useEffect`: assim um aviso atrasado de um clique anterior não navega
     sozinho enquanto a pessoa lê a página. */
  const openSearch = () => {
    const cleanup = () => {
      document.removeEventListener("artificio:search-unavailable", onUnavailable);
      document.removeEventListener("artificio:search-opened", cleanup);
    };
    const onUnavailable = () => {
      cleanup();
      window.location.assign("/busca/");
    };
    document.addEventListener("artificio:search-unavailable", onUnavailable);
    document.addEventListener("artificio:search-opened", cleanup);
    document.dispatchEvent(new CustomEvent("artificio:open-search"));
  };

  /* "Admin" é do portal, então entra por `userMenu`. "Perfil Artifício" e "Sair" o
     `Header` já põe sozinho — repeti-los daria item duplicado no dropdown. */
  const userMenu: UserMenuItem[] = [{ label: "Admin", href: "/admin/", adminOnly: true }];

  return (
    <>
      <Header
        currentHref={siteOrigin}
        navItems={modules as NavItem[]}
        moduleNav={sections as NavItem[]}
        moduleCurrentHref={secaoAtiva}
        moduleLabel="Seções do blog"
        userMenu={userMenu}
        showThemeToggle
        showSearch
        onSearch={openSearch}
        showChangelog
        onOpenChangelog={openChangelog}
        changelogHasBadge={hasNewUpdate}
      />
      <StaticChangelogModal isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} rawChangelogs={rawChangelogs} />
    </>
  );
}

export default SiteHeaderIsland;
