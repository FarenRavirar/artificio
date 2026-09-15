// @vitest-environment jsdom
//
// Guard do NAV DE MÓDULO (T7.5, spec 102).
//
// O defeito que esta task corrige, medido em 2026-09-15: `Nav.tsx` tinha
// `aria-label="Modulos do Artificio"` FIXO, e a `moduleNav` o herdava. No `mesas` — único
// consumidor de `moduleNav` (medido: 2 ocorrências em `apps/`, ambas no `AppShell.tsx`
// dele) — o item "Catálogo" era anunciado sob o nome dos subdomínios.
//
// Pior dentro do painel público, onde os dois navs renderizam empilhados: duas regiões de
// navegação com nome acessível IDÊNTICO, que o leitor de tela não tem como distinguir
// (WCAG 2.4.1, técnica ARIA11). Na tela também não havia separação — o usuário via 7
// links seguidos sem saber onde terminavam os outros projetos.
//
// jsdom porque o painel só existe depois do clique no hambúrguer; `renderToStaticMarkup`
// nunca vê o menu aberto, e foi assim que o estado anterior passou verde.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header.js";

vi.mock("@artificio/auth/client", () => ({
  getAccountsOrigin: () => "https://accounts.artificiorpg.com",
  logout: vi.fn(),
  redirectToLogin: vi.fn(),
  useSession: () => ({ user: null, loading: false }),
}));

afterEach(cleanup);

const moduleNav = [{ label: "Catálogo", href: "/" }];

function montar(props: Partial<Parameters<typeof Header>[0]> = {}) {
  return render(
    <Header sessionOverride={{ user: null, loading: false }} {...props} />,
  );
}

const abrirPainel = () => fireEvent.click(screen.getByRole("button", { name: "Menu de navegação" }));
const painel = () => document.querySelector(".artificio-mobile-nav");
const subnav = () => document.querySelector(".artificio-subnav");

describe("nav de módulo (T7.5)", () => {
  it("nomeia a subnav com o módulo, não com os projetos", () => {
    // Aceite 2. O `<nav>` da 2ª linha é uma região de navegação própria; herdar o nome do
    // nav de projetos fazia o leitor de tela anunciar "Catálogo" dentro de "Módulos do
    // Artifício".
    montar({ moduleNav, moduleLabel: "Mesas" });

    expect(subnav()?.querySelector("nav")?.getAttribute("aria-label")).toBe("Mesas");
  });

  it("dá nomes DISTINTOS aos dois navs do painel", () => {
    // O núcleo do defeito: no painel os dois aparecem juntos. Nomes iguais são duas
    // regiões indistinguíveis; a asserção é sobre a diferença, não sobre o texto exato.
    montar({ moduleNav, moduleLabel: "Mesas" });
    abrirPainel();

    const navs = [...(painel()?.querySelectorAll("nav") ?? [])];
    expect(navs).toHaveLength(2);

    const nomes = navs.map((nav) => {
      const porId = nav.getAttribute("aria-labelledby");
      if (porId) return document.getElementById(porId)?.textContent ?? "";
      return nav.getAttribute("aria-label") ?? "";
    });

    expect(nomes.every(Boolean), "algum nav do painel ficou sem nome acessível").toBe(true);
    expect(new Set(nomes).size, `os dois navs do painel têm o mesmo nome: ${nomes.join(" / ")}`).toBe(2);
  });

  it("titula o bloco do módulo NA TELA, dentro do painel", () => {
    // Aceite 2, lado visual. O nome acessível resolve o leitor de tela; quem enxerga
    // precisa do rótulo na tela, porque os dois navs empilham sem separação.
    montar({ moduleNav, moduleLabel: "Mesas" });
    abrirPainel();

    const rotulo = painel()?.querySelector(".artificio-mobile-nav-module-label");
    expect(rotulo?.textContent).toBe("Mesas");
  });

  it("o rótulo visível É o nome acessível do nav — uma fonte só", () => {
    // `aria-labelledby` aponta para o texto que o usuário lê, em vez de repetí-lo num
    // `aria-label`. Duas fontes para o mesmo nome saem de sincronia na primeira edição.
    montar({ moduleNav, moduleLabel: "Mesas" });
    abrirPainel();

    const navModulo = [...(painel()?.querySelectorAll("nav") ?? [])].find((nav) =>
      nav.hasAttribute("aria-labelledby"),
    );
    expect(navModulo, "o nav do módulo não usa `aria-labelledby`").toBeTruthy();
    // Com `aria-labelledby` presente, `aria-label` é ignorado pelo navegador: emitir os
    // dois deixaria texto morto no HTML para divergir depois.
    expect(navModulo?.hasAttribute("aria-label")).toBe(false);

    const id = navModulo?.getAttribute("aria-labelledby") ?? "";
    expect(document.getElementById(id)?.textContent).toBe("Mesas");
  });

  it("sem `moduleNav` não há rótulo nem 2º nav no painel", () => {
    // Caso dos 5 apps que não passam a prop (medido: só o `mesas` passa). Um rótulo
    // órfão titularia um bloco que não existe.
    montar();
    abrirPainel();

    expect(painel()?.querySelectorAll("nav")).toHaveLength(1);
    expect(painel()?.querySelector(".artificio-mobile-nav-module-label")).toBeNull();
    expect(subnav()).toBeNull();
  });

  it("`moduleNav` sem `moduleLabel` ainda ganha nome próprio", () => {
    // O default é genérico de propósito: um consumidor futuro que passe só `moduleNav`
    // não pode regredir para o nome do nav de projetos, que é o defeito desta task.
    montar({ moduleNav });
    abrirPainel();

    const navs = [...(painel()?.querySelectorAll("nav") ?? [])];
    const nomes = navs.map((nav) => {
      const porId = nav.getAttribute("aria-labelledby");
      if (porId) return document.getElementById(porId)?.textContent ?? "";
      return nav.getAttribute("aria-label") ?? "";
    });

    expect(new Set(nomes).size).toBe(2);
  });
});
