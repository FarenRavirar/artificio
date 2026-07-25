import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminMain } from "./AdminMain.js";

describe("AdminMain", () => {
  it("omite header vazio e mantém conteúdo", () => {
    const html = renderToStaticMarkup(<AdminMain>Conteúdo</AdminMain>);
    expect(html).not.toContain("<header");
    expect(html).toContain("Conteúdo");
  });

  it("posiciona eyebrow, breadcrumb, ações e subnav", () => {
    const html = renderToStaticMarkup(<AdminMain groupLabel="Materiais" groupEyebrow="Conteúdo" breadcrumbPath={["Gestão", "Materiais"]} actions={<button>Novo</button>} subnav={<span>Todos</span>}>Tela</AdminMain>);
    for (const text of ["Conteúdo", "Gestão", "Materiais", "Novo", "Todos", "Tela"]) expect(html).toContain(text);
  });
});
