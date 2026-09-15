// @vitest-environment jsdom
//
// Guarda da exclusão mútua dos dois painéis do header (achado do mantenedor, spec 102
// T3.5: "quando clica no direita ou esquerda, o outro tem que fechar, só um pode exibir").
//
// Antes da correção os estados eram independentes: o clique-fora fechava o menu do
// avatar ao tocar no hambúrguer (o toggle está fora do `menuRef`), mas o sentido inverso
// não tinha nada — o painel mobile só escutava `Escape`. Abrir o avatar com o painel
// aberto deixava os dois, sobrepostos: o dropdown é `position:absolute; z-index:50` e o
// painel mobile é irmão em fluxo normal, na mesma extremidade da barra.
//
// jsdom por arquivo (padrão do pacote, ver `vitest.config.ts` e `Drawer.focus.test.tsx`):
// o comportamento depende de clique, então `renderToStaticMarkup` não alcança.
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

function montarLogado() {
  return render(
    <Header
      sessionOverride={{ user: usuario, loading: false }}
      userMenu={[{ label: "Meu Perfil", href: "/perfil" }]}
    />,
  );
}

const avatar = () => screen.getByRole("button", { name: /fulano/i });
const hamburguer = () => screen.getByRole("button", { name: "Menu" });
const menuAberto = () => screen.queryByRole("menu") !== null;
const painelAberto = () => document.querySelector(".artificio-mobile-nav") !== null;

describe("exclusão mútua dos painéis do header", () => {
  it("abre o menu do avatar sozinho", () => {
    montarLogado();
    fireEvent.click(avatar());

    expect(menuAberto()).toBe(true);
    expect(painelAberto()).toBe(false);
  });

  it("abre o painel mobile sozinho", () => {
    montarLogado();
    fireEvent.click(hamburguer());

    expect(painelAberto()).toBe(true);
    expect(menuAberto()).toBe(false);
  });

  it("fecha o painel mobile ao abrir o menu do avatar", () => {
    // Este é o sentido que NÃO existia: o painel só escutava Escape.
    montarLogado();
    fireEvent.click(hamburguer());
    expect(painelAberto()).toBe(true);

    fireEvent.click(avatar());

    expect(menuAberto()).toBe(true);
    expect(painelAberto()).toBe(false);
  });

  it("fecha o menu do avatar ao abrir o painel mobile", () => {
    montarLogado();
    fireEvent.click(avatar());
    expect(menuAberto()).toBe(true);

    fireEvent.click(hamburguer());

    expect(painelAberto()).toBe(true);
    expect(menuAberto()).toBe(false);
  });

  it("nunca deixa os dois abertos ao alternar repetidamente", () => {
    montarLogado();

    for (const abrir of [avatar, hamburguer, avatar, hamburguer]) {
      fireEvent.click(abrir());
      expect(menuAberto() && painelAberto()).toBe(false);
    }
  });

  it("o segundo clique no mesmo controle fecha o próprio painel", () => {
    montarLogado();

    fireEvent.click(hamburguer());
    fireEvent.click(hamburguer());
    expect(painelAberto()).toBe(false);

    fireEvent.click(avatar());
    fireEvent.click(avatar());
    expect(menuAberto()).toBe(false);
  });
});

