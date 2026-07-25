import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "./Breadcrumb.js";

describe("Breadcrumb", () => {
  it("renderiza trilha e destaca criação", () => {
    const html = renderToStaticMarkup(<Breadcrumb path={["Materiais", "Novo"]} creating />);
    expect(html).toContain("Materiais");
    expect(html).toContain("Novo");
    expect(html).toContain("italic");
  });
});
