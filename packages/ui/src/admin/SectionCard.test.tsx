import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionCard } from "./SectionCard.js";

describe("SectionCard", () => {
  it("renderiza cabeçalho opcional e corpo", () => {
    const html = renderToStaticMarkup(<SectionCard title="Fila" description="Pendentes" action={<button>Ver</button>}>Itens</SectionCard>);
    for (const text of ["Fila", "Pendentes", "Ver", "Itens"]) expect(html).toContain(text);
  });
});
