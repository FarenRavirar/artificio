import { describe, expect, it, vi } from "vitest";
import { bulkArchive, bulkDelete } from "./bulkActions.js";

describe("bulkActions", () => {
  it("recebe ícone e preserva confirmação destrutiva", () => {
    const run = vi.fn();
    expect(bulkDelete("D", run)).toMatchObject({ icon: "D", tone: "danger" });
    expect(bulkArchive("A", run)).toMatchObject({ icon: "A", label: "Arquivar" });
  });
});
