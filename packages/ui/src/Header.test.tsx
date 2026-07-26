import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header.js";

vi.mock("@artificio/auth/client", () => ({
  getAccountsOrigin: () => "https://accounts.artificiorpg.com",
  logout: vi.fn(),
  redirectToLogin: vi.fn(),
  useSession: () => ({ user: null, loading: false }),
}));

describe("Header search", () => {
  it("renderiza busca embutida controlada sem acoplamento ao router", () => {
    const html = renderToStaticMarkup(
      <Header
        showSearch
        searchValue="aventura"
        onSearchChange={() => undefined}
        searchPlaceholder="Buscar materiais"
        searchLabel="Buscar no catálogo"
        sessionOverride={{ user: null, loading: false }}
      />,
    );

    expect(html).toContain('type="search"');
    expect(html).toContain('value="aventura"');
    expect(html).toContain('placeholder="Buscar materiais"');
    expect(html).toContain('aria-label="Buscar no catálogo"');
    expect(html).toContain('data-has-search="true"');
  });

  it("preserva o botão de lupa legado para consumidores ainda não migrados", () => {
    const html = renderToStaticMarkup(
      <Header
        showSearch
        onSearch={() => undefined}
        sessionOverride={{ user: null, loading: false }}
      />,
    );

    expect(html).toContain('aria-label="Buscar"');
    expect(html).not.toContain('type="search"');
    expect(html).not.toContain('data-has-search="true"');
  });

  it("não altera consumidores que não habilitam busca", () => {
    const html = renderToStaticMarkup(
      <Header sessionOverride={{ user: null, loading: false }} />,
    );

    expect(html).not.toContain('type="search"');
    expect(html).not.toContain('aria-label="Buscar"');
  });
});
