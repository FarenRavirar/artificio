import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionCard } from "./SectionCard.js";

describe("SectionCard", () => {
  it("renderiza cabeçalho opcional e corpo", () => {
    const html = renderToStaticMarkup(<SectionCard title="Fila" description="Pendentes" action={<button>Ver</button>}>Itens</SectionCard>);
    for (const text of ["Fila", "Pendentes", "Ver", "Itens"]) expect(html).toContain(text);
  });

  it("renderiza title/description/action numérico igual a 0", () => {
    const html = renderToStaticMarkup(
      <SectionCard title={0} description={0} action={0}>
        Itens
      </SectionCard>,
    );
    const headerCount = (html.match(/>0</g) ?? []).length;
    expect(headerCount).toBe(3);
  });
});
