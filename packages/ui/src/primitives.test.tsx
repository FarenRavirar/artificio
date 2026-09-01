import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  EmptyState,
  Field,
  HeaderAction,
  Modal,
  Panel,
  Select,
  Textarea,
  TextInput,
  Toolbar,
} from "./primitives.js";
import type { CheckboxProps } from "./primitives.js";

describe("ui primitives", () => {
  it("renders buttons with semantic variant, size and loading state", () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" size="lg" loading>
        Salvar
      </Button>,
    );

    expect(html).toContain("artificio-button-primary");
    expect(html).toContain("artificio-button-lg");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("Salvar");
  });

  it("renders anchor buttons without disabling navigation", () => {
    const html = renderToStaticMarkup(
      <Button href="/admin" variant="ghost">
        Admin
      </Button>,
    );

    expect(html).toContain("<a");
    expect(html).toContain('href="/admin"');
    expect(html).toContain("artificio-button-ghost");
  });

  it("renders field controls with accessible error state", () => {
    const html = renderToStaticMarkup(
      <Field id="name" label="Nome" error="Obrigatorio" required>
        <TextInput id="name" invalid defaultValue="" />
      </Field>,
    );

    expect(html).toContain('for="name"');
    expect(html).toContain("artificio-field-required");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Obrigatorio");
  });

  it("renders form controls and badges with shared classes", () => {
    const html = renderToStaticMarkup(
      <>
        <Textarea controlSize="sm" />
        <Select controlSize="lg">
          <option>Um</option>
        </Select>
        <Badge variant="success">Ativo</Badge>
      </>,
    );

    expect(html).toContain("artificio-textarea");
    expect(html).toContain("artificio-control-sm");
    expect(html).toContain("artificio-control-lg");
    expect(html).toContain("artificio-badge-success");
  });

  it("renders checkbox with the shared target-size class", () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="Manter link direto" defaultChecked />);

    expect(html).toContain('type="checkbox"');
    expect(html).toContain("artificio-checkbox");
    expect(html).toContain("checked");
  });

  // O `Omit<..., "type">` de `CheckboxProps` so protege em TS. Consumidor JS
  // (ou um `as any`) que passasse `type` sobrescrevia o atributo e produzia um
  // controle de outro tipo com a classe do checkbox: o alvo de 24px aplicado a
  // algo que nao e checkbox (achado de review, PR #303).
  it("keeps type=checkbox even when a JS consumer passes a conflicting type", () => {
    const props = { type: "radio" } as unknown as CheckboxProps;
    const html = renderToStaticMarkup(<Checkbox aria-label="Manter link direto" {...props} />);

    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('type="radio"');
    expect(html).toContain("artificio-checkbox");
  });

  it("renders layout primitives without domain behavior", () => {
    const html = renderToStaticMarkup(
      <Panel tone="warning" header={<strong>Filtros</strong>} actions={<Button>Limpar</Button>}>
        <Toolbar leading={<span>Total</span>} trailing={<Button>Aplicar</Button>}>
          Busca
        </Toolbar>
      </Panel>,
    );

    expect(html).toContain("artificio-panel-warning");
    expect(html).toContain("artificio-panel-actions");
    expect(html).toContain("artificio-toolbar-leading");
    expect(html).toContain("artificio-toolbar-trailing");
  });

  it("renders state primitives", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Nada encontrado" message="Ajuste os filtros." action={<Button>Limpar</Button>} />,
    );

    expect(html).toContain("artificio-state-empty");
    expect(html).toContain("Nada encontrado");
    expect(html).toContain("Ajuste os filtros.");
  });

  it("renders modal and drawer only when open", () => {
    const closedModal = renderToStaticMarkup(
      <Modal open={false} title="Fechado">
        Conteudo
      </Modal>,
    );
    const openModal = renderToStaticMarkup(
      <Modal open title="Confirmar" description="Revise antes de seguir.">
        Conteudo
      </Modal>,
    );
    const drawer = renderToStaticMarkup(
      <Drawer open title="Filtros" side="bottom">
        Conteudo
      </Drawer>,
    );

    expect(closedModal).toBe("");
    expect(openModal).toContain('role="dialog"');
    expect(openModal).toContain('aria-modal="true"');
    expect(openModal).toContain("Revise antes de seguir.");
    expect(drawer).toContain("artificio-drawer-bottom");
  });

  it("renders HeaderAction as button or link with accessible badge", () => {
    const button = renderToStaticMarkup(
      <HeaderAction label="Notificacoes" badge={3}>
        N
      </HeaderAction>,
    );
    const link = renderToStaticMarkup(
      <HeaderAction label="Changelog" href="/changelog" badge>
        C
      </HeaderAction>,
    );

    expect(button).toContain("<button");
    expect(button).toContain('aria-label="Notificacoes"');
    expect(button).toContain("artificio-header-action-badge-count");
    expect(button).toContain(">3</span>");
    expect(link).toContain("<a");
    expect(link).toContain('href="/changelog"');
    expect(link).toContain('aria-label="Novo"');
  });
});