// ⚠️ ESTE É O GUARD DO BLOQUEADOR DE T7.2 (spec 102).
//
// T7.1 tirou changelog e tema da barra em ≤860px
// (`.artificio-header-tools > *:not([aria-label="Buscar"])`) antes de o destino existir:
// nos 6 apps os dois ficaram inalcançáveis no celular, e no `accounts` — que liga só
// `showThemeToggle` — o usuário perdeu o ÚNICO jeito de trocar para escuro. As 6 suítes
// passaram verdes, porque nenhuma abria o painel e procurava os controles lá dentro.
//
// A asserção é por dentro do PAINEL, não pelo HTML inteiro: os mesmos botões existem na
// barra, então `expect(html).toContain(...)` passaria verde com o painel vazio — que é
// exatamente o estado quebrado que este guard tem de reprovar.
describe("rodapé de ferramentas do painel público (T7.2)", () => {
  /** Recorte do painel aberto. `null` se ele não estiver na tela. */
  const painel = () => document.querySelector(".artificio-mobile-nav");

  const abrirPainel = () => fireEvent.click(hamburguer());

  function montar(props: Partial<Parameters<typeof Header>[0]> = {}) {
    return render(<Header sessionOverride={{ user: null, loading: false }} {...props} />);
  }

  it("põe changelog e tema no painel quando o app liga os dois", () => {
    montar({
      showChangelog: true,
      onOpenChangelog: () => undefined,
      showThemeToggle: true,
    });
    abrirPainel();

    const rodape = painel()?.querySelector(".artificio-mobile-nav-footer");
    expect(rodape, "o painel abriu sem rodapé de ferramentas").not.toBeNull();
    expect(rodape?.querySelector('[aria-label="Novidades"]')).not.toBeNull();
    expect(rodape?.querySelector(".artificio-theme-toggle")).not.toBeNull();
  });

  it("devolve o controle de tema ao `accounts`, que liga SÓ o tema", () => {
    // Aceite 5 de T7.2, e o caso mais grave do bloqueador: sem changelog nem busca, o
    // `accounts` ficou sem nenhuma ferramenta alcançável no celular.
    montar({ showThemeToggle: true });
    abrirPainel();

    const rodape = painel()?.querySelector(".artificio-mobile-nav-footer");
    expect(rodape?.querySelector(".artificio-theme-toggle")).not.toBeNull();
  });

  it("não cria o rodapé — nem o separador — quando não há ferramenta nenhuma", () => {
    // Container vazio cobraria o `border-top` sem nada abaixo dele.
    montar();
    abrirPainel();

    expect(painel()?.querySelector(".artificio-mobile-nav-footer")).toBeNull();
  });

  it("não cria o rodapé quando `showChangelog` vem sem handler", () => {
    // Mesma regra do wrapper da barra: a condição espelha o que de fato renderiza.
    montar({ showChangelog: true });
    abrirPainel();

    expect(painel()?.querySelector(".artificio-mobile-nav-footer")).toBeNull();
  });

  it("o rodapé é IRMÃO dos navs, não item de lista", () => {
    // Aceite 2. Dentro de um `<ul>` de links, o leitor de tela anunciaria "item 3 de 12"
    // para um botão que não navega.
    montar({ moduleNav: [{ label: "Catálogo", href: "/catalogo" }], showThemeToggle: true });
    abrirPainel();

    const rodape = painel()?.querySelector(".artificio-mobile-nav-footer");
    expect(rodape?.parentElement?.className).toBe("artificio-mobile-nav");
    expect(rodape?.closest("ul")).toBeNull();
  });

  it("fecha o painel ao abrir o changelog", () => {
    // O modal é do app e abre sobre a tela; deixar o painel aberto atrás dele empilharia
    // duas camadas na mesma extremidade da barra.
    const onOpenChangelog = vi.fn();
    montar({ showChangelog: true, onOpenChangelog });
    abrirPainel();
    expect(painelAberto()).toBe(true);

    /* O clique é no botão DO RODAPÉ, localizado a partir dele — não por `getByRole`
       global. Com o painel aberto existem DOIS "Novidades" na árvore: o da barra e o
       daqui. Só o CSS de ≤860px esconde o primeiro, e jsdom não aplica media query, então
       a busca global acha os dois e o teste morre com "Found multiple elements" (medido).
       Clicar no da barra também não provaria nada: ele não fecha o painel. */
    const rodape = painel()?.querySelector(".artificio-mobile-nav-footer");
    const botao = rodape?.querySelector('[aria-label="Novidades"]');
    expect(botao, "o rodapé abriu sem o botão de novidades").not.toBeNull();

    fireEvent.click(botao as Element);

    expect(onOpenChangelog).toHaveBeenCalledOnce();
    expect(painelAberto()).toBe(false);
  });
});
