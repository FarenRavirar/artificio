import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminTable, filterAdminRows, type AdminFacet } from "./AdminTable.js";

interface Row { id: string; name: string; status: string }
const rows: Row[] = [{ id: "1", name: "Alpha", status: "open" }, { id: "2", name: "Beta", status: "closed" }];
const facets: AdminFacet<Row>[] = [{ key: "status", label: "Estado", options: [{ value: "open", label: "Aberto" }], getValue: (row) => row.status }];

describe("AdminTable", () => {
  it("filtra por busca e faceta em função pura", () => {
    expect(filterAdminRows(rows, "alp", ["name"], facets, { status: "open" })).toEqual([rows[0]]);
    expect(filterAdminRows(rows, "", ["name"], facets, { status: "closed" })).toEqual([rows[1]]);
  });

  it("renderiza colunas e controles recebidos", () => {
    const html = renderToStaticMarkup(<AdminTable tableId="items" rows={rows} getRowId={(row) => row.id} columns={[{ key: "name", header: "Nome" }]} searchKeys={["name"]} facets={facets} facetValues={{ status: "open" }} bulkActions={[{ key: "archive", label: "Arquivar", onRun: () => undefined }]} rowActions={[{ key: "view", label: "Ver", onRun: () => undefined }]} />);
    expect(html).toContain('data-table-id="items"');
    expect(html).toContain("Nome");
    expect(html).toContain("Alpha");
    expect(html).not.toContain("Beta");
    expect(html).toContain('aria-label="Selecionar todos"');
  });
});
