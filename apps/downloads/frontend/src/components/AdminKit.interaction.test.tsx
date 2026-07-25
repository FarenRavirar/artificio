import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminSidebar, AdminTable, AdminWorkspaceLayout, type AdminFacet, type AdminLinkProps } from "@artificio/ui/admin";
import { afterEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  name: string;
  status: string;
}

const rows: Row[] = [
  { id: "1", name: "Alpha", status: "open" },
  { id: "2", name: "Beta", status: "closed" },
];
const facets: AdminFacet<Row>[] = [{
  key: "status",
  label: "Estado",
  options: [
    { value: "open", label: "Aberto" },
    { value: "closed", label: "Fechado" },
  ],
  getValue: (row) => row.status,
}];

function ControlledTable({ onBulk, onRow }: Readonly<{ onBulk: (ids: string[]) => void; onRow: (row: Row) => void }>) {
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});
  return (
    <AdminTable
      tableId="items"
      rows={rows}
      getRowId={(row) => row.id}
      columns={[{ key: "name", header: "Nome", render: (row) => row.name }]}
      facets={facets}
      facetValues={facetValues}
      onFacetChange={(key, value) => setFacetValues((current) => ({ ...current, [key]: value }))}
      bulkActions={[{ key: "delete", label: "Apagar", confirm: "Confirmar?", onRun: onBulk }]}
      rowActions={[{ key: "view", label: "Ver", onRun: onRow }]}
    />
  );
}

function TestLink({ to, className, children, onClick, "aria-current": ariaCurrent }: Readonly<AdminLinkProps>) {
  return <a href={to} className={className} aria-current={ariaCurrent} onClick={(event) => { event.preventDefault(); onClick?.(); }}>{children}</a>;
}

function SearchableSidebar() {
  const [currentHref, setCurrentHref] = useState("/gestao/inicio");
  return (
    <AdminSidebar
      groups={[
        { label: "Conteúdo editorial", items: [{ label: "Materiais", href: "/gestao/materiais" }] },
        { label: "Operação diária", items: [{ label: "Moderação", href: "/gestao/moderacao" }] },
      ]}
      currentHref={currentHref}
      LinkComponent={TestLink}
      onItemSelect={(item) => setCurrentHref(item.href)}
    />
  );
}

afterEach(() => vi.restoreAllMocks());

describe("kit administrativo compartilhado no DOM do consumidor", () => {
  it("controla faceta pelo app", () => {
    render(<ControlledTable onBulk={vi.fn()} onRow={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "open" } });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("seleciona em massa, confirma e executa ação", async () => {
    const onBulk = vi.fn();
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    render(<ControlledTable onBulk={onBulk} onRow={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Selecionar todos"));
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(onBulk).toHaveBeenCalledWith(["1", "2"]));
    expect(globalThis.confirm).toHaveBeenCalledWith(expect.stringContaining("2 item(ns)"));
  });

  it("executa ação de linha", async () => {
    const onRow = vi.fn();
    render(<ControlledTable onBulk={vi.fn()} onRow={onRow} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Ver" })[0]!);
    await waitFor(() => expect(onRow).toHaveBeenCalledWith(rows[0]));
  });

  it("fecha inspector", () => {
    const onClose = vi.fn();
    render(<AdminWorkspaceLayout workspace="Lista" inspector="Detalhe" onCloseInspector={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar inspector" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("pesquisa sem acento e seleciona o resultado", () => {
    render(<SearchableSidebar />);
    fireEvent.change(screen.getByLabelText("Pesquisar na gestão"), { target: { value: "moderacao" } });
    expect(screen.queryByText("Materiais")).not.toBeInTheDocument();
    const result = screen.getByRole("link", { name: "Moderação" });
    fireEvent.click(result);
    expect(result).toHaveAttribute("aria-current", "page");

    fireEvent.change(screen.getByLabelText("Pesquisar na gestão"), { target: { value: "conteúdo" } });
    expect(screen.getByRole("link", { name: "Materiais" })).toBeInTheDocument();
  });
});
