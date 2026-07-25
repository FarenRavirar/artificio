import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminWorkspaceLayout } from "./AdminWorkspaceLayout.js";

describe("AdminWorkspaceLayout", () => {
  it("omite inspector nulo", () => {
    const html = renderToStaticMarkup(<AdminWorkspaceLayout workspace="Lista" inspector={null} />);
    expect(html).toContain("Lista");
    expect(html).not.toContain("<aside");
  });

  it("renderiza inspector e controle de fechar", () => {
    const html = renderToStaticMarkup(
      <AdminWorkspaceLayout workspace="Lista" inspector="Detalhe" closeIcon="F" onCloseInspector={() => {}} />,
    );
    expect(html).toContain("Detalhe");
    expect(html).toContain('aria-label="Fechar inspector"');
  });

  it("omite controle de fechar quando onCloseInspector ausente", () => {
    const html = renderToStaticMarkup(<AdminWorkspaceLayout workspace="Lista" inspector="Detalhe" />);
    expect(html).toContain("Detalhe");
    expect(html).not.toContain('aria-label="Fechar inspector"');
  });
});
