// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Footer } from "./Footer.js";

afterEach(cleanup);

// Spec 086 T10.1/T10.4 — moduleLinks é aditivo: sem a prop, footer se
// comporta como antes dela existir; com a prop, os links aparecem numa
// segunda lista de nav, ao lado de "Projetos".
describe("Footer moduleLinks", () => {
  it("não renderiza a seção de links do módulo quando moduleLinks não é passado", () => {
    render(<Footer />);

    expect(screen.queryByText("Este projeto")).toBeNull();
  });

  it("renderiza os links do módulo quando moduleLinks é passado", () => {
    render(<Footer moduleLinks={[{ label: "Sobre e uso", href: "/sobre-e-uso" }]} />);

    const link = screen.getByRole("link", { name: "Sobre e uso" });
    expect(link.getAttribute("href")).toBe("/sobre-e-uso");
  });
});
