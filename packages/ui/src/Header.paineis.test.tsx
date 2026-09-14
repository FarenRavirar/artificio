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
