// @vitest-environment jsdom
//
// Guard do PAINEL DE SESSÃO (T7.3, spec 102).
//
// A decisão do mantenedor veio na especificação da F7 — "notificação fica dentro do
// direito, pois é notificação de quem fica logado" — e o código não a implementava: o
// sino entrava por `actions` e virava `.artificio-header-actions`, IRMÃO de
// `renderSession()` dentro da faixa. A faixa media 72px (sino de 40 + avatar de 32) em
// vez de 40px, e o header estourava 2px em 320.
//
// ⚠️ `actions` é slot EXTENSÍVEL, e é por isso que o guard é sobre ONDE ele renderiza, e
// não sobre "o sino". Medido em 2026-09-15: `mesas` passa `<HeaderActions />` (sino com
// gate próprio), `downloads` passa o sino direto, `glossario` passa um botão "Adicionar
// Sugestão" e NENHUM sino. Contar itens da faixa é o erro — a lista cresce com o tempo.
//
// jsdom porque o painel só existe depois do clique no avatar. `renderToStaticMarkup` não
// alcança, e foi assim que o estado anterior passou verde: o HTML servido mostra a barra,
// nunca o menu aberto.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header.js";

const usuario = {
  id: "u1",
  email: "teste@artificiorpg.com",
  name: "Fulano de Tal",
  role: "user" as const,
  avatar: null,
};

vi.mock("@artificio/auth/client", () => ({
  getAccountsOrigin: () => "https://accounts.artificiorpg.com",
  logout: vi.fn(),
  redirectToLogin: vi.fn(),
  useSession: () => ({ user: null, loading: false }),
}));

afterEach(cleanup);

/** Ação injetada pelo módulo, no lugar do sino real (que exige rede e sessão). */
const acaoDoModulo = <button type="button" data-testid="acao-do-modulo" />;

function montar(logado: boolean, props: Record<string, unknown> = {}) {
  return render(
    <Header
      sessionOverride={{ user: logado ? usuario : null, loading: false }}
      userMenu={[{ label: "Meu Perfil", href: "/perfil" }]}
      actions={acaoDoModulo}
      {...props}
    />,
  );
}

const avatar = () => screen.getByRole("button", { name: /fulano/i });
const faixa = () => document.querySelector(".artificio-session");
const painel = () => document.querySelector(".artificio-usermenu-dropdown");

describe("painel de sessão (T7.3)", () => {
  it("não deixa `actions` na faixa — nem antes nem depois de abrir o painel", () => {
    // O defeito exato que a task conserta: `.artificio-header-actions` irmão do avatar.
    montar(true);

    expect(faixa()?.querySelector('[data-testid="acao-do-modulo"]')).toBeNull();
    expect(document.querySelector(".artificio-header-actions")).toBeNull();

    fireEvent.click(avatar());

    expect(faixa()?.querySelector(".artificio-usermenu-actions")).not.toBeNull();
    // Dentro do painel, que por sua vez está dentro da faixa — o que importa é não ser
    // IRMÃO do avatar, ocupando largura na barra.
    expect(
      painel()?.querySelector('[data-testid="acao-do-modulo"]'),
      "`actions` não está dentro do painel de sessão",
    ).not.toBeNull();
  });

  it("só o avatar fica na barra: nenhum outro botão irmão dele", () => {
    // A aritmética de 320px depende disto. Filhos diretos da faixa: o wrapper do
    // usermenu e o `menu-toggle` (escondido por CSS em ≤860px, mas presente no DOM).
    montar(true);

    const diretos = [...(faixa()?.children ?? [])].map((el) => el.className);

    expect(diretos).toEqual(["artificio-usermenu", "artificio-menu-toggle"]);
  });

  it("deslogado: só `Entrar`, e nenhum item de conta no DOM", () => {
    // Aceite 2. `actions` é conteúdo de quem está logado; sem sessão não há painel.
    montar(false);

    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(document.querySelector('[data-testid="acao-do-modulo"]')).toBeNull();
    expect(document.querySelector(".artificio-usermenu-dropdown")).toBeNull();
    expect(screen.queryByText("Meu Perfil")).toBeNull();
  });

  it("o painel leva ações, itens de conta e `Sair`, nesta ordem", () => {
    // `actions` primeiro porque é o conteúdo do módulo, que o usuário procura antes das
    // rotas de conta; `Sair` por último, como em qualquer menu de conta.
    montar(true);
    fireEvent.click(avatar());

    const html = painel()?.innerHTML ?? "";
    const acao = html.indexOf("acao-do-modulo");
    const perfil = html.indexOf("Meu Perfil");
    const sair = html.indexOf("Sair");

    expect(acao).toBeGreaterThan(-1);
    expect(acao).toBeLessThan(perfil);
    expect(perfil).toBeLessThan(sair);
  });

  it("sem `actions`, o painel não cria o bloco nem o separador", () => {
    // Caso do `accounts` e do `links`, que não passam a prop. Container vazio cobraria o
    // `border-bottom` sem nada acima dele.
    montar(true, { actions: undefined });
    fireEvent.click(avatar());

    expect(painel()).not.toBeNull();
    expect(painel()?.querySelector(".artificio-usermenu-actions")).toBeNull();
  });

  it("o nome do usuário continua nomeando o botão que abre o painel", () => {
    // Aceite 4. A `<img>` do avatar tem `alt=""` (decorativa), então o nome acessível vem
    // do `<span class="artificio-user-name">`. O CSS de ≤860px o esconde VISUALMENTE
    // (`clip-path`), nunca com `display: none` — quem guarda isso é
    // `styles.contract.test.ts`, porque jsdom não aplica media query.
    montar(true);

    expect(avatar()).toBeTruthy();
    expect(avatar().getAttribute("aria-haspopup")).toBe("menu");
  });

  it("exclusão mútua: abrir o painel público fecha o de sessão, e vice-versa", () => {
    // Aceite 3, com clique real. Os dois são gavetas na mesma barra; abertas juntas, se
    // sobrepõem.
    montar(true);
    const hamburguer = () => screen.getByRole("button", { name: "Menu de navegação" });

    fireEvent.click(avatar());
    expect(painel()).not.toBeNull();

    fireEvent.click(hamburguer());
    expect(painel()).toBeNull();
    expect(document.querySelector(".artificio-mobile-nav")).not.toBeNull();

    fireEvent.click(avatar());
    expect(painel()).not.toBeNull();
    expect(document.querySelector(".artificio-mobile-nav")).toBeNull();
  });
});
