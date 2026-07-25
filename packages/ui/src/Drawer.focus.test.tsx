// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Drawer } from "./primitives.js";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Drawer open={open} title="Filtros" onClose={() => setOpen(false)}>
        <button type="button">Primeiro</button>
        <button type="button">Segundo</button>
      </Drawer>
    </div>
  );
}

describe("Drawer focus trap (D108)", () => {
  it("move foco pro painel ao abrir (primeiro focável: fechar) e restaura ao fechar", () => {
    const { getByText, getByLabelText } = render(<Harness />);
    const opener = getByText("Abrir");
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(getByLabelText("Fechar"));
  });

  it("Tab no último item focável volta pro primeiro (loop preso)", () => {
    const { getByText, getByLabelText } = render(<Harness />);
    fireEvent.click(getByText("Abrir"));

    const closeButton = getByLabelText("Fechar");
    const last = getByText("Segundo");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(closeButton);
  });

  it("Shift+Tab no primeiro item volta pro último (loop preso)", () => {
    const { getByText, getByLabelText } = render(<Harness />);
    fireEvent.click(getByText("Abrir"));

    const closeButton = getByLabelText("Fechar");
    const last = getByText("Segundo");
    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(last);
  });
});
