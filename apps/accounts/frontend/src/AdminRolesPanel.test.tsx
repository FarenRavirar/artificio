import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminRolesPanel } from "./AdminRolesPanel.js";

// A tela concede papel global sobre todos os projetos. O `select` disparava o
// PATCH direto no `onChange`, então clique errado promovia a admin sem
// confirmar nem desfazer (achado de review, PR #233; requisito 27 da spec 090,
// prevenção de erro de Nielsen). Estes testes travam o fluxo de confirmação.

const USER_ROW = {
  id: "user-1",
  email: "membro@example.com",
  name: "Membro Um",
  role: "user" as const,
  roleVersion: 1,
  createdAt: "2026-07-01T00:00:00.000Z",
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const spy = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const payload = handler(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as Response;
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

async function renderPanelWithRow() {
  mockFetch(() => ({ users: [USER_ROW] }));
  render(<AdminRolesPanel />);
  await screen.findByText("Membro Um");
}

describe("AdminRolesPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lista contas carregadas", async () => {
    await renderPanelWithRow();
    expect(screen.getByText("membro@example.com")).toBeDefined();
  });

  it("selecionar papel não dispara PATCH — só prepara a mudança", async () => {
    const user = userEvent.setup();
    await renderPanelWithRow();
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockClear();

    await user.selectOptions(screen.getByLabelText(/Alterar papel de Membro Um/), "admin");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDefined();
  });

  it("cancelar descarta a mudança e mantém o papel atual", async () => {
    const user = userEvent.setup();
    await renderPanelWithRow();
    const fetchSpy = vi.mocked(globalThis.fetch);

    const select = screen.getByLabelText(/Alterar papel de Membro Um/) as HTMLSelectElement;
    await user.selectOptions(select, "admin");
    fetchSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(select.value).toBe("user");
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("salvar sem confirmar no diálogo não envia o PATCH", async () => {
    const user = userEvent.setup();
    await renderPanelWithRow();
    vi.stubGlobal("confirm", vi.fn(() => false));
    const fetchSpy = vi.mocked(globalThis.fetch);

    await user.selectOptions(screen.getByLabelText(/Alterar papel de Membro Um/), "admin");
    fetchSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("salvar após confirmar envia PATCH com o papel escolhido", async () => {
    const user = userEvent.setup();
    await renderPanelWithRow();
    const fetchSpy = vi.mocked(globalThis.fetch);
    fetchSpy.mockClear();

    await user.selectOptions(screen.getByLabelText(/Alterar papel de Membro Um/), "admin");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/admin/roles/users/user-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ role: "admin" });
  });

  it("o diálogo de confirmação nomeia conta, papel atual e papel novo", async () => {
    const user = userEvent.setup();
    await renderPanelWithRow();
    const confirmSpy = vi.fn((_question?: string) => false);
    vi.stubGlobal("confirm", confirmSpy);

    await user.selectOptions(screen.getByLabelText(/Alterar papel de Membro Um/), "moderator");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const question = String(confirmSpy.mock.calls[0]?.[0] ?? "");
    expect(question).toContain("Membro Um");
    expect(question).toContain("Usuário");
    expect(question).toContain("Moderador");
  });

  it("erro do backend aparece como alerta e não quebra a tela", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ users: [USER_ROW] }));
    render(<AdminRolesPanel />);
    await screen.findByText("Membro Um");

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "Você não pode rebaixar a própria conta." }),
    } as Response)));

    await user.selectOptions(screen.getByLabelText(/Alterar papel de Membro Um/), "admin");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/não pode rebaixar a própria conta/i)).toBeDefined();
  });
});

// O 403 desta tela nunca é sobre a conta alvo: o backend revalida o ator no
// banco a cada requisição (`requireCurrentAdmin` + `ACTOR_NO_LONGER_ADMIN`), e
// só recusa quando quem opera perdeu o papel durante a sessão. Tratá-lo como
// erro comum deixava o admin rebaixado clicando numa lista que já não podia
// alterar, colecionando a mesma recusa sem entender a causa.
describe("AdminRolesPanel — permissão do próprio ator revogada", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("403 ao salvar trava a tela e oferece recarregar", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ users: [USER_ROW] }));
    render(<AdminRolesPanel />);
    await screen.findByText("Membro Um");

    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Sua permissão de administrador mudou." }),
    } as Response)));

    await user.selectOptions(screen.getByLabelText(/Alterar papel de Membro Um/), "admin");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/permissão de administrador mudou/i)).toBeDefined();
    expect(within(alert).getByRole("button", { name: "Recarregar" })).toBeDefined();

    // Controles travados: nenhuma alteração passaria mesmo se tentada.
    expect((screen.getByLabelText(/Alterar papel de Membro Um/) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  // Sem a guarda no efeito de busca, cada tecla digitada dispararia outro GET
  // que o backend recusa com o mesmo 403 — ruído contra o SSO sem nenhum ganho.
  it("depois do 403 a busca para de disparar requisições", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ users: [USER_ROW] }));
    render(<AdminRolesPanel />);
    await screen.findByText("Membro Um");

    const denied = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Sua permissão de administrador mudou." }),
    } as Response));
    vi.stubGlobal("fetch", denied);

    await user.selectOptions(screen.getByLabelText(/Alterar papel de Membro Um/), "admin");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByRole("button", { name: "Recarregar" });

    const afterPatch = denied.mock.calls.length;
    await user.type(screen.getByPlaceholderText(/Buscar por nome ou e-mail/i), "ana");
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(denied.mock.calls.length).toBe(afterPatch);
  });

  it("403 na listagem esvazia a tabela em vez de mostrar dado sem autoridade", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Acesso restrito a administradores." })
    } as Response)));

    render(<AdminRolesPanel />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Acesso restrito a administradores/i)).toBeDefined();
    expect(screen.queryByText("Membro Um")).toBeNull();
  });
});
