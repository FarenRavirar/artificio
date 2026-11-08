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

function AutoFocusHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir rascunho
      </button>
      <Modal open={open} title="Rascunho" onClose={() => setOpen(false)}>
        <button type="button" autoFocus>Continuar</button>
        <button type="button">Descartar</button>
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

  it("preserva o autoFocus definido pelo consumidor", () => {
    const { getByText, getByLabelText } = render(<AutoFocusHarness />);
    const opener = getByText("Abrir rascunho");
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(getByText("Continuar"));
    fireEvent.click(getByLabelText("Fechar"));
    expect(document.activeElement).toBe(opener);
  });

  it("ignora controles ocultos e recupera foco que esteja fora do dialogo", () => {
    const { getByText, getByLabelText } = render(
      <div>
        <button type="button">Fora</button>
        <Modal open title="Envio" onClose={() => undefined}>
          <button type="button" style={{ display: "none" }}>Oculto</button>
          <button type="button" disabled>Enviando</button>
        </Modal>
      </div>,
    );
    const closeButton = getByLabelText("Fechar");
    getByText("Fora").focus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeButton);
  });
});
