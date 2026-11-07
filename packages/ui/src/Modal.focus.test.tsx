// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "./primitives.js";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Modal open={open} title="Sugerir sistema" onClose={() => setOpen(false)}>
        <button type="button">Primeiro</button>
        <button type="button">Segundo</button>
      </Modal>
    </div>
  );
}

describe("Modal focus trap", () => {
  it("move o foco ao abrir, fecha com Escape e restaura o acionador", () => {
    const { getByText, getByLabelText, queryByRole } = render(<Harness />);
    const opener = getByText("Abrir");
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(getByLabelText("Fechar"));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("mantem Tab e Shift+Tab dentro do dialogo", () => {
    const { getByText, getByLabelText } = render(<Harness />);
    fireEvent.click(getByText("Abrir"));

    const first = getByLabelText("Fechar");
    const last = getByText("Segundo");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
