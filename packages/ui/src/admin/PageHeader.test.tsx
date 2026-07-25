import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader.js";

describe("PageHeader", () => {
  it("renderiza trilha, descrição e ação", () => {
    const html = renderToStaticMarkup(<PageHeader breadcrumb={["Gestão", "Materiais"]} title="Materiais" description="Resumo" action={<button>Ação</button>} />);
    expect(html).toContain('aria-label="Trilha da página"');
    expect(html).toContain("Resumo");
    expect(html).toContain("Ação");
  });
});
